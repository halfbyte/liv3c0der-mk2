(function(window) {
  'use strict';

  var defaultProgram = "function pattern(t) {\nhello(t);\n}\n";

  if (localStorage['__lc2__']) {
    defaultProgram = localStorage['__lc2__'];
  }

  document.addEventListener('DOMContentLoaded', startEditor);

  const engine = new Engine();
  var editor;

  function startEditor() {
    editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");
    // this.editor.container.addEventListener("keydown", keydown, true);
    editor.commands.addCommand({
        name: "execute",
        bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
        exec: evaluate
    });
    editor.commands.addCommand({
        name: "save",
        bindKey: { win: "Ctrl-S", mac: "Command-S" },
        exec: save
    });
    editor.setValue(defaultProgram);
  }

  function keydown(event) {

  }

  function evaluate() {
    engine.evaluate(editor.getValue());
  }

  function save() {
    localStorage['__lc2__'] = editor.getValue();
  }

})(window);
