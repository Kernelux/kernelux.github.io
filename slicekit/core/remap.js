'use strict';
// SliceKit core/remap.js
// Key remapping for "Keep clip": after a map change, work out where each pad
// moved and move the notes of a clip to the new keys so the same pads still play.
// Pure ES5 (see docs/ARCHITECTURE.md, hard constraints). No Max globals.

var KEYS = 128;

// Pad ids compare as strings, so 5 and "5" are the same pad.
// null and undefined mean "no pad" and never match anything.
function sameId(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

// Where key k goes: mapping[k] when it is set, otherwise k itself.
// A short mapping (fewer than 128 entries) is therefore identity for the rest.
function targetOf(mapping, k) {
  var t = mapping ? mapping[k] : undefined;
  return (t === null || t === undefined) ? k : t;
}

// True for a MIDI key number 0..127.
function isKey(v) {
  return typeof v === 'number' && v >= 0 && v < KEYS && v === Math.floor(v);
}

// keyMapping(oldKeys, newKeys) -> int[128]
// oldKeys / newKeys: 128 entries, each a pad id (number or string) or null.
// For each key k:
//   - no pad before                      -> k
//   - the same pad is still on k         -> k
//   - the pad is on other keys now       -> the one nearest to k (tie: lower key)
//   - the pad is gone                    -> k (the note stays where it is)
function keyMapping(oldKeys, newKeys) {
  var before = oldKeys || [];
  var after = newKeys || [];
  var mapping = [];
  var k, k2, p, best, bestDist, dist;

  for (k = 0; k < KEYS; k++) {
    mapping[k] = k;
    p = before[k];
    if (p === null || p === undefined) continue;
    if (sameId(after[k], p)) continue;

    best = -1;
    bestDist = Infinity;
    // Ascending scan with a strict '<': on a tie the lower key is kept.
    for (k2 = 0; k2 < KEYS; k2++) {
      if (!sameId(after[k2], p)) continue;
      dist = Math.abs(k2 - k);
      if (dist < bestDist) {
        best = k2;
        bestDist = dist;
      }
    }
    if (best >= 0) mapping[k] = best;
  }
  return mapping;
}

// changedCount(mapping) -> number of keys k with mapping[k] !== k.
function changedCount(mapping) {
  var n = 0;
  for (var k = 0; k < KEYS; k++) {
    if (targetOf(mapping, k) !== k) n++;
  }
  return n;
}

// remapNotes(notesDict, mapping, isProtected) -> { notes: [...] }
// Returns only the notes whose pitch changes, as shallow copies with the new
// pitch and every other field kept. The input is not modified.
// A note is skipped when: its pitch is not a key 0..127; isProtected(pitch) is
// true (when isProtected is a function); or its pitch maps to itself.
function remapNotes(notesDict, mapping, isProtected) {
  var notes = (notesDict && Array.isArray(notesDict.notes)) ? notesDict.notes : [];
  var out = [];
  var guard = typeof isProtected === 'function';

  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (!note || typeof note !== 'object') continue;

    var pitch = note.pitch;
    if (!isKey(pitch)) continue;
    if (guard && isProtected(pitch)) continue;

    var target = targetOf(mapping, pitch);
    if (target === pitch || !isKey(target)) continue;

    var copy = {};
    var fields = Object.keys(note);
    for (var j = 0; j < fields.length; j++) {
      copy[fields[j]] = note[fields[j]];
    }
    copy.pitch = target;
    out.push(copy);
  }
  return { notes: out };
}

module.exports = {
  keyMapping: keyMapping,
  changedCount: changedCount,
  remapNotes: remapNotes
};
