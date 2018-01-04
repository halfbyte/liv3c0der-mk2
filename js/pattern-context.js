var methodDefinitions = null;

function patternContext(soundEngine, code) {
  // define local scope for function
  // SoundEngine shortcuts;
  if (!methodDefinitions) {
    methodDefinitions = "";
    Object.getOwnPropertyNames(Object.getPrototypeOf(soundEngine)).concat(Object.getOwnPropertyNames(soundEngine)).forEach(function(propName) {
      if (propName !== 'constructor' || propName !== 'evaluate') {
        if (typeof soundEngine[propName] === 'function') {
          console.log("DEFINE ", propName);
          methodDefinitions += `var ${propName} = soundEngine.${propName}.bind(soundEngine);`;
        } else {
          // properties
          methodDefinitions += `var ${propName} = soundEngine.${propName};`;
        }

      }
    });
    methodDefinitions += "\n";
  }
  //var hello = soundEngine.hello;




  // actual evaluation
  try {
    eval(methodDefinitions + code);
    if (typeof once == 'function') {
      once.call(soundEngine);
    }
    if (typeof pattern !== 'undefined') {
      return pattern;
    }
  } catch(exception) {
    console.log(exception);
    return null;
  }
}
