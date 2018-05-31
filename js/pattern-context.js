function patternContext(code, ME) {
  var ch = this.ch.bind(this)
  var dp = this.dp.bind(this)
  var mb = this.mb.bind(this)
  var n = ME.note.bind(ME)
  var ctrl = ME.ctrl.bind(ME)
  var n2n = this.n2n.bind(this)
  var ptn = this.ptn.bind(this)
  var lp = Launchpad.callPattern.bind(Launchpad)
  var a = this.a.bind(this)
  var r = this.r.bind(this)
  var sample = this.sample.bind(this)
  var sin = this.sin.bind(this)
  var each  = this.each.bind(this)
  
  const V_KICK = 36
  const V_SNARE = 38
  const V_LOTOM = 43
  const V_HITOM = 50
  const V_HHCL = 42
  const V_HHOP = 46
  const V_CLAP = 39
  const V_CLAV = 75
  const V_AGOGO = 67
  const V_CRASH = 49

  const C_D1 = 'c4'
  const C_D2 = 'd4'
  const C_D3 = 'e4'
  const C_D4 = 'f4'

  try {
    eval(code);

    if (typeof once === 'function') {
      once.call(this);
    }
    if (typeof pattern !== 'undefined') {
      return pattern;
    }
  } catch(exception) {
    console.log(exception);
    return null;
  }
}
