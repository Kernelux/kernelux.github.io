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
 *   isModKey(key), modOffset(key), occupiedKeys(), globals().
 *
 * Voice bookkeeping (per voice):
 *   busy   the engine believes the voice is allocated / possibly sounding
 *   held   its key is still down
 *   ended  the voice reported silence (voiceEnded) while its key was still down
 *   "sounding" = busy and not ended.
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
  'rpt:1/32', 'rpt:1/64', 'reverse', 'octdown', 'octup', 'tape', 'chaos'];

var DEFAULT_VOICES = 16;
var DEFAULT_BPM = 120;
var COUNTER_WRAP = 1000000;

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

/** Velocity curve: (1 - s) + s * (v / 127) ^ 1.5, with s = velSens / 100. */
function velCurve(v, velSens) {
  var s = clamp(num(velSens, 50) / 100, 0, 1);
  var x = clamp(num(v, 0), 0, 127) / 127;
  return (1 - s) + s * Math.pow(x, 1.5);
}

function nextCounter(c) {
  return c >= COUNTER_WRAP ? 1 : c + 1;
}

function newVoice(index) {
  return {
    index: index,
    busy: false,
    held: false,
    ended: false,
    key: -1,          // physical key that started it (even if chaos swapped the pad)
    seq: 0,           // allocation order, for "oldest" decisions
    sourceId: null,
    sliceStart: 0,    // frames
    sliceEnd: 0,
    frames: 0,        // total frames of the source (thru end)
    thru: false,
    dir: 1,           // current playback direction as last sent
    padReverse: false,
    basePitch: 0,     // pad.pitch + pad.fine / 100 (without octave modifiers)
    gainDb: 0,
    trigCount: 0,
    killCount: 0
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

  var bpm = DEFAULT_BPM;
  var seqCounter = 0;
  var voices = [];
  // Held modifier keys in press order (last entry = most recently pressed).
  // Entries: { key, action, rpt } where rpt = repeats per beat (0 = not a repeat mod).
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

  /** Repeats per beat: held repeat modifier (latest) > global repeat > 0. */
  function effectiveRptDiv(st, g) {
    var idx;
    if (st.rpt > 0) { return st.rpt; }
    if (g && g.repeatOn) {
      idx = REPEAT_DIVS.indexOf(g.repeatDiv);
      return idx >= 0 ? REPEAT_PER_BEAT[idx] : 0;
    }
    return 0;
  }

  function repeatParams(st, g) {
    return [
      ['rptdiv', effectiveRptDiv(st, g)],
      ['rptswing', num(g && g.swing, 0) / 100],
      ['rptalt', (g && g.repeatAlt) ? 1 : 0]
    ];
  }

  // ----- voices ------------------------------------------------------------

  function isSounding(v) {
    return v.busy && !v.ended;
  }

  function release(v) {
    v.busy = false;
    v.held = false;
    v.ended = false;
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

  /** Resolve a pad to { pad, source, slice, sourceId } or null when unplayable. */
  function resolveEntry(pad) {
    var slice, source, sid;
    if (!pad) { return null; }
    slice = model.getSlice(pad.sliceId);
    if (!slice) { return null; }
    sid = (slice.sourceId !== undefined && slice.sourceId !== null) ? slice.sourceId : pad.sourceId;
    source = model.getSource(sid);
    if (!source) { return null; }
    if (!(num(source.frames, 0) > 0) || !(num(source.sr, 0) > 0)) { return null; }
    return { pad: pad, source: source, slice: slice, sourceId: sid };
  }

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

  function startVoice(v, entry, key, vel, st, g) {
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
    var pstart, pend, dir, basePitch, gainDb, loopsize, params, rpt;

    offset = Math.max(0, Math.min(offset, len - 1));
    if (reversed) {
      pstart = e - offset;
      pend = thru ? 0 : s;
      dir = -1;
    } else {
      pstart = s + offset;
      pend = thru ? frames : e;
      dir = 1;
    }
    loopsize = Math.max(1, Math.min(num(pad.loopSizeMs, 30) * sr / 1000, len));
    basePitch = num(pad.pitch, 0) + num(pad.fine, 0) / 100;
    gainDb = num(pad.gainDb, 0);
    rpt = repeatParams(st, g);

    v.busy = true;
    v.held = true;
    v.ended = false;
    v.key = key;
    seqCounter += 1;
    v.seq = seqCounter;
    v.sourceId = entry.sourceId;
    v.sliceStart = s;
    v.sliceEnd = e;
    v.frames = frames;
    v.thru = thru;
    v.dir = dir;
    v.padReverse = padReverse;
    v.basePitch = basePitch;
    v.gainDb = gainDb;
    v.trigCount = nextCounter(v.trigCount);

    // PROTOCOL.md send order: held 1 and trig <n> last.
    params = [
      ['src', bufferName(source.slot)],
      ['bufsr', sr],
      ['pstart', pstart],
      ['pend', pend],
      ['dir', dir],
      ['pitch', basePitch + 12 * st.oct],
      ['amp', dbtoa(gainDb) * velCurve(vel, g.velSens)],
      ['att', num(pad.attackMs, 0)],
      ['dec', num(pad.decayMs, 300)],
      ['sus', num(pad.sustain, 1)],
      ['rel', num(pad.releaseMs, 30)],
      ['gatemode', source.trigMode === 'gate' ? 1 : 0],
      ['loopon', pad.loopOn ? 1 : 0],
      ['loopsize', loopsize],
      ['looppos', num(pad.loopPos, 0)],
      rpt[0],
      rpt[1],
      rpt[2],
      ['cutoff', num(pad.cutoffHz, 20000)],
      ['drive', num(pad.drive, 0)],
      ['tape', st.tape ? 1 : 0],
      ['tapems', 60000 / bpm],
      ['held', 1],
      ['trig', v.trigCount]
    ];
    return { voice: v.index, params: params };
  }

  function noteOn(key, vel) {
    var v0 = num(vel, 0);
    var st, g, pad, entries, entry, j, layerPad, out, voice;

    if (v0 <= 0) { return noteOff(key); }
    if (v0 > 127) { v0 = 127; }
    if (model.isModKey(key)) { return modPress(key); }

    pad = model.getPadOnKey(key);
    if (!pad) { return []; }
    st = modState();
    g = model.globals() || {};
    pad = applyChaos(pad, st, g);

    entries = [];
    entry = resolveEntry(pad);
    if (entry) { entries.push(entry); }
    if (pad.layers) {
      for (j = 0; j < pad.layers.length; j++) {
        layerPad = model.getPad(pad.layers[j]);
        entry = layerPad ? resolveEntry(layerPad) : null;
        if (entry) { entries.push(entry); }
      }
    }
    if (entries.length === 0) { return []; }

    out = [];
    choke(entries, g, out);
    for (j = 0; j < entries.length; j++) {
      voice = allocate();
      out.push(startVoice(voice, entries[j], key, v0, st, g));
    }
    return out;
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
      out = modUpdate(removed.action);
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
    var offset, action, rptIdx;
    if (findMod(key) >= 0) { return []; }         // already down
    offset = model.modOffset(key);
    action = MOD_ACTIONS[offset];
    if (action === undefined) { return []; }
    rptIdx = (action.indexOf('rpt:') === 0) ? REPEAT_DIVS.indexOf(action.substring(4)) : -1;
    modHeld.push({
      key: key,
      action: action,
      rpt: rptIdx >= 0 ? REPEAT_PER_BEAT[rptIdx] : 0
    });
    return modUpdate(action);
  }

  /**
   * Recompute the effective modifier state and push whatever the changed
   * action affects to every sounding voice. Chaos only affects new notes.
   */
  function modUpdate(action) {
    var out = [];
    var st, g, kind, rpt, j, v, wantDir, pend;

    kind = (action.indexOf('rpt:') === 0) ? 'rpt' : action;
    if (kind === 'chaos') { return out; }
    st = modState();
    g = model.globals() || {};

    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!isSounding(v)) { continue; }
      if (kind === 'rpt') {
        rpt = repeatParams(st, g);
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
          out.push({ voice: v.index, params: [['dir', wantDir], ['pend', pend]] });
        }
      } else if (kind === 'octup' || kind === 'octdown') {
        out.push({ voice: v.index, params: [['pitch', v.basePitch + 12 * st.oct]] });
      } else if (kind === 'tape') {
        out.push({ voice: v.index, params: [['tape', st.tape ? 1 : 0], ['tapems', 60000 / bpm]] });
      }
    }
    return out;
  }

  // ----- pressure ----------------------------------------------------------

  function levelCommands(value, onlyKey, key) {
    var g = model.globals() || {};
    var out = [];
    var j, v;
    if (!g.pressureToLevel) { return out; }
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (!v.held) { continue; }
      if (onlyKey && v.key !== key) { continue; }
      out.push({
        voice: v.index,
        params: [['amp', dbtoa(v.gainDb) * velCurve(value, g.velSens)]]
      });
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

  /** Re-send repeat params to held voices (call when repeat globals change). */
  function refreshHeld() {
    var st = modState();
    var g = model.globals() || {};
    var out = [];
    var j, v;
    for (j = 0; j < voices.length; j++) {
      v = voices[j];
      if (v.busy && v.held) {
        out.push({ voice: v.index, params: repeatParams(st, g) });
      }
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
