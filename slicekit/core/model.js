'use strict';
// SliceKit core/model.js
// State, sources, slices, pads, map slots, layouts, shuffle, undo and every
// editing operation. Pure ES5, no Max globals. See docs/ARCHITECTURE.md.
//
// Interpretations of the (few) ambiguous policy points, for reference:
//  * Notifications: every public mutation collects the kinds it touched and
//    notifies once at the end: the single kind when exactly one was touched,
//    'all' when more than one (or 'all' directly).
//      addSource/setSourceInfo/setSourceSettings -> 'sources'
//      setSliceFeatures -> 'slices' (+ 'map' when the sorted layout re-lays out)
//      setPadParam/applyParamToSource -> 'pads'
//      setCurrentSlot/lock ops/clearKey/swapKeys/assignPad/copySlot/applyLayout -> 'map'
//      setGlobal -> 'globals' (+ 'map' when layout-affecting keys re-lay out auto slots)
//      everything structural (setSlices, slice points, removeSource, undo/redo ...) -> 'all'
//      findBest -> 'map'; duplicatePad/spread/toggleLayer/swapSimilar/shuffle -> 'all'
//    A call that changes nothing does not notify.
//  * shuffle: every key in scope counts as moved (a permutation may leave a pad
//    in place by chance); `moved` is that count and flipPct applies to all of them.
//  * Layout: a base pad that already sits on a locked key is not placed a
//    second time (the locked key "keeps its pad"; the rest flows around it).
//  * Undo snapshots hold pads, slots, currentSlot and, per source, its slices
//    and `slicing` settings (not playMode/trigMode/color, not globals).
//    The first setSlices of a source (it had no slices) is part of "adding the
//    source" and clears the history instead of creating a step. Consecutive
//    setSlices on the same source, and consecutive moveSlicePoint on the same
//    slice point, coalesce into one step (a dial/drag = one step).
//    setSourceSettings of a slicing key remembers the pre-change state so the
//    reslice that follows becomes one undo step including the settings.
//  * Pads that no key, layer link or base flag refers to any more are deleted
//    (garbage collected) so repeated flip-shuffles do not grow the state.
//  * swapSimilar on a base pad works on a non-base copy placed on the key
//    (the base pad must stay with its slice); on a non-base pad it edits in place.
//  * Locks follow the pad in swapKeys; clearKey also removes the lock.
//  * seed values above 9999 wrap (modulo 10000) so "seed + 1" never sticks.
//
// v2 additions (see docs/ARCHITECTURE.md "v2 additions"):
//  * The mod zone is MOD_ZONE_SIZE = 16 keys (modZoneStart 0..112); layout, shuffle,
//    spread, findBest and occupiedKeys skip all 16 keys.
//  * Pad.morph = { <MORPH_PARAMS name>: B value }, only for params that were set.
//    setPadMorphParam/copyPadToMorph/clearPadMorph/copyAllToMorph/clearAllMorph/
//    applyMorphParamToSource are undoable and notify 'pads'. Pad copies (duplicate,
//    flip, spread, similar-swap) deep-copy morph; undo snapshots hold it (pads do).
//    copyPadToMorph/clearPadMorph -> true for a known pad (false otherwise), also when
//    nothing changed; copyAllToMorph/clearAllMorph/applyMorphParamToSource -> number of
//    pads changed (0 = no undo step, no notification).
//    applyMorphParamToSource is a no-op (0) when the pad has no B value for the param.
//  * effectivePad(padId, m) is the single place that blends A and B (m clamped 0..1;
//    m <= 0 gives exactly A, m >= 1 exactly B, so endpoints carry no float error).
//  * New globals: morph, morphEdit, scan, keepClip, captureBars, captureFolder,
//    gestureSel (plain setGlobal, 'globals' notification, not layout-affecting, not
//    undoable) and globals.gestures (4 Gesture objects). Gestures are edited with
//    setGestureParam (notifies 'globals', not undoable). getGesture(i) returns the LIVE
//    gesture object (like getPad/globals) - read-only for callers; null for a bad index.
//    setGlobal('gestures', x) is refused (false).
//  * Gesture beats: a number that is in GEST_BEATS is read as a VALUE first (so 1 means
//    1 beat and 2 means 2 beats), otherwise an integer 0..6 is an INDEX into GEST_BEATS
//    (0,3,5,6 -> 0.25, 2, 8, 16), otherwise a GEST_BEATS_LABELS string; anything else is
//    refused. 4 is both value and index and means 4 either way. fromJSON reads beats as a
//    value only (snapped to the nearest GEST_BEATS entry).
//  * fromJSON fills every v2 field with defaults for v1 states and clamps the rest.
//
// v2 fixes (docs/PROTOCOL.md "v2 fixes"):
//  * MAX_SLICES = 128. setSlices (still true/false) truncates a longer range list: the tail
//    is merged into the 128th range so the slices still cover the same frames, and
//    lastSliceTruncation() reports how many slice points were dropped by the most recent
//    setSlices call (0 when nothing was cut). addSlicePoint refuses (false) at 128 slices.
//    fromJSON does not cut saved sources (pads would lose their slices).
//  * removeSlicePoint sends the pads of both merged slices to the merged slice, and
//    moveSlicePoint / addSlicePoint keep every pad on its own slice (explicit id mapping in
//    the reslice path instead of "nearest start").
//  * lastLayout() -> { placed, dropped, slot } of the most recent layout pass: applyLayout
//    (that slot), an automatic re-layout of the auto slots (the current slot's numbers when
//    it was re-laid out, else the auto slot that dropped most), a reslice that appended new
//    pads to the current (manual) slot, or findBest (dropped = picked pads that did not
//    fit). Not serialised; { placed: 0, dropped: 0, slot: 0 } until the first pass.

var prng = require('./prng');

// ---------------------------------------------------------------- constants

var BEAT_DIVS = ['1/16', '1/16T', '1/8', '1/8T', '1/4', '1/4T', '1/2', '1/2T', '1 Bar', '2 Bars', '4 Bars'];
var BEAT_DIV_BEATS = [0.25, 1 / 6, 0.5, 1 / 3, 1, 2 / 3, 2, 4 / 3, 4, 8, 16];
var REPEAT_DIVS = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64'];
var REPEAT_PER_BEAT = [1, 2, 3, 4, 6, 8, 12, 16];
var MOD_ACTIONS = ['rpt:1/4', 'rpt:1/8', 'rpt:1/8T', 'rpt:1/16', 'rpt:1/16T', 'rpt:1/32',
  'rpt:1/64', 'reverse', 'octdown', 'octup', 'tape', 'chaos',
  'gest:0', 'gest:1', 'gest:2', 'gest:3'];
var MOD_ZONE_SIZE = 16;
var GEST_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16];
var GEST_BEATS_LABELS = ['1/16 bar', '1/8 bar', '1 beat', '2 beats', '1 bar', '2 bars', '4 bars'];
var GEST_RATES = ['off', '1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64'];
var CAPTURE_BARS = ['1/2 Bar', '1 Bar', '2 Bars', '4 Bars', '8 Bars'];
var CAPTURE_BEATS = [2, 4, 8, 16, 32];
var MORPH_PARAMS = ['pitch', 'fine', 'gainDb', 'attackMs', 'decayMs', 'sustain', 'releaseMs',
  'startOffsetMs', 'loopSizeMs', 'loopPos', 'cutoffHz', 'drive', 'reverse', 'loopOn'];
var MAX_SOURCES = 16;
var MAX_SLICES = 128;
var NUM_SLOTS = 8;
var NUM_KEYS = 128;
var MAX_LAYERS = 3;
var MAX_UNDO = 50;

var CONST = {
  BEAT_DIVS: BEAT_DIVS,
  BEAT_DIV_BEATS: BEAT_DIV_BEATS,
  REPEAT_DIVS: REPEAT_DIVS,
  REPEAT_PER_BEAT: REPEAT_PER_BEAT,
  MOD_ACTIONS: MOD_ACTIONS,
  MOD_ZONE_SIZE: MOD_ZONE_SIZE,
  GEST_BEATS: GEST_BEATS,
  GEST_BEATS_LABELS: GEST_BEATS_LABELS,
  GEST_RATES: GEST_RATES,
  CAPTURE_BARS: CAPTURE_BARS,
  CAPTURE_BEATS: CAPTURE_BEATS,
  MORPH_PARAMS: MORPH_PARAMS,
  MAX_SOURCES: MAX_SOURCES,
  MAX_SLICES: MAX_SLICES,
  NUM_SLOTS: NUM_SLOTS,
  NUM_KEYS: NUM_KEYS,
  MAX_LAYERS: MAX_LAYERS
};

var PALETTE = ['#FF5A5A', '#FFA54A', '#FFD84A', '#9BE35A', '#3FCF8E', '#3FD1D1', '#4AA8FF', '#7A7CFF',
  '#B57CFF', '#FF7CE0', '#FF8C8C', '#C9A27A', '#A0A0A0', '#6FD0FF', '#E0FF7C', '#FFB3D1'];

// Pad parameter ranges (setPadParam clamps to these).
var PAD_RANGES = {
  pitch: [-48, 48],
  fine: [-100, 100],
  gainDb: [-60, 12],
  attackMs: [0, 2000],
  decayMs: [0, 5000],
  sustain: [0, 1],
  releaseMs: [0, 5000],
  startOffsetMs: [0, 1000],
  loopSizeMs: [1, 500],
  loopPos: [0, 1],
  cutoffHz: [20, 20000],
  drive: [0, 1]
};
var PAD_BOOLS = { reverse: true, loopOn: true };
var MORPH_SET = {};
(function () {
  var i;
  for (i = 0; i < MORPH_PARAMS.length; i++) MORPH_SET[MORPH_PARAMS[i]] = true;
}());
// every user-editable pad field, in schema order
var PAD_PARAM_NAMES = ['reverse', 'pitch', 'fine', 'gainDb', 'attackMs', 'decayMs', 'sustain', 'releaseMs',
  'startOffsetMs', 'loopOn', 'loopSizeMs', 'loopPos', 'cutoffHz', 'drive'];

var PLAY_MODES = ['mono', 'poly', 'thru'];
var TRIG_MODES = ['trigger', 'gate'];
var SLICE_MODES = ['transient', 'beat', 'region', 'manual'];
var LAYOUTS = ['zones', 'interleave', 'sorted'];
var SORT_BYS = ['brightness', 'loudness', 'length'];
var CHOKE_SCOPES = ['source', 'global'];
var SHUFFLE_MODES = ['chaos', 'smart'];
var SHUFFLE_SCOPES = ['all', 'source'];
var SPREAD_PARAMS = ['pitch', 'decay', 'start', 'cutoff'];

var GLOBAL_DEFS = {
  rootKey: { t: 'int', min: 0, max: 127, def: 36 },
  layout: { t: 'enum', vals: LAYOUTS, def: 'zones' },
  zoneAlign: { t: 'bool', def: false },
  sortBy: { t: 'enum', vals: SORT_BYS, def: 'brightness' },
  chokeScope: { t: 'enum', vals: CHOKE_SCOPES, def: 'source' },
  chaos: { t: 'num', min: 0, max: 100, def: 0 },
  repeatOn: { t: 'bool', def: false },
  repeatDiv: { t: 'enum', vals: REPEAT_DIVS, def: '1/16' },
  swing: { t: 'num', min: 0, max: 100, def: 0 },
  repeatAlt: { t: 'bool', def: false },
  shuffleMode: { t: 'enum', vals: SHUFFLE_MODES, def: 'chaos' },
  shuffleScope: { t: 'enum', vals: SHUFFLE_SCOPES, def: 'all' },
  seed: { t: 'seed', def: 1 },
  flipPct: { t: 'num', min: 0, max: 100, def: 0 },
  modZoneOn: { t: 'bool', def: false },
  modZoneStart: { t: 'int', min: 0, max: 128 - MOD_ZONE_SIZE, def: 96 },
  velSens: { t: 'num', min: 0, max: 100, def: 50 },
  pressureToLevel: { t: 'bool', def: false },
  bestN: { t: 'int', min: 4, max: 64, def: 16 },
  spreadParam: { t: 'enum', vals: SPREAD_PARAMS, def: 'pitch' },
  spreadCount: { t: 'int', min: 2, max: 16, def: 16 },
  spreadStep: { t: 'num', min: -24, max: 24, def: 1 },
  morph: { t: 'num', min: 0, max: 100, def: 0 },
  morphEdit: { t: 'bool', def: false },
  scan: { t: 'num', min: 0, max: 100, def: 0 },
  keepClip: { t: 'bool', def: false },
  captureBars: { t: 'enum', vals: CAPTURE_BARS, def: '2 Bars' },
  captureFolder: { t: 'string', def: '' },
  gestureSel: { t: 'int', min: 0, max: 3, def: 0 }
};
var GLOBAL_NAMES = ['rootKey', 'layout', 'zoneAlign', 'sortBy', 'chokeScope', 'chaos', 'repeatOn', 'repeatDiv',
  'swing', 'repeatAlt', 'shuffleMode', 'shuffleScope', 'seed', 'flipPct', 'modZoneOn', 'modZoneStart',
  'velSens', 'pressureToLevel', 'bestN', 'spreadParam', 'spreadCount', 'spreadStep',
  'morph', 'morphEdit', 'scan', 'keepClip', 'captureBars', 'captureFolder', 'gestureSel'];
var LAYOUT_KEYS = { rootKey: true, layout: true, zoneAlign: true, sortBy: true, modZoneOn: true, modZoneStart: true };

// ---------------------------------------------------------------- helpers

function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.replace(/\s+/g, '') !== '') return Number(v);
  return NaN;
}

function toInt(v) {
  var n = toNum(v);
  return isFinite(n) ? Math.round(n) : NaN;
}

// -> true / false, or null when v is not boolean-like
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  var n = toNum(v);
  if (isNaN(n)) return null;
  return n !== 0;
}

// string in vals, or an integer index into vals; null when invalid
function enumValue(vals, v) {
  if (typeof v === 'string') return vals.indexOf(v) >= 0 ? v : null;
  if (typeof v === 'number' && isFinite(v) && v === Math.floor(v) && v >= 0 && v < vals.length) return vals[v];
  return null;
}

function copyObj(o) {
  var out = {};
  var k;
  for (k in o) {
    if (hasOwn(o, k)) out[k] = o[k];
  }
  return out;
}

function numericSort(a, b) {
  return a - b;
}

// -> { value } or null when name/value is invalid
function validateGlobal(name, value) {
  if (!hasOwn(GLOBAL_DEFS, name)) return null;
  var d = GLOBAL_DEFS[name];
  var n, b, e;
  switch (d.t) {
    case 'bool':
      b = toBool(value);
      return b === null ? null : { value: b };
    case 'enum':
      e = enumValue(d.vals, value);
      return e === null ? null : { value: e };
    case 'int':
      n = toInt(value);
      return isNaN(n) ? null : { value: clamp(n, d.min, d.max) };
    case 'num':
      n = toNum(value);
      return isFinite(n) ? { value: clamp(n, d.min, d.max) } : null;
    case 'seed':
      n = toInt(value);
      if (isNaN(n)) return null;
      if (n < 0) n = 0;
      if (n > 9999) n = n % 10000;
      return { value: n };
    case 'string':
      return typeof value === 'string' ? { value: value } : null;
  }
  return null;
}

// ---- gestures

var GEST_NAME_MAX = 32;
var GEST_FIELDS = ['name', 'beats', 'rateFrom', 'rateTo', 'cutFrom', 'cutTo', 'pitchFrom', 'pitchTo',
  'ampFrom', 'ampTo', 'curve'];
var GEST_RANGES = {
  cutFrom: [20, 20000], cutTo: [20, 20000],
  pitchFrom: [-48, 48], pitchTo: [-48, 48],
  ampFrom: [0, 1], ampTo: [0, 1],
  curve: [0, 1]
};
var GEST_DEFAULTS = [
  { name: 'Build', beats: 4, rateFrom: '1/8', rateTo: '1/64', cutFrom: 20000, cutTo: 1200, pitchFrom: 0, pitchTo: 0, ampFrom: 1, ampTo: 1, curve: 0.3 },
  { name: 'Rise', beats: 4, rateFrom: '1/16', rateTo: '1/16', cutFrom: 20000, cutTo: 20000, pitchFrom: 0, pitchTo: 12, ampFrom: 1, ampTo: 1, curve: 0 },
  { name: 'Drop', beats: 2, rateFrom: 'off', rateTo: 'off', cutFrom: 20000, cutTo: 600, pitchFrom: 0, pitchTo: -24, ampFrom: 1, ampTo: 0.6, curve: 0.5 },
  { name: 'Fade', beats: 4, rateFrom: '1/32', rateTo: '1/32', cutFrom: 20000, cutTo: 20000, pitchFrom: 0, pitchTo: 0, ampFrom: 1, ampTo: 0, curve: 0 }
];

function defaultGesture(i) {
  return copyObj(GEST_DEFAULTS[i]);
}

function defaultGestures() {
  var out = [];
  var i;
  for (i = 0; i < GEST_DEFAULTS.length; i++) out.push(defaultGesture(i));
  return out;
}

// beats from a user value: a number in GEST_BEATS is a value, else an integer 0..6 is an
// index into GEST_BEATS, else a GEST_BEATS_LABELS string. -> number or null
function gestBeatsValue(v) {
  var i, n;
  if (typeof v === 'string') {
    i = GEST_BEATS_LABELS.indexOf(v);
    if (i >= 0) return GEST_BEATS[i];
  }
  if (typeof v === 'boolean') return null;
  n = toNum(v);
  if (!isFinite(n)) return null;
  if (GEST_BEATS.indexOf(n) >= 0) return n;
  if (n === Math.floor(n) && n >= 0 && n < GEST_BEATS.length) return GEST_BEATS[n];
  return null;
}

// beats from saved JSON: always a value, snapped to the nearest GEST_BEATS entry. -> number or null
function gestBeatsFromJSON(v) {
  var i, n, best, bestD, d;
  if (typeof v === 'string') {
    i = GEST_BEATS_LABELS.indexOf(v);
    if (i >= 0) return GEST_BEATS[i];
  }
  if (typeof v === 'boolean') return null;
  n = toNum(v);
  if (!isFinite(n)) return null;
  best = GEST_BEATS[0];
  bestD = Math.abs(n - best);
  for (i = 1; i < GEST_BEATS.length; i++) {
    d = Math.abs(n - GEST_BEATS[i]);
    if (d < bestD) {
      bestD = d;
      best = GEST_BEATS[i];
    }
  }
  return best;
}

// -> { value } or null. fromJSON: beats is read as a value only.
function validateGestureParam(name, value, fromJSON) {
  var n, s, e, r;
  if (name === 'name') {
    if (typeof value === 'number' && isFinite(value)) value = String(value);
    if (typeof value !== 'string') return null;
    s = value.replace(/^\s+|\s+$/g, '');
    if (s === '') return null;
    return { value: s.length > GEST_NAME_MAX ? s.substring(0, GEST_NAME_MAX) : s };
  }
  if (name === 'beats') {
    n = fromJSON ? gestBeatsFromJSON(value) : gestBeatsValue(value);
    return n === null ? null : { value: n };
  }
  if (name === 'rateFrom' || name === 'rateTo') {
    e = enumValue(GEST_RATES, value);
    return e === null ? null : { value: e };
  }
  if (typeof name === 'string' && hasOwn(GEST_RANGES, name)) {
    if (typeof value === 'boolean') return null;
    n = toNum(value);
    if (!isFinite(n)) return null;
    r = GEST_RANGES[name];
    return { value: clamp(n, r[0], r[1]) };
  }
  return null;
}

// -> { value } or null
function validatePadParam(name, value) {
  var b, n, r;
  if (hasOwn(PAD_BOOLS, name)) {
    b = toBool(value);
    return b === null ? null : { value: b };
  }
  if (hasOwn(PAD_RANGES, name)) {
    n = toNum(value);
    if (!isFinite(n)) return null;
    r = PAD_RANGES[name];
    return { value: clamp(n, r[0], r[1]) };
  }
  return null;
}

function defaultGlobals() {
  var g = {};
  var i;
  for (i = 0; i < GLOBAL_NAMES.length; i++) g[GLOBAL_NAMES[i]] = GLOBAL_DEFS[GLOBAL_NAMES[i]].def;
  g.gestures = defaultGestures();
  return g;
}

function defaultSlicing() {
  return { mode: 'transient', sensitivity: 50, beatDiv: '1/16', regions: 16, bpm: 0, minSliceMs: 30, snap: true };
}

function defaultPad(id, sourceId, sliceId, base) {
  return {
    id: id, sourceId: sourceId, sliceId: sliceId, base: !!base,
    reverse: false, pitch: 0, fine: 0, gainDb: 0,
    attackMs: 0, decayMs: 300, sustain: 1, releaseMs: 30,
    startOffsetMs: 0, loopOn: false, loopSizeMs: 30, loopPos: 0,
    cutoffHz: 20000, drive: 0,
    layers: [], origSliceId: null, simIndex: 0,
    morph: {}
  };
}

function newSlot() {
  var keys = [];
  var locks = [];
  var i;
  for (i = 0; i < NUM_KEYS; i++) {
    keys.push(null);
    locks.push(false);
  }
  return { keys: keys, locks: locks, auto: true };
}

function freshState() {
  var slots = [];
  var i;
  for (i = 0; i < NUM_SLOTS; i++) slots.push(newSlot());
  return { version: 1, nextId: 1, sources: [], pads: {}, slots: slots, currentSlot: 0, globals: defaultGlobals() };
}

function baseName(path) {
  var parts = String(path).split(/[\\\/]/);
  return parts[parts.length - 1];
}

// Source `slicing` keys that setSourceSettings accepts at the top level of its partial.
var SLICING_KEYS = ['mode', 'sensitivity', 'beatDiv', 'regions', 'bpm', 'minSliceMs', 'snap'];

// -> { value } or null
function validateSlicing(name, value) {
  var n, b, e;
  switch (name) {
    case 'mode':
      e = enumValue(SLICE_MODES, value);
      return e === null ? null : { value: e };
    case 'beatDiv':
      e = enumValue(BEAT_DIVS, value);
      return e === null ? null : { value: e };
    case 'sensitivity':
      n = toNum(value);
      return isFinite(n) ? { value: clamp(n, 0, 100) } : null;
    case 'regions':
      n = toInt(value);
      return isNaN(n) ? null : { value: clamp(n, 2, 128) };
    case 'bpm':
      n = toNum(value);
      return isFinite(n) ? { value: clamp(n, 0, 250) } : null;
    case 'minSliceMs':
      n = toNum(value);
      return isFinite(n) ? { value: clamp(n, 5, 500) } : null;
    case 'snap':
      b = toBool(value);
      return b === null ? null : { value: b };
  }
  return null;
}

// ---------------------------------------------------------------- fromJSON sanitising

function sanitizeFeatures(f) {
  if (!f || typeof f !== 'object') return null;
  return copyObj(f);
}

function sanitizeState(raw) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  var st = freshState();
  if (!raw || typeof raw !== 'object') return st;
  var used = {};       // ids in use across sources / slices / pads
  var maxId = 0;
  var i, j, k, r, v, name;

  function claim(id) {
    if (typeof id !== 'number' || !isFinite(id) || id < 1 || id !== Math.floor(id) || hasOwn(used, id)) return false;
    used[id] = true;
    if (id > maxId) maxId = id;
    return true;
  }

  // globals
  if (raw.globals && typeof raw.globals === 'object') {
    for (i = 0; i < GLOBAL_NAMES.length; i++) {
      name = GLOBAL_NAMES[i];
      if (hasOwn(raw.globals, name)) {
        r = validateGlobal(name, raw.globals[name]);
        if (r) st.globals[name] = r.value;
      }
    }
    if (Array.isArray(raw.globals.gestures)) {
      for (i = 0; i < st.globals.gestures.length && i < raw.globals.gestures.length; i++) {
        var rg = raw.globals.gestures[i];
        if (!rg || typeof rg !== 'object') continue;
        for (j = 0; j < GEST_FIELDS.length; j++) {
          name = GEST_FIELDS[j];
          if (hasOwn(rg, name)) {
            r = validateGestureParam(name, rg[name], true);
            if (r) st.globals.gestures[i][name] = r.value;
          }
        }
      }
    }
  }

  // sources + slices
  var slotUsed = {};
  var sliceOwner = {};   // sliceId -> sourceId
  var rawSources = Array.isArray(raw.sources) ? raw.sources : [];
  for (i = 0; i < rawSources.length && st.sources.length < MAX_SOURCES; i++) {
    var rs = rawSources[i];
    if (!rs || typeof rs !== 'object' || !claim(rs.id)) continue;
    var slot = toInt(rs.slot);
    if (isNaN(slot) || slot < 0 || slot >= MAX_SOURCES || hasOwn(slotUsed, slot)) {
      slot = 0;
      while (hasOwn(slotUsed, slot)) slot++;
    }
    slotUsed[slot] = true;
    var src = {
      id: rs.id, slot: slot,
      name: typeof rs.name === 'string' ? rs.name : '',
      path: typeof rs.path === 'string' ? rs.path : '',
      frames: 0, sr: 0, channels: 0,
      color: slot,
      playMode: 'mono', trigMode: 'trigger',
      slicing: defaultSlicing(),
      slices: []
    };
    v = toInt(rs.frames); src.frames = (isNaN(v) || v < 0) ? 0 : v;
    v = toNum(rs.sr); src.sr = (isFinite(v) && v > 0) ? v : 0;
    v = toInt(rs.channels); src.channels = (isNaN(v) || v < 0) ? 0 : v;
    v = toInt(rs.color); if (!isNaN(v)) src.color = clamp(v, 0, 15);
    v = enumValue(PLAY_MODES, rs.playMode); if (v !== null) src.playMode = v;
    v = enumValue(TRIG_MODES, rs.trigMode); if (v !== null) src.trigMode = v;
    if (rs.slicing && typeof rs.slicing === 'object') {
      for (j = 0; j < SLICING_KEYS.length; j++) {
        if (hasOwn(rs.slicing, SLICING_KEYS[j])) {
          r = validateSlicing(SLICING_KEYS[j], rs.slicing[SLICING_KEYS[j]]);
          if (r) src.slicing[SLICING_KEYS[j]] = r.value;
        }
      }
    }
    var rawSlices = Array.isArray(rs.slices) ? rs.slices : [];
    for (j = 0; j < rawSlices.length; j++) {
      var sl = rawSlices[j];
      if (!sl || typeof sl !== 'object') continue;
      var s0 = toInt(sl.start);
      var e0 = toInt(sl.end);
      if (isNaN(s0) || isNaN(e0) || e0 <= s0 || !claim(sl.id)) continue;
      src.slices.push({ id: sl.id, start: s0, end: e0, features: sanitizeFeatures(sl.features) });
      sliceOwner[sl.id] = src.id;
    }
    src.slices.sort(function (a, b) { return a.start - b.start; });
    st.sources.push(src);
  }

  // pads
  var rawPads = (raw.pads && typeof raw.pads === 'object') ? raw.pads : {};
  var padKeys = Object.keys(rawPads);
  var numericKeys = [];
  for (i = 0; i < padKeys.length; i++) {
    v = Number(padKeys[i]);
    if (isFinite(v)) numericKeys.push(v);
  }
  numericKeys.sort(numericSort);
  for (i = 0; i < numericKeys.length; i++) {
    var rp = rawPads[numericKeys[i]];
    if (!rp || typeof rp !== 'object') continue;
    var pid = rp.id !== undefined ? rp.id : numericKeys[i];
    if (pid !== numericKeys[i]) continue;
    if (!hasOwn(sliceOwner, rp.sliceId) || sliceOwner[rp.sliceId] !== rp.sourceId) continue;
    if (!claim(pid)) continue;
    var pad = defaultPad(pid, rp.sourceId, rp.sliceId, toBool(rp.base) === true);
    for (j = 0; j < PAD_PARAM_NAMES.length; j++) {
      name = PAD_PARAM_NAMES[j];
      if (hasOwn(rp, name)) {
        r = validatePadParam(name, rp[name]);
        if (r) pad[name] = r.value;
      }
    }
    if (rp.origSliceId !== null && rp.origSliceId !== undefined && hasOwn(sliceOwner, rp.origSliceId)) {
      pad.origSliceId = rp.origSliceId;
      v = toInt(rp.simIndex);
      pad.simIndex = (isNaN(v) || v < 0) ? 0 : v;
    }
    if (rp.morph && typeof rp.morph === 'object' && !Array.isArray(rp.morph)) {
      for (j = 0; j < MORPH_PARAMS.length; j++) {
        name = MORPH_PARAMS[j];
        if (hasOwn(rp.morph, name)) {
          r = validatePadParam(name, rp.morph[name]);
          if (r) pad.morph[name] = r.value;
        }
      }
    }
    st.pads[pid] = pad;
  }
  // layers (second pass: all pads known)
  for (k in st.pads) {
    if (!hasOwn(st.pads, k)) continue;
    var lp = st.pads[k];
    var rl = rawPads[k] && Array.isArray(rawPads[k].layers) ? rawPads[k].layers : [];
    for (j = 0; j < rl.length && lp.layers.length < MAX_LAYERS; j++) {
      if (hasOwn(st.pads, rl[j]) && rl[j] !== lp.id && lp.layers.indexOf(rl[j]) < 0) lp.layers.push(rl[j]);
    }
  }

  // slots
  var rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
  for (i = 0; i < NUM_SLOTS; i++) {
    var rsl = rawSlots[i];
    if (!rsl || typeof rsl !== 'object') continue;
    var dst = st.slots[i];
    var rk = Array.isArray(rsl.keys) ? rsl.keys : [];
    var rlk = Array.isArray(rsl.locks) ? rsl.locks : [];
    for (j = 0; j < NUM_KEYS; j++) {
      dst.keys[j] = (rk[j] !== null && rk[j] !== undefined && hasOwn(st.pads, rk[j])) ? rk[j] : null;
      dst.locks[j] = toBool(rlk[j]) === true;
    }
    v = toBool(rsl.auto);
    dst.auto = v === null ? true : v;
  }
  v = toInt(raw.currentSlot);
  st.currentSlot = isNaN(v) ? 0 : clamp(v, 0, NUM_SLOTS - 1);
  v = toInt(raw.nextId);
  st.nextId = Math.max(isNaN(v) ? 1 : v, maxId + 1, 1);
  return st;
}

// ---------------------------------------------------------------- model

function createModel(state, deps) {
  var featuresMod = (deps && deps.features) ? deps.features : null;
  var listeners = [];
  var pending = {};
  var pendingN = 0;
  var undoStack = [];
  var redoStack = [];
  var lastKey = null;      // coalescing key of the most recent undo step
  var pendingSnap = null;  // { sourceId, snap } taken by setSourceSettings (slicing keys)
  var sliceMap = null;     // sliceId -> { slice, sourceId, index } (lazy)
  var srcSnap = null;      // cached JSON of per-source slices + slicing (lazy)
  var lastTruncation = 0;  // slice points dropped by the most recent setSlices
  var lastLayoutRes = { placed: 0, dropped: 0, slot: 0 };  // most recent layout pass

  // features are only needed for smart shuffle / similar / find-best: load lazily
  function featuresModule() {
    if (!featuresMod) featuresMod = require('./features');
    return featuresMod;
  }

  // ---- notifications

  function mark(kind) {
    if (!hasOwn(pending, kind)) {
      pending[kind] = true;
      pendingN++;
    }
  }

  function flush() {
    if (!pendingN) return;
    var kind = 'all';
    var k;
    if (pendingN === 1 && !pending.all) {
      for (k in pending) kind = k;
    }
    pending = {};
    pendingN = 0;
    var ls = listeners.slice();
    var i;
    for (i = 0; i < ls.length; i++) ls[i](kind);
  }

  // ---- lookups

  function touchSlices() {
    sliceMap = null;
    srcSnap = null;
  }

  function ensureSliceMap() {
    if (sliceMap) return sliceMap;
    sliceMap = {};
    var i, j, src;
    for (i = 0; i < state.sources.length; i++) {
      src = state.sources[i];
      for (j = 0; j < src.slices.length; j++) {
        sliceMap[src.slices[j].id] = { slice: src.slices[j], sourceId: src.id, index: j };
      }
    }
    return sliceMap;
  }

  function sliceInfo(id) {
    if (id === null || id === undefined) return null;
    var m = ensureSliceMap();
    return hasOwn(m, id) ? m[id] : null;
  }

  function getSource(id) {
    var n = toNum(id);
    var i;
    for (i = 0; i < state.sources.length; i++) {
      if (state.sources[i].id === n) return state.sources[i];
    }
    return null;
  }

  function getPad(id) {
    if (id === null || id === undefined) return null;
    return hasOwn(state.pads, id) ? state.pads[id] : null;
  }

  function curSlot() {
    return state.slots[state.currentSlot];
  }

  function slotIdx(s) {
    if (s === undefined || s === null) return state.currentSlot;
    var n = toInt(s);
    return isNaN(n) ? state.currentSlot : clamp(n, 0, NUM_SLOTS - 1);
  }

  function toKey(k) {
    var n = toInt(k);
    return (isNaN(n) || n < 0 || n >= NUM_KEYS) ? -1 : n;
  }

  function isModKeyRaw(k) {
    var g = state.globals;
    return g.modZoneOn && k >= g.modZoneStart && k < g.modZoneStart + MOD_ZONE_SIZE;
  }

  function padOnKey(key, slotIndex) {
    if (key < 0) return null;
    var pid = state.slots[slotIndex].keys[key];
    return pid === null ? null : getPad(pid);
  }

  function sortedPadIds() {
    var ks = Object.keys(state.pads);
    var out = [];
    var i;
    for (i = 0; i < ks.length; i++) out.push(Number(ks[i]));
    out.sort(numericSort);
    return out;
  }

  // sliceId -> base pad (lowest id wins if there are several)
  function baseBySlice(sortedIds) {
    var m = {};
    var i, p;
    for (i = 0; i < sortedIds.length; i++) {
      p = state.pads[sortedIds[i]];
      if (p.base && !hasOwn(m, p.sliceId)) m[p.sliceId] = p;
    }
    return m;
  }

  function newId() {
    return state.nextId++;
  }

  function makePad(sourceId, sliceId, base) {
    return defaultPad(newId(), sourceId, sliceId, base);
  }

  // copy of a pad with a fresh id (non-base)
  function copyPad(p) {
    var c = makePad(p.sourceId, p.sliceId, false);
    var i;
    for (i = 0; i < PAD_PARAM_NAMES.length; i++) c[PAD_PARAM_NAMES[i]] = p[PAD_PARAM_NAMES[i]];
    c.layers = p.layers.slice();
    c.origSliceId = p.origSliceId;
    c.simIndex = p.simIndex;
    c.morph = copyObj(p.morph);
    return c;
  }

  function featuredSlices() {
    var out = [];
    var i, j, src;
    for (i = 0; i < state.sources.length; i++) {
      src = state.sources[i];
      for (j = 0; j < src.slices.length; j++) {
        if (src.slices[j].features) out.push({ slice: src.slices[j], sourceId: src.id });
      }
    }
    return out;
  }

  // ---- pad garbage collection / deletion

  // alive = base pads, pads on a key of any slot, and layers of alive pads (transitively)
  function gcPads() {
    var alive = {};
    var stack = [];
    var ids = Object.keys(state.pads);
    var i, k, p, pid, l;

    function revive(id) {
      if (!hasOwn(alive, id) && hasOwn(state.pads, id)) {
        alive[id] = true;
        stack.push(id);
      }
    }

    for (i = 0; i < ids.length; i++) {
      p = state.pads[ids[i]];
      if (p.base) revive(p.id);
    }
    for (i = 0; i < NUM_SLOTS; i++) {
      for (k = 0; k < NUM_KEYS; k++) {
        pid = state.slots[i].keys[k];
        if (pid !== null) revive(pid);
      }
    }
    while (stack.length) {
      p = state.pads[stack.pop()];
      for (l = 0; l < p.layers.length; l++) revive(p.layers[l]);
    }
    for (i = 0; i < ids.length; i++) {
      if (!hasOwn(alive, ids[i])) delete state.pads[ids[i]];
    }
  }

  // delete the pads in `set` ({ padId: true }); clear their keys/locks and layer links
  function purgePads(set) {
    var any = false;
    var id, i, k, p, l, keep;
    for (id in set) {
      if (hasOwn(set, id)) {
        any = true;
        delete state.pads[id];
      }
    }
    if (!any) return;
    for (i = 0; i < NUM_SLOTS; i++) {
      for (k = 0; k < NUM_KEYS; k++) {
        var pid = state.slots[i].keys[k];
        if (pid !== null && hasOwn(set, pid)) {
          state.slots[i].keys[k] = null;
          state.slots[i].locks[k] = false;
        }
      }
    }
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      keep = [];
      for (l = 0; l < p.layers.length; l++) {
        if (!hasOwn(set, p.layers[l])) keep.push(p.layers[l]);
      }
      if (keep.length !== p.layers.length) p.layers = keep;
    }
  }

  // ---- layout

  function nextFreeKey(slot, k) {
    while (k < NUM_KEYS && (slot.locks[k] || isModKeyRaw(k))) k++;
    return k;
  }

  function sortValue(slice, by) {
    var f = slice.features;
    if (!f) return null;
    var v = by === 'loudness' ? f.rmsDb : (by === 'length' ? f.durMs : f.centroidHz);
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  // ordered base pads for the current layout: [{ pad, slice, align }]
  function layoutOrder() {
    var g = state.globals;
    var base = baseBySlice(sortedPadIds());
    var per = [];
    var i, j, src, arr, p;
    for (i = 0; i < state.sources.length; i++) {
      src = state.sources[i];
      arr = [];
      for (j = 0; j < src.slices.length; j++) {
        p = hasOwn(base, src.slices[j].id) ? base[src.slices[j].id] : null;
        if (p) arr.push({ pad: p, slice: src.slices[j], align: false });
      }
      per.push(arr);
    }
    var out = [];
    if (g.layout === 'interleave') {
      var more = true;
      for (j = 0; more; j++) {
        more = false;
        for (i = 0; i < per.length; i++) {
          if (j < per[i].length) {
            out.push(per[i][j]);
            more = true;
          }
        }
      }
      return out;
    }
    var first = true;
    for (i = 0; i < per.length; i++) {
      if (!per[i].length) continue;
      if (!first && g.zoneAlign && g.layout === 'zones') per[i][0].align = true;
      first = false;
      for (j = 0; j < per[i].length; j++) out.push(per[i][j]);
    }
    if (g.layout === 'sorted') {
      var by = g.sortBy;
      var dec = [];
      for (i = 0; i < out.length; i++) dec.push({ item: out[i], idx: i, v: sortValue(out[i].slice, by) });
      dec.sort(function (a, b) {
        if (a.v === null && b.v === null) return a.idx - b.idx;
        if (a.v === null) return 1;
        if (b.v === null) return -1;
        return (a.v - b.v) || (a.idx - b.idx);
      });
      out = [];
      for (i = 0; i < dec.length; i++) out.push(dec[i].item);
    }
    return out;
  }

  // lay `items` out on slot s (clears every unlocked key first). -> { placed, dropped }
  function placeLayout(s, items) {
    var slot = state.slots[s];
    var g = state.globals;
    var excluded = {};
    var k, i, item;
    for (k = 0; k < NUM_KEYS; k++) {
      if (slot.locks[k]) {
        if (slot.keys[k] !== null) excluded[slot.keys[k]] = true;
      } else {
        slot.keys[k] = null;
      }
    }
    var cur = g.rootKey;
    var placed = 0;
    var dropped = 0;
    var r;
    for (i = 0; i < items.length; i++) {
      item = items[i];
      if (hasOwn(excluded, item.pad.id)) continue;
      if (item.align) {
        r = (cur - g.rootKey) % 12;
        if (r !== 0) cur += 12 - r;
      }
      cur = nextFreeKey(slot, cur);
      if (cur >= NUM_KEYS) {
        dropped++;
        continue;
      }
      slot.keys[cur] = item.pad.id;
      placed++;
      cur++;
    }
    return { placed: placed, dropped: dropped };
  }

  // remember the outcome of a layout pass: the current slot's entry when there is one, else
  // the entry that dropped most (first on ties). results = [{ slot, placed, dropped }]
  function recordLayout(results) {
    var best = null;
    var i;
    for (i = 0; i < results.length; i++) {
      if (results[i].slot === state.currentSlot) {
        best = results[i];
        break;
      }
      if (best === null || results[i].dropped > best.dropped) best = results[i];
    }
    if (best) lastLayoutRes = { placed: best.placed, dropped: best.dropped, slot: best.slot };
  }

  // re-lay out every auto slot. With `results` the caller collects the outcomes and records
  // them itself (together with its own entries); without it they are recorded here.
  function relayoutAutoSlots(results) {
    var own = !results;
    var items = null;
    var s, r;
    if (own) results = [];
    for (s = 0; s < NUM_SLOTS; s++) {
      if (state.slots[s].auto) {
        if (!items) items = layoutOrder();
        r = placeLayout(s, items);
        results.push({ slot: s, placed: r.placed, dropped: r.dropped });
        mark('map');
      }
    }
    if (own) recordLayout(results);
  }

  // append pads after the highest occupied key of a (non-auto) slot -> number that did not fit
  function appendPads(slot, pads) {
    var hi = -1;
    var k, i;
    for (k = 0; k < NUM_KEYS; k++) {
      if (slot.keys[k] !== null) hi = k;
    }
    var cur = hi >= 0 ? hi + 1 : state.globals.rootKey;
    for (i = 0; i < pads.length; i++) {
      cur = nextFreeKey(slot, cur);
      if (cur >= NUM_KEYS) return pads.length - i;
      slot.keys[cur] = pads[i].id;
      cur++;
    }
    return 0;
  }

  // ---- undo

  function snapshot() {
    if (srcSnap === null) {
      var arr = [];
      var i;
      for (i = 0; i < state.sources.length; i++) {
        arr.push({ id: state.sources[i].id, slicing: state.sources[i].slicing, slices: state.sources[i].slices });
      }
      srcSnap = JSON.stringify(arr);
    }
    return {
      pads: JSON.stringify(state.pads),
      slots: JSON.stringify(state.slots),
      currentSlot: state.currentSlot,
      sources: srcSnap
    };
  }

  // Objects that exist both now and in the snapshot are updated in place, so
  // references callers hold (pads, slices, slots, slicing settings) stay valid.
  function restore(snap) {
    var k, i, j, f, cur;
    var pads = JSON.parse(snap.pads);
    for (k in state.pads) {
      if (hasOwn(state.pads, k) && !hasOwn(pads, k)) delete state.pads[k];
    }
    for (k in pads) {
      if (!hasOwn(pads, k)) continue;
      if (hasOwn(state.pads, k)) {
        cur = state.pads[k];
        for (f in pads[k]) {
          if (hasOwn(pads[k], f)) cur[f] = pads[k][f];
        }
      } else {
        state.pads[k] = pads[k];
      }
    }
    var slots = JSON.parse(snap.slots);
    for (i = 0; i < NUM_SLOTS; i++) {
      for (j = 0; j < NUM_KEYS; j++) {
        state.slots[i].keys[j] = slots[i].keys[j];
        state.slots[i].locks[j] = slots[i].locks[j];
      }
      state.slots[i].auto = slots[i].auto;
    }
    state.currentSlot = snap.currentSlot;
    var ss = JSON.parse(snap.sources);
    var src, existing, list, ns, ex;
    for (i = 0; i < ss.length; i++) {
      src = getSource(ss[i].id);
      if (!src) continue;
      for (f in ss[i].slicing) {
        if (hasOwn(ss[i].slicing, f)) src.slicing[f] = ss[i].slicing[f];
      }
      existing = {};
      for (j = 0; j < src.slices.length; j++) existing[src.slices[j].id] = src.slices[j];
      list = [];
      for (j = 0; j < ss[i].slices.length; j++) {
        ns = ss[i].slices[j];
        ex = hasOwn(existing, ns.id) ? existing[ns.id] : null;
        if (ex) {
          ex.start = ns.start;
          ex.end = ns.end;
          ex.features = ns.features;
          list.push(ex);
        } else {
          list.push(ns);
        }
      }
      src.slices = list;
    }
    touchSlices();
    relayoutAutoSlots();
    gcPads();
  }

  function clearHistory() {
    undoStack = [];
    redoStack = [];
    lastKey = null;
    pendingSnap = null;
  }

  // Start an undoable operation: snapshot the current state unless this call
  // coalesces into the previous step. Must be called before mutating.
  function beginOp(key, snap) {
    pendingSnap = null;
    var token = { pushed: false, shifted: null, savedRedo: redoStack, savedKey: lastKey };
    if (key && key === lastKey && undoStack.length) return token;
    undoStack.push(snap || snapshot());
    if (undoStack.length > MAX_UNDO) token.shifted = undoStack.shift();
    redoStack = [];
    lastKey = key || null;
    token.pushed = true;
    return token;
  }

  // forget an operation that turned out to change nothing
  function cancelOp(token) {
    if (!token.pushed) return;
    undoStack.pop();
    if (token.shifted) undoStack.unshift(token.shifted);
    redoStack = token.savedRedo;
    lastKey = token.savedKey;
  }

  // ---- slices: reslice policy

  function sanitizeRanges(ranges, frames) {
    var out = [];
    var i, r, s, e;
    if (ranges && ranges.length) {
      for (i = 0; i < ranges.length; i++) {
        r = ranges[i];
        if (!r) continue;
        s = toInt(r.start);
        e = toInt(r.end);
        if (isNaN(s) || isNaN(e)) continue;
        if (s < 0) s = 0;
        if (e <= s) continue;
        out.push({ start: s, end: e });
      }
      out.sort(function (a, b) { return (a.start - b.start) || (a.end - b.end); });
      var res = [];
      var prevEnd = -1;
      for (i = 0; i < out.length; i++) {
        s = out[i].start < prevEnd ? prevEnd : out[i].start;
        e = out[i].end;
        if (e <= s) continue;
        res.push({ start: s, end: e });
        prevEnd = e;
      }
      out = res;
    }
    if (!out.length && frames > 0) out.push({ start: 0, end: frames });
    return out;
  }

  function nearestIndex(starts, v) {
    var best = 0;
    var bestD = Infinity;
    var i, d;
    for (i = 0; i < starts.length; i++) {
      d = Math.abs(starts[i] - v);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  // Replace the slices of `src` with `ranges` following the reslice policy.
  // preserveSame: slices whose [start,end) is unchanged keep their id/features
  // (used by the manual slice-point edits; setSlices always makes fresh ones).
  // forced (manual edits only): { oldSliceId: start frame of the new slice it becomes },
  // so the pads of a split / moved / merged slice go to that slice instead of the new
  // slice with the nearest start.
  function resliceSource(src, ranges, preserveSame, forced) {
    var oldSlices = src.slices;
    var clean = sanitizeRanges(ranges, src.frames);
    var oldById = {};
    var byRange = {};
    var reused = {};
    var i, j, o, key, r;
    for (i = 0; i < oldSlices.length; i++) {
      oldById[oldSlices[i].id] = oldSlices[i];
      if (preserveSame) byRange[oldSlices[i].start + ':' + oldSlices[i].end] = oldSlices[i];
    }
    var newSlices = [];
    var newStarts = [];
    for (i = 0; i < clean.length; i++) {
      r = clean[i];
      key = r.start + ':' + r.end;
      o = (preserveSame && hasOwn(byRange, key) && !hasOwn(reused, byRange[key].id)) ? byRange[key] : null;
      if (o) {
        reused[o.id] = true;
        newSlices.push(o);
      } else {
        newSlices.push({ id: newId(), start: r.start, end: r.end, features: null });
      }
      newStarts.push(r.start);
    }

    // old slice id -> new slice id (forced, else nearest start), null when there are no new slices
    var idMap = {};
    var byStart = {};
    for (i = 0; i < newSlices.length; i++) byStart[newSlices[i].start] = newSlices[i];
    for (i = 0; i < oldSlices.length; i++) {
      o = oldSlices[i];
      if (hasOwn(reused, o.id)) idMap[o.id] = o.id;
      else if (forced && hasOwn(forced, o.id) && hasOwn(byStart, forced[o.id])) idMap[o.id] = byStart[forced[o.id]].id;
      else idMap[o.id] = newSlices.length ? newSlices[nearestIndex(newStarts, o.start)].id : null;
    }

    // re-point pads (ascending id order so "lowest id" rules are deterministic)
    var ids = sortedPadIds();
    var byNew = {};
    var removed = {};
    var p, nid;
    for (i = 0; i < ids.length; i++) {
      p = state.pads[ids[i]];
      if (p.sourceId === src.id) {
        if (hasOwn(oldById, p.sliceId)) nid = idMap[p.sliceId];
        else nid = newSlices.length ? newSlices[nearestIndex(newStarts, 0)].id : null;
        if (nid === null) {
          removed[p.id] = true;
          continue;
        }
        p.sliceId = nid;
        if (!hasOwn(byNew, nid)) byNew[nid] = [];
        byNew[nid].push(p);
      }
      if (p.origSliceId !== null && hasOwn(oldById, p.origSliceId)) {
        p.origSliceId = idMap[p.origSliceId];
        if (p.origSliceId === null) p.simIndex = 0;
      }
    }
    purgePads(removed);

    // exactly one base pad per new slice
    var fresh = [];
    var list, keep, np;
    for (j = 0; j < newSlices.length; j++) {
      list = hasOwn(byNew, newSlices[j].id) ? byNew[newSlices[j].id] : [];
      keep = null;
      for (i = 0; i < list.length; i++) {
        if (list[i].base) {
          if (!keep) keep = list[i];
          else list[i].base = false;
        }
      }
      if (!keep) {
        np = makePad(src.id, newSlices[j].id, true);
        state.pads[np.id] = np;
        fresh.push(np);
      }
    }

    src.slices = newSlices;
    touchSlices();

    var s, dropped;
    var results = [];
    if (fresh.length) {
      for (s = 0; s < NUM_SLOTS; s++) {
        if (!state.slots[s].auto) {
          dropped = appendPads(state.slots[s], fresh);
          if (s === state.currentSlot) results.push({ slot: s, placed: fresh.length - dropped, dropped: dropped });
        }
      }
    }
    relayoutAutoSlots(results);
    recordLayout(results);
    gcPads();
    mark('slices');
    mark('pads');
    mark('map');
  }

  // ---- shuffle helpers

  function shuffleGroups(mode, padIds, rng) {
    // -> array of groups, each an array of positions into padIds
    var n = padIds.length;
    var positions = [];
    var i;
    for (i = 0; i < n; i++) positions.push(i);
    if (mode !== 'smart') return [positions];

    var withF = [];
    var posF = [];
    var posNone = [];
    var info;
    for (i = 0; i < n; i++) {
      info = sliceInfo(state.pads[padIds[i]].sliceId);
      if (info && info.slice.features) {
        withF.push(info.slice.features);
        posF.push(i);
      } else {
        posNone.push(i);
      }
    }
    var groups = [];
    if (withF.length) {
      var F = featuresModule();
      var k = Math.max(1, Math.round(n / 6));
      if (k > withF.length) k = withF.length;
      var vectors = F.normalize(withF);
      var labels = F.kmeans(vectors, k, rng);
      var byLabel = {};
      var order = [];
      var lab;
      for (i = 0; i < posF.length; i++) {
        lab = labels[i];
        if (!hasOwn(byLabel, lab)) {
          byLabel[lab] = [];
          order.push(lab);
        }
        byLabel[lab].push(posF[i]);
      }
      for (i = 0; i < order.length; i++) groups.push(byLabel[order[i]]);
    }
    if (posNone.length) groups.push(posNone);
    return groups;
  }

  // ---- the public API

  var api = {};
  api.state = state;

  api.toJSON = function () {
    return JSON.parse(JSON.stringify(state));
  };

  api.onChange = function (fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  };

  // ---------------------------------------------------------------- sources

  api.addSource = function (info) {
    if (state.sources.length >= MAX_SOURCES) return null;
    info = info || {};
    var used = {};
    var i;
    for (i = 0; i < state.sources.length; i++) used[state.sources[i].slot] = true;
    var slot = 0;
    while (hasOwn(used, slot)) slot++;
    var path = (info.path === undefined || info.path === null) ? '' : String(info.path);
    var name = (info.name === undefined || info.name === null || info.name === '') ? baseName(path) : String(info.name);
    var src = {
      id: newId(), slot: slot,
      name: name, path: path,
      frames: 0, sr: 0, channels: 0,
      color: slot,
      playMode: 'mono', trigMode: 'trigger',
      slicing: defaultSlicing(),
      slices: []
    };
    state.sources.push(src);
    touchSlices();
    clearHistory();
    mark('sources');
    flush();
    return src;
  };

  api.setSourceInfo = function (sourceId, info) {
    var src = getSource(sourceId);
    if (!src || !info) return false;
    var v;
    if (info.frames !== undefined) {
      v = toInt(info.frames);
      if (!isNaN(v) && v >= 0) src.frames = v;
    }
    if (info.sr !== undefined) {
      v = toNum(info.sr);
      if (isFinite(v) && v >= 0) src.sr = v;
    }
    if (info.channels !== undefined) {
      v = toInt(info.channels);
      if (!isNaN(v) && v >= 0) src.channels = v;
    }
    mark('sources');
    flush();
    return true;
  };

  api.removeSource = function (sourceId) {
    var src = getSource(sourceId);
    if (!src) return false;
    state.sources.splice(state.sources.indexOf(src), 1);
    var removedSlice = {};
    var removedPad = {};
    var i, id, p;
    for (i = 0; i < src.slices.length; i++) removedSlice[src.slices[i].id] = true;
    for (id in state.pads) {
      if (hasOwn(state.pads, id) && state.pads[id].sourceId === src.id) removedPad[id] = true;
    }
    purgePads(removedPad);
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      if (p.origSliceId !== null && hasOwn(removedSlice, p.origSliceId)) {
        p.origSliceId = null;
        p.simIndex = 0;
      }
    }
    touchSlices();
    clearHistory();
    relayoutAutoSlots();
    gcPads();
    mark('all');
    flush();
    return true;
  };

  api.getSource = function (id) {
    return getSource(id);
  };

  api.getSourceBySlot = function (slot) {
    var n = toInt(slot);
    var i;
    for (i = 0; i < state.sources.length; i++) {
      if (state.sources[i].slot === n) return state.sources[i];
    }
    return null;
  };

  api.listSources = function () {
    return state.sources.slice();
  };

  api.setSourceSettings = function (sourceId, partial) {
    var src = getSource(sourceId);
    if (!src || !partial || typeof partial !== 'object') return false;
    var top = {};
    var sl = {};
    var nested = (partial.slicing && typeof partial.slicing === 'object') ? partial.slicing : null;
    var changed = false;
    var slicingChanged = false;
    var v, i, name, raw, has;

    if (hasOwn(partial, 'playMode')) {
      v = enumValue(PLAY_MODES, partial.playMode);
      if (v !== null) top.playMode = v;
    }
    if (hasOwn(partial, 'trigMode')) {
      v = enumValue(TRIG_MODES, partial.trigMode);
      if (v !== null) top.trigMode = v;
    }
    if (hasOwn(partial, 'color')) {
      v = toInt(partial.color);
      if (!isNaN(v)) top.color = clamp(v, 0, 15);
    }
    for (i = 0; i < SLICING_KEYS.length; i++) {
      name = SLICING_KEYS[i];
      has = false;
      if (hasOwn(partial, name)) {
        raw = partial[name];
        has = true;
      } else if (nested && hasOwn(nested, name)) {
        raw = nested[name];
        has = true;
      }
      if (has) {
        v = validateSlicing(name, raw);
        if (v) sl[name] = v.value;
      }
    }
    for (name in top) {
      if (hasOwn(top, name) && src[name] !== top[name]) changed = true;
    }
    for (name in sl) {
      if (hasOwn(sl, name) && src.slicing[name] !== sl[name]) {
        changed = true;
        slicingChanged = true;
      }
    }
    if (!changed) return true;
    if (slicingChanged && (!pendingSnap || pendingSnap.sourceId !== src.id)) {
      pendingSnap = { sourceId: src.id, snap: snapshot() };
    }
    for (name in top) {
      if (hasOwn(top, name)) src[name] = top[name];
    }
    for (name in sl) {
      if (hasOwn(sl, name)) src.slicing[name] = sl[name];
    }
    if (slicingChanged) srcSnap = null;
    mark('sources');
    flush();
    return true;
  };

  // ---------------------------------------------------------------- slices

  api.setSlices = function (sourceId, ranges) {
    var src = getSource(sourceId);
    if (!src) return false;
    var clean = sanitizeRanges(ranges, src.frames);
    lastTruncation = 0;
    if (clean.length > MAX_SLICES) {
      // cap: the tail is merged into the last allowed slice, the coverage stays the same
      lastTruncation = clean.length - MAX_SLICES;
      clean[MAX_SLICES - 1].end = clean[clean.length - 1].end;
      clean.length = MAX_SLICES;
    }
    var initial = src.slices.length === 0;
    if (initial) {
      clearHistory();
    } else {
      var snap = (pendingSnap && pendingSnap.sourceId === src.id) ? pendingSnap.snap : null;
      beginOp('slices:' + src.id, snap);
    }
    resliceSource(src, clean, false, null);
    mark('all');
    flush();
    return true;
  };

  // number of slice points the most recent setSlices dropped to respect MAX_SLICES (0 = none)
  api.lastSliceTruncation = function () {
    return lastTruncation;
  };

  api.setSliceFeatures = function (sourceId, featuresArray) {
    var src = getSource(sourceId);
    if (!src || !featuresArray || featuresArray.length !== src.slices.length) return false;
    var i;
    for (i = 0; i < src.slices.length; i++) {
      src.slices[i].features = sanitizeFeatures(featuresArray[i]);
    }
    touchSlices();
    mark('slices');
    if (state.globals.layout === 'sorted') relayoutAutoSlots();
    flush();
    return true;
  };

  // manual slice-point edits: set mode 'manual' and go through the reslice policy
  function manualEdit(src, coalesceKey, ranges, forced) {
    beginOp(coalesceKey, null);
    src.slicing.mode = 'manual';
    touchSlices();
    resliceSource(src, ranges, true, forced);
    mark('sources');
    mark('all');
    flush();
    return true;
  }

  function currentRanges(src) {
    var out = [];
    var i;
    if (src.slices.length) {
      for (i = 0; i < src.slices.length; i++) out.push({ start: src.slices[i].start, end: src.slices[i].end });
    } else if (src.frames > 0) {
      out.push({ start: 0, end: src.frames });
    }
    return out;
  }

  api.addSlicePoint = function (sourceId, frame) {
    var src = getSource(sourceId);
    if (!src) return false;
    var f = toInt(frame);
    if (isNaN(f)) return false;
    var ranges = currentRanges(src);
    if (ranges.length >= MAX_SLICES) return false;
    var i, forced;
    for (i = 0; i < ranges.length; i++) {
      if (f > ranges[i].start && f < ranges[i].end) {
        // the pads of the split slice stay on its first half
        forced = {};
        if (i < src.slices.length) forced[src.slices[i].id] = ranges[i].start;
        ranges.splice(i, 1, { start: ranges[i].start, end: f }, { start: f, end: ranges[i].end });
        return manualEdit(src, null, ranges, forced);
      }
    }
    return false;
  };

  api.moveSlicePoint = function (sourceId, sliceIndex, frame) {
    var src = getSource(sourceId);
    if (!src) return false;
    var i = toInt(sliceIndex);
    var f = toInt(frame);
    if (isNaN(i) || isNaN(f) || i < 1 || i >= src.slices.length) return false;
    var lo = src.slices[i - 1].start + 1;
    var hi = src.slices[i].end - 1;
    if (lo > hi) return false;
    f = clamp(f, lo, hi);
    if (f === src.slices[i].start) return false;
    var ranges = currentRanges(src);
    // both neighbours change their range but keep their pads (not "the nearest start")
    var forced = {};
    forced[src.slices[i - 1].id] = ranges[i - 1].start;
    forced[src.slices[i].id] = f;
    ranges[i - 1].end = f;
    ranges[i].start = f;
    return manualEdit(src, 'move:' + src.id + ':' + i, ranges, forced);
  };

  api.removeSlicePoint = function (sourceId, sliceIndex) {
    var src = getSource(sourceId);
    if (!src) return false;
    var i = toInt(sliceIndex);
    if (isNaN(i) || i < 1 || i >= src.slices.length) return false;
    var ranges = currentRanges(src);
    // the pads of both merged slices go to the merged slice
    var forced = {};
    forced[src.slices[i - 1].id] = ranges[i - 1].start;
    forced[src.slices[i].id] = ranges[i - 1].start;
    ranges.splice(i - 1, 2, { start: ranges[i - 1].start, end: ranges[i].end });
    return manualEdit(src, null, ranges, forced);
  };

  api.getSlice = function (sliceId) {
    var info = sliceInfo(sliceId);
    if (!info) return null;
    return { id: info.slice.id, start: info.slice.start, end: info.slice.end, features: info.slice.features, sourceId: info.sourceId };
  };

  api.getSlicesOfSource = function (sourceId) {
    var src = getSource(sourceId);
    return src ? src.slices.slice() : [];
  };

  // ---------------------------------------------------------------- pads

  api.getPad = function (padId) {
    return getPad(padId);
  };

  api.getPadOnKey = function (key, slot) {
    return padOnKey(toKey(key), slotIdx(slot));
  };

  api.setPadParam = function (padId, name, value) {
    var pad = getPad(padId);
    if (!pad || !hasOwn(PAD_RANGES, name) && !hasOwn(PAD_BOOLS, name)) return false;
    var r = validatePadParam(name, value);
    if (!r) return false;
    if (pad[name] === r.value) return true;
    beginOp('pad:' + pad.id + ':' + name, null);
    pad[name] = r.value;
    mark('pads');
    flush();
    return true;
  };

  // copy pad[name] to every pad of the same source. -> number of pads changed
  api.applyParamToSource = function (padId, name) {
    var pad = getPad(padId);
    if (!pad || !hasOwn(PAD_RANGES, name) && !hasOwn(PAD_BOOLS, name)) return 0;
    var token = beginOp(null, null);
    var changed = 0;
    var id, p;
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      if (p.sourceId === pad.sourceId && p.id !== pad.id && p[name] !== pad[name]) {
        p[name] = pad[name];
        changed++;
      }
    }
    if (!changed) {
      cancelOp(token);
      return 0;
    }
    mark('pads');
    flush();
    return changed;
  };

  // ---- morph (A = the pad's own params, B = pad.morph)

  // set the B value of one MORPH_PARAMS param (same validation / clamps as setPadParam)
  api.setPadMorphParam = function (padId, name, value) {
    var pad = getPad(padId);
    if (!pad || typeof name !== 'string' || !hasOwn(MORPH_SET, name)) return false;
    var r = validatePadParam(name, value);
    if (!r) return false;
    if (hasOwn(pad.morph, name) && pad.morph[name] === r.value) return true;
    beginOp('padmorph:' + pad.id + ':' + name, null);
    pad.morph[name] = r.value;
    mark('pads');
    flush();
    return true;
  };

  // B := A for every MORPH_PARAMS param. -> true for a known pad
  api.copyPadToMorph = function (padId) {
    var pad = getPad(padId);
    if (!pad) return false;
    var token = beginOp(null, null);
    var changed = false;
    var i, name;
    for (i = 0; i < MORPH_PARAMS.length; i++) {
      name = MORPH_PARAMS[i];
      if (!hasOwn(pad.morph, name) || pad.morph[name] !== pad[name]) {
        pad.morph[name] = pad[name];
        changed = true;
      }
    }
    if (!changed) {
      cancelOp(token);
      return true;
    }
    mark('pads');
    flush();
    return true;
  };

  // remove every B value of the pad. -> true for a known pad
  api.clearPadMorph = function (padId) {
    var pad = getPad(padId);
    if (!pad) return false;
    var names = Object.keys(pad.morph);
    if (!names.length) return true;
    var i;
    beginOp(null, null);
    for (i = 0; i < names.length; i++) delete pad.morph[names[i]];
    mark('pads');
    flush();
    return true;
  };

  // B := A on every pad. -> number of pads changed
  api.copyAllToMorph = function () {
    var token = beginOp(null, null);
    var changed = 0;
    var id, p, i, name, padChanged;
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      padChanged = false;
      for (i = 0; i < MORPH_PARAMS.length; i++) {
        name = MORPH_PARAMS[i];
        if (!hasOwn(p.morph, name) || p.morph[name] !== p[name]) {
          p.morph[name] = p[name];
          padChanged = true;
        }
      }
      if (padChanged) changed++;
    }
    if (!changed) {
      cancelOp(token);
      return 0;
    }
    mark('pads');
    flush();
    return changed;
  };

  // remove the B values of every pad. -> number of pads changed
  api.clearAllMorph = function () {
    var token = beginOp(null, null);
    var changed = 0;
    var id, p, names, i;
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      names = Object.keys(p.morph);
      if (!names.length) continue;
      for (i = 0; i < names.length; i++) delete p.morph[names[i]];
      changed++;
    }
    if (!changed) {
      cancelOp(token);
      return 0;
    }
    mark('pads');
    flush();
    return changed;
  };

  // copy this pad's B value of `name` to every other pad of the same source (no-op when
  // this pad has no B value for it). -> number of pads changed
  api.applyMorphParamToSource = function (padId, name) {
    var pad = getPad(padId);
    if (!pad || typeof name !== 'string' || !hasOwn(MORPH_SET, name) || !hasOwn(pad.morph, name)) return 0;
    var token = beginOp(null, null);
    var changed = 0;
    var id, p;
    for (id in state.pads) {
      if (!hasOwn(state.pads, id)) continue;
      p = state.pads[id];
      if (p.sourceId === pad.sourceId && p.id !== pad.id && (!hasOwn(p.morph, name) || p.morph[name] !== pad.morph[name])) {
        p.morph[name] = pad.morph[name];
        changed++;
      }
    }
    if (!changed) {
      cancelOp(token);
      return 0;
    }
    mark('pads');
    flush();
    return changed;
  };

  // The pad with the morph applied at amount m (0..1): a new plain object with every Pad
  // field. Numbers blend linearly, cutoffHz geometrically, booleans switch at m >= 0.5;
  // a param without a B value stays A. m <= 0 is exactly A, m >= 1 exactly B. null for an
  // unknown pad.
  api.effectivePad = function (padId, m) {
    var pad = getPad(padId);
    if (!pad) return null;
    var t = toNum(m);
    t = isNaN(t) ? 0 : clamp(t, 0, 1);
    var out = {};
    var f, i, name, a, b;
    for (f in pad) {
      if (!hasOwn(pad, f)) continue;
      if (f === 'layers') out.layers = pad.layers.slice();
      else if (f === 'morph') out.morph = copyObj(pad.morph);
      else out[f] = pad[f];
    }
    for (i = 0; i < MORPH_PARAMS.length; i++) {
      name = MORPH_PARAMS[i];
      if (!hasOwn(pad.morph, name)) continue;
      a = pad[name];
      b = pad.morph[name];
      if (hasOwn(PAD_BOOLS, name)) {
        out[name] = t >= 0.5 ? b : a;
      } else if (t <= 0) {
        out[name] = a;
      } else if (t >= 1) {
        out[name] = b;
      } else if (name === 'cutoffHz' && a > 0 && b > 0) {
        out[name] = a * Math.pow(b / a, t);
      } else {
        out[name] = a + (b - a) * t;
      }
    }
    return out;
  };

  api.duplicatePad = function (fromKey, toKey_) {
    var from = toKey(fromKey);
    var to = toKey(toKey_);
    if (from < 0 || to < 0 || from === to) return null;
    var slot = curSlot();
    var pad = padOnKey(from, state.currentSlot);
    if (!pad) return null;
    beginOp(null, null);
    var c = copyPad(pad);
    state.pads[c.id] = c;
    slot.keys[to] = c.id;
    slot.auto = false;
    gcPads();
    mark('all');
    flush();
    return c;
  };

  // true if `other` is now layered on the pad at `key`
  api.toggleLayer = function (key, otherKey) {
    var a = toKey(key);
    var b = toKey(otherKey);
    if (a < 0 || b < 0 || a === b) return false;
    var pa = padOnKey(a, state.currentSlot);
    var pb = padOnKey(b, state.currentSlot);
    if (!pa || !pb || pa.id === pb.id) return false;
    var idx = pa.layers.indexOf(pb.id);
    if (idx < 0 && pa.layers.length >= MAX_LAYERS) return false;
    beginOp(null, null);
    if (idx >= 0) pa.layers.splice(idx, 1);
    else pa.layers.push(pb.id);
    curSlot().auto = false;
    gcPads();
    mark('all');
    flush();
    return idx < 0;
  };

  api.swapSimilar = function (key, dir) {
    var k = toKey(key);
    var pad = padOnKey(k, state.currentSlot);
    if (!pad) return null;
    var d = toNum(dir);
    if (!isFinite(d) || d === 0) return pad;
    d = d > 0 ? 1 : -1;
    var list = featuredSlices();
    var orig = pad.origSliceId !== null ? pad.origSliceId : pad.sliceId;
    var t = -1;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].slice.id === orig) {
        t = i;
        break;
      }
    }
    if (t < 0) return null;
    var feats = [];
    for (i = 0; i < list.length; i++) feats.push(list[i].slice.features);
    var order = featuresModule().rankSimilar(t, feats);
    var rank = [t];
    for (i = 0; i < order.length; i++) {
      if (order[i] !== t) rank.push(order[i]);
    }
    var cur = clamp(pad.simIndex, 0, rank.length - 1);
    var ni = clamp(cur + d, 0, rank.length - 1);
    if (ni === cur) return pad;
    beginOp(null, null);
    var p = pad;
    if (pad.base) {
      // the base pad stays with its slice; the key gets a variation
      p = copyPad(pad);
      state.pads[p.id] = p;
      curSlot().keys[k] = p.id;
    }
    if (p.origSliceId === null) p.origSliceId = pad.sliceId;
    var target = list[rank[ni]];
    p.sliceId = target.slice.id;
    p.sourceId = target.sourceId;
    p.simIndex = ni;
    curSlot().auto = false;
    gcPads();
    mark('all');
    flush();
    return p;
  };

  api.spread = function (key, param, count, step) {
    var k0 = toKey(key);
    var pad = padOnKey(k0, state.currentSlot);
    if (!pad) return [];
    var g = state.globals;
    var pname = enumValue(SPREAD_PARAMS, param);
    if (pname === null) {
      if (param === 'decayMs') pname = 'decay';
      else if (param === 'startOffsetMs') pname = 'start';
      else if (param === 'cutoffHz') pname = 'cutoff';
      else if (param === undefined || param === null) pname = g.spreadParam;
      else return [];
    }
    var n = (count === undefined || count === null) ? g.spreadCount : toInt(count);
    var st = (step === undefined || step === null) ? g.spreadStep : toNum(step);
    if (isNaN(n) || !isFinite(st)) return [];
    n = clamp(n, 1, NUM_KEYS);
    if (n < 2) return [];
    var slot = curSlot();
    var token = beginOp(null, null);
    var written = [];
    var cur = k0;
    var i, c, v;
    for (i = 1; i < n; i++) {
      cur = nextFreeKey(slot, cur + 1);
      if (cur >= NUM_KEYS) break;
      c = copyPad(pad);
      if (pname === 'pitch') c.pitch = clamp(pad.pitch + i * st, PAD_RANGES.pitch[0], PAD_RANGES.pitch[1]);
      else if (pname === 'decay') c.decayMs = clamp(pad.decayMs + i * st, PAD_RANGES.decayMs[0], PAD_RANGES.decayMs[1]);
      else if (pname === 'start') c.startOffsetMs = clamp(pad.startOffsetMs + i * st, PAD_RANGES.startOffsetMs[0], PAD_RANGES.startOffsetMs[1]);
      else {
        v = pad.cutoffHz * Math.pow(2, i * st / 12);
        c.cutoffHz = clamp(v, PAD_RANGES.cutoffHz[0], PAD_RANGES.cutoffHz[1]);
      }
      state.pads[c.id] = c;
      slot.keys[cur] = c.id;
      written.push(cur);
    }
    if (!written.length) {
      cancelOp(token);
      return [];
    }
    slot.auto = false;
    gcPads();
    mark('all');
    flush();
    return written;
  };

  // ---------------------------------------------------------------- keys & slots

  api.currentSlot = function () {
    return state.currentSlot;
  };

  api.setCurrentSlot = function (i) {
    var n = toInt(i);
    if (isNaN(n)) return false;
    n = clamp(n, 0, NUM_SLOTS - 1);
    if (n === state.currentSlot) return true;
    state.currentSlot = n;
    mark('map');
    flush();
    return true;
  };

  api.getSlotKeys = function (slot) {
    return state.slots[slotIdx(slot)].keys.slice();
  };

  api.isLocked = function (key, slot) {
    var k = toKey(key);
    return k >= 0 && state.slots[slotIdx(slot)].locks[k] === true;
  };

  api.setLock = function (key, value) {
    var k = toKey(key);
    var b = toBool(value);
    if (k < 0 || b === null) return false;
    var slot = curSlot();
    if (slot.locks[k] === b) return true;
    slot.locks[k] = b;
    slot.auto = false;
    mark('map');
    flush();
    return true;
  };

  api.toggleLock = function (key) {
    var k = toKey(key);
    if (k < 0) return false;
    api.setLock(k, !curSlot().locks[k]);
    return curSlot().locks[k];
  };

  api.isModKey = function (key) {
    var k = toKey(key);
    return k >= 0 && !!isModKeyRaw(k);
  };

  api.modOffset = function (key) {
    var k = toKey(key);
    return (k >= 0 && isModKeyRaw(k)) ? k - state.globals.modZoneStart : -1;
  };

  api.clearKey = function (key) {
    var k = toKey(key);
    if (k < 0) return false;
    var slot = curSlot();
    if (slot.keys[k] === null && !slot.locks[k]) return false;
    beginOp(null, null);
    slot.keys[k] = null;
    slot.locks[k] = false;
    slot.auto = false;
    gcPads();
    mark('map');
    flush();
    return true;
  };

  api.swapKeys = function (a, b) {
    var ka = toKey(a);
    var kb = toKey(b);
    if (ka < 0 || kb < 0 || ka === kb) return false;
    var slot = curSlot();
    if (slot.keys[ka] === slot.keys[kb] && slot.locks[ka] === slot.locks[kb]) return false;
    beginOp(null, null);
    var tp = slot.keys[ka];
    var tl = slot.locks[ka];
    slot.keys[ka] = slot.keys[kb];
    slot.locks[ka] = slot.locks[kb];
    slot.keys[kb] = tp;
    slot.locks[kb] = tl;
    slot.auto = false;
    mark('map');
    flush();
    return true;
  };

  api.assignPad = function (key, padId) {
    var k = toKey(key);
    var pad = getPad(padId);
    if (k < 0 || !pad) return false;
    var slot = curSlot();
    if (slot.keys[k] === pad.id && !slot.auto) return true;
    beginOp(null, null);
    slot.keys[k] = pad.id;
    slot.auto = false;
    gcPads();
    mark('map');
    flush();
    return true;
  };

  api.copySlot = function (from, to) {
    var f = toInt(from);
    var t = toInt(to);
    if (isNaN(f) || isNaN(t) || f < 0 || t < 0 || f >= NUM_SLOTS || t >= NUM_SLOTS || f === t) return false;
    var src = state.slots[f];
    var dst = state.slots[t];
    var before = JSON.stringify(dst);
    var token = beginOp(null, null);
    var k;
    for (k = 0; k < NUM_KEYS; k++) {
      dst.keys[k] = src.keys[k];
      dst.locks[k] = src.locks[k];
    }
    dst.auto = src.auto;
    if (JSON.stringify(dst) === before) {
      cancelOp(token);
      return true;
    }
    gcPads();
    mark('map');
    flush();
    return true;
  };

  api.applyLayout = function (slot) {
    var s = slotIdx(slot);
    var sl = state.slots[s];
    var before = JSON.stringify(sl);
    var token = beginOp(null, null);
    var res = placeLayout(s, layoutOrder());
    lastLayoutRes = { placed: res.placed, dropped: res.dropped, slot: s };
    sl.auto = true;
    if (JSON.stringify(sl) === before) {
      cancelOp(token);
    } else {
      gcPads();
      mark('map');
      flush();
    }
    return res;
  };

  // outcome of the most recent layout pass (see the header): { placed, dropped, slot }
  api.lastLayout = function () {
    return { placed: lastLayoutRes.placed, dropped: lastLayoutRes.dropped, slot: lastLayoutRes.slot };
  };

  api.occupiedKeys = function (slot) {
    var keys = state.slots[slotIdx(slot)].keys;
    var out = [];
    var k;
    for (k = 0; k < NUM_KEYS; k++) {
      if (keys[k] !== null && !isModKeyRaw(k)) out.push(k);
    }
    return out;
  };

  // ---------------------------------------------------------------- shuffle / find best

  api.shuffle = function (opts) {
    opts = opts || {};
    var g = state.globals;
    var mode = enumValue(SHUFFLE_MODES, opts.mode);
    if (mode === null) mode = g.shuffleMode;
    var scope = enumValue(SHUFFLE_SCOPES, opts.scope);
    if (scope === null) scope = g.shuffleScope;
    var seed = (opts.seed === undefined || opts.seed === null) ? g.seed : toInt(opts.seed);
    if (isNaN(seed)) seed = g.seed;
    var flipPct = (opts.flipPct === undefined || opts.flipPct === null) ? g.flipPct : toNum(opts.flipPct);
    flipPct = isFinite(flipPct) ? clamp(flipPct, 0, 100) : g.flipPct;
    var sid = toNum(opts.sourceId);

    var slot = curSlot();
    var keys = [];
    var ids = [];
    var k, pad;
    for (k = 0; k < NUM_KEYS; k++) {
      if (slot.keys[k] === null || slot.locks[k] || isModKeyRaw(k)) continue;
      pad = getPad(slot.keys[k]);
      if (!pad) continue;
      if (scope === 'source' && pad.sourceId !== sid) continue;
      keys.push(k);
      ids.push(pad.id);
    }
    if (!keys.length) return { moved: 0 };

    beginOp(null, null);
    var rng = prng.mulberry32(seed);
    var groups = shuffleGroups(mode, ids, rng);
    var out = ids.slice();
    var gi, gj, members, vals;
    for (gi = 0; gi < groups.length; gi++) {
      members = groups[gi];
      vals = [];
      for (gj = 0; gj < members.length; gj++) vals.push(ids[members[gj]]);
      prng.shuffleInPlace(vals, rng);
      for (gj = 0; gj < members.length; gj++) out[members[gj]] = vals[gj];
    }
    if (flipPct > 0) {
      var thr = flipPct / 100;
      var c;
      for (gi = 0; gi < out.length; gi++) {
        if (rng() < thr) {
          c = copyPad(state.pads[out[gi]]);
          c.reverse = !c.reverse;
          state.pads[c.id] = c;
          out[gi] = c.id;
        }
      }
    }
    for (gi = 0; gi < keys.length; gi++) slot.keys[keys[gi]] = out[gi];
    slot.auto = false;
    gcPads();
    mark('all');
    flush();
    return { moved: keys.length };
  };

  api.findBest = function (n) {
    var g = state.globals;
    var count = (n === undefined || n === null) ? g.bestN : toInt(n);
    if (isNaN(count)) count = g.bestN;
    count = clamp(count, 1, NUM_KEYS);
    var list = featuredSlices();
    if (!list.length) return { placed: 0 };
    var feats = [];
    var i;
    for (i = 0; i < list.length; i++) feats.push(list[i].slice.features);
    var idxs = featuresModule().findBest(feats, count, { diversity: 0.5 });
    var base = baseBySlice(sortedPadIds());
    var slot = curSlot();
    var excluded = {};
    var k;
    for (k = 0; k < NUM_KEYS; k++) {
      if (slot.locks[k] && slot.keys[k] !== null) excluded[slot.keys[k]] = true;
    }
    var pads = [];
    var seen = {};
    var p;
    for (i = 0; i < idxs.length && pads.length < count; i++) {
      if (!list[idxs[i]] || hasOwn(seen, idxs[i])) continue;
      seen[idxs[i]] = true;
      p = hasOwn(base, list[idxs[i]].slice.id) ? base[list[idxs[i]].slice.id] : null;
      if (p && !hasOwn(excluded, p.id)) pads.push(p);
    }
    if (!pads.length) return { placed: 0 };
    beginOp(null, null);
    for (k = 0; k < NUM_KEYS; k++) {
      if (!slot.locks[k] && !isModKeyRaw(k)) slot.keys[k] = null;
    }
    var cur = g.rootKey;
    var placed = 0;
    for (i = 0; i < pads.length; i++) {
      cur = nextFreeKey(slot, cur);
      if (cur >= NUM_KEYS) break;
      slot.keys[cur] = pads[i].id;
      placed++;
      cur++;
    }
    slot.auto = false;
    lastLayoutRes = { placed: placed, dropped: pads.length - placed, slot: state.currentSlot };
    gcPads();
    mark('map');
    flush();
    return { placed: placed };
  };

  // ---------------------------------------------------------------- globals

  api.globals = function () {
    return state.globals;
  };

  api.setGlobal = function (name, value) {
    var r = validateGlobal(name, value);
    if (!r) return false;
    if (state.globals[name] === r.value) return true;
    state.globals[name] = r.value;
    mark('globals');
    if (hasOwn(LAYOUT_KEYS, name)) relayoutAutoSlots();
    flush();
    return true;
  };

  // ---- gestures (globals.gestures; notify 'globals', never undo steps)

  // the LIVE gesture object (read-only for callers), or null when index is not 0..3
  api.getGesture = function (index) {
    var i = toInt(index);
    if (isNaN(i) || i < 0 || i >= state.globals.gestures.length) return null;
    return state.globals.gestures[i];
  };

  // -> true when valid (also when unchanged), false for a bad index / name / value
  api.setGestureParam = function (index, name, value) {
    var g = api.getGesture(index);
    if (!g || typeof name !== 'string') return false;
    var r = validateGestureParam(name, value, false);
    if (!r) return false;
    if (g[name] === r.value) return true;
    g[name] = r.value;
    mark('globals');
    flush();
    return true;
  };

  // ---------------------------------------------------------------- undo

  api.canUndo = function () {
    return undoStack.length > 0;
  };

  api.canRedo = function () {
    return redoStack.length > 0;
  };

  api.undo = function () {
    if (!undoStack.length) return false;
    var snap = undoStack.pop();
    redoStack.push(snapshot());
    restore(snap);
    lastKey = null;
    pendingSnap = null;
    mark('all');
    flush();
    return true;
  };

  api.redo = function () {
    if (!redoStack.length) return false;
    var snap = redoStack.pop();
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    restore(snap);
    lastKey = null;
    pendingSnap = null;
    mark('all');
    flush();
    return true;
  };

  return api;
}

// ---------------------------------------------------------------- module API

function create(deps) {
  return createModel(freshState(), deps);
}

function fromJSON(obj, deps) {
  return createModel(sanitizeState(obj), deps);
}

module.exports = {
  CONST: CONST,
  PALETTE: PALETTE,
  PAD_RANGES: PAD_RANGES,
  create: create,
  fromJSON: fromJSON
};
