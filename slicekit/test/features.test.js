'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../core/features');

const SR = 44100;

// ------------------------------------------------------------------ helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function whiteNoise(len, amp, rng) {
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = amp * (rng() * 2 - 1);
  return x;
}

// one-pole low-pass of white noise (darker), renormalised to the given RMS-ish amplitude
function darkNoise(len, amp, rng, alpha = 0.02) {
  const x = new Float32Array(len);
  let y = 0;
  let y2 = 0;
  for (let i = 0; i < len; i++) {
    y += alpha * ((rng() * 2 - 1) - y);
    y2 += alpha * (y - y2); // two cascaded poles
    x[i] = y2;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let i = 0; i < len; i++) x[i] *= amp / peak;
  return x;
}

function sine(len, freq, amp, sr = SR) {
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  return x;
}

function feat(over) {
  return Object.assign({ durMs: 200, peakDb: -6, rmsDb: -18, attackMs: 5, centroidHz: 3000, zcr: 0.1 }, over);
}

function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function std(a) { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) * (v - m)))); }

// ------------------------------------------------------------------ sliceFeatures

test('sliceFeatures: returns exactly the documented fields', () => {
  const f = F.sliceFeatures(sine(SR, 440, 0.5), SR, 0, SR);
  assert.deepEqual(Object.keys(f).sort(), ['attackMs', 'centroidHz', 'durMs', 'peakDb', 'rmsDb', 'zcr']);
  for (const k of Object.keys(f)) assert.ok(Number.isFinite(f[k]), k);
});

test('sliceFeatures: sine of known amplitude and frequency', () => {
  const x = sine(SR, 1000, 0.5);
  const f = F.sliceFeatures(x, SR, 0, Math.round(0.5 * SR));
  assert.ok(Math.abs(f.durMs - 500) < 1e-6, `durMs ${f.durMs}`);
  assert.ok(Math.abs(f.peakDb - -6.02) < 0.1, `peakDb ${f.peakDb}`);
  assert.ok(Math.abs(f.rmsDb - -9.03) < 0.1, `rmsDb ${f.rmsDb}`);
  assert.ok(Math.abs(f.zcr - 2000 / SR) < 0.002, `zcr ${f.zcr}`);
  assert.ok(Math.abs(f.centroidHz - 1000) < 30, `centroid ${f.centroidHz}`);
});

test('sliceFeatures: silence uses the -120 dB floor', () => {
  const f = F.sliceFeatures(new Float32Array(SR), SR, 0, SR);
  assert.equal(f.peakDb, -120);
  assert.equal(f.rmsDb, -120);
  assert.equal(f.zcr, 0);
  assert.equal(f.centroidHz, 0);
  assert.equal(f.attackMs, 0);
  assert.ok(Math.abs(f.durMs - 1000) < 1e-6);
  // vanishingly quiet is also floored
  const q = F.sliceFeatures(sine(SR, 440, 1e-8), SR, 0, SR);
  assert.equal(q.peakDb, -120);
  assert.equal(q.rmsDb, -120);
});

test('sliceFeatures: louder slice has higher rmsDb and peakDb', () => {
  const rng = mulberry32(1);
  const loud = F.sliceFeatures(whiteNoise(SR, 0.5, rng), SR, 0, SR);
  const soft = F.sliceFeatures(whiteNoise(SR, 0.05, rng), SR, 0, SR);
  assert.ok(loud.rmsDb > soft.rmsDb);
  assert.ok(loud.peakDb > soft.peakDb);
  assert.ok(Math.abs((loud.rmsDb - soft.rmsDb) - 20) < 0.5, `${loud.rmsDb - soft.rmsDb} dB`);
  assert.ok(loud.peakDb <= 0 && loud.peakDb > -6.1);
  // rms never exceeds the peak
  assert.ok(loud.rmsDb <= loud.peakDb);
});

test('sliceFeatures: brighter noise has a higher centroid and zcr', () => {
  const rng = mulberry32(2);
  const bright = F.sliceFeatures(whiteNoise(SR, 0.5, rng), SR, 0, SR);
  const dark = F.sliceFeatures(darkNoise(SR, 0.5, rng), SR, 0, SR);
  assert.ok(bright.centroidHz > dark.centroidHz * 3, `${bright.centroidHz} vs ${dark.centroidHz}`);
  assert.ok(dark.centroidHz < 3500, `dark centroid ${dark.centroidHz}`);
  assert.ok(bright.zcr > dark.zcr);
  // white noise: centroid about sr/4, zcr about 0.5
  assert.ok(Math.abs(bright.centroidHz - SR / 4) < 1500, `white centroid ${bright.centroidHz}`);
  assert.ok(Math.abs(bright.zcr - 0.5) < 0.02, `white zcr ${bright.zcr}`);
  // pure tones order as well
  const hi = F.sliceFeatures(sine(SR, 5000, 0.5), SR, 0, SR);
  const lo = F.sliceFeatures(sine(SR, 300, 0.5), SR, 0, SR);
  assert.ok(hi.centroidHz > lo.centroidHz);
  assert.ok(Math.abs(hi.centroidHz - 5000) < 100);
  assert.ok(Math.abs(lo.centroidHz - 300) < 60);
});

test('sliceFeatures: sharper attack has lower attackMs', () => {
  const rng = mulberry32(3);
  const len = Math.round(0.5 * SR);
  const sharp = new Float32Array(len);
  const ramp = new Float32Array(len);
  const rampLen = Math.round(0.05 * SR);
  for (let i = 0; i < len; i++) {
    const n = rng() * 2 - 1;
    sharp[i] = 0.8 * n * Math.exp(-i / (0.05 * SR));
    const env = i < rampLen ? i / rampLen : Math.exp(-(i - rampLen) / (0.1 * SR));
    ramp[i] = 0.8 * n * env;
  }
  const fs = F.sliceFeatures(sharp, SR, 0, len);
  const fr = F.sliceFeatures(ramp, SR, 0, len);
  assert.ok(fs.attackMs < 15, `sharp ${fs.attackMs}`);
  assert.ok(fr.attackMs > 35 && fr.attackMs < 65, `ramp ${fr.attackMs}`);
  assert.ok(fs.attackMs < fr.attackMs);
  // a click right at the start has (almost) no attack time
  const click = new Float32Array(2000);
  click[0] = 1;
  assert.ok(F.sliceFeatures(click, SR, 0, 2000).attackMs < 1);
  // a late click: attack is the distance to the click (within the ~1 ms window)
  const late = new Float32Array(5000);
  late[2205] = 1;
  const fl = F.sliceFeatures(late, SR, 0, 5000);
  assert.ok(Math.abs(fl.attackMs - 50) < 1, `late click attack ${fl.attackMs}`);
});

test('sliceFeatures: only the requested range counts, start offsets are honoured', () => {
  const rng = mulberry32(4);
  const x = new Float32Array(SR);
  const noise = whiteNoise(10000, 0.5, rng);
  x.set(noise, 20000);
  const inside = F.sliceFeatures(x, SR, 20000, 30000);
  const silent = F.sliceFeatures(x, SR, 0, 20000);
  assert.ok(inside.rmsDb > -15);
  assert.equal(silent.rmsDb, -120);
  assert.ok(Math.abs(inside.durMs - 10000 * 1000 / SR) < 1e-9);
  // a late click inside a slice that starts mid-file: attack measured from the slice start
  const y = new Float32Array(SR);
  y[30000 + 4410] = 1;
  const f = F.sliceFeatures(y, SR, 30000, 40000);
  assert.ok(Math.abs(f.attackMs - 100) < 1, `attack ${f.attackMs}`);
});

test('sliceFeatures: very short, empty and out-of-range slices are safe', () => {
  const x = sine(SR, 440, 0.5);
  const one = F.sliceFeatures(x, SR, 100, 101);
  assert.ok(Math.abs(one.durMs - 1000 / SR) < 1e-9);
  assert.ok(Number.isFinite(one.centroidHz));
  const ten = F.sliceFeatures(x, SR, 100, 110);
  for (const k of Object.keys(ten)) assert.ok(Number.isFinite(ten[k]), k);
  const empty = F.sliceFeatures(x, SR, 500, 500);
  assert.equal(empty.durMs, 0);
  assert.equal(empty.rmsDb, -120);
  const reversed = F.sliceFeatures(x, SR, 600, 500);
  assert.equal(reversed.durMs, 0);
  const beyond = F.sliceFeatures(x, SR, SR - 100, SR + 5000);
  assert.ok(Math.abs(beyond.durMs - 100 * 1000 / SR) < 1e-9);
  const neg = F.sliceFeatures(x, SR, -50, 100);
  assert.ok(Math.abs(neg.durMs - 100 * 1000 / SR) < 1e-9);
});

test('sliceFeatures: short slices (zero-padded frame) still get a sensible centroid', () => {
  // 1 kHz tone, 512 samples: resolution is coarse but the centroid is in the right area
  const f = F.sliceFeatures(sine(5000, 1000, 0.5), SR, 0, 512);
  assert.ok(f.centroidHz > 700 && f.centroidHz < 1500, `${f.centroidHz}`);
  // multi-frame slice (several 2048 frames): the average of the frames
  const g = F.sliceFeatures(sine(SR, 1000, 0.5), SR, 0, SR);
  assert.ok(Math.abs(g.centroidHz - 1000) < 30);
});

test('sliceFeatures: a long slice (30 s) is processed quickly', () => {
  const x = new Float32Array(30 * SR);
  const rng = mulberry32(5);
  for (let i = 0; i < x.length; i++) x[i] = rng() - 0.5;
  const t0 = Date.now();
  const f = F.sliceFeatures(x, SR, 0, x.length);
  assert.ok(Date.now() - t0 < 3000);
  assert.ok(Math.abs(f.durMs - 30000) < 1e-6);
});

test('computeAll: one Features object per range, same as sliceFeatures', () => {
  const rng = mulberry32(6);
  const x = whiteNoise(30000, 0.4, rng);
  const ranges = [{ start: 0, end: 10000 }, { start: 10000, end: 22000 }, { start: 22000, end: 30000 }];
  const all = F.computeAll(x, SR, ranges);
  assert.equal(all.length, 3);
  ranges.forEach((r, i) => assert.deepEqual(all[i], F.sliceFeatures(x, SR, r.start, r.end)));
  assert.deepEqual(F.computeAll(x, SR, []), []);
});

// ------------------------------------------------------------------ normalize / distance

test('normalize: shape, zero mean and unit std for varying dimensions', () => {
  const rng = mulberry32(7);
  const list = [];
  for (let i = 0; i < 40; i++) {
    list.push({
      durMs: 20 + rng() * 800,
      peakDb: -30 + rng() * 30,
      rmsDb: -50 + rng() * 40,
      attackMs: rng() * 40,
      centroidHz: 200 + rng() * 9000,
      zcr: rng() * 0.5
    });
  }
  const v = F.normalize(list);
  assert.equal(v.length, 40);
  for (const row of v) {
    assert.equal(row.length, 5);
    for (const c of row) assert.ok(Number.isFinite(c));
  }
  for (let d = 0; d < 5; d++) {
    const col = v.map((r) => r[d]);
    assert.ok(Math.abs(mean(col)) < 1e-9, `dim ${d} mean ${mean(col)}`);
    assert.ok(Math.abs(std(col) - 1) < 1e-9, `dim ${d} std ${std(col)}`);
  }
});

test('normalize: dimension order is [log dur, rmsDb, log attack, log centroid, zcr]', () => {
  const base = feat({});
  const vary = (field, a, b) => F.normalize([Object.assign({}, base, { [field]: a }), Object.assign({}, base, { [field]: b })]);
  const nonZeroDims = (rows) => [0, 1, 2, 3, 4].filter((d) => Math.abs(rows[0][d]) > 1e-9 || Math.abs(rows[1][d]) > 1e-9);
  const d0 = vary('durMs', 100, 400);
  assert.deepEqual(nonZeroDims(d0), [0]);
  assert.ok(d0[0][0] < d0[1][0]);
  const d1 = vary('rmsDb', -40, -10);
  assert.deepEqual(nonZeroDims(d1), [1]);
  assert.ok(d1[0][1] < d1[1][1]);
  const d2 = vary('attackMs', 1, 30);
  assert.deepEqual(nonZeroDims(d2), [2]);
  assert.ok(d2[0][2] < d2[1][2]);
  const d3 = vary('centroidHz', 500, 8000);
  assert.deepEqual(nonZeroDims(d3), [3]);
  assert.ok(d3[0][3] < d3[1][3]);
  const d4 = vary('zcr', 0.01, 0.4);
  assert.deepEqual(nonZeroDims(d4), [4]);
  assert.ok(d4[0][4] < d4[1][4]);
  // peakDb is not part of the similarity vector
  assert.deepEqual(nonZeroDims(vary('peakDb', -30, -1)), []);
  // z of two values is -1 / +1
  assert.ok(Math.abs(d1[0][1] + 1) < 1e-9 && Math.abs(d1[1][1] - 1) < 1e-9);
});

test('normalize: log compression of duration (log(1 + x))', () => {
  const e = Math.E;
  const rows = F.normalize([feat({ durMs: 0 }), feat({ durMs: e - 1 }), feat({ durMs: e * e - 1 })]);
  const z = rows.map((r) => r[0]);
  // log(1 + durMs) = 0, 1, 2  ->  z = -sqrt(1.5), 0, +sqrt(1.5)
  assert.ok(Math.abs(z[0] + Math.sqrt(1.5)) < 1e-9);
  assert.ok(Math.abs(z[1]) < 1e-9);
  assert.ok(Math.abs(z[2] - Math.sqrt(1.5)) < 1e-9);
});

test('normalize: constant columns, single entries and empty lists are safe', () => {
  const same = F.normalize([feat({}), feat({}), feat({})]);
  for (const row of same) {
    assert.equal(row.length, 5);
    row.forEach((c) => assert.ok(Math.abs(c) < 1e-6, `constant column should normalise to ~0, got ${c}`));
  }
  const single = F.normalize([feat({})]);
  assert.equal(single.length, 1);
  single[0].forEach((c) => assert.ok(Math.abs(c) < 1e-6));
  assert.deepEqual(F.normalize([]), []);
});

test('normalize: entries without features are neutral and do not skew the statistics', () => {
  const a = feat({ rmsDb: -40, centroidHz: 500 });
  const b = feat({ rmsDb: -10, centroidHz: 6000 });
  const plain = F.normalize([a, b]);
  const withNulls = F.normalize([null, a, undefined, b]);
  assert.deepEqual(withNulls[0], [0, 0, 0, 0, 0]);
  assert.deepEqual(withNulls[2], [0, 0, 0, 0, 0]);
  assert.deepEqual(withNulls[1], plain[0]);
  assert.deepEqual(withNulls[3], plain[1]);
});

test('distance: euclidean', () => {
  assert.equal(F.distance([0, 0, 0], [3, 4, 0]), 5);
  assert.equal(F.distance([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 0);
  assert.ok(Math.abs(F.distance([1, 1], [0, 0]) - Math.SQRT2) < 1e-12);
  assert.equal(F.distance([1, 2], [4, 6]), F.distance([4, 6], [1, 2]));
});

// ------------------------------------------------------------------ rankSimilar

test('rankSimilar: target first, sorted by distance, a permutation', () => {
  const rng = mulberry32(8);
  const list = [];
  for (let i = 0; i < 25; i++) {
    list.push({
      durMs: 20 + rng() * 500,
      peakDb: -20 + rng() * 20,
      rmsDb: -40 + rng() * 30,
      attackMs: rng() * 30,
      centroidHz: 300 + rng() * 8000,
      zcr: rng() * 0.4
    });
  }
  const vecs = F.normalize(list);
  for (const target of [0, 7, 24]) {
    const order = F.rankSimilar(target, list);
    assert.equal(order.length, list.length);
    assert.equal(order[0], target);
    assert.deepEqual(order.slice().sort((p, q) => p - q), list.map((_, i) => i));
    for (let i = 2; i < order.length; i++) {
      const d0 = F.distance(vecs[target], vecs[order[i - 1]]);
      const d1 = F.distance(vecs[target], vecs[order[i]]);
      assert.ok(d1 >= d0 - 1e-12, `not sorted at ${i}`);
    }
  }
});

test('rankSimilar: the near-duplicate is the nearest neighbour', () => {
  const list = [
    feat({ durMs: 100, rmsDb: -12, attackMs: 1, centroidHz: 8000, zcr: 0.3 }),   // 0: bright hat
    feat({ durMs: 600, rmsDb: -9, attackMs: 3, centroidHz: 150, zcr: 0.02 }),    // 1: kick
    feat({ durMs: 105, rmsDb: -12.5, attackMs: 1.1, centroidHz: 7900, zcr: 0.29 }), // 2: another hat
    feat({ durMs: 300, rmsDb: -14, attackMs: 2, centroidHz: 2500, zcr: 0.12 }),  // 3: snare
    feat({ durMs: 580, rmsDb: -9.5, attackMs: 3.2, centroidHz: 170, zcr: 0.021 }) // 4: another kick
  ];
  assert.deepEqual(F.rankSimilar(0, list).slice(0, 2), [0, 2]);
  assert.deepEqual(F.rankSimilar(2, list).slice(0, 2), [2, 0]);
  assert.deepEqual(F.rankSimilar(1, list).slice(0, 2), [1, 4]);
  assert.deepEqual(F.rankSimilar(4, list).slice(0, 2), [4, 1]);
  assert.equal(F.rankSimilar(3, list)[0], 3);
});

test('rankSimilar: entries without features go last, bad target gives []', () => {
  const list = [feat({ rmsDb: -10 }), null, feat({ rmsDb: -11 }), feat({ rmsDb: -40, centroidHz: 100 })];
  assert.deepEqual(F.rankSimilar(0, list), [0, 2, 3, 1]);
  assert.deepEqual(F.rankSimilar(1, list), [1, 0, 2, 3]);
  assert.deepEqual(F.rankSimilar(-1, list), []);
  assert.deepEqual(F.rankSimilar(9, list), []);
  assert.deepEqual(F.rankSimilar(0, [feat({})]), [0]);
});

// ------------------------------------------------------------------ kmeans

function blobs(perBlob, seed) {
  const rng = mulberry32(seed);
  const centers = [[0, 0, 0, 0, 0], [10, 10, 10, 10, 10], [-10, 10, -10, 10, -10]];
  const vectors = [];
  const truth = [];
  for (let b = 0; b < centers.length; b++) {
    for (let i = 0; i < perBlob; i++) {
      vectors.push(centers[b].map((c) => c + (rng() - 0.5)));
      truth.push(b);
    }
  }
  return { vectors, truth };
}

// partition equality up to relabeling
function samePartition(labels, truth) {
  const map = new Map();
  const rev = new Map();
  for (let i = 0; i < labels.length; i++) {
    if (map.has(truth[i])) { if (map.get(truth[i]) !== labels[i]) return false; }
    else map.set(truth[i], labels[i]);
    if (rev.has(labels[i])) { if (rev.get(labels[i]) !== truth[i]) return false; }
    else rev.set(labels[i], truth[i]);
  }
  return true;
}

test('kmeans: recovers well-separated clusters for many seeds', () => {
  const { vectors, truth } = blobs(20, 100);
  for (let seed = 1; seed <= 20; seed++) {
    const labels = F.kmeans(vectors, 3, mulberry32(seed));
    assert.equal(labels.length, vectors.length);
    assert.ok(samePartition(labels, truth), `seed ${seed}: ${labels}`);
    labels.forEach((l) => assert.ok(Number.isInteger(l) && l >= 0 && l < 3));
  }
});

test('kmeans: deterministic for a given rng, input untouched', () => {
  const { vectors } = blobs(15, 101);
  const snapshot = JSON.stringify(vectors);
  const a = F.kmeans(vectors, 3, mulberry32(42));
  const b = F.kmeans(vectors, 3, mulberry32(42));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(vectors), snapshot);
  // random (not separable) data too
  const rng = mulberry32(7);
  const noise = [];
  for (let i = 0; i < 60; i++) noise.push([rng(), rng(), rng(), rng(), rng()]);
  assert.deepEqual(F.kmeans(noise, 5, mulberry32(9)), F.kmeans(noise, 5, mulberry32(9)));
});

test('kmeans: k >= n gives every vector its own label, k = 1 gives one cluster, empty input', () => {
  const v = [[0, 0], [1, 1], [2, 2]];
  assert.deepEqual(F.kmeans(v, 3, mulberry32(1)), [0, 1, 2]);
  assert.deepEqual(F.kmeans(v, 10, mulberry32(1)), [0, 1, 2]);
  assert.deepEqual(F.kmeans(v, 1, mulberry32(1)), [0, 0, 0]);
  assert.deepEqual(F.kmeans(v, 0, mulberry32(1)), [0, 0, 0]);
  assert.deepEqual(F.kmeans([], 3, mulberry32(1)), []);
  assert.deepEqual(F.kmeans([[1, 2]], 4, mulberry32(1)), [0]);
});

test('kmeans: identical vectors / empty clusters are handled (every cluster used)', () => {
  const same = [];
  for (let i = 0; i < 12; i++) same.push([1, 2, 3]);
  const labels = F.kmeans(same, 4, mulberry32(3));
  assert.equal(labels.length, 12);
  labels.forEach((l) => assert.ok(l >= 0 && l < 4));
  assert.equal(new Set(labels).size, 4);
  // two distinct points, k = 3: still valid labels
  const two = [[0, 0], [0, 0], [0, 0], [5, 5], [5, 5], [5, 5]];
  const l2 = F.kmeans(two, 3, mulberry32(4));
  assert.equal(l2.length, 6);
  l2.forEach((l) => assert.ok(l >= 0 && l < 3));
  assert.equal(new Set(l2).size, 3);
  // the two distinct positions never share a cluster
  const near = new Set(l2.slice(0, 3));
  const far = new Set(l2.slice(3));
  for (const l of near) assert.ok(!far.has(l));
});

test('kmeans: extreme rng values and fewer clusters than blobs', () => {
  const { vectors, truth } = blobs(10, 102);
  for (const rng of [() => 0, () => 0.9999999, () => 0.5]) {
    const labels = F.kmeans(vectors, 3, rng);
    assert.equal(labels.length, vectors.length);
    labels.forEach((l) => assert.ok(l >= 0 && l < 3));
  }
  const two = F.kmeans(vectors, 2, mulberry32(5));
  assert.equal(new Set(two).size, 2);
  // blobs are never split when k is smaller than the number of blobs
  const groups = new Map();
  for (let i = 0; i < two.length; i++) {
    if (!groups.has(truth[i])) groups.set(truth[i], new Set());
    groups.get(truth[i]).add(two[i]);
  }
  for (const s of groups.values()) assert.equal(s.size, 1);
});

test('kmeans: works on normalised slice features', () => {
  const rng = mulberry32(11);
  const list = [];
  const truth = [];
  const protos = [
    { durMs: 80, rmsDb: -14, attackMs: 0.5, centroidHz: 8000, zcr: 0.35 },   // hats
    { durMs: 500, rmsDb: -8, attackMs: 4, centroidHz: 120, zcr: 0.01 },      // kicks
    { durMs: 250, rmsDb: -12, attackMs: 1.5, centroidHz: 2800, zcr: 0.15 }   // snares
  ];
  protos.forEach((p, b) => {
    for (let i = 0; i < 10; i++) {
      list.push(feat({
        durMs: p.durMs * (0.9 + 0.2 * rng()),
        rmsDb: p.rmsDb + rng() * 2 - 1,
        attackMs: p.attackMs * (0.8 + 0.4 * rng()),
        centroidHz: p.centroidHz * (0.9 + 0.2 * rng()),
        zcr: p.zcr * (0.9 + 0.2 * rng())
      }));
      truth.push(b);
    }
  });
  const labels = F.kmeans(F.normalize(list), 3, mulberry32(12));
  assert.ok(samePartition(labels, truth), labels.join(','));
});

// ------------------------------------------------------------------ findBest

function rampList(n) {
  // item i is louder and louder, all with the same attack: score increases with i
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push(feat({ rmsDb: -40 + i, peakDb: -30 + i * 0.8, attackMs: 5, centroidHz: 1000 + i * 37, durMs: 100 + i * 11, zcr: 0.1 }));
  }
  return list;
}

test('findBest: distinct indices, correct count, in range', () => {
  const list = rampList(30);
  for (const n of [1, 5, 16, 30]) {
    for (const diversity of [0, 0.3, 0.5, 1]) {
      const r = F.findBest(list, n, { diversity });
      assert.equal(r.length, n);
      assert.equal(new Set(r).size, n, 'indices must be distinct');
      r.forEach((i) => assert.ok(Number.isInteger(i) && i >= 0 && i < 30));
    }
  }
  // default options
  assert.equal(F.findBest(list, 6).length, 6);
  assert.equal(F.findBest(list, 6, {}).length, 6);
});

test('findBest: n larger than the list returns every index once; n <= 0 and empty lists', () => {
  const list = rampList(7);
  const all = F.findBest(list, 100, { diversity: 0.5 });
  assert.equal(all.length, 7);
  assert.deepEqual(all.slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(F.findBest(list, 0), []);
  assert.deepEqual(F.findBest(list, -3), []);
  assert.deepEqual(F.findBest([], 5), []);
  assert.deepEqual(F.findBest([feat({})], 5), [0]);
});

test('findBest: diversity 0 returns the strongest items in score order', () => {
  const list = rampList(20);
  assert.deepEqual(F.findBest(list, 5, { diversity: 0 }), [19, 18, 17, 16, 15]);
  // the first pick is the best-scoring item for any diversity
  for (const diversity of [0, 0.25, 0.5, 0.75, 1]) {
    assert.equal(F.findBest(list, 3, { diversity })[0], 19);
  }
});

test('findBest: strong and punchy beats weak and slow-attacking', () => {
  const list = [
    feat({ rmsDb: -30, peakDb: -20, attackMs: 20 }),   // 0 weak, slow
    feat({ rmsDb: -12, peakDb: -3, attackMs: 0.5 }),   // 1 loud, punchy
    feat({ rmsDb: -12, peakDb: -3, attackMs: 25 }),    // 2 loud, slow
    feat({ rmsDb: -35, peakDb: -25, attackMs: 0.5 }),  // 3 weak, punchy
    feat({ rmsDb: -20, peakDb: -10, attackMs: 5 })     // 4 medium
  ];
  assert.equal(F.findBest(list, 1)[0], 1);
  const order = F.findBest(list, 5, { diversity: 0 });
  assert.equal(order[0], 1);
  assert.ok(order.indexOf(2) < order.indexOf(0));
  assert.ok(order.indexOf(4) < order.indexOf(3));
  assert.ok(order.indexOf(1) < order.indexOf(2), 'faster attack wins at equal loudness');
});

test('findBest: diversity trades strength for variety', () => {
  // cluster A: 12 near-identical, very strong slices; cluster B: 6 weaker slices of a different kind;
  // cluster C: 6 weaker slices of a third kind
  const list = [];
  for (let i = 0; i < 12; i++) {
    list.push(feat({ rmsDb: -8 - i * 0.05, peakDb: -1 - i * 0.05, attackMs: 0.5, centroidHz: 6000 + i, durMs: 100 + i, zcr: 0.3 }));
  }
  for (let i = 0; i < 6; i++) {
    list.push(feat({ rmsDb: -20 - i * 0.1, peakDb: -10 - i * 0.1, attackMs: 3, centroidHz: 200 + i, durMs: 700 + i, zcr: 0.02 }));
  }
  for (let i = 0; i < 6; i++) {
    list.push(feat({ rmsDb: -22 - i * 0.1, peakDb: -12 - i * 0.1, attackMs: 2, centroidHz: 2500 + i, durMs: 300 + i, zcr: 0.12 }));
  }
  const group = (i) => (i < 12 ? 'A' : (i < 18 ? 'B' : 'C'));
  const strong = F.findBest(list, 3, { diversity: 0 });
  assert.deepEqual(strong.map(group), ['A', 'A', 'A']);
  const diverse = F.findBest(list, 3, { diversity: 1 });
  assert.equal(new Set(diverse.map(group)).size, 3, `diverse picks: ${diverse}`);
  assert.equal(group(diverse[0]), 'A', 'the best item always comes first');
  const mid = F.findBest(list, 3, { diversity: 0.5 });
  assert.ok(new Set(mid.map(group)).size >= 2, `mid picks: ${mid}`);
  // more diversity never reduces the number of distinct groups here
  let prev = 0;
  for (const d of [0, 0.5, 1]) {
    const g = new Set(F.findBest(list, 3, { diversity: d }).map(group)).size;
    assert.ok(g >= prev);
    prev = g;
  }
});

test('findBest: pure diversity spreads over the feature space (farthest-first)', () => {
  const list = [];
  for (let i = 0; i < 10; i++) list.push(feat({ rmsDb: -10 - i * 0.01, centroidHz: 1000 + i, durMs: 200 + i }));
  list.push(feat({ rmsDb: -30, peakDb: -20, centroidHz: 9000, durMs: 20, zcr: 0.4, attackMs: 10 })); // 10: outlier
  const r = F.findBest(list, 2, { diversity: 1 });
  assert.equal(r.length, 2);
  assert.ok(r.indexOf(10) !== -1, 'the outlier is the most different pick');
});

test('findBest: items without features are never picked', () => {
  const list = [null, feat({ rmsDb: -10, peakDb: -2 }), undefined, feat({ rmsDb: -20, peakDb: -9, centroidHz: 500 }), feat({ rmsDb: -30, peakDb: -15, centroidHz: 9000 })];
  const r = F.findBest(list, 10, { diversity: 0.5 });
  assert.deepEqual(r.slice().sort((a, b) => a - b), [1, 3, 4]);
  assert.deepEqual(F.findBest([null, undefined], 3), []);
});

test('findBest: deterministic and independent of the input order for the first pick', () => {
  const list = rampList(25);
  assert.deepEqual(F.findBest(list, 8, { diversity: 0.5 }), F.findBest(list, 8, { diversity: 0.5 }));
  const reversed = list.slice().reverse();
  assert.equal(F.findBest(reversed, 1)[0], 0); // best item sits at index 0 after reversing
});
