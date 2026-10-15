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
var MAP_MESSAGES = { source: 1, pad: 1, kit: 1, ui: 1, loaded: 1 };

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

  // ----- loading ---------------------------------------------------------

  // Sends `<slot> replace <path>` and starts watching the buffer. The frame
  // count is sampled first: it is what a poll must see change.
  function requestLoad(slot, path, mode) {
    var stale = bufFrames(slot);
    out(1, slot, 'replace', path);
    pending[slot] = { mode: mode, stale: stale, seen: -1, ticks: POLL_TICKS };
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
        finishLoad(toInt(slot, 0));
        continue;
      }
      p.seen = (n > 0 && n !== p.stale) ? n : -1;
      p.ticks--;
      if (p.ticks <= 0) { failLoad(toInt(slot, 0)); }
    }
    if (!Object.keys(pending).length) { stopPoller(); }
    afterEdit();
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
      count = resliceSource(src.id);
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

  function addSourceFromPath(path) {
    var p = String(path);
    var src = model.addSource({ name: basename(p), path: p });
    if (!src) {
      setStatus('16 samples max');
      return;
    }
    requestLoad(src.slot, p, 'new');
    setStatus('Loading ' + src.name + ' ...');
  }

  // ----- feedback --------------------------------------------------------

  function buildFeedback() {
    var list = [];
    var src = curSource();
    var pad = curPad();
    var g = model.globals();
    var sl = src ? src.slicing : null;
    var k;

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
      add('pad_reverse', !!pad.reverse);
      add('pad_pitch', pad.pitch);
      add('pad_fine', pad.fine);
      add('pad_gain', pad.gainDb);
      add('pad_attack', pad.attackMs);
      add('pad_decay', pad.decayMs);
      add('pad_sustain', pad.sustain * 100);
      add('pad_release', pad.releaseMs);
      add('pad_start', pad.startOffsetMs);
      add('pad_loop', !!pad.loopOn);
      add('pad_loopsize', pad.loopSizeMs);
      add('pad_looppos', pad.loopPos * 100);
      add('pad_cutoff', pad.cutoffHz);
      add('pad_drive', pad.drive * 100);
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
    var list, sources, cur, s, i, k, wave, slices, keys, flags, slotKeys, active, pad, ps, f, padId, g;
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
      flags.push(f);
    }
    g = model.globals();
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
      armed: armed
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
      bufferName: bufferName
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
      default:
        return false;
    }
    if (held && g) { sendCommands(engine.refreshHeld()); }
    return true;
  }

  function applyCachedAutoParams() {
    var names = ['slot', 'chaos', 'repeat', 'rate', 'swing', 'alt'];
    var i;
    for (i = 0; i < names.length; i++) {
      if (has(autoParams, names[i])) { applyKitParam(names[i], autoParams[names[i]]); }
    }
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

  // ----- message handlers ------------------------------------------------

  function doInit() {
    var obj = null;
    var restored = null;
    var list, i, src, key;

    try { obj = readState(); } catch (e) { log('could not read state dict: ' + errText(e)); }

    if (engine && engine.activeKeys().length) { sendCommands(engine.panic()); }
    stopPoller();
    pending = {};
    monoCache = {};
    overviewCache = {};
    waveCache = {};
    featCache = {};
    lastFb = {};
    armed = '';
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
    finishLoad(slot);
  }

  function onNote(a) {
    var key = toInt(a[0], -1);
    var vel = toInt(a[1], 0);
    if (key < 0 || key > 127) { return; }
    sendCommands(vel > 0 ? engine.noteOn(key, vel) : engine.noteOff(key));
    viewDeb.trigger();
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
    var pad, spec, dir, keys, n;

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
        if (!lastEdited) { setStatus('Edit a pad parameter first'); return; }
        model.applyParamToSource(pad.id, lastEdited);
        setStatus('Applied ' + lastEdited + ' to the whole sample');
        return;
      case 'clear':
        model.clearKey(sel.key);
        return;
    }

    spec = has(PAD_PARAMS, p) ? PAD_PARAMS[p] : null;
    if (!spec) { unknown('pad ' + p); return; }
    if (!pad) { forceFb = true; return; }
    if (spec.bool) {
      model.setPadParam(pad.id, spec.field, toBool(v));
    } else {
      model.setPadParam(pad.id, spec.field, num(v, 0) * (spec.scale || 1));
    }
    lastEdited = spec.field;
  }

  function onKit(a) {
    var p = String(a[0]);
    var v = a[1];
    var g = model.globals();
    var res, src, seed;

    if (has({ slot: 1, chaos: 1, repeat: 1, rate: 1, swing: 1, alt: 1 }, p)) {
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
        model.setGlobal('modZoneStart', clampInt(v, 0, 116));
        break;
      case 'velsens':
        model.setGlobal('velSens', clamp(num(v, 50), 0, 100));
        break;
      case 'pressure2level':
        model.setGlobal('pressureToLevel', toBool(v));
        break;
      case 'panic':
        sendCommands(engine.panic());
        break;
      default:
        unknown('kit ' + p);
    }
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
        if (k >= 0 && k <= 127) {
          sendCommands(engine.noteOn(k, clampInt(a[2], 1, 127)));
          viewDeb.trigger();
        }
        return;
      case 'auditionoff':
        k = toInt(a[1], -1);
        if (k >= 0 && k <= 127) {
          sendCommands(engine.noteOff(k));
          viewDeb.trigger();
        }
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
      h(a);
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
    pending = {};
  };

  // Internals for tests and debugging.
  self.debug = function () {
    return {
      model: model, engine: engine, sel: sel, armed: armed, lastEdited: lastEdited,
      autoParams: autoParams, monoCache: monoCache, pending: pending, status: status,
      names: { prefix: prefix, state: stateName, view: viewName }
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
