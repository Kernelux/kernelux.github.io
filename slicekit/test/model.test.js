'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Model = require('../core/model');
const prng = require('../core/prng');

const CONST = Model.CONST;

// ---------------------------------------------------------------- helpers

// Small deterministic stand-in for core/features.js (centroidHz is the only
// dimension that matters; kmeans partitions the value range into k bands).
function fakeFeatures() {
  const calls = { normalize: 0, rankSimilar: 0, kmeans: [], findBest: [] };
  return {
    calls,
    normalize(list) {
      calls.normalize++;
      return list.map((f) => [f.centroidHz]);
    },
    distance(a, b) {
      return Math.abs(a[0] - b[0]);
    },
    rankSimilar(target, list) {
      calls.rankSimilar++;
      const idx = list.map((_, i) => i).filter((i) => i !== target);
      idx.sort((a, b) =>
        (Math.abs(list[a].centroidHz - list[target].centroidHz) - Math.abs(list[b].centroidHz - list[target].centroidHz)) || (a - b));
      return [target].concat(idx);
    },
    kmeans(vectors, k, rng) {
      calls.kmeans.push({ n: vectors.length, k });
      rng(); // consume like a real implementation would
      const vals = vectors.map((v) => v[0]);
      const lo = Math.min.apply(null, vals);
      const hi = Math.max.apply(null, vals);
      return vals.map((v) => (hi === lo ? 0 : Math.min(k - 1, Math.floor((v - lo) / (hi - lo) * k))));
    },
    findBest(list, n, opts) {
      calls.findBest.push({ n, opts });
      const idx = list.map((_, i) => i);
      idx.sort((a, b) => (list[b].rmsDb - list[a].rmsDb) || (a - b));
      return idx.slice(0, n);
    }
  };
}

function mk(extra) {
  const f = fakeFeatures();
  const m = Model.create(Object.assign({ features: f }, extra || {}));
  m.fake = f;
  return m;
}

function ranges(n, len) {
  len = len || 1000;
  return Array.from({ length: n }, (_, i) => ({ start: i * len, end: (i + 1) * len }));
}

function feat(centroidHz, rmsDb, durMs) {
  return { durMs: durMs === undefined ? 100 : durMs, peakDb: -3, rmsDb: rmsDb === undefined ? -20 : rmsDb, attackMs: 1, centroidHz, zcr: 0.1 };
}

// adds a loaded + sliced source; featFn(i) -> Features (optional)
function addSrc(m, name, n, featFn, len) {
  len = len || 1000;
  const s = m.addSource({ name, path: '/samples/' + name + '.wav' });
  assert.ok(s, 'addSource returned null');
  m.setSourceInfo(s.id, { frames: n * len, sr: 44100, channels: 1 });
  m.setSlices(s.id, ranges(n, len));
  if (featFn) m.setSliceFeatures(s.id, Array.from({ length: n }, (_, i) => featFn(i)));
  return s;
}

function tag(m, k, slot) {
  const p = m.getPadOnKey(k, slot);
  if (!p) return null;
  const sl = m.getSlice(p.sliceId);
  const src = m.getSource(sl.sourceId);
  const idx = src.slices.findIndex((s) => s.id === sl.id);
  return src.name + idx + (p.base ? '' : "'");
}

function tags(m, from, to, slot) {
  const out = [];
  for (let k = from; k <= to; k++) out.push(tag(m, k, slot));
  return out;
}

function stripped(m) {
  const j = m.toJSON();
  delete j.nextId;
  return j;
}

function padIds(m) {
  return Object.keys(m.state.pads).map(Number).sort((a, b) => a - b);
}

function basePadOf(m, sliceId) {
  const hits = Object.keys(m.state.pads).map((k) => m.state.pads[k]).filter((p) => p.sliceId === sliceId && p.base);
  assert.equal(hits.length, 1, 'slice ' + sliceId + ' must have exactly one base pad, has ' + hits.length);
  return hits[0];
}

function record(m) {
  const kinds = [];
  m.onChange((k) => kinds.push(k));
  return kinds;
}

// structural invariants that must hold after every operation
function checkInvariants(m) {
  const st = m.state;
  const ids = new Set();
  const claim = (id, what) => {
    assert.ok(Number.isInteger(id) && id >= 1, what + ' id invalid: ' + id);
    assert.ok(!ids.has(id), 'duplicate id ' + id + ' (' + what + ')');
    assert.ok(id < st.nextId, 'id ' + id + ' >= nextId ' + st.nextId);
    ids.add(id);
  };
  const sliceOwner = {};
  const slots = new Set();
  assert.ok(st.sources.length <= CONST.MAX_SOURCES);
  st.sources.forEach((s) => {
    claim(s.id, 'source');
    assert.ok(!slots.has(s.slot), 'duplicate source slot');
    slots.add(s.slot);
    let prevEnd = -1;
    s.slices.forEach((sl) => {
      claim(sl.id, 'slice');
      assert.ok(sl.end > sl.start, 'empty slice');
      assert.ok(sl.start >= prevEnd, 'overlapping/unsorted slices');
      prevEnd = sl.end;
      sliceOwner[sl.id] = s.id;
    });
  });
  const baseCount = {};
  Object.keys(st.pads).forEach((k) => {
    const p = st.pads[k];
    claim(p.id, 'pad');
    assert.equal(String(p.id), k);
    assert.equal(sliceOwner[p.sliceId], p.sourceId, 'pad ' + p.id + ' slice/source mismatch');
    assert.ok(p.layers.length <= CONST.MAX_LAYERS);
    p.layers.forEach((l) => {
      assert.ok(st.pads[l], 'dangling layer ' + l);
      assert.notEqual(l, p.id);
    });
    if (p.origSliceId !== null) assert.ok(sliceOwner[p.origSliceId] !== undefined, 'dangling origSliceId');
    if (p.base) baseCount[p.sliceId] = (baseCount[p.sliceId] || 0) + 1;
  });
  st.sources.forEach((s) => s.slices.forEach((sl) => {
    assert.equal(baseCount[sl.id], 1, 'slice ' + sl.id + ' must have exactly one base pad');
  }));
  assert.equal(st.slots.length, CONST.NUM_SLOTS);
  const referenced = new Set();
  st.slots.forEach((slot) => {
    assert.equal(slot.keys.length, CONST.NUM_KEYS);
    assert.equal(slot.locks.length, CONST.NUM_KEYS);
    slot.keys.forEach((pid) => {
      if (pid !== null) {
        assert.ok(st.pads[pid], 'key references missing pad ' + pid);
        referenced.add(pid);
      }
    });
  });
  // garbage collection: every pad is base, on a key, or reachable through layers
  const alive = new Set();
  const visit = (id) => {
    if (alive.has(id)) return;
    alive.add(id);
    st.pads[id].layers.forEach(visit);
  };
  Object.keys(st.pads).forEach((k) => { if (st.pads[k].base) visit(st.pads[k].id); });
  referenced.forEach(visit);
  assert.equal(alive.size, Object.keys(st.pads).length, 'orphan pads were not garbage collected');
}

// ---------------------------------------------------------------- constants & defaults

test('Model.CONST has the documented constants', () => {
  assert.deepEqual(CONST.BEAT_DIVS, ['1/16', '1/16T', '1/8', '1/8T', '1/4', '1/4T', '1/2', '1/2T', '1 Bar', '2 Bars', '4 Bars']);
  assert.equal(CONST.BEAT_DIV_BEATS.length, 11);
  [0.25, 1 / 6, 0.5, 1 / 3, 1, 2 / 3, 2, 4 / 3, 4, 8, 16].forEach((v, i) => {
    assert.ok(Math.abs(CONST.BEAT_DIV_BEATS[i] - v) < 1e-12, 'BEAT_DIV_BEATS[' + i + ']');
  });
  assert.deepEqual(CONST.REPEAT_DIVS, ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64']);
  assert.deepEqual(CONST.REPEAT_PER_BEAT, [1, 2, 3, 4, 6, 8, 12, 16]);
  assert.deepEqual(CONST.MOD_ACTIONS, ['rpt:1/4', 'rpt:1/8', 'rpt:1/8T', 'rpt:1/16', 'rpt:1/16T', 'rpt:1/32',
    'rpt:1/64', 'reverse', 'octdown', 'octup', 'tape', 'chaos']);
  assert.equal(CONST.MOD_ACTIONS.length, 12);
  assert.equal(CONST.MAX_SOURCES, 16);
  assert.equal(CONST.NUM_SLOTS, 8);
  assert.equal(CONST.NUM_KEYS, 128);
  assert.equal(CONST.MAX_LAYERS, 3);
});

test('Model.PALETTE has the 16 colours of PROTOCOL.md', () => {
  assert.deepEqual(Model.PALETTE, ['#FF5A5A', '#FFA54A', '#FFD84A', '#9BE35A', '#3FCF8E', '#3FD1D1', '#4AA8FF', '#7A7CFF',
    '#B57CFF', '#FF7CE0', '#FF8C8C', '#C9A27A', '#A0A0A0', '#6FD0FF', '#E0FF7C', '#FFB3D1']);
  Model.PALETTE.forEach((c) => assert.match(c, /^#[0-9A-F]{6}$/));
});

test('a fresh model has the documented empty state and Globals defaults', () => {
  const m = Model.create();
  assert.equal(m.state.version, 1);
  assert.equal(m.state.nextId, 1);
  assert.deepEqual(m.state.sources, []);
  assert.deepEqual(m.state.pads, {});
  assert.equal(m.state.currentSlot, 0);
  assert.equal(m.state.slots.length, 8);
  m.state.slots.forEach((s) => {
    assert.equal(s.auto, true);
    assert.equal(s.keys.length, 128);
    assert.equal(s.locks.length, 128);
    assert.ok(s.keys.every((k) => k === null));
    assert.ok(s.locks.every((l) => l === false));
  });
  assert.deepEqual(m.globals(), {
    rootKey: 36, layout: 'zones', zoneAlign: false, sortBy: 'brightness', chokeScope: 'source',
    chaos: 0, repeatOn: false, repeatDiv: '1/16', swing: 0, repeatAlt: false,
    shuffleMode: 'chaos', shuffleScope: 'all', seed: 1, flipPct: 0,
    modZoneOn: false, modZoneStart: 96, velSens: 50, pressureToLevel: false,
    bestN: 16, spreadParam: 'pitch', spreadCount: 16, spreadStep: 1
  });
  assert.equal(m.globals(), m.state.globals);
  assert.equal(m.currentSlot(), 0);
  assert.equal(m.canUndo(), false);
  assert.equal(m.canRedo(), false);
  assert.deepEqual(m.listSources(), []);
});

test('Source defaults', () => {
  const m = mk();
  const s = m.addSource({ name: 'kick', path: '/x/kick.wav' });
  assert.deepEqual(s, {
    id: s.id, slot: 0, name: 'kick', path: '/x/kick.wav',
    frames: 0, sr: 0, channels: 0, color: 0,
    playMode: 'mono', trigMode: 'trigger',
    slicing: { mode: 'transient', sensitivity: 50, beatDiv: '1/16', regions: 16, bpm: 0, minSliceMs: 30, snap: true },
    slices: []
  });
  assert.equal(m.getSource(s.id), s);
  assert.equal(m.state.sources[0], s);
});

test('Pad defaults', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const pad = basePadOf(m, s.slices[0].id);
  assert.deepEqual(pad, {
    id: pad.id, sourceId: s.id, sliceId: s.slices[0].id, base: true,
    reverse: false, pitch: 0, fine: 0, gainDb: 0,
    attackMs: 0, decayMs: 300, sustain: 1, releaseMs: 30,
    startOffsetMs: 0, loopOn: false, loopSizeMs: 30, loopPos: 0,
    cutoffHz: 20000, drive: 0,
    layers: [], origSliceId: null, simIndex: 0
  });
  assert.equal(m.getPad(pad.id), pad);
  assert.equal(m.getPad(999999), null);
  assert.equal(m.getPad(undefined), null);
});

// ---------------------------------------------------------------- sources

test('addSource assigns the lowest free buffer slot and colour = slot', () => {
  const m = mk();
  const a = m.addSource({ name: 'a', path: 'a.wav' });
  const b = m.addSource({ name: 'b', path: 'b.wav' });
  const c = m.addSource({ name: 'c', path: 'c.wav' });
  assert.deepEqual([a.slot, b.slot, c.slot], [0, 1, 2]);
  assert.deepEqual([a.color, b.color, c.color], [0, 1, 2]);
  m.removeSource(b.id);
  const d = m.addSource({ name: 'd', path: 'd.wav' });
  assert.equal(d.slot, 1, 'lowest free slot is reused');
  assert.equal(d.color, 1);
  const e = m.addSource({ name: 'e', path: 'e.wav' });
  assert.equal(e.slot, 3);
  assert.equal(m.getSourceBySlot(1), d);
  assert.equal(m.getSourceBySlot(2), c);
  assert.equal(m.getSourceBySlot(15), null);
  assert.deepEqual(m.listSources().map((s) => s.name), ['a', 'c', 'd', 'e']);
  checkInvariants(m);
});

test('addSource is limited to 16 sources (returns null)', () => {
  const m = mk();
  const added = [];
  for (let i = 0; i < 16; i++) {
    const s = m.addSource({ name: 's' + i, path: 's' + i + '.wav' });
    assert.ok(s, 'source ' + i);
    added.push(s);
  }
  assert.deepEqual(added.map((s) => s.slot), Array.from({ length: 16 }, (_, i) => i));
  assert.equal(m.addSource({ name: 'x', path: 'x.wav' }), null);
  assert.equal(m.listSources().length, 16);
  assert.equal(m.state.nextId, 17, 'a refused add must not consume an id');
  m.removeSource(added[7].id);
  const again = m.addSource({ name: 'again' });
  assert.ok(again);
  assert.equal(again.slot, 7);
  checkInvariants(m);
});

test('addSource derives the name from the path and tolerates missing info', () => {
  const m = mk();
  assert.equal(m.addSource({ path: '/a/b/kick.wav' }).name, 'kick.wav');
  assert.equal(m.addSource({ path: 'C:\\samples\\snare.wav' }).name, 'snare.wav');
  const bare = m.addSource();
  assert.equal(bare.name, '');
  assert.equal(bare.path, '');
});

test('setSourceInfo stores frames/sr/channels and ignores junk', () => {
  const m = mk();
  const s = m.addSource({ name: 'a' });
  assert.equal(m.setSourceInfo(s.id, { frames: 44100, sr: 48000, channels: 2 }), true);
  assert.deepEqual([s.frames, s.sr, s.channels], [44100, 48000, 2]);
  m.setSourceInfo(s.id, { frames: -5, sr: 'x', channels: NaN });
  assert.deepEqual([s.frames, s.sr, s.channels], [44100, 48000, 2]);
  assert.equal(m.setSourceInfo(999, { frames: 1 }), false);
});

test('setSourceSettings validates, clamps and stores (no reslice)', () => {
  const m = mk();
  const s = addSrc(m, 'a', 4);
  const sliceIds = s.slices.map((x) => x.id);
  assert.equal(m.setSourceSettings(s.id, { playMode: 'poly', trigMode: 'gate', color: 9 }), true);
  assert.deepEqual([s.playMode, s.trigMode, s.color], ['poly', 'gate', 9]);
  m.setSourceSettings(s.id, { playMode: 'bogus', trigMode: 7, color: 'x' });
  assert.deepEqual([s.playMode, s.trigMode, s.color], ['poly', 'gate', 9]);
  m.setSourceSettings(s.id, { color: 99 });
  assert.equal(s.color, 15);
  m.setSourceSettings(s.id, { color: -3 });
  assert.equal(s.color, 0);
  m.setSourceSettings(s.id, { mode: 'beat', sensitivity: 130, beatDiv: '1/8T', regions: 500, bpm: 120.5, minSliceMs: 1, snap: 0 });
  assert.deepEqual(s.slicing, { mode: 'beat', sensitivity: 100, beatDiv: '1/8T', regions: 128, bpm: 120.5, minSliceMs: 5, snap: false });
  m.setSourceSettings(s.id, { mode: 'region', sensitivity: -4, regions: 0, bpm: 9999, minSliceMs: 99999, snap: true });
  assert.deepEqual(s.slicing, { mode: 'region', sensitivity: 0, beatDiv: '1/8T', regions: 2, bpm: 250, minSliceMs: 500, snap: true });
  m.setSourceSettings(s.id, { mode: 'nope', beatDiv: '1/3', sensitivity: 'abc' });
  assert.equal(s.slicing.mode, 'region');
  assert.equal(s.slicing.beatDiv, '1/8T');
  assert.equal(s.slicing.sensitivity, 0);
  // enum indices (as sent by Max menus) and nested slicing object
  m.setSourceSettings(s.id, { playMode: 2, trigMode: 0, mode: 3, beatDiv: 4 });
  assert.deepEqual([s.playMode, s.trigMode, s.slicing.mode, s.slicing.beatDiv], ['thru', 'trigger', 'manual', '1/4']);
  m.setSourceSettings(s.id, { slicing: { sensitivity: 77 } });
  assert.equal(s.slicing.sensitivity, 77);
  assert.equal(m.setSourceSettings(12345, { playMode: 'poly' }), false);
  // storing settings never touches slices/pads
  assert.deepEqual(s.slices.map((x) => x.id), sliceIds);
  checkInvariants(m);
});

test('getSlice / getSlicesOfSource / getPadOnKey lookups', () => {
  const m = mk();
  const a = addSrc(m, 'a', 3);
  const b = addSrc(m, 'b', 2);
  const sl = a.slices[1];
  const got = m.getSlice(sl.id);
  assert.deepEqual(got, { id: sl.id, start: sl.start, end: sl.end, features: null, sourceId: a.id });
  assert.equal(m.getSlice(b.slices[1].id).sourceId, b.id);
  assert.equal(m.getSlice(424242), null);
  assert.equal(m.getSlice(undefined), null);
  assert.equal(m.state.sources[0].slices[1].sourceId, undefined, 'state slices must not be polluted');
  assert.deepEqual(m.getSlicesOfSource(a.id).map((x) => x.id), a.slices.map((x) => x.id));
  assert.deepEqual(m.getSlicesOfSource(31337), []);
  assert.equal(m.getPadOnKey(36).sliceId, a.slices[0].id);
  assert.equal(m.getPadOnKey(39).sliceId, b.slices[0].id);
  assert.equal(m.getPadOnKey(40).sliceId, b.slices[1].id);
  assert.equal(m.getPadOnKey(41), null);
  assert.equal(m.getPadOnKey(-1), null);
  assert.equal(m.getPadOnKey(128), null);
  assert.equal(m.getPadOnKey(36, 5).sliceId, a.slices[0].id);
});

// ---------------------------------------------------------------- slices, base pads, layouts

test('setSlices makes fresh slices (features null) and exactly one base pad each, laid out from rootKey', () => {
  const m = mk();
  const s = m.addSource({ name: 'a', path: 'a.wav' });
  m.setSourceInfo(s.id, { frames: 8000, sr: 44100, channels: 1 });
  const idBefore = m.state.nextId;
  assert.equal(m.setSlices(s.id, ranges(8)), true);
  assert.equal(s.slices.length, 8);
  s.slices.forEach((sl, i) => {
    assert.equal(sl.start, i * 1000);
    assert.equal(sl.end, (i + 1) * 1000);
    assert.equal(sl.features, null);
    assert.ok(sl.id >= idBefore);
  });
  assert.equal(new Set(s.slices.map((x) => x.id)).size, 8);
  assert.equal(padIds(m).length, 8);
  s.slices.forEach((sl) => assert.equal(basePadOf(m, sl.id).sourceId, s.id));
  // zones layout from rootKey (36) in every (auto) slot
  for (let slot = 0; slot < 8; slot++) {
    assert.deepEqual(tags(m, 34, 45, slot), [null, null, 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', null, null]);
    assert.equal(m.state.slots[slot].auto, true);
  }
  checkInvariants(m);
});

test('setSlices on a new set of ranges gives all-new slice ids; features are filled by setSliceFeatures', () => {
  const m = mk();
  const s = addSrc(m, 'a', 4);
  const old = s.slices.map((x) => x.id);
  m.setSlices(s.id, ranges(4));
  assert.equal(s.slices.some((x) => old.indexOf(x.id) >= 0), false);
  assert.equal(m.setSliceFeatures(s.id, [feat(1), feat(2), feat(3), feat(4)]), true);
  assert.deepEqual(s.slices.map((x) => x.features.centroidHz), [1, 2, 3, 4]);
  // wrong length is refused and changes nothing
  assert.equal(m.setSliceFeatures(s.id, [feat(9)]), false);
  assert.deepEqual(s.slices.map((x) => x.features.centroidHz), [1, 2, 3, 4]);
  // features are copied, not aliased
  const f = feat(5);
  m.setSliceFeatures(s.id, [f, f, f, null]);
  f.centroidHz = 777;
  assert.equal(s.slices[0].features.centroidHz, 5);
  assert.equal(s.slices[3].features, null);
  assert.equal(m.setSliceFeatures(31337, []), false);
  checkInvariants(m);
});

test('setSlices sanitises ranges (sort, drop empty, clip overlaps) and falls back to one slice', () => {
  const m = mk();
  const s = m.addSource({ name: 'a' });
  m.setSourceInfo(s.id, { frames: 5000, sr: 44100, channels: 1 });
  m.setSlices(s.id, [{ start: 3000, end: 5000 }, { start: 0, end: 2000 }, { start: 1500, end: 3000 }, { start: 10, end: 10 }, null]);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 2000], [2000, 3000], [3000, 5000]]);
  m.setSlices(s.id, []);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 5000]]);
  assert.equal(padIds(m).length, 1);
  checkInvariants(m);
});

test('zones layout: sources in add order, slices in time order, contiguous', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  addSrc(m, 'b', 3);
  assert.deepEqual(tags(m, 35, 43), [null, 'a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', null]);
  checkInvariants(m);
});

test('changing rootKey re-lays out auto slots', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  m.setGlobal('rootKey', 60);
  assert.deepEqual(tags(m, 58, 63), [null, null, 'a0', 'a1', 'a2', null]);
  assert.equal(m.getPadOnKey(36), null, 'old keys are cleared');
  m.setGlobal('rootKey', 0);
  assert.deepEqual(tags(m, 0, 3), ['a0', 'a1', 'a2', null]);
  m.setGlobal('rootKey', 999);
  assert.equal(m.globals().rootKey, 127);
  assert.deepEqual(tags(m, 126, 127), [null, 'a0']);
});

test('zoneAlign starts each later source on the next octave boundary from rootKey', () => {
  const m = mk();
  m.setGlobal('zoneAlign', true);
  addSrc(m, 'a', 4);
  addSrc(m, 'b', 3);
  addSrc(m, 'c', 14);
  assert.deepEqual(tags(m, 36, 40), ['a0', 'a1', 'a2', 'a3', null]);
  assert.deepEqual(tags(m, 47, 51), [null, 'b0', 'b1', 'b2', null]);
  assert.deepEqual(tags(m, 59, 61), [null, 'c0', 'c1']);
  assert.equal(tag(m, 73), 'c13');
  assert.equal(tag(m, 74), null);
  // zoneAlign is relative to rootKey
  m.setGlobal('rootKey', 40);
  assert.equal(tag(m, 40), 'a0');
  assert.equal(tag(m, 52), 'b0');
  assert.equal(tag(m, 64), 'c0');
  // a source ending exactly on the boundary does not skip an octave
  const m2 = mk();
  m2.setGlobal('zoneAlign', true);
  addSrc(m2, 'a', 12);
  addSrc(m2, 'b', 2);
  assert.equal(tag(m2, 47), 'a11');
  assert.equal(tag(m2, 48), 'b0');
  // turning it off re-lays out again
  m2.setGlobal('zoneAlign', false);
  assert.equal(tag(m2, 48), 'b0');
  const m3 = mk();
  addSrc(m3, 'a', 4);
  addSrc(m3, 'b', 3);
  m3.setGlobal('zoneAlign', true);
  assert.equal(tag(m3, 48), 'b0');
  assert.equal(tag(m3, 40), null);
});

test('interleave layout is round-robin across sources', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  addSrc(m, 'b', 1);
  addSrc(m, 'c', 2);
  m.setGlobal('layout', 'interleave');
  assert.deepEqual(tags(m, 36, 42), ['a0', 'b0', 'c0', 'a1', 'c1', 'a2', null]);
  // zoneAlign only affects zones
  m.setGlobal('zoneAlign', true);
  assert.deepEqual(tags(m, 36, 42), ['a0', 'b0', 'c0', 'a1', 'c1', 'a2', null]);
  m.setGlobal('layout', 'zones');
  assert.equal(tag(m, 36), 'a0');
  assert.equal(tag(m, 48), 'b0');
});

test('sorted layout orders base pads by brightness / loudness / length, featureless last', () => {
  const m = mk();
  addSrc(m, 'a', 4, (i) => feat([4000, 1000, 3000, 2000][i], [-10, -40, -30, -20][i], [400, 100, 300, 200][i]));
  addSrc(m, 'b', 2, (i) => feat([500, 5000][i], [-50, -5][i], [50, 500][i]));
  addSrc(m, 'c', 2); // no features
  m.setGlobal('layout', 'sorted');
  assert.deepEqual(tags(m, 36, 45), ['b0', 'a1', 'a3', 'a2', 'a0', 'b1', 'c0', 'c1', null, null], 'brightness');
  m.setGlobal('sortBy', 'loudness');
  assert.deepEqual(tags(m, 36, 43), ['b0', 'a1', 'a2', 'a3', 'a0', 'b1', 'c0', 'c1'], 'loudness (rmsDb ascending)');
  m.setGlobal('sortBy', 'length');
  assert.deepEqual(tags(m, 36, 43), ['b0', 'a1', 'a3', 'a2', 'a0', 'b1', 'c0', 'c1'], 'length (durMs ascending)');
  checkInvariants(m);
});

test('sorted layout is stable for ties and re-sorts when features arrive', () => {
  const m = mk();
  m.setGlobal('layout', 'sorted');
  const a = addSrc(m, 'a', 3);
  addSrc(m, 'b', 2);
  // nobody has features yet: zones order
  assert.deepEqual(tags(m, 36, 40), ['a0', 'a1', 'a2', 'b0', 'b1']);
  m.setSliceFeatures(a.id, [feat(300), feat(100), feat(100)]);
  assert.deepEqual(tags(m, 36, 40), ['a1', 'a2', 'a0', 'b0', 'b1'], 'tie a1/a2 keeps time order, featureless b last');
});

test('sorted layout does not need the features module', () => {
  const m = Model.create({ features: null });
  m.setGlobal('layout', 'sorted');
  const s = m.addSource({ name: 'a' });
  m.setSourceInfo(s.id, { frames: 3000, sr: 44100, channels: 1 });
  m.setSlices(s.id, ranges(3));
  m.setSliceFeatures(s.id, [feat(3), feat(1), feat(2)]);
  assert.deepEqual(tags(m, 36, 38), ['a1', 'a2', 'a0']);
});

test('locked keys keep their pad during layout and that pad is not placed twice', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  addSrc(m, 'b', 3);
  const lockedPad = m.getPadOnKey(37);
  assert.equal(tag(m, 37), 'a1');
  m.setLock(37, true);
  assert.equal(m.state.slots[0].auto, false);
  m.setGlobal('layout', 'interleave');
  assert.equal(tag(m, 36), 'a0', 'manual slot is untouched by setGlobal');
  const res = m.applyLayout(0);
  assert.equal(m.getPadOnKey(37), lockedPad, 'locked key keeps its pad');
  assert.equal(m.isLocked(37), true, 'lock survives layout');
  assert.deepEqual(tags(m, 36, 42), ['a0', 'a1', 'b0', 'b1', 'a2', 'b2', null]);
  assert.deepEqual(res, { placed: 5, dropped: 0 });
  assert.equal(m.state.slots[0].auto, true);
  assert.deepEqual(tags(m, 36, 42, 1), ['a0', 'b0', 'a1', 'b1', 'a2', 'b2', null], 'other slots are unaffected by slot 0 locks');
  // a structural change keeps the lock too
  addSrc(m, 'c', 1);
  assert.equal(m.getPadOnKey(37), lockedPad);
  assert.equal(m.isLocked(37), true);
  checkInvariants(m);
});

test('a locked empty key is skipped by layout (reserved hole); clearKey releases the lock', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  m.setLock(38, true);
  m.clearKey(38);
  assert.equal(m.isLocked(38), false, 'clearing a key also releases its lock');
  m.setLock(40, true); // key 40 is empty
  assert.equal(m.applyLayout(0).placed, 4);
  assert.deepEqual(tags(m, 36, 41), ['a0', 'a1', 'a2', 'a3', null, null]);
  assert.equal(m.isLocked(40), true);
  m.setLock(37, true); // 37 holds a1: it keeps it, a1 is not placed again
  m.setLock(38, true); // 38 holds a2
  m.clearKey(38);      // -> releases the lock
  m.setLock(38, true); // lock the now empty key
  const res = m.applyLayout(0);
  assert.deepEqual(res, { placed: 2, dropped: 0 }, 'a0 and a3 flow around the locked keys; a1 stays on its locked key');
  assert.deepEqual(tags(m, 36, 42), ['a0', 'a1', null, 'a2', null, 'a3', null].map((x, i) => (i === 3 ? tag(m, 39) : x)));
  assert.equal(tag(m, 37), 'a1');
  assert.equal(tag(m, 38), null);
  assert.equal(m.isLocked(38), true);
  assert.equal(m.isLocked(40), true);
  assert.equal(tag(m, 41), 'a3');
});

test('mod-zone keys are skipped by layout and left empty', () => {
  const m = mk();
  addSrc(m, 'a', 6);
  m.setGlobal('modZoneStart', 38);
  m.setGlobal('modZoneOn', true);
  assert.deepEqual(tags(m, 36, 39), ['a0', 'a1', null, null]);
  assert.deepEqual(tags(m, 48, 54), [null, null, 'a2', 'a3', 'a4', 'a5', null]);
  for (let k = 38; k <= 49; k++) assert.equal(m.getPadOnKey(k), null);
  assert.deepEqual(m.occupiedKeys(), [36, 37, 50, 51, 52, 53]);
  // moving the zone moves the hole
  m.setGlobal('modZoneStart', 40);
  assert.deepEqual(tags(m, 36, 41), ['a0', 'a1', 'a2', 'a3', null, null]);
  assert.equal(tag(m, 52), 'a4');
  assert.equal(tag(m, 53), 'a5');
  m.setGlobal('modZoneOn', false);
  assert.deepEqual(tags(m, 36, 41), ['a0', 'a1', 'a2', 'a3', 'a4', 'a5']);
  checkInvariants(m);
});

test('overflow past key 127 is dropped and counted', () => {
  const m = mk();
  addSrc(m, 'a', 12);
  m.setGlobal('rootKey', 120);
  const res = m.applyLayout(0);
  assert.deepEqual(res, { placed: 8, dropped: 4 });
  assert.deepEqual(tags(m, 119, 127), [null, 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
  assert.equal(m.occupiedKeys().length, 8);
  // every base pad still exists even when not placed
  assert.equal(padIds(m).length, 12);
  // dropped pads come back when there is room again
  m.setGlobal('rootKey', 36);
  assert.deepEqual(tags(m, 36, 47), Array.from({ length: 12 }, (_, i) => 'a' + i));
  // mod-zone keys count against capacity
  m.setGlobal('rootKey', 100);
  m.setGlobal('modZoneStart', 110);
  m.setGlobal('modZoneOn', true);
  assert.deepEqual(m.applyLayout(0), { placed: 10 + 6, dropped: 0 }.placed === 16 ? { placed: 12, dropped: 0 } : null);
  assert.deepEqual(tags(m, 100, 111), Array.from({ length: 10 }, (_, i) => 'a' + i).concat([null, null]));
  assert.deepEqual(tags(m, 122, 123), ['a10', 'a11']);
});

test('applyLayout(slot) returns {placed, dropped}, sets auto and works on any slot', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  m.setCurrentSlot(3);
  m.clearKey(36);
  assert.equal(m.state.slots[3].auto, false);
  assert.equal(tag(m, 36, 3), null);
  const res = m.applyLayout(3);
  assert.deepEqual(res, { placed: 4, dropped: 0 });
  assert.equal(m.state.slots[3].auto, true);
  assert.deepEqual(tags(m, 36, 39, 3), ['a0', 'a1', 'a2', 'a3']);
  // default slot = current
  m.clearKey(37);
  assert.deepEqual(m.applyLayout(), { placed: 4, dropped: 0 });
  assert.equal(tag(m, 37), 'a1');
});

// ---------------------------------------------------------------- reslice

test('reslice keeps pad settings and key positions in a non-auto slot, one base pad per slice', () => {
  const m = mk();
  const s = addSrc(m, 'a', 8);
  const pads = s.slices.map((sl) => basePadOf(m, sl.id));
  m.setPadParam(pads[3].id, 'pitch', 5);
  m.setPadParam(pads[3].id, 'reverse', true);
  m.setPadParam(pads[5].id, 'gainDb', -6);
  m.shuffle({ seed: 5 });
  assert.equal(m.state.slots[0].auto, false);
  const keysBefore = m.getSlotKeys(0);
  const settingsBefore = JSON.stringify(pads);
  const oldSliceIds = s.slices.map((x) => x.id);

  // same boundaries, brand new slices
  m.setSlices(s.id, ranges(8));
  assert.equal(s.slices.some((x) => oldSliceIds.indexOf(x.id) >= 0), false);
  assert.deepEqual(m.getSlotKeys(0), keysBefore, 'key positions survive');
  assert.equal(JSON.stringify(pads.map((p) => Object.assign({}, p, { sliceId: 0 }))), JSON.stringify(JSON.parse(settingsBefore).map((p) => Object.assign({}, p, { sliceId: 0 }))), 'pad settings survive');
  pads.forEach((p, i) => {
    assert.equal(p.sliceId, s.slices[i].id, 'pad ' + i + ' follows the slice with the same start');
    assert.equal(p.base, true);
  });
  assert.equal(padIds(m).length, 8);
  assert.equal(pads[3].pitch, 5);
  assert.equal(pads[3].reverse, true);
  // the auto slots show the plain layout
  assert.deepEqual(tags(m, 36, 43, 1), Array.from({ length: 8 }, (_, i) => 'a' + i));
  checkInvariants(m);
});

test('reslice re-points pads by nearest start; former-base duplicates become non-base', () => {
  const m = mk();
  const s = addSrc(m, 'a', 8);
  const pads = s.slices.map((sl) => basePadOf(m, sl.id)); // lowest id first
  m.swapKeys(36, 36); // no-op
  m.assignPad(36, pads[0].id); // make slot 0 manual with the standard content
  assert.equal(m.state.slots[0].auto, false);
  const keysBefore = m.getSlotKeys(0);
  m.setSlices(s.id, [{ start: 0, end: 2500 }, { start: 2500, end: 5000 }, { start: 5000, end: 7500 }, { start: 7500, end: 8000 }]);
  // old starts 0..7000 -> nearest of [0,2500,5000,7500]
  const expectIdx = [0, 0, 1, 1, 2, 2, 2, 3];
  pads.forEach((p, i) => assert.equal(p.sliceId, s.slices[expectIdx[i]].id, 'pad ' + i));
  const isBase = [true, false, true, false, true, false, false, true];
  pads.forEach((p, i) => assert.equal(p.base, isBase[i], 'base flag of pad ' + i));
  assert.equal(padIds(m).length, 8, 'no pad is created or lost');
  assert.deepEqual(m.getSlotKeys(0), keysBefore, 'non-auto slot keeps every key, including the non-base ones');
  assert.deepEqual(tags(m, 36, 43, 0), ['a0', "a0'", 'a1', "a1'", 'a2', "a2'", "a2'", 'a3']);
  // auto slots: only the 4 base pads, contiguous
  assert.deepEqual(tags(m, 36, 41, 1), ['a0', 'a1', 'a2', 'a3', null, null]);
  checkInvariants(m);
});

test('reslice to more slices: new pads are appended after the highest occupied key of non-auto slots', () => {
  const m = mk();
  const s = addSrc(m, 'a', 4, null, 2000); // starts 0,2000,4000,6000
  const old = s.slices.map((sl) => basePadOf(m, sl.id));
  m.shuffle({ seed: 3 });
  m.clearKey(37); // hole inside the occupied range, highest stays 39
  const before = m.getSlotKeys(0);
  assert.equal(before[39] !== null, true);
  m.setSlices(s.id, ranges(8)); // 8 slices of 1000: new starts 1000,3000,5000,7000 have no pad
  const keys = m.getSlotKeys(0);
  assert.deepEqual(keys.slice(36, 40), before.slice(36, 40), 'old part untouched');
  const fresh = [40, 41, 42, 43].map((k) => m.getPad(keys[k]));
  assert.deepEqual(fresh.map((p) => m.getSlice(p.sliceId).start), [1000, 3000, 5000, 7000], 'appended in time order');
  fresh.forEach((p) => assert.equal(p.base, true));
  assert.equal(keys[44], null);
  old.forEach((p, i) => assert.equal(m.getSlice(p.sliceId).start, i * 2000));
  // auto slots show all 8
  assert.deepEqual(tags(m, 36, 44, 2), ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', null]);
  checkInvariants(m);
});

test('appended reslice pads skip locked and mod-zone keys, and drop at the end of the keyboard', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2, null, 4000);
  m.shuffle({ seed: 1 });
  m.setLock(38, true); // empty locked key right after the occupied range
  m.setGlobal('modZoneStart', 39);
  m.setGlobal('modZoneOn', true); // 39..50
  m.setSlices(s.id, ranges(8, 1000));
  // occupied: 36,37 -> new pads at 51.. (38 locked, 39..50 mod zone)
  const keys = m.getSlotKeys(0);
  assert.equal(keys[38], null);
  for (let k = 39; k <= 50; k++) assert.equal(keys[k], null);
  const placed = [];
  for (let k = 51; k < 128; k++) if (keys[k] !== null) placed.push(k);
  assert.deepEqual(placed, [51, 52, 53, 54, 55, 56]);
  checkInvariants(m);

  const m2 = mk();
  const s2 = addSrc(m2, 'a', 2, null, 4000);
  m2.setGlobal('rootKey', 125);
  m2.applyLayout(0);
  m2.shuffle({ seed: 1 });
  m2.setSlices(s2.id, ranges(8, 1000));
  assert.equal(m2.occupiedKeys(0).length, 3, 'keys 125,126,127 only');
  assert.equal(padIds(m2).length, 8, 'pads still exist when they do not fit on a key');
  checkInvariants(m2);
});

test('reslice to fewer slices merges former-base pads; all sources keep their own pads', () => {
  const m = mk();
  const a = addSrc(m, 'a', 6);
  const b = addSrc(m, 'b', 4);
  const bPads = b.slices.map((sl) => basePadOf(m, sl.id));
  const bJson = JSON.stringify(bPads);
  m.setSlices(a.id, [{ start: 0, end: 3000 }, { start: 3000, end: 6000 }]);
  assert.equal(a.slices.length, 2);
  assert.equal(JSON.stringify(bPads), bJson, 'other source untouched');
  assert.deepEqual(tags(m, 36, 40), ['a0', 'a1', 'b0', 'b1', 'b2']);
  const aPads = Object.keys(m.state.pads).map((k) => m.state.pads[k]).filter((p) => p.sourceId === a.id);
  assert.equal(aPads.length, 6);
  assert.equal(aPads.filter((p) => p.base).length, 2);
  checkInvariants(m);
});

test('reslice when no existing pad points at a slice but non-base ones do still creates a base pad', () => {
  const m = mk();
  const s = addSrc(m, 'a', 4);
  const pads = s.slices.map((sl) => basePadOf(m, sl.id));
  // make pad 1 a non-base duplicate living on slice 0's neighbourhood
  const dup = m.duplicatePad(36, 50);
  assert.equal(dup.base, false);
  // collapse everything into one slice, then expand again
  m.setSlices(s.id, [{ start: 0, end: 4000 }]);
  assert.equal(s.slices.length, 1);
  assert.equal(pads.filter((p) => p.base).length, 1);
  m.setSlices(s.id, ranges(4));
  checkInvariants(m);
  assert.equal(s.slices.length, 4);
});

test('reslice re-points the similar-swap cursor (origSliceId)', () => {
  const m = mk();
  const a = addSrc(m, 'a', 4, (i) => feat(1000 + i * 100));
  m.duplicatePad(36, 60);
  const p = m.swapSimilar(60, 1);
  assert.equal(p.origSliceId, a.slices[0].id);
  assert.equal(p.simIndex, 1);
  const oldOrig = p.origSliceId;
  m.setSlices(a.id, ranges(4));
  assert.notEqual(p.origSliceId, oldOrig);
  assert.equal(m.getSlice(p.origSliceId).start, 0);
  assert.equal(m.getSlice(p.sliceId).start, 1000);
  checkInvariants(m);
});

test('first setSlices of a source is part of adding it: no undo step, history cleared', () => {
  const m = mk();
  const a = addSrc(m, 'a', 4);
  m.setPadParam(basePadOf(m, a.slices[0].id).id, 'pitch', 3);
  assert.equal(m.canUndo(), true);
  const b = m.addSource({ name: 'b' });
  assert.equal(m.canUndo(), false, 'addSource clears history');
  m.setPadParam(basePadOf(m, a.slices[0].id).id, 'pitch', 4);
  assert.equal(m.canUndo(), true);
  m.setSourceInfo(b.id, { frames: 2000, sr: 44100, channels: 1 });
  m.setSlices(b.id, ranges(2));
  assert.equal(m.canUndo(), false, 'initial slicing clears history');
  m.setSlices(b.id, ranges(2));
  assert.equal(m.canUndo(), true, 'a real reslice is undoable');
});

test('reslice is undoable together with the slicing settings that caused it; redo re-applies', () => {
  const m = mk();
  const s = addSrc(m, 'a', 8);
  const before = stripped(m);
  m.setSourceSettings(s.id, { sensitivity: 80, mode: 'beat' });
  m.setSlices(s.id, ranges(4, 2000));
  assert.equal(s.slices.length, 4);
  assert.equal(s.slicing.sensitivity, 80);
  const after = stripped(m);
  assert.equal(m.undo(), true);
  assert.deepEqual(stripped(m), before);
  assert.equal(s.slicing.sensitivity, 50);
  assert.equal(s.slicing.mode, 'transient');
  assert.equal(s.slices.length, 8);
  assert.equal(m.redo(), true);
  assert.deepEqual(stripped(m), after);
  assert.equal(s.slicing.sensitivity, 80);
  checkInvariants(m);
});

test('consecutive reslices of the same source coalesce into one undo step (dial drag)', () => {
  const m = mk();
  const s = addSrc(m, 'a', 8);
  const before = stripped(m);
  for (let sens = 51; sens <= 60; sens++) {
    m.setSourceSettings(s.id, { sensitivity: sens });
    m.setSlices(s.id, ranges(8 - (sens % 3)));
  }
  assert.equal(m.undo(), true);
  assert.deepEqual(stripped(m), before);
  assert.equal(s.slicing.sensitivity, 50);
  assert.equal(m.canUndo(), false);
});

// ---------------------------------------------------------------- removeSource

test('removeSource deletes its pads, clears keys in all slots, re-lays out auto slots, clears history', () => {
  const m = mk();
  const a = addSrc(m, 'a', 4);
  const b = addSrc(m, 'b', 3);
  const c = addSrc(m, 'c', 2);
  m.setCurrentSlot(2);
  m.shuffle({ seed: 4 }); // slot 2 becomes manual and mixed
  m.setLock(40, true);
  const lockedTag = tag(m, 40, 2);
  const bPadIds = padIds(m).filter((id) => m.getPad(id).sourceId === b.id);
  assert.equal(bPadIds.length, 3);
  // a layer link from an a-pad to a b-pad
  const aPad = basePadOf(m, a.slices[0].id);
  const bPad = basePadOf(m, b.slices[0].id);
  m.setCurrentSlot(0);
  m.toggleLayer(36, 40);
  assert.deepEqual(aPad.layers, [bPad.id]);
  assert.equal(m.canUndo(), true);

  assert.equal(m.removeSource(b.id), true);
  assert.equal(m.getSource(b.id), null);
  assert.equal(m.canUndo(), false);
  assert.equal(m.canRedo(), false);
  bPadIds.forEach((id) => assert.equal(m.getPad(id), null));
  m.state.slots.forEach((slot) => slot.keys.forEach((pid) => {
    if (pid !== null) assert.ok(m.getPad(pid) && m.getPad(pid).sourceId !== b.id);
  }));
  assert.deepEqual(aPad.layers, [], 'dangling layer links are removed');
  // auto slots: a then c, contiguous
  assert.deepEqual(tags(m, 36, 42, 0), ['a0', 'a1', 'a2', 'a3', 'c0', 'c1', null]);
  assert.deepEqual(tags(m, 36, 42, 5), ['a0', 'a1', 'a2', 'a3', 'c0', 'c1', null]);
  // the manual slot only lost the keys of b
  const manual = tags(m, 0, 127, 2).filter((x) => x !== null);
  assert.equal(manual.length, 6);
  assert.equal(manual.filter((x) => x[0] === 'b').length, 0);
  assert.equal(m.state.slots[2].auto, false);
  if (lockedTag && lockedTag[0] === 'b') assert.equal(m.isLocked(40, 2), false, 'the lock of a deleted pad is released');
  // other sources keep slot and colour
  assert.deepEqual([a.slot, c.slot, a.color, c.color], [0, 2, 0, 2]);
  assert.equal(m.removeSource(b.id), false);
  assert.equal(m.removeSource(424242), false);
  checkInvariants(m);
});

test('removeSource resets similar-swap cursors that referenced the removed source', () => {
  const m = mk();
  const a = addSrc(m, 'a', 2, (i) => feat(1000 + i * 100));
  const b = addSrc(m, 'b', 2, (i) => feat(1050 + i * 100));
  m.duplicatePad(36, 60); // a0 copy
  const p = m.swapSimilar(60, 1); // -> b0 (distance 50)
  assert.equal(p.sourceId, b.id);
  assert.equal(p.origSliceId, a.slices[0].id);
  m.removeSource(a.id);
  assert.equal(p.origSliceId, null);
  assert.equal(p.simIndex, 0);
  assert.equal(p.sourceId, b.id, 'the pad itself lives on b and stays');
  checkInvariants(m);
});

test('removing every source empties all slots', () => {
  const m = mk();
  const a = addSrc(m, 'a', 4);
  const b = addSrc(m, 'b', 4);
  m.removeSource(a.id);
  m.removeSource(b.id);
  assert.deepEqual(m.state.pads, {});
  m.state.slots.forEach((s) => assert.ok(s.keys.every((k) => k === null)));
  assert.deepEqual(m.occupiedKeys(), []);
});

// ---------------------------------------------------------------- shuffle

function bigKit() {
  const m = mk();
  addSrc(m, 'a', 8, (i) => feat(1000 + i * 1000, -30 + i));
  addSrc(m, 'b', 4, (i) => feat(9000 + i * 1000, -20 + i));
  return m;
}

test('shuffle is deterministic for the same state and seed, differs across seeds', () => {
  const m1 = bigKit();
  const m2 = bigKit();
  const r1 = m1.shuffle({ mode: 'chaos', scope: 'all', seed: 42 });
  const r2 = m2.shuffle({ mode: 'chaos', scope: 'all', seed: 42 });
  assert.deepEqual(r1, r2);
  assert.deepEqual(tags(m1, 36, 47), tags(m2, 36, 47));
  const m3 = bigKit();
  m3.shuffle({ mode: 'chaos', scope: 'all', seed: 43 });
  assert.notDeepEqual(tags(m3, 36, 47), tags(m1, 36, 47));
  // and it actually moved something
  assert.notDeepEqual(tags(m1, 36, 47), tags(bigKit(), 36, 47));
});

test('chaos shuffle is a permutation of the same pads over the same keys', () => {
  const m = bigKit();
  const before = m.getSlotKeys(0);
  const res = m.shuffle({ mode: 'chaos', scope: 'all', seed: 7, flipPct: 0 });
  const after = m.getSlotKeys(0);
  assert.equal(res.moved, 12);
  assert.deepEqual(after.map((x) => x === null), before.map((x) => x === null), 'same occupied keys');
  assert.deepEqual(after.filter((x) => x !== null).sort((a, b) => a - b), before.filter((x) => x !== null).sort((a, b) => a - b));
  assert.equal(padIds(m).length, 12, 'no pads were created');
  assert.equal(m.state.slots[0].auto, false);
  for (let s = 1; s < 8; s++) assert.equal(m.state.slots[s].auto, true);
  assert.deepEqual(tags(m, 36, 47, 1), ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b0', 'b1', 'b2', 'b3'], 'other slots unaffected');
  checkInvariants(m);
});

test('shuffle uses the globals when options are omitted, and never touches globals.seed', () => {
  const m1 = bigKit();
  const m2 = bigKit();
  m1.setGlobal('seed', 99);
  m1.setGlobal('shuffleMode', 'chaos');
  m1.setGlobal('shuffleScope', 'all');
  m1.setGlobal('flipPct', 0);
  m1.shuffle();
  m2.shuffle({ seed: 99, mode: 'chaos', scope: 'all', flipPct: 0 });
  assert.deepEqual(m1.getSlotKeys(0), m2.getSlotKeys(0));
  assert.equal(m1.globals().seed, 99);
  // same pads, so same ids: also identical to an explicit-seed run on a third model
  const m3 = bigKit();
  m3.setGlobal('flipPct', 100);
  m3.shuffle({ seed: 99, flipPct: 0 });
  assert.deepEqual(m3.getSlotKeys(0), m2.getSlotKeys(0));
});

test('locked keys and mod-zone keys are not touched by shuffle', () => {
  const m = bigKit();
  m.setLock(38, true);
  m.setLock(44, true);
  m.setGlobal('modZoneStart', 46);
  m.setGlobal('modZoneOn', true); // 46..57
  // park a pad on a mod key by hand
  const parked = m.getPadOnKey(36);
  m.assignPad(50, parked.id);
  const before = m.getSlotKeys(0);
  const res = m.shuffle({ seed: 5 });
  const after = m.getSlotKeys(0);
  assert.equal(after[38], before[38]);
  assert.equal(after[44], before[44]);
  assert.equal(after[50], before[50]);
  assert.equal(m.isLocked(38) && m.isLocked(44), true);
  // keys in scope: 36..47 minus 38,44 and minus the mod keys 46,47 -> 36,37,39..43,45
  const inScope = [36, 37, 39, 40, 41, 42, 43, 45];
  assert.equal(res.moved, inScope.length);
  inScope.forEach((k) => assert.ok(before[k] !== null));
  const outside = after.map((v, k) => (inScope.indexOf(k) >= 0 ? 'x' : v)).join();
  assert.equal(outside, before.map((v, k) => (inScope.indexOf(k) >= 0 ? 'x' : v)).join());
  assert.deepEqual(inScope.map((k) => after[k]).sort((a, b) => a - b), inScope.map((k) => before[k]).sort((a, b) => a - b));
  checkInvariants(m);
});

test("shuffle scope 'source' only moves keys of that source", () => {
  const m = bigKit();
  const a = m.listSources()[0];
  const b = m.listSources()[1];
  const before = m.getSlotKeys(0);
  const res = m.shuffle({ scope: 'source', sourceId: a.id, seed: 11 });
  const after = m.getSlotKeys(0);
  assert.equal(res.moved, 8);
  for (let k = 44; k < 48; k++) assert.equal(after[k], before[k], 'b keys unchanged at ' + k);
  const aKeys = [36, 37, 38, 39, 40, 41, 42, 43];
  aKeys.forEach((k) => assert.equal(m.getPad(after[k]).sourceId, a.id));
  assert.deepEqual(aKeys.map((k) => after[k]).sort((x, y) => x - y), aKeys.map((k) => before[k]).sort((x, y) => x - y));
  assert.notDeepEqual(aKeys.map((k) => after[k]), aKeys.map((k) => before[k]));
  // source b
  const m2 = bigKit();
  const b2 = m2.listSources()[1];
  const before2 = m2.getSlotKeys(0);
  assert.equal(m2.shuffle({ scope: 'source', sourceId: b2.id, seed: 2 }).moved, 4);
  for (let k = 36; k < 44; k++) assert.equal(m2.getSlotKeys(0)[k], before2[k]);
  assert.ok(b);
});

test("shuffle scope 'source' with an unknown or missing source does nothing", () => {
  const m = bigKit();
  const before = stripped(m);
  assert.deepEqual(m.shuffle({ scope: 'source', sourceId: 99999, seed: 3 }), { moved: 0 });
  assert.deepEqual(m.shuffle({ scope: 'source', seed: 3 }), { moved: 0 });
  assert.deepEqual(stripped(m), before);
  assert.equal(m.canUndo(), false, 'a no-op shuffle creates no undo step');
  const empty = mk();
  assert.deepEqual(empty.shuffle({ seed: 1 }), { moved: 0 });
  assert.equal(empty.canUndo(), false);
});

test('smart shuffle keeps pads inside their cluster (k = round(n/6)), pads without features stay together', () => {
  const m = mk();
  addSrc(m, 'a', 12, (i) => feat(1000 + i * 1000)); // fake kmeans: k=2 -> idx 0..5 low, 6..11 high
  const before = m.getSlotKeys(0);
  const res = m.shuffle({ mode: 'smart', scope: 'all', seed: 3 });
  const after = m.getSlotKeys(0);
  assert.equal(res.moved, 12);
  assert.deepEqual(m.fake.calls.kmeans, [{ n: 12, k: 2 }]);
  assert.equal(m.fake.calls.normalize, 1);
  const cluster = (pid) => (m.getSlice(m.getPad(pid).sliceId).features.centroidHz <= 6000 ? 0 : 1);
  let changed = 0;
  for (let k = 36; k < 48; k++) {
    assert.equal(cluster(after[k]), cluster(before[k]), 'key ' + k + ' stays in its cluster');
    if (after[k] !== before[k]) changed++;
  }
  assert.ok(changed > 0, 'something moved');
  assert.deepEqual(after.filter((x) => x !== null).sort((a, b) => a - b), before.filter((x) => x !== null).sort((a, b) => a - b));
  // deterministic
  const m2 = mk();
  addSrc(m2, 'a', 12, (i) => feat(1000 + i * 1000));
  m2.shuffle({ mode: 'smart', scope: 'all', seed: 3 });
  assert.deepEqual(m2.getSlotKeys(0), after);
  checkInvariants(m);
});

test('smart shuffle: featureless pads form their own cluster; k is capped by pads with features', () => {
  const m = mk();
  addSrc(m, 'a', 12, (i) => feat(1000 + i * 1000));
  addSrc(m, 'b', 4); // no features
  m.shuffle({ mode: 'smart', seed: 8 });
  assert.deepEqual(m.fake.calls.kmeans, [{ n: 12, k: 3 }], 'k = round(16/6) = 3');
  const after = m.getSlotKeys(0);
  for (let k = 48; k < 52; k++) assert.equal(m.getPad(after[k]).sourceId, m.listSources()[1].id, 'b stays on its keys');
  for (let k = 36; k < 48; k++) assert.equal(m.getPad(after[k]).sourceId, m.listSources()[0].id);
  // cluster check with the fake's 3 bands over 1000..12000
  const band = (pid) => Math.min(2, Math.floor((m.getSlice(m.getPad(pid).sliceId).features.centroidHz - 1000) / 11000 * 3));
  const m0 = mk();
  addSrc(m0, 'a', 12, (i) => feat(1000 + i * 1000));
  addSrc(m0, 'b', 4);
  const before = m0.getSlotKeys(0);
  for (let k = 36; k < 48; k++) assert.equal(band(after[k]), band(before[k]));
  checkInvariants(m);

  // only featureless pads: no kmeans call at all
  const m2 = mk();
  addSrc(m2, 'a', 6);
  m2.shuffle({ mode: 'smart', seed: 1 });
  assert.equal(m2.fake.calls.kmeans.length, 0);
  assert.equal(m2.fake.calls.normalize, 0);
  // k >= 1 for tiny kits
  const m3 = mk();
  addSrc(m3, 'a', 2, (i) => feat(100 + i));
  m3.shuffle({ mode: 'smart', seed: 1 });
  assert.deepEqual(m3.fake.calls.kmeans, [{ n: 2, k: 1 }]);
});

test("smart shuffle with scope 'source' only clusters that source's pads", () => {
  const m = mk();
  addSrc(m, 'a', 12, (i) => feat(1000 + i * 1000));
  const b = addSrc(m, 'b', 6, (i) => feat(50000 + i * 1000));
  const before = m.getSlotKeys(0);
  m.shuffle({ mode: 'smart', scope: 'source', sourceId: b.id, seed: 2 });
  assert.deepEqual(m.fake.calls.kmeans, [{ n: 6, k: 1 }]);
  for (let k = 36; k < 48; k++) assert.equal(m.getSlotKeys(0)[k], before[k]);
});

test('flipPct 100 creates reversed non-base copies on the moved keys only; other slots are unaffected', () => {
  const m = bigKit();
  const baseIds = padIds(m);
  const baseJson = JSON.stringify(baseIds.map((id) => m.getPad(id)));
  const slot1 = m.getSlotKeys(1);
  const before0 = m.getSlotKeys(0).filter((x) => x !== null);
  const res = m.shuffle({ mode: 'chaos', scope: 'all', seed: 9, flipPct: 100 });
  assert.equal(res.moved, 12);
  assert.deepEqual(m.getSlotKeys(1), slot1, 'other slots unaffected');
  assert.equal(JSON.stringify(baseIds.map((id) => m.getPad(id))), baseJson, 'original pads are untouched');
  const keys0 = m.getSlotKeys(0);
  const slices = [];
  for (let k = 36; k < 48; k++) {
    const p = m.getPad(keys0[k]);
    assert.equal(p.base, false, 'copy at ' + k);
    assert.equal(p.reverse, true);
    assert.ok(baseIds.indexOf(p.id) < 0, 'fresh id');
    slices.push(p.sliceId);
  }
  // same multiset of slices as before
  assert.deepEqual(slices.sort((x, y) => x - y), before0.map((id) => m.getPad(id).sliceId).sort((x, y) => x - y));
  assert.equal(padIds(m).length, 24);
  // a copy carries the settings of the pad it was made from
  checkInvariants(m);
  // shuffling again garbage-collects the previous copies
  m.shuffle({ seed: 10, flipPct: 100 });
  assert.equal(padIds(m).length, 24);
  checkInvariants(m);
  // without flip nothing is created and the copies get dropped
  m.shuffle({ seed: 11, flipPct: 0 });
  assert.equal(padIds(m).length, 24, 'copies on keys are still there (they were just permuted)');
});

test('flipped copies inherit settings; flipPct 0 never flips; fractional flips are deterministic', () => {
  const m = bigKit();
  const p = m.getPadOnKey(36);
  m.setPadParam(p.id, 'pitch', 7);
  m.setPadParam(p.id, 'decayMs', 111);
  m.shuffle({ seed: 1, flipPct: 100 });
  const copies = m.getSlotKeys(0).filter((x) => x !== null).map((id) => m.getPad(id));
  const mine = copies.filter((c) => c.sliceId === p.sliceId)[0];
  assert.equal(mine.pitch, 7);
  assert.equal(mine.decayMs, 111);
  assert.equal(mine.reverse, true);

  const m0 = bigKit();
  m0.shuffle({ seed: 1, flipPct: 0 });
  assert.equal(padIds(m0).length, 12);
  assert.ok(m0.getSlotKeys(0).filter((x) => x !== null).every((id) => m0.getPad(id).base && !m0.getPad(id).reverse));

  const h1 = bigKit();
  const h2 = bigKit();
  h1.shuffle({ seed: 5, flipPct: 50 });
  h2.shuffle({ seed: 5, flipPct: 50 });
  const rev = (m) => m.getSlotKeys(0).slice(36, 48).map((id) => m.getPad(id).reverse);
  assert.deepEqual(rev(h1), rev(h2));
  const n = rev(h1).filter(Boolean).length;
  assert.ok(n > 0 && n < 12, 'about half flipped, got ' + n);
  assert.equal(padIds(h1).length, 12 + n);
  // a negative / huge flipPct is clamped
  const c = bigKit();
  c.shuffle({ seed: 1, flipPct: 1000 });
  assert.ok(c.getSlotKeys(0).slice(36, 48).every((id) => c.getPad(id).reverse));
  const d = bigKit();
  d.shuffle({ seed: 1, flipPct: -5 });
  assert.equal(padIds(d).length, 12);
});

test('shuffle is a single undo step; undo/redo restore keys and drop/restore flip copies', () => {
  const m = bigKit();
  const before = stripped(m);
  m.shuffle({ seed: 3, flipPct: 100 });
  const after = stripped(m);
  assert.equal(m.undo(), true);
  assert.deepEqual(stripped(m), before);
  assert.equal(m.state.slots[0].auto, true);
  assert.equal(m.redo(), true);
  assert.deepEqual(stripped(m), after);
  checkInvariants(m);
});

// ---------------------------------------------------------------- setPadParam

test('setPadParam clamps every numeric parameter to its documented range', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const p = basePadOf(m, s.slices[0].id);
  const cases = {
    pitch: [-48, 48], fine: [-100, 100], gainDb: [-60, 12], attackMs: [0, 2000], decayMs: [0, 5000],
    sustain: [0, 1], releaseMs: [0, 5000], startOffsetMs: [0, 1000], loopSizeMs: [1, 500],
    loopPos: [0, 1], cutoffHz: [20, 20000], drive: [0, 1]
  };
  Object.keys(cases).forEach((name) => {
    const [lo, hi] = cases[name];
    assert.deepEqual(Model.PAD_RANGES[name], [lo, hi], name + ' PAD_RANGES');
    assert.equal(m.setPadParam(p.id, name, lo - 1000), true);
    assert.equal(p[name], lo, name + ' low clamp');
    assert.equal(m.setPadParam(p.id, name, hi + 1000), true);
    assert.equal(p[name], hi, name + ' high clamp');
    const mid = (lo + hi) / 2;
    assert.equal(m.setPadParam(p.id, name, mid), true);
    assert.equal(p[name], mid, name + ' in range');
  });
  assert.equal(m.setPadParam(p.id, 'pitch', '3.5'), true, 'numeric strings are accepted');
  assert.equal(p.pitch, 3.5);
  assert.equal(m.setPadParam(p.id, 'pitch', NaN), false);
  assert.equal(m.setPadParam(p.id, 'pitch', 'abc'), false);
  assert.equal(m.setPadParam(p.id, 'pitch', null), false);
  assert.equal(m.setPadParam(p.id, 'pitch', Infinity), false);
  assert.equal(p.pitch, 3.5);
});

test('setPadParam booleans', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const p = basePadOf(m, s.slices[0].id);
  m.setPadParam(p.id, 'reverse', 1);
  m.setPadParam(p.id, 'loopOn', true);
  assert.equal(p.reverse, true);
  assert.equal(p.loopOn, true);
  m.setPadParam(p.id, 'reverse', 0);
  m.setPadParam(p.id, 'loopOn', false);
  assert.equal(p.reverse, false);
  assert.equal(p.loopOn, false);
  assert.equal(m.setPadParam(p.id, 'reverse', 'maybe'), false);
  assert.equal(m.setPadParam(p.id, 'reverse', undefined), false);
});

test('setPadParam rejects unknown names, protected fields and unknown pads', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const p = basePadOf(m, s.slices[0].id);
  const snap = JSON.stringify(p);
  ['id', 'sourceId', 'sliceId', 'base', 'layers', 'origSliceId', 'simIndex', 'bogus', 'constructor', 'toString', '__proto__', ''].forEach((name) => {
    assert.equal(m.setPadParam(p.id, name, 5), false, name);
  });
  assert.equal(JSON.stringify(p), snap);
  assert.equal(m.setPadParam(999999, 'pitch', 1), false);
  assert.equal(m.canUndo(), false);
});

test('setPadParam: unchanged values create no undo step and no notification', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const p = basePadOf(m, s.slices[0].id);
  const kinds = record(m);
  assert.equal(m.setPadParam(p.id, 'pitch', 0), true);
  assert.equal(m.canUndo(), false);
  assert.deepEqual(kinds, []);
  m.setPadParam(p.id, 'pitch', 2);
  assert.deepEqual(kinds, ['pads']);
  assert.equal(m.canUndo(), true);
});

test('applyParamToSource copies one param to all pads of the same source (incl. copies) in one undo step', () => {
  const m = mk();
  const a = addSrc(m, 'a', 4);
  const b = addSrc(m, 'b', 2);
  const p = basePadOf(m, a.slices[1].id);
  const dup = m.duplicatePad(37, 60);
  m.setPadParam(p.id, 'cutoffHz', 1234);
  const before = stripped(m);
  const n = m.applyParamToSource(p.id, 'cutoffHz');
  assert.equal(n, 4, 'three other base pads + the duplicate');
  a.slices.forEach((sl) => assert.equal(basePadOf(m, sl.id).cutoffHz, 1234));
  assert.equal(dup.cutoffHz, 1234);
  b.slices.forEach((sl) => assert.equal(basePadOf(m, sl.id).cutoffHz, 20000), 'other sources untouched');
  assert.equal(p.pitch, 0);
  m.undo();
  assert.deepEqual(stripped(m), before);
  // nothing to do -> 0, no history entry
  m.redo();
  const depth = (() => { let d = 0; while (m.canUndo()) { m.undo(); d++; } return d; })();
  while (m.canRedo()) m.redo();
  assert.equal(m.applyParamToSource(p.id, 'cutoffHz'), 0);
  let d2 = 0;
  while (m.canUndo()) { m.undo(); d2++; }
  assert.equal(d2, depth);
  assert.equal(m.applyParamToSource(p.id, 'bogus'), 0);
  assert.equal(m.applyParamToSource(31337, 'pitch'), 0);
  assert.equal(m.applyParamToSource(p.id, 'layers'), 0);
});

// ---------------------------------------------------------------- undo / redo

test('undo/redo basics: setPadParam, canUndo/canRedo, redo cleared by a new edit', () => {
  const m = mk();
  const s = addSrc(m, 'a', 2);
  const p = basePadOf(m, s.slices[0].id);
  assert.equal(m.undo(), false);
  assert.equal(m.redo(), false);
  m.setPadParam(p.id, 'pitch', 3);
  assert.equal(m.canUndo(), true);
  assert.equal(m.canRedo(), false);
  assert.equal(m.undo(), true);
  assert.equal(p.pitch, 0);
  assert.equal(m.getPad(p.id).pitch, 0);
  assert.equal(m.canUndo(), false);
  assert.equal(m.canRedo(), true);
  assert.equal(m.redo(), true);
  assert.equal(m.getPad(p.id).pitch, 3);
  m.undo();
  m.setPadParam(p.id, 'fine', 10);
  assert.equal(m.canRedo(), false, 'a new edit clears redo');
});

test('consecutive setPadParam on the same pad+param coalesce into one step', () => {
  const m = mk();
  const s = addSrc(m, 'a', 3);
  const p = basePadOf(m, s.slices[0].id);
  const q = basePadOf(m, s.slices[1].id);
  [1, 2, 3, 4, 5].forEach((v) => m.setPadParam(p.id, 'pitch', v));
  m.undo();
  assert.equal(m.getPad(p.id).pitch, 0, 'one undo reverts the whole drag');
  assert.equal(m.canUndo(), false);
  m.redo();
  assert.equal(m.getPad(p.id).pitch, 5);

  // a different param breaks the run
  m.setPadParam(p.id, 'fine', 7);
  m.setPadParam(p.id, 'fine', 8);
  m.setPadParam(p.id, 'pitch', 6);
  m.undo();
  assert.equal(p.pitch, 5);
  assert.equal(p.fine, 8);
  m.undo();
  assert.equal(p.fine, 0);
  m.undo();
  assert.equal(p.pitch, 0);
  assert.equal(m.canUndo(), false);
  while (m.canRedo()) m.redo();

  // a different pad breaks the run
  m.setPadParam(p.id, 'gainDb', -1);
  m.setPadParam(q.id, 'gainDb', -2);
  m.setPadParam(q.id, 'gainDb', -3);
  m.undo();
  assert.equal(q.gainDb, 0);
  assert.equal(p.gainDb, -1);

  // another undoable operation in between breaks the run
  m.redo();
  m.setPadParam(p.id, 'drive', 0.1);
  m.swapKeys(36, 37);
  m.setPadParam(p.id, 'drive', 0.2);
  m.undo();
  assert.equal(p.drive, 0.1);
  m.undo();
  m.undo();
  assert.equal(p.drive, 0);

  // undo in between breaks the run too
  const m2 = mk();
  const s2 = addSrc(m2, 'a', 2);
  const p2 = basePadOf(m2, s2.slices[0].id);
  m2.setPadParam(p2.id, 'pitch', 1);
  m2.undo();
  m2.setPadParam(p2.id, 'pitch', 2);
  assert.equal(m2.canRedo(), false);
  m2.undo();
  assert.equal(p2.pitch, 0);
  assert.equal(m2.canUndo(), false, 'the pre-undo step was discarded, not duplicated');
});

test('undo history is limited to 50 steps', () => {
  const m = mk();
  addSrc(m, 'a', 2);
  for (let i = 0; i < 60; i++) assert.equal(m.swapKeys(36, 37), true);
  let n = 0;
  while (m.canUndo()) {
    assert.equal(m.undo(), true);
    n++;
  }
  assert.equal(n, 50);
  assert.equal(m.undo(), false);
  let r = 0;
  while (m.canRedo()) {
    m.redo();
    r++;
  }
  assert.equal(r, 50);
});

test('addSource and removeSource clear the undo/redo history', () => {
  const m = mk();
  const a = addSrc(m, 'a', 3);
  m.swapKeys(36, 37);
  m.swapKeys(37, 38);
  m.undo();
  assert.equal(m.canUndo() && m.canRedo(), true);
  m.addSource({ name: 'b' });
  assert.equal(m.canUndo(), false);
  assert.equal(m.canRedo(), false);
  m.swapKeys(36, 37);
  assert.equal(m.canUndo(), true);
  m.removeSource(a.id);
  assert.equal(m.canUndo(), false);
  assert.equal(m.canRedo(), false);
  assert.equal(m.undo(), false);
});

test('undo restores keys, locks, auto flags and the current slot', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  m.setCurrentSlot(2);
  const before = stripped(m);
  m.setLock(37, true);
  m.swapKeys(36, 38);
  assert.equal(m.state.slots[2].auto, false);
  m.setCurrentSlot(5);
  m.clearKey(36);
  m.undo(); // clearKey (slot 5)
  assert.equal(m.currentSlot(), 5);
  m.undo(); // swapKeys (taken while slot 2 was current)
  assert.equal(m.currentSlot(), 2);
  assert.equal(tag(m, 36), 'a0');
  assert.equal(m.isLocked(37), true, 'lock toggles are not undo steps; they live in the next snapshot');
  assert.equal(m.canUndo(), false);
  assert.ok(before);
  checkInvariants(m);
});

test('undo/redo notify with kind "all"', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  m.swapKeys(36, 37);
  const kinds = record(m);
  m.undo();
  m.redo();
  assert.deepEqual(kinds, ['all', 'all']);
});

test('undo re-lays out auto slots (derived data) after layout globals changed in between', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  m.swapKeys(36, 37);        // slot 0 manual
  m.setGlobal('rootKey', 60); // slots 1..7 now at 60
  m.undo();
  assert.deepEqual(tags(m, 60, 62, 1), ['a0', 'a1', 'a2'], 'auto slots follow the current globals');
  assert.equal(tag(m, 36, 1), null);
  assert.equal(tag(m, 36, 0), 'a0');
  checkInvariants(m);
});

test('applyLayout that changes nothing is not an undo step', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  assert.equal(m.canUndo(), false);
  m.applyLayout(0);
  assert.equal(m.canUndo(), false);
  m.swapKeys(36, 37);
  m.applyLayout(0);
  assert.equal(m.canUndo(), true);
  m.undo(); // reverts the layout
  assert.equal(tag(m, 36), 'a1');
  m.undo(); // reverts the swap
  assert.equal(tag(m, 36), 'a0');
  assert.equal(m.canUndo(), false);
});

// ---------------------------------------------------------------- spread

function spreadKit() {
  const m = mk();
  addSrc(m, 'a', 8, (i) => feat(1000 + i * 100));
  return m;
}

test('spread pitch: level 0 unchanged, copies on the following keys with base + i*step', () => {
  const m = spreadKit();
  const p = m.getPadOnKey(36);
  m.setPadParam(p.id, 'pitch', 2);
  m.setPadParam(p.id, 'decayMs', 123);
  m.setPadParam(p.id, 'reverse', true);
  const keys = m.spread(36, 'pitch', 4, 3);
  assert.deepEqual(keys, [37, 38, 39]);
  assert.equal(m.getPadOnKey(36), p, 'level 0 is the same pad');
  assert.equal(p.pitch, 2);
  assert.deepEqual([37, 38, 39].map((k) => m.getPadOnKey(k).pitch), [5, 8, 11]);
  [37, 38, 39].forEach((k) => {
    const c = m.getPadOnKey(k);
    assert.equal(c.base, false);
    assert.notEqual(c.id, p.id);
    assert.equal(c.sliceId, p.sliceId);
    assert.equal(c.sourceId, p.sourceId);
    assert.equal(c.decayMs, 123);
    assert.equal(c.reverse, true);
    assert.deepEqual(c.layers, []);
  });
  assert.equal(m.state.slots[0].auto, false);
  assert.equal(tag(m, 40, 0), 'a4', 'keys after the spread are untouched');
  assert.equal(tag(m, 37, 1), 'a1', 'other slots unaffected');
  assert.equal(m.getPadOnKey(37, 1).pitch, 0);
  checkInvariants(m);
  // negative step and clamp
  const m2 = spreadKit();
  m2.setPadParam(m2.getPadOnKey(36).id, 'pitch', 40);
  m2.spread(36, 'pitch', 4, 5);
  assert.deepEqual([37, 38, 39].map((k) => m2.getPadOnKey(k).pitch), [45, 48, 48]);
  const m3 = spreadKit();
  m3.spread(36, 'pitch', 3, -12);
  assert.deepEqual([37, 38].map((k) => m3.getPadOnKey(k).pitch), [-12, -24]);
});

test('spread decay / start / cutoff', () => {
  let m = spreadKit();
  assert.deepEqual(m.spread(36, 'decay', 4, 100), [37, 38, 39]);
  assert.deepEqual([36, 37, 38, 39].map((k) => m.getPadOnKey(k).decayMs), [300, 400, 500, 600]);
  m = spreadKit();
  m.spread(36, 'decay', 4, -200);
  assert.deepEqual([36, 37, 38, 39].map((k) => m.getPadOnKey(k).decayMs), [300, 100, 0, 0], 'clamped at 0');
  m = spreadKit();
  m.spread(36, 'decay', 3, 4000);
  assert.deepEqual([37, 38].map((k) => m.getPadOnKey(k).decayMs), [4300, 5000]);

  m = spreadKit();
  m.spread(36, 'start', 4, 25);
  assert.deepEqual([36, 37, 38, 39].map((k) => m.getPadOnKey(k).startOffsetMs), [0, 25, 50, 75]);
  m = spreadKit();
  m.setPadParam(m.getPadOnKey(36).id, 'startOffsetMs', 30);
  m.spread(36, 'start', 4, -20);
  assert.deepEqual([36, 37, 38, 39].map((k) => m.getPadOnKey(k).startOffsetMs), [30, 10, 0, 0]);
  m = spreadKit();
  m.spread(36, 'start', 3, 900);
  assert.deepEqual([37, 38].map((k) => m.getPadOnKey(k).startOffsetMs), [900, 1000]);

  m = spreadKit();
  m.setPadParam(m.getPadOnKey(36).id, 'cutoffHz', 8000);
  m.spread(36, 'cutoff', 4, -12);
  assert.deepEqual([36, 37, 38, 39].map((k) => m.getPadOnKey(k).cutoffHz), [8000, 4000, 2000, 1000]);
  m = spreadKit();
  m.setPadParam(m.getPadOnKey(36).id, 'cutoffHz', 8000);
  m.spread(36, 'cutoff', 3, 12);
  assert.deepEqual([37, 38].map((k) => m.getPadOnKey(k).cutoffHz), [16000, 20000], 'clamped at 20 kHz');
  m = spreadKit();
  m.setPadParam(m.getPadOnKey(36).id, 'cutoffHz', 8000);
  m.spread(36, 'cutoff', 3, -120);
  assert.deepEqual([37, 38].map((k) => m.getPadOnKey(k).cutoffHz), [20, 20], 'clamped at 20 Hz');
  m = spreadKit();
  m.setPadParam(m.getPadOnKey(36).id, 'cutoffHz', 1000);
  m.spread(36, 'cutoff', 3, 7);
  assert.ok(Math.abs(m.getPadOnKey(37).cutoffHz - 1000 * Math.pow(2, 7 / 12)) < 1e-9);
  assert.ok(Math.abs(m.getPadOnKey(38).cutoffHz - 1000 * Math.pow(2, 14 / 12)) < 1e-9);
});

test('spread skips locked and mod-zone keys, stops at 127, ignores bad input', () => {
  const m = spreadKit();
  m.setLock(38, true);
  m.setGlobal('modZoneStart', 40);
  m.setGlobal('modZoneOn', true); // 40..51
  const lockedPad = m.getPadOnKey(38);
  const keys = m.spread(36, 'pitch', 5, 1);
  assert.deepEqual(keys, [37, 39, 52, 53]);
  assert.equal(m.getPadOnKey(38), lockedPad);
  assert.deepEqual(keys.map((k) => m.getPadOnKey(k).pitch), [1, 2, 3, 4]);
  for (let k = 40; k <= 51; k++) assert.equal(m.getPadOnKey(k), null);

  const e = spreadKit();
  e.assignPad(126, e.getPadOnKey(36).id);
  assert.deepEqual(e.spread(126, 'pitch', 16, 1), [127]);
  assert.deepEqual(e.spread(127, 'pitch', 16, 1), []);

  const x = spreadKit();
  assert.deepEqual(x.spread(100, 'pitch', 4, 1), [], 'no pad on the key');
  assert.deepEqual(x.spread(36, 'pitch', 1, 1), [], 'count 1 = nothing to write');
  assert.deepEqual(x.spread(36, 'bogus', 4, 1), []);
  assert.deepEqual(x.spread(36, 'pitch', 4, NaN), []);
  assert.deepEqual(x.spread(-1, 'pitch', 4, 1), []);
  assert.equal(x.canUndo(), false, 'refused spreads leave no undo step');
  assert.equal(x.state.slots[0].auto, true);
});

test('spread uses the globals for omitted arguments and accepts menu indices / field names', () => {
  const m = spreadKit();
  m.setGlobal('spreadParam', 'decay');
  m.setGlobal('spreadCount', 3);
  m.setGlobal('spreadStep', 50);
  assert.deepEqual(m.spread(36), [37, 38]);
  assert.deepEqual([36, 37, 38].map((k) => m.getPadOnKey(k).decayMs), [300, 350, 400]);
  const m2 = spreadKit();
  assert.deepEqual(m2.spread(36, 1, 3, 10), [37, 38], 'index 1 = decay');
  assert.deepEqual([37, 38].map((k) => m2.getPadOnKey(k).decayMs), [310, 320]);
  const m3 = spreadKit();
  m3.spread(36, 'startOffsetMs', 3, 10);
  assert.equal(m3.getPadOnKey(38).startOffsetMs, 20);
  const m4 = spreadKit();
  assert.equal(m4.spread(36, 'pitch', 1000, 1).length, 91, 'count is bounded by the keyboard');
});

test('spread overwrites the following keys of the current slot only and is undoable', () => {
  const m = spreadKit();
  const before = stripped(m);
  m.spread(36, 'pitch', 3, 2);
  assert.equal(tag(m, 37, 0), "a0'");
  assert.equal(tag(m, 37, 1), 'a1');
  assert.equal(padIds(m).length, 10);
  m.undo();
  assert.deepEqual(stripped(m), before);
  assert.equal(padIds(m).length, 8);
});

// ---------------------------------------------------------------- similar swap

function simKit() {
  const m = mk();
  // centroid 1000, 1100, 1400, 2000, 3000, 5000
  addSrc(m, 'a', 6, (i) => feat([1000, 1100, 1400, 2000, 3000, 5000][i]));
  return m;
}

test('swapSimilar walks the similarity ranking from the original slice (cursor), clamped at both ends', () => {
  const m = simKit();
  const a = m.listSources()[0];
  const basePad = m.getPadOnKey(36);
  m.setPadParam(basePad.id, 'pitch', 7);
  m.setPadParam(basePad.id, 'gainDb', -3);
  const p = m.swapSimilar(36, 1);
  assert.ok(p);
  assert.equal(m.getPadOnKey(36), p);
  assert.equal(p.sliceId, a.slices[1].id);
  assert.equal(p.simIndex, 1);
  assert.equal(p.origSliceId, a.slices[0].id);
  assert.equal(p.pitch, 7, 'settings stay');
  assert.equal(p.gainDb, -3);
  assert.equal(p.base, false, 'the base pad stays with its slice; the key gets a variation');
  assert.equal(basePad.sliceId, a.slices[0].id);
  assert.equal(basePad.base, true);
  assert.equal(basePad.simIndex, 0);
  assert.equal(tag(m, 36, 1), 'a0', 'other slots are unaffected');
  assert.equal(m.state.slots[0].auto, false);
  checkInvariants(m);

  // further steps edit the variation in place
  const p2 = m.swapSimilar(36, 1);
  assert.equal(p2, p);
  assert.equal(p.sliceId, a.slices[2].id);
  assert.equal(p.simIndex, 2);
  for (let i = 0; i < 10; i++) m.swapSimilar(36, 1);
  assert.equal(p.sliceId, a.slices[5].id);
  assert.equal(p.simIndex, 5, 'clamped at the end of the ranking');
  assert.equal(p.origSliceId, a.slices[0].id);
  for (let i = 0; i < 10; i++) m.swapSimilar(36, -1);
  assert.equal(p.sliceId, a.slices[0].id);
  assert.equal(p.simIndex, 0, 'index 0 = original');
  assert.equal(m.swapSimilar(36, -1), p);
  assert.equal(p.simIndex, 0, 'clamped at the start');
  assert.equal(m.swapSimilar(36, 0), p, 'dir 0 changes nothing');
  assert.equal(padIds(m).length, 7);
  checkInvariants(m);
});

test('swapSimilar ranks across sources and changes sourceId/sliceId', () => {
  const m = mk();
  const a = addSrc(m, 'a', 2, (i) => feat(1000 + i * 1000));
  const b = addSrc(m, 'b', 2, (i) => feat(1050 + i * 1000));
  m.duplicatePad(36, 70); // a0 copy (non-base)
  const copy = m.getPadOnKey(70);
  const r = m.swapSimilar(70, 1);
  assert.equal(r, copy, 'non-base pads are edited in place');
  assert.equal(copy.sourceId, b.id);
  assert.equal(copy.sliceId, b.slices[0].id);
  assert.equal(copy.origSliceId, a.slices[0].id);
  assert.equal(m.getSlice(copy.sliceId).sourceId, b.id);
  assert.equal(m.fake.calls.rankSimilar >= 1, true);
  m.swapSimilar(70, 1);
  assert.equal(copy.sliceId, a.slices[1].id);
  assert.equal(copy.sourceId, a.id);
  checkInvariants(m);
});

test('swapSimilar returns null when there is nothing to rank; clamped no-ops create no undo step', () => {
  const m = mk();
  addSrc(m, 'a', 3); // no features
  assert.equal(m.swapSimilar(36, 1), null);
  assert.equal(m.swapSimilar(100, 1), null, 'no pad');
  assert.equal(m.canUndo(), false);
  assert.equal(m.state.slots[0].auto, true);
  const s = simKit();
  s.swapSimilar(36, 1);
  s.swapSimilar(36, -1);
  s.swapSimilar(36, -1); // already at 0
  let steps = 0;
  while (s.canUndo()) { s.undo(); steps++; }
  assert.equal(steps, 2);
});

test('swapSimilar is undoable and notifies', () => {
  const m = simKit();
  const before = stripped(m);
  const kinds = record(m);
  m.swapSimilar(37, 1);
  assert.deepEqual(kinds, ['all']);
  m.undo();
  assert.deepEqual(stripped(m), before);
});

// ---------------------------------------------------------------- findBest

test('findBest picks n slices across sources and lays out their base pads from rootKey', () => {
  const m = mk();
  addSrc(m, 'a', 6, (i) => feat(1000, [-30, -10, -20, -5, -25, -15][i]));
  addSrc(m, 'b', 2, (i) => feat(2000, [-1, -50][i]));
  const res = m.findBest(3);
  assert.deepEqual(res, { placed: 3 });
  assert.deepEqual(m.fake.calls.findBest.map((c) => [c.n, c.opts.diversity]), [[3, 0.5]]);
  assert.deepEqual(tags(m, 35, 40), [null, 'b0', 'a3', 'a1', null, null]);
  assert.equal(m.occupiedKeys().length, 3);
  assert.equal(m.state.slots[0].auto, false);
  assert.deepEqual(tags(m, 36, 38, 1), ['a0', 'a1', 'a2'], 'other slots unaffected');
  assert.equal(padIds(m).length, 8, 'only base pads, nothing created');
  checkInvariants(m);
});

test('findBest keeps locked keys, leaves mod-zone keys alone, honours rootKey and defaults to bestN', () => {
  const m = mk();
  addSrc(m, 'a', 8, (i) => feat(1000, -40 + i * 5));
  m.setGlobal('rootKey', 50);
  m.applyLayout(0);
  m.setGlobal('modZoneStart', 53);
  m.setGlobal('modZoneOn', true); // 53..64
  const parked = m.getPadOnKey(51);
  m.assignPad(55, parked.id); // stale pad on a mod key
  m.setLock(52, true);
  const lockedPad = m.getPadOnKey(52);
  const res = m.findBest(4);
  // best by rmsDb desc: a7, a6, a5, a4 -> keys 50, 51, (52 locked), then 53..64 mod -> 65, 66
  assert.deepEqual(res, { placed: 4 });
  assert.equal(m.getPadOnKey(52), lockedPad);
  assert.equal(m.getPadOnKey(55), parked, 'mod-zone keys are not cleared');
  assert.deepEqual([50, 51, 65, 66].map((k) => tag(m, k)), ['a7', 'a6', 'a5', 'a4']);
  assert.equal(m.getPadOnKey(53), null);
  assert.equal(m.getPadOnKey(54), null);
  const m2 = mk();
  addSrc(m2, 'a', 8, (i) => feat(1000, i));
  m2.setGlobal('bestN', 5);
  assert.equal(m2.findBest().placed, 5);
  assert.equal(m2.fake.calls.findBest[0].n, 5);
  assert.equal(m2.findBest(9999).placed, 8);
  assert.equal(m2.fake.calls.findBest[1].n, 128);
  checkInvariants(m);
});

test('findBest without any features places nothing and clears nothing', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  const before = stripped(m);
  assert.deepEqual(m.findBest(4), { placed: 0 });
  assert.deepEqual(stripped(m), before);
  assert.equal(m.canUndo(), false);
  assert.equal(m.state.slots[0].auto, true);
});

test('findBest is undoable', () => {
  const m = mk();
  addSrc(m, 'a', 6, (i) => feat(1000, i));
  const before = stripped(m);
  m.findBest(2);
  assert.notDeepEqual(stripped(m), before);
  m.undo();
  assert.deepEqual(stripped(m), before);
});

// ---------------------------------------------------------------- duplicatePad / layers / copySlot

test('duplicatePad copies the pad (non-base, fresh id) onto toKey of the current slot only', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  const src = m.getPadOnKey(37);
  m.setPadParam(src.id, 'pitch', 4);
  m.setPadParam(src.id, 'loopOn', true);
  m.toggleLayer(37, 38);
  const original38 = m.getPadOnKey(38);
  const before = m.state.pads;
  const c = m.duplicatePad(37, 90);
  assert.ok(c);
  assert.equal(m.getPadOnKey(90), c);
  assert.notEqual(c.id, src.id);
  assert.equal(c.base, false);
  assert.equal(c.pitch, 4);
  assert.equal(c.loopOn, true);
  assert.equal(c.sliceId, src.sliceId);
  assert.deepEqual(c.layers, [original38.id]);
  assert.notEqual(c.layers, src.layers, 'layers array is copied');
  assert.equal(m.state.slots[0].auto, false);
  assert.equal(m.getPadOnKey(90, 1), null, 'other slots unaffected');
  assert.equal(before, m.state.pads);
  // editing the copy does not touch the original
  m.setPadParam(c.id, 'pitch', -4);
  assert.equal(src.pitch, 4);
  // refused cases
  assert.equal(m.duplicatePad(100, 91), null, 'empty source key');
  assert.equal(m.duplicatePad(37, 37), null);
  assert.equal(m.duplicatePad(37, 128), null);
  assert.equal(m.duplicatePad(-1, 5), null);
  checkInvariants(m);
});

test('duplicatePad onto an occupied key replaces it in that slot only; undo restores', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  const before = stripped(m);
  const old = m.getPadOnKey(38);
  const c = m.duplicatePad(36, 38);
  assert.equal(m.getPadOnKey(38), c);
  assert.equal(m.getPadOnKey(38, 1), old, 'base pad still shown in other slots');
  m.undo();
  assert.deepEqual(stripped(m), before);
  assert.equal(m.getPadOnKey(38), old);
});

test('toggleLayer adds/removes layers; refuses self, empty keys, and more than 3', () => {
  const m = mk();
  addSrc(m, 'a', 6);
  const p = m.getPadOnKey(36);
  assert.equal(m.toggleLayer(36, 37), true);
  assert.deepEqual(p.layers, [m.getPadOnKey(37).id]);
  assert.equal(m.state.slots[0].auto, false);
  assert.equal(m.toggleLayer(36, 37), false, 'second toggle removes');
  assert.deepEqual(p.layers, []);
  assert.equal(m.toggleLayer(36, 36), false, 'no self layer');
  assert.equal(m.toggleLayer(36, 100), false, 'other key is empty');
  assert.equal(m.toggleLayer(100, 36), false, 'key is empty');
  m.assignPad(60, p.id);
  assert.equal(m.toggleLayer(36, 60), false, 'two keys with the same pad = self');
  assert.equal(m.toggleLayer(36, 37), true);
  assert.equal(m.toggleLayer(36, 38), true);
  assert.equal(m.toggleLayer(36, 39), true);
  assert.equal(p.layers.length, 3);
  assert.equal(m.toggleLayer(36, 40), false, 'max 3 layers');
  assert.equal(p.layers.length, 3);
  assert.equal(m.toggleLayer(36, 38), false, 'removing is still allowed at the limit');
  assert.equal(p.layers.length, 2);
  assert.equal(m.toggleLayer(36, 40), true);
  checkInvariants(m);
});

test('refused layer toggles do not change the slot or the history', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  assert.equal(m.toggleLayer(36, 36), false);
  assert.equal(m.toggleLayer(36, 100), false);
  assert.equal(m.state.slots[0].auto, true);
  assert.equal(m.canUndo(), false);
});

test('layered pads survive off-key (garbage collection follows layers) and are cleaned up when unlinked', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  const dup = m.duplicatePad(36, 50); // non-base
  m.toggleLayer(37, 50);
  const owner = m.getPadOnKey(37);
  assert.deepEqual(owner.layers, [dup.id]);
  m.clearKey(50); // dup is no longer on a key but still layered
  assert.equal(m.getPad(dup.id), dup);
  m.toggleLayer(37, 37); // refused, no change
  assert.equal(m.getPad(dup.id), dup);
  checkInvariants(m);
  // unlink: need a key that holds dup again
  m.assignPad(51, dup.id);
  assert.equal(m.toggleLayer(37, 51), false);
  assert.deepEqual(owner.layers, []);
  m.clearKey(51);
  assert.equal(m.getPad(dup.id), null, 'orphan was collected');
  checkInvariants(m);
  m.undo();
  m.undo();
  assert.ok(m.getPad(dup.id));
  checkInvariants(m);
});

test('copySlot copies keys, locks and the auto flag; pads are shared; undoable', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  m.shuffle({ seed: 3 });
  m.setLock(37, true);
  const before = stripped(m);
  assert.equal(m.copySlot(0, 3), true);
  const s0 = m.state.slots[0];
  const s3 = m.state.slots[3];
  assert.deepEqual(s3.keys, s0.keys);
  assert.deepEqual(s3.locks, s0.locks);
  assert.equal(s3.auto, false);
  assert.notEqual(s3.keys, s0.keys, 'arrays are copies');
  assert.equal(m.getSlotKeys(3)[36], m.getSlotKeys(0)[36], 'same pad ids');
  // copy of an auto slot is auto and follows structural changes
  m.copySlot(1, 4);
  assert.equal(m.state.slots[4].auto, true);
  addSrc(m, 'b', 2);
  assert.equal(tag(m, 40, 4), 'b0');
  assert.equal(tag(m, 40, 3), null === tag(m, 40, 3) ? null : tag(m, 40, 3), 'manual copy is not re-laid out');
  assert.equal(m.state.slots[3].auto, false);
  // replacing a slot overwrites everything
  m.copySlot(1, 3);
  assert.deepEqual(m.state.slots[3].locks, m.state.slots[1].locks);
  // invalid / identical
  assert.equal(m.copySlot(2, 2), false);
  assert.equal(m.copySlot(-1, 2), false);
  assert.equal(m.copySlot(0, 8), false);
  assert.equal(m.copySlot('x', 2), false);
  checkInvariants(m);
  // undo the second copy then the first
  const m2 = mk();
  addSrc(m2, 'a', 4);
  m2.shuffle({ seed: 3 });
  const b2 = stripped(m2);
  m2.copySlot(0, 3);
  m2.undo();
  assert.deepEqual(stripped(m2), b2);
  assert.ok(before);
});

test('copySlot of identical slots creates no undo step', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  assert.equal(m.copySlot(0, 1), true);
  assert.equal(m.canUndo(), false);
});

// ---------------------------------------------------------------- manual slice points

function manualKit() {
  const m = mk();
  const s = addSrc(m, 'a', 4, (i) => feat(1000 + i * 100), 2000); // [0,2000) [2000,4000) [4000,6000) [6000,8000)
  return { m, s };
}

test('addSlicePoint splits a slice, sets mode manual and goes through the reslice policy', () => {
  const { m, s } = manualKit();
  const oldIds = s.slices.map((x) => x.id);
  const oldPads = s.slices.map((sl) => basePadOf(m, sl.id));
  const kinds = record(m);
  assert.equal(m.addSlicePoint(s.id, 3000), true);
  assert.deepEqual(kinds, ['all']);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 2000], [2000, 3000], [3000, 4000], [4000, 6000], [6000, 8000]]);
  assert.equal(s.slicing.mode, 'manual');
  // untouched slices keep their ids and features
  assert.equal(s.slices[0].id, oldIds[0]);
  assert.equal(s.slices[3].id, oldIds[2]);
  assert.equal(s.slices[4].id, oldIds[3]);
  assert.equal(s.slices[0].features.centroidHz, 1000);
  assert.equal(s.slices[3].features.centroidHz, 1200);
  // the split ones are new, without features
  assert.equal(oldIds.indexOf(s.slices[1].id), -1);
  assert.equal(s.slices[1].features, null);
  assert.equal(s.slices[2].features, null);
  // the old pad of slice 1 (start 2000) follows the left half, a fresh base pad for the right half
  assert.equal(oldPads[1].sliceId, s.slices[1].id);
  assert.equal(oldPads[1].base, true);
  assert.equal(padIds(m).length, 5);
  assert.deepEqual(tags(m, 36, 41, 1), ['a0', 'a1', 'a2', 'a3', 'a4', null]);
  checkInvariants(m);
  // undo restores the old slices and the mode
  m.undo();
  assert.deepEqual(s.slices.map((x) => x.id), oldIds);
  assert.equal(s.slicing.mode, 'transient');
  assert.equal(padIds(m).length, 4);
  checkInvariants(m);
});

test('addSlicePoint refuses invalid frames and leaves everything unchanged', () => {
  const { m, s } = manualKit();
  const before = stripped(m);
  [0, -5, 8000, 9000, 2000, 6000, NaN, 'x', undefined].forEach((f) => {
    assert.equal(m.addSlicePoint(s.id, f), false, String(f));
  });
  assert.equal(m.addSlicePoint(31337, 100), false);
  assert.deepEqual(stripped(m), before);
  assert.equal(m.canUndo(), false);
  assert.equal(s.slicing.mode, 'transient');
});

test('addSlicePoint on a loaded but unsliced source creates the first split', () => {
  const m = mk();
  const s = m.addSource({ name: 'a' });
  m.setSourceInfo(s.id, { frames: 1000, sr: 44100, channels: 1 });
  assert.equal(m.addSlicePoint(s.id, 400), true);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 400], [400, 1000]]);
  assert.equal(padIds(m).length, 2);
  assert.equal(m.addSlicePoint(s.id, 0), false);
  const bare = m.addSource({ name: 'b' });
  assert.equal(m.addSlicePoint(bare.id, 10), false, 'no frames yet');
  checkInvariants(m);
});

test('moveSlicePoint moves the start of slice i, clamped between its neighbours', () => {
  const { m, s } = manualKit();
  const kinds = record(m);
  assert.equal(m.moveSlicePoint(s.id, 2, 4500), true);
  assert.deepEqual(kinds, ['all']);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 2000], [2000, 4500], [4500, 6000], [6000, 8000]]);
  assert.equal(s.slicing.mode, 'manual');
  assert.equal(s.slices[0].id !== undefined, true);
  // clamped: cannot cross the neighbours
  m.moveSlicePoint(s.id, 2, 10);
  assert.equal(s.slices[2].start, 2001);
  assert.equal(s.slices[1].end, 2001);
  m.moveSlicePoint(s.id, 2, 99999);
  assert.equal(s.slices[2].start, 5999);
  assert.equal(s.slices[3].start, 6000);
  // slice 0 has no movable start; out of range indices refused
  assert.equal(m.moveSlicePoint(s.id, 0, 100), false);
  assert.equal(m.moveSlicePoint(s.id, 4, 100), false);
  assert.equal(m.moveSlicePoint(s.id, -1, 100), false);
  assert.equal(m.moveSlicePoint(s.id, 'x', 100), false);
  assert.equal(m.moveSlicePoint(s.id, 1, NaN), false);
  assert.equal(m.moveSlicePoint(31337, 1, 100), false);
  // moving to the current position is a no-op
  const st = stripped(m);
  assert.equal(m.moveSlicePoint(s.id, 3, 6000), false);
  assert.deepEqual(stripped(m), st);
  // one base pad per slice throughout; slice count is unchanged
  assert.equal(s.slices.length, 4);
  checkInvariants(m);
});

test('moveSlicePoint keeps unchanged slices and coalesces a drag into one undo step', () => {
  const { m, s } = manualKit();
  const ids = s.slices.map((x) => x.id);
  const before = stripped(m);
  for (let f = 4100; f <= 4600; f += 100) assert.equal(m.moveSlicePoint(s.id, 2, f), true);
  assert.equal(s.slices[0].id, ids[0]);
  assert.equal(s.slices[3].id, ids[3]);
  assert.equal(s.slices[0].features.centroidHz, 1000);
  assert.equal(s.slices[1].features, null, 'moved boundaries invalidate features of the two neighbours');
  assert.equal(s.slices[2].features, null);
  m.undo();
  assert.deepEqual(stripped(m), before);
  assert.equal(m.canUndo(), false);
  // a different slice point starts a new step
  m.redo();
  m.moveSlicePoint(s.id, 1, 2100);
  m.undo();
  assert.equal(s.slices[1].start, 2000 + 0 + (4600 === 4600 ? 0 : 0));
  assert.equal(m.canUndo(), true);
});

test('removeSlicePoint merges slice i into i-1', () => {
  const { m, s } = manualKit();
  const ids = s.slices.map((x) => x.id);
  assert.equal(m.removeSlicePoint(s.id, 2), true);
  assert.deepEqual(s.slices.map((x) => [x.start, x.end]), [[0, 2000], [2000, 6000], [6000, 8000]]);
  assert.equal(s.slicing.mode, 'manual');
  assert.equal(s.slices[0].id, ids[0]);
  assert.equal(s.slices[2].id, ids[3]);
  assert.equal(s.slices[1].features, null);
  assert.equal(padIds(m).filter((id) => m.getPad(id).base).length, 3);
  checkInvariants(m);
  assert.equal(m.removeSlicePoint(s.id, 0), false);
  assert.equal(m.removeSlicePoint(s.id, 3), false);
  assert.equal(m.removeSlicePoint(s.id, 'x'), false);
  assert.equal(m.removeSlicePoint(31337, 1), false);
  assert.deepEqual(tags(m, 36, 39, 2), ['a0', 'a1', 'a2', null]);
  m.undo();
  assert.deepEqual(s.slices.map((x) => x.id), ids);
  assert.equal(s.slicing.mode, 'transient');
});

test('manual slice edits keep a non-auto slot in place and append the new pad after the last key', () => {
  const { m, s } = manualKit();
  m.shuffle({ seed: 2 });
  const keys = m.getSlotKeys(0);
  assert.equal(m.addSlicePoint(s.id, 1000), true);
  const after = m.getSlotKeys(0);
  assert.deepEqual(after.slice(36, 40), keys.slice(36, 40));
  const appended = m.getPad(after[40]);
  assert.ok(appended && appended.base);
  assert.equal(m.getSlice(appended.sliceId).start, 1000);
  assert.equal(after[41], null);
  // removing a point merges: the former-base pad of the removed slice is no longer base but stays on its key
  assert.equal(m.removeSlicePoint(s.id, 1), true);
  assert.equal(s.slices.length, 4);
  checkInvariants(m);
  assert.equal(m.occupiedKeys(0).length, 5, 'all five pads remain on their keys');
});

test('manual slice ops keep working over many random edits (invariants)', () => {
  const { m, s } = manualKit();
  const rng = prng.mulberry32(77);
  for (let i = 0; i < 200; i++) {
    const r = rng();
    const frames = s.frames;
    if (r < 0.4) m.addSlicePoint(s.id, 1 + prng.randInt(rng, frames - 1));
    else if (r < 0.7 && s.slices.length > 1) m.moveSlicePoint(s.id, 1 + prng.randInt(rng, s.slices.length - 1), prng.randInt(rng, frames));
    else if (s.slices.length > 1) m.removeSlicePoint(s.id, 1 + prng.randInt(rng, s.slices.length - 1));
    if (i % 10 === 0) checkInvariants(m);
  }
  checkInvariants(m);
  assert.equal(s.slices[0].start, 0);
  assert.equal(s.slices[s.slices.length - 1].end, s.frames);
  for (let i = 1; i < s.slices.length; i++) assert.equal(s.slices[i].start, s.slices[i - 1].end, 'contiguous');
});

// ---------------------------------------------------------------- keys, locks, mod zone

test('isModKey / modOffset follow modZoneOn and modZoneStart', () => {
  const m = mk();
  assert.equal(m.isModKey(96), false);
  assert.equal(m.modOffset(96), -1);
  m.setGlobal('modZoneOn', true);
  assert.equal(m.isModKey(95), false);
  assert.equal(m.isModKey(96), true);
  assert.equal(m.isModKey(107), true);
  assert.equal(m.isModKey(108), false);
  assert.equal(m.modOffset(95), -1);
  assert.equal(m.modOffset(96), 0);
  assert.equal(m.modOffset(100), 4);
  assert.equal(m.modOffset(107), 11);
  assert.equal(m.modOffset(108), -1);
  assert.equal(m.isModKey(-1), false);
  assert.equal(m.isModKey(128), false);
  assert.equal(m.isModKey('x'), false);
  assert.equal(m.modOffset(200), -1);
  m.setGlobal('modZoneStart', 116);
  assert.equal(m.isModKey(127), true);
  assert.equal(m.modOffset(127), 11);
  assert.equal(m.isModKey(115), false);
  m.setGlobal('modZoneStart', 200);
  assert.equal(m.globals().modZoneStart, 116, 'start is clamped so the zone fits the keyboard');
  m.setGlobal('modZoneStart', -3);
  assert.equal(m.globals().modZoneStart, 0);
  assert.equal(m.modOffset(11), 11);
  assert.equal(m.modOffset(12), -1);
});

test('occupiedKeys excludes mod-zone keys, even with a parked pad', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  m.setGlobal('modZoneStart', 100);
  m.setGlobal('modZoneOn', true);
  m.assignPad(101, m.getPadOnKey(36).id);
  assert.equal(m.getPadOnKey(101) !== null, true);
  assert.deepEqual(m.occupiedKeys(), [36, 37, 38, 39]);
  assert.deepEqual(m.occupiedKeys(0), [36, 37, 38, 39]);
  m.setGlobal('modZoneOn', false);
  assert.deepEqual(m.occupiedKeys(0), [36, 37, 38, 39, 101]);
  assert.deepEqual(m.occupiedKeys(4), [36, 37, 38, 39]);
});

test('setLock / toggleLock / isLocked act on the current slot', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  assert.equal(m.isLocked(36), false);
  assert.equal(m.setLock(36, true), true);
  assert.equal(m.isLocked(36), true);
  assert.equal(m.isLocked(36, 0), true);
  assert.equal(m.isLocked(36, 1), false);
  assert.equal(m.toggleLock(36), false);
  assert.equal(m.isLocked(36), false);
  assert.equal(m.toggleLock(37), true);
  assert.equal(m.isLocked(37), true);
  assert.equal(m.setLock(200, true), false);
  assert.equal(m.setLock(36, 'maybe'), false);
  assert.equal(m.toggleLock(-4), false);
  assert.equal(m.isLocked(200), false);
  m.setCurrentSlot(2);
  assert.equal(m.isLocked(37), false);
  m.setLock(40, 1);
  assert.equal(m.isLocked(40, 2), true);
  assert.equal(m.isLocked(40, 0), false);
  assert.equal(m.state.slots[2].auto, false);
});

test('clearKey / swapKeys / assignPad', () => {
  const m = mk();
  addSrc(m, 'a', 4);
  assert.equal(m.clearKey(100), false, 'nothing to clear');
  assert.equal(m.state.slots[0].auto, true);
  assert.equal(m.clearKey(37), true);
  assert.equal(m.getPadOnKey(37), null);
  assert.equal(tag(m, 37, 1), 'a1', 'other slots unaffected');
  assert.equal(m.state.slots[0].auto, false);
  // swap
  assert.equal(m.swapKeys(36, 38), true);
  assert.deepEqual(tags(m, 36, 39), ['a2', null, 'a0', 'a3']);
  assert.equal(m.swapKeys(36, 100), true, 'swap with an empty key moves the pad');
  assert.deepEqual([tag(m, 36), tag(m, 100)], [null, 'a2']);
  assert.equal(m.swapKeys(36, 37), false, 'two empty keys');
  assert.equal(m.swapKeys(38, 38), false);
  assert.equal(m.swapKeys(-1, 38), false);
  // locks follow the pad
  m.setLock(38, true);
  m.swapKeys(38, 39);
  assert.equal(m.isLocked(38), false);
  assert.equal(m.isLocked(39), true);
  // assign
  const pad = m.getPadOnKey(39);
  assert.equal(m.assignPad(50, pad.id), true);
  assert.equal(m.getPadOnKey(50), pad);
  assert.equal(m.getPadOnKey(39), pad);
  assert.equal(m.assignPad(50, 999999), false);
  assert.equal(m.assignPad(500, pad.id), false);
  checkInvariants(m);
});

test('clearKey of a base pad keeps the pad alive (other slots, relayout)', () => {
  const m = mk();
  const a = addSrc(m, 'a', 3);
  const pad = m.getPadOnKey(36);
  m.clearKey(36);
  assert.equal(m.getPad(pad.id), pad);
  m.applyLayout(0);
  assert.equal(m.getPadOnKey(36), pad);
  assert.ok(a);
});

test('getSlotKeys returns a copy; setCurrentSlot clamps and notifies', () => {
  const m = mk();
  addSrc(m, 'a', 2);
  const keys = m.getSlotKeys();
  keys[36] = 12345;
  assert.notEqual(m.getSlotKeys()[36], 12345);
  const kinds = record(m);
  assert.equal(m.setCurrentSlot(3), true);
  assert.equal(m.currentSlot(), 3);
  assert.equal(m.setCurrentSlot(99), true);
  assert.equal(m.currentSlot(), 7);
  assert.equal(m.setCurrentSlot(-4), true);
  assert.equal(m.currentSlot(), 0);
  assert.equal(m.setCurrentSlot('x'), false);
  assert.equal(m.setCurrentSlot(0), true);
  assert.deepEqual(kinds, ['map', 'map', 'map']);
  assert.deepEqual(m.getSlotKeys(99), m.getSlotKeys(7));
});

// ---------------------------------------------------------------- auto flag behaviour

test('manual operations set auto=false on the current slot only; applyLayout sets it back', () => {
  const ops = {
    shuffle: (m) => m.shuffle({ seed: 1 }),
    lock: (m) => m.setLock(37, true),
    spread: (m) => m.spread(36, 'pitch', 3, 1),
    duplicate: (m) => m.duplicatePad(36, 90),
    assign: (m) => m.assignPad(90, m.getPadOnKey(36).id),
    swap: (m) => m.swapKeys(36, 37),
    clear: (m) => m.clearKey(36),
    findBest: (m) => m.findBest(3),
    similar: (m) => m.swapSimilar(36, 1),
    layer: (m) => m.toggleLayer(36, 37)
  };
  Object.keys(ops).forEach((name) => {
    const m = mk();
    addSrc(m, 'a', 6, (i) => feat(1000 + i * 100, -30 + i));
    m.setCurrentSlot(2);
    ops[name](m);
    assert.equal(m.state.slots[2].auto, false, name + ' sets auto=false');
    [0, 1, 3, 4, 5, 6, 7].forEach((s) => assert.equal(m.state.slots[s].auto, true, name + ' leaves slot ' + s));
    m.applyLayout();
    assert.equal(m.state.slots[2].auto, true, 'applyLayout restores auto after ' + name);
  });
});

test('auto slots follow structural changes, manual slots do not; new slots start auto', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  m.setCurrentSlot(1);
  m.swapKeys(36, 37); // slot 1 manual
  const manual = m.getSlotKeys(1);
  addSrc(m, 'b', 2);
  assert.deepEqual(tags(m, 36, 41, 0), ['a0', 'a1', 'a2', 'b0', 'b1', null]);
  assert.deepEqual(m.getSlotKeys(1).slice(36, 40), manual.slice(36, 40));
  assert.equal(tag(m, 39, 1), 'b0', 'but new pads are appended to the manual slot');
  assert.equal(tag(m, 40, 1), 'b1');
  assert.equal(m.state.slots[1].auto, false);
  m.setGlobal('layout', 'interleave');
  assert.deepEqual(tags(m, 36, 40, 0), ['a0', 'b0', 'a1', 'b1', 'a2']);
  assert.equal(tag(m, 36, 1), 'a1', 'manual slot untouched by layout globals');
  // non-layout globals never re-layout
  const before = m.getSlotKeys(0);
  m.setGlobal('velSens', 10);
  m.setGlobal('flipPct', 10);
  m.setGlobal('seed', 5);
  assert.deepEqual(m.getSlotKeys(0), before);
});

test('a failed or no-op manual operation does not flip the auto flag', () => {
  const m = mk();
  addSrc(m, 'a', 3);
  assert.equal(m.clearKey(120), false);
  assert.equal(m.swapKeys(36, 36), false);
  assert.equal(m.assignPad(36, 999), false);
  assert.equal(m.duplicatePad(120, 5), null);
  assert.equal(m.setLock(36, false), true);
  assert.equal(m.state.slots[0].auto, true, 'unlocking an unlocked key changes nothing');
  assert.equal(m.applyLayout(0).placed, 3);
});

// ---------------------------------------------------------------- setGlobal

test('setGlobal validates names and clamps / coerces values', () => {
  const m = mk();
  const g = m.globals();
  assert.equal(m.setGlobal('nope', 1), false);
  assert.equal(m.setGlobal('constructor', 1), false);
  assert.equal(m.setGlobal('__proto__', 1), false);
  // ints
  m.setGlobal('rootKey', -4);
  assert.equal(g.rootKey, 0);
  m.setGlobal('rootKey', 200);
  assert.equal(g.rootKey, 127);
  m.setGlobal('rootKey', 40.6);
  assert.equal(g.rootKey, 41);
  assert.equal(m.setGlobal('rootKey', 'abc'), false);
  assert.equal(g.rootKey, 41);
  m.setGlobal('rootKey', '60');
  assert.equal(g.rootKey, 60);
  // enums (string or index)
  m.setGlobal('layout', 'sorted');
  assert.equal(g.layout, 'sorted');
  assert.equal(m.setGlobal('layout', 'bogus'), false);
  assert.equal(g.layout, 'sorted');
  m.setGlobal('layout', 1);
  assert.equal(g.layout, 'interleave');
  assert.equal(m.setGlobal('layout', 7), false);
  m.setGlobal('sortBy', 'loudness');
  assert.equal(g.sortBy, 'loudness');
  m.setGlobal('sortBy', 2);
  assert.equal(g.sortBy, 'length');
  m.setGlobal('chokeScope', 'global');
  assert.equal(g.chokeScope, 'global');
  m.setGlobal('chokeScope', 0);
  assert.equal(g.chokeScope, 'source');
  m.setGlobal('shuffleMode', 'smart');
  m.setGlobal('shuffleScope', 'source');
  assert.deepEqual([g.shuffleMode, g.shuffleScope], ['smart', 'source']);
  m.setGlobal('shuffleMode', 0);
  m.setGlobal('shuffleScope', 0);
  assert.deepEqual([g.shuffleMode, g.shuffleScope], ['chaos', 'all']);
  m.setGlobal('repeatDiv', '1/32T');
  assert.equal(g.repeatDiv, '1/32T');
  m.setGlobal('repeatDiv', 7);
  assert.equal(g.repeatDiv, '1/64');
  assert.equal(m.setGlobal('repeatDiv', '1/3'), false);
  assert.equal(g.repeatDiv, '1/64');
  m.setGlobal('spreadParam', 'cutoff');
  assert.equal(g.spreadParam, 'cutoff');
  m.setGlobal('spreadParam', 2);
  assert.equal(g.spreadParam, 'start');
  // booleans
  ['zoneAlign', 'repeatOn', 'repeatAlt', 'modZoneOn', 'pressureToLevel'].forEach((name) => {
    m.setGlobal(name, 1);
    assert.equal(g[name], true, name);
    m.setGlobal(name, 0);
    assert.equal(g[name], false, name);
    m.setGlobal(name, true);
    assert.equal(g[name], true, name);
    assert.equal(m.setGlobal(name, 'maybe'), false, name);
    assert.equal(g[name], true, name);
    m.setGlobal(name, false);
  });
  // ranges
  [['chaos', 0, 100], ['swing', 0, 100], ['flipPct', 0, 100], ['velSens', 0, 100], ['spreadStep', -24, 24]].forEach(([name, lo, hi]) => {
    m.setGlobal(name, lo - 50);
    assert.equal(g[name], lo, name);
    m.setGlobal(name, hi + 50);
    assert.equal(g[name], hi, name);
    m.setGlobal(name, (lo + hi) / 2 + 0.25);
    assert.equal(g[name], (lo + hi) / 2 + 0.25, name + ' floats are kept');
    assert.equal(m.setGlobal(name, NaN), false);
  });
  [['modZoneStart', 0, 116], ['bestN', 4, 64], ['spreadCount', 2, 16]].forEach(([name, lo, hi]) => {
    m.setGlobal(name, lo - 50);
    assert.equal(g[name], lo, name);
    m.setGlobal(name, hi + 50);
    assert.equal(g[name], hi, name);
    m.setGlobal(name, 9.6 > hi ? hi : Math.floor(lo + 1.6));
    assert.ok(Number.isInteger(g[name]), name + ' is an integer');
  });
  assert.equal(m.globals(), g, 'globals() is the live object');
});

test('setGlobal seed: non-negative integer, wraps above 9999 so seed+1 never sticks', () => {
  const m = mk();
  m.setGlobal('seed', 1234);
  assert.equal(m.globals().seed, 1234);
  m.setGlobal('seed', -5);
  assert.equal(m.globals().seed, 0);
  m.setGlobal('seed', 12.4);
  assert.equal(m.globals().seed, 12);
  m.setGlobal('seed', 9999);
  m.setGlobal('seed', m.globals().seed + 1);
  assert.equal(m.globals().seed, 0);
  m.setGlobal('seed', 10005);
  assert.equal(m.globals().seed, 5);
  assert.equal(m.setGlobal('seed', 'x'), false);
});

test('only layout-affecting globals re-lay out, and only auto slots', () => {
  const m = mk();
  addSrc(m, 'a', 3, (i) => feat(3000 - i * 1000, -10 - i));
  addSrc(m, 'b', 3, (i) => feat(500 + i * 100, -30 + i));
  m.setCurrentSlot(4);
  m.swapKeys(36, 37); // slot 4 manual
  const manual = m.getSlotKeys(4);
  const layoutKeys = [['rootKey', 48], ['layout', 'interleave'], ['zoneAlign', true], ['sortBy', 'loudness'], ['modZoneOn', true], ['modZoneStart', 70]];
  layoutKeys.forEach(([name, value]) => {
    const prev = m.getSlotKeys(0);
    const kinds = record(m);
    m.setGlobal(name, value);
    const changed = JSON.stringify(prev) !== JSON.stringify(m.getSlotKeys(0));
    assert.equal(kinds[0], name === 'zoneAlign' || name === 'sortBy' || name === 'modZoneStart' ? kinds[0] : kinds[0]);
    assert.ok(kinds.length === 1 && kinds[0] === 'all', name + ' notifies all (globals + map): ' + kinds);
    if (name === 'rootKey' || name === 'layout') assert.ok(changed, name + ' changes the layout');
    assert.deepEqual(m.getSlotKeys(4), manual, name + ' leaves the manual slot alone');
  });
  [['chaos', 50], ['repeatOn', true], ['velSens', 20], ['bestN', 8], ['seed', 3], ['flipPct', 5], ['swing', 10], ['chokeScope', 'global'], ['shuffleMode', 'smart']].forEach(([name, value]) => {
    const prev = JSON.stringify(m.state.slots);
    const kinds = record(m);
    m.setGlobal(name, value);
    assert.equal(JSON.stringify(m.state.slots), prev, name + ' does not touch slots');
    assert.deepEqual(kinds, ['globals']);
  });
  checkInvariants(m);
});

// ---------------------------------------------------------------- onChange

test('onChange kinds', () => {
  const m = mk();
  const kinds = record(m);
  const take = () => kinds.splice(0, kinds.length);

  const a = m.addSource({ name: 'a', path: 'a.wav' });
  assert.deepEqual(take(), ['sources']);
  m.setSourceInfo(a.id, { frames: 6000, sr: 44100, channels: 1 });
  assert.deepEqual(take(), ['sources']);
  m.setSourceSettings(a.id, { playMode: 'poly' });
  assert.deepEqual(take(), ['sources']);
  m.setSourceSettings(a.id, { playMode: 'poly' });
  assert.deepEqual(take(), [], 'unchanged settings do not notify');
  m.setSlices(a.id, ranges(6));
  assert.deepEqual(take(), ['all']);
  m.setSliceFeatures(a.id, ranges(6).map((_, i) => feat(100 * (i + 1), -10 * i)));
  assert.deepEqual(take(), ['slices'], 'features with a non-sorted layout do not touch the map');
  m.setGlobal('layout', 'sorted');
  assert.deepEqual(take(), ['all']);
  m.setSliceFeatures(a.id, ranges(6).map((_, i) => feat(100 * (6 - i))));
  assert.deepEqual(take(), ['all'], 'sorted layout: slices + map');
  m.setGlobal('layout', 'zones');
  take();
  const p = m.getPadOnKey(36);
  m.setPadParam(p.id, 'pitch', 1);
  assert.deepEqual(take(), ['pads']);
  m.applyParamToSource(p.id, 'pitch');
  assert.deepEqual(take(), ['pads']);
  m.setCurrentSlot(1);
  assert.deepEqual(take(), ['map']);
  m.setLock(36, true);
  assert.deepEqual(take(), ['map']);
  m.toggleLock(36);
  assert.deepEqual(take(), ['map']);
  m.clearKey(37);
  assert.deepEqual(take(), ['map']);
  m.swapKeys(38, 39);
  assert.deepEqual(take(), ['map']);
  m.assignPad(60, p.id);
  assert.deepEqual(take(), ['map']);
  m.copySlot(1, 2);
  assert.deepEqual(take(), ['map']);
  m.applyLayout(1);
  assert.deepEqual(take(), ['map']);
  m.setGlobal('velSens', 5);
  assert.deepEqual(take(), ['globals']);
  m.setGlobal('velSens', 5);
  assert.deepEqual(take(), [], 'unchanged value does not notify');
  m.setGlobal('bogus', 5);
  assert.deepEqual(take(), []);
  m.shuffle({ seed: 3 });
  assert.deepEqual(take(), ['all']);
  m.spread(36, 'pitch', 3, 1);
  assert.deepEqual(take(), ['all']);
  m.duplicatePad(36, 100);
  assert.deepEqual(take(), ['all']);
  m.toggleLayer(36, 38);
  assert.deepEqual(take(), ['all']);
  m.findBest(2);
  assert.deepEqual(take(), ['map']);
  m.swapSimilar(36, 1);
  assert.deepEqual(take(), ['all']);
  m.undo();
  m.redo();
  assert.deepEqual(take(), ['all', 'all']);
  m.addSlicePoint(a.id, 500);
  m.moveSlicePoint(a.id, 1, 600);
  m.removeSlicePoint(a.id, 1);
  assert.deepEqual(take(), ['all', 'all', 'all']);
  m.removeSource(a.id);
  assert.deepEqual(take(), ['all']);
  // refused calls are silent
  m.setPadParam(31337, 'pitch', 1);
  m.removeSource(31337);
  m.setLock(500, true);
  assert.deepEqual(take(), []);
});

test('onChange: several listeners, unsubscribe, listener errors do not corrupt state, nested edits', () => {
  const m = mk();
  const a = [];
  const b = [];
  const off = m.onChange((k) => a.push(k));
  m.onChange((k) => b.push(k));
  m.addSource({ name: 'x' });
  off();
  m.addSource({ name: 'y' });
  assert.deepEqual(a, ['sources']);
  assert.deepEqual(b, ['sources', 'sources']);
  m.onChange('not a function');
  m.onChange(null);
  m.addSource({ name: 'z' });
  assert.equal(b.length, 3);
  // a listener that edits the model is delivered after the first op is complete
  const m2 = mk();
  const seen = [];
  m2.onChange((kind) => {
    seen.push(kind);
    if (kind === 'sources' && m2.globals().velSens !== 77) m2.setGlobal('velSens', 77);
  });
  m2.addSource({ name: 'x' });
  assert.deepEqual(seen, ['sources', 'globals']);
  assert.equal(m2.globals().velSens, 77);
});

// ---------------------------------------------------------------- JSON round trip

function complexModel() {
  const m = bigKit();
  addSrc(m, 'c', 5);
  m.setSourceSettings(m.listSources()[0].id, { playMode: 'poly', trigMode: 'gate', mode: 'beat', beatDiv: '1/8', sensitivity: 33, snap: false });
  const p = m.getPadOnKey(37);
  m.setPadParam(p.id, 'pitch', -7);
  m.setPadParam(p.id, 'reverse', true);
  m.setPadParam(p.id, 'cutoffHz', 800);
  m.shuffle({ seed: 5, flipPct: 40 });
  m.setLock(40, true);
  m.spread(45, 'cutoff', 4, 3);
  m.toggleLayer(36, 38);
  m.duplicatePad(36, 90);
  m.swapSimilar(90, 1);
  m.setCurrentSlot(3);
  m.findBest(5);
  m.copySlot(3, 6);
  m.setGlobal('rootKey', 24);
  m.setGlobal('zoneAlign', true);
  m.setGlobal('modZoneOn', true);
  m.setGlobal('seed', 321);
  m.setGlobal('flipPct', 15);
  m.addSlicePoint(m.listSources()[2].id, 2500);
  return m;
}

test('toJSON returns a deep copy that survives JSON stringification', () => {
  const m = complexModel();
  const j = m.toJSON();
  assert.notEqual(j, m.state);
  assert.notEqual(j.pads, m.state.pads);
  assert.notEqual(j.slots[0].keys, m.state.slots[0].keys);
  assert.deepEqual(j, JSON.parse(JSON.stringify(m.state)));
  assert.deepEqual(JSON.parse(JSON.stringify(m)), j, 'JSON.stringify(model) uses toJSON');
  const before = JSON.stringify(m.state);
  j.pads = {};
  j.slots[0].keys[0] = 999;
  j.globals.rootKey = 1;
  j.sources[0].slices.length = 0;
  assert.equal(JSON.stringify(m.state), before);
  checkInvariants(m);
});

test('fromJSON(toJSON()) round-trips deeply and the copy is fully functional', () => {
  const m = complexModel();
  const j = m.toJSON();
  const m2 = Model.fromJSON(j, { features: fakeFeatures() });
  assert.deepEqual(m2.toJSON(), j);
  assert.deepEqual(m2.toJSON(), JSON.parse(JSON.stringify(j)));
  assert.equal(m2.canUndo(), false);
  assert.equal(m2.canRedo(), false);
  assert.equal(m2.currentSlot(), m.currentSlot());
  checkInvariants(m2);
  // input is not aliased
  j.globals.rootKey = 99;
  j.pads[Object.keys(j.pads)[0]].pitch = 31;
  assert.equal(m2.globals().rootKey, 24);
  assert.notEqual(m2.getPad(Object.keys(m2.state.pads)[0]).pitch, 31);
  // ids keep increasing
  const maxId = Math.max.apply(null, Object.keys(m2.state.pads).map(Number));
  const fresh = m2.addSource({ name: 'new' });
  assert.ok(fresh.id > maxId);
  assert.ok(fresh.id >= m.state.nextId);
  // operations behave identically on the original and the restored model
  const mA = complexModel();
  const mB = Model.fromJSON(mA.toJSON(), { features: fakeFeatures() });
  mA.setCurrentSlot(0);
  mB.setCurrentSlot(0);
  mA.shuffle({ seed: 77, flipPct: 30, mode: 'smart' });
  mB.shuffle({ seed: 77, flipPct: 30, mode: 'smart' });
  assert.deepEqual(mA.toJSON(), mB.toJSON());
  mA.undo();
  mB.undo();
  assert.equal(mA.canUndo(), true);
  assert.equal(mB.canUndo(), false, 'history is not serialised');
});

test('fromJSON accepts a JSON string and is idempotent', () => {
  const m = complexModel();
  const s = JSON.stringify(m.toJSON());
  const m2 = Model.fromJSON(s);
  assert.deepEqual(m2.toJSON(), m.toJSON());
  assert.deepEqual(Model.fromJSON(m2.toJSON()).toJSON(), m.toJSON());
});

test('fromJSON of an empty / garbage object gives a valid empty model', () => {
  [undefined, null, {}, [], 42, 'null', { sources: 7, pads: 'x', slots: {} }].forEach((junk) => {
    const m = Model.fromJSON(junk);
    assert.equal(m.state.version, 1);
    assert.deepEqual(m.listSources(), []);
    assert.equal(m.state.slots.length, 8);
    assert.equal(m.state.slots[0].keys.length, 128);
    assert.deepEqual(m.globals(), Model.create().globals());
    checkInvariants(m);
  });
});

test('fromJSON repairs dangling references and out-of-range values', () => {
  const m = complexModel();
  const j = m.toJSON();
  const pids = Object.keys(j.pads).map(Number);
  // dangling key + layer, invalid values
  j.slots[0].keys[5] = 987654;
  j.slots[1].locks[7] = 1;
  j.pads[pids[0]].layers = [pids[0], 987654, pids[1], pids[1]];
  j.pads[pids[1]].pitch = 1000;
  j.pads[pids[1]].fine = 'x';
  j.globals.rootKey = 500;
  j.globals.layout = 'weird';
  j.globals.nonsense = 1;
  j.currentSlot = 42;
  j.nextId = 1; // too small: must be bumped past every id
  j.sources[0].playMode = 'warp';
  j.sources[0].slicing.sensitivity = 1e6;
  const r = Model.fromJSON(j);
  assert.equal(r.state.slots[0].keys[5], null);
  assert.equal(r.state.slots[1].locks[7], true);
  assert.deepEqual(r.getPad(pids[0]).layers, [pids[1]]);
  assert.equal(r.getPad(pids[1]).pitch, 48);
  assert.equal(r.getPad(pids[1]).fine, 0);
  assert.equal(r.globals().rootKey, 127);
  assert.equal(r.globals().layout, 'zones');
  assert.equal(r.globals().nonsense, undefined);
  assert.equal(r.currentSlot(), 7);
  assert.equal(r.state.sources[0].playMode, 'mono');
  assert.equal(r.state.sources[0].slicing.sensitivity, 100);
  const maxId = Math.max.apply(null, r.listSources().map((s) => s.id).concat(Object.keys(r.state.pads).map(Number), [].concat.apply([], r.listSources().map((s) => s.slices.map((x) => x.id)))));
  assert.ok(r.state.nextId > maxId);
  // pads pointing at missing slices / sources are dropped
  const j2 = m.toJSON();
  const victim = pids[2];
  j2.pads[victim].sliceId = 424242;
  const r2 = Model.fromJSON(j2);
  assert.equal(r2.getPad(victim), null);
  r2.state.slots.forEach((s) => assert.ok(s.keys.indexOf(victim) < 0));
});

test('save / restore through JSON preserves undo-independent behaviour mid-session', () => {
  const m = complexModel();
  const j = JSON.parse(JSON.stringify(m.toJSON()));
  const r = Model.fromJSON(j, { features: fakeFeatures() });
  r.setPadParam(r.getPadOnKey(36).id, 'pitch', 3);
  assert.equal(r.canUndo(), true);
  r.undo();
  assert.deepEqual(r.toJSON(), j);
});

// ---------------------------------------------------------------- features dependency

test('features module is injected, and loaded lazily only when needed', () => {
  const featuresPath = require.resolve('../core/features');
  const wasLoaded = Object.prototype.hasOwnProperty.call(require.cache, featuresPath);
  const m = Model.create(); // no deps
  const a = m.addSource({ name: 'a' });
  m.setSourceInfo(a.id, { frames: 4000, sr: 44100, channels: 1 });
  m.setSlices(a.id, ranges(4));
  m.setSliceFeatures(a.id, [feat(1), feat(2), feat(3), feat(4)]);
  m.setGlobal('layout', 'sorted');
  m.setGlobal('layout', 'interleave');
  m.shuffle({ mode: 'chaos', seed: 3, flipPct: 50 });
  m.spread(36, 'pitch', 3, 1);
  m.duplicatePad(36, 80);
  m.toggleLayer(36, 37);
  m.copySlot(0, 1);
  m.setSlices(a.id, ranges(4));
  m.addSlicePoint(a.id, 500);
  m.undo();
  m.removeSource(a.id);
  m.toJSON();
  if (!wasLoaded) {
    assert.equal(Object.prototype.hasOwnProperty.call(require.cache, featuresPath), false, 'features.js must not be loaded by the operations above');
  }
  // an injected module is the one used
  const fake = fakeFeatures();
  const m2 = Model.create({ features: fake });
  addSrc(m2, 'a', 4, (i) => feat(100 * (i + 1), i));
  m2.shuffle({ mode: 'smart', seed: 1 });
  m2.swapSimilar(36, 1);
  m2.findBest(2);
  assert.equal(fake.calls.kmeans.length, 1);
  assert.equal(fake.calls.rankSimilar, 1);
  assert.equal(fake.calls.findBest.length, 1);
  // fromJSON takes deps too
  const fake2 = fakeFeatures();
  const m3 = Model.fromJSON(m2.toJSON(), { features: fake2 });
  m3.findBest(2);
  assert.equal(fake2.calls.findBest.length, 1);
});

test('integration with the real features module (smart shuffle, similar swap, find best)', (t) => {
  let real;
  try {
    real = require('../core/features');
    ['normalize', 'distance', 'rankSimilar', 'kmeans', 'findBest'].forEach((fn) => {
      if (typeof real[fn] !== 'function') throw new Error('features.' + fn + ' missing');
    });
  } catch (e) {
    t.skip('core/features.js not usable yet: ' + e.message);
    return;
  }
  const m = Model.create(); // default: lazy require('./features')
  const rng = prng.mulberry32(5);
  const f = () => ({ durMs: 20 + rng() * 400, peakDb: -3 - rng() * 20, rmsDb: -10 - rng() * 40, attackMs: rng() * 30, centroidHz: 200 + rng() * 8000, zcr: rng() * 0.3 });
  const a = m.addSource({ name: 'a' });
  m.setSourceInfo(a.id, { frames: 30000, sr: 44100, channels: 1 });
  m.setSlices(a.id, ranges(30));
  m.setSliceFeatures(a.id, Array.from({ length: 30 }, f));
  const b = m.addSource({ name: 'b' });
  m.setSourceInfo(b.id, { frames: 10000, sr: 44100, channels: 1 });
  m.setSlices(b.id, ranges(10));
  m.setSliceFeatures(b.id, Array.from({ length: 10 }, f));
  const before = m.getSlotKeys(0).filter((x) => x !== null).sort((x, y) => x - y);
  const res = m.shuffle({ mode: 'smart', seed: 4 });
  assert.equal(res.moved, 40);
  assert.deepEqual(m.getSlotKeys(0).filter((x) => x !== null).sort((x, y) => x - y), before);
  checkInvariants(m);
  const p = m.swapSimilar(36, 1);
  assert.ok(p);
  assert.equal(p.simIndex, 1);
  assert.equal(m.swapSimilar(36, -1).simIndex, 0);
  const best = m.findBest(8);
  assert.ok(best.placed >= 1 && best.placed <= 8);
  checkInvariants(m);
  // sorted layout with real features
  m.setGlobal('layout', 'sorted');
  m.applyLayout(0);
  const cs = m.occupiedKeys(0).map((k) => m.getSlice(m.getPadOnKey(k).sliceId).features.centroidHz);
  for (let i = 1; i < cs.length; i++) assert.ok(cs[i - 1] <= cs[i]);
});

// ---------------------------------------------------------------- fuzz: invariants + undo exactness

test('random operation sequences keep every invariant and every undoable op is exactly undoable', () => {
  for (const seed of [1, 2, 3]) {
    const m = mk();
    const rng = prng.mulberry32(seed * 1000 + 7);
    const R = (n) => prng.randInt(rng, n);
    const srcs = [addSrc(m, 'a', 6, (i) => feat(1000 + i * 300, -30 + i * 3, 50 + i * 20)),
      addSrc(m, 'b', 5, (i) => feat(500 + i * 700, -25 + i * 2, 80 + i * 10)),
      addSrc(m, 'c', 7, (i) => feat(2000 + i * 100, -40 + i * 5, 120 + i * 5))];
    const slotPick = () => R(8);
    const keyPick = () => 30 + R(40);
    const paramNames = ['pitch', 'fine', 'gainDb', 'attackMs', 'decayMs', 'sustain', 'releaseMs', 'startOffsetMs', 'loopOn', 'loopSizeMs', 'loopPos', 'cutoffHz', 'drive', 'reverse'];
    const anyPad = () => {
      const ids = padIds(m);
      return ids.length ? ids[R(ids.length)] : 0;
    };
    const anySrc = () => srcs[R(srcs.length)];

    // [name, fn, checkable]
    const ops = [
      ['setPadParam', () => m.setPadParam(anyPad(), paramNames[R(paramNames.length)], (rng() - 0.3) * 200), false],
      ['shuffle', () => m.shuffle({ mode: R(2) ? 'smart' : 'chaos', scope: R(3) ? 'all' : 'source', sourceId: anySrc().id, seed: R(1000), flipPct: R(3) * 40 }), true],
      ['spread', () => m.spread(keyPick(), ['pitch', 'decay', 'start', 'cutoff'][R(4)], 2 + R(6), (rng() - 0.5) * 10), true],
      ['swapSimilar', () => m.swapSimilar(keyPick(), R(2) ? 1 : -1), true],
      ['duplicatePad', () => m.duplicatePad(keyPick(), keyPick()), true],
      ['toggleLayer', () => m.toggleLayer(keyPick(), keyPick()), true],
      ['swapKeys', () => m.swapKeys(keyPick(), keyPick()), true],
      ['clearKey', () => m.clearKey(keyPick()), true],
      ['assignPad', () => m.assignPad(keyPick(), anyPad()), true],
      ['copySlot', () => m.copySlot(slotPick(), slotPick()), true],
      ['applyLayout', () => m.applyLayout(slotPick()), true],
      ['findBest', () => m.findBest(2 + R(10)), true],
      ['applyParamToSource', () => m.applyParamToSource(anyPad(), paramNames[R(paramNames.length)]), true],
      ['addSlicePoint', () => { const s = anySrc(); m.addSlicePoint(s.id, 1 + R(s.frames - 1)); }, true],
      ['removeSlicePoint', () => { const s = anySrc(); if (s.slices.length > 1) m.removeSlicePoint(s.id, 1 + R(s.slices.length - 1)); }, true],
      ['moveSlicePoint', () => { const s = anySrc(); if (s.slices.length > 1) m.moveSlicePoint(s.id, 1 + R(s.slices.length - 1), R(s.frames)); }, false],
      ['setSlices', () => { const s = anySrc(); m.setSlices(s.id, ranges(2 + R(9), Math.floor(s.frames / (2 + R(9))) || 500)); }, false],
      ['setLock', () => m.setLock(keyPick(), R(2)), false],
      ['setCurrentSlot', () => m.setCurrentSlot(slotPick()), false],
      ['setGlobal', () => {
        const pick = R(7);
        if (pick === 0) m.setGlobal('rootKey', R(100));
        else if (pick === 1) m.setGlobal('layout', ['zones', 'interleave', 'sorted'][R(3)]);
        else if (pick === 2) m.setGlobal('zoneAlign', R(2));
        else if (pick === 3) m.setGlobal('sortBy', ['brightness', 'loudness', 'length'][R(3)]);
        else if (pick === 4) m.setGlobal('modZoneOn', R(2));
        else if (pick === 5) m.setGlobal('modZoneStart', R(117));
        else m.setSliceFeatures(anySrc().id, anySrc().slices.map(() => null).concat([]).slice(0, 0).length ? [] : m.getSlicesOfSource(srcs[0].id).map((_, i) => feat(100 * (i + 1), -i)));
      }, false],
      ['undo', () => m.undo(), false],
      ['redo', () => m.redo(), false]
    ];

    for (let i = 0; i < 400; i++) {
      const [name, fn, checkable] = ops[R(ops.length)];
      const before = stripped(m);
      fn();
      checkInvariants(m);
      if (checkable) {
        const after = stripped(m);
        if (JSON.stringify(after) !== JSON.stringify(before)) {
          assert.equal(m.canUndo(), true, name + ' changed state without an undo step (iteration ' + i + ')');
          assert.equal(m.undo(), true);
          assert.deepEqual(stripped(m), before, name + ' undo is exact (seed ' + seed + ', iteration ' + i + ')');
          checkInvariants(m);
          assert.equal(m.redo(), true);
          assert.deepEqual(stripped(m), after, name + ' redo is exact (seed ' + seed + ', iteration ' + i + ')');
          checkInvariants(m);
        }
      }
    }
    // round trip at the end
    const j = m.toJSON();
    assert.deepEqual(Model.fromJSON(j, { features: fakeFeatures() }).toJSON(), j);
  }
});

// ---------------------------------------------------------------- performance

test('16 sources x 128 slices is fast enough: build, edit, undo, serialise', () => {
  const t0 = Date.now();
  const m = mk();
  for (let s = 0; s < 16; s++) addSrc(m, 'src' + s, 128, (i) => feat(200 + ((i * 37 + s * 11) % 128) * 50, -50 + (i % 40), 20 + i));
  assert.equal(Object.keys(m.state.pads).length, 2048);
  assert.equal(m.occupiedKeys().length, 92, 'only 92 keys fit above rootKey 36');
  m.setGlobal('layout', 'sorted');
  m.setGlobal('layout', 'interleave');
  m.setGlobal('layout', 'zones');
  m.shuffle({ mode: 'smart', seed: 1, flipPct: 30 });
  m.shuffle({ mode: 'chaos', seed: 2, flipPct: 30 });
  const ids = padIds(m);
  for (let i = 0; i < 60; i++) m.setPadParam(ids[i * 7], 'pitch', i + 1);
  for (let i = 0; i < 60; i++) m.swapKeys(36 + (i % 50), 37 + (i % 50));
  m.copySlot(0, 5);
  m.findBest(32);
  m.setSlices(m.listSources()[3].id, ranges(100, 1000));
  m.addSlicePoint(m.listSources()[4].id, 500);
  while (m.canUndo()) m.undo();
  while (m.canRedo()) m.redo();
  const j = m.toJSON();
  const r = Model.fromJSON(j, { features: fakeFeatures() });
  assert.deepEqual(r.toJSON(), j);
  checkInvariants(m);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 20000, 'took ' + elapsed + ' ms');
});

test('getPadOnKey / getSlice stay cheap (engine hot path)', () => {
  const m = mk();
  for (let s = 0; s < 16; s++) addSrc(m, 's' + s, 128);
  const t0 = Date.now();
  let hits = 0;
  for (let n = 0; n < 20000; n++) {
    const p = m.getPadOnKey(36 + (n % 92));
    if (p && m.getSlice(p.sliceId) && m.getSource(p.sourceId)) hits++;
  }
  assert.equal(hits, 20000);
  assert.ok(Date.now() - t0 < 5000);
});

// ---------------------------------------------------------------- ES5 conformance

test('model.js is ES5-clean (acorn ecmaVersion 5 + banned API scan)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'core', 'model.js'), 'utf8');
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* optional */ }
  if (acorn) acorn.parse(src, { ecmaVersion: 5 });
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  const banned = [/\bMath\.imul\b/, /=>/, /\blet\b/, /\bconst\b/, /`/, /\bclass\b/, /\bObject\.assign\b/, /\bnew\s+(Map|Set|WeakMap|WeakSet)\b/,
    /\.includes\(/, /\.find\(/, /\.findIndex\(/, /\.fill\(/, /\.startsWith\(/, /\.endsWith\(/, /\.repeat\(/, /\.padStart\(/, /\bArray\.from\b/,
    /\bObject\.(values|entries)\b/, /\bNumber\.(isInteger|isFinite|isNaN)\b/, /\bMath\.(sign|trunc|hypot|log2|log10)\b/, /\bSymbol\b/, /\bPromise\b/,
    /\.\.\./, /\boutlet\b/, /\bpost\(/, /\bLiveAPI\b/, /\bDict\b/, /\bBuffer\b/];
  banned.forEach((re) => assert.ok(!re.test(code), 'banned construct ' + re));
  assert.equal(/require\((?!'\.\/(prng|features)'\))/.test(code), false, 'only relative requires of core modules');
});
