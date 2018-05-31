(function(window, navigator) {

'use strict';

class LaunchpadEditor {
  constructor(nav) {
    console.log("LP INIT", nav)
    this.patterns = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,],
    ]
    this.currentStep = 0
    nav.requestMIDIAccess().then(this.lateConstructor.bind(this)).catch(this.midiFail)

  }
  assignPorts(access) {
    console.log("LP PORT INIT")
    access.inputs.forEach(function(port) {
      if (port.name.match(/Launchpad Mini/)) {
        this.input = port
        port.onmidimessage = this.handleMidiMessage.bind(this)
      }
    }, this)
    access.outputs.forEach(function(port) {
      if (port.name.match(/Launchpad Mini/)) {
        this.output = port
      }
    }, this)
    this.enabled = (this.input != null) && (this.output != null)
  }
  handleMidiMessage(event) {
    if (event.data[0] != 0x90) { return }
    if (event.data[2] === 0) { return }
    const note = event.data[1]

    const x = note % 16
    const y = Math.floor(note / 16)
    const pattern = Math.floor(y / 2)
    const step = y % 2 * 8 + x
    this.toggleNote(pattern, step)
  }
  toggleNote(pattern, step) {
    console.log("TOGGLE", pattern, step)
    if (step < 16) {
      this.patterns[pattern][step] =! this.patterns[pattern][step]
    }
  }

  lateConstructor(access) {
    console.log("LP LATE INIT")
    this.assignPorts(access)
    this.clear()
    this.refreshPattern()
    console.log("Done")
  }
  clear() {
    if(!this.enabled) { return }
    this.output.send([0xb0, 0, 0])
  }
  refresh() {
    // setTimeout(() => this.refreshPattern(), 60, this)
    if (!this.enabled) { return }
    var i,j
    var l = 16
    for(i=0;i<4;i++) {
      for(j=0;j<16;j++) {
        var x = j % 8
        var y = Math.floor((i * 16 + j) / 8)
        var num = y * 16 + x
        if (this.currentStep === j) {
          this.output.send([0x90, num, 0x0F])
        } else {
          if (this.patterns[i][j]) {
            this.output.send([0x90, num, 0x3e])
          } else {
            this.output.send([0x80, num, 0])
          }
        }
      }
    }

  }

  midiFail(e) {
    console.log("No MIDI, no Cigar", e);
  }

  callPattern(patternIndex, callback) {
    const pattern = this.patterns[patternIndex]
    for(var i=0,l=16;i<l;i++) {
      const step = i % pattern.length;
      if (pattern[step]) { callback(i); }
    }
  }
  checkPatterns(patterns) {
    if (patterns.length !== 4) {return false};
    for(var i=0,l=patterns.length;i<l;i++) {
      if (patterns[i].length !== 16) {return false};
    }
    return true
  }
  setPatterns(patterns) {
    if (this.checkPatterns(patterns)) {
      this.patterns = patterns
    }
  }

}

console.log("LP PRE INIT")
window.Launchpad = new LaunchpadEditor(navigator)

}(window, navigator));
