(function(window) {
  'use strict';

  var defaultProgram = "//name:default\nfunction pattern(t) {\nhello(t);\n}\n";
  var db = new PouchDB('liv3c0der');
  var currentDoc = null;



  document.addEventListener('DOMContentLoaded', startEditor);

  const engine = new Engine();
  var editor;

  function startEditor() {
    editor = ace.edit("editor");
    window.__editor = editor
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/javascript");
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

  function stop() {
    engine.stop()
  }

  function deleteSong() {
    let name = decodeURIComponent(window.location.hash.slice(1))
    if (name !== '' && confirm("Really want to delete the current document?")) {
      db.get(name, (err, doc) => {
        if (!err) {
          db.remove(doc)
          window.location.hash = "default"
        }
      })
    }
  }

  function loadFromHash() {
    let name = decodeURIComponent(window.location.hash.slice(1))
    if (name === '') {
      name = 'default'
    }
    console.log("Loading")
    db.get(name, (err, doc) => {
      if (err) {
        console.log(err)
        // bootstrap
        if (name === 'default') {
          db.put({"_id": "default", "code": defaultProgram}, function(err, result) {
            if (err) {
              console.log("ERR", err)
            } else {
              console.log(result)
            }
          })
        }
      } else {
        currentDoc = doc
        editor.setValue(doc.code);
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
    db.changes({
      since: 'now',
      live: true
    }).on('change', refeshDocList);
  }

  function refeshDocList() {
    db.allDocs({include_docs: false}, function(err, doc) {
    if (err) {
      console.log("No Docs", err)
    }
    const el = document.getElementById('songs')
    el.innerHTML = ""

    doc.rows.forEach((row) => {
      const li = document.createElement('li')
      const a = document.createElement('a')
      const t = document.createTextNode(row.id)
      a.href = `#${encodeURI(row.id)}`
      a.appendChild(t)
      li.appendChild(a)
      el.append(li)
    })


  });
  }

  function evaluate() {
    engine.evaluate(editor.getValue());
  }

  function save() {
    const code = editor.getValue();
    var name = new Date().toISOString()
    window.__code = code
    const nameMatch = code.match(/name\:(.*)$/im)
    console.log(nameMatch)
    if (nameMatch) {
      name = nameMatch[1].trim()
    }
    var doc = {
      _id: name,
      code: code
    }
    if (currentDoc != null) {
      console.log(currentDoc)
      doc = currentDoc
      doc.code = code
    }
    db.put(doc, (err, res) => {
      if (err) {
        console.log("Error", err)
      } else {
        window.location.hash = name
        console.log("saved", res)
        currentDoc = doc
        doc._rev = res.rev
      }
    })
  }

})(window);
