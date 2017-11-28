(function(window) {
  'use strict';

  var defaultProgram = "function pattern(t) {\nhello(t);\n}\n";

  if (localStorage['__lc2__']) {
    defaultProgram = localStorage['__lc2__'];
  }

  document.addEventListener('DOMContentLoaded', startEditor);

  var codeMirror = null;
  const engine = new Engine();

  function startEditor() {
    console.log("IN THE GAME!");
    let editorDiv = document.getElementById('editor');
    codeMirror = CodeMirror(editorDiv, {
      value: defaultProgram,
      mode: 'javascript',
      theme: 'monokai',
      tabSize: 2,
      extraKeys: {
        'Cmd-Enter': evaluate,
        'Ctrl-Enter': evaluate,
        'Cmd-7': function(cm) {
          cm.toggleComment();
        },
        'Cmd-S': save
      },
      matchBrackets: true,
      autoCloseBrackets: true,
      lint: CodeMirror.lint.javascript,
      autofocus: true,
    });



  }

  function evaluate() {
    engine.evaluate(codeMirror.getValue());
  }

  function save() {
    localStorage['__lc2__'] = codeMirror.getValue();
  }

})(window);
