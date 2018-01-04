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
  }

  function n2f(n) {
    return Math.pow(2, (n - 69) / 12) * 440;
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
    c = new Float32Array(ac.sampleRate)
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
      const fDecayTime = time + (1 / this.params.sweep)
      const aDecayTime = (1 / this.params.decay)

      const sine = this.context.createOscillator()
      const click = this.context.createOscillator();
      click.type = 'square'

      AD(click.frequency, this.params.end, 100, time, 0, 0.001);

      const clickamp = DCA(this.context, click, this.params.volume * 0.8, time, 0.005, 0.02)
      const amp = DCA(this.context, sine, this.params.volume, time, 0.004, aDecayTime)

      clickamp.connect(output)
      amp.connect(output)

      sine.onended = () => {
        clickamp.disconnect(output);
        amp.disconnect(output);
        sine.disconnect(amp);
        click.disconnect(clickamp)
      }

      sine.frequency.setValueAtTime(this.params.start, time);
      sine.frequency.exponentialRampToValueAtTime(this.params.end, fDecayTime);
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
      console.log("mkBuffer", length, decay, bufferLength);
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
      this.context = context;
      this.mix = context.createGain();
      this.mix.gain.value = 1;
      this.dist = context.createWaveShaper()
      this.dist.connect(this.mix)
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

  class MixerChannel {
    constructor(context, sends, type = 'generic') {
      this.sends = sends;
      this.context = context;
      this.sendGains = {};
      this.input = this.context.createGain();
      this.outGain = this.context.createGain();
      this.outGain.gain.value=0.75;

      const methodName = `make_${type}`;
      console.log("MAKE CH", methodName, this[methodName]);
      if (this[methodName]) {
        this[methodName]();
      } else {
        console.log("mkGeneric");
        this.make_generic();
      }
      this.connectSends();
    }
    make_generic() {
      console.log("make generic");
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
        console.log('send', sendName);
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
      console.log("MAKE SND", methodName, this[methodName]);
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
      console.log('MKREV');
      this.reverb = new Reverb(this.context);
      console.log(this.reverb.input);
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

  class SoundEngine {
    constructor() {
      this.context = new AudioContext();
      this.mixer = new Mixer(this.context);
      this.mx = this.mixer;
      this.o = this.context.destination;
      this.tempo = 120;
      this.steps = 16;
      this.groove = 0.0;
      this.loop = 0;
      this.DS = new DrumSynth(this.context);
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
    SND(channel, send, value) {
      if (value != null) {
        this.mixer.channel(channel).send(send).gain.value = value;
        return;
      }
      return this.mixer.channel(channel).send(send).gain;

    }


    ch(note, chord, offset) {
      if (typeof arguments[arguments.length - 1] !== 'function') { return; }
      const fun = arguments[arguments.length - 1];
      note = note2note(note);
      const chordOffsets = CHORDS[chord];
      if (!chordOffsets) { return; }
      var notes = chordOffsets.map(function(co) {
        return note + co + offset;
      }).forEach(fun, this);
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


  class Engine {
    constructor() {
      this.pattern = null;
      this.oldPattern = null;
      this.callPattern = this.callPattern.bind(this);
      this.soundEngine = new SoundEngine();
      this.nextPatternTime = 0;
      this.callPattern();
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
            this.soundEngine.loop = this.soundEngine.loop + 1;
          } catch(e) {
            console.log("ERRRR", e);
            if (this.oldPattern) {
              this.pattern = this.oldPattern;
              this.pattern.call(this);
            } else {
              this.pattern = null;
            }
          }

        }
        this.nextPatternTime += this.soundEngine.steps * timePerStep;
      }
      setTimeout(this.callPattern, 100);
    }

    evaluate(code) {
      const pattern = patternContext(this.soundEngine, code);
      if (this.pattern) {
        this.oldPattern = this.pattern;
      }
      if (pattern) { this.pattern = pattern; };
    }
  }
  window.Engine = Engine;
})(window);
