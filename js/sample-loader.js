(function(window) {
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
        console.log(key, buffer);
        this.samples[key]['buffer'] = buffer
        this.samples[key]['loaded'] = true
      })
    }
    p(name, output, time, opts = {}) {
      if (this.samples[name] == null || !this.samples[name].loaded) {
        return
      }
      const bufferSource = this.context.createBufferSource()
      bufferSource.buffer = this.samples[name].buffer
      const amp = this.context.createGain()
      amp.gain.value = 0.5
      amp.connect(output)
      bufferSource.connect(amp)
      bufferSource.start(time)
    }
  }
  window.SampleLoader = SampleLoader
}(window))
