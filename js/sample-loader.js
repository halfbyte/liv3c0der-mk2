(function(window) {

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


  class Sample extends Parameterized {
    constructor(context, buffer) {
      super()
      this.context = context
      this.buffer = buffer
      this.defaults({
        volume: 0.8,
        rate: 1.0,
        detune: 0,
        loop: false,
        loopStart: 0,
        loopEnd: 0
      })
    }
    play(output, time) {
      const bufferSource = this.context.createBufferSource()
      bufferSource.buffer = this.buffer
      const amp = this.context.createGain()
      amp.gain.value = this.param('volume')
      amp.connect(output)
      bufferSource.playbackRate.value = this.param('rate')
      bufferSource.detune.value = this.param('detune')
      bufferSource.loop = this.param('loop')
      bufferSource.loopStart = this.param('loopStart')
      bufferSource.loopEnd = this.param('loopEnd')


      bufferSource.connect(amp)
      bufferSource.start(time)
    }
    p(output, time, opts = {}) {
      this.applyOptions(opts)
      this.play(output, time)
    }
  }


  class SampleLoader {
    constructor(context) {
      this.context = context
      this.samples = {}
      fetch('http://localhost:4567/index.json').then((response) => {
        return response.json();
      }).then((data) => {
        Object.keys(data).forEach((key) => {
          const url = data[key]
          this.samples[key] = {
            url: url,
            loaded: false
          }
          this.loadSample(key, url)
        })
      }).catch((err) => {
        console.log("Samples not available", err)
      })
    }
    loadSample(key, url) {
      fetch(url).then((response) => {
        return response.arrayBuffer()
      }).then((data) => {
        return this.context.decodeAudioData(data);
      }).then((buffer) => {
        this.samples[key]['sample'] = new Sample(this.context, buffer)
        this.samples[key]['loaded'] = true
        this.addSampleToList(key)
      })
    }
    addSampleToList(key) {
      const el = document.getElementById('samples')
      const li = document.createElement('li')
      const t = document.createTextNode(key)
      li.appendChild(t)
      el.appendChild(li)
    }
    p(name, output, time, opts = {}) {
      if (this.samples[name] == null || !this.samples[name].loaded) {
        return this
      }
      this.samples[name].sample.p(output, time, opts)
      return this
    }
  }
  window.SampleLoader = SampleLoader
}(window))
