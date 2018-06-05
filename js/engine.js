(function(window) {
  const NOTES = 'c d ef g a b';
  const CHORDS = {
    'maj': [0,4,7],
    'min': [0,3,7],
    'dom': [0,3,7, 10],
    'maj-6': [0,4,7,9],
    'min-6': [0,3,7,9],
    'maj-7': [0,4,7,11],
    'min-7': [0,3,7,10],
    'haus': [0,3,7,12],
  }

  //////////////////////////////////////////////// Utilities

  class Ring {
    constructor(...values) {
      this._values = values;
      this._index = 0;
      this.length = this._values.length
    }
    next() {
      return this._values[this._index++ % this.length];
    }
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

  //////////////////////////////////////////////// Engine

  const CLOCK_BLACKLIST = ["IAC-Treiber Bus 1", "iConnectMIDI iCM DIN 1", ]
  const CLOCK_WHITELIST = ["Circuit"]
  class MIDIEngine {
    constructor(callback) {
      this.clockSource = "IAC-Treiber Bus 1"
      this._constructorCallback = callback
      if (navigator.requestMIDIAccess == null) { return }
      navigator.requestMIDIAccess().then((access) => {
        this._midiSetup(access);
      }).catch((err) => {
        console.error("MIDI ERROR", err);
      })
    }
    _midiSetup(midiAccess) {
      this._INPUTS = {}
      this._OUTPUTS = {}
      this._subscriptions = []
      this.midiAccess = midiAccess
      this.midiAccess.inputs.forEach((input) => {
        this._INPUTS[input.name] = input;
        input.onmidimessage = (event) => {
          if (event.data[0] === 0xF8 && typeof this.onClockTick === 'function' && event.target.name === this.clockSource) {
            this.onClockTick()
            this.sendClock(event.target.name)
          }
          if (event.data[0] === 0xFA && typeof this.onClockReset === 'function' && event.target.name === this.clockSource) {
              this.onClockReset()
          }
          if (event.data[0] === 0xFC && typeof this.onClockStop === 'function' && event.target.name === this.clockSource) {
            console.log("STOPP")
              this.onClockStop()
          }
          this._sendInput(event.data);
        }
      })
      this.midiAccess.outputs.forEach((output) => {
        this._OUTPUTS[output.name] = output;
      })
      if (typeof this._constructorCallback === 'function') {
        this._constructorCallback(this)
      }
    }
    sendAllNotesOff() {
      Object.keys(this._OUTPUTS).forEach((out) => {
        for(var i=0;i<16;i++) {
          this._OUTPUTS[out].send([0xB0, 123, 0])
        }
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
      this.midiOutput(outputName).send(message, time);

    }
    sendClock(source) {
      Object.keys(this._OUTPUTS).forEach((outputName) => {
        if (source !== outputName && CLOCK_WHITELIST.indexOf(outputName) !== -1) {
          this._OUTPUTS[outputName].send([0xF8])
        }
      })
    }
  }

  class Engine {
    constructor() {
      this.tickCount = 0
      this.scheduledEvents = []
      this.ticksPerStep = 6 // 1 step = 16th note, that makes 24 ticks per 1/4 note as per spec
      this.tempo = 120
      this.swing = 0.0
      this.steps = 16;
      this.lc = 0;
      this.pattern = null;
      this.oldPattern = null;
      this.callPattern = this.callPattern.bind(this);

      new MIDIEngine((midiEngine) => {
        this.midiEngine = midiEngine
        this.nextPatternTime = 0;
        this.updateLaunchpad()
        window.__engine = this;
        const { ipcRenderer } = require('electron')
        ipcRenderer.on('link-update', this.linkSync.bind(this))
        var timingWorker = new Worker('js/timing-worker.js')
        timingWorker.onmessage = (event) => {
          if (event.data === 'tick') {
            //this.callPattern()
            this.updateLaunchpad()
          }
        }
        midiEngine.onClockTick = this.onClockTick.bind(this);
        midiEngine.onClockReset = this.onClockReset.bind(this);
        midiEngine.onClockStop = this.onClockStop.bind(this);
      });
    }
    onClockTick() {
      if (this.tickCount % (this.steps * this.ticksPerStep) === 0) {
        this.callPattern()
      }
      this.scheduleEvents(this.tickCount++)
    }
    onClockReset() {
      console.log("CLOCK RESET")

      this.midiEngine.sendAllNotesOff.call(this.midiEngine)
      this.scheduledEvents = []
      this.tickCount = 0
      this.lc = 0
    }
    onClockStop() {
      console.log("CLOCK STAHP!")
      this.midiEngine.sendAllNotesOff.call(this.midiEngine)
      this.scheduledEvents = []
      this.tickCount = 0
      this.lc = 0
      this.stop()      
    }
    scheduleEvents(tick) {
      if (this.scheduledEvents[tick]) {
        this.scheduledEvents[tick].forEach((event) => {
          var time = null
          if (this.shuffle > 0 && tick % 12 === 6) {
            time = this.shuffle + performance.now()
          }
          this.midiEngine.send.call(this.midiEngine, event.device, event.data, time)
        })
      }
    }
    appendEvent(tick, device, message) {
      this.scheduledEvents[tick] = this.scheduledEvents[tick] || []
      this.scheduledEvents[tick].push({device: device, data: message})
    }

    linkSync(event, arg) {
      // var timePerStep = 60000 / (4 * this.tempo);
      // const patternLength = this.steps * timePerStep
      // let desiredPhase = (performance.now() - (this.nextPatternTime - patternLength)) / patternLength
      // if (desiredPhase < 0) { desiredPhase = 1 + desiredPhase }
      // desiredPhase *= 4
      // let diff = arg.phase - desiredPhase
      // if (Math.abs(diff) > 2) { // wrap case
      //   if (arg.phase < 2) {
      //     diff = (arg.phase + 4.0) - desiredPhase
      //   } else {
      //     diff = arg.phase - (desiredPhase + 4.0)
      //   }
      //
      // }
      // this.tempo = arg.bpm + (diff * 20)
    }

    updateLaunchpad() {
      if (window.Launchpad && window.Launchpad.enabled) {
        const currentStep = Math.floor(this.tickCount / this.ticksPerStep) % (this.steps)
        Launchpad.currentStep = currentStep
        Launchpad.refresh()
      }
    }

    displayError(error) {
      if (typeof this.onerror === 'function') {
        this.onerror(error)
      }
    }

    callPattern() {
      var timePerStep = this.ticksPerStep
      if (typeof this.pattern === 'function') {
        var stepTimes = [];
        var i;
        for(i=0;i<this.steps;i++) {
          stepTimes.push(this.tickCount + (timePerStep * i));
        }
        try {
          this.pattern.call(this, stepTimes, timePerStep);
        } catch(e) {
          this.displayError(e)
          console.log(e);
          if (this.oldPattern) {
            this.pattern = this.oldPattern;
            this.pattern.call(this, stepTimes, timePerStep);
          } else {
            this.pattern = null;
          }
        }

      }
      // this.midiEngine.sendClock(this.nextPatternTime, timePerStep, this.steps)
      this.lc += 1
    }
    stop() {
      this.evaluate("function pattern() {}")
    }
    evaluate(code) {
      // code, SE, ME
      const pattern = patternContext.call(this, code, this.midiEngine);
      if (this.pattern) {
        this.oldPattern = this.pattern;
      }
      if (pattern) { this.pattern = pattern; };
    }
    // utils
    ch(note, chord, offset, fun) {
      note = note2note(note);
      const chordOffsets = CHORDS[chord];
      if (!chordOffsets) { return; }
      var notes = chordOffsets.map(function(co) {
        return note + co + offset;
      });
      if (typeof(fun) === 'function') {
        notes.forEach(fun, this);
        return notes;
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
    dp(pattern, callback, steps = this.steps) {
      for(var i=0,l=steps;i<l;i++) {
        const step = i % pattern.length;
        if (pattern[step] === '*') {
          callback(i, function(a,b) { return a;});
        } else if (pattern[step] === '!') {
          callback(i, function(a,b) { return b;});
        }
      }
    }
    n2n(n) {
      return note2note(n)
    }
    ptn(array, callback) {
      for(var i=0,l=array.length;i<l;i++) {
        callback(array[i][1], array[i][0])
      }
    }
    r(...values) {
      return new Ring(...values)
    }
    a(notes, callback) {
      notes.forEach(callback)
    }
    sample(array) {
      return array[Math.floor(Math.random() * array.length - 1)]
    }
    sin(input, min, max) {
      return min + (Math.sin(input) + 1) * 0.5 * max
    }
    each(loop, inst, callback) {
      if (this.lc % loop === inst) { callback()}
    }
    rejig(substeps, first=0) {
      const allSteps = this.steps * this.ticksPerStep
      const perStep = allSteps / substeps
      const stepNums = []
      for(var i=0;i<allSteps;i++) {
        stepNums.push(first + (i * perStep))
      }
      return stepNums
    }

    note(outputName, channel, note, velocity, tick, length) {
      this.appendEvent(tick, outputName, [0x90 + channel - 1, note2note(note), velocity])
      this.appendEvent(tick + Math.floor(length * this.ticksPerStep), outputName, [0x80 + channel - 1, note2note(note), velocity])
    }
    ctrl(outputName, channel, control, value, tick) {
      this.appendEvent(tick, outputName, [0xB0 + channel - 1, control, value])
    }


  }
  window.Engine = Engine;
})(window);
