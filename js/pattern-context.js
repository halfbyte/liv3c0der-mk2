function patternContext(code, ME) {
  var ch = this.ch.bind(this)
  var dp = this.dp.bind(this)
  var mb = this.mb.bind(this)
  var n = ME.note.bind(ME)

  try {
    eval(code);

    if (typeof once === 'function') {
      once.call();
    }
    if (typeof pattern !== 'undefined') {
      return pattern;
    }
  } catch(exception) {
    console.log(exception);
    return null;
  }
}
