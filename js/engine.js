(function(window) {
  const NOTES = 'c d ef g a b';
  const CHORDS = {
    'maj': [0,4,7],
    'min': [0,3,7],
    'dom': [0,3,7, 10],
    'maj-6': [0,4,7,9],
    'min-6': [0,3,7,9],
    'maj-7': [0,4,7,11],
    'min-7': [0,4,7,10],
    'haus': [0,3,7,12],
  }

  //////////////////////////////////////////////// Utilities
  function makeNoise(ac, length = 1) {
    const buffer = ac.createBuffer(1, 44100 * length, 44100)
    const array = buffer.getChannelData(0);
    for(var i=0,l=array.length;i<l;i++) {
      array[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  function n2f(n) {
    return Math.pow(2, (n - 69) / 12) * 440;
  }

  function ADSR (param, time, length, min, max, a, d, s,r) {
    if (s < 0 || s > 1) {return; }
    param.setValueAtTime(min, time)
    param.linearRampToValueAtTime(max, time + (a*length))
    param.linearRampToValueAtTime(min + ((max - min) * s), time + ((a + d)*length))
    param.setValueAtTime(min + ((max - min) * s), time + length - (length*r))
    param.linearRampToValueAtTime(min, time + length)
  }


  function AD(param, lower, upper, time, attack, decay) {
    param.setValueAtTime(lower, time)
    param.linearRampToValueAtTime(upper, time + attack)
    param.setValueAtTime(upper, time + attack)
    param.linearRampToValueAtTime(lower, time + attack + decay);
  }

  function DCA(context, input, volume, time, attack, decay) {
    const gain = context.createGain()
    input.connect(gain);
    AD(gain.gain, 0, volume, time, attack, decay)
    return gain;
  }

  function distCurve(ac, k) {
    const c = new Float32Array(ac.sampleRate)
    const deg = Math.PI / 180;
    for(var i=0,l=c.length;i<l;i++) {
      const x = i * 2 / l - 1;
      c[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return c;
  }


  function s2f(note) {
    var matched = note.toLowerCase().match(/([abcdefg])(#?)(-?[0-9])/)
    if (!matched) { return 0; }
    var octave = 0;
    try {
      octave = parseInt(matched[3], 10);
    } catch(e) {
      octave = 0;
    }
    octave = Math.min(9, Math.max(-1, octave));
    var note = NOTES.indexOf(matched[1]);

    if (matched[2] === '#') { note += 1; }
    return ((octave + 1) * 12) + note;
  }

  function note2note(note) {
    if (typeof note === 'number') {
      return note;
    } else if (typeof note === 'string') {
      return s2f(note);
    } else {
      return 69; // A4
    }
  }

  class Parameterized {
    defaults(defaults = {}) {
      this.defaults = defaults
      this.params = Object.assign({}, this.defaults);
    }
    reset() {
      this.params = Object.assign({}, this.defaults);
    }
    applyOptions(options = {}) {
      this.params = Object.assign(this.params, options);
    }

    param(name) {
      if (typeof this.params[name] === 'function') {
        return this.params[name]();
      } else {
        return this.params[name];
      }
    }
  }


  class BufferNode {
    constructor(context, buffer) {
      this.context = context
      this.buffer = buffer
    }
    connect(dest) {
      this.destination = dest
    }
    start(time) {
      this.source  = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.destination)
      this.source.start(time)
    }
    stop(time) {
      this.source.stop(time);
    }
  }

  //////////////////////////////////////////////// Drum Sound Generators

  class NoiseHat extends Parameterized {
    constructor (context, noise) {
      super();
      this.context = context;
      this.noise = noise || makeNoise(context);
      this.defaults({
        volume: 0.8,
        decay: 20,
        f: 6000,
        q: 5
      })
    }
    play (output, time) {
      const decayTime = time + (0.5 / this.param('decay'));
      const noise = new BufferNode(this.context, this.noise)
      const filter = this.context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = this.param('f');
      filter.Q.value = this.param('q');
      const amp = this.context.createGain();
      noise.connect(filter);
      filter.connect(amp);
      amp.connect(output);
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(this.param('volume'), time + 0.001);
      amp.gain.setValueAtTime(this.param('volume'), time + 0.001);
      amp.gain.linearRampToValueAtTime(0, decayTime)
      noise.start(time);
      noise.stop(decayTime);
      return this
    }

    p (output, time, options = {}) {
      this.applyOptions(options)
      this.play(output, time)
      return this
    }
  }

  class DrumSynth extends Parameterized {
    constructor(context) {
      super();
      this.context = context;
      this.defaults({
        volume: 0.8,
        sweep: 20,
        decay: 20,
        start: 200,
        end: 50
      });
    }
    play(output, time) {
      const fDecayTime = time + (1 / this.param('sweep'))
      const aDecayTime = (1 / this.param('decay'))

      const sine = this.context.createOscillator()
      const click = this.context.createOscillator();
      click.type = 'square'

      AD(click.frequency, this.param('end'), 100, time, 0, 0.001);

      const clickamp = DCA(this.context, click, this.param('volume') * 0.8, time, 0.005, 0.02)
      const amp = DCA(this.context, sine, this.param('volume'), time, 0.004, aDecayTime)

      clickamp.connect(output)
      amp.connect(output)
      // function done() {
      //   clickamp.disconnect(output);
      //   amp.disconnect(output);
      //   sine.disconnect(amp);
      //   click.disconnect(clickamp)
      //   sine.removeEventListener('ended', done);
      // }
      // sine.addEventListener('ended' , done)

      sine.frequency.setValueAtTime(this.param('start'), time);
      sine.frequency.exponentialRampToValueAtTime(this.param('end'), fDecayTime);
      sine.start(time);sine.stop(time + aDecayTime + 1)
      click.start(time);click.stop(time + 0.002)


      return this;
    }

    p(output, time, options = {}) {
      this.applyOptions(options)
      this.play(output, time)
      return this;
    }
  }


  class SnareSynth extends Parameterized {
    constructor(context, noise) {
      super()
      this.context = context
      this.noise = noise
      this.drumsyn = new DrumSynth(this.context)
      this.defaults({
        volume: 0.5,
        sweep: 20,
        decay: 10,
        start: 400,
        end: 100,
        f: 4000,
        q: 5
      })
      this.drumsyn.applyOptions(this.params)
    }
    play(output, time) {
      const aDecayTime = time + (1 / this.param('decay'))
      const amp = this.context.createGain()
      amp.connect(output)
      const noise = new BufferNode(this.context, this.noise)
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = this.param('f');
      filter.Q.value = this.param('q');
      noise.connect(filter)

      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(this.param('volume'), time + 0.001);
      amp.gain.linearRampToValueAtTime(0, aDecayTime);
      filter.connect(amp)
      // noise.onended = () => {
      //   noise.disconnect(filter)
      //   filter.disconnect(amp)
      //   amp.disconnect(output)
      //   noise.onended = null
      // }
      noise.start(time)
      noise.stop(aDecayTime)
      this.drumsyn.applyOptions(this.params)
      this.drumsyn.play(output, time)
      return this
    }

    p(output, time, options = {}) {
      this.applyOptions(options)
      this.play(output, time)
      return this
    }
  }

  //////////////////////////////////////////////// Melodic Sound Generators

  class AcidSynth extends Parameterized {
    constructor(context) {
      super()
      this.context = context
      this.defaults({
        osc: 'sawtooth',
        decay: 0.6,
        f: 300,
        fmod: 4000,
        q: 10
      })
    }

    play(destination, time, length, freq, volume = 0.2) {
      const gain = this.context.createGain();
      const filter1 = this.context.createBiquadFilter();
      const filter2 = this.context.createBiquadFilter();
      const osc = this.context.createOscillator();
      osc.type = this.param('osc')
      osc.frequency.value = freq

      ADSR(gain.gain, time, length, 0, volume, 0.01, this.param('decay'), 0, 0)
      ADSR(filter1.frequency, time, length, this.param('f'), this.param('f') + this.param('fmod'), 0.01, this.param('decay'), 0, 0)
      ADSR(filter2.frequency, time, length, this.param('f'), this.param('f') + this.param('fmod'), 0.01, this.param('decay'), 0, 0)

      filter1.Q.value = this.param('q')
      filter2.Q.value = this.param('q')
      osc.connect(filter1)
      filter1.connect(filter2)
      filter2.connect(gain)
      gain.connect(destination)
      // osc.onended = () => {
      //   gain.disconnect(destination);
      //   filter2.disconnect(gain);
      //   filter1.disconnect(filter2)
      //   osc.disconnect(filter1)
      //   osc.onended = null
      // }
      osc.start(time)
      osc.stop(time+length)
      return this
    }

    p (out, time, length, freq, options = {}) {
      this.applyOptions(options)
      this.play(out, time, length, freq, this.param('volume'))
      return this
    }
  }

  class SpreadSynth extends Parameterized {

    constructor(context) {
      super()
      this.context = context;
      this.defaults({
        spread: 10,
        osc_type: 'sawtooth',
        amp_a: 0.01,
        amp_d: 0.1,
        amp_s: 0.8,
        amp_r: 0.1,
        flt_a: 0.01,
        flt_d: 0.1,
        flt_s: 0.8,
        flt_r: 0.01,
        flt_freq: 500,
        flt_mod: 2000,
        flt_type: 'lowpass',
        Q: 10,
        volume: 0.1
      });
    }

    play(destination, time, length, note) {
      var filter, gain, osc1, osc2;
      gain = this.context.createGain();
      filter = this.context.createBiquadFilter();
      filter.type = this.param('flt_type')
      osc1 = this.context.createOscillator();
      osc2 = this.context.createOscillator();
      osc1.type = this.param('osc_type')
      osc2.type = this.param('osc_type')
      osc1.detune.value = this.param('spread')
      osc2.detune.value = this.param('spread') * -1
      osc1.frequency.value = note
      osc2.frequency.value = note
      ADSR(gain.gain, time, length, 0, this.param('volume'), this.param('amp_a'), this.param('amp_d'), this.param('amp_s'), this.param('amp_r'));
      ADSR(filter.frequency, time, length, this.param('flt_freq'), this.param('flt_freq') + this.param('flt_mod'), this.param('flt_a'), this.param('flt_d'), this.param('flt_s'), this.param('flt_r'));
      filter.Q.value = this.param('Q');
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + length);
      osc2.stop(time + length);
      return this;
    }

  p(out, time, length, note, options = {}) {
    this.applyOptions(options);
    this.play(out, time, length, note);
    return this;
  }
}

  //////////////////////////////////////////////// Effects

  class Reverb {
    constructor(context, length = 2, decay = 5) {
      this.context = context;
      this.convolver = context.createConvolver();
      this.makeBuffer(length, decay);
      this.input = this.convolver;
    }
    connect(connectable) {
      this.convolver.connect(connectable);
    }
    makeBuffer(length, decay) {

      const sampleRate = this.context.sampleRate
      const bufferLength = sampleRate * length
      const buffer = this.context.createBuffer(2, bufferLength, sampleRate)
      var impulseL = buffer.getChannelData(0)
      var impulseR = buffer.getChannelData(1)
      for(var i=0;i<bufferLength;i++) {
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferLength, decay)
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferLength, decay)
      }
      this.convolver.buffer = buffer;
    }
  }

  class FilterDelay {
    constructor(context) {
      this.context = context;
      this.delay = this.context.createDelay(10.0);
      this.delay.delayTime.value = 0.2;
      this.fbGain = this.context.createGain();
      this.fbGain.gain.value = 0.5;
      this.fbFilter = this.context.createBiquadFilter();
      this.fbFilter.type = 'highpass';
      this.fbFilter.frequency.value = 1000;
      this.fbFilter.Q.value = 2;
      this.delay.connect(this.fbGain);
      this.fbGain.connect(this.fbFilter);
      this.fbFilter.connect(this.delay);
      this.input = this.delay;
      this.feedback = this.fbGain.gain;
      this.frequency = this.fbFilter.frequency;
      this.time = this.delay.delayTime;
    }
    connect(connectable) {
      this.delay.connect(connectable);
    }
  }

  class Distortion {
    constructor(context) {
      this.inputter = context.createOscillator()
      this.inputter.frequency.value = 20
      this.inputterGain = context.createGain()
      this.inputterGain.gain.value = 0.02
      this.context = context;
      this.mix = context.createGain();
      this.mix.gain.value = 1;
      this.dist = context.createWaveShaper()
      this.dist.connect(this.mix)
      this.inputter.connect(this.inputterGain)
      this.inputterGain.connect(this.dist)
      this.inputter.start()
      this.input = this.dist
      this.setCurve(50);
    }
    setCurve(k) {
      this.dist.curve = distCurve(this.context, k);
    }
    connect(connectable) {
      this.mix.connect(connectable);
    }
  }

  //////////////////////////////////////////////// Mixer

  class MixerChannel {
    constructor(context, sends, type = 'generic') {
      this.sends = sends;
      this.context = context;
      this.sendGains = {};
      this.input = this.context.createGain();
      this.outGain = this.context.createGain();
      this.outGain.gain.value=0.75;

      const methodName = `make_${type}`;
      if (this[methodName]) {
        this[methodName]();
      } else {
        this.make_generic();
      }
      this.connectSends();
    }
    make_generic() {
      // just a passthrough
      this.input.connect(this.outGain);
    }
    make_basedrum() {
      this.distortion = new Distortion(this.context);
      this.input.connect(this.distortion.input);
      this.distortion.connect(this.outGain);
    }
    connect(connectable) {
      this.outGain.connect(connectable);
    }
    connectSends() {
      Object.keys(this.sends).forEach((sendName) => {
        const send = this.sends[sendName];
        const gain = this.context.createGain();
        gain.gain.value = 0.0;
        gain.connect(send.input);
        this.outGain.connect(gain);
        this.sendGains[sendName] = gain;

      });
    }
    send(name) {
      return this.sendGains[name];
    }
  }

  class MixerSend {
    constructor(context, type='delay') {
      this.context = context;
      this.input = this.context.createGain();
      this.outGain = this.context.createGain();
      this.outGain.gain.value = 0.67;
      const methodName = `make_${type}`;
      if (this[methodName]) {
        this[methodName]();
      } else {
        this.make_generic();
      }
    }
    make_generic() {
      this.input.connect(this.outGain);
    }
    make_delay() {
      this.delay = new FilterDelay(this.context);
      this.input.connect(this.delay.input);
      this.delay.connect(this.outGain);
    }
    make_reverb() {
      this.reverb = new Reverb(this.context);
      this.input.connect(this.reverb.input);
      this.reverb.connect(this.outGain);
    }
    connect(connectable) {
      this.outGain.connect(connectable);
    }
  }

  class Mixer {
    constructor(context) {
      this.context = context;
      this.masterCompressor = context.createDynamicsCompressor();
      this.masterGain = context.createGain();
      this.masterCompressor.connect(this.masterGain);
      this.masterCompressor.threshold.value = -30;
      this.masterCompressor.knee.value = 40;
      this.masterCompressor.ratio.value = 12;
      this.masterCompressor.attack.value = 0;
      this.masterCompressor.release.value = 0.25;


      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(context.destination);
      this.channels = {};
      this.sends = {};
      this.addSend('delay', 'delay');
      this.addSend('reverb', 'reverb');


      // this.addSend('delay');
      // this.addSend('reverb/delay');
      this.addChannel('bd','basedrum');
      this.addChannel('sd','snaredrum');
      this.addChannel('perc','percussion');
      this.addChannel('bass','bass');
      this.addChannel('gen1','generic');
      this.addChannel('gen2','generic');
      this.addChannel('gen3','generic');
    }
    addChannel(name, type='generic') {
      var chan = new MixerChannel(this.context, this.sends, type);
      chan.connect(this.masterCompressor);
      this.channels[name] = chan;
    }
    addSend(name, type='delay') {
      var send = new MixerSend(this.context, type);
      send.connect(this.masterCompressor);
      this.sends[name] = send;
    }
    channel(name) {
      return this.channels[name];
    }
    channelOut(name) {
      return this.channels[name].input;
    }
    send(name) {
      return this.sends[name];
    }

  }

  //////////////////////////////////////////////// Engine

  class SoundEngine {
    constructor(callback) {
      this.constructorCallback = callback
      alert('Start Sound')
      this.lateConstructor()
    }
    lateConstructor() {
      this.context = new AudioContext();
      this.mixer = new Mixer(this.context);
      this.mx = this.mixer;
      this.o = this.context.destination;
      this.tempo = 120;
      this.steps = 16;
      this.groove = 0.0;
      this.lc = 0;
      this.NOISE = makeNoise(this.context);
      this.DS = new DrumSynth(this.context);
      this.HH = new NoiseHat(this.context, this.NOISE);
      this.SD = new SnareSynth(this.context, this.NOISE);
      this.AcidSynth =  new AcidSynth(this.context)
      this.SpreadSynth =  new SpreadSynth(this.context)
      this.SL = new window.SampleLoader(this.context)
      this.LATENCY_COMPENSATION = 0.032
      if (this.constructorCallback) {
        this.constructorCallback(this)
      }
      const globals = ['n', 'CH', 'LV', 'SEND', 'ch', 'dp', 'mb']
      globals.forEach((g) => {
        this[g] = this[g].bind(this)
      })
    }
    hello(dis) {
    }

    n(note, offset = 0) {
      note = note2note(note);
      return n2f(note + offset);
    }

    CH(name) {
      return this.mixer.channelOut(name);
    }
    LV(name, value) {
      if (value != null) {
        this.mixer.channel(name).outGain.gain.value = value;
        return;
      }
      return this.mixer.channel(name).outGain.gain;
    }
    SEND(channel, send, value) {
      if (value != null) {
        this.mixer.channel(channel).send(send).gain.value = value;
        return;
      }
      return this.mixer.channel(channel).send(send).gain;

    }


    ch(note, chord, offset, fun) {
      note = note2note(note);
      const chordOffsets = CHORDS[chord];
      if (!chordOffsets) { return; }
      var notes = chordOffsets.map(function(co) {
        return note + co + offset;
      });
      if (typeof(fun) === 'function') {
        notes.forEach(fun, this);
      } else {
        return notes;
      }
    }
    mb(mod, eq, callback) {
      for(var i=0;i<this.steps;i++) {
        if (i % mod === eq) {
          callback(i);
        }
      }
    }
    dp(pattern, callback) {
      for(var i=0,l=this.steps;i<l;i++) {
        const step = i % pattern.length;
        if (pattern[step] === '*') {
          callback(i, function(a,b) { return a;});
        } else if (pattern[step] === '!') {
          callback(i, function(a,b) { return b;});
        }
      }
    }

  }

  class MIDIEngine {
    constructor(audioContext) {
      this._audioContext = audioContext;
      this.MIDI_DELAY_COMPENSATION = 30.0 // wild guess, probably needs fine tuning.

      if (navigator.requestMIDIAccess == null) { return }
      navigator.requestMIDIAccess().then((access) => {
        this._lateSetup(access);
      }).catch((err) => {
        console.error("MIDI ERROR", err);
      })
    }
    _lateSetup(midiAccess) {
      this._INPUTS = {}
      this._OUTPUTS = {}
      this._subscriptions = []
      this.midiAccess = midiAccess
      this.midiAccess.inputs.forEach((input) => {
        this._INPUTS[input.name] = input;
        input.onmidimessage = (event) => {
          this._sendInput(event.data);
        }
      })
      this.midiAccess.outputs.forEach((output) => {
        this._OUTPUTS[output.name] = output;
      })
    }
    midiOutput(name) {
      return this._OUTPUTS[name];
    }
    midiSubscribeToInput(fun) {
      this._subscriptions.push(fun);
    }
    midiResetSubscriptions() {
      this._subscriptions = []
    }
    _sendInput(data) {
      this._subscriptions.forEach((fun) => fun(data))
    }
    send(outputName, message, time) {
      const midiNow = window.performance.now()
      const audioNow = this._audioContext.currentTime * 1000.0
      const diff = midiNow - audioNow
      const midiTime = time * 1000.0 + diff;

      this.midiOutput(outputName).send(message, midiTime + this.MIDI_DELAY_COMPENSATION);
    }
    note(outputName, channel, note, velocity, time, length) {
      this.send(outputName, [0x90 + channel - 1, note2note(note), velocity], time)
      this.send(outputName, [0x80 + channel - 1, note2note(note), velocity], time + length)
    }

  }

  class Engine {
    constructor() {
      this.pattern = null;
      this.oldPattern = null;
      this.callPattern = this.callPattern.bind(this);
      new SoundEngine((soundEngine) => {
        this.soundEngine = soundEngine
        this.midiEngine = new MIDIEngine(this.soundEngine.context);
        this.nextPatternTime = 0;
        this.callPattern();
        this.updateLaunchpad()
        window.__engine = this;
        const { ipcRenderer } = require('electron')
        ipcRenderer.on('link-update', this.linkSync.bind(this))
      });
    }
    linkSync(event, arg) {

      var timePerStep = 60 / (4 * this.soundEngine.tempo);
      const patternLength = this.soundEngine.steps * timePerStep
      let desiredPhase = ((this.soundEngine.context.currentTime - this.soundEngine.LATENCY_COMPENSATION) - (this.nextPatternTime - patternLength)) / patternLength
      if (desiredPhase < 0) { desiredPhase = 1 + desiredPhase }
      desiredPhase *= 4
      let diff = arg.phase - desiredPhase
      if (Math.abs(diff) > 2) { // wrap case
        if (arg.phase < 2) {
          diff = (arg.phase + 4.0) - desiredPhase
        } else {
          diff = arg.phase - (desiredPhase + 4.0)
        }

      }
      this.soundEngine.tempo = arg.bpm + (diff * 20)
    }

    updateLaunchpad() {
      if (window.Launchpad && window.Launchpad.enabled) {
        const timePerStep = 60 / (4 * this.soundEngine.tempo);
        const timeInPattern = this.soundEngine.context.currentTime - this.currentPatternTime
        var currentStep = Math.floor(timeInPattern / timePerStep)
        if (currentStep < 0) { currentStep = currentStep + 16 }
        window.Launchpad.currentStep = currentStep
      }
      setTimeout(() => this.updateLaunchpad(), 20)
    }

    callPattern() {
      var timePerStep = 60 / (4 * this.soundEngine.tempo);
      if (this.nextPatternTime === 0 || this.nextPatternTime - this.soundEngine.context.currentTime < 0.4) {
        if (this.nextPatternTime === 0) {this.nextPatternTime = this.soundEngine.context.currentTime; }
        if (typeof this.pattern === 'function') {
          var stepTimes = [];
          var i;
          for(i=0;i<this.soundEngine.steps;i++) {
            var groove = 0;
            if (i % 2 === 1) {
              groove = this.soundEngine.groove * timePerStep;
            }
            stepTimes.push(this.nextPatternTime + (timePerStep * i + groove));
          }
          try {
            this.pattern.call(this.soundEngine, stepTimes, timePerStep);
          } catch(e) {
            console.log(e);
            if (this.oldPattern) {
              this.pattern = this.oldPattern;
              this.pattern.call(this.soundEngine, stepTimes, timePerStep);
            } else {
              this.pattern = null;
            }
          }

        }
        this.currentPatternTime = this.nextPatternTime;
        this.nextPatternTime += this.soundEngine.steps * timePerStep;
        this.soundEngine.lc += 1
      }
      setTimeout(this.callPattern, 100);
    }
    stop() {
      this.evaluate("function pattern() {}")
    }
    evaluate(code) {
      // code, SE, ME
      const pattern = patternContext(code,
        this.soundEngine, this.midiEngine
      );
      if (this.pattern) {
        this.oldPattern = this.pattern;
      }
      if (pattern) { this.pattern = pattern; };
    }
  }
  window.Engine = Engine;
})(window);
