function callRegularly() {
  self.postMessage('tick')
  setTimeout(callRegularly, 60)
}
callRegularly()
