/*
 * SliceKit glue: the Max-side controller (ES5, CommonJS).
 *
 * Bundled by tools/build.js into dist/slicekit.js. The bundle footer defines the
 * Max entry points (loadbang, bang, msg_int, msg_float, list, anything,
 * notifydeleted) and forwards them to dispatch() / cleanup() below.
 *
 * Nothing here touches a Max global at module top level. Globals (outlet, post,
 * Buffer, Dict, LiveAPI, Task, jsarguments) are only read inside
 * hostFromGlobals(), the first time a message arrives. create(host) takes an
 * explicit host object, so the glue can also be driven without Max.
 *
 * Message formats: docs/PROTOCOL.md. Module APIs: docs/ARCHITECTURE.md.
 */

var Model = require('../core/model');
var Engine = require('../core/engine');
var Slicing = require('../core/slicing');
var Features = require('../core/features');
var Remap = require('../core/remap');

var CONST = Model.CONST;

var NUM_VOICES = 16;
var DEFAULT_PREFIX = '---src';
var DEFAULT_STATE = '---skstate';
var DEFAULT_VIEW = '---skview';
var DEFAULT_CAP = '---cap';

var PEEK_CHUNK = 65536;
var OVERVIEW_COLUMNS = 512;
var POLL_MS = 100;
var POLL_TICKS = 300;        // 300 x 100 ms = 30 s
var SAVE_MS = 300;
var VIEW_MS = 30;
var TICK_MS = 15;            // gesture ramp update period while a gesture key is held
var CAPTURE_LOAD_MS = 300;   // wait between writewave and loading the file
var SIMPLER_CLASS = 'OriginalSimpler';

var PLAY_MODES = ['mono', 'poly', 'thru'];
var TRIG_MODES = ['trigger', 'gate'];
var SLICE_MODES = ['transient', 'beat', 'region', 'manual'];
var LAYOUTS = ['zones', 'interleave', 'sorted'];
var SORT_BYS = ['brightness', 'loudness', 'length'];
var SHUFFLE_MODES = ['chaos', 'smart'];
var SHUFFLE_SCOPES = ['all', 'source'];
var CHOKE_SCOPES = ['source', 'global'];
var SPREAD_PARAMS = ['pitch', 'decay', 'start', 'cutoff'];

// Automatable kit params: Live remembers them, they may arrive before `init`.
var AUTO_PARAMS = ['slot', 'chaos', 'repeat', 'rate', 'swing', 'alt', 'morph', 'scan'];

// gest <param> -> Gesture field. kind: 'idx' (index into a list), 'num' (value * scale)
var GEST_PARAMS = {
  beats: { field: 'beats', kind: 'beats' },
  ratefrom: { field: 'rateFrom', kind: 'rate' },
  rateto: { field: 'rateTo', kind: 'rate' },
  cutfrom: { field: 'cutFrom' },
  cutto: { field: 'cutTo' },
  pitchfrom: { field: 'pitchFrom' },
  pitchto: { field: 'pitchTo' },
  ampfrom: { field: 'ampFrom', scale: 0.01 },
  ampto: { field: 'ampTo', scale: 0.01 },
  curve: { field: 'curve', scale: 0.01 }
};

// Messages after which the current slot's key map may have changed (see mapTracked).
var MAP_MESSAGES = { source: 1, pad: 1, kit: 1, ui: 1 };

// pad <param> -> Pad field. scale: UI value * scale = model value.
var PAD_PARAMS = {
  reverse: { field: 'reverse', bool: true },
  pitch: { field: 'pitch' },
  fine: { field: 'fine' },
  gain: { field: 'gainDb' },
  attack: { field: 'attackMs' },
  decay: { field: 'decayMs' },
  sustain: { field: 'sustain', scale: 0.01 },
  release: { field: 'releaseMs' },
  start: { field: 'startOffsetMs' },
  loop: { field: 'loopOn', bool: true },
  loopsize: { field: 'loopSizeMs' },
  looppos: { field: 'loopPos', scale: 0.01 },
  cutoff: { field: 'cutoffHz' },
  drive: { field: 'drive', scale: 0.01 }
};

// Pad defaults in UI units, used for feedback when no pad is selected.
var PAD_UI_DEFAULTS = {
  pad_reverse: 0, pad_pitch: 0, pad_fine: 0, pad_gain: 0, pad_attack: 0,
  pad_decay: 300, pad_sustain: 100, pad_release: 30, pad_start: 0,
  pad_loop: 0, pad_loopsize: 30, pad_looppos: 0, pad_cutoff: 20000,
  pad_drive: 0
};

// Messages that only touch the audio path or the view: no feedback sync needed.
var REALTIME = { note: 1, polypressure: 1, pressure: 1, voiceend: 1 };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(v, d) {
  var n = (typeof v === 'number') ? v : parseFloat(v);
  return (typeof n === 'number' && isFinite(n)) ? n : d;
}

function toInt(v, d) {
  return Math.round(num(v, d));
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function clampInt(v, lo, hi) {
  return clamp(toInt(v, lo), lo, hi);
}

function toBool(v) {
  if (typeof v === 'string') {
    return !(v === '' || v === '0' || v === 'off' || v === 'false');
  }
  return !!num(v, 0);
}

function rnd(v, digits) {
  var m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

function nameArg(v, d) {
  if (v === undefined || v === null || v === '') { return d; }
  return String(v);
}

function basename(p) {
  var s = String(p);
  var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'), s.lastIndexOf(':'));
  var b = i >= 0 ? s.substring(i + 1) : s;
  return b === '' ? s : b;
}

// Folder part of a path ('' when there is none). Handles / \\ and Max-style volume:name.
function dirname(p) {
  var s = String(p);
  var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  if (i < 0) { i = s.lastIndexOf(':'); }
  if (i <= 0) { return ''; }
  return s.substring(0, i);
}

function stripSlash(p) {
  return String(p).replace(/[\/\\]+$/, '');
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// YYYYMMDD-HHMMSS in local time.
function timestamp(ms) {
  var d = new Date(ms);
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

// First value of a LiveAPI get() result (an array of atoms), or the value itself.
function first(r) {
  if (r !== null && r !== undefined && typeof r === 'object' && typeof r.length === 'number') {
    return r.length ? r[0] : undefined;
  }
  return r;
}

function indexOfValue(list, value, d) {
  var i = list.indexOf(value);
  return i < 0 ? d : i;
}

function nearestIndex(list, v) {
  var best = 0;
  var i;
  for (i = 1; i < list.length; i++) {
    if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) { best = i; }
  }
  return best;
}

function toArray(a) {
  return Array.prototype.slice.call(a);
}

function errText(e) {
  var s = (e && e.message !== undefined) ? String(e.message) : String(e);
  if (e && e.lineNumber) { s += ' (line ' + e.lineNumber + ')'; }
  if (e && e.stack) { s += '\n' + String(e.stack); }
  return s;
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// ---------------------------------------------------------------------------
// State normalisation
//
// A Max dict round trip is lossy for JSON: true/false come back as 1/0, null
// can come back as the symbol "null", and one-element or empty arrays can be
// flattened. Model.fromJSON expects the original shapes, so repair them here.
// ---------------------------------------------------------------------------

function fixNull(v) {
  return (v === 'null' || v === undefined) ? null : v;
}

function asArray(v) {
  if (Array.isArray(v)) { return v; }
  if (v === undefined || v === null || v === 'null' || v === '') { return []; }
  return [v];
}

function fixBools(obj, names) {
  var i;
  if (!obj || typeof obj !== 'object') { return; }
  for (i = 0; i < names.length; i++) {
    if (has(obj, names[i])) {
      obj[names[i]] = (obj[names[i]] === 'false') ? false : !!obj[names[i]];
    }
  }
}

function normalizeState(st) {
  var i, j, ids, s, p, slot, keys;
  if (!st || typeof st !== 'object') { return st; }

  st.sources = asArray(st.sources);
  for (i = 0; i < st.sources.length; i++) {
    s = st.sources[i];
    if (!s || typeof s !== 'object') { continue; }
    if (s.slicing) { fixBools(s.slicing, ['snap']); }
    s.slices = asArray(s.slices);
    for (j = 0; j < s.slices.length; j++) {
      if (s.slices[j]) { s.slices[j].features = fixNull(s.slices[j].features); }
    }
  }

  if (st.pads && typeof st.pads === 'object') {
    ids = Object.keys(st.pads);
    for (i = 0; i < ids.length; i++) {
      p = st.pads[ids[i]];
      if (!p || typeof p !== 'object') { continue; }
      fixBools(p, ['reverse', 'base', 'loopOn']);
      if (p.morph && typeof p.morph === 'object') { fixBools(p.morph, ['reverse', 'loopOn']); }
      p.layers = asArray(p.layers);
      p.origSliceId = fixNull(p.origSliceId);
    }
  }

  st.slots = asArray(st.slots);
  for (i = 0; i < st.slots.length; i++) {
    slot = st.slots[i];
    if (!slot || typeof slot !== 'object') { continue; }
    fixBools(slot, ['auto']);
    keys = asArray(slot.keys);
    for (j = 0; j < keys.length; j++) { keys[j] = fixNull(keys[j]); }
    slot.keys = keys;
    slot.locks = asArray(slot.locks);
    for (j = 0; j < slot.locks.length; j++) { slot.locks[j] = !!slot.locks[j] && slot.locks[j] !== 'false'; }
  }

  fixBools(st.globals, ['zoneAlign', 'repeatOn', 'repeatAlt', 'modZoneOn', 'pressureToLevel', 'morphEdit', 'keepClip']);
  if (st.globals && has(st.globals, 'gestures')) { st.globals.gestures = asArray(st.globals.gestures); }
  return st;
}

// ---------------------------------------------------------------------------
// Host (Max globals), read lazily
// ---------------------------------------------------------------------------

function hostFromGlobals() {
  var h = {};
  h.outlet = function (n, a, b, c) {
    var len = arguments.length;
    if (len <= 1) { outlet(n); }
    else if (len === 2) { outlet(n, a); }
    else if (len === 3) { outlet(n, a, b); }
    else { outlet(n, a, b, c); }
  };
  h.post = function (s) { post(s); };
  h.Buffer = (typeof Buffer !== 'undefined') ? Buffer : null;
  h.Dict = (typeof Dict !== 'undefined') ? Dict : null;
  h.LiveAPI = (typeof LiveAPI !== 'undefined') ? LiveAPI : null;
  h.Task = (typeof Task !== 'undefined') ? Task : null;
  h.args = (typeof jsarguments !== 'undefined') ? toArray(jsarguments) : [];
  h.now = function () { return Date.now(); };
  // File path of the patcher that contains this js/v8 object ('' when unavailable).
  // The bundle footer (tools/build.js) keeps the top-level `this` of the js object and
  // exposes __skPatcher(), which reads `this.patcher` lazily; that is more robust than
  // reading `this` here, where it may be the global object of a plain function call.
  h.patcherPath = function () {
    var p, f;
    try {
      p = (typeof __skPatcher === 'function') ? __skPatcher() : null;
      f = p ? p.filepath : '';
      return (typeof f === 'string') ? f : '';
    } catch (e) {
      return '';
    }
  };
  return h;
}

// ---------------------------------------------------------------------------
// The glue
// ---------------------------------------------------------------------------

function create(host) {
  var args = host.args || [];
  var prefix = nameArg(args[1], DEFAULT_PREFIX);
  var stateName = nameArg(args[2], DEFAULT_STATE);
  var viewName = nameArg(args[3], DEFAULT_VIEW);
  var capName = nameArg(args[4], DEFAULT_CAP);   // ring buffer; the others derive from it
  var capWpName = capName + 'wp';                // frame 0 = recorder write position
  var capOutName = capName + 'out';              // staging buffer for writewave
  var nowFn = (typeof host.now === 'function') ? host.now : function () { return Date.now(); };

  var model = null;
  var engine = null;
  var sel = { source: -1, key: -1, slice: -1 };
  var selPadSig = '';
  var armed = '';
  var lastEdited = '';
  var lastEditedMorph = '';
  var monoCache = {};
  var overviewCache = {};
  var waveCache = {};
  var featCache = {};
  var autoParams = {};
  var status = 'Drop samples to start';
  var initialized = false;
  var forceFb = false;
  var lastFb = {};
  var pending = {};
  var poller = null;
  var pollerRunning = false;
  var transport = { bpm: 120, playing: 0 };
  var transportSeen = false;
  var tasks = [];
  var taskOwner = {};
  var liveStarted = false;
  var liveObjs = [];
  var stateDictObj = null;
  var viewDictObj = null;
  var warned = {};
  var saveDeb = null;
  var viewDeb = null;
  var tickTask = null;        // gesture ramp ticker
  var tickRunning = false;
  var gestHeld = [];          // held gesture keys, oldest first: { key, index }
  var simplers = [];          // result of the last Simpler scan: { path, label }
  var captureTask = null;     // delayed load of captured files
  var captureQueue = [];
  var lastCaptureName = '';
  var lastCaptureRepeat = 0;
  var lastMapping = null;     // { map: int[128], applied: clip path or '' } of the last map change
  var mapDepth = 0;
  var liveTemps = [];         // short-lived LiveAPI objects, freed by freeTemps()
  var self = {};

  // ----- output helpers --------------------------------------------------

  function out(n, a, b, c) {
    var len = arguments.length;
    if (len === 2) { host.outlet(n, a); }
    else if (len === 3) { host.outlet(n, a, b); }
    else if (len === 4) { host.outlet(n, a, b, c); }
    else { host.outlet(n); }
  }

  function log(msg) {
    try { host.post('SliceKit: ' + msg + '\n'); } catch (e) { /* no post available */ }
  }

  function setStatus(s) {
    status = String(s);
  }

  function sendCommands(cmds) {
    var i, j, c, p, v;
    if (!cmds || typeof cmds.length !== 'number') { return; }
    for (i = 0; i < cmds.length; i++) {
      c = cmds[i];
      if (!c || !c.params) { continue; }
      out(0, 'target', c.voice < 0 ? 0 : c.voice + 1);
      for (j = 0; j < c.params.length; j++) {
        p = c.params[j];
        v = p[1];
        if (typeof v === 'number' && !isFinite(v)) { v = 0; }
        out(0, p[0], v);
      }
    }
  }

  // ----- tasks -----------------------------------------------------------

  function newTask(fn, label) {
    var t;
    if (!host.Task) { return null; }
    t = new host.Task(function () {
      try { fn(); } catch (e) { log('error in ' + label + ': ' + errText(e)); }
    }, taskOwner);
    tasks.push(t);
    return t;
  }

  // coalesce = true: a trigger while pending is ignored (throttle).
  // coalesce = false: a trigger while pending restarts the delay (debounce).
  function makeDeferred(fn, ms, coalesce, label) {
    var task = null;
    var isPending = false;
    var d = {};
    d.trigger = function () {
      if (!task) {
        task = newTask(function () { isPending = false; fn(); }, label);
      }
      if (!task) { fn(); return; }
      if (isPending) {
        if (coalesce) { return; }
        task.cancel();
      }
      isPending = true;
      task.schedule(ms);
    };
    d.flush = function () {
      if (isPending) {
        isPending = false;
        task.cancel();
        fn();
      }
    };
    d.cancel = function () {
      if (isPending && task) { task.cancel(); }
      isPending = false;
    };
    return d;
  }

  // ----- selection helpers ----------------------------------------------

  function srcList() {
    return model.listSources();
  }

  function curSource() {
    var l = srcList();
    return (sel.source >= 0 && sel.source < l.length) ? l[sel.source] : null;
  }

  function curPad() {
    return sel.key >= 0 ? model.getPadOnKey(sel.key) : null;
  }

  function sourceIndexById(id) {
    var l = srcList();
    var i;
    for (i = 0; i < l.length; i++) {
      if (l[i].id === id) { return i; }
    }
    return -1;
  }

  function sliceIndexById(src, sliceId) {
    var i;
    if (!src) { return -1; }
    for (i = 0; i < src.slices.length; i++) {
      if (src.slices[i].id === sliceId) { return i; }
    }
    return -1;
  }

  function padSig(pad) {
    return pad ? (pad.id + ':' + pad.sliceId) : '';
  }

  function followPad(pad) {
    var si = sourceIndexById(pad.sourceId);
    var src;
    if (si < 0) { return; }
    sel.source = si;
    src = srcList()[si];
    sel.slice = sliceIndexById(src, pad.sliceId);
  }

  // Keep the selection valid after any model change. When the pad under the
  // selected key changed (slot switch, undo, shuffle, similar swap ...) the
  // selected source/slice follow it; otherwise a manual source selection stays.
  function reconcileSelection() {
    var list = srcList();
    var pad, sig, src, n;
    if (sel.source >= list.length) { sel.source = list.length - 1; }
    if (sel.source < 0 && list.length) { sel.source = 0; }
    pad = curPad();
    sig = padSig(pad);
    if (sig !== selPadSig) {
      selPadSig = sig;
      if (pad) { followPad(pad); }
    }
    src = curSource();
    n = src ? src.slices.length : 0;
    if (sel.slice >= n) { sel.slice = n - 1; }
    if (sel.slice < 0 && n) { sel.slice = 0; }
    if (!n) { sel.slice = -1; }
  }

  function selectKey(k) {
    sel.key = k;
    selPadSig = padSig(curPad());
    if (curPad()) { followPad(curPad()); }
    forceFb = true;
  }

  function firstKeyOfSource(srcId) {
    var keys = model.getSlotKeys();
    var k, pad;
    for (k = 0; k < keys.length; k++) {
      if (keys[k] !== null && keys[k] !== undefined) {
        pad = model.getPad(keys[k]);
        if (pad && pad.sourceId === srcId) { return k; }
      }
    }
    return -1;
  }

  // ----- buffers ---------------------------------------------------------

  function bufferName(slot) {
    return prefix + slot;
  }

  function bufFrames(slot) {
    var b, n;
    if (!host.Buffer) { return 0; }
    b = new host.Buffer(bufferName(slot));
    try {
      n = b.framecount();
    } finally {
      if (typeof b.freepeer === 'function') { b.freepeer(); }
    }
    return (typeof n === 'number' && n > 0) ? n : 0;
  }

  // Reads a loaded buffer~ into a mono Float32Array.
  function readBuffer(slot) {
    var b, frames, channels, lengthMs, sr, mono, c, pos, n, r, i, m;
    if (!host.Buffer) { return null; }
    b = new host.Buffer(bufferName(slot));
    try {
      frames = b.framecount();
      if (!(frames > 0)) { return null; }
      channels = Math.max(1, toInt(b.channelcount(), 1));
      lengthMs = b.length();
      sr = (typeof lengthMs === 'number' && lengthMs > 0) ? frames / (lengthMs / 1000) : 0;
      sr = sr > 1000 ? Math.round(sr) : 44100;
      mono = new Float32Array(frames);
      for (c = 1; c <= channels; c++) {
        for (pos = 0; pos < frames; pos += PEEK_CHUNK) {
          n = Math.min(PEEK_CHUNK, frames - pos);
          r = b.peek(c, pos, n);
          if (typeof r === 'number') { r = [r]; }
          if (!r) { continue; }
          m = Math.min(n, r.length);
          for (i = 0; i < m; i++) { mono[pos + i] += r[i]; }
        }
      }
      if (channels > 1) {
        for (i = 0; i < frames; i++) { mono[i] /= channels; }
      }
      return { frames: frames, channels: channels, sr: sr, mono: mono };
    } finally {
      if (typeof b.freepeer === 'function') { b.freepeer(); }
    }
  }

  function waveArray(srcId) {
    var ov, arr, i;
    if (waveCache[srcId]) { return waveCache[srcId]; }
    ov = overviewCache[srcId];
    if (!ov) { return []; }
    arr = [];
    for (i = 0; i < ov.length; i++) { arr.push(rnd(ov[i], 4)); }
    waveCache[srcId] = arr;
    return arr;
  }

  function dropCaches(srcId) {
    delete monoCache[srcId];
    delete overviewCache[srcId];
    delete waveCache[srcId];
    delete featCache[srcId];
  }

  // ----- slicing & features ---------------------------------------------

  // Computes features only for slices whose [start,end) is not cached.
  function recomputeFeatures(srcId) {
    var src = model.getSource(srcId);
    var mono = monoCache[srcId];
    var cache, fresh, slices, i, key, need, needIdx, res, outList;
    if (!src || !mono) { return; }
    cache = featCache[srcId] || {};
    fresh = {};
    slices = model.getSlicesOfSource(srcId);
    outList = [];
    need = [];
    needIdx = [];
    for (i = 0; i < slices.length; i++) {
      key = slices[i].start + ':' + slices[i].end;
      if (cache[key]) {
        outList[i] = cache[key];
        fresh[key] = cache[key];
      } else {
        outList[i] = null;
        need.push({ start: slices[i].start, end: slices[i].end });
        needIdx.push(i);
      }
    }
    if (need.length) {
      res = Features.computeAll(mono, src.sr, need);
      for (i = 0; i < need.length; i++) {
        outList[needIdx[i]] = res[i];
        fresh[need[i].start + ':' + need[i].end] = res[i];
      }
    }
    featCache[srcId] = fresh;
    model.setSliceFeatures(srcId, outList);
  }

  function seedFeatureCache(srcId) {
    var slices = model.getSlicesOfSource(srcId);
    var cache = {};
    var i;
    for (i = 0; i < slices.length; i++) {
      if (slices[i].features) { cache[slices[i].start + ':' + slices[i].end] = slices[i].features; }
    }
    featCache[srcId] = cache;
  }

  // Runs the slicer with the source's own settings. Returns slice count or -1.
  function resliceSource(srcId) {
    var src = model.getSource(srcId);
    var mono = monoCache[srcId];
    var ranges;
    if (!src || !mono) { return -1; }
    ranges = Slicing.sliceSource(mono, src.sr, src.slicing);
    if (!ranges || !ranges.length) { ranges = [{ start: 0, end: src.frames }]; }
    model.setSlices(srcId, ranges);
    recomputeFeatures(srcId);
    return model.getSlicesOfSource(srcId).length;
  }

  // Manual slices from Simpler slice points (frames). Falls back to the normal
  // slicer when there is no usable point. Returns the slice count or -1.
  function importSlices(srcId, points) {
    var src = model.getSource(srcId);
    var pts = [0];
    var i, p, ranges;
    if (!src || !monoCache[srcId]) { return -1; }
    for (i = 0; i < points.length; i++) {
      p = Math.round(num(points[i], 0));
      if (p > 0 && p < src.frames) { pts.push(p); }
    }
    if (pts.length < 2) { return resliceSource(srcId); }
    pts.sort(function (a, b) { return a - b; });
    ranges = Slicing.pointsToRanges(pts, src.frames, 1);
    model.setSourceSettings(srcId, { mode: 'manual' });
    model.setSlices(srcId, ranges);
    recomputeFeatures(srcId);
    return model.getSlicesOfSource(srcId).length;
  }

  // ----- loading ---------------------------------------------------------

  // Sends `<slot> replace <path>` and starts watching the buffer. The frame
  // count is sampled first: it is what a poll must see change.
  // extra (optional): { importPoints: [frames] } -> manual slices instead of auto-slicing.
  function requestLoad(slot, path, mode, extra) {
    var stale = bufFrames(slot);
    out(1, slot, 'replace', path);
    pending[slot] = { mode: mode, stale: stale, seen: -1, ticks: POLL_TICKS };
    if (extra && extra.importPoints) { pending[slot].importPoints = extra.importPoints; }
    ensurePoller();
  }

  function ensurePoller() {
    if (!poller) {
      poller = newTask(pollOnce, 'load poll');
      if (poller) { poller.interval = POLL_MS; }
    }
    if (!poller) { return; }
    if (pollerRunning) { poller.cancel(); }
    pollerRunning = true;
    poller.interval = POLL_MS;
    poller.repeat(POLL_TICKS); // es5-ok (Max Task.repeat)
  }

  function stopPoller() {
    if (poller && pollerRunning) { poller.cancel(); }
    pollerRunning = false;
  }

  function pollOnce() {
    var slots = Object.keys(pending);
    var i, slot, p, n;
    for (i = 0; i < slots.length; i++) {
      slot = slots[i];
      p = pending[slot];
      if (!p) { continue; }
      n = bufFrames(toInt(slot, 0));
      if (n > 0 && n !== p.stale && n === p.seen) {
        finishLoadTracked(toInt(slot, 0));
        continue;
      }
      p.seen = (n > 0 && n !== p.stale) ? n : -1;
      p.ticks--;
      if (p.ticks <= 0) { failLoad(toInt(slot, 0)); }
    }
    if (!Object.keys(pending).length) { stopPoller(); }
    afterEdit();
  }

  // A freshly loaded sample can change the layout of the current slot (interleave,
  // sorted): treat it as a map change for Keep clip. Restores never do.
  function finishLoadTracked(slot) {
    var p = pending[slot];
    if (p && p.mode === 'new') {
      mapTracked(function () { finishLoad(slot); });
    } else {
      finishLoad(slot);
    }
  }

  function failLoad(slot) {
    var p = pending[slot];
    var src = model.getSourceBySlot(slot);
    var name = src ? src.name : ('slot ' + slot);
    delete pending[slot];
    if (!p || !src) { return; }
    if (p.mode === 'new') {
      removeSourceNow(src);
      setStatus('Could not load ' + name);
    } else {
      setStatus('Missing file: ' + name);
    }
    log('buffer ' + bufferName(slot) + ' did not load (' + name + ')');
  }

  function removeSourceNow(src) {
    var slot = src.slot;
    var id = src.id;
    delete pending[slot];
    model.removeSource(id);
    dropCaches(id);
    out(1, slot, 'clear');
    reconcileSelection();
  }

  function finishLoad(slot) {
    var p = pending[slot];
    var src, data, isNew, count, idx, key;
    if (!p) { return; }
    delete pending[slot];
    src = model.getSourceBySlot(slot);
    if (!src) { return; }
    try {
      data = readBuffer(slot);
    } catch (e) {
      log('could not read buffer ' + bufferName(slot) + ': ' + errText(e));
      data = null;
    }
    if (!data) {
      pending[slot] = p;
      failLoad(slot);
      return;
    }
    monoCache[src.id] = data.mono;
    overviewCache[src.id] = Slicing.overview(data.mono, OVERVIEW_COLUMNS);
    delete waveCache[src.id];
    featCache[src.id] = {};

    isNew = (p.mode === 'new') || src.slices.length === 0 || src.frames !== data.frames;
    if (isNew) {
      model.setSourceInfo(src.id, { frames: data.frames, sr: data.sr, channels: data.channels });
      count = p.importPoints ? importSlices(src.id, p.importPoints) : resliceSource(src.id);
      if (count < 0) { count = 0; }
      src = model.getSource(src.id);
      idx = sourceIndexById(src.id);
      if (idx >= 0) {
        sel.source = idx;
        sel.slice = count ? 0 : -1;
      }
      if (sel.key < 0) {
        key = firstKeyOfSource(src.id);
        if (key >= 0) { selectKey(key); }
      }
      forceFb = true;
      setStatus('Loaded ' + src.name + ': ' + count + ' slices');
    } else {
      // Restore: slices are stored, only rebuild the caches.
      seedFeatureCache(src.id);
      count = src.slices.length;
      if (!Object.keys(pending).length) {
        setStatus('Restored ' + srcList().length + ' sample' + (srcList().length === 1 ? '' : 's'));
      } else {
        setStatus('Restoring ' + src.name + ' ...');
      }
    }
    viewDeb.trigger();
  }

  // extra (optional): { importPoints: [frames], playMode: 'mono'|'poly'|'thru' } (Simpler import).
  function addSourceFromPath(path, extra) {
    var p = String(path);
    var src = model.addSource({ name: basename(p), path: p });
    if (!src) {
      setStatus('16 samples max');
      return null;
    }
    if (extra && extra.playMode) { model.setSourceSettings(src.id, { playMode: extra.playMode }); }
    requestLoad(src.slot, p, 'new', extra);
    setStatus('Loading ' + src.name + ' ...');
    return src;
  }

  // ----- feedback --------------------------------------------------------

  // A pad parameter as the controls should show it: in morph edit the B value when set.
  function padValue(pad, field, g) {
    if (g.morphEdit && pad.morph && has(pad.morph, field)) { return pad.morph[field]; }
    return pad[field];
  }

  function hasMorph(pad) {
    var k;
    if (!pad || !pad.morph) { return false; }
    for (k in pad.morph) {
      if (has(pad.morph, k)) { return true; }
    }
    return false;
  }

  function buildFeedback() {
    var list = [];
    var src = curSource();
    var pad = curPad();
    var g = model.globals();
    var sl = src ? src.slicing : null;
    var k, ge;

    function add(name, v) {
      if (typeof v === 'boolean') { v = v ? 1 : 0; }
      if (typeof v !== 'number' || !isFinite(v)) { v = 0; }
      list.push([name, rnd(v, 4)]);
    }

    add('src_playmode', src ? indexOfValue(PLAY_MODES, src.playMode, 0) : 0);
    add('src_trigmode', src ? indexOfValue(TRIG_MODES, src.trigMode, 0) : 0);
    add('src_slicemode', sl ? indexOfValue(SLICE_MODES, sl.mode, 0) : 0);
    add('src_sensitivity', sl ? sl.sensitivity : 50);
    add('src_beatdiv', sl ? indexOfValue(CONST.BEAT_DIVS, sl.beatDiv, 0) : 0);
    add('src_regions', sl ? sl.regions : 16);
    add('src_bpm', sl ? sl.bpm : 0);
    add('src_minslice', sl ? sl.minSliceMs : 30);
    add('src_snap', sl ? !!sl.snap : true);

    if (pad) {
      // Morph edit shows the B values (A where no B is set).
      add('pad_reverse', !!padValue(pad, 'reverse', g));
      add('pad_pitch', padValue(pad, 'pitch', g));
      add('pad_fine', padValue(pad, 'fine', g));
      add('pad_gain', padValue(pad, 'gainDb', g));
      add('pad_attack', padValue(pad, 'attackMs', g));
      add('pad_decay', padValue(pad, 'decayMs', g));
      add('pad_sustain', padValue(pad, 'sustain', g) * 100);
      add('pad_release', padValue(pad, 'releaseMs', g));
      add('pad_start', padValue(pad, 'startOffsetMs', g));
      add('pad_loop', !!padValue(pad, 'loopOn', g));
      add('pad_loopsize', padValue(pad, 'loopSizeMs', g));
      add('pad_looppos', padValue(pad, 'loopPos', g) * 100);
      add('pad_cutoff', padValue(pad, 'cutoffHz', g));
      add('pad_drive', padValue(pad, 'drive', g) * 100);
    } else {
      for (k in PAD_UI_DEFAULTS) {
        if (has(PAD_UI_DEFAULTS, k)) { add(k, PAD_UI_DEFAULTS[k]); }
      }
    }
    add('pad_lock', sel.key >= 0 ? model.isLocked(sel.key) : false);
    add('pad_layerarm', armed === 'layer');
    add('pad_duparm', armed === 'dup');
    add('pad_spreadparam', indexOfValue(SPREAD_PARAMS, g.spreadParam, 0));
    add('pad_spreadcount', g.spreadCount);
    add('pad_spreadstep', g.spreadStep);

    add('kit_slot', model.currentSlot());
    add('kit_layout', indexOfValue(LAYOUTS, g.layout, 0));
    add('kit_zonealign', !!g.zoneAlign);
    add('kit_sortby', indexOfValue(SORT_BYS, g.sortBy, 0));
    add('kit_root', g.rootKey);
    add('kit_shufflemode', indexOfValue(SHUFFLE_MODES, g.shuffleMode, 0));
    add('kit_shufflescope', indexOfValue(SHUFFLE_SCOPES, g.shuffleScope, 0));
    add('kit_seed', g.seed);
    add('kit_flip', g.flipPct);
    add('kit_bestn', g.bestN);
    add('kit_chokescope', indexOfValue(CHOKE_SCOPES, g.chokeScope, 0));
    add('kit_modzone', !!g.modZoneOn);
    add('kit_modstart', g.modZoneStart);
    add('kit_velsens', g.velSens);
    add('kit_pressure2level', !!g.pressureToLevel);
    add('kit_morphedit', !!g.morphEdit);
    add('kit_capturebars', indexOfValue(CONST.CAPTURE_BARS, g.captureBars, 2));
    add('kit_keepclip', !!g.keepClip);

    ge = model.getGesture(g.gestureSel);
    add('gest_sel', g.gestureSel);
    add('gest_beats', ge ? nearestIndex(CONST.GEST_BEATS, ge.beats) : 0);
    add('gest_ratefrom', ge ? indexOfValue(CONST.GEST_RATES, ge.rateFrom, 0) : 0);
    add('gest_rateto', ge ? indexOfValue(CONST.GEST_RATES, ge.rateTo, 0) : 0);
    add('gest_cutfrom', ge ? ge.cutFrom : 20000);
    add('gest_cutto', ge ? ge.cutTo : 20000);
    add('gest_pitchfrom', ge ? ge.pitchFrom : 0);
    add('gest_pitchto', ge ? ge.pitchTo : 0);
    add('gest_ampfrom', ge ? ge.ampFrom * 100 : 100);
    add('gest_ampto', ge ? ge.ampTo * 100 : 100);
    add('gest_curve', ge ? ge.curve * 100 : 0);
    return list;
  }

  // Sends feedback to outlet 2. Without `force` only changed values are sent.
  function syncFeedback(force) {
    var list = buildFeedback();
    var i, name, v;
    for (i = 0; i < list.length; i++) {
      name = list[i][0];
      v = list[i][1];
      if (force || lastFb[name] !== v) {
        out(2, name, v);
        lastFb[name] = v;
      }
    }
  }

  // Nothing is sent to the controls or the jsui before `init`: a default value
  // pushed into an automatable control could overwrite what Live just restored.
  function afterEdit() {
    var force;
    reconcileSelection();
    if (!initialized) { return; }
    force = forceFb;
    forceFb = false;
    syncFeedback(force);
    viewDeb.trigger();
  }

  // ----- view dict -------------------------------------------------------

  function buildView() {
    var list, sources, cur, s, i, k, wave, slices, keys, flags, slotKeys, active, pad, ps, f, padId, g, names, ge;
    reconcileSelection();
    list = srcList();
    sources = [];
    for (i = 0; i < list.length; i++) {
      s = list[i];
      sources.push({
        index: i, id: s.id, name: s.name, color: s.color,
        playMode: s.playMode, trigMode: s.trigMode,
        slices: s.slices.length, loaded: monoCache[s.id] ? 1 : 0
      });
    }
    cur = curSource();
    wave = cur ? waveArray(cur.id) : [];
    slices = [];
    if (cur && cur.frames > 0) {
      for (i = 0; i < cur.slices.length; i++) {
        slices.push([rnd(cur.slices[i].start / cur.frames, 6), rnd(cur.slices[i].end / cur.frames, 6)]);
      }
    }
    slotKeys = model.getSlotKeys();
    active = {};
    ps = engine.activeKeys();
    for (i = 0; i < ps.length; i++) { active[ps[i]] = true; }
    keys = [];
    flags = [];
    for (k = 0; k < CONST.NUM_KEYS; k++) {
      padId = slotKeys[k];
      pad = (padId !== null && padId !== undefined) ? model.getPad(padId) : null;
      s = pad ? model.getSource(pad.sourceId) : null;
      keys.push(s ? s.color : -1);
      f = 0;
      if (model.isLocked(k)) { f |= 1; }
      if (pad && pad.reverse) { f |= 2; }
      if (pad && pad.layers && pad.layers.length) { f |= 4; }
      if (model.isModKey(k)) { f |= 8; }
      if (active[k]) { f |= 16; }
      if (pad && pad.base === false) { f |= 32; }
      if (hasMorph(pad)) { f |= 64; }
      flags.push(f);
    }
    g = model.globals();
    names = [];
    for (i = 0; i < 4; i++) {
      ge = model.getGesture(i);
      names.push(ge ? String(ge.name) : 'G' + (i + 1));
    }
    return {
      status: status,
      palette: Model.PALETTE,
      sources: sources,
      selectedSource: cur ? sel.source : -1,
      selectedFrames: (cur && monoCache[cur.id]) ? cur.frames : 0,
      wave: wave,
      slices: slices,
      selectedSlice: sel.slice,
      keys: keys,
      keyFlags: flags,
      selectedKey: sel.key,
      rootKey: g.rootKey,
      modStart: g.modZoneOn ? g.modZoneStart : -1,
      slot: model.currentSlot(),
      armed: armed,
      morph: g.morph,
      morphEdit: g.morphEdit ? 1 : 0,
      scan: g.scan,
      gesture: activeGesture(),
      gestureNames: names
    };
  }

  function getDict(name) {
    return new host.Dict(name);
  }

  function writeView() {
    var d;
    if (!host.Dict || !model || !initialized) { return; }
    if (!viewDictObj) { viewDictObj = getDict(viewName); }
    d = viewDictObj;
    d.clear();
    d.parse(JSON.stringify(buildView()));
    out(3, 'refresh');
  }

  // ----- state dict ------------------------------------------------------

  function saveState() {
    var d, json;
    if (!initialized || !host.Dict) { return; }
    json = JSON.stringify(model.toJSON());
    if (!stateDictObj) { stateDictObj = getDict(stateName); }
    d = stateDictObj;
    d.clear();
    d.parse(json);
  }

  function readState() {
    var s, obj;
    if (!host.Dict) { return null; }
    if (!stateDictObj) { stateDictObj = getDict(stateName); }
    s = stateDictObj.stringify();
    if (typeof s !== 'string' || s.length < 3) { return null; }
    try { obj = JSON.parse(s); } catch (e) { log('state dict is not valid JSON, ignored'); return null; }
    if (!obj || typeof obj !== 'object' || !obj.sources || !obj.version) { return null; }
    return obj;
  }

  // ----- model / engine wiring ------------------------------------------

  function onModelChange() {
    if (saveDeb) { saveDeb.trigger(); }
    if (viewDeb) { viewDeb.trigger(); }
  }

  function attachModel(m) {
    model = m;
    model.onChange(onModelChange);
    engine = Engine.create({
      model: model,
      numVoices: NUM_VOICES,
      bufferName: bufferName,
      now: nowFn
    });
    if (transportSeen) { sendCommands(engine.setTransport(transport)); }
  }

  // ----- automatable parameters -----------------------------------------

  function applyKitParam(name, v) {
    var g = model.globals();
    var held = false;
    switch (name) {
      case 'slot':
        model.setCurrentSlot(clampInt(v, 0, CONST.NUM_SLOTS - 1));
        break;
      case 'chaos':
        model.setGlobal('chaos', clamp(num(v, 0), 0, 100));
        break;
      case 'repeat':
        model.setGlobal('repeatOn', toBool(v));
        held = true;
        break;
      case 'rate':
        model.setGlobal('repeatDiv', CONST.REPEAT_DIVS[clampInt(v, 0, CONST.REPEAT_DIVS.length - 1)]);
        held = true;
        break;
      case 'swing':
        model.setGlobal('swing', clamp(num(v, 0), 0, 100));
        held = true;
        break;
      case 'alt':
        model.setGlobal('repeatAlt', toBool(v));
        held = true;
        break;
      case 'morph':
        model.setGlobal('morph', clamp(num(v, 0), 0, 100));
        sendCommands(engine.refreshMorph());
        break;
      case 'scan':
        model.setGlobal('scan', clamp(num(v, 0), 0, 100));
        sendCommands(engine.refreshScan());
        break;
      default:
        return false;
    }
    if (held && g) { sendCommands(engine.refreshHeld()); }
    return true;
  }

  function applyCachedAutoParams() {
    var i;
    for (i = 0; i < AUTO_PARAMS.length; i++) {
      if (has(autoParams, AUTO_PARAMS[i])) { applyKitParam(AUTO_PARAMS[i], autoParams[AUTO_PARAMS[i]]); }
    }
  }

  // ----- gesture ticker --------------------------------------------------
  //
  // While a gesture modifier key is held the engine needs tick() calls to advance
  // its ramps. A repeating Task (TICK_MS) runs exactly as long as needsTick() is
  // true: it is started after a note on and stopped right after the note off (the
  // engine reverts the voices itself on release); a tick that finds needsTick()
  // false also stops it, as a safety net.

  function trackGesture(key, on) {
    var i, off, action, index;
    for (i = 0; i < gestHeld.length; i++) {
      if (gestHeld[i].key === key) {
        if (!on) { gestHeld.splice(i, 1); }
        return;
      }
    }
    if (!on || !model.isModKey(key)) { return; }
    off = model.modOffset(key);
    action = (off >= 0) ? CONST.MOD_ACTIONS[off] : null;
    if (action && action.indexOf('gest:') === 0) {
      index = toInt(action.substring(5), -1);
      if (index >= 0) { gestHeld.push({ key: key, index: index }); }
    }
  }

  // Index of the gesture being applied (the most recently pressed held one), or -1.
  function activeGesture() {
    if (!gestHeld.length || !engine.needsTick()) { return -1; }
    return gestHeld[gestHeld.length - 1].index;
  }

  function stopTicker() {
    if (tickTask && tickRunning) { tickTask.cancel(); }
    tickRunning = false;
  }

  function tickOnce() {
    sendCommands(engine.tick());
    if (!engine.needsTick()) {
      stopTicker();
      gestHeld = [];
      viewDeb.trigger();
    }
  }

  function updateTicker() {
    if (!engine.needsTick()) {
      stopTicker();
      gestHeld = [];
      return;
    }
    if (tickRunning) { return; }
    if (!tickTask) {
      tickTask = newTask(tickOnce, 'gesture tick');
      if (!tickTask) { return; }
    }
    tickTask.interval = TICK_MS;
    tickRunning = true;
    tickTask.repeat(); // es5-ok (Max Task.repeat, no count = until cancelled)
  }

  // note on/off and audition all go through here
  function playKey(key, vel) {
    if (vel > 0) {
      trackGesture(key, true);
      sendCommands(engine.noteOn(key, vel));
    } else {
      trackGesture(key, false);
      sendCommands(engine.noteOff(key));
    }
    updateTicker();
    viewDeb.trigger();
  }

  // ----- LiveAPI ---------------------------------------------------------

  function onLive(a, argList) {
    var arr = (a && typeof a === 'object' && typeof a.length === 'number') ? a : toArray(argList);
    var key;
    if (!arr || arr.length < 2) { return; }
    key = String(arr[0]);
    if (key === 'tempo') {
      transport.bpm = num(arr[1], transport.bpm);
    } else if (key === 'is_playing') {
      transport.playing = num(arr[1], 0) ? 1 : 0;
    } else {
      return;
    }
    transportSeen = true;
    sendCommands(engine.setTransport({ bpm: transport.bpm, playing: transport.playing }));
  }

  function observe(property) {
    var api = new host.LiveAPI(function (a) { onLive(a, arguments); }, 'live_set');
    api.property = property;
    liveObjs.push(api);
  }

  function startLive() {
    if (liveStarted) { return; }
    liveStarted = true;
    if (!host.LiveAPI) { return; }
    try {
      observe('tempo');
      observe('is_playing');
    } catch (e) {
      log('LiveAPI unavailable: ' + errText(e));
    }
  }

  // ----- LiveAPI helpers -------------------------------------------------

  function noop() { }

  // Opens a LiveAPI object on `path` without observing anything. Temporaries are
  // released by freeTemps() once the operation that needed them is done.
  function openApi(path) {
    var api = new host.LiveAPI(noop, path);
    liveTemps.push(api);
    return api;
  }

  function freeTemps() {
    var i;
    for (i = 0; i < liveTemps.length; i++) {
      try {
        if (typeof liveTemps[i].freepeer === 'function') { liveTemps[i].freepeer(); }
      } catch (e) { /* ignore */ }
    }
    liveTemps = [];
  }

  // A LiveAPI object that points at nothing has id 0.
  function isValidApi(api) {
    var id = api ? String(api.id) : '0';
    return id !== '0' && id !== '' && id !== 'undefined' && id !== 'null';
  }

  function lstr(v) {
    return (v === undefined || v === null) ? '' : String(v);
  }

  // ----- keep clip -------------------------------------------------------
  //
  // mapTracked(fn) runs an operation and, when it moved pads to other keys of the
  // (same) current slot, remembers the key mapping old key -> new key. With Keep
  // clip on, the notes of the current clip are rewritten with that mapping so the
  // same pads still play. Only the outermost call acts (loads and edits nest).

  function mapTracked(fn) {
    var slot, before, after, mapping;
    if (mapDepth > 0 || !model) { fn(); return; }
    slot = model.currentSlot();
    before = model.getSlotKeys().slice();
    mapDepth++;
    try {
      fn();
    } finally {
      mapDepth--;
    }
    if (model.currentSlot() !== slot) { return; }   // slot switching is not a map change
    after = model.getSlotKeys();
    mapping = Remap.keyMapping(before, after);
    if (!Remap.changedCount(mapping)) { return; }
    lastMapping = { map: mapping, applied: '' };
    if (model.globals().keepClip) { remapClip(false); }
  }

  // The MIDI clip to rewrite: the detail clip when it is a MIDI clip on this
  // device's track, else the clip playing on that track. null when there is none.
  function findTargetClip() {
    var track = openApi('this_device canonical_parent');
    var clip, owner, idx;
    if (!isValidApi(track)) { return null; }
    clip = openApi('live_set view detail_clip');
    if (isValidApi(clip) && toBool(first(clip.get('is_midi_clip')))) {
      owner = openApi('live_set view detail_clip canonical_parent canonical_parent');
      if (isValidApi(owner) && String(owner.id) === String(track.id)) { return clip; }
    }
    idx = toInt(first(track.get('playing_slot_index')), -1);
    if (idx >= 0) {
      clip = openApi('this_device canonical_parent clip_slots ' + idx + ' clip');
      if (isValidApi(clip) && toBool(first(clip.get('is_midi_clip')))) { return clip; }
    }
    return null;
  }

  function readNotes(clip, len) {
    var raw = clip.call('get_notes_extended', 0, 128, 0, len);
    var text = (typeof raw === 'string') ? raw : ((raw && typeof raw.length === 'number') ? toArray(raw).join(' ') : String(raw));
    return JSON.parse(text);
  }

  // True when every note of `changed` now has its new pitch in the clip.
  function notesApplied(clip, changed, len) {
    var now = readNotes(clip, len);
    var byId = {};
    var i;
    var list = (now && now.notes) ? now.notes : [];
    for (i = 0; i < list.length; i++) { byId[list[i].note_id] = list[i].pitch; }
    for (i = 0; i < changed.notes.length; i++) {
      if (byId[changed.notes[i].note_id] !== changed.notes[i].pitch) { return false; }
    }
    return true;
  }

  // apply_note_modifications takes a dictionary. The notes are passed as a JS
  // object; if the clip does not show the new pitches afterwards (or the call
  // throws) the same modification is sent again as a JSON string. Applying it twice
  // is harmless: the modification sets absolute pitches by note_id.
  function applyNoteModifications(clip, changed, len) {
    var ok = false;
    try {
      clip.call('apply_note_modifications', changed);
      ok = notesApplied(clip, changed, len);
    } catch (e) {
      ok = false;
    }
    if (!ok) { clip.call('apply_note_modifications', JSON.stringify(changed)); }
  }

  // -> { error } | { skipped } | { count, key }
  function rewriteClip(mapping) {
    var clip = findTargetClip();
    var key, len, changed;
    if (!clip) { return { error: 'no MIDI clip on this track' }; }
    key = String(clip.id);
    if (lastMapping && lastMapping.map === mapping && lastMapping.applied === key) { return { skipped: true }; }
    len = num(first(clip.get('length')), 0);
    if (!(len > 0)) { return { error: 'the clip is empty' }; }
    changed = Remap.remapNotes(readNotes(clip, len), mapping, function (k) { return model.isModKey(k); });
    if (changed.notes.length) { applyNoteModifications(clip, changed, len); }
    return { count: changed.notes.length, key: key };
  }

  // Applies lastMapping to the current clip. manual = true for `kit remapclip`.
  function remapClip(manual) {
    var res = null;
    if (!lastMapping || !Remap.changedCount(lastMapping.map)) {
      if (manual) { setStatus('No map change to apply yet'); }
      return;
    }
    if (!host.LiveAPI) {
      setStatus('Keep clip needs the Live API');
      return;
    }
    try {
      res = rewriteClip(lastMapping.map);
    } catch (e) {
      log('could not remap the clip: ' + errText(e));
      setStatus('Clip remap failed (see the Max console)');
      return;
    } finally {
      freeTemps();
    }
    if (res.error) {
      setStatus('Keep clip: ' + res.error);
    } else if (res.skipped) {
      setStatus('Clip already remapped');
    } else {
      lastMapping.applied = res.key;
      setStatus('Clip remapped: ' + res.count + (res.count === 1 ? ' note' : ' notes'));
    }
  }

  // ----- capture ---------------------------------------------------------

  // captureFolder setting, else the device's folder, else the first sample's folder.
  function captureFolderPath() {
    var f = model.globals().captureFolder;
    var list, i, p;
    if (f) { return String(f); }
    p = (typeof host.patcherPath === 'function') ? host.patcherPath() : '';
    if (p) {
      f = dirname(p);
      if (f) { return f; }
    }
    list = srcList();
    for (i = 0; i < list.length; i++) {
      if (list[i].path) {
        f = dirname(list[i].path);
        if (f) { return f; }
      }
    }
    return '';
  }

  function peekArray(buf, ch, pos, n) {
    var r = buf.peek(ch, pos, n);
    if (typeof r === 'number') { return [r]; }
    return r ? toArray(r) : [];
  }

  function flushCaptureQueue() {
    var q = captureQueue;
    var i;
    captureQueue = [];
    for (i = 0; i < q.length; i++) { addSourceFromPath(q[i]); }
    afterEdit();
  }

  function queueCaptureLoad(path) {
    captureQueue.push(path);
    if (!captureTask) { captureTask = newTask(flushCaptureQueue, 'capture load'); }
    if (!captureTask) { flushCaptureQueue(); return; }
    captureTask.schedule(CAPTURE_LOAD_MS);
  }

  // Copies the last N frames of the ring (wrapping at the write position) into the
  // staging buffer, writes it as a .wav and loads it like a dropped sample.
  function doCapture() {
    var g = model.globals();
    var barsIdx = indexOfValue(CONST.CAPTURE_BARS, g.captureBars, 2);
    var ring = null;
    var wpb = null;
    var stage = null;
    var folder, ringFrames, lengthMs, sr, wp, bpm, n, ringCh, stageCh, segs, c, k, pos, cnt, dst, r, i, v, peak;
    var base, name, path;

    if (!host.Buffer) { setStatus('Capture is not available'); return; }
    folder = captureFolderPath();
    if (!folder) { setStatus('Choose a capture folder'); return; }

    try {
      ring = new host.Buffer(capName);
      wpb = new host.Buffer(capWpName);
      stage = new host.Buffer(capOutName);

      ringFrames = ring.framecount();
      if (!(ringFrames > 1)) { setStatus('Nothing captured yet (no recorder buffer)'); return; }
      lengthMs = ring.length();
      sr = (typeof lengthMs === 'number' && lengthMs > 0) ? ringFrames / (lengthMs / 1000) : 0;
      sr = sr > 1000 ? Math.round(sr) : 44100;
      wp = wpb.peek(1, 0, 1);
      if (typeof wp !== 'number') { wp = first(wp); }
      wp = Math.round(num(wp, 0));
      wp = ((wp % ringFrames) + ringFrames) % ringFrames;
      bpm = transport.bpm > 0 ? transport.bpm : 120;
      n = Math.min(Math.round(CONST.CAPTURE_BEATS[barsIdx] * 60 / bpm * sr), ringFrames - 1);
      if (n < 1) { setStatus('Nothing captured yet'); return; }

      stageCh = Math.max(0, toInt(stage.channelcount(), 0));
      if (!stageCh) { setStatus('Capture staging buffer not found'); return; }
      stage.send('sizeinsamps', n);
      if (stage.framecount() !== n) { log('staging buffer has ' + stage.framecount() + ' frames, expected ' + n); }
      ringCh = Math.max(1, toInt(ring.channelcount(), 1));

      // [wp - n, wp) of the ring, oldest first; wraps once when wp < n.
      if (wp - n >= 0) {
        segs = [[wp - n, n]];
      } else {
        segs = [[ringFrames + wp - n, n - wp]];
        if (wp > 0) { segs.push([0, wp]); }
      }
      peak = 0;
      for (c = 1; c <= stageCh; c++) {
        dst = 0;
        for (k = 0; k < segs.length; k++) {
          for (pos = 0; pos < segs[k][1]; pos += PEEK_CHUNK) {
            cnt = Math.min(PEEK_CHUNK, segs[k][1] - pos);
            r = peekArray(ring, Math.min(c, ringCh), segs[k][0] + pos, cnt);
            for (i = 0; i < r.length; i++) {
              v = r[i] < 0 ? -r[i] : r[i];
              if (v > peak) { peak = v; }
            }
            stage.poke(c, dst, r);
            dst += cnt;
          }
        }
      }
      if (!(peak > 0)) { setStatus('Nothing captured yet: play something first'); return; }

      base = 'SliceKit Capture ' + timestamp(nowFn());
      if (base === lastCaptureName) {
        lastCaptureRepeat++;
        name = base + '-' + (lastCaptureRepeat + 1) + '.wav';
      } else {
        lastCaptureName = base;
        lastCaptureRepeat = 0;
        name = base + '.wav';
      }
      path = stripSlash(folder) + '/' + name;
      stage.send('writewave', path);
      queueCaptureLoad(path);
      setStatus('Captured ' + CONST.CAPTURE_BARS[barsIdx] + ' → ' + name);
    } finally {
      if (ring && typeof ring.freepeer === 'function') { ring.freepeer(); }
      if (wpb && typeof wpb.freepeer === 'function') { wpb.freepeer(); }
      if (stage && typeof stage.freepeer === 'function') { stage.freepeer(); }
    }
  }

  // ----- Simpler import --------------------------------------------------

  // Walks live_set tracks (and one level of rack chains) for OriginalSimpler devices
  // and fills the sk_simplers menu through outlet 2 (raw `clear` / `append <item>`).
  function scanSimplers() {
    var found = [];
    var api, nTracks, t, tp, tname, nDev, d, dp, nCh, c, cp, cname, nChDev, j, jp, i;

    function at(path) { api.path = path; return api; }
    function isSimpler(path) { return lstr(first(at(path).get('class_name'))) === SIMPLER_CLASS; }

    if (!host.LiveAPI) { setStatus('Live API not available'); return; }
    try {
      api = openApi('live_set');
      nTracks = toInt(at('live_set').getcount('tracks'), 0);
      for (t = 0; t < nTracks; t++) {
        tp = 'live_set tracks ' + t;
        tname = lstr(first(at(tp).get('name')));
        nDev = toInt(api.getcount('devices'), 0);
        for (d = 0; d < nDev; d++) {
          dp = tp + ' devices ' + d;
          if (isSimpler(dp)) {
            found.push({ path: dp, label: tname + ' / ' + lstr(first(api.get('name'))) });
          } else if (toBool(first(api.get('can_have_chains')))) {
            nCh = toInt(api.getcount('chains'), 0);
            for (c = 0; c < nCh; c++) {
              cp = dp + ' chains ' + c;
              cname = lstr(first(at(cp).get('name')));
              nChDev = toInt(api.getcount('devices'), 0);
              for (j = 0; j < nChDev; j++) {
                jp = cp + ' devices ' + j;
                if (isSimpler(jp)) {
                  found.push({ path: jp, label: tname + ' / ' + cname + ' / ' + lstr(first(api.get('name'))) });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      log('Simpler scan failed: ' + errText(e));
      setStatus('Simpler scan failed (see the Max console)');
      return;
    } finally {
      freeTemps();
    }
    simplers = found;
    out(2, 'src_simplers', 'clear');
    for (i = 0; i < found.length; i++) { out(2, 'src_simplers', 'append', found[i].label); }
    setStatus(found.length ? 'Found ' + found.length + ' Simpler' + (found.length === 1 ? '' : 's')
      : 'No Simplers found in the Live Set');
  }

  // Adds the Simpler's sample as a source. Its slice points become manual slices
  // once the buffer has loaded (see importSlices); its slicing playback mode sets
  // the source's play mode.
  function importSimpler(index) {
    var entry = (index >= 0 && index < simplers.length) ? simplers[index] : null;
    var file = '';
    var pts = [];
    var mode = 1;
    var sample, dev, raw, i, v, src;

    if (!entry) { setStatus('Press "Find Simplers", then pick one'); return; }
    if (!host.LiveAPI) { setStatus('Live API not available'); return; }
    try {
      sample = openApi(entry.path + ' sample');
      if (isValidApi(sample)) {
        file = lstr(first(sample.get('file_path')));
        raw = sample.get('slices');
        raw = (raw !== null && raw !== undefined && typeof raw === 'object' && typeof raw.length === 'number') ? raw : [raw];
        for (i = 0; i < raw.length; i++) {
          v = num(raw[i], -1);
          if (v > 0) { pts.push(Math.round(v)); }
        }
      }
      dev = openApi(entry.path);
      mode = toInt(first(dev.get('slicing_playback_mode')), 1);
    } catch (e) {
      log('could not read the Simpler: ' + errText(e));
      setStatus('Could not read the Simpler (rescan?)');
      return;
    } finally {
      freeTemps();
    }
    if (!file) { setStatus('That Simpler has no sample'); return; }
    src = addSourceFromPath(file, { importPoints: pts, playMode: PLAY_MODES[clampInt(mode, 0, 2)] });
    if (src) {
      setStatus('Importing ' + src.name + (pts.length ? ' (' + pts.length + ' slice points) ...' : ' ...'));
    }
  }

  // ----- message handlers ------------------------------------------------

  function doInit() {
    var obj = null;
    var restored = null;
    var list, i, src, key;

    try { obj = readState(); } catch (e) { log('could not read state dict: ' + errText(e)); }

    if (engine && engine.activeKeys().length) { sendCommands(engine.panic()); }
    stopPoller();
    stopTicker();
    gestHeld = [];
    lastMapping = null;
    pending = {};
    monoCache = {};
    overviewCache = {};
    waveCache = {};
    featCache = {};
    lastFb = {};
    armed = '';
    lastEdited = '';
    lastEditedMorph = '';
    sel.source = -1;
    sel.key = -1;
    sel.slice = -1;
    selPadSig = '';

    if (obj) {
      try {
        restored = Model.fromJSON(normalizeState(obj));
      } catch (e2) {
        log('could not restore state: ' + errText(e2));
        restored = null;
      }
    }
    attachModel(restored || Model.create());
    initialized = true;

    list = srcList();
    for (i = 0; i < list.length; i++) {
      src = list[i];
      if (src.path) {
        requestLoad(src.slot, src.path, 'restore');
      }
    }

    // Live's automation / recall wins over the dict.
    applyCachedAutoParams();

    if (list.length) {
      sel.source = 0;
      key = model.occupiedKeys()[0];
      if (key === undefined) { key = -1; }
      sel.key = key;
      selPadSig = padSig(curPad());
      if (curPad()) { followPad(curPad()); }
      setStatus('Restoring ' + list.length + ' sample' + (list.length === 1 ? '' : 's') + ' ...');
    } else {
      setStatus('Drop samples to start');
    }
    reconcileSelection();

    startLive();
    // Tell the recorder (gen~) which buffers to use.
    out(4, 'cap', capName);
    out(4, 'wpb', capWpName);
    out(3, 'viewdict', viewName);
    forceFb = false;
    syncFeedback(true);
    writeView();
  }

  function onDrop(a) {
    var i;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== undefined && a[i] !== null && String(a[i]) !== '') { addSourceFromPath(a[i]); }
    }
  }

  function onLoaded(a) {
    var slot = toInt(a[0], -1);
    if (slot < 0 || !pending[slot]) { return; }
    finishLoadTracked(slot);
  }

  function onNote(a) {
    var key = toInt(a[0], -1);
    var vel = toInt(a[1], 0);
    if (key < 0 || key > 127) { return; }
    playKey(key, vel);
  }

  function onPolyPressure(a) {
    var key = toInt(a[0], -1);
    if (key < 0 || key > 127) { return; }
    sendCommands(engine.polyPressure(key, clamp(num(a[1], 0), 0, 127)));
  }

  function onPressure(a) {
    sendCommands(engine.pressure(clamp(num(a[0], 0), 0, 127)));
  }

  function onVoiceEnd(a) {
    var v = toInt(a[0], 0) - 1;
    if (v < 0) { return; }
    sendCommands(engine.voiceEnded(v));
    viewDeb.trigger();
  }

  function onSource(a) {
    var p = String(a[0]);
    var v = a[1];
    var src = curSource();
    var mode, set;

    // These two do not need a selected sample.
    if (p === 'simplerscan') { scanSimplers(); return; }
    if (p === 'fromsimpler') { importSimpler(toInt(v, -1)); return; }

    if (!src) { forceFb = true; setStatus('Select a sample first'); return; }

    function reslice() {
      var n = resliceSource(src.id);
      if (n >= 0) { setStatus(src.name + ': ' + n + ' slices'); }
      else { setStatus(src.name + ' is not loaded yet'); }
      forceFb = true;
    }

    // Updates a slicing setting and reslices (not in manual mode, where the
    // points are edited by hand and a reslice would throw them away).
    function slicingParam(patch) {
      model.setSourceSettings(src.id, patch);
      if (model.getSource(src.id).slicing.mode !== 'manual') { reslice(); }
    }

    switch (p) {
      case 'playmode':
        model.setSourceSettings(src.id, { playMode: PLAY_MODES[clampInt(v, 0, 2)] });
        break;
      case 'trigmode':
        model.setSourceSettings(src.id, { trigMode: TRIG_MODES[clampInt(v, 0, 1)] });
        break;
      case 'slicemode':
        mode = SLICE_MODES[clampInt(v, 0, 3)];
        set = { mode: mode };
        slicingParam(set);
        break;
      case 'sensitivity':
        slicingParam({ sensitivity: clamp(num(v, 50), 0, 100) });
        break;
      case 'beatdiv':
        slicingParam({ beatDiv: CONST.BEAT_DIVS[clampInt(v, 0, CONST.BEAT_DIVS.length - 1)] });
        break;
      case 'regions':
        slicingParam({ regions: clampInt(v, 2, 128) });
        break;
      case 'bpm':
        slicingParam({ bpm: clamp(num(v, 0), 0, 400) });
        break;
      case 'minslice':
        slicingParam({ minSliceMs: clamp(num(v, 30), 1, 2000) });
        break;
      case 'snap':
        slicingParam({ snap: toBool(v) });
        break;
      case 'reslice':
        if (src.slicing.mode === 'manual') {
          setStatus('Manual mode: edit the slice points on the waveform');
        } else {
          reslice();
        }
        break;
      case 'remove':
        removeSourceNow(src);
        setStatus('Removed ' + src.name);
        selPadSig = '';
        forceFb = true;
        break;
      default:
        unknown('source ' + p);
    }
  }

  function onPad(a) {
    var p = String(a[0]);
    var v = a[1];
    var pad, spec, dir, keys, n, value;

    // Settings that do not need a selected pad.
    switch (p) {
      case 'layerarm':
        armed = toBool(v) ? 'layer' : (armed === 'layer' ? '' : armed);
        if (armed === 'layer' && sel.key < 0) { armed = ''; setStatus('Select a pad first'); }
        forceFb = true;
        return;
      case 'duparm':
        armed = toBool(v) ? 'dup' : (armed === 'dup' ? '' : armed);
        if (armed === 'dup' && sel.key < 0) { armed = ''; setStatus('Select a pad first'); }
        forceFb = true;
        return;
      case 'spreadparam':
        model.setGlobal('spreadParam', SPREAD_PARAMS[clampInt(v, 0, SPREAD_PARAMS.length - 1)]);
        return;
      case 'spreadcount':
        model.setGlobal('spreadCount', clampInt(v, 2, 16));
        return;
      case 'spreadstep':
        model.setGlobal('spreadStep', clamp(num(v, 1), -24, 24));
        return;
    }

    if (sel.key < 0) { forceFb = true; setStatus('Select a key first'); return; }
    pad = curPad();

    switch (p) {
      case 'lock':
        model.setLock(sel.key, toBool(v));
        return;
      case 'similar':
        if (!pad) { forceFb = true; return; }
        dir = num(v, 1) < 0 ? -1 : 1;
        model.swapSimilar(sel.key, dir);
        return;
      case 'spread':
        if (!pad) { setStatus('Select a pad to spread'); return; }
        keys = model.spread(sel.key, model.globals().spreadParam, model.globals().spreadCount,
          model.globals().spreadStep);
        n = keys ? keys.length : 0;
        setStatus('Spread ' + model.globals().spreadParam + ': ' + n + ' keys');
        return;
      case 'applysource':
        if (!pad) { return; }
        if (model.globals().morphEdit) {
          if (!lastEditedMorph) { setStatus('Edit a B parameter first'); return; }
          // The model copies B values only; a pad without a B value for this param
          // shows its A value, so make that the B value first ("-> Sample" copies what is shown).
          if (!pad.morph || !has(pad.morph, lastEditedMorph)) {
            model.setPadMorphParam(pad.id, lastEditedMorph, pad[lastEditedMorph]);
          }
          model.applyMorphParamToSource(pad.id, lastEditedMorph);
          sendCommands(engine.refreshMorph());
          setStatus('Applied B ' + lastEditedMorph + ' to the whole sample');
          return;
        }
        if (!lastEdited) { setStatus('Edit a pad parameter first'); return; }
        model.applyParamToSource(pad.id, lastEdited);
        setStatus('Applied ' + lastEdited + ' to the whole sample');
        return;
      case 'clear':
        model.clearKey(sel.key);
        return;
      case 'morphcopy':
        if (!pad) { forceFb = true; return; }
        model.copyPadToMorph(pad.id);
        sendCommands(engine.refreshMorph());
        forceFb = true;
        return;
      case 'morphclear':
        if (!pad) { forceFb = true; return; }
        model.clearPadMorph(pad.id);
        sendCommands(engine.refreshMorph());
        forceFb = true;
        return;
    }

    spec = has(PAD_PARAMS, p) ? PAD_PARAMS[p] : null;
    if (!spec) { unknown('pad ' + p); return; }
    if (!pad) { forceFb = true; return; }
    value = spec.bool ? toBool(v) : num(v, 0) * (spec.scale || 1);
    if (model.globals().morphEdit) {
      // Morph edit: the control writes the B value.
      model.setPadMorphParam(pad.id, spec.field, value);
      lastEditedMorph = spec.field;
      if (model.globals().morph > 0) { sendCommands(engine.refreshMorph()); }
    } else {
      model.setPadParam(pad.id, spec.field, value);
      lastEdited = spec.field;
    }
  }

  function onKit(a) {
    var p = String(a[0]);
    var v = a[1];
    var g = model.globals();
    var res, src, seed, n;

    if (AUTO_PARAMS.indexOf(p) >= 0) {
      autoParams[p] = v;
      applyKitParam(p, v);
      return;
    }

    switch (p) {
      case 'copyslot':
        model.copySlot(model.currentSlot(), clampInt(v, 0, CONST.NUM_SLOTS - 1));
        break;
      case 'layout':
        model.setGlobal('layout', LAYOUTS[clampInt(v, 0, 2)]);
        break;
      case 'zonealign':
        model.setGlobal('zoneAlign', toBool(v));
        break;
      case 'sortby':
        model.setGlobal('sortBy', SORT_BYS[clampInt(v, 0, 2)]);
        break;
      case 'root':
        model.setGlobal('rootKey', clampInt(v, 0, 127));
        break;
      case 'relayout':
        res = model.applyLayout(model.currentSlot());
        setStatus('Layout: ' + res.placed + ' keys' + (res.dropped ? ', ' + res.dropped + ' dropped' : ''));
        break;
      case 'shuffle':
        src = curSource();
        seed = g.seed;
        res = model.shuffle({
          mode: g.shuffleMode,
          scope: (g.shuffleScope === 'source' && !src) ? 'all' : g.shuffleScope,
          sourceId: src ? src.id : null,
          seed: seed,
          flipPct: g.flipPct
        });
        model.setGlobal('seed', (toInt(seed, 1) + 1) % 10000);
        setStatus('Shuffled (seed ' + seed + '): ' + (res ? res.moved : 0) + ' keys');
        break;
      case 'shufflemode':
        model.setGlobal('shuffleMode', SHUFFLE_MODES[clampInt(v, 0, 1)]);
        break;
      case 'shufflescope':
        model.setGlobal('shuffleScope', SHUFFLE_SCOPES[clampInt(v, 0, 1)]);
        break;
      case 'seed':
        model.setGlobal('seed', clampInt(v, 0, 9999));
        break;
      case 'flip':
        model.setGlobal('flipPct', clamp(num(v, 0), 0, 100));
        break;
      case 'undo':
        if (model.canUndo()) { model.undo(); setStatus('Undo'); } else { setStatus('Nothing to undo'); }
        forceFb = true;
        break;
      case 'redo':
        if (model.canRedo()) { model.redo(); setStatus('Redo'); } else { setStatus('Nothing to redo'); }
        forceFb = true;
        break;
      case 'bestn':
        model.setGlobal('bestN', clampInt(v, 1, 128));
        break;
      case 'findbest':
        res = model.findBest(g.bestN);
        setStatus('Find best: ' + (res ? res.placed : 0) + ' slices');
        break;
      case 'chokescope':
        model.setGlobal('chokeScope', CHOKE_SCOPES[clampInt(v, 0, 1)]);
        break;
      case 'modzone':
        model.setGlobal('modZoneOn', toBool(v));
        break;
      case 'modstart':
        model.setGlobal('modZoneStart', clampInt(v, 0, 112));
        break;
      case 'velsens':
        model.setGlobal('velSens', clamp(num(v, 50), 0, 100));
        break;
      case 'pressure2level':
        model.setGlobal('pressureToLevel', toBool(v));
        break;
      case 'panic':
        sendCommands(engine.panic());
        updateTicker();
        break;
      case 'morphedit':
        model.setGlobal('morphEdit', toBool(v));
        forceFb = true;   // the pad controls now show the other set of values
        break;
      case 'morphcopyall':
        n = model.copyAllToMorph();
        sendCommands(engine.refreshMorph());
        forceFb = true;
        setStatus('Copied A to B on ' + n + ' pads');
        break;
      case 'morphclearall':
        n = model.clearAllMorph();
        sendCommands(engine.refreshMorph());
        forceFb = true;
        setStatus('Cleared B on ' + n + ' pads');
        break;
      case 'capture':
        doCapture();
        break;
      case 'capturebars':
        model.setGlobal('captureBars', CONST.CAPTURE_BARS[clampInt(v, 0, CONST.CAPTURE_BARS.length - 1)]);
        break;
      case 'capturefolder':
        // an empty path (cancelled dialog) keeps the current folder
        res = stripSlash(a.slice(1).join(' '));
        if (res) {
          model.setGlobal('captureFolder', res);
          setStatus('Capture folder: ' + res);
        }
        break;
      case 'keepclip':
        model.setGlobal('keepClip', toBool(v));
        setStatus(toBool(v) ? 'Keep clip on: map changes rewrite the clip' : 'Keep clip off');
        break;
      case 'remapclip':
        remapClip(true);
        break;
      default:
        unknown('kit ' + p);
    }
  }

  // gest sel <0..3> | gest <param> <value> (edits the selected gesture)
  function onGest(a) {
    var p = String(a[0]);
    var v = a[1];
    var g = model.globals();
    var spec, value, idx;

    if (p === 'sel') {
      model.setGlobal('gestureSel', clampInt(v, 0, 3));
      forceFb = true;   // all gest_* controls now show the newly selected gesture
      return;
    }
    spec = has(GEST_PARAMS, p) ? GEST_PARAMS[p] : null;
    if (!spec) { unknown('gest ' + p); return; }
    if (spec.kind === 'beats') {
      idx = clampInt(v, 0, CONST.GEST_BEATS.length - 1);
      value = CONST.GEST_BEATS[idx];   // the value, never the index: 1 and 2 are valid beat counts
    } else if (spec.kind === 'rate') {
      value = CONST.GEST_RATES[clampInt(v, 0, CONST.GEST_RATES.length - 1)];
    } else {
      value = num(v, 0) * (spec.scale || 1);
    }
    model.setGestureParam(g.gestureSel, spec.field, value);
    forceFb = true;   // snap the control back if the model clamped the value
  }

  // Slice-edit units: the jsui sends frames. A value strictly between 0 and 1
  // is read as a normalized position as a courtesy.
  function toFrame(v, src) {
    var n = num(v, -1);
    if (n > 0 && n < 1) { return Math.round(n * src.frames); }
    return Math.round(n);
  }

  function afterSliceEdit(src, frameForSelect) {
    var s, i;
    recomputeFeatures(src.id);
    s = model.getSource(src.id);
    if (frameForSelect !== undefined) {
      for (i = 0; i < s.slices.length; i++) {
        if (frameForSelect >= s.slices[i].start && frameForSelect < s.slices[i].end) { sel.slice = i; break; }
      }
    }
    forceFb = true;
  }

  function onUi(a) {
    var action = String(a[0]);
    var src = curSource();
    var k, i, frame, n, slices, other, pad, res, slotKeys, padId, target;

    switch (action) {
      case 'selectsource':
        i = toInt(a[1], -1);
        if (i >= 0 && i < srcList().length) {
          sel.source = i;
          sel.slice = srcList()[i].slices.length ? 0 : -1;
          forceFb = true;
        }
        return;
      case 'selectkey':
        k = toInt(a[1], -1);
        if (k < 0 || k > 127) { return; }
        if (armed && sel.key >= 0 && sel.key !== k) {
          if (armed === 'layer') {
            res = model.toggleLayer(sel.key, k);
            setStatus(res ? 'Layered key ' + k : 'Removed layer on key ' + k);
            armed = '';
            forceFb = true;
          } else {
            pad = model.duplicatePad(sel.key, k);
            setStatus(pad ? 'Duplicated to key ' + k : 'Could not duplicate');
            armed = '';
            selectKey(k);
          }
          return;
        }
        armed = '';
        selectKey(k);
        return;
      case 'audition':
        k = toInt(a[1], -1);
        if (k >= 0 && k <= 127) { playKey(k, clampInt(a[2], 1, 127)); }
        return;
      case 'auditionoff':
        k = toInt(a[1], -1);
        if (k >= 0 && k <= 127) { playKey(k, 0); }
        return;
      case 'selectslice':
        if (!src) { return; }
        i = toInt(a[1], -1);
        if (i < 0 || i >= src.slices.length) { return; }
        sel.slice = i;
        // Select the key that plays this slice (prefer the base pad).
        slotKeys = model.getSlotKeys();
        target = -1;
        for (k = 0; k < slotKeys.length; k++) {
          padId = slotKeys[k];
          if (padId === null || padId === undefined) { continue; }
          pad = model.getPad(padId);
          if (pad && pad.sliceId === src.slices[i].id) {
            if (target < 0 || pad.base) { target = k; }
            if (pad.base) { break; }
          }
        }
        if (target >= 0) {
          sel.key = target;
          selPadSig = padSig(curPad());
        }
        forceFb = true;
        return;
      case 'addslice':
        if (!src) { return; }
        frame = toFrame(a[1], src);
        model.addSlicePoint(src.id, frame);
        afterSliceEdit(src, frame);
        return;
      case 'moveslice':
        if (!src) { return; }
        i = toInt(a[1], -1);
        frame = toFrame(a[2], src);
        model.moveSlicePoint(src.id, i, frame);
        afterSliceEdit(src, frame);
        return;
      case 'removeslice':
        if (!src) { return; }
        i = toInt(a[1], -1);
        model.removeSlicePoint(src.id, i);
        afterSliceEdit(src);
        return;
      case 'lock':
        k = toInt(a[1], -1);
        if (k >= 0 && k <= 127) { model.toggleLock(k); }
        return;
      default:
        unknown('ui ' + action);
    }
  }

  function unknown(what) {
    if (!has(warned, what)) {
      warned[what] = true;
      log('unknown message: ' + what);
    }
  }

  var handlers = {
    init: function () { doInit(); },
    drop: onDrop,
    load: onDrop,
    loaded: onLoaded,
    note: onNote,
    polypressure: onPolyPressure,
    pressure: onPressure,
    voiceend: onVoiceEnd,
    source: onSource,
    pad: onPad,
    kit: onKit,
    gest: onGest,
    ui: onUi,
    loadbang: function () { /* the patch sends `init` from live.thisdevice */ },
    bang: function () { if (viewDeb && model) { viewDeb.cancel(); writeView(); } },
    msg_int: function () { },
    msg_float: function () { },
    list: function () { }
  };

  // ----- public API ------------------------------------------------------

  self.dispatch = function (name, a) {
    var h;
    name = String(name);
    a = a || [];
    try {
      if (!has(handlers, name)) {
        unknown(name);
        return;
      }
      h = handlers[name];
      if (has(MAP_MESSAGES, name) && model) {
        mapTracked(function () { h(a); });
      } else {
        h(a);
      }
      if (!has(REALTIME, name) && model) { afterEdit(); }
    } catch (e) {
      log('error handling "' + name + '": ' + errText(e));
    }
  };

  self.cleanup = function () {
    var i;
    try {
      if (saveDeb) { saveDeb.flush(); }
    } catch (e) { log('could not save on delete: ' + errText(e)); }
    for (i = 0; i < tasks.length; i++) {
      try {
        tasks[i].cancel();
        if (typeof tasks[i].freepeer === 'function') { tasks[i].freepeer(); }
      } catch (e2) { /* ignore */ }
    }
    tasks = [];
    for (i = 0; i < liveObjs.length; i++) {
      try { if (typeof liveObjs[i].freepeer === 'function') { liveObjs[i].freepeer(); } } catch (e3) { /* ignore */ }
    }
    liveObjs = [];
    freeTemps();
    tickRunning = false;
    pending = {};
  };

  // Internals for tests and debugging.
  self.debug = function () {
    return {
      model: model, engine: engine, sel: sel, armed: armed, lastEdited: lastEdited,
      autoParams: autoParams, monoCache: monoCache, pending: pending, status: status,
      simplers: simplers, lastMapping: lastMapping, gestHeld: gestHeld, tickRunning: tickRunning,
      names: { prefix: prefix, state: stateName, view: viewName, cap: capName, capwp: capWpName, capout: capOutName }
    };
  };

  // ----- start -----------------------------------------------------------

  saveDeb = makeDeferred(saveState, SAVE_MS, false, 'state save');
  viewDeb = makeDeferred(writeView, VIEW_MS, true, 'view refresh');
  attachModel(Model.create());
  return self;
}

// ---------------------------------------------------------------------------
// Singleton used by the Max entry points
// ---------------------------------------------------------------------------

var instance = null;

function getInstance() {
  if (!instance) { instance = create(hostFromGlobals()); }
  return instance;
}

function dispatch(name, a) {
  var g;
  try {
    g = getInstance();
  } catch (e) {
    if (typeof post !== 'undefined') { post('SliceKit: could not start: ' + errText(e) + '\n'); }
    return;
  }
  g.dispatch(name, a);
}

function cleanup() {
  if (instance) { instance.cleanup(); }
  instance = null;
}

function debug() {
  return getInstance().debug();
}

module.exports = {
  create: create,
  dispatch: dispatch,
  cleanup: cleanup,
  debug: debug,
  normalizeState: normalizeState
};
