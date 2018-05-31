# m!dic0der Documentation

## General Usage

### Keyboard Shortcuts

* Cmd-7: Toggle Comment on line
* Cmd-Enter: Evaluate Code
* Cmd-S: Save
* Cmd-Shift-S: Save Launchpad pattern to current document

The Save command looks for a string in the current code that looks like this:

```
// name: foo
```

It will then save the file to Documents/Midicoder under than name. If no name is given a timestamp will be used.

## Using MIDI

All Output devices are opened and available. If you connect a MIDI device after starting midicoder, you need
to reload, there's no automatic rescanning yet.

### `n()``

Usage:

```
n(outputName, channel, note, velocity, time, length)
```

Parameters:

* outputName - The exact name of the MIDI device
* channel - 1-16
* note - Note number or symbol
* velocity - 1-127
* time
* length

Both time and length are specified in the high resolution timer ( ala `performance.now()`).

### `ctrl()`

Usage:

```
ctrl(outputName, channel, controlNum, value, time)
```

Parameters:

* outputName - The exact name of the MIDI device
* channel - 1-16
* controlNum - 1-127 these values are application specific
* value - 1-127 the actual controller value
* time - the time at which the ctrl change should be sent

## Specifying notes

In all places where you can put notes there are two different ways of specifying these:

1. As a numeric value. This will be interpreted as a MIDI note number. (with 0 being a very low C)
2. As a string that represents a note and an octave. This uses a similar notation form as ye olde trackers used - There are only sharps, no flats, you have to do the conversion yourself. So, a B flat in the 3rd octave would be an A sharp, written as 'a#3'.


## Note utility functions

`n2n(note)`

converts a note into a note number so that you can do maths with it-

---

`ch(rootnote, chord, offset, callback)`

Chord helper:

* rootnote is the root note of the chord
* chord can be one of:
  * 'maj'
  * 'min'
  * 'dom'
  * 'maj-6'
  * 'min-6'
  * 'maj-7'
  * 'min-7'
  * 'haus' (a simple minor chord with an octabe double)
* offset is a numeric transpose
* callback is a function that gets called for each note of the generated chord, with the note as a MIDI note number as the sole parameter of the function. if you do not specify a callback, the function will simply return an array of the notes in the chord. This can be used for example for the arp helper.

Usage example:

```
ch('c3', 'min', 0, function(n) {
  playSomething(n)
})
```

---

`arp(notes, speed, callback)`

*plays an arpeggio with the given notes (an array that can be created with `ch()`, for example)*

## Drum utility functions

`dp(pattern, callback)`

drum pattern function:

* pattern is defined as a string. `*` is a drum hit, `!` is a drum hit with accent. Every other character is treated as a rest. Patterns can be of arbitrary length but they will be looped within the current number of steps in a pattern (usually 16)
* callback - will be called for each of the steps that contain a hit in the pattern. callback has two parameters, first is the step number and second is another function that takes two values and returns the first for normal drum hits and the second value for accented hits.

Usage example:

```javascript
dp('*--!*---', function(st, acc) {
  DS.p(CH('bd'), t[st], {start: acc(200, 800), decay: 8, volume: acc(0.8,2)})
});
```

---

`mb(divider, compare, callback)`

ModBeat is a way to build rhythms by using the modulo function. the current step will be divided by the divider and then the remainder (the result of the modulo function) is compared against the compare value. If the values are equal, the callback is called with the step number as the sole parameter.

Example:

```javascript
mb(4, 0, function(step) { DS.p(mixer.channelOut('bd'), t[step], {decay: 2})})
```

---

### Generic helpers

`ptn(pattern, callback)`

This takes a pattern, which is an array in the form of [[note, index], [note, index]] and calls
the callback function with index and note.

`lp(pattern, callback)`

This takes one pattern (0-3) from the launchpad sequencer and calls the callback for every sequenced step with the step num as a parameter.

`a(array, callback)`

a simple wrapper for forEach

`r(array)`

creates a "ring" which is a wrapper around an array with a `next()` method that will return the next
element in the array and will wrap around (hence the name) at the end of the array.

`sample(array)`

will return a random element from the array

`sin(val, min, max)`

will return a value between min and max following a sine, so when the sine should be -1, it will return min and when the sine is 1 it will return max

`each(max, mod, callback)`

a simple way of executing things on particular loops. the function will calculate `loopcounter % max`
and if the result equals mod, the callback will be called with no params. For example, to run
something on the last of four bars, you could do `each(4, 3, callback)``




var each  = this.each.bind(this)
