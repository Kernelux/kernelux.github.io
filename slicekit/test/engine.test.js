'use strict';
// Engine tests. Uses a stub model (the real core/model.js is written concurrently),
// implementing only the methods the engine is allowed to use.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../core/engine');

// ---------------------------------------------------------------------------
// Stub model
// ---------------------------------------------------------------------------

// Mod zone (16 keys) starts at MOD_START; offsets follow MOD_ACTIONS.
const MOD_START = 96;
const MOD_SIZE = 16;
const MOD = {
  RPT_4: 96, RPT_8: 97, RPT_8T: 98, RPT_16: 99, RPT_16T: 100, RPT_32: 101, RPT_64: 102,
  REVERSE: 103, OCTDOWN: 104, OCTUP: 105, TAPE: 106, CHAOS: 107,
  GEST_0: 108, GEST_1: 109, GEST_2: 110, GEST_3: 111
};

const START_ORDER = [
  'src', 'bufsr', 'pstart', 'pend', 'dir', 'pitch', 'amp', 'att', 'dec', 'sus', 'rel',
  'gatemode', 'loopon', 'loopsize', 'looppos', 'rptdiv', 'rptswing', 'rptalt',
  'cutoff', 'drive', 'tape', 'tapems', 'held', 'trig'
];

// Default gestures (docs/ARCHITECTURE.md, v2 additions)
function defaultGestures() {
  return [
    { name: 'Build', beats: 4, rateFrom: '1/8', rateTo: '1/64', cutFrom: 20000, cutTo: 1200, pitchFrom: 0, pitchTo: 0, ampFrom: 1, ampTo: 1, curve: 0.3 },
    { name: 'Rise', beats: 4, rateFrom: '1/16', rateTo: '1/16', cutFrom: 20000, cutTo: 20000, pitchFrom: 0, pitchTo: 12, ampFrom: 1, ampTo: 1, curve: 0 },
    { name: 'Drop', beats: 2, rateFrom: 'off', rateTo: 'off', cutFrom: 20000, cutTo: 600, pitchFrom: 0, pitchTo: -24, ampFrom: 1, ampTo: 0.6, curve: 0.5 },
    { name: 'Fade', beats: 4, rateFrom: '1/32', rateTo: '1/32', cutFrom: 20000, cutTo: 20000, pitchFrom: 0, pitchTo: 0, ampFrom: 1, ampTo: 0, curve: 0 }
  ];
}

function stubModel() {
  let nextId = 1;
  const sources = {};
  const slices = {};
  const pads = {};
  const keys = {};
  const g = {
    chokeScope: 'source', chaos: 0, repeatOn: false, repeatDiv: '1/16', swing: 0,
    repeatAlt: false, velSens: 50, pressureToLevel: false,
    morph: 0, scan: 0, gestures: defaultGestures()
  };
  const model = {
    modZoneOn: true,
    effectivePadCalls: [],
    getPadOnKey(k) { const id = keys[k]; return id === undefined ? null : (pads[id] || null); },
    getPad(id) { return pads[id] || null; },
    getSlice(id) { return slices[id] || null; },
    getSource(id) { return sources[id] || null; },
    isModKey(k) { return model.modZoneOn && k >= MOD_START && k < MOD_START + MOD_SIZE; },
    modOffset(k) { return model.isModKey(k) ? k - MOD_START : -1; },
    occupiedKeys() {
      return Object.keys(keys).map(Number).filter((k) => !model.isModKey(k)).sort((a, b) => a - b);
    },
    globals() { return g; },
    // Mirrors the real model: numbers linear, cutoffHz geometric, booleans switch at m >= 0.5,
    // params without a B value stay A. Unknown pad => null.
    effectivePad(padId, m) {
      model.effectivePadCalls.push([padId, m]);
      const pad = pads[padId];
      if (!pad) return null;
      const out = { ...pad };
      const B = pad.morph || {};
      for (const name of Object.keys(B)) {
        const a = pad[name];
        const b = B[name];
        if (typeof a === 'boolean') out[name] = m >= 0.5 ? b : a;
        else if (name === 'cutoffHz') out[name] = a * Math.pow(b / a, m);
        else out[name] = a + (b - a) * m;
      }
      return out;
    },

    // ---- test builders (not part of the engine contract) ----
    addSource(o = {}) {
      const src = {
        id: nextId++, slot: 0, frames: 44100, sr: 44100, playMode: 'poly', trigMode: 'trigger',
        slices: [], ...o
      };
      const ranges = o.slices || [[0, 1000], [1000, 2000], [2000, 3000], [3000, 4000]];
      src.slices = ranges.map(([start, end]) => {
        const sl = { id: nextId++, start, end, sourceId: src.id };
        slices[sl.id] = sl;
        return sl;
      });
      sources[src.id] = src;
      return src;
    },
    // key === null creates an unmapped pad (e.g. a layer target)
    addPad(key, src, sliceIndex = 0, o = {}) {
      const pad = {
        id: nextId++, sourceId: src.id, sliceId: src.slices[sliceIndex].id, base: true,
        reverse: false, pitch: 0, fine: 0, gainDb: 0,
        attackMs: 0, decayMs: 300, sustain: 1, releaseMs: 30,
        startOffsetMs: 0, loopOn: false, loopSizeMs: 30, loopPos: 0,
        cutoffHz: 20000, drive: 0, layers: [], ...o
      };
      pads[pad.id] = pad;
      if (key !== null) keys[key] = pad.id;
      return pad;
    }
  };
  return model;
}

function mk(engineOpts = {}) {
  const model = stubModel();
  const engine = Engine.create({ model, ...engineOpts });
  return { model, engine, g: model.globals() };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dbtoa = (db) => Math.pow(10, db / 20);
const velCurve = (v, sens) => { const s = sens / 100; return (1 - s) + s * Math.pow(v / 127, 1.5); };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || 'near') + ': ' + a + ' vs ' + b);

function pmap(cmd) {
  const o = {};
  for (const [k, v] of cmd.params) o[k] = v;
  return o;
}
const names = (cmd) => cmd.params.map((p) => p[0]);
const isStart = (c) => c.params.some((p) => p[0] === 'trig');
const isKill = (c) => c.params.length === 1 && c.params[0][0] === 'kill';
const starts = (cmds) => cmds.filter(isStart);
const kills = (cmds) => cmds.filter(isKill);
const startVoices = (cmds) => starts(cmds).map((c) => c.voice);
const killVoices = (cmds) => kills(cmds).map((c) => c.voice);

// rng returning the given values in order (then repeating the last one)
function seqRng(...vals) {
  let i = 0;
  const f = () => { const v = vals[Math.min(i, vals.length - 1)]; i++; return v; };
  f.calls = () => i;
  return f;
}

// ---------------------------------------------------------------------------
// Note on: parameter list
// ---------------------------------------------------------------------------

test('note on emits the full ordered parameter list ending with held and trig', () => {
  const { model, engine, g } = mk({ bufferName: (slot) => 'buf' + slot });
  g.velSens = 50;
  const src = model.addSource({ slot: 2, frames: 96000, sr: 48000, slices: [[1000, 5000]] });
  model.addPad(60, src, 0, {
    pitch: 3, fine: 50, gainDb: -6, attackMs: 5, decayMs: 200, sustain: 0.5, releaseMs: 40,
    loopOn: true, loopSizeMs: 10, loopPos: 0.25, cutoffHz: 8000, drive: 0.3
  });
  const cmds = engine.noteOn(60, 100);
  assert.equal(cmds.length, 1);
  const c = cmds[0];
  assert.equal(c.voice, 0);
  assert.deepEqual(names(c), START_ORDER);
  const p = pmap(c);
  assert.equal(p.src, 'buf2');
  assert.equal(p.bufsr, 48000);
  assert.equal(p.pstart, 1000);
  assert.equal(p.pend, 5000);
  assert.equal(p.dir, 1);
  near(p.pitch, 3.5);
  near(p.amp, dbtoa(-6) * velCurve(100, 50));
  assert.equal(p.att, 5);
  assert.equal(p.dec, 200);
  assert.equal(p.sus, 0.5);
  assert.equal(p.rel, 40);
  assert.equal(p.gatemode, 0);
  assert.equal(p.loopon, 1);
  near(p.loopsize, 480);
  assert.equal(p.looppos, 0.25);
  assert.equal(p.rptdiv, 0);
  assert.equal(p.rptswing, 0);
  assert.equal(p.rptalt, 0);
  assert.equal(p.cutoff, 8000);
  assert.equal(p.drive, 0.3);
  assert.equal(p.tape, 0);
  assert.equal(p.tapems, 500);
  assert.equal(p.held, 1);
  assert.equal(p.trig, 1);
  // held then trig are the very last two entries
  assert.deepEqual(c.params.slice(-2), [['held', 1], ['trig', 1]]);
});

test('default bufferName is src<slot>; default voice count is 16', () => {
  const { model, engine } = mk();
  const src = model.addSource({ slot: 7 });
  for (let k = 0; k < 17; k++) model.addPad(k, src, 0);
  const first = engine.noteOn(0, 100);
  assert.equal(pmap(first[0]).src, 'src7');
  const used = new Set([first[0].voice]);
  for (let k = 1; k < 16; k++) used.add(engine.noteOn(k, 100)[0].voice);
  assert.equal(used.size, 16);
  assert.deepEqual([...used].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));
  // 17th note must steal (oldest voice, all held) => voice 0
  assert.equal(engine.noteOn(16, 100)[0].voice, 0);
});

test('velocity 0 is a note off; unmapped key and unknown key off do nothing', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0);
  assert.deepEqual(engine.noteOn(61, 100), []);          // no pad
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(60, 0), [{ voice: 0, params: [['held', 0]] }]);
  assert.deepEqual(engine.noteOff(60), []);              // already released
  assert.deepEqual(engine.noteOff(99), []);
});

test('velocity curve and velSens', () => {
  const { model, engine, g } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0, { gainDb: -3 });
  g.velSens = 0;
  near(pmap(engine.noteOn(60, 1)[0]).amp, dbtoa(-3));
  near(pmap(engine.noteOn(60, 127)[0]).amp, dbtoa(-3));
  g.velSens = 100;
  near(pmap(engine.noteOn(60, 127)[0]).amp, dbtoa(-3));
  near(pmap(engine.noteOn(60, 64)[0]).amp, dbtoa(-3) * Math.pow(64 / 127, 1.5));
  g.velSens = 50;
  near(pmap(engine.noteOn(60, 32)[0]).amp, dbtoa(-3) * (0.5 + 0.5 * Math.pow(32 / 127, 1.5)));
  // exported helper agrees
  near(Engine.velCurve(32, 50), 0.5 + 0.5 * Math.pow(32 / 127, 1.5));
  near(Engine.dbtoa(-6), Math.pow(10, -0.3));
});

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

function posSetup(srcOpts, padOpts) {
  const ctx = mk();
  // sr 1000 => 1 ms == 1 frame
  const src = ctx.model.addSource({ frames: 10000, sr: 1000, slices: [[2000, 4000]], ...srcOpts });
  ctx.model.addPad(60, src, 0, padOpts);
  return ctx;
}

test('positions: forward', () => {
  const { engine } = posSetup({}, {});
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [2000, 4000, 1]);
});

test('positions: forward with start offset', () => {
  const { engine } = posSetup({}, { startOffsetMs: 100 });
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [2100, 4000, 1]);
});

test('positions: reverse (pad.reverse)', () => {
  const { engine } = posSetup({}, { reverse: true });
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [4000, 2000, -1]);
});

test('positions: reverse with start offset moves start inward from the end', () => {
  const { engine } = posSetup({}, { reverse: true, startOffsetMs: 250 });
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [3750, 2000, -1]);
});

test('positions: thru forward runs to the end of the source', () => {
  const { engine } = posSetup({ playMode: 'thru' }, {});
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [2000, 10000, 1]);
});

test('positions: thru reversed runs to frame 0', () => {
  const { engine } = posSetup({ playMode: 'thru' }, { reverse: true });
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [4000, 0, -1]);
});

test('positions: start offset is rounded using the source sample rate', () => {
  const { model, engine } = mk();
  const src = model.addSource({ frames: 100000, sr: 44100, slices: [[1000, 20000]] });
  model.addPad(60, src, 0, { startOffsetMs: 1 });          // 44.1 frames => 44
  assert.equal(pmap(engine.noteOn(60, 100)[0]).pstart, 1044);
  model.addPad(61, src, 0, { startOffsetMs: 2 });          // 88.2 => 88
  assert.equal(pmap(engine.noteOn(61, 100)[0]).pstart, 1088);
});

test('positions: start offset is clamped to slice length - 1', () => {
  const fwd = posSetup({}, { startOffsetMs: 5000 });
  assert.equal(pmap(fwd.engine.noteOn(60, 100)[0]).pstart, 2000 + 1999);
  const rev = posSetup({}, { startOffsetMs: 5000, reverse: true });
  assert.equal(pmap(rev.engine.noteOn(60, 100)[0]).pstart, 4000 - 1999);
});

test('loopsize is clamped to [1, slice length]', () => {
  const big = posSetup({}, { loopOn: true, loopSizeMs: 99999 });
  assert.equal(pmap(big.engine.noteOn(60, 100)[0]).loopsize, 2000);
  const tiny = posSetup({}, { loopOn: true, loopSizeMs: 0 });
  assert.equal(pmap(tiny.engine.noteOn(60, 100)[0]).loopsize, 1);
  const mid = posSetup({}, { loopOn: true, loopSizeMs: 30 });
  assert.equal(pmap(mid.engine.noteOn(60, 100)[0]).loopsize, 30);
});

test('pitch combines semitones and cents', () => {
  const { engine } = posSetup({}, { pitch: -5, fine: -25 });
  near(pmap(engine.noteOn(60, 100)[0]).pitch, -5.25);
});

test('gatemode follows the source trigMode', () => {
  const { model, engine } = mk();
  const t = model.addSource({ trigMode: 'trigger' });
  const gt = model.addSource({ trigMode: 'gate' });
  model.addPad(60, t, 0);
  model.addPad(61, gt, 0);
  assert.equal(pmap(engine.noteOn(60, 100)[0]).gatemode, 0);
  assert.equal(pmap(engine.noteOn(61, 100)[0]).gatemode, 1);
});

// ---------------------------------------------------------------------------
// Choke
// ---------------------------------------------------------------------------

function chokeSetup(chokeScope) {
  const ctx = mk();
  ctx.g.chokeScope = chokeScope;
  ctx.A = ctx.model.addSource({ slot: 0, playMode: 'mono' });
  ctx.B = ctx.model.addSource({ slot: 1, playMode: 'poly' });
  ctx.T = ctx.model.addSource({ slot: 2, playMode: 'thru' });
  ctx.model.addPad(60, ctx.A, 0);
  ctx.model.addPad(61, ctx.A, 1);
  ctx.model.addPad(62, ctx.B, 0);
  ctx.model.addPad(63, ctx.B, 1);
  ctx.model.addPad(64, ctx.T, 0);
  return ctx;
}

test('mono choke (scope source): kills only voices of the same source', () => {
  const { engine } = chokeSetup('source');
  engine.noteOn(60, 100);                      // v0, A
  engine.noteOn(62, 100);                      // v1, B
  engine.noteOn(63, 100);                      // v2, B
  const cmds = engine.noteOn(61, 100);         // A again: chokes v0 only
  assert.deepEqual(cmds[0], { voice: 0, params: [['kill', 1]] });
  assert.deepEqual(killVoices(cmds), [0]);
  assert.deepEqual(startVoices(cmds), [0]);    // killed voice is free immediately
  assert.ok(cmds.indexOf(kills(cmds)[0]) < cmds.indexOf(starts(cmds)[0]), 'kill before start');
  assert.deepEqual(engine.activeKeys(), [61, 62, 63]);
});

test('mono choke does not touch other sources, even other mono ones', () => {
  const { model, engine } = chokeSetup('source');
  const M = model.addSource({ slot: 3, playMode: 'mono' });
  model.addPad(70, M, 0);
  engine.noteOn(60, 100);                      // v0, A
  const cmds = engine.noteOn(70, 100);         // M: nothing to choke
  assert.deepEqual(kills(cmds), []);
  assert.deepEqual(engine.activeKeys(), [60, 70]);
});

test('thru sources choke like mono', () => {
  const { model, engine } = chokeSetup('source');
  const T2 = model.addSource({ slot: 4, playMode: 'thru' });
  model.addPad(65, T2, 0);
  engine.noteOn(64, 100);                      // v0, T
  engine.noteOn(62, 100);                      // v1, B
  const cmds = engine.noteOn(64, 100);         // T again
  assert.deepEqual(killVoices(cmds), [0]);
  assert.deepEqual(engine.noteOn(65, 100).filter(isKill), []);   // other thru source survives
});

test('global choke (scope global): a mono note kills every sounding voice', () => {
  const { engine } = chokeSetup('global');
  engine.noteOn(62, 100);                      // v0, B
  engine.noteOn(63, 100);                      // v1, B
  engine.noteOn(64, 100);                      // thru T: kills v0, v1
  const cmds = engine.noteOn(60, 100);         // A mono: kills T's voice too
  assert.deepEqual(killVoices(cmds), [0]);     // only the thru voice is left to kill
  assert.deepEqual(engine.activeKeys(), [60]);
});

test('global choke kills voices of other sources, including released tails', () => {
  const { engine } = chokeSetup('global');
  engine.noteOn(62, 100);                      // v0, B
  engine.noteOn(63, 100);                      // v1, B
  engine.noteOff(63);                          // v1 tail still sounding
  const cmds = engine.noteOn(60, 100);         // A mono
  assert.deepEqual(killVoices(cmds), [0, 1]);
  assert.deepEqual(startVoices(cmds), [0]);
  assert.deepEqual(engine.activeKeys(), [60]);
});

test('poly notes never choke, in either scope', () => {
  for (const scope of ['source', 'global']) {
    const { engine } = chokeSetup(scope);
    engine.noteOn(60, 100);                    // mono voice
    engine.noteOn(62, 100);                    // poly
    const cmds = engine.noteOn(63, 100);       // poly again
    assert.deepEqual(kills(cmds), [], scope);
    assert.deepEqual(engine.activeKeys(), [60, 62, 63], scope);
  }
});

test('killed voices are not addressed by the old key anymore', () => {
  const { engine } = chokeSetup('source');
  engine.noteOn(60, 100);                      // v0
  engine.noteOn(61, 100);                      // chokes v0, new note re-uses v0 on key 61
  // key 60 released: the voice now belongs to key 61, so nothing is sent
  assert.deepEqual(engine.noteOff(60), []);
  assert.deepEqual(engine.noteOff(61), [{ voice: 0, params: [['held', 0]] }]);
});

test('kill and trig counters increment per voice', () => {
  const { engine } = chokeSetup('source');
  const a = engine.noteOn(60, 100);            // v0 trig 1
  const b = engine.noteOn(61, 100);            // kill 1, v0 trig 2
  const c = engine.noteOn(60, 100);            // kill 2, v0 trig 3
  assert.equal(pmap(a[0]).trig, 1);
  assert.deepEqual(b[0], { voice: 0, params: [['kill', 1]] });
  assert.equal(pmap(b[1]).trig, 2);
  assert.deepEqual(c[0], { voice: 0, params: [['kill', 2]] });
  assert.equal(pmap(c[1]).trig, 3);
  // another voice has its own counters
  const d = engine.noteOn(62, 100);            // v1 trig 1
  assert.equal(d[0].voice, 1);
  assert.equal(pmap(d[0]).trig, 1);
});

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

test('layers trigger several voices and never choke each other', () => {
  const { model, engine } = mk();
  const A = model.addSource({ slot: 0, playMode: 'mono' });
  const B = model.addSource({ slot: 1, playMode: 'mono' });
  const l1 = model.addPad(null, B, 0, { pitch: 7 });
  const l2 = model.addPad(null, A, 1, { pitch: 12 });
  model.addPad(60, A, 0, { layers: [l1.id, 99999, l2.id] });   // 99999 does not exist
  let cmds = engine.noteOn(60, 100);
  assert.deepEqual(kills(cmds), []);
  assert.equal(starts(cmds).length, 3);
  assert.deepEqual(startVoices(cmds), [0, 1, 2]);
  assert.deepEqual(starts(cmds).map((c) => pmap(c).pitch), [0, 7, 12]);
  assert.deepEqual(starts(cmds).map((c) => pmap(c).src), ['src0', 'src1', 'src0']);
  assert.deepEqual(engine.activeKeys(), [60]);

  // Playing it again chokes all three old voices (both sources are mono)
  // once, then re-uses them for the new voices.
  cmds = engine.noteOn(60, 100);
  assert.deepEqual(killVoices(cmds), [0, 1, 2]);
  assert.deepEqual(startVoices(cmds), [0, 1, 2]);
  const lastKill = Math.max(...kills(cmds).map((c) => cmds.indexOf(c)));
  const firstStart = Math.min(...starts(cmds).map((c) => cmds.indexOf(c)));
  assert.ok(lastKill < firstStart, 'all kills precede all starts');
});

test('layers: note off releases every layer voice', () => {
  const { model, engine } = mk();
  const A = model.addSource();
  const l1 = model.addPad(null, A, 1);
  const l2 = model.addPad(null, A, 2);
  model.addPad(60, A, 0, { layers: [l1.id, l2.id] });
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOff(60), [
    { voice: 0, params: [['held', 0]] },
    { voice: 1, params: [['held', 0]] },
    { voice: 2, params: [['held', 0]] }
  ]);
});

test('layers: a mono layer chokes older voices of its source but a poly main pad does not', () => {
  const { model, engine } = mk();
  const P = model.addSource({ slot: 0, playMode: 'poly' });
  const M = model.addSource({ slot: 1, playMode: 'mono' });
  const layer = model.addPad(null, M, 0);
  model.addPad(60, P, 0, { layers: [layer.id] });
  model.addPad(61, M, 1);
  model.addPad(62, P, 1);
  engine.noteOn(61, 100);                      // v0, M
  engine.noteOn(62, 100);                      // v1, P
  const cmds = engine.noteOn(60, 100);         // P + M layer
  assert.deepEqual(killVoices(cmds), [0]);     // only M's older voice
  assert.deepEqual(engine.activeKeys(), [60, 62]);
});

test('layers pointing at unloaded sources are skipped, main pad still plays', () => {
  const { model, engine } = mk();
  const A = model.addSource();
  const U = model.addSource({ frames: 0, sr: 0 });
  const layer = model.addPad(null, U, 0);
  model.addPad(60, A, 0, { layers: [layer.id] });
  assert.deepEqual(startVoices(engine.noteOn(60, 100)), [0]);
});

// ---------------------------------------------------------------------------
// Chaos
// ---------------------------------------------------------------------------

function chaosSetup(rng) {
  const ctx = mk({ rng });
  const src = ctx.model.addSource({ slices: [[0, 100], [100, 200], [200, 300]] });
  ctx.model.addPad(60, src, 0);
  ctx.model.addPad(61, src, 1);
  ctx.model.addPad(62, src, 2);
  return ctx;
}

test('chaos 0 never replaces the pad and never consults rng', () => {
  const rng = () => { throw new Error('rng must not be called'); };
  const { engine } = chaosSetup(rng);
  assert.equal(pmap(engine.noteOn(61, 100)[0]).pstart, 100);
});

test('chaos 100 always replaces the pad with the one on a random occupied key', () => {
  // roll: 0.5*100 < 100 => chaos; index = floor(0.9 * 3) = 2 => key 62
  const { engine, g } = chaosSetup(seqRng(0.5, 0.9));
  g.chaos = 100;
  assert.equal(pmap(engine.noteOn(60, 100)[0]).pstart, 200);
  // second note: index floor(0.0 * 3) = 0 => key 60
  const ctx2 = chaosSetup(seqRng(0.99, 0.0));
  ctx2.g.chaos = 100;
  assert.equal(pmap(ctx2.engine.noteOn(62, 100)[0]).pstart, 0);
});

test('chaos percentage is compared against rng()*100', () => {
  const hit = chaosSetup(seqRng(0.49, 0.5));   // 49 < 50 => chaos, index 1 => key 61
  hit.g.chaos = 50;
  assert.equal(pmap(hit.engine.noteOn(60, 100)[0]).pstart, 100);

  const miss = chaosSetup(seqRng(0.5, 0.5));   // 50 < 50 is false => original pad
  miss.g.chaos = 50;
  assert.equal(pmap(miss.engine.noteOn(60, 100)[0]).pstart, 0);
  assert.equal(miss.engine.activeKeys()[0], 60);
});

test('chaos modifier forces 100 while held, and releasing reverts to the global value', () => {
  const rng = seqRng(0.99, 0.5);               // 99 < 100 => chaos; index 1 => key 61
  const { engine, g } = chaosSetup(rng);
  g.chaos = 0;
  assert.deepEqual(engine.noteOn(MOD.CHAOS, 100), []);   // no voice, nothing to update
  assert.equal(pmap(engine.noteOn(62, 100)[0]).pstart, 100);
  assert.equal(rng.calls(), 2);
  engine.noteOff(MOD.CHAOS);
  const before = rng.calls();
  assert.equal(pmap(engine.noteOn(62, 100)[0]).pstart, 200);   // global chaos 0 again
  assert.equal(rng.calls(), before);
});

test('chaos: note off uses the physical key; substituted pad layers play', () => {
  const { model, engine, g } = chaosSetup(seqRng(0.0, 0.99));   // => key 62
  const src = model.getSource(model.getPadOnKey(62).sourceId);
  const layer = model.addPad(null, src, 0);
  model.getPadOnKey(62).layers = [layer.id];
  g.chaos = 100;
  const on = engine.noteOn(60, 100);
  assert.equal(starts(on).length, 2);
  assert.deepEqual(engine.activeKeys(), [60]);
  assert.deepEqual(engine.noteOff(60).map((c) => c.voice), [0, 1]);
});

// ---------------------------------------------------------------------------
// Allocation and stealing
// ---------------------------------------------------------------------------

function polySetup(numVoices, keys) {
  const ctx = mk({ numVoices });
  const src = ctx.model.addSource({
    slices: keys.map((k, i) => [i * 100, i * 100 + 100])
  });
  keys.forEach((k, i) => ctx.model.addPad(k, src, i));
  return ctx;
}

test('allocation: lowest free voice first, then oldest non-held, then oldest voice', () => {
  const { engine } = polySetup(3, [60, 61, 62, 63, 64, 65, 66]);
  assert.equal(engine.noteOn(60, 100)[0].voice, 0);   // seq1
  assert.equal(engine.noteOn(61, 100)[0].voice, 1);   // seq2
  assert.equal(engine.noteOn(62, 100)[0].voice, 2);   // seq3
  engine.noteOff(61);                                  // v1 non-held (still busy)
  // no free voice: steal the oldest NON-HELD one => v1 (not v0, which is older but held)
  const steal1 = engine.noteOn(63, 100);
  assert.equal(steal1[0].voice, 1);
  assert.deepEqual(kills(steal1), []);                 // stealing uses trig, no kill
  // now v0=k60(seq1) v1=k63(seq4) v2=k62(seq3); release 60 and 62
  engine.noteOff(60);
  engine.noteOff(62);
  // both non-held; oldest is v0 (seq1) before v2 (seq3)
  assert.equal(engine.noteOn(64, 100)[0].voice, 0);   // seq5
  // only v2 non-held
  assert.equal(engine.noteOn(65, 100)[0].voice, 2);   // seq6
  // everything held: v0 seq5, v1 seq4, v2 seq6 => oldest is v1
  assert.equal(engine.noteOn(66, 100)[0].voice, 1);   // seq7
  // v1 was re-owned by key 66; its previous owner (63) no longer controls it
  assert.deepEqual(engine.noteOff(63), []);
  assert.deepEqual(engine.noteOff(66), [{ voice: 1, params: [['held', 0]] }]);
});

test('allocation: a free voice is preferred over stealing a non-held one', () => {
  const { engine } = polySetup(3, [60, 61, 62, 63]);
  engine.noteOn(60, 100);                              // v0
  engine.noteOff(60);                                  // v0 non-held but busy
  assert.equal(engine.noteOn(61, 100)[0].voice, 1);    // free v1, not v0
  assert.equal(engine.noteOn(62, 100)[0].voice, 2);
  engine.voiceEnded(0);                                // v0 free again
  assert.equal(engine.noteOn(63, 100)[0].voice, 0);
});

test('allocation: stolen voice gets a complete parameter list', () => {
  const { engine } = polySetup(1, [60, 61]);
  engine.noteOn(60, 100);
  const c = engine.noteOn(61, 100);
  assert.equal(c.length, 1);
  assert.deepEqual(names(c[0]), START_ORDER);
  assert.equal(pmap(c[0]).trig, 2);
});

// ---------------------------------------------------------------------------
// Note off
// ---------------------------------------------------------------------------

test('note off sends held 0 only to the voices of that key', () => {
  const { engine } = polySetup(4, [60, 61]);
  engine.noteOn(60, 100);                              // v0
  engine.noteOn(61, 100);                              // v1
  engine.noteOn(60, 100);                              // v2 (same key again)
  assert.deepEqual(engine.noteOff(60), [
    { voice: 0, params: [['held', 0]] },
    { voice: 2, params: [['held', 0]] }
  ]);
  assert.deepEqual(engine.noteOff(60), []);            // already released
  // released voices keep sounding until voiceEnded
  assert.deepEqual(engine.activeKeys(), [60, 61]);
  engine.voiceEnded(0);
  engine.voiceEnded(2);
  assert.deepEqual(engine.activeKeys(), [61]);
  assert.deepEqual(engine.noteOff(61), [{ voice: 1, params: [['held', 0]] }]);
});

// ---------------------------------------------------------------------------
// Repeat
// ---------------------------------------------------------------------------

function repeatSetup() {
  const ctx = mk();
  const src = ctx.model.addSource();
  ctx.model.addPad(60, src, 0);
  ctx.model.addPad(61, src, 1);
  ctx.model.addPad(62, src, 2);
  return ctx;
}
const rptOf = (cmds) => pmap(cmds[0]).rptdiv;

test('repeat: off by default; global repeat maps repeatDiv to repeats per beat', () => {
  const { engine, g } = repeatSetup();
  assert.equal(rptOf(engine.noteOn(60, 100)), 0);
  g.repeatOn = true;
  const expected = { '1/4': 1, '1/8': 2, '1/8T': 3, '1/16': 4, '1/16T': 6, '1/32': 8, '1/32T': 12, '1/64': 16 };
  for (const div of Object.keys(expected)) {
    g.repeatDiv = div;
    assert.equal(rptOf(engine.noteOn(60, 100)), expected[div], div);
  }
  g.repeatOn = false;
  assert.equal(rptOf(engine.noteOn(60, 100)), 0);
});

test('repeat: swing and alt are passed to new voices', () => {
  const { engine, g } = repeatSetup();
  g.repeatOn = true; g.repeatDiv = '1/8'; g.swing = 50; g.repeatAlt = true;
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.equal(p.rptdiv, 2);
  assert.equal(p.rptswing, 0.5);
  assert.equal(p.rptalt, 1);
});

test('repeat modifiers: most recently pressed wins, release reverts, then global', () => {
  const { engine, g } = repeatSetup();
  g.repeatOn = true; g.repeatDiv = '1/8';
  assert.equal(rptOf(engine.noteOn(60, 100)), 2);          // global
  engine.noteOn(MOD.RPT_16, 100);
  assert.equal(rptOf(engine.noteOn(60, 100)), 4);          // modifier beats global
  engine.noteOn(MOD.RPT_4, 100);
  assert.equal(rptOf(engine.noteOn(60, 100)), 1);          // latest pressed
  engine.noteOn(MOD.RPT_64, 100);
  assert.equal(rptOf(engine.noteOn(60, 100)), 16);
  engine.noteOff(MOD.RPT_64);
  assert.equal(rptOf(engine.noteOn(60, 100)), 1);          // back to the previous latest
  engine.noteOff(MOD.RPT_4);
  assert.equal(rptOf(engine.noteOn(60, 100)), 4);
  engine.noteOff(MOD.RPT_16);
  assert.equal(rptOf(engine.noteOn(60, 100)), 2);          // global again
  g.repeatOn = false;
  assert.equal(rptOf(engine.noteOn(60, 100)), 0);
});

test('repeat modifier releasing an older key keeps the newer one active', () => {
  const { engine } = repeatSetup();
  engine.noteOn(MOD.RPT_8, 100);
  engine.noteOn(MOD.RPT_16T, 100);
  engine.noteOff(MOD.RPT_8);
  assert.equal(rptOf(engine.noteOn(60, 100)), 6);
});

test('repeat modifier works with global repeat off, all seven keys', () => {
  const { engine } = repeatSetup();
  const table = [[MOD.RPT_4, 1], [MOD.RPT_8, 2], [MOD.RPT_8T, 3], [MOD.RPT_16, 4],
    [MOD.RPT_16T, 6], [MOD.RPT_32, 8], [MOD.RPT_64, 16]];
  for (const [key, div] of table) {
    engine.noteOn(key, 100);
    assert.equal(rptOf(engine.noteOn(60, 100)), div, 'key ' + key);
    engine.noteOff(key);
  }
});

test('repeat modifier updates all sounding voices (including released tails), not free ones', () => {
  const { engine, g } = repeatSetup();
  g.swing = 25; g.repeatAlt = true;
  engine.noteOn(60, 100);                                   // v0 held
  engine.noteOn(61, 100);                                   // v1
  engine.noteOff(61);                                       // v1 tail, still sounding
  engine.noteOn(62, 100);                                   // v2
  engine.voiceEnded(1);                                     // v1 ended (non-held) => free
  const press = engine.noteOn(MOD.RPT_8T, 100);
  assert.deepEqual(press, [
    { voice: 0, params: [['rptdiv', 3], ['rptswing', 0.25], ['rptalt', 1]] },
    { voice: 2, params: [['rptdiv', 3], ['rptswing', 0.25], ['rptalt', 1]] }
  ]);
  const rel = engine.noteOff(MOD.RPT_8T);
  assert.deepEqual(rel.map((c) => c.voice), [0, 2]);
  assert.equal(pmap(rel[0]).rptdiv, 0);
});

test('refreshHeld re-sends repeat params to held voices only', () => {
  const { engine, g } = repeatSetup();
  engine.noteOn(60, 100);                                   // v0 held
  engine.noteOn(61, 100);                                   // v1
  engine.noteOff(61);                                       // v1 released
  g.repeatOn = true; g.repeatDiv = '1/16'; g.swing = 40;
  assert.deepEqual(engine.refreshHeld(), [
    { voice: 0, params: [['rptdiv', 4], ['rptswing', 0.4], ['rptalt', 0]] }
  ]);
  engine.noteOn(MOD.RPT_4, 100);
  assert.equal(engine.refreshHeld()[0].params[0][1], 1);    // modifier still has priority
  engine.panic();
  assert.deepEqual(engine.refreshHeld(), []);
});

// ---------------------------------------------------------------------------
// Reverse modifier
// ---------------------------------------------------------------------------

test('reverse modifier flips sounding voices with the right pend, and back on release', () => {
  const { engine } = posSetup({}, {});
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.REVERSE, 100), [
    { voice: 0, params: [['dir', -1], ['pend', 2000], ['redir', 1]] }
  ]);
  assert.deepEqual(engine.noteOff(MOD.REVERSE), [
    { voice: 0, params: [['dir', 1], ['pend', 4000], ['redir', 2]] }
  ]);
});

test('reverse modifier with thru: pend is 0 reversed and source end forward', () => {
  const { engine } = posSetup({ playMode: 'thru' }, {});
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.REVERSE, 100), [
    { voice: 0, params: [['dir', -1], ['pend', 0], ['redir', 1]] }
  ]);
  assert.deepEqual(engine.noteOff(MOD.REVERSE), [
    { voice: 0, params: [['dir', 1], ['pend', 10000], ['redir', 2]] }
  ]);
});

test('reverse modifier on a reversed pad plays it forward (XOR)', () => {
  const { engine } = posSetup({}, { reverse: true });
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.REVERSE, 100), [
    { voice: 0, params: [['dir', 1], ['pend', 4000], ['redir', 1]] }
  ]);
  assert.deepEqual(engine.noteOff(MOD.REVERSE), [
    { voice: 0, params: [['dir', -1], ['pend', 2000], ['redir', 2]] }
  ]);
  // new note while held: forward
  engine.noteOn(MOD.REVERSE, 100);
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [2000, 4000, 1]);
});

test('notes started while reverse is held are reversed, and flip on release', () => {
  const { engine } = posSetup({}, { startOffsetMs: 100 });
  engine.noteOn(MOD.REVERSE, 100);
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [3900, 2000, -1]);
  assert.deepEqual(engine.noteOff(MOD.REVERSE), [
    { voice: 0, params: [['dir', 1], ['pend', 4000], ['redir', 1]] }
  ]);
});

test('reverse modifier only touches sounding voices', () => {
  const { engine } = polySetup(3, [60, 61]);
  engine.noteOn(60, 100);
  engine.noteOn(61, 100);
  engine.noteOff(61);
  engine.voiceEnded(1);                                     // v1 free
  const cmds = engine.noteOn(MOD.REVERSE, 100);
  assert.deepEqual(cmds.map((c) => c.voice), [0]);
});

// ---------------------------------------------------------------------------
// Octave and tape modifiers
// ---------------------------------------------------------------------------

test('octave modifiers shift pitch by 12 semitones each, on new and sounding voices', () => {
  const { engine } = posSetup({}, { pitch: 2, fine: 25 });
  engine.noteOn(60, 100);                                   // base 2.25
  let c = engine.noteOn(MOD.OCTUP, 100);
  assert.equal(c.length, 1);
  near(pmap(c[0]).pitch, 14.25);
  assert.deepEqual(names(c[0]), ['pitch']);
  c = engine.noteOn(MOD.OCTDOWN, 100);                      // both held => cancel
  near(pmap(c[0]).pitch, 2.25);
  c = engine.noteOff(MOD.OCTUP);                            // only octdown
  near(pmap(c[0]).pitch, -9.75);
  near(pmap(engine.noteOn(60, 100)[0]).pitch, -9.75);       // new note too
  c = engine.noteOff(MOD.OCTDOWN);
  near(pmap(c[0]).pitch, 2.25);
  engine.noteOn(MOD.OCTUP, 100);
  near(pmap(engine.noteOn(60, 100)[0]).pitch, 14.25);
});

test('tape modifier toggles tape/tapems on sounding voices and new notes', () => {
  const { engine } = posSetup({}, {});
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.TAPE, 100), [
    { voice: 0, params: [['tape', 1], ['tapems', 500]] }
  ]);
  engine.setTransport({ bpm: 150, playing: true });
  const p = pmap(engine.noteOn(60, 100)[0]);
  assert.equal(p.tape, 1);
  assert.equal(p.tapems, 400);
  assert.deepEqual(engine.noteOff(MOD.TAPE).map((c) => pmap(c)), [
    { tape: 0, tapems: 400 }, { tape: 0, tapems: 400 }
  ]);
  assert.equal(pmap(engine.noteOn(60, 100)[0]).tape, 0);
});

test('chaos modifier produces no voice commands by itself', () => {
  const { engine } = posSetup({}, {});
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.CHAOS, 100), []);
  assert.deepEqual(engine.noteOff(MOD.CHAOS), []);
});

// ---------------------------------------------------------------------------
// Modifier keys never allocate voices
// ---------------------------------------------------------------------------

test('modifier keys never allocate voices, even when a pad sits on them', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0);
  for (let k = MOD_START; k < MOD_START + MOD_SIZE; k++) model.addPad(k, src, 1);   // stray pads
  for (let k = MOD_START; k < MOD_START + MOD_SIZE; k++) {
    assert.deepEqual(starts(engine.noteOn(k, 100)), [], 'key ' + k);
  }
  assert.deepEqual(engine.activeKeys(), []);
  assert.equal(engine.noteOn(60, 100)[0].voice, 0);          // voice 0 still free
  for (let k = MOD_START; k < MOD_START + MOD_SIZE; k++) engine.noteOff(k);
});

test('with the mod zone off those keys play normal pads', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  model.addPad(100, src, 0);
  model.modZoneOn = false;
  assert.equal(starts(engine.noteOn(100, 100)).length, 1);
});

test('a modifier released after the mod zone was turned off is still released', () => {
  const { model, engine } = repeatSetup();
  engine.noteOn(MOD.RPT_4, 100);
  assert.equal(rptOf(engine.noteOn(60, 100)), 1);
  model.modZoneOn = false;
  engine.noteOff(MOD.RPT_4);
  model.modZoneOn = true;
  assert.equal(rptOf(engine.noteOn(60, 100)), 0);
});

test('pressing the same modifier twice does not double-count it', () => {
  const { engine } = posSetup({}, {});
  engine.noteOn(60, 100);
  engine.noteOn(MOD.OCTUP, 100);
  assert.deepEqual(engine.noteOn(MOD.OCTUP, 100), []);
  const c = engine.noteOff(MOD.OCTUP);
  near(pmap(c[0]).pitch, 0);
});

// ---------------------------------------------------------------------------
// Pressure
// ---------------------------------------------------------------------------

test('pressure does nothing unless pressureToLevel is on', () => {
  const { model, engine, g } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0);
  engine.noteOn(60, 100);
  g.pressureToLevel = false;
  assert.deepEqual(engine.pressure(100), []);
  assert.deepEqual(engine.polyPressure(60, 100), []);
});

test('pressure sets amp on every held voice (not on released ones)', () => {
  const { model, engine, g } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0, { gainDb: -3 });
  model.addPad(61, src, 1, { gainDb: -12 });
  model.addPad(62, src, 2);
  g.pressureToLevel = true; g.velSens = 50;
  engine.noteOn(60, 100);                                   // v0
  engine.noteOn(61, 100);                                   // v1
  engine.noteOn(62, 100);                                   // v2
  engine.noteOff(62);                                       // released
  const cmds = engine.pressure(64);
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  assert.deepEqual(names(cmds[0]), ['amp']);
  near(pmap(cmds[0]).amp, dbtoa(-3) * velCurve(64, 50));
  near(pmap(cmds[1]).amp, dbtoa(-12) * velCurve(64, 50));
  g.velSens = 100;
  near(pmap(engine.pressure(127)[0]).amp, dbtoa(-3));
});

test('polyPressure only addresses the voices of that key', () => {
  const { model, engine, g } = mk();
  const src = model.addSource();
  const layer = model.addPad(null, src, 3, { gainDb: -6 });
  model.addPad(60, src, 0, { gainDb: -3, layers: [layer.id] });
  model.addPad(61, src, 1);
  g.pressureToLevel = true;
  engine.noteOn(60, 100);                                   // v0 + v1 (layer)
  engine.noteOn(61, 100);                                   // v2
  const cmds = engine.polyPressure(60, 90);
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  near(pmap(cmds[0]).amp, dbtoa(-3) * velCurve(90, 50));
  near(pmap(cmds[1]).amp, dbtoa(-6) * velCurve(90, 50));
  assert.deepEqual(engine.polyPressure(61, 10).map((c) => c.voice), [2]);
  assert.deepEqual(engine.polyPressure(70, 10), []);
  engine.noteOff(61);
  assert.deepEqual(engine.polyPressure(61, 10), []);
});

// ---------------------------------------------------------------------------
// voiceEnded bookkeeping
// ---------------------------------------------------------------------------

test('voiceEnded frees a non-held voice immediately', () => {
  const { engine } = polySetup(2, [60, 61, 62]);
  engine.noteOn(60, 100);                                   // v0
  engine.noteOn(61, 100);                                   // v1
  engine.noteOff(60);
  assert.deepEqual(engine.activeKeys(), [60, 61]);
  engine.voiceEnded(0);
  assert.deepEqual(engine.activeKeys(), [61]);
  assert.equal(engine.noteOn(62, 100)[0].voice, 0);         // free voice used, v1 untouched
});

test('voiceEnded on a held voice only marks it; the voice is freed at note off', () => {
  const { engine } = polySetup(2, [60, 61, 62, 63]);
  engine.noteOn(60, 100);                                   // v0
  engine.noteOn(61, 100);                                   // v1
  engine.noteOff(61);                                       // v1 non-held
  engine.voiceEnded(0);                                     // v0 held => ended, NOT free
  assert.deepEqual(engine.activeKeys(), [61]);              // ended voices are silent
  // v0 is not free: the non-held v1 gets stolen instead
  const steal = engine.noteOn(62, 100);
  assert.equal(steal[0].voice, 1);
  // key 60 up: v0 is released and freed (held 0 is still sent)
  assert.deepEqual(engine.noteOff(60), [{ voice: 0, params: [['held', 0]] }]);
  assert.equal(engine.noteOn(63, 100)[0].voice, 0);         // free now
});

test('voiceEnded ignores unknown / free voices and repeated reports', () => {
  const { engine } = polySetup(2, [60, 61]);
  assert.doesNotThrow(() => {
    engine.voiceEnded(5);
    engine.voiceEnded(-1);
    engine.voiceEnded(0);
  });
  engine.noteOn(60, 100);
  engine.noteOff(60);
  engine.voiceEnded(0);
  engine.voiceEnded(0);
  assert.deepEqual(engine.activeKeys(), []);
  assert.equal(engine.noteOn(61, 100)[0].voice, 0);
});

// ---------------------------------------------------------------------------
// Transport, panic, activeKeys
// ---------------------------------------------------------------------------

test('setTransport broadcasts bpm and playing and remembers the bpm', () => {
  const { engine } = posSetup({}, {});
  assert.deepEqual(engine.setTransport({ bpm: 140, playing: true }), [
    { voice: -1, params: [['bpm', 140], ['playing', 1]] }
  ]);
  near(pmap(engine.noteOn(60, 100)[0]).tapems, 60000 / 140);
  assert.deepEqual(engine.setTransport({ bpm: 90, playing: false }), [
    { voice: -1, params: [['bpm', 90], ['playing', 0]] }
  ]);
  near(pmap(engine.noteOn(60, 100)[0]).tapems, 60000 / 90);
});

test('panic kills every voice and clears held and modifier state', () => {
  const { model, engine, g } = mk({ numVoices: 4 });
  const src = model.addSource();
  model.addPad(60, src, 0);
  model.addPad(61, src, 1);
  g.pressureToLevel = true;
  engine.noteOn(60, 100);
  engine.noteOn(61, 100);
  engine.noteOn(MOD.RPT_4, 100);
  engine.noteOn(MOD.REVERSE, 100);
  const cmds = engine.panic();
  assert.equal(cmds.length, 4);
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1, 2, 3]);
  assert.ok(cmds.every(isKill));
  assert.deepEqual(engine.activeKeys(), []);
  assert.deepEqual(engine.noteOff(60), []);
  assert.deepEqual(engine.pressure(100), []);               // nothing held
  assert.deepEqual(engine.refreshHeld(), []);
  const p = pmap(engine.noteOn(60, 100)[0]);                // modifiers forgotten
  assert.equal(p.rptdiv, 0);
  assert.equal(p.dir, 1);
  assert.equal(p.trig, 2);                                  // counters keep increasing
  assert.deepEqual(engine.panic()[0], { voice: 0, params: [['kill', 2]] });
});

test('activeKeys is sorted and unique and uses the physical key', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  const l = model.addPad(null, src, 1);
  model.addPad(70, src, 0, { layers: [l.id] });
  model.addPad(65, src, 2);
  engine.noteOn(70, 100);                                   // 2 voices, 1 key
  engine.noteOn(65, 100);
  assert.deepEqual(engine.activeKeys(), [65, 70]);
});

// ---------------------------------------------------------------------------
// Unloaded sources
// ---------------------------------------------------------------------------

test('unloaded sources (frames 0 or sr 0) are skipped and choke nothing', () => {
  const { model, engine } = mk();
  const poly = model.addSource({ slot: 0 });
  const noFrames = model.addSource({ slot: 1, frames: 0, playMode: 'mono' });
  const noSr = model.addSource({ slot: 2, sr: 0, playMode: 'mono' });
  model.addPad(60, poly, 0);
  model.addPad(61, noFrames, 0);
  model.addPad(62, noSr, 0);
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(61, 100), []);
  assert.deepEqual(engine.noteOn(62, 100), []);
  assert.deepEqual(engine.activeKeys(), [60]);
});

test('pads whose slice or source is missing are skipped', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  const pad = model.addPad(60, src, 0);
  pad.sliceId = 987654;
  assert.deepEqual(engine.noteOn(60, 100), []);
});

// ===========================================================================
// v2: 16-key mod zone
// ===========================================================================

test('v2 mod zone: gesture keys are mod keys at offsets 12..15 and never allocate voices', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0);
  assert.equal(MOD.GEST_0, MOD_START + 12);
  assert.equal(MOD.GEST_3, MOD_START + 15);
  for (const k of [MOD.GEST_0, MOD.GEST_1, MOD.GEST_2, MOD.GEST_3]) {
    assert.deepEqual(starts(engine.noteOn(k, 100)), [], 'key ' + k);
  }
  assert.deepEqual(engine.activeKeys(), []);
  assert.equal(engine.noteOn(60, 100)[0].voice, 0);
});

// ===========================================================================
// v2: morph
// ===========================================================================

// One pad whose B values differ from A in every morphable way.
function morphSetup(padOpts = {}) {
  const ctx = mk();
  ctx.src = ctx.model.addSource({ slot: 1, frames: 48000, sr: 48000, slices: [[0, 4800], [4800, 9600]] });
  ctx.pad = ctx.model.addPad(60, ctx.src, 0, {
    pitch: 0, fine: 0, gainDb: 0, cutoffHz: 20000, drive: 0, decayMs: 100, sustain: 1,
    startOffsetMs: 0, loopOn: false, loopSizeMs: 30, loopPos: 0, reverse: false,
    morph: {
      pitch: 12, fine: 50, gainDb: -12, cutoffHz: 2000, drive: 1, decayMs: 300, sustain: 0.5,
      startOffsetMs: 40, loopOn: true, loopSizeMs: 60, loopPos: 1, reverse: true
    },
    ...padOpts
  });
  ctx.g.velSens = 0;                        // amp = pure gain
  return ctx;
}

test('morph: noteOn reads the pad through effectivePad(id, morph / 100)', () => {
  const { model, engine, g, pad } = morphSetup();
  // morph 0 => A
  let p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual(model.effectivePadCalls.pop(), [pad.id, 0]);
  near(p.pitch, 0);
  near(p.amp, 1);
  assert.equal(p.cutoff, 20000);
  assert.equal(p.drive, 0);
  assert.equal(p.dec, 100);
  assert.equal(p.sus, 1);
  assert.equal(p.loopon, 0);
  assert.deepEqual([p.pstart, p.pend, p.dir], [0, 4800, 1]);

  // morph 50 => halfway, cutoff geometric, booleans switch at 0.5
  g.morph = 50;
  p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual(model.effectivePadCalls.pop(), [pad.id, 0.5]);
  near(p.pitch, 6.25);                                  // 12/2 + 50 cents / 2
  near(p.amp, dbtoa(-6));
  near(p.cutoff, 20000 * Math.pow(0.1, 0.5));
  near(p.drive, 0.5);
  near(p.dec, 200);
  near(p.sus, 0.75);
  assert.equal(p.loopon, 1);
  near(p.loopsize, 0.045 * 48000);                      // 45 ms
  near(p.looppos, 0.5);
  assert.deepEqual([p.pstart, p.pend, p.dir], [4800 - 960, 0, -1]);   // reverse, 20 ms offset

  // morph 100 => B
  g.morph = 100;
  p = pmap(engine.noteOn(60, 100)[0]);
  assert.deepEqual(model.effectivePadCalls.pop(), [pad.id, 1]);
  near(p.pitch, 12.5);
  near(p.amp, dbtoa(-12));
  near(p.cutoff, 2000);
  near(p.drive, 1);
  near(p.dec, 300);
  near(p.sus, 0.5);
  assert.deepEqual([p.pstart, p.pend, p.dir], [4800 - 1920, 0, -1]);  // 40 ms offset
});

test('morph: layers are read through effectivePad too', () => {
  const { model, engine, g, src } = morphSetup();
  const layer = model.addPad(null, src, 1, { pitch: 0, morph: { pitch: -10 } });
  model.getPadOnKey(60).layers = [layer.id];
  g.morph = 100;
  const cmds = engine.noteOn(60, 100);
  assert.equal(cmds.length, 2);
  near(pmap(cmds[0]).pitch, 12.5);
  near(pmap(cmds[1]).pitch, -10);
  assert.ok(model.effectivePadCalls.some(([id, m]) => id === layer.id && m === 1));
});

test('morph: a pad without B values is unchanged at any morph; a model without effectivePad is fine', () => {
  const { model, engine, g } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0, { pitch: 3, cutoffHz: 5000, morph: {} });
  g.morph = 80;
  near(pmap(engine.noteOn(60, 100)[0]).pitch, 3);
  assert.equal(pmap(engine.noteOn(60, 100)[0]).cutoff, 5000);

  const plain = morphSetup();
  delete plain.model.effectivePad;              // v1-style model
  plain.g.morph = 100;
  const p = pmap(plain.engine.noteOn(60, 100)[0]);
  near(p.pitch, 0);                              // B ignored: the pad itself
  assert.equal(p.cutoff, 20000);
  assert.deepEqual(plain.engine.refreshMorph().map((c) => names(c)), [['pitch', 'amp', 'cutoff', 'drive']]);
});

test('refreshMorph: sounding voices get pitch, amp, cutoff and drive from the effective pad', () => {
  const { model, engine, g, src } = morphSetup();
  model.addPad(61, src, 1, { gainDb: -3, pitch: 2, morph: { pitch: 4, cutoffHz: 5000, drive: 0.4 } });
  engine.noteOn(60, 100);                        // v0
  engine.noteOn(61, 100);                        // v1
  g.morph = 100;
  const cmds = engine.refreshMorph();
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  for (const c of cmds) assert.deepEqual(names(c), ['pitch', 'amp', 'cutoff', 'drive']);
  let p = pmap(cmds[0]);
  near(p.pitch, 12.5); near(p.amp, dbtoa(-12)); near(p.cutoff, 2000); near(p.drive, 1);
  p = pmap(cmds[1]);
  near(p.pitch, 4); near(p.amp, dbtoa(-3)); near(p.cutoff, 5000); near(p.drive, 0.4);
  g.morph = 0;
  p = pmap(engine.refreshMorph()[0]);
  near(p.pitch, 0); near(p.amp, 1); near(p.cutoff, 20000); near(p.drive, 0);
});

test('refreshMorph: only sounding voices (released tails count, free and ended voices do not)', () => {
  const { model, engine, g, src } = morphSetup();
  for (const k of [61, 62, 63]) model.addPad(k, src, 1);
  assert.deepEqual(engine.refreshMorph(), []);   // nothing sounding
  engine.noteOn(60, 100);                        // v0 held
  engine.noteOn(61, 100);                        // v1 released tail
  engine.noteOff(61);
  engine.noteOn(62, 100);                        // v2 released and ended => free
  engine.noteOff(62);
  engine.voiceEnded(2);
  engine.noteOn(63, 100);                        // v2 again, held ...
  engine.voiceEnded(2);                          // ... and ended => silent
  g.morph = 100;
  assert.deepEqual(engine.refreshMorph().map((c) => c.voice), [0, 1]);
});

test('refreshMorph: keeps the stored velocity, the pressure level, octave mods; later mods use the new base', () => {
  const { engine, g } = morphSetup();
  g.velSens = 50;
  g.pressureToLevel = true;
  engine.noteOn(60, 64);
  g.morph = 100;
  near(pmap(engine.refreshMorph()[0]).amp, dbtoa(-12) * velCurve(64, 50));
  engine.pressure(120);                           // pressure replaces the velocity level
  g.morph = 50;
  near(pmap(engine.refreshMorph()[0]).amp, dbtoa(-6) * velCurve(120, 50));
  engine.noteOn(MOD.OCTUP, 100);
  near(pmap(engine.refreshMorph()[0]).pitch, 6.25 + 12);
  // pressure after a refresh uses the morphed gain
  near(pmap(engine.pressure(30)[0]).amp, dbtoa(-6) * velCurve(30, 50));
  // an octave modifier changing after a refresh uses the morphed pitch, not the stale one
  g.morph = 100;
  engine.refreshMorph();
  near(pmap(engine.noteOff(MOD.OCTUP)[0]).pitch, 12.5);
});

test('refreshMorph: layer voices follow their own pad', () => {
  const { model, engine, g, src } = morphSetup();
  const layer = model.addPad(null, src, 1, { pitch: 1, morph: { pitch: 9 } });
  model.getPadOnKey(60).layers = [layer.id];
  engine.noteOn(60, 100);
  g.morph = 100;
  const cmds = engine.refreshMorph();
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  near(pmap(cmds[0]).pitch, 12.5);
  near(pmap(cmds[1]).pitch, 9);
});

test('refreshMorph: skips voices whose pad is gone', () => {
  const { model, engine, g, pad } = morphSetup();
  engine.noteOn(60, 100);
  const orig = model.effectivePad;
  model.effectivePad = (id, m) => (id === pad.id ? null : orig(id, m));
  model.getPad = () => null;
  g.morph = 100;
  assert.deepEqual(engine.refreshMorph(), []);
});

// Gesture definition with every effect neutral (override what a test needs).
const NEUTRAL = {
  name: 'T', beats: 4, rateFrom: 'off', rateTo: 'off', cutFrom: 20000, cutTo: 20000,
  pitchFrom: 0, pitchTo: 0, ampFrom: 1, ampTo: 1, curve: 0
};

// ===========================================================================
// v2: scan
// ===========================================================================

// Four pads on keys 60..63, one slice each: pstart identifies the pad (0/100/200/300).
function scanSetup(engineOpts = {}) {
  const ctx = mk(engineOpts);
  ctx.src = ctx.model.addSource({ slices: [[0, 100], [100, 200], [200, 300], [300, 400]] });
  ctx.pads = [0, 1, 2, 3].map((i) => ctx.model.addPad(60 + i, ctx.src, i));
  return ctx;
}
const pstartOf = (cmds) => pmap(cmds[0]).pstart;

test('scan: rotates the occupied keys, wrapping around; scan 0 is the identity', () => {
  const { engine, g } = scanSetup();
  const table = (scan) => {
    g.scan = scan;
    return [60, 61, 62, 63].map((k) => pstartOf(engine.noteOn(k, 100)));
  };
  assert.deepEqual(table(0), [0, 100, 200, 300]);
  assert.deepEqual(table(10), [0, 100, 200, 300]);       // round(0.3) = 0
  assert.deepEqual(table(20), [100, 200, 300, 0]);       // round(0.6) = 1
  assert.deepEqual(table(34), [100, 200, 300, 0]);       // round(1.02) = 1
  assert.deepEqual(table(50), [200, 300, 0, 100]);       // round(1.5) = 2
  assert.deepEqual(table(70), [200, 300, 0, 100]);       // round(2.1) = 2
  assert.deepEqual(table(100), [300, 0, 100, 200]);      // n - 1 = 3: every key looks one to the left
  assert.deepEqual(table(0), [0, 100, 200, 300]);
});

test('scan: shift = round(scan / 100 * (n - 1)) over occupied keys, gaps ignored', () => {
  const { model, engine, g } = mk();
  const src = model.addSource({ slices: [[0, 100], [100, 200], [200, 300]] });
  model.addPad(40, src, 0);
  model.addPad(45, src, 1);
  model.addPad(50, src, 2);
  model.addPad(MOD.TAPE, src, 0);                          // stray pad on a mod key: not in occupiedKeys
  g.scan = 100;                                            // shift 2 of 3
  assert.deepEqual([40, 45, 50].map((k) => pstartOf(engine.noteOn(k, 100))), [200, 0, 100]);
  g.scan = 50;                                             // shift 1
  assert.deepEqual([40, 45, 50].map((k) => pstartOf(engine.noteOn(k, 100))), [100, 200, 0]);
});

test('scan: a single occupied key is never rotated; the rotated pad brings its layers and settings', () => {
  const solo = mk();
  const s = solo.model.addSource();
  solo.model.addPad(60, s, 0, { pitch: 5 });
  solo.g.scan = 100;
  near(pmap(solo.engine.noteOn(60, 100)[0]).pitch, 5);

  const { model, engine, g, src, pads } = scanSetup();
  const layer = model.addPad(null, src, 0, { pitch: 7 });
  pads[2].layers = [layer.id];
  pads[2].pitch = -2;
  g.scan = 50;                                             // key 60 plays the pad on 62
  const cmds = engine.noteOn(60, 100);
  assert.equal(cmds.length, 2);
  assert.equal(pmap(cmds[0]).pstart, 200);
  near(pmap(cmds[0]).pitch, -2);
  near(pmap(cmds[1]).pitch, 7);
  assert.deepEqual(engine.activeKeys(), [60]);             // physical key
  assert.deepEqual(engine.noteOff(60).map((c) => c.voice), [0, 1]);
});

test('scan: applied before chaos (chaos picks from the unrotated kit); scan alone never calls rng', () => {
  // no chaos: rng must not be consulted, key 61 -> pad on 60
  const quiet = scanSetup({ rng: () => { throw new Error('rng must not be called'); } });
  quiet.g.scan = 100;
  assert.equal(pstartOf(quiet.engine.noteOn(61, 100)), 0);

  // chaos fires: random occupied key 63 (index floor(0.9 * 4) = 3) wins, not its rotated neighbour
  const hit = scanSetup({ rng: seqRng(0.5, 0.9) });
  hit.g.scan = 100; hit.g.chaos = 100;
  assert.equal(pstartOf(hit.engine.noteOn(61, 100)), 300);

  // chaos misses (99 >= 50): the scan-rotated pad plays
  const miss = scanSetup({ rng: seqRng(0.99) });
  miss.g.scan = 100; miss.g.chaos = 50;
  assert.equal(pstartOf(miss.engine.noteOn(61, 100)), 0);

  // chaos modifier behaves like chaos 100: index 0 => the pad on 60, not the rotated one (63 -> 62 = 200)
  const mod = scanSetup({ rng: seqRng(0.0, 0.0) });
  mod.g.scan = 100;
  mod.engine.noteOn(MOD.CHAOS, 100);
  assert.equal(pstartOf(mod.engine.noteOn(63, 100)), 0);
});

test('scan: with the mod zone off its keys take part in the rotation', () => {
  const { model, engine, g } = mk();
  const src = model.addSource({ slices: [[0, 100], [100, 200]] });
  model.addPad(60, src, 0);
  model.addPad(100, src, 1);
  model.modZoneOn = false;
  g.scan = 100;
  assert.equal(pstartOf(engine.noteOn(60, 100)), 100);
  assert.equal(pstartOf(engine.noteOn(100, 100)), 0);
});

// Two sources with different sample rates / settings so a switch changes everything.
function scanVoiceSetup(engineOpts = {}) {
  const ctx = mk({ bufferName: (slot) => 'buf' + slot, ...engineOpts });
  const A = ctx.model.addSource({ slot: 0, frames: 10000, sr: 1000, slices: [[1000, 2000]] });
  const B = ctx.model.addSource({ slot: 3, frames: 20000, sr: 2000, playMode: 'thru', slices: [[4000, 6000]] });
  ctx.padA = ctx.model.addPad(60, A, 0, { pitch: 1, gainDb: -6, cutoffHz: 8000, drive: 0.1, loopSizeMs: 100, loopPos: 0.2 });
  ctx.padB = ctx.model.addPad(61, B, 0, {
    pitch: 3, fine: 50, gainDb: -12, cutoffHz: 2000, drive: 0.7, loopSizeMs: 500, loopPos: 0.9,
    startOffsetMs: 250, reverse: true
  });
  ctx.A = A; ctx.B = B;
  return ctx;
}

test('refreshScan: held main voices switch slice without trig or held', () => {
  const { engine, g } = scanVoiceSetup();
  g.velSens = 50;
  engine.noteOn(60, 64);                                   // v0 -> pad A
  engine.noteOn(61, 100);                                  // v1 -> pad B
  g.scan = 100;                                            // 60 -> pad B, 61 -> pad A
  const cmds = engine.refreshScan();
  assert.equal(cmds.length, 2);
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  const order = ['src', 'bufsr', 'pstart', 'pend', 'dir', 'loopsize', 'looppos', 'pitch', 'amp', 'cutoff', 'drive', 'jump'];
  for (const c of cmds) {
    assert.deepEqual(names(c), order);
    assert.ok(!names(c).includes('trig') && !names(c).includes('held'));
  }
  // voice 0 now plays pad B: reversed thru slice [4000, 6000) with a 250 ms (500 frame) offset
  const p0 = pmap(cmds[0]);
  assert.equal(p0.src, 'buf3');
  assert.equal(p0.bufsr, 2000);
  assert.deepEqual([p0.pstart, p0.pend, p0.dir], [5500, 0, -1]);
  assert.equal(p0.loopsize, 1000);                         // 500 ms at 2 kHz (slice is 2000 frames)
  assert.equal(p0.looppos, 0.9);
  near(p0.pitch, 3.5);
  near(p0.amp, dbtoa(-12) * velCurve(64, 50));             // stored velocity kept
  assert.equal(p0.cutoff, 2000);
  assert.equal(p0.drive, 0.7);
  // voice 1 now plays pad A
  const p1 = pmap(cmds[1]);
  assert.equal(p1.src, 'buf0');
  assert.equal(p1.bufsr, 1000);
  assert.deepEqual([p1.pstart, p1.pend, p1.dir], [1000, 2000, 1]);
  assert.equal(p1.loopsize, 100);
  near(p1.pitch, 1);
  near(p1.amp, dbtoa(-6) * velCurve(100, 50));
  assert.equal(p1.cutoff, 8000);
  assert.equal(p1.drive, 0.1);
  // idempotent until scan changes again; then it switches back
  assert.deepEqual(engine.refreshScan(), []);
  g.scan = 0;
  const back = engine.refreshScan();
  assert.equal(pmap(back[0]).src, 'buf0');
  assert.equal(pmap(back[1]).src, 'buf3');
  assert.deepEqual(engine.refreshScan(), []);
});

test('refreshScan: later modifiers, pressure and note off use the new slice of a switched voice', () => {
  const { engine, g } = scanVoiceSetup();
  g.pressureToLevel = true; g.velSens = 100;
  engine.noteOn(60, 100);                                  // pad A, forward, non-thru
  g.scan = 100;                                            // key 60 -> pad B (thru, reversed)
  engine.refreshScan();
  // B is reversed + thru: reverse modifier plays it forward to the end of the source
  assert.deepEqual(engine.noteOn(MOD.REVERSE, 100), [{ voice: 0, params: [['dir', 1], ['pend', 20000], ['redir', 1]] }]);
  assert.deepEqual(engine.noteOff(MOD.REVERSE), [{ voice: 0, params: [['dir', -1], ['pend', 0], ['redir', 2]] }]);
  near(pmap(engine.noteOn(MOD.OCTUP, 100)[0]).pitch, 3.5 + 12);
  near(pmap(engine.pressure(127)[0]).amp, dbtoa(-12));
  assert.deepEqual(engine.noteOff(60), [{ voice: 0, params: [['held', 0]] }]);
  assert.deepEqual(engine.activeKeys(), [60]);
});

test('refreshScan: applies the current reverse modifier, morph and gesture to the new slice', () => {
  const clock = { t: 0 };
  const { engine, g, padB } = scanVoiceSetup({ now: () => clock.t });
  padB.morph = { pitch: 10, cutoffHz: 200 };               // at morph 100: pitch 10 (+ 50 cents), cutoff 200
  g.morph = 100;
  g.gestures[0] = { ...NEUTRAL, pitchFrom: 1, pitchTo: 1, ampFrom: 0.5, ampTo: 0.5 };
  engine.noteOn(MOD.GEST_0, 100);
  engine.noteOn(MOD.REVERSE, 100);
  engine.noteOn(60, 127);                                  // pad A, played reversed by the modifier
  g.scan = 100;                                            // -> pad B (reversed pad), flipped to forward
  const p = pmap(engine.refreshScan()[0]);
  assert.deepEqual([p.pstart, p.pend, p.dir], [4500, 20000, 1]);
  near(p.pitch, 10.5 + 1);                                 // morphed pad + gesture pitch
  assert.equal(p.cutoff, 200);
  near(p.amp, dbtoa(-12) * velCurve(127, 50) * 0.5);       // gesture amp
});

test('refreshScan: layers, released voices and non-main voices are left alone', () => {
  const { model, engine, g, src, pads } = scanSetup();
  const layer = model.addPad(null, src, 3);
  pads[0].layers = [layer.id];
  engine.noteOn(60, 100);                                  // v0 main + v1 layer
  engine.noteOn(61, 100);                                  // v2
  engine.noteOff(61);                                      // released tail
  g.scan = 100;
  const cmds = engine.refreshScan();
  assert.deepEqual(cmds.map((c) => c.voice), [0]);         // only the held main voice
  assert.equal(pmap(cmds[0]).pstart, 300);                 // key 60 -> pad on 63
  assert.deepEqual(engine.refreshScan(), []);
});

test('refreshScan: a note started under scan is already in sync; no held voices => nothing', () => {
  const { engine, g } = scanSetup();
  assert.deepEqual(engine.refreshScan(), []);
  g.scan = 100;
  engine.noteOn(61, 100);                                  // maps to the pad on 60
  assert.deepEqual(engine.refreshScan(), []);
  engine.noteOff(61);
  g.scan = 50;
  assert.deepEqual(engine.refreshScan(), []);              // released
  assert.deepEqual(engine.refreshScan(), []);
});

test('refreshScan: chaos substitutions are only replaced when the key mapping really changes', () => {
  const ctx = mk({ rng: seqRng(0.0, 0.99) });              // chaos fires, picks the pad on 63
  const src = ctx.model.addSource({ slices: [[0, 100], [100, 200], [200, 300], [300, 400]] });
  [0, 1, 2, 3].forEach((i) => ctx.model.addPad(60 + i, src, i));
  ctx.g.chaos = 100;
  assert.equal(pstartOf(ctx.engine.noteOn(60, 100)), 300);
  assert.deepEqual(ctx.engine.refreshScan(), []);          // scan unchanged: keep the random pad
  ctx.g.scan = 100;                                        // key 60 now maps to the pad on 63 ...
  const cmds = ctx.engine.refreshScan();
  assert.equal(cmds.length, 1);                            // ... which differs from what it mapped to (60)
  assert.equal(pmap(cmds[0]).pstart, 300);
});

test('refreshScan: skips voices whose new pad cannot be played', () => {
  const { model, engine, g, src } = scanSetup();
  const dead = model.addSource({ frames: 0, sr: 0 });
  model.addPad(70, dead, 0);                               // 5th occupied key, unloaded source
  engine.noteOn(60, 100);
  g.scan = 100;                                            // shift 4: key 60 -> 70
  assert.deepEqual(engine.refreshScan(), []);
  assert.ok(src);
});

// ===========================================================================
// v2: gestures
// ===========================================================================

function gmk(padOpts = {}, engineOpts = {}) {
  const clock = { t: 1000 };
  const ctx = mk({ now: () => clock.t, ...engineOpts });
  ctx.clock = clock;
  ctx.g.velSens = 0;                                       // amp = pure gain
  ctx.src = ctx.model.addSource();
  ctx.pad = ctx.model.addPad(60, ctx.src, 0, padOpts);
  ctx.setGest = (i, o) => { ctx.g.gestures[i] = { ...NEUTRAL, ...o }; };
  // at(ms) = ms after the clock origin (t = 1000)
  ctx.at = (ms) => { ctx.clock.t = 1000 + ms; return ctx.engine; };
  return ctx;
}

test('gesture: needsTick is true only while a gesture modifier is held', () => {
  const { engine } = gmk();
  assert.equal(engine.needsTick(), false);
  engine.noteOn(MOD.OCTUP, 100);
  engine.noteOn(MOD.RPT_4, 100);
  assert.equal(engine.needsTick(), false);                 // other modifiers do not count
  engine.noteOn(MOD.GEST_1, 100);
  assert.equal(engine.needsTick(), true);
  engine.noteOn(MOD.GEST_3, 100);
  engine.noteOff(MOD.GEST_1);
  assert.equal(engine.needsTick(), true);                  // GEST_3 still down
  engine.noteOff(MOD.GEST_3);
  assert.equal(engine.needsTick(), false);
  engine.noteOn(MOD.GEST_0, 100);
  assert.equal(engine.needsTick(), true);
  engine.noteOn(MOD.GEST_0, 0);                            // velocity 0 = release
  assert.equal(engine.needsTick(), false);
  engine.noteOn(MOD.GEST_2, 100);
  engine.panic();
  assert.equal(engine.needsTick(), false);
  assert.deepEqual(engine.tick(), []);
});

test('gesture: tick without a held gesture sends nothing', () => {
  const { engine, at } = gmk();
  engine.noteOn(60, 100);
  assert.deepEqual(at(5000).tick(), []);
});

test('gesture cutoff: geometric from -> to over beats*60000/bpm, clamped, then held', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { cutFrom: 20000, cutTo: 1000, beats: 4 });   // 2000 ms at the default 120 bpm
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.GEST_0, 100), []);    // t = 0: same cutoff as the pad
  assert.deepEqual(at(0).tick(), []);
  let cmds = at(1000).tick();                              // halfway: 20000 * 0.05^0.5
  assert.equal(cmds.length, 1);
  assert.deepEqual(names(cmds[0]), ['cutoff']);
  near(pmap(cmds[0]).cutoff, 20000 * Math.sqrt(0.05));
  cmds = at(500).tick();                                   // clock may go back: 0.25 -> 20000 * 0.05^0.25
  near(pmap(cmds[0]).cutoff, 20000 * Math.pow(0.05, 0.25));
  cmds = at(2000).tick();                                  // end
  assert.equal(cmds.length, 1);
  assert.deepEqual(names(cmds[0]), ['cutoff']);
  near(pmap(cmds[0]).cutoff, 1000);
  assert.deepEqual(at(9000).tick(), []);                   // held at the end value, nothing new
  assert.deepEqual(at(60000).tick(), []);
});

test('gesture cutoff: multiplies the pad cutoff (g / 20000) and clamps to 20..20000', () => {
  const { engine, at, setGest } = gmk({ cutoffHz: 5000 });
  setGest(0, { cutFrom: 20000, cutTo: 1000 });
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  near(pmap(at(2000).tick()[0]).cutoff, 250);              // 5000 * 1000 / 20000
  near(pmap(at(1000).tick()[0]).cutoff, 5000 * Math.sqrt(0.05));

  const low = gmk({ cutoffHz: 100 });
  low.setGest(0, { cutFrom: 20000, cutTo: 20 });
  low.engine.noteOn(60, 100);
  low.engine.noteOn(MOD.GEST_0, 100);
  assert.equal(pmap(low.at(2000).tick()[0]).cutoff, 20);   // 100 * 20 / 20000 = 0.1 -> 20
  // a new note started inside the clamp range gets the clamped value, too
  assert.equal(pmap(low.engine.noteOn(60, 100)[0]).cutoff, 20);
});

test('gesture pitch: adds semitones on top of pad pitch and octave modifiers', () => {
  const { engine, at, setGest } = gmk({ pitch: 2, fine: 50 });
  setGest(1, { pitchFrom: 0, pitchTo: 12 });
  engine.noteOn(60, 100);                                  // base 2.5
  engine.noteOn(MOD.OCTUP, 100);                           // 14.5
  engine.noteOn(MOD.GEST_1, 100);
  let cmds = at(1000).tick();                              // +6
  assert.deepEqual(names(cmds[0]), ['pitch']);
  near(pmap(cmds[0]).pitch, 14.5 + 6);
  near(pmap(at(500).tick()[0]).pitch, 14.5 + 3);
  near(pmap(at(2000).tick()[0]).pitch, 14.5 + 12);
  // an octave modifier changing during the gesture keeps the gesture offset (end: +12)
  near(pmap(engine.noteOn(MOD.OCTDOWN, 100)[0]).pitch, 2.5 + 0 + 12);
  near(pmap(engine.noteOff(MOD.OCTDOWN)[0]).pitch, 2.5 + 12 + 12);
});

test('gesture pitch: negative ramps and from != 0', () => {
  const { engine, at, setGest } = gmk();
  setGest(2, { pitchFrom: -3, pitchTo: -27, beats: 2 });   // 1000 ms
  engine.noteOn(60, 100);
  near(pmap(engine.noteOn(MOD.GEST_2, 100)[0]).pitch, -3);   // t = 0 value lands at press
  near(pmap(at(500).tick()[0]).pitch, -15);
  near(pmap(at(1000).tick()[0]).pitch, -27);
});

test('gesture amp: multiplies gain x velocity, also for pressure', () => {
  const { engine, at, setGest, g } = gmk({ gainDb: -6 });
  g.velSens = 50;
  setGest(3, { ampFrom: 1, ampTo: 0 });
  engine.noteOn(60, 64);
  const base = dbtoa(-6) * velCurve(64, 50);
  engine.noteOn(MOD.GEST_3, 100);
  near(pmap(at(500).tick()[0]).amp, base * 0.75);
  near(pmap(at(1000).tick()[0]).amp, base * 0.5);
  const end = at(2000).tick();
  assert.deepEqual(end, [{ voice: 0, params: [['amp', 0]] }]);   // lands exactly on the end value
  g.pressureToLevel = true;
  at(1000);
  near(pmap(engine.pressure(127)[0]).amp, dbtoa(-6) * 0.5);
});

test('gesture amp: ampFrom > ampTo and ampTo > 1 are both fine', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { ampFrom: 0.2, ampTo: 1.5 });
  engine.noteOn(60, 127);
  near(pmap(engine.noteOn(MOD.GEST_0, 100)[0]).amp, 0.2 * velCurve(127, 0));
  near(pmap(at(2000).tick()[0]).amp, 1.5);
});

test('gesture curve: u = t^(1 + 4 * curve)', () => {
  const probe = (curve, t) => {
    const { engine, at, setGest } = gmk();
    setGest(0, { pitchFrom: 0, pitchTo: 10, curve });
    engine.noteOn(60, 100);
    engine.noteOn(MOD.GEST_0, 100);
    return pmap(at(2000 * t).tick()[0]).pitch;
  };
  near(probe(0, 0.5), 5);
  near(probe(0.5, 0.5), 10 * Math.pow(0.5, 3));
  near(probe(1, 0.5), 10 * Math.pow(0.5, 5));
  near(probe(0.3, 0.8), 10 * Math.pow(0.8, 2.2));
  near(probe(1, 1), 10);
  // the curve also shapes the cutoff
  const { engine, at, setGest } = gmk();
  setGest(0, { cutFrom: 20000, cutTo: 2000, curve: 1 });
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  near(pmap(at(1000).tick()[0]).cutoff, 20000 * Math.pow(0.1, Math.pow(0.5, 5)));
});

test('gesture rate: log2 interpolation snapped to the repeat grid, in both directions', () => {
  const run = (from, to, probes) => {
    const { engine, at, setGest } = gmk();
    setGest(0, { rateFrom: from, rateTo: to });
    engine.noteOn(60, 100);
    let cur = pmap(engine.noteOn(MOD.GEST_0, 100)[0]).rptdiv;   // t = 0 lands at press
    const seen = [cur];
    for (const [t, expected] of probes) {
      const cmds = at(2000 * t).tick();
      if (cmds.length) {
        assert.deepEqual(names(cmds[0]), ['rptdiv', 'rptswing', 'rptalt'], 't=' + t);
        cur = pmap(cmds[0]).rptdiv;
      }
      assert.equal(cur, expected, from + '->' + to + ' at t=' + t);
      seen.push(cur);
    }
    return seen;
  };
  // 1/4 (1) -> 1/64 (16): log2 0 -> 4
  assert.deepEqual(run('1/4', '1/64', [[0, 1], [0.1, 1], [0.25, 2], [0.4, 3], [0.5, 4], [0.65, 6], [0.75, 8], [0.9, 12], [1, 16]]),
    [1, 1, 1, 2, 3, 4, 6, 8, 12, 16]);
  // and back: 1/64 -> 1/4
  run('1/64', '1/4', [[0, 16], [0.25, 8], [0.5, 4], [0.75, 2], [1, 1]]);
  // 1/8 -> 1/16T (2 -> 6): L = 1 + 1.585 u
  run('1/8', '1/16T', [[0.05, 2], [0.2, 3], [0.6, 4], [0.9, 6], [1, 6]]);
  // equal ends: constant, nothing to send after the press
  const { engine, at, setGest } = gmk();
  setGest(0, { rateFrom: '1/16', rateTo: '1/16' });
  engine.noteOn(60, 100);
  assert.equal(pmap(engine.noteOn(MOD.GEST_0, 100)[0]).rptdiv, 4);
  assert.deepEqual(at(1000).tick(), []);
  assert.deepEqual(at(2000).tick(), []);
});

test('gesture rate: swing and alt travel with rptdiv; the press already applies the t = 0 rate', () => {
  const { engine, g, setGest } = gmk();
  g.swing = 30; g.repeatAlt = true;
  setGest(0, { rateFrom: '1/8', rateTo: '1/64' });
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.GEST_0, 100), [
    { voice: 0, params: [['rptdiv', 2], ['rptswing', 0.3], ['rptalt', 1]] }
  ]);
});

test("gesture rate: 'off' on both ends leaves the repeat (global and modifier) alone", () => {
  const { engine, at, setGest, g } = gmk();
  setGest(0, { rateFrom: 'off', rateTo: 'off', pitchTo: 12 });
  g.repeatOn = true; g.repeatDiv = '1/8';
  engine.noteOn(60, 100);                                  // rptdiv 2
  assert.deepEqual(engine.noteOn(MOD.GEST_0, 100), []);
  engine.noteOn(MOD.RPT_16, 100);                          // modifier => 4
  const cmds = at(1000).tick();
  assert.deepEqual(names(cmds[0]), ['pitch']);             // only pitch moves
  assert.equal(pmap(engine.noteOn(60, 100)[0]).rptdiv, 4);
  assert.deepEqual(engine.noteOff(MOD.RPT_16).map(pmap).map((p) => p.rptdiv), [2, 2]);
  assert.ok(engine.noteOff(MOD.GEST_0).every((c) => !names(c).includes('rptdiv')));
});

test("gesture rate: one end 'off' uses the other end for the whole gesture", () => {
  for (const [from, to, expected] of [['off', '1/16', 4], ['1/8', 'off', 2], ['off', '1/32T', 12]]) {
    const { engine, at, setGest } = gmk();
    setGest(0, { rateFrom: from, rateTo: to });
    engine.noteOn(60, 100);
    const press = engine.noteOn(MOD.GEST_0, 100);
    assert.equal(pmap(press[0]).rptdiv, expected, from + '->' + to);
    assert.deepEqual(at(700).tick(), [], 'constant mid');
    assert.deepEqual(at(2000).tick(), [], 'constant end');
    assert.equal(pmap(engine.noteOn(60, 100)[0]).rptdiv, expected);
  }
});

test('gesture rate: priority gesture > repeat modifier > global repeat, and release falls back in order', () => {
  const { engine, g, setGest } = gmk();
  setGest(0, { rateFrom: '1/16', rateTo: '1/16' });         // 4
  g.repeatOn = true; g.repeatDiv = '1/8';                   // global 2
  engine.noteOn(60, 100);
  assert.equal(pmap(engine.noteOn(MOD.RPT_4, 100)[0]).rptdiv, 1);   // modifier beats global
  assert.equal(pmap(engine.noteOn(MOD.GEST_0, 100)[0]).rptdiv, 4);  // gesture beats the modifier
  assert.equal(pmap(engine.noteOn(60, 100)[0]).rptdiv, 4);          // new notes too
  // pressing / releasing a repeat modifier while the gesture holds the rate: still the gesture's
  assert.equal(pmap(engine.noteOn(MOD.RPT_64, 100)[0]).rptdiv, 4);
  assert.equal(pmap(engine.noteOff(MOD.RPT_64)[0]).rptdiv, 4);
  assert.equal(engine.refreshHeld()[0].params[0][1], 4);
  const rel = engine.noteOff(MOD.GEST_0);
  assert.equal(pmap(rel[0]).rptdiv, 1);                              // back to the modifier
  assert.equal(pmap(engine.noteOff(MOD.RPT_4)[0]).rptdiv, 2);        // then global
});

test('gesture: notes started while it is held get the current gesture values, and stay in sync', () => {
  const { engine, at, setGest } = gmk({ gainDb: -6, cutoffHz: 10000, pitch: 1 });
  setGest(0, { rateFrom: '1/8', rateTo: '1/8', cutFrom: 20000, cutTo: 1000, pitchFrom: 0, pitchTo: 12, ampFrom: 1, ampTo: 0.5 });
  engine.noteOn(MOD.GEST_0, 100);
  at(1000);                                                // halfway
  const c = engine.noteOn(60, 127);
  const p = pmap(c[0]);
  near(p.pitch, 1 + 6);
  near(p.amp, dbtoa(-6) * 1 * 0.75);
  near(p.cutoff, 10000 * Math.sqrt(0.05));
  assert.equal(p.rptdiv, 2);
  assert.deepEqual(engine.tick(), []);                     // already in sync at this instant
  const end = at(2000).tick();
  assert.equal(end.length, 1);
  assert.deepEqual(names(end[0]), ['cutoff', 'pitch', 'amp']);
  near(pmap(end[0]).pitch, 13);
  near(pmap(end[0]).amp, dbtoa(-6) * 0.5);
  near(pmap(end[0]).cutoff, 10000 * 1000 / 20000);
});

test('gesture: release reverts every parameter, including rate, on all sounding voices', () => {
  const { engine, at, setGest, g, src, model } = gmk({ gainDb: -3, cutoffHz: 12000, pitch: 2 });
  model.addPad(61, src, 1, { cutoffHz: 20000 });
  g.repeatOn = true; g.repeatDiv = '1/16'; g.swing = 10;
  setGest(0, { rateFrom: '1/4', rateTo: '1/64', cutTo: 2000, pitchTo: -12, ampTo: 0.25 });
  engine.noteOn(60, 100);                                  // v0
  engine.noteOn(61, 100);                                  // v1
  engine.noteOff(61);                                      // v1 released tail, still sounding
  engine.noteOn(MOD.GEST_0, 100);
  assert.ok(at(2000).tick().length === 2);
  const rel = engine.noteOff(MOD.GEST_0);
  assert.deepEqual(rel.map((c) => c.voice), [0, 1]);
  const base0 = dbtoa(-3) * velCurve(100, 0);
  let p = pmap(rel[0]);
  assert.deepEqual(p, { rptdiv: 4, rptswing: 0.1, rptalt: 0, cutoff: 12000, pitch: 2, amp: base0 });
  p = pmap(rel[1]);
  assert.equal(p.rptdiv, 4);
  assert.equal(p.cutoff, 20000);
  near(p.pitch, 0);
  assert.equal(engine.needsTick(), false);
  assert.deepEqual(engine.tick(), []);
});

test('gesture: releasing right after the press restores only the rate', () => {
  const { engine, setGest } = gmk();
  setGest(0, { rateFrom: '1/8', rateTo: '1/64', cutTo: 1000 });
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  assert.deepEqual(engine.noteOff(MOD.GEST_0), [{ voice: 0, params: [['rptdiv', 0], ['rptswing', 0], ['rptalt', 0]] }]);
});

test('gesture: the most recently pressed gesture is active; releasing it falls back to the older one', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { pitchFrom: 0, pitchTo: 12, beats: 4 });       // 2000 ms
  setGest(1, { pitchFrom: 0, pitchTo: -12, beats: 2 });      // 1000 ms
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);                           // t0 = 0
  near(pmap(at(1000).tick()[0]).pitch, 6);
  // GEST_1 pressed at 1000 ms: switches (its t = 0 value) and restarts the clock
  const sw = at(1000).noteOn(MOD.GEST_1, 100);
  near(pmap(sw[0]).pitch, 0);
  near(pmap(at(1500).tick()[0]).pitch, -6);
  near(pmap(at(2000).tick()[0]).pitch, -12);
  assert.deepEqual(at(2400).tick(), []);                     // GEST_1 finished and holds
  // releasing GEST_1 falls back to GEST_0 which kept its own start time: 2400 / 2000 -> end
  const back = at(2400).noteOff(MOD.GEST_1);
  near(pmap(back[0]).pitch, 12);
  assert.equal(engine.needsTick(), true);
  assert.deepEqual(at(2500).tick(), []);                     // GEST_0 already finished
  near(pmap(engine.noteOff(MOD.GEST_0)[0]).pitch, 0);
  assert.equal(engine.needsTick(), false);
});

test('gesture: releasing the older of two held gestures changes nothing', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { pitchTo: 12 });
  setGest(1, { pitchTo: -12 });
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  at(500).noteOn(MOD.GEST_1, 100);
  const cmds = at(1000).tick();
  near(pmap(cmds[0]).pitch, -12 * 0.25);                     // GEST_1: 500 of 2000 ms
  assert.deepEqual(engine.noteOff(MOD.GEST_0), []);          // not the active one
  assert.equal(engine.needsTick(), true);
  assert.deepEqual(at(1000).tick(), []);
});

test('gesture: duration follows the transport bpm (default 120)', () => {
  const run = (bpmValue) => {
    const { engine, at, setGest } = gmk();
    if (bpmValue) engine.setTransport({ bpm: bpmValue, playing: true });
    setGest(0, { pitchTo: 8, beats: 2 });
    engine.noteOn(60, 100);
    engine.noteOn(MOD.GEST_0, 100);
    return (ms) => (at(ms), engine.tick().map(pmap));
  };
  const d120 = run(0);                                       // 2 beats = 1000 ms
  near(d120(500)[0].pitch, 4);
  near(d120(1000)[0].pitch, 8);
  const d60 = run(60);                                       // 2000 ms
  near(d60(1000)[0].pitch, 4);
  near(d60(2000)[0].pitch, 8);
  const d240 = run(240);                                     // 500 ms
  near(d240(250)[0].pitch, 4);
  near(d240(500)[0].pitch, 8);
});

test('gesture: definitions are read at tick time (edits while held apply)', () => {
  const { engine, at, g, setGest } = gmk();
  setGest(0, { pitchTo: 12 });
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  near(pmap(at(1000).tick()[0]).pitch, 6);
  g.gestures[0].pitchTo = 24;                                // edited while held
  near(pmap(engine.tick()[0]).pitch, 12);
  g.gestures[0].beats = 8;                                   // longer: 1000 / 4000
  near(pmap(engine.tick()[0]).pitch, 6);
});

test('gesture: tick emits only what changed (epsilon on cutoff, pitch and amp)', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { pitchTo: 12, cutFrom: 20000, cutTo: 1000, ampTo: 0 });   // 2000 ms
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  assert.deepEqual(at(0).tick(), []);
  assert.deepEqual(at(0).tick(), []);
  // per ms: pitch +0.006 st, amp -0.0005, cutoff about -0.15 %. 1 ms is below every threshold.
  assert.deepEqual(at(1).tick(), []);
  // 2 ms: pitch 0.012 > 0.01 st; cutoff 0.3 % < 0.5 %; amp 0.001 < 0.002
  let cmds = at(2).tick();
  assert.equal(cmds.length, 1);
  assert.deepEqual(names(cmds[0]), ['pitch']);
  near(pmap(cmds[0]).pitch, 0.012);
  // 3 ms: pitch only 0.006 further than what was sent, cutoff 0.45 %, amp 0.0015
  assert.deepEqual(at(3).tick(), []);
  // 5 ms: pitch 0.018 further, cutoff 0.75 % and amp 0.0025 are past their thresholds
  cmds = at(5).tick();
  assert.deepEqual(names(cmds[0]).sort(), ['amp', 'cutoff', 'pitch']);
  assert.deepEqual(at(5).tick(), []);                        // same instant: nothing new
  // far past the end: lands exactly on the end values, then silence
  cmds = at(100000).tick();
  near(pmap(cmds[0]).pitch, 12);
  near(pmap(cmds[0]).amp, 0);
  near(pmap(cmds[0]).cutoff, 1000);
  assert.deepEqual(at(200000).tick(), []);
});

test('gesture: the last tiny step still lands (end of the ramp is exact, not epsilon-limited)', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { pitchTo: 0.005, ampTo: 0.999 });              // total movement below every epsilon
  engine.noteOn(60, 100);
  engine.noteOn(MOD.GEST_0, 100);
  assert.deepEqual(at(1999).tick(), []);                     // not complete yet, below epsilon
  const cmds = at(2000).tick();
  assert.deepEqual(names(cmds[0]).sort(), ['amp', 'pitch']);
  near(pmap(cmds[0]).pitch, 0.005);
  near(pmap(cmds[0]).amp, 0.999);
});

test('gesture: a gesture that changes nothing never emits', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, {});                                            // neutral, rate off/off
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.GEST_0, 100), []);
  for (const ms of [0, 10, 500, 1999, 2000, 5000]) assert.deepEqual(at(ms).tick(), [], 'ms ' + ms);
  assert.deepEqual(engine.noteOff(MOD.GEST_0), []);
});

test('gesture: applies to layer voices and released tails, not to free or ended voices', () => {
  const { model, engine, at, setGest, src } = gmk();
  const layer = model.addPad(null, src, 1, { cutoffHz: 10000 });
  model.getPadOnKey(60).layers = [layer.id];
  model.addPad(61, src, 2);
  model.addPad(62, src, 3);
  setGest(0, { cutTo: 2000 });
  engine.noteOn(60, 100);                                    // v0 main, v1 layer
  engine.noteOn(61, 100);                                    // v2
  engine.noteOff(61);                                        // released tail
  engine.noteOn(62, 100);                                    // v3
  engine.voiceEnded(3);                                      // held + ended => silent
  engine.noteOn(MOD.GEST_0, 100);
  const cmds = at(2000).tick();
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1, 2]);
  near(pmap(cmds[1]).cutoff, 10000 * 2000 / 20000);
});

test('gesture: without gesture definitions in the globals it is inert but does not throw', () => {
  const { engine, at, g } = gmk();
  delete g.gestures;
  engine.noteOn(60, 100);
  assert.deepEqual(engine.noteOn(MOD.GEST_2, 100), []);
  assert.equal(engine.needsTick(), true);
  assert.deepEqual(at(1000).tick(), []);
  g.gestures = [];                                           // definition missing for this index
  assert.deepEqual(at(2000).tick(), []);
  assert.deepEqual(engine.noteOff(MOD.GEST_2), []);
});

test('gesture: the press time is the clock at press, not at creation (default clock works too)', () => {
  const { engine, at, setGest } = gmk();
  setGest(0, { pitchTo: 10 });
  engine.noteOn(60, 100);
  at(7000).noteOn(MOD.GEST_0, 100);                           // pressed 7 s after the origin
  near(pmap(at(8000).tick()[0]).pitch, 5);

  const real = mk();                                           // no `now` injected => Date.now
  const src = real.model.addSource();
  real.model.addPad(60, src, 0);
  real.engine.noteOn(60, 100);
  real.engine.noteOn(MOD.GEST_1, 100);                         // Rise: pitch 0 -> 12 over 4 beats
  assert.ok(Array.isArray(real.engine.tick()));
  assert.equal(real.engine.needsTick(), true);
});

test('gesture + morph + scan: refreshMorph and refreshScan keep the gesture factors on top', () => {
  const { model, engine, at, setGest, g, src } = gmk({ cutoffHz: 20000, morph: { cutoffHz: 2000, gainDb: -6 } });
  model.addPad(61, src, 1, { cutoffHz: 8000, gainDb: -12 });
  setGest(0, { cutFrom: 20000, cutTo: 10000, pitchFrom: 3, pitchTo: 3, ampFrom: 0.5, ampTo: 0.5 });
  engine.noteOn(60, 127);
  engine.noteOn(MOD.GEST_0, 100);
  g.morph = 100;
  const m = pmap(engine.refreshMorph()[0]);
  near(m.cutoff, 2000);                                       // t = 0: factor 1
  near(m.pitch, 3);
  near(m.amp, dbtoa(-6) * 0.5);
  near(pmap(at(2000).tick()[0]).cutoff, 1000);                // 2000 * 10000 / 20000
  g.scan = 100;                                               // key 60 -> pad on 61 (2 occupied keys)
  const s = pmap(engine.refreshScan()[0]);
  near(s.cutoff, 8000 * 0.5);
  near(s.pitch, 3);
  near(s.amp, dbtoa(-12) * 0.5);
});

// ===========================================================================
// v2 fixes: jump / redir counters, resuming ended held voices
// ===========================================================================

test('jump: refreshScan ends with a per-voice jump counter (1, 2, ...), independent of trig', () => {
  const { engine, g } = scanVoiceSetup();
  engine.noteOn(60, 100);                                  // v0 trig 1
  engine.noteOn(61, 100);                                  // v1 trig 1
  g.scan = 100;
  let cmds = engine.refreshScan();
  for (const c of cmds) assert.equal(c.params[c.params.length - 1][0], 'jump', 'jump is the last param');
  assert.deepEqual(cmds.map((c) => pmap(c).jump), [1, 1]);
  g.scan = 0;
  cmds = engine.refreshScan();
  assert.deepEqual(cmds.map((c) => pmap(c).jump), [2, 2]);
  g.scan = 100;
  assert.deepEqual(engine.refreshScan().map((c) => pmap(c).jump), [3, 3]);
  assert.deepEqual(engine.refreshScan(), []);               // nothing switched: no jump sent
  // trig is untouched by jumps: restarting a voice still counts trig on its own
  g.scan = 0;
  const next = starts(engine.noteOn(60, 100));              // pad A (poly): no choke, free voice v2
  assert.equal(next.length, 1);
  assert.equal(pmap(next[0]).trig, 1);
  assert.ok(!names(next[0]).includes('jump'));
});

test('jump: a voice that switched twice while another switched once has its own count', () => {
  const { engine, g } = scanVoiceSetup();
  engine.noteOn(60, 100);                                  // v0
  g.scan = 100;
  engine.refreshScan();                                    // v0 jump 1
  engine.noteOn(61, 100);                                  // v1, maps to pad A (scan 100)
  g.scan = 0;
  const cmds = engine.refreshScan();
  assert.deepEqual(cmds.map((c) => [c.voice, pmap(c).jump]), [[0, 2], [1, 1]]);
});

test('redir: the reverse modifier ends dir, pend with a per-voice redir counter', () => {
  const { model, engine } = mk();
  const src = model.addSource();
  model.addPad(60, src, 0);
  model.addPad(61, src, 1, { reverse: true });
  engine.noteOn(60, 100);                                  // v0 forward
  engine.noteOn(61, 100);                                  // v1 reversed pad
  let cmds = engine.noteOn(MOD.REVERSE, 100);
  assert.deepEqual(cmds, [
    { voice: 0, params: [['dir', -1], ['pend', 0], ['redir', 1]] },
    { voice: 1, params: [['dir', 1], ['pend', 2000], ['redir', 1]] }
  ]);
  cmds = engine.noteOff(MOD.REVERSE);
  assert.deepEqual(cmds, [
    { voice: 0, params: [['dir', 1], ['pend', 1000], ['redir', 2]] },
    { voice: 1, params: [['dir', -1], ['pend', 1000], ['redir', 2]] }
  ]);
  // a voice started while reverse is held first flips on release with redir 1
  engine.noteOn(MOD.REVERSE, 100);                         // v0 redir 3, v1 redir 3
  const born = engine.noteOn(60, 100);                     // v2, started reversed
  assert.ok(!names(born[0]).includes('redir'));
  const rel = engine.noteOff(MOD.REVERSE);
  assert.deepEqual(rel.map((c) => [c.voice, pmap(c).redir]), [[0, 4], [1, 4], [2, 1]]);
  // redir is independent of trig: a fresh voice still counts its own trig from 1
  const fresh = engine.noteOn(60, 100)[0];
  assert.equal(fresh.voice, 3);
  assert.equal(pmap(fresh).trig, 1);
});

test('redir: unchanged direction sends nothing; thru and XOR cases still end with redir', () => {
  const { engine } = posSetup({ playMode: 'thru' }, { reverse: true });
  engine.noteOn(60, 100);                                  // reversed thru pad: dir -1
  const cmds = engine.noteOn(MOD.REVERSE, 100);            // plays forward
  assert.deepEqual(cmds, [{ voice: 0, params: [['dir', 1], ['pend', 10000], ['redir', 1]] }]);
  assert.deepEqual(engine.noteOn(MOD.OCTUP, 100).map((c) => names(c)), [['pitch']]);   // other mods: no redir
  assert.deepEqual(engine.noteOn(MOD.TAPE, 100).map((c) => names(c)), [['tape', 'tapems']]);
});

// An ended held voice: a one-shot that ran out while its key is still down.
function endedSetup(padOpts = {}, gOpts = {}) {
  const ctx = gmk({ gainDb: -6, pitch: 2, ...padOpts });
  Object.assign(ctx.g, { velSens: 50 }, gOpts);
  ctx.engine.noteOn(60, 90);                               // v0 held, trig 1, rptdiv 0
  ctx.engine.voiceEnded(0);                                // finished while held
  return ctx;
}

test('resume: a repeat modifier press restarts an ended held voice with the full start sequence', () => {
  const { engine } = endedSetup();
  assert.deepEqual(engine.activeKeys(), []);               // silent
  const cmds = engine.noteOn(MOD.RPT_16, 100);
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].voice, 0);
  assert.deepEqual(names(cmds[0]), START_ORDER);           // held 1 and trig last
  assert.deepEqual(cmds[0].params.slice(-2), [['held', 1], ['trig', 2]]);
  const p = pmap(cmds[0]);
  assert.equal(p.rptdiv, 4);
  assert.deepEqual([p.pstart, p.pend, p.dir], [0, 1000, 1]);
  near(p.pitch, 2);
  near(p.amp, dbtoa(-6) * velCurve(90, 50));               // stored velocity kept
  // ended is cleared: the voice is sounding again and its key still owns it
  assert.deepEqual(engine.activeKeys(), [60]);
  assert.deepEqual(engine.noteOff(60), [{ voice: 0, params: [['held', 0]] }]);
  assert.deepEqual(engine.noteOff(MOD.RPT_16).map((c) => pmap(c).rptdiv), [0]);   // normal repeat update now
});

test('resume: nothing is resumed while the effective rate stays 0', () => {
  const { engine, g, setGest } = endedSetup();
  setGest(0, { pitchTo: 12 });                             // rate off/off
  for (const key of [MOD.REVERSE, MOD.OCTUP, MOD.TAPE, MOD.CHAOS, MOD.GEST_0]) {
    assert.deepEqual(engine.noteOn(key, 100), [], 'key ' + key);
  }
  for (const key of [MOD.REVERSE, MOD.OCTUP, MOD.TAPE, MOD.CHAOS, MOD.GEST_0]) {
    assert.deepEqual(engine.noteOff(key), [], 'key ' + key);
  }
  assert.ok(engine.refreshHeld().every((c) => !names(c).includes('trig')));   // repeat off: no restart
  g.repeatOn = false;
  assert.deepEqual(engine.refreshHeld().map((c) => names(c)), [['rptdiv', 'rptswing', 'rptalt']]);
  assert.deepEqual(engine.activeKeys(), []);               // still silent
});

test('resume: only a press restarts a voice, never a release', () => {
  const { engine, src, g } = endedSetup();
  g.repeatOn = true; g.repeatDiv = '1/8';                  // repeat stays active after the release (rate 2)
  src.frames = 0;                                          // unplayable for a moment: the press cannot resume it
  assert.deepEqual(engine.noteOn(MOD.RPT_4, 100), []);
  src.frames = 44100;
  assert.deepEqual(starts(engine.noteOff(MOD.RPT_4)), []);
  assert.deepEqual(engine.activeKeys(), []);               // still silent
  assert.equal(starts(engine.noteOn(MOD.RPT_4, 100)).length, 1);   // a new press does restart it
});

test('resume: global repeat turned on is picked up by refreshHeld; other held voices just get params', () => {
  const { model, engine, g, src } = endedSetup();
  model.addPad(61, src, 1);
  engine.noteOn(61, 100);                                  // v1 sounding
  g.repeatOn = true; g.repeatDiv = '1/16'; g.swing = 20;
  const cmds = engine.refreshHeld();
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  assert.deepEqual(names(cmds[0]), START_ORDER);
  const p = pmap(cmds[0]);
  assert.equal(p.rptdiv, 4);
  assert.equal(p.rptswing, 0.2);
  assert.equal(p.trig, 2);
  assert.deepEqual(cmds[1], { voice: 1, params: [['rptdiv', 4], ['rptswing', 0.2], ['rptalt', 0]] });
  // the voice is sounding now: a later refresh is parameters only
  assert.deepEqual(engine.refreshHeld().map((c) => names(c)), [['rptdiv', 'rptswing', 'rptalt'], ['rptdiv', 'rptswing', 'rptalt']]);
});

test('resume: a gesture press with an effective rate > 0 restarts the voice with the gesture values', () => {
  const { engine, setGest } = endedSetup({ cutoffHz: 10000 });
  setGest(0, { rateFrom: '1/8', rateTo: '1/64', cutFrom: 20000, cutTo: 1000, pitchFrom: 3, pitchTo: 3 });
  const cmds = engine.noteOn(MOD.GEST_0, 100);
  assert.equal(cmds.length, 1);
  assert.deepEqual(names(cmds[0]), START_ORDER);
  const p = pmap(cmds[0]);
  assert.equal(p.rptdiv, 2);                               // t = 0 of the ramp
  near(p.pitch, 2 + 3);
  assert.equal(p.cutoff, 10000);
  assert.equal(p.trig, 2);
  assert.equal(engine.needsTick(), true);
  assert.deepEqual(engine.activeKeys(), [60]);
});

test('resume: switching to another gesture with a rate restarts a still-ended voice; off/off does not', () => {
  const { engine, setGest } = endedSetup();
  setGest(0, {});                                          // rate off/off
  setGest(1, { rateFrom: '1/16', rateTo: '1/16' });
  assert.deepEqual(engine.noteOn(MOD.GEST_0, 100), []);
  const cmds = engine.noteOn(MOD.GEST_1, 100);
  assert.deepEqual(cmds.map((c) => isStart(c) && pmap(c).rptdiv), [4]);
  // a gesture release never restarts
  const again = endedSetup();
  again.setGest(1, { rateFrom: '1/16', rateTo: '1/16' });
  assert.equal(starts(again.engine.noteOn(MOD.GEST_1, 100)).length, 1);
  again.engine.voiceEnded(0);
  assert.deepEqual(starts(again.engine.noteOff(MOD.GEST_1)), []);
});

test('resume: a voice whose repeat was already active is not restarted', () => {
  const { engine, g } = endedSetup({}, {});
  g.repeatOn = true; g.repeatDiv = '1/8';
  engine.noteOn(60, 100);                                  // v1 starts with rptdiv 2
  engine.voiceEnded(1);                                    // (stale) end report for a repeating voice
  assert.deepEqual(starts(engine.noteOn(MOD.RPT_64, 100)).filter((c) => c.voice === 1), []);
});

test('resume: keeps key, main / layer roles, current modifiers and morph', () => {
  const { model, engine, g, src, pad } = endedSetup({}, {});
  const layer = model.addPad(null, src, 1, { pitch: 5 });
  pad.layers = [layer.id];
  pad.morph = { pitch: 10 };
  g.morph = 100;
  engine.noteOff(60);                                      // fresh start below
  engine.voiceEnded(0);
  engine.noteOn(60, 100);                                  // v0 main + v1 layer
  engine.voiceEnded(0);
  engine.voiceEnded(1);
  engine.noteOn(MOD.OCTUP, 100);
  engine.noteOn(MOD.REVERSE, 100);
  const cmds = engine.noteOn(MOD.RPT_8, 100);
  assert.deepEqual(cmds.map((c) => c.voice), [0, 1]);
  assert.deepEqual(names(cmds[0]), START_ORDER);
  assert.deepEqual(names(cmds[1]), START_ORDER);
  near(pmap(cmds[0]).pitch, 10 + 12);                      // morphed pad + octave
  near(pmap(cmds[1]).pitch, 5 + 12);                       // the layer's own pad
  assert.equal(pmap(cmds[0]).dir, -1);                     // reverse modifier applies
  assert.equal(pmap(cmds[0]).rptdiv, 2);
  assert.deepEqual(engine.activeKeys(), [60]);
  // main / layer tracking survives: scan only moves the main voice
  g.scan = 100;
  model.addPad(70, src, 2);
  const sc = engine.refreshScan();
  assert.deepEqual(sc.map((c) => c.voice), [0]);
  assert.deepEqual(engine.noteOff(60).map((c) => c.voice), [0, 1]);
});

test('resume: a voice whose pad can no longer be played is skipped', () => {
  const { engine, src } = endedSetup();
  src.frames = 0;                                          // sample unloaded meanwhile
  assert.deepEqual(engine.noteOn(MOD.RPT_16, 100), []);
  assert.deepEqual(starts(engine.refreshHeld()), []);
});

// ---------------------------------------------------------------------------
// API shape and ES5 discipline
// ---------------------------------------------------------------------------

test('Engine.create requires a model; constants are exported', () => {
  assert.throws(() => Engine.create({}), /model/);
  assert.deepEqual(Engine.REPEAT_PER_BEAT, [1, 2, 3, 4, 6, 8, 12, 16]);
  assert.equal(Engine.REPEAT_DIVS.length, 8);
  assert.equal(Engine.MOD_ACTIONS.length, 16);
  assert.equal(Engine.MOD_ACTIONS[7], 'reverse');
  assert.deepEqual(Engine.MOD_ACTIONS.slice(12), ['gest:0', 'gest:1', 'gest:2', 'gest:3']);
});

test('core/engine.js sticks to ES5 and does not require the model', () => {
  const file = path.join(__dirname, '..', 'core', 'engine.js');
  const raw = fs.readFileSync(file, 'utf8');
  // strip comments and string literals before scanning
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  const forbidden = [
    [/=>/, 'arrow function'],
    [/\blet\b/, 'let'],
    [/\bconst\b/, 'const'],
    [/`/, 'template literal'],
    [/\bclass\b/, 'class'],
    [/\bnew\s+(Map|Set|WeakMap|WeakSet|Promise)\b/, 'Map/Set/Promise'],
    [/\bSymbol\b/, 'Symbol'],
    [/\.\s*(includes|find|findIndex|fill|startsWith|endsWith|repeat|padStart|padEnd)\s*\(/, 'ES6 method'],
    [/Object\s*\.\s*(assign|entries|values)\b/, 'Object.assign/entries/values'],
    [/\.\.\./, 'spread / rest'],
    [/\bfor\s*\([^)]*\bof\b/, 'for...of'],
    [/Math\s*\.\s*(sign|trunc|log2|log10|hypot|cbrt)\b/, 'ES6 Math'],
    [/Number\s*\.\s*(isFinite|isInteger|isNaN)\b/, 'ES6 Number'],
    [/\b(outlet|post|Buffer|Dict|LiveAPI|Task|messagename|jsarguments)\s*\(/, 'Max/Node global']
  ];
  for (const [re, label] of forbidden) {
    assert.ok(!re.test(code), 'engine.js must not use ' + label);
  }
  const noComments = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/require\s*\(\s*['"]\.\/model['"]\s*\)/.test(noComments), 'must not require ./model');
});
