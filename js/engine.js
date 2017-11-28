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

  class SoundEngine {
    constructor() {
      this.context = new AudioContext();
      this.o = this.context.destination;
      this.tempo = 120;
      this.steps = 16;
      this.groove = 0.0;
      this.loop = 0;
    }
    hello(dis) {
    }
    n(note, offset = 0) {
      note = note2note(note);
      return n2f(note + offset);
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
