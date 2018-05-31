(function(window) {
  'use strict';

  var defaultProgram = "//name:default\nfunction pattern(t) {\nhello(t);\n}\n";
  var currentDoc = null;

  const { app } = require('electron').remote
  const fs = require('fs')
  const path = require('path')
  const sanitize = require('sanitize-filename')
  var skipReload = false

  const docDir = path.join(app.getPath('documents'), 'MidiCoder')

  document.addEventListener('DOMContentLoaded', startEditor);

  const engine = new Engine();
  engine.onerror = showError
  var editor;

  function startEditor() {
    editor = ace.edit("editor");
    window.__editor = editor
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");
    editor.session.setOptions({
      tabSize: 2,
      useSoftTabs: true
    });
    editor.commands.addCommand({
        name: "execute",
        bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
        exec: evaluate
    });
    editor.commands.addCommand({
        name: "stop",
        bindKey: { win: "Esc", mac: "Esc" },
        exec: stop
    });
    editor.commands.addCommand({
        name: "save",
        bindKey: { win: "Ctrl-S", mac: "Command-S" },
        exec: save
    });
    editor.commands.addCommand({
        name: "save lp pattern",
        bindKey: { win: "Ctrl-Shift-S", mac: "Command-Shift-S" },
        exec: saveLaunchpadPattern
    });
    editor.commands.addCommand({
        name: "delete",
        bindKey: { win: "Ctrl-D", mac: "Command-D" },
        exec: deleteSong
    });
    editor.commands.addCommand({
        name: "togglecomment",
        bindKey: {win: "Ctrl-7", mac: "Command-7"},
        exec: function(editor) { editor.toggleCommentLines(); },
        multiSelectAction: "forEachLine",
        scrollIntoView: "selectionPart"
    });
    editor.setValue(defaultProgram);

    window.addEventListener('hashchange', loadFromHash)

    loadFromHash()
    setupLists()

  }

  function saveLaunchpadPattern() {
    const patternsSerialized = JSON.stringify(Launchpad.patterns)
    console.log(patternsSerialized)
    var ed = editor.getValue()
    ed += `\n// LP: ${patternsSerialized}`
    editor.setValue(ed);
  }

  function loadLaunchpadPatterns() {
    const code = editor.getValue()
    const pMatch = code.match(/LP\:(.*)$/im)
    if (pMatch) {
      const patternString = pMatch[1].trim()
      const patterns = JSON.parse(patternString)
      window.Launchpad.setPatterns(patterns)
    }

  }

  function stop() {
    engine.stop()
  }

  function deleteSong() {
    let name = decodeURIComponent(window.location.hash.slice(1))
    if (name !== '' && name !== 'default' && confirm("Really want to delete the current document?")) {
      const fullPath = path.join(docDir, `${name}.js`)
      fs.unlink(fullPath, (err) => {
        if (err) {
          showError("ERROR deleting file " + err.message)
          console.log("ERROR deleting file", err)
        } else {
          refeshDocList()
        }
      })
      window.location.hash = "default"
    }
  }

  function loadFromHash() {
    if (skipReload) { // do not reload freshly saved things
      skipReload = false
      return;
    }
    let name = decodeURIComponent(window.location.hash.slice(1))
    if (name === '') {
      name = 'default'
    }
    console.log("Loading", name)
    const fileName = `${name}.js`
    const fullPath = path.join(docDir, fileName)
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        showError("Could not read file " + err.message)
        console.log("ERROR reading file", err)
        editor.setValue(defaultProgram);
      } else {
        editor.setValue(data);
        loadLaunchpadPatterns()
        editor.focus()
      }
    })
  }


  function toggleClass(element, cls) {
    if (element.className.indexOf(cls) !== -1) {
      element.className = element.className.replace(cls, '')

    } else {
      element.className += " " + cls
    }
  }

  function setupLists() {
    document.querySelectorAll('[data-expand]').forEach((element) => {
      element.querySelector('.handle').addEventListener('click', function(event) {
        console.log("toggle")
        toggleClass(element, 'open')
        event.preventDefault()
      })
    })
    refeshDocList()
  }

  function refeshDocList() {
    fs.readdir(docDir, (err, files) => {
      if (err) {
        console.log("Error reading doc dir")
      } else {
        const el = document.getElementById('songs')
        el.innerHTML = ""
        files.forEach((filename) => {
          const displayName = path.basename(filename, '.js')
          const li = document.createElement('li')
          const a = document.createElement('a')
          const t = document.createTextNode(displayName)
          a.href = `#${encodeURI(displayName)}`
          a.appendChild(t)
          li.appendChild(a)
          el.append(li)
        })
      }
    })
  }

  function showError(error) {
    const errorList = document.getElementById('errors')
    window.__lastError = error
    const li = document.createElement('li')
    li.setAttribute('data-remove', (new Date().getTime() + 5000))
    const text = document.createTextNode(error.stack)
    li.appendChild(text)
    errorList.appendChild(li)
  }

  function clearError() {
    const errorList = document.getElementById('errors')
    if (errorList.firstChild) {
      const removalTime = parseInt(errorList.firstChild.getAttribute('data-remove'), 10)
      if (new Date().getTime() > removalTime) {
        errorList.firstChild.remove()
      }
    }
    setTimeout(clearError, 1000)
  }
  clearError()

  function evaluate() {
    engine.evaluate(editor.getValue());
  }

  function save() {
    console.log("START SAVING")
    const code = editor.getValue();
    var name = new Date().toISOString()
    const nameMatch = code.match(/name\:(.*)$/im)
    if (nameMatch) {
      name = nameMatch[1].trim()
    }
    name = sanitize(name)
    const fullPath = path.join(docDir, name + ".js")
    fs.mkdir(docDir, (err) => {

      if (!err || err.message.match(/EEXIST/)) {
        fs.writeFile(fullPath, code, (err) => {
          if (err) {
            showError("Could not write to file " + err.message)
            console.log("Could not write file.", fullPath, err)
          } else {
            refeshDocList()
            skipReload = true
            location.hash = name
          }
        })
      } else {
        console.log("Could not create dir.", docDir, err)
        showError("Could not create dir." + err.message)
      }
    })


  }

})(window);
