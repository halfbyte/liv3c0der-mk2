var methodDefinitions = null;

function patternContext(code, SE, ME) {
  // actual evaluation
  // const globals = ['n', 'CH', 'LV', 'SEND', 'ch', 'dp', 'mb']

  var n = SE.n
  var CH = SE.CH
  var LV = SE.LV
  var SEND = SE.SEND
  var ch = SE.ch
  var dp = SE.dp
  var mb = SE.mb
  var SL = SE.SL

  try {
    eval(code);

    if (typeof once === 'function') {
      once.call(SE);
    }
    if (typeof pattern !== 'undefined') {
      return pattern;
    }
  } catch(exception) {
    console.log(exception);
    return null;
  }
}
