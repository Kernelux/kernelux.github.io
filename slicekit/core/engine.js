'use strict';
/*
 * SliceKit note engine (pure ES5, CommonJS).
 *
 * Turns MIDI-ish events (noteOn / noteOff / pressure / transport) into voice
 * commands for the poly~ voices described in docs/PROTOCOL.md (section Voice):
 *
 *     Command = { voice: <0-based index, or -1 for all voices>,
 *                 params: [[name, value], ...] }
 *
 * The engine never talks to Max. It receives the model instance (it must NOT
 * require('./model')) and only uses these model methods:
 *   getPadOnKey(key), getPad(id), getSlice(id) (with .sourceId), getSource(id),
 *   isModKey(key), modOffset(key), occupiedKeys(), globals(), and, optionally,
 *   effectivePad(padId, m) with m in 0..1 (morph).
 * From globals() it reads (besides the v1 fields) `morph` (0..100), `scan`
 * (0..100) and `gestures` (4 gesture definitions, read again at every tick, so
 * they may be edited while a gesture key is held).
 *
 * v2 features (docs/ARCHITECTURE.md, "v2 additions"):
 *   morph    every pad parameter is read through model.effectivePad(id, morph/100)
 *            (the pad itself when the model has no effectivePad). refreshMorph()
 *            re-sends pitch / amp / cutoff / drive to the sounding voices.
 *   scan     a key plays the pad of a rotated occupied key (applied before
 *            chaos). refreshScan() switches the held main voices to the slice
 *            their key now maps to (no retrigger).
 *   gesture  the mod keys gest:0..3 ramp repeat rate / cutoff / pitch / amp over
 *            a number of beats while held. The host calls tick() on a timer for
 *            as long as needsTick() is true. The clock is injectable (opts.now).
 *
 * Voice bookkeeping (per voice):
 *   busy   the engine believes the voice is allocated / possibly sounding
 *   held   its key is still down
 *   ended  the voice reported silence (voiceEnded) while its key was still down
 *   "sounding" = busy and not ended.
 *   main   the voice plays the pad of the key itself (not one of its layers)
 *
 * Counter params (`trig`, `kill`) are per-voice counters that increment on
 * every send (gen~ reacts to any change); they wrap long before float32
 * precision becomes a problem.
 */

// ---------------------------------------------------------------------------
// Constants (mirrors Model.CONST; defined locally on purpose)
// ---------------------------------------------------------------------------

var REPEAT_DIVS = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64'];
var REPEAT_PER_BEAT = [1, 2, 3, 4, 6, 8, 12, 16];
var MOD_ACTIONS = ['rpt:1/4', 'rpt:1/8', 'rpt:1/8T', 'rpt:1/16', 'rpt:1/16T',
  'rpt:1/32', 'rpt:1/64', 'reverse', 'octdown', 'octup', 'tape', 'chaos',
  'gest:0', 'gest:1', 'gest:2', 'gest:3'];
var GEST_PREFIX = 'gest:';

var DEFAULT_VOICES = 16;
var DEFAULT_BPM = 120;
var COUNTER_WRAP = 1000000;

// tick() only sends cutoff / pitch / amp when they moved by more than this
// (relative for the cutoff, absolute for the others). The comparison is exact
// (EPS_EXACT) at press / release / switch and once a ramp has reached its end,
// so the final and the restored values always land.
var EPS_CUTOFF_REL = 0.005;
var EPS_PITCH = 0.01;
var EPS_AMP = 0.002;
var EPS_EXACT = 1e-9;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(x, fallback) {
  return (typeof x === 'number' && isFinite(x)) ? x : fallback;
}

function clamp(x, lo, hi) {
  return x < lo ? lo : (x > hi ? hi : x);
}

function dbtoa(db) {
  return Math.pow(10, db / 20);
}

function log2(x) {
  return Math.log(x) / Math.LN2;
}

// log2 of every REPEAT_PER_BEAT value, for the gesture rate interpolation
var RPT_LOG2 = (function () {
  var r = [];
  var j;
  for (j = 0; j < REPEAT_PER_BEAT.length; j++) { r.push(log2(REPEAT_PER_BEAT[j])); }
  return r;
}());

/** Velocity curve: (1 - s) + s * (v / 127) ^ 1.5, with s = velSens / 100. */
function velCurve(v, velSens) {
  var s = clamp(num(velSens, 50) / 100, 0, 1);
  var x = clamp(num(v, 0), 0, 127) / 127;
  return (1 - s) + s * Math.pow(x, 1.5);
}

function nextCounter(c) {
  return c >= COUNTER_WRAP ? 1 : c + 1;
}

/** True when `b` is further than `eps` away from `a`. */
function moved(a, b, eps) {
  return Math.abs(b - a) > eps;
}

/** Index into REPEAT_PER_BEAT for a gesture rate ('off' / unknown = -1; number = index into GEST_RATES). */
function gestRateIndex(x) {
  var i;
  if (typeof x === 'number') {
    i = Math.floor(x) - 1;
    return (i >= 0 && i < REPEAT_PER_BEAT.length) ? i : -1;
  }
  return REPEAT_DIVS.indexOf(x);
}

/**
 * Repeats per beat of a gesture at shaped progress u (0..1); 0 = the gesture
 * does not touch the repeat. Both 'off': 0. One 'off': the other one for the
 * whole gesture. Else interpolate log2(repeats per beat) and snap to the
 * nearest REPEAT_PER_BEAT value (nearest in the log2 domain).
 */
function gestRate(def, u) {
  var a = gestRateIndex(def.rateFrom);
  var b = gestRateIndex(def.rateTo);
  var l, j, best, bestD, d;
  if (a < 0 && b < 0) { return 0; }
  if (a < 0) { return REPEAT_PER_BEAT[b]; }
  if (b < 0 || a === b) { return REPEAT_PER_BEAT[a]; }
  l = RPT_LOG2[a] + (RPT_LOG2[b] - RPT_LOG2[a]) * u;
  best = 0;
  bestD = Infinity;
  for (j = 0; j < RPT_LOG2.length; j++) {
    d = Math.abs(RPT_LOG2[j] - l);
    if (d < bestD) { bestD = d; best = j; }
  }
  return REPEAT_PER_BEAT[best];
}

function newVoice(index) {
  return {
    index: index,
    busy: false,
    held: false,
    ended: false,
    main: false,      // plays the key's own pad (not a layer)
    key: -1,          // physical key that started it (even if chaos swapped the pad)
    seq: 0,           // allocation order, for "oldest" decisions
    padId: null,      // pad actually playing (after scan / chaos)
    scanPadId: null,  // pad the key mapped to through scan, before chaos (main voices)
    sourceId: null,
    sliceStart: 0,    // frames
    sliceEnd: 0,
    frames: 0,        // total frames of the source (thru end)
    thru: false,
    dir: 1,           // current playback direction as last sent
    padReverse: false,
    basePitch: 0,     // pad.pitch + pad.fine / 100 (without octave / gesture)
    gainDb: 0,
    level: 1,         // velocity (or pressure) curve value, linear
    padCutoff: 20000, // pad cutoff before the gesture factor
    padDrive: 0,
    sentPitch: 0,     // values last sent to the voice (gesture epsilon test)
    sentAmp: 0,
    sentCutoff: 20000,
    rpt: 0,           // rptdiv last sent
    trigCount: 0,
    killCount: 0,
    jumpCount: 0,     // scan: re-latch the slice and move the playhead now
    redirCount: 0     // reverse modifier: turn around at the current position
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function create(opts) {
  opts = opts || {};
  var model = opts.model;
  if (!model) {
    throw new Error('Engine.create: opts.model is required');
  }
  var numVoices = Math.floor(num(opts.numVoices, DEFAULT_VOICES));
  if (numVoices < 1) { numVoices = DEFAULT_VOICES; }
  var rng = (typeof opts.rng === 'function') ? opts.rng : Math.random;
  var bufferName = (typeof opts.bufferName === 'function') ? opts.bufferName :
    function (slot) { return 'src' + slot; };
  var now = (typeof opts.now === 'function') ? opts.now :
    function () { return Date.now(); };

  var bpm = DEFAULT_BPM;
  var seqCounter = 0;
  var voices = [];
  // Held modifier keys in press order (last entry = most recently pressed).
  // Entries: { key, action, rpt, gest, start } where rpt = repeats per beat
  // (0 = not a repeat mod), gest = gesture index (-1 = not a gesture) and
  // start = clock time (ms) of the press.
  var modHeld = [];
  var i;

  for (i = 0; i < numVoices; i++) {
    voices.push(newVoice(i));
  }

  // ----- modifier state ----------------------------------------------------

  function modState() {
    var st = { rpt: 0, reverse: false, oct: 0, tape: false, chaos: false };
    var j, m;
    for (j = 0; j < modHeld.length; j++) {
      m = modHeld[j];
      if (m.rpt > 0) {
        st.rpt = m.rpt;               // later entries win = most recently pressed
      } else if (m.action === 'reverse') {
        st.reverse = true;
      } else if (m.action === 'octup') {
        st.oct += 1;
      } else if (m.action === 'octdown') {
        st.oct -= 1;
      } else if (m.action === 'tape') {
        st.tape = true;
      } else if (m.action === 'chaos') {
        st.chaos = true;
      }
    }
    return st;
  }

  function findMod(key) {
    var j;
    for (j = 0; j < modHeld.length; j++) {
      if (modHeld[j].key === key) { return j; }
    }
    return -1;
  }

  // ----- gestures ----------------------------------------------------------

  /** The most recently pressed gesture modifier that is still held, or null. */
  function activeGestureMod() {
    var j;
    for (j = modHeld.length - 1; j >= 0; j--) {
      if (modHeld[j].gest >= 0) { return modHeld[j]; }
    }
    return null;
  }

  /**
   * Values of the active gesture at the current clock time, or null when no
   * gesture is held (or its definition is missing):
   *   { index, progress (0..1, unshaped), rate (repeats per beat, 0 = leave the
   *     repeat alone), cut (Hz, gesture cutoff g), pitch (st), amp (factor) }
   * The definition is read from globals().gestures at every call.
   */
  function gestureValues(g) {
    var mod = activeGestureMod();
    var def, beats, dur, t, curve, u, cutFrom, cutTo, pitchFrom, pitchTo, ampFrom, ampTo;
    if (!mod || !g || !g.gestures) { return null; }
    def = g.gestures[mod.gest];
    if (!def) { return null; }
    beats = num(def.beats, 4);
    if (!(beats > 0)) { beats = 4; }
    dur = beats * 60000 / bpm;
    t = clamp((now() - mod.start) / dur, 0, 1);
    curve = clamp(num(def.curve, 0), 0, 1);
    u = Math.pow(t, 1 + 4 * curve);
    cutFrom = clamp(num(def.cutFrom, 20000), 20, 20000);
    cutTo = clamp(num(def.cutTo, 20000), 20, 20000);
    pitchFrom = num(def.pitchFrom, 0);
    pitchTo = num(def.pitchTo, 0);
    ampFrom = num(def.ampFrom, 1);
    ampTo = num(def.ampTo, 1);
    return {
      index: mod.gest,
      progress: t,
      rate: gestRate(def, u),
      cut: cutFrom * Math.pow(cutTo / cutFrom, u),
      pitch: pitchFrom + (pitchTo - pitchFrom) * u,
      amp: Math.max(0, ampFrom + (ampTo - ampFrom) * u)
    };
  }

  /**
   * Repeats per beat: gesture rate > held repeat modifier (latest) > global
   * repeat > 0. `gv` = gestureValues() or null.
   */
  function effectiveRptDiv(st, g, gv) {
    var idx;
    if (gv && gv.rate > 0) { return gv.rate; }
    if (st.rpt > 0) { return st.rpt; }
    if (g && g.repeatOn) {
      idx = REPEAT_DIVS.indexOf(g.repeatDiv);
      return idx >= 0 ? REPEAT_PER_BEAT[idx] : 0;
    }
    return 0;
  }

  function repeatParams(st, g, gv) {
    return [
      ['rptdiv', effectiveRptDiv(st, g, gv)],
      ['rptswing', num(g && g.swing, 0) / 100],
      ['rptalt', (g && g.repeatAlt) ? 1 : 0]
    ];
  }

  // ----- voice value helpers (octave, gesture, level on top of the base) ----

  function voicePitch(v, st, gv) {
    var p = v.basePitch + 12 * st.oct;
    return gv ? p + gv.pitch : p;
  }

  function voiceAmp(v, gv) {
    var a = dbtoa(v.gainDb) * v.level;
    return gv ? a * gv.amp : a;
  }

  /** Pad cutoff, scaled by the gesture's cutoff relative to 20 kHz (clamped 20..20000). */
  function voiceCutoff(v, gv) {
    return gv ? clamp(v.padCutoff * gv.cut / 20000, 20, 20000) : v.padCutoff;
  }

  // ----- pad resolution (morph, scan) ---------------------------------------

  function morphAmount(g) {
    return clamp(num(g && g.morph, 0), 0, 100) / 100;
  }

  /** Pad parameters with the morph applied (the pad itself when the model has no effectivePad). */
  function effectiveById(id) {
    var g, eff;
    if (typeof model.effectivePad === 'function') {
      g = model.globals() || {};
      eff = model.effectivePad(id, morphAmount(g));
      if (eff) { return eff; }
    }
    return model.getPad(id);
  }

  /** Resolve a pad to { pad (effective), padId, source, slice, sourceId } or null when unplayable. */
  function resolveEntry(pad) {
    var slice, source, sid, eff, g;
    if (!pad) { return null; }
    slice = model.getSlice(pad.sliceId);
    if (!slice) { return null; }
    sid = (slice.sourceId !== undefined && slice.sourceId !== null) ? slice.sourceId : pad.sourceId;
    source = model.getSource(sid);
    if (!source) { return null; }
    if (!(num(source.frames, 0) > 0) || !(num(source.sr, 0) > 0)) { return null; }
    eff = pad;
    if (typeof model.effectivePad === 'function') {
      g = model.globals() || {};
      eff = model.effectivePad(pad.id, morphAmount(g)) || pad;
    }
    return { pad: eff, padId: pad.id, source: source, slice: slice, sourceId: sid,
      main: false, scanPadId: null };
  }

  /**
   * The pad that `key` plays through scan (before chaos). With scan > 0 and at
   * least 2 occupied keys, a key k in occ (= occupiedKeys(), ascending) plays
   * the pad on occ[(idx + round(scan/100 * (occ.length - 1))) % occ.length].
   */
  function scanPad(key, g) {
    var pad = model.getPadOnKey(key);
    var scan, occ, idx, shift, other;
    if (!pad) { return null; }
    scan = clamp(num(g && g.scan, 0), 0, 100);
    if (scan > 0) {
      occ = model.occupiedKeys();
      if (occ && occ.length >= 2) {
        idx = occ.indexOf(key);
        if (idx >= 0) {
          shift = Math.round(scan / 100 * (occ.length - 1));
          other = model.getPadOnKey(occ[(idx + shift) % occ.length]);
          if (other) { pad = other; }
        }
      }
    }
    return pad;
  }

  // ----- voices ------------------------------------------------------------

  function isSounding(v) {
    return v.busy && !v.ended;
  }

  function release(v) {
    v.busy = false;
    v.held = false;
    v.ended = false;
    v.main = false;
    v.key = -1;
  }

  function killVoice(v, out) {
    v.killCount = nextCounter(v.killCount);
    release(v);
    out.push({ voice: v.index, params: [['kill', v.killCount]] });
  }

  /**
   * Free voice (lowest index) first; else the oldest non-held voice; else the
   * oldest voice. Voices that reported `ended` while held are NOT free: they
   * are only freed by their noteOff (see voiceEnded).
   */
  function allocate() {
    var j, v, best = null;
    for (j = 0; j < voices.length; j++) {
      if (!voices[j].busy) { return voices[j]; }
    }
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!v.held && (best === null || v.seq < best.seq)) { best = v; }
    }
    if (best !== null) { return best; }
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (best === null || v.seq < best.seq) { best = v; }
    }
    return best;
  }

  // ----- note on -----------------------------------------------------------

  /** Chaos: with probability chaos% play the pad of a random occupied key instead. */
  function applyChaos(pad, st, g) {
    var chaos = st.chaos ? 100 : num(g.chaos, 0);
    var keys, idx, other;
    // rng is only consulted when chaos can fire at all.
    if (chaos > 0 && rng() * 100 < chaos) {
      keys = model.occupiedKeys();
      if (keys && keys.length > 0) {
        idx = Math.floor(rng() * keys.length);
        idx = clamp(idx, 0, keys.length - 1);
        other = model.getPadOnKey(keys[idx]);
        if (other) { return other; }
      }
    }
    return pad;
  }

  /**
   * Choke, applied once per note before any of its voices is allocated.
   * Only mono / thru sources choke; poly notes kill nothing. Scope 'global'
   * kills every busy voice, 'source' only voices of the choking sources.
   * Busy voices include held voices that reported `ended`, because that
   * report may be stale (see voiceEnded) and killing a silent voice is free.
   */
  function choke(entries, g, out) {
    var chokers = [];
    var j, mode, v;
    for (j = 0; j < entries.length; j++) {
      mode = entries[j].source.playMode;
      if ((mode === 'mono' || mode === 'thru') && chokers.indexOf(entries[j].sourceId) < 0) {
        chokers.push(entries[j].sourceId);
      }
    }
    if (chokers.length === 0) { return; }
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!v.busy) { continue; }
      if (g.chokeScope === 'global' || chokers.indexOf(v.sourceId) >= 0) {
        killVoice(v, out);
      }
    }
  }

  /** Playback range of an entry: positions, direction, loop size (frames). */
  function playRange(entry, st) {
    var pad = entry.pad;
    var source = entry.source;
    var slice = entry.slice;
    var sr = source.sr;
    var frames = source.frames;
    var s = slice.start;
    var e = slice.end;
    var len = e - s;
    var thru = source.playMode === 'thru';
    var padReverse = !!pad.reverse;
    var reversed = padReverse !== st.reverse;
    var offset = Math.round(num(pad.startOffsetMs, 0) * sr / 1000);
    var r = { thru: thru, padReverse: padReverse };

    offset = Math.max(0, Math.min(offset, len - 1));
    if (reversed) {
      r.pstart = e - offset;
      r.pend = thru ? 0 : s;
      r.dir = -1;
    } else {
      r.pstart = s + offset;
      r.pend = thru ? frames : e;
      r.dir = 1;
    }
    r.loopsize = Math.max(1, Math.min(num(pad.loopSizeMs, 30) * sr / 1000, len));
    return r;
  }

  /** Copy what the engine needs to know later about the playing pad onto the voice. */
  function trackEntry(v, entry, range) {
    var pad = entry.pad;
    v.padId = entry.padId;
    v.sourceId = entry.sourceId;
    v.sliceStart = entry.slice.start;
    v.sliceEnd = entry.slice.end;
    v.frames = entry.source.frames;
    v.thru = range.thru;
    v.dir = range.dir;
    v.padReverse = range.padReverse;
    v.basePitch = num(pad.pitch, 0) + num(pad.fine, 0) / 100;
    v.gainDb = num(pad.gainDb, 0);
    v.padCutoff = num(pad.cutoffHz, 20000);
    v.padDrive = num(pad.drive, 0);
  }

  /** Full start sequence of a voice; `level` = velocity (or pressure) curve value, linear. */
  function startVoice(v, entry, key, level, st, g, gv) {
    var pad = entry.pad;
    var source = entry.source;
    var range = playRange(entry, st);
    var params, rpt;

    v.busy = true;
    v.held = true;
    v.ended = false;
    v.main = !!entry.main;
    v.key = key;
    seqCounter += 1;
    v.seq = seqCounter;
    v.scanPadId = entry.scanPadId;
    v.level = level;
    trackEntry(v, entry, range);
    v.trigCount = nextCounter(v.trigCount);

    rpt = repeatParams(st, g, gv);
    v.rpt = rpt[0][1];
    v.sentPitch = voicePitch(v, st, gv);
    v.sentAmp = voiceAmp(v, gv);
    v.sentCutoff = voiceCutoff(v, gv);

    // PROTOCOL.md send order: held 1 and trig <n> last.
    params = [
      ['src', bufferName(source.slot)],
      ['bufsr', source.sr],
      ['pstart', range.pstart],
      ['pend', range.pend],
      ['dir', range.dir],
      ['pitch', v.sentPitch],
      ['amp', v.sentAmp],
      ['att', num(pad.attackMs, 0)],
      ['dec', num(pad.decayMs, 300)],
      ['sus', num(pad.sustain, 1)],
      ['rel', num(pad.releaseMs, 30)],
      ['gatemode', source.trigMode === 'gate' ? 1 : 0],
      ['loopon', pad.loopOn ? 1 : 0],
      ['loopsize', range.loopsize],
      ['looppos', num(pad.loopPos, 0)],
      rpt[0],
      rpt[1],
      rpt[2],
      ['cutoff', v.sentCutoff],
      ['drive', v.padDrive],
      ['tape', st.tape ? 1 : 0],
      ['tapems', 60000 / bpm],
      ['held', 1],
      ['trig', v.trigCount]
    ];
    return { voice: v.index, params: params };
  }

  function noteOn(key, vel) {
    var v0 = num(vel, 0);
    var st, g, gv, pad, mapped, entries, entry, j, layerPad, out, voice, level;

    if (v0 <= 0) { return noteOff(key); }
    if (v0 > 127) { v0 = 127; }
    if (model.isModKey(key)) { return modPress(key); }

    g = model.globals() || {};
    pad = scanPad(key, g);                 // scan first ...
    if (!pad) { return []; }
    st = modState();
    mapped = pad;
    pad = applyChaos(pad, st, g);          // ... then chaos

    entries = [];
    entry = resolveEntry(pad);
    if (entry) {
      entry.main = true;
      entry.scanPadId = mapped.id;
      entries.push(entry);
    }
    if (pad.layers) {
      for (j = 0; j < pad.layers.length; j++) {
        layerPad = model.getPad(pad.layers[j]);
        entry = layerPad ? resolveEntry(layerPad) : null;
        if (entry) { entries.push(entry); }
      }
    }
    if (entries.length === 0) { return []; }

    gv = gestureValues(g);
    level = velCurve(v0, g.velSens);
    out = [];
    choke(entries, g, out);
    for (j = 0; j < entries.length; j++) {
      voice = allocate();
      out.push(startVoice(voice, entries[j], key, level, st, g, gv));
    }
    return out;
  }

  /**
   * A held voice that already finished (`ended`: a one-shot that ran out while
   * its key is still down) cannot repeat on its own. When repeat becomes
   * active for it (its last repeat rate was 0, the effective rate is now > 0)
   * it is started again from its current pad: the full start sequence with
   * `held 1` and a new `trig`. Key, main / layer role and stored level are kept.
   */
  function needsResume(v, wantRpt) {
    return v.busy && v.held && v.ended && v.rpt === 0 && wantRpt > 0;
  }

  /** Start sequence for a resumed voice, or null when its pad can no longer be played. */
  function resumeVoice(v, st, g, gv) {
    var pad = (v.padId !== null) ? model.getPad(v.padId) : null;
    var entry = resolveEntry(pad);
    if (!entry) { return null; }
    entry.main = v.main;
    entry.scanPadId = v.scanPadId;
    return startVoice(v, entry, v.key, v.level, st, g, gv);
  }

  // ----- note off ----------------------------------------------------------

  function noteOff(key) {
    var out = [];
    var mi = findMod(key);
    var j, v, removed;

    // Look the modifier up by key (not via isModKey): the mod zone may have
    // been toggled or moved while the key was down.
    if (mi >= 0) {
      removed = modHeld.splice(mi, 1)[0];
      out = modUpdate(removed.action, false);
    }
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (v.busy && v.held && v.key === key) {
        v.held = false;
        if (v.ended) {
          // The voice already went silent while the key was down: free it now.
          v.busy = false;
          v.ended = false;
        }
        // Always send held 0, even to an `ended` voice: the end report may have
        // been stale and the voice may still be sounding (gate-mode release).
        out.push({ voice: v.index, params: [['held', 0]] });
      }
    }
    return out;
  }

  // ----- modifiers ---------------------------------------------------------

  function modPress(key) {
    var offset, action, rptIdx, gest;
    if (findMod(key) >= 0) { return []; }         // already down
    offset = model.modOffset(key);
    action = MOD_ACTIONS[offset];
    if (action === undefined) { return []; }
    rptIdx = (action.indexOf('rpt:') === 0) ? REPEAT_DIVS.indexOf(action.substring(4)) : -1;
    gest = (action.indexOf(GEST_PREFIX) === 0) ? parseInt(action.substring(GEST_PREFIX.length), 10) : -1;
    modHeld.push({
      key: key,
      action: action,
      rpt: rptIdx >= 0 ? REPEAT_PER_BEAT[rptIdx] : 0,
      gest: gest,
      start: now()
    });
    return modUpdate(action, true);
  }

  /**
   * Recompute the effective modifier state and push whatever the changed
   * action affects to every sounding voice. Chaos only affects new notes.
   */
  function modUpdate(action, pressed) {
    var out = [];
    var st, g, gv, kind, rpt, j, v, wantDir, pend, wantRpt, cmd;

    if (action.indexOf(GEST_PREFIX) === 0) { return gestureSync(true, pressed); }
    kind = (action.indexOf('rpt:') === 0) ? 'rpt' : action;
    if (kind === 'chaos') { return out; }
    st = modState();
    g = model.globals() || {};
    gv = gestureValues(g);
    wantRpt = effectiveRptDiv(st, g, gv);

    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (kind === 'rpt' && pressed && needsResume(v, wantRpt)) {
        cmd = resumeVoice(v, st, g, gv);
        if (cmd) { out.push(cmd); continue; }
      }
      if (!isSounding(v)) { continue; }
      if (kind === 'rpt') {
        rpt = repeatParams(st, g, gv);
        v.rpt = rpt[0][1];
        out.push({ voice: v.index, params: rpt });
      } else if (kind === 'reverse') {
        wantDir = (v.padReverse !== st.reverse) ? -1 : 1;
        if (wantDir !== v.dir) {
          v.dir = wantDir;
          if (wantDir === 1) {
            pend = v.thru ? v.frames : v.sliceEnd;
          } else {
            pend = v.thru ? 0 : v.sliceStart;
          }
          v.redirCount = nextCounter(v.redirCount);
          out.push({ voice: v.index, params: [['dir', wantDir], ['pend', pend], ['redir', v.redirCount]] });
        }
      } else if (kind === 'octup' || kind === 'octdown') {
        v.sentPitch = voicePitch(v, st, gv);
        out.push({ voice: v.index, params: [['pitch', v.sentPitch]] });
      } else if (kind === 'tape') {
        out.push({ voice: v.index, params: [['tape', st.tape ? 1 : 0], ['tapems', 60000 / bpm]] });
      }
    }
    return out;
  }

  // ----- gesture ramps -----------------------------------------------------

  /**
   * Bring every sounding voice in line with the active gesture (or with no
   * gesture at all): repeat params when the effective rate differs from what
   * the voice has, cutoff / pitch / amp when they differ by more than the
   * epsilon. `exact` = compare (almost) exactly: used at press / release /
   * switch. Also exact once the ramp is complete, so the end value lands.
   * `resume` (a gesture key press): ended held voices for which the gesture
   * makes the repeat active are started again (see needsResume).
   */
  function gestureSync(exact, resume) {
    var out = [];
    var g = model.globals() || {};
    var st = modState();
    var gv = gestureValues(g);
    var wantRpt = effectiveRptDiv(st, g, gv);
    var tight = exact || (gv !== null && gv.progress >= 1);
    var j, v, params, rpt, cutoff, pitch, amp, cmd;

    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (resume && needsResume(v, wantRpt)) {
        cmd = resumeVoice(v, st, g, gv);
        if (cmd) { out.push(cmd); continue; }
      }
      if (!isSounding(v)) { continue; }
      params = [];
      if (v.rpt !== wantRpt) {
        rpt = repeatParams(st, g, gv);
        v.rpt = wantRpt;
        params.push(rpt[0], rpt[1], rpt[2]);
      }
      cutoff = voiceCutoff(v, gv);
      if (moved(v.sentCutoff, cutoff, tight ? EPS_EXACT : EPS_CUTOFF_REL * Math.abs(v.sentCutoff))) {
        v.sentCutoff = cutoff;
        params.push(['cutoff', cutoff]);
      }
      pitch = voicePitch(v, st, gv);
      if (moved(v.sentPitch, pitch, tight ? EPS_EXACT : EPS_PITCH)) {
        v.sentPitch = pitch;
        params.push(['pitch', pitch]);
      }
      amp = voiceAmp(v, gv);
      if (moved(v.sentAmp, amp, tight ? EPS_EXACT : EPS_AMP)) {
        v.sentAmp = amp;
        params.push(['amp', amp]);
      }
      if (params.length > 0) { out.push({ voice: v.index, params: params }); }
    }
    return out;
  }

  /** Advance the active gesture ramp; send the params that changed to the sounding voices. */
  function tick() {
    if (!activeGestureMod()) { return []; }
    return gestureSync(false);
  }

  /** True while a gesture modifier key is held (the host must call tick() on a timer). */
  function needsTick() {
    return activeGestureMod() !== null;
  }

  // ----- pressure ----------------------------------------------------------

  function levelCommands(value, onlyKey, key) {
    var g = model.globals() || {};
    var out = [];
    var gv, j, v;
    if (!g.pressureToLevel) { return out; }
    gv = gestureValues(g);
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!v.held) { continue; }
      if (onlyKey && v.key !== key) { continue; }
      v.level = velCurve(value, g.velSens);
      v.sentAmp = voiceAmp(v, gv);
      out.push({ voice: v.index, params: [['amp', v.sentAmp]] });
    }
    return out;
  }

  function pressure(value) {
    return levelCommands(value, false, -1);
  }

  function polyPressure(key, value) {
    return levelCommands(value, true, key);
  }

  // ----- voice lifecycle ---------------------------------------------------

  /**
   * poly~ reported that voice `index` (0-based) went silent.
   *
   * Not held: the voice is free right away. Held: the sound may simply have
   * finished while the key is still down (one-shot), so the voice is only
   * marked `ended` and is freed by its noteOff.
   *
   * Stale-message race: voiceend travels back through the Max scheduler, so it
   * can arrive after the engine already killed / stole / re-triggered that
   * voice for a new note. The engine cannot tell the two apart (the message
   * has no counter). Consequences are bounded: a stale message for a held
   * voice only flags it `ended` (still not reused until noteOff, and noteOff
   * still sends `held 0`); for a released voice it can free a voice that is
   * still ringing a release tail, which is then reused slightly early.
   */
  function voiceEnded(index) {
    var v = voices[index];
    if (!v || !v.busy) { return; }
    if (v.held) {
      v.ended = true;
    } else {
      v.busy = false;
      v.ended = false;
      v.main = false;
      v.key = -1;
    }
  }

  function setTransport(t) {
    var playing;
    t = t || {};
    if (typeof t.bpm === 'number' && isFinite(t.bpm) && t.bpm > 0) { bpm = t.bpm; }
    playing = t.playing ? 1 : 0;
    return [{ voice: -1, params: [['bpm', bpm], ['playing', playing]] }];
  }

  /**
   * Re-send repeat params to held voices (call when repeat globals change).
   * A held voice that already finished is started again when this makes the
   * repeat active for it (global repeat turned on), see needsResume.
   */
  function refreshHeld() {
    var st = modState();
    var g = model.globals() || {};
    var gv = gestureValues(g);
    var wantRpt = effectiveRptDiv(st, g, gv);
    var out = [];
    var j, v, rpt, cmd;
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (v.busy && v.held) {
        if (needsResume(v, wantRpt)) {
          cmd = resumeVoice(v, st, g, gv);
          if (cmd) { out.push(cmd); continue; }
        }
        rpt = repeatParams(st, g, gv);
        v.rpt = rpt[0][1];
        out.push({ voice: v.index, params: rpt });
      }
    }
    return out;
  }

  /**
   * Morph changed (or a pad's A/B values did): sounding voices get pitch, amp,
   * cutoff and drive from the effective pad. The stored velocity / pressure
   * level, the octave modifiers and the active gesture are kept on top.
   */
  function refreshMorph() {
    var st = modState();
    var g = model.globals() || {};
    var gv = gestureValues(g);
    var out = [];
    var j, v, eff;
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!isSounding(v) || v.padId === null) { continue; }
      eff = effectiveById(v.padId);
      if (!eff) { continue; }
      v.basePitch = num(eff.pitch, 0) + num(eff.fine, 0) / 100;
      v.gainDb = num(eff.gainDb, 0);
      v.padCutoff = num(eff.cutoffHz, 20000);
      v.padDrive = num(eff.drive, 0);
      v.sentPitch = voicePitch(v, st, gv);
      v.sentAmp = voiceAmp(v, gv);
      v.sentCutoff = voiceCutoff(v, gv);
      out.push({
        voice: v.index,
        params: [['pitch', v.sentPitch], ['amp', v.sentAmp], ['cutoff', v.sentCutoff], ['drive', v.padDrive]]
      });
    }
    return out;
  }

  /**
   * Scan changed: every held main voice whose key now maps to another pad
   * switches to that pad's slice without an envelope restart: the slice params
   * are followed by `jump <n>` (last), which makes the voice re-latch the slice
   * and move the playhead at once. Layer voices, released voices and chaos substitutions whose
   * mapping did not change are left alone.
   */
  function refreshScan() {
    var st = modState();
    var g = model.globals() || {};
    var gv = gestureValues(g);
    var out = [];
    var j, v, pad, entry, range;
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!(v.busy && v.held && v.main && v.key >= 0)) { continue; }
      pad = scanPad(v.key, g);
      if (!pad || pad.id === v.scanPadId) { continue; }
      entry = resolveEntry(pad);
      if (!entry) { continue; }
      range = playRange(entry, st);
      v.scanPadId = pad.id;
      trackEntry(v, entry, range);
      v.jumpCount = nextCounter(v.jumpCount);
      v.sentPitch = voicePitch(v, st, gv);
      v.sentAmp = voiceAmp(v, gv);
      v.sentCutoff = voiceCutoff(v, gv);
      out.push({
        voice: v.index,
        params: [
          ['src', bufferName(entry.source.slot)],
          ['bufsr', entry.source.sr],
          ['pstart', range.pstart],
          ['pend', range.pend],
          ['dir', range.dir],
          ['loopsize', range.loopsize],
          ['looppos', num(entry.pad.loopPos, 0)],
          ['pitch', v.sentPitch],
          ['amp', v.sentAmp],
          ['cutoff', v.sentCutoff],
          ['drive', v.padDrive],
          ['jump', v.jumpCount]
        ]
      });
    }
    return out;
  }

  /** Kill every voice (even ones believed free), forget held keys and modifiers. */
  function panic() {
    var out = [];
    var j;
    for (j = 0; j < voices.length; j++) {
      killVoice(voices[j], out);
    }
    modHeld.length = 0;
    return out;
  }

  /** Physical keys of sounding voices, ascending, unique. */
  function activeKeys() {
    var keys = [];
    var j, v;
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (isSounding(v) && keys.indexOf(v.key) < 0) { keys.push(v.key); }
    }
    keys.sort(function (a, b) { return a - b; });
    return keys;
  }

  return {
    noteOn: noteOn,
    noteOff: noteOff,
    pressure: pressure,
    polyPressure: polyPressure,
    voiceEnded: voiceEnded,
    setTransport: setTransport,
    refreshHeld: refreshHeld,
    refreshMorph: refreshMorph,
    refreshScan: refreshScan,
    tick: tick,
    needsTick: needsTick,
    panic: panic,
    activeKeys: activeKeys
  };
}

module.exports = {
  create: create,
  REPEAT_DIVS: REPEAT_DIVS,
  REPEAT_PER_BEAT: REPEAT_PER_BEAT,
  MOD_ACTIONS: MOD_ACTIONS,
  dbtoa: dbtoa,
  velCurve: velCurve
};
