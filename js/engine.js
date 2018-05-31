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

  const CLOCK_BLACKLIST = ["IAC-Treiber Bus 1"]

  class MIDIEngine {
    constructor(callback) {
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
    note(outputName, channel, note, velocity, time, length = 20) {
      this.send(outputName, [0x90 + channel - 1, note2note(note), velocity], time)
      this.send(outputName, [0x80 + channel - 1, note2note(note), velocity], time + length)
    }
    ctrl(outputName, channel, control, value, time) {
      this.send(outputName, [0xB0 + channel - 1, control, value], time)
    }
    sendClock(start, timePerStep, steps) {
      console.log("Send clk")
      const timePerSubstep = timePerStep / 6;
      for(var p=0,l=steps*6;p<l;p++) {
        Object.keys(this._OUTPUTS).forEach((outputName) => {
          if (CLOCK_BLACKLIST.indexOf(outputName) === -1) {
            this._OUTPUTS[outputName].send([0xF8], start + (p * timePerSubstep))
          }
        })
      }
    }

  }

  class Engine {
    constructor() {
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
            this.callPattern()
            this.updateLaunchpad()
          }
        }
      });
    }
    linkSync(event, arg) {
      var timePerStep = 60000 / (4 * this.tempo);
      const patternLength = this.steps * timePerStep
      let desiredPhase = (performance.now() - (this.nextPatternTime - patternLength)) / patternLength
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
      this.tempo = arg.bpm + (diff * 20)
    }

    updateLaunchpad() {
      if (window.Launchpad && window.Launchpad.enabled) {
        const timePerStep = 60000 / (4 * this.tempo);
        const timeInPattern = performance.now() - this.currentPatternTime
        var currentStep = Math.floor(timeInPattern / timePerStep)
        if (currentStep < 0) { currentStep = currentStep + 16 }
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
      var timePerStep = 60000 / (4 * this.tempo);
      if (this.nextPatternTime > 0 && this.nextPatternTime - performance.now() > 400) { return; }
      if (this.nextPatternTime === 0) { this.nextPatternTime = performance.now() }
      if (typeof this.pattern === 'function') {
        var stepTimes = [];
        var i;
        for(i=0;i<this.steps;i++) {
          var groove = 0;
          if (i % 2 === 1) {
            groove = this.swing * timePerStep;
          }
          stepTimes.push(this.nextPatternTime + (timePerStep * i + groove));

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
      this.midiEngine.sendClock(this.nextPatternTime, timePerStep, this.steps)
      this.currentPatternTime = this.nextPatternTime;
      this.nextPatternTime += this.steps * timePerStep;
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


  }
  window.Engine = Engine;
})(window);
