'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../core/slicing');
const { hann, magnitudeSpectrum } = require('../core/fft');

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

function ms(frames, sr = SR) {
  return frames * 1000 / sr;
}

function silence(seconds, sr = SR) {
  return new Float32Array(Math.round(seconds * sr));
}

// single-sample click
function addClick(x, tSec, amp, sr = SR) {
  x[Math.round(tSec * sr)] += amp;
}

// decaying white-noise burst starting abruptly at tSec
function addBurst(x, tSec, amp, tauSec, rng, sr = SR, lenSec = 0.25) {
  const t0 = Math.round(tSec * sr);
  const n = Math.round(lenSec * sr);
  for (let i = 0; i < n && t0 + i < x.length; i++) {
    x[t0 + i] += amp * (rng() * 2 - 1) * Math.exp(-i / (tauSec * sr));
  }
}

function addNoise(x, amp, rng) {
  for (let i = 0; i < x.length; i++) x[i] += amp * (rng() * 2 - 1);
}

// every true position has a detected point within tolMs (and vice versa for count)
function assertDetected(points, truthSec, tolMs, sr = SR) {
  for (const t of truthSec) {
    let best = Infinity;
    for (const p of points) best = Math.min(best, Math.abs(ms(p - t * sr, sr)));
    assert.ok(best <= tolMs, `no point within ${tolMs} ms of ${t}s (closest ${best.toFixed(2)} ms); points=${points}`);
  }
}

function assertSortedUniqueInts(points) {
  for (let i = 0; i < points.length; i++) {
    assert.ok(Number.isInteger(points[i]), `point ${points[i]} is not an integer`);
    if (i > 0) assert.ok(points[i] > points[i - 1], 'points must be strictly increasing');
  }
}

function assertRanges(ranges, total, minFrames) {
  assert.ok(ranges.length >= 1);
  assert.equal(ranges[0].start, 0, 'first range starts at 0');
  assert.equal(ranges[ranges.length - 1].end, total, 'last range ends at total');
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    assert.ok(Number.isInteger(r.start) && Number.isInteger(r.end));
    assert.ok(r.end > r.start, `range ${i} is empty`);
    if (i > 0) assert.equal(r.start, ranges[i - 1].end, `range ${i} is not contiguous`);
    if (minFrames && total >= minFrames) assert.ok(r.end - r.start >= minFrames, `range ${i} shorter than ${minFrames}`);
  }
}

// ------------------------------------------------------------------ toMono

test('toMono: mono passthrough, stereo average, unequal lengths, empty', () => {
  const a = Float32Array.from([1, 2, 3]);
  assert.equal(S.toMono([a]), a);
  const m = S.toMono([Float32Array.from([1, 0, -1]), Float32Array.from([3, 2, 1])]);
  assert.ok(m instanceof Float32Array);
  assert.deepEqual(Array.from(m), [2, 1, 0]);
  const m2 = S.toMono([Float32Array.from([1, 1, 1, 1]), Float32Array.from([1, 1])]);
  assert.equal(m2.length, 2);
  assert.equal(S.toMono([]).length, 0);
  const m3 = S.toMono([Float32Array.from([3, 3]), Float32Array.from([0, 0]), Float32Array.from([0, 0])]);
  assert.ok(Math.abs(m3[0] - 1) < 1e-6);
});

// ------------------------------------------------------------------ onsetFunction

test('onsetFunction: frame / hop depend on the sample rate', () => {
  const x = new Float32Array(20000);
  const lo = S.onsetFunction(x, 44100);
  assert.equal(lo.hop, 256);
  assert.equal(lo.frameSize, 1024);
  const hi = S.onsetFunction(x, 96000);
  assert.equal(hi.hop, 512);
  assert.equal(hi.frameSize, 2048);
  assert.equal(S.onsetFunction(x, 60000).hop, 256);
});

test('onsetFunction: silence is all zeros, empty input is empty', () => {
  const o = S.onsetFunction(new Float32Array(10000), SR);
  assert.ok(o.odf instanceof Float32Array);
  assert.ok(o.odf.length > 0);
  for (let i = 0; i < o.odf.length; i++) assert.equal(o.odf[i], 0);
  assert.equal(S.onsetFunction(new Float32Array(0), SR).odf.length, 0);
});

test('onsetFunction: normalised to max 1, odf[0] = 0, peak at the click frame', () => {
  const x = silence(1);
  const t = 20000;
  x[t] = 0.8;
  const o = S.onsetFunction(x, SR);
  let max = 0;
  let arg = 0;
  for (let i = 0; i < o.odf.length; i++) {
    assert.ok(o.odf[i] >= 0 && o.odf[i] <= 1 + 1e-6);
    if (o.odf[i] > max) { max = o.odf[i]; arg = i; }
  }
  assert.ok(Math.abs(max - 1) < 1e-6);
  assert.equal(o.odf[0], 0);
  // the peak frame must contain the click
  assert.ok(arg * o.hop <= t && t < arg * o.hop + o.frameSize, `peak frame ${arg} does not contain the click`);
  assert.equal(o.odf.length, Math.floor((x.length - o.frameSize) / o.hop) + 1);
});

test('onsetFunction: equals a naive per-frame spectral flux (checks the paired-FFT path)', () => {
  const rng = mulberry32(11);
  const x = new Float32Array(9000);
  addNoise(x, 0.02, rng);
  addBurst(x, 0.05, 0.6, 0.02, rng);
  addBurst(x, 0.14, 0.3, 0.01, rng);
  const N = 1024;
  const hop = 256;
  const win = hann(N);
  const numFrames = Math.floor((x.length - N) / hop) + 1;
  const naive = new Float64Array(numFrames);
  let prev = null;
  for (let f = 0; f < numFrames; f++) {
    const frame = new Float32Array(N);
    for (let i = 0; i < N && f * hop + i < x.length; i++) frame[i] = x[f * hop + i];
    const mag = magnitudeSpectrum(frame, win);
    const cur = Array.from(mag, (m) => Math.log(1 + 100 * m));
    if (prev && f > 0) {
      let flux = 0;
      for (let k = 0; k < cur.length; k++) flux += Math.max(0, cur[k] - prev[k]);
      naive[f] = flux;
    }
    prev = cur;
  }
  const peak = Math.max(...naive);
  const o = S.onsetFunction(x, SR);
  assert.equal(o.odf.length, numFrames);
  for (let f = 0; f < numFrames; f++) {
    assert.ok(Math.abs(o.odf[f] - naive[f] / peak) < 1e-4, `frame ${f}: ${o.odf[f]} vs ${naive[f] / peak}`);
  }
});

// ------------------------------------------------------------------ detectTransients

test('detectTransients: silence and tiny inputs give [0]', () => {
  assert.deepEqual(S.detectTransients(silence(3), SR, { sensitivity: 100 }), [0]);
  assert.deepEqual(S.detectTransients(new Float32Array(0), SR, {}), [0]);
  assert.deepEqual(S.detectTransients(new Float32Array(1), SR, {}), [0]);
  assert.deepEqual(S.detectTransients(new Float32Array(100), SR, {}), [0]);
  // inaudible noise floor (about -100 dBFS) is treated as silence too
  const rng = mulberry32(5);
  const quiet = silence(3);
  addNoise(quiet, 1e-5, rng);
  assert.deepEqual(S.detectTransients(quiet, SR, { sensitivity: 100 }), [0]);
  // constant DC
  assert.deepEqual(S.detectTransients(new Float32Array(SR).map(() => 0.5), SR, { sensitivity: 100 }), [0]);
});

test('detectTransients: stationary tones are not sliced (no phase-ripple false onsets)', () => {
  for (const [f, amp] of [[100, 0.9], [440, 0.5], [1000, 0.99], [5000, 0.7]]) {
    const x = new Float32Array(5 * SR);
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin(2 * Math.PI * f * i / SR + 0.3);
    assert.deepEqual(S.detectTransients(x, SR, { sensitivity: 100 }), [0], `${f} Hz`);
  }
  assert.equal(S.estimateBpm(new Float32Array(5 * SR).map((_, i) => 0.5 * Math.sin(i * 0.06)), SR), null);
});

test('detectTransients: clicks are found within 5 ms, first point is 0, output is sorted unique ints', () => {
  const times = [0.3, 0.8, 1.3, 1.9, 2.4, 3.1, 3.5];
  const x = silence(4);
  for (const t of times) addClick(x, t, 0.9);
  const pts = S.detectTransients(x, SR, { sensitivity: 50, minSliceMs: 30 });
  assert.equal(pts[0], 0);
  assertSortedUniqueInts(pts);
  assert.equal(pts.length, times.length + 1);
  assertDetected(pts, times, 5);
  // every onset is refined to just *before* the hit, never after it
  for (let i = 0; i < times.length; i++) {
    const d = ms(pts[i + 1] - times[i] * SR);
    assert.ok(d <= 0.1 && d >= -5, `onset ${i} at ${d.toFixed(2)} ms relative to the click`);
  }
});

test('detectTransients: decaying noise bursts are found within 5 ms, starting just before the hit', () => {
  const rng = mulberry32(21);
  const times = [0.3, 0.8, 1.3, 1.9, 2.4, 3.1, 3.5];
  const x = silence(4);
  times.forEach((t, k) => addBurst(x, t, 0.9, 0.03 + 0.01 * (k % 3), rng));
  const pts = S.detectTransients(x, SR, { sensitivity: 50, minSliceMs: 30 });
  assert.equal(pts[0], 0);
  assertSortedUniqueInts(pts);
  assert.equal(pts.length, times.length + 1);
  assertDetected(pts, times, 5);
  for (let i = 0; i < times.length; i++) {
    const d = ms(pts[i + 1] - times[i] * SR);
    assert.ok(d <= 0.5 && d >= -5, `onset ${i} at ${d.toFixed(2)} ms relative to the burst`);
  }
});

test('detectTransients: hits of very different loudness (about 40 dB range) are all found', () => {
  const rng = mulberry32(22);
  const times = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3];
  const amps = [0.9, 0.3, 0.1, 0.03, 0.02, 0.5];
  const x = silence(4);
  times.forEach((t, k) => addBurst(x, t, amps[k], 0.04, rng));
  const pts = S.detectTransients(x, SR, { sensitivity: 70 });
  assertDetected(pts, times, 5);
  assert.equal(pts.length, times.length + 1);
});

test('detectTransients: bursts over a noise floor (-45 dB) are found within 5 ms', () => {
  const rng = mulberry32(23);
  const times = [0.4, 1.1, 1.8, 2.5, 3.2];
  const x = silence(4);
  addNoise(x, 0.0056, rng);
  times.forEach((t) => addBurst(x, t, 0.8, 0.04, rng));
  const pts = S.detectTransients(x, SR, { sensitivity: 50 });
  assertDetected(pts, times, 5);
  assert.ok(pts.length <= times.length + 2, `too many points: ${pts.length}`);
});

test('detectTransients: a tonal note onset (sine burst) is found', () => {
  const x = silence(2);
  const t0 = Math.round(0.6 * SR);
  for (let i = 0; i < 0.8 * SR; i++) {
    x[t0 + i] = 0.7 * Math.sin(2 * Math.PI * 440 * i / SR) * Math.exp(-i / (0.08 * SR));
  }
  const pts = S.detectTransients(x, SR, { sensitivity: 50 });
  assertDetected(pts, [0.6], 5);
  assert.equal(pts.length, 2);
});

test('detectTransients: works at 96 kHz and 48 kHz', () => {
  for (const sr of [48000, 96000]) {
    const rng = mulberry32(24);
    const times = [0.3, 0.9, 1.4, 2.2];
    const x = silence(3, sr);
    times.forEach((t) => addBurst(x, t, 0.9, 0.03, rng, sr));
    const pts = S.detectTransients(x, sr, { sensitivity: 50 });
    assert.equal(pts.length, times.length + 1, `sr=${sr}: ${pts}`);
    assertDetected(pts, times, 5, sr);
  }
});

test('detectTransients: a realistic drum loop (kick / snare / hat) is sliced on its hits', () => {
  const rng = mulberry32(25);
  const bpm = 120;
  const beat = 60 / bpm;
  const secs = 8;
  const x = silence(secs);
  const truth = [];
  let hpPrev = 0;
  const kick = (t0) => {
    for (let i = 0; i < 0.25 * SR; i++) {
      const t = i / SR;
      x[t0 + i] += 0.9 * Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-t * 30)) * t) * Math.exp(-t * 12);
    }
  };
  const snare = (t0) => {
    for (let i = 0; i < 0.2 * SR; i++) {
      const t = i / SR;
      x[t0 + i] += 0.6 * (rng() * 2 - 1) * Math.exp(-t * 25) + 0.3 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30);
    }
  };
  const hat = (t0) => {
    for (let i = 0; i < 0.05 * SR; i++) {
      const t = i / SR;
      const w = rng() * 2 - 1;
      x[t0 + i] += 0.3 * (w - hpPrev) * Math.exp(-t * 80);
      hpPrev = w;
    }
  };
  for (let step = 0; step < secs / (beat / 4); step++) {
    const t = step * beat / 4;
    const t0 = Math.round(t * SR);
    const s = step % 16;
    if (s === 0 || s === 6 || s === 10) { kick(t0); truth.push(t); }
    else if (s === 4 || s === 12) { snare(t0); truth.push(t); }
    else if (s % 2 === 0) { hat(t0); truth.push(t); }
  }
  const pts = S.detectTransients(x, SR, { sensitivity: 50, minSliceMs: 30 });
  let hits = 0;
  for (const t of truth) {
    let best = Infinity;
    for (const p of pts) best = Math.min(best, Math.abs(ms(p - t * SR)));
    if (best <= 5) hits++;
  }
  assert.ok(hits >= Math.floor(truth.length * 0.95), `only ${hits}/${truth.length} hits found`);
  assert.ok(pts.length <= truth.length * 1.2, `${pts.length} points for ${truth.length} hits`);
  // and the tempo is recovered from the same loop
  const bpmEst = S.estimateBpm(x, SR);
  assert.ok(bpmEst !== null && Math.abs(bpmEst - 120) <= 2, `bpm ${bpmEst}`);
});

test('detectTransients: higher sensitivity never gives fewer slices', () => {
  const signals = [];
  {
    // exponentially fading hits
    const rng = mulberry32(31);
    const x = silence(5);
    for (let k = 0; k < 12; k++) addBurst(x, 0.3 + 0.4 * k, 0.9 * Math.pow(0.55, k), 0.03, rng);
    signals.push({ name: 'fading', x, strict: true });
  }
  {
    // random hits of random loudness over a noise floor
    const rng = mulberry32(32);
    const x = silence(6);
    addNoise(x, 0.003, rng);
    let t = 0.2;
    while (t < 5.5) {
      addBurst(x, t, 0.05 + 0.9 * rng(), 0.01 + 0.04 * rng(), rng);
      t += 0.07 + 0.5 * rng();
    }
    signals.push({ name: 'random', x, strict: true });
  }
  {
    // dense clicks
    const x = silence(4);
    const rng = mulberry32(33);
    for (let t = 0.05; t < 3.9; t += 0.02 + 0.1 * rng()) addClick(x, t, 0.1 + 0.8 * rng());
    signals.push({ name: 'dense', x, strict: false });
  }
  {
    // noise only
    const rng = mulberry32(34);
    const x = silence(5);
    addNoise(x, 0.3, rng);
    signals.push({ name: 'noise', x, strict: false });
  }
  for (const sig of signals) {
    const counts = [];
    for (let s = 0; s <= 100; s += 5) {
      counts.push(S.detectTransients(sig.x, SR, { sensitivity: s, minSliceMs: 30 }).length);
    }
    for (let i = 1; i < counts.length; i++) {
      assert.ok(counts[i] >= counts[i - 1], `${sig.name}: counts not monotonic: ${counts}`);
    }
    if (sig.strict) {
      assert.ok(counts[counts.length - 1] > counts[0], `${sig.name}: sensitivity has no effect: ${counts}`);
    }
  }
});

test('detectTransients: sensitivity 0 is selective, 100 is permissive (fading hits)', () => {
  const rng = mulberry32(35);
  const x = silence(5);
  for (let k = 0; k < 12; k++) addBurst(x, 0.3 + 0.4 * k, 0.9 * Math.pow(0.55, k), 0.03, rng);
  const low = S.detectTransients(x, SR, { sensitivity: 0 }).length;
  const mid = S.detectTransients(x, SR, { sensitivity: 50 }).length;
  const high = S.detectTransients(x, SR, { sensitivity: 100 }).length;
  assert.ok(low < mid && mid <= high, `${low} ${mid} ${high}`);
  assert.ok(low >= 2, 'the loudest hits are still found at sensitivity 0');
});

test('detectTransients: minSliceMs is respected (also from sample start)', () => {
  const rng = mulberry32(41);
  const x = silence(3);
  // a hit every 20 ms, plus an early one at 25 ms
  for (let t = 0.025; t < 2.5; t += 0.02) addBurst(x, t, 0.7, 0.004, rng, SR, 0.05);
  for (const minMs of [10, 30, 50, 120]) {
    const pts = S.detectTransients(x, SR, { sensitivity: 100, minSliceMs: minMs });
    const minFrames = Math.round(minMs * SR / 1000);
    assert.equal(pts[0], 0);
    assertSortedUniqueInts(pts);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i] - pts[i - 1] >= minFrames, `minSlice ${minMs} ms violated: gap ${ms(pts[i] - pts[i - 1]).toFixed(1)} ms`);
    }
  }
  const few = S.detectTransients(x, SR, { sensitivity: 100, minSliceMs: 120 }).length;
  const many = S.detectTransients(x, SR, { sensitivity: 100, minSliceMs: 10 }).length;
  assert.ok(many > few, `${many} should exceed ${few}`);
});

test('detectTransients: maxSlices limits the count and keeps the strongest', () => {
  const rng = mulberry32(42);
  const x = silence(8);
  const loud = [];
  for (let k = 0; k < 40; k++) {
    const t = 0.2 + 0.19 * k;
    const isLoud = k % 4 === 0;
    if (isLoud) loud.push(t);
    addBurst(x, t, isLoud ? 0.9 : 0.04, 0.02, rng, SR, 0.15);
  }
  const all = S.detectTransients(x, SR, { sensitivity: 100, maxSlices: 1000 });
  assert.ok(all.length > 30, `expected many slices, got ${all.length}`);
  const capped = S.detectTransients(x, SR, { sensitivity: 100, maxSlices: loud.length + 1 });
  assert.equal(capped.length, loud.length + 1);
  assert.equal(capped[0], 0);
  assertDetected(capped, loud, 5);
  assert.deepEqual(S.detectTransients(x, SR, { sensitivity: 100, maxSlices: 1 }), [0]);
  const five = S.detectTransients(x, SR, { sensitivity: 100, maxSlices: 5 });
  assert.equal(five.length, 5);
});

test('detectTransients: default maxSlices is 128', () => {
  const x = silence(20);
  for (let t = 0.1; t < 19.8; t += 0.05) addClick(x, t, 0.8);
  const pts = S.detectTransients(x, SR, { sensitivity: 100 });
  assert.ok(pts.length <= 128, `got ${pts.length}`);
  assert.ok(pts.length >= 120, `got ${pts.length}`);
});

test('detectTransients: default options and determinism', () => {
  const rng = mulberry32(43);
  const x = silence(3);
  [0.4, 1.2, 2.0].forEach((t) => addBurst(x, t, 0.8, 0.03, rng));
  const a = S.detectTransients(x, SR);
  const b = S.detectTransients(x, SR, {});
  const c = S.detectTransients(x, SR, { sensitivity: 50, minSliceMs: 30, maxSlices: 128 });
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.equal(a.length, 4);
});

// ------------------------------------------------------------------ beatPoints / regionPoints

test('beatPoints: quarter notes at 120 BPM', () => {
  const frames = 4 * SR;
  const pts = S.beatPoints(frames, SR, { bpm: 120, beatDiv: '1/4' });
  assert.deepEqual(pts, [0, 22050, 44100, 66150, 88200, 110250, 132300, 154350]);
});

test('beatPoints: all BEAT_DIVS give the expected grid', () => {
  const frames = 30 * SR;
  S.BEAT_DIVS.forEach((div, i) => {
    const spacing = S.BEAT_DIV_BEATS[i] * 0.5 * SR; // 120 BPM: a beat = 0.5 s
    const pts = S.beatPoints(frames, SR, { bpm: 120, beatDiv: div });
    assert.equal(pts[0], 0, div);
    assertSortedUniqueInts(pts);
    for (let k = 0; k < pts.length; k++) {
      assert.ok(Math.abs(pts[k] - k * spacing) <= 1, `${div}: point ${k} = ${pts[k]}, expected ${k * spacing}`);
      assert.ok(pts[k] < frames);
    }
    assert.equal(pts.length, Math.ceil(frames / spacing - 1e-9), div);
  });
});

test('beatPoints: bar divisions, triplets and tempo scaling', () => {
  assert.deepEqual(S.beatPoints(5 * 88200, SR, { bpm: 120, beatDiv: '1 Bar' }).slice(0, 3), [0, 88200, 176400]);
  const trip = S.beatPoints(SR, SR, { bpm: 90, beatDiv: '1/8T' }); // 1/3 beat at 90 BPM = 0.2222 s
  assert.equal(trip[1], Math.round(SR * 60 / 90 / 3));
  const slow = S.beatPoints(10 * SR, SR, { bpm: 60, beatDiv: '1/4' });
  assert.equal(slow[1], SR);
  const fast = S.beatPoints(10 * SR, SR, { bpm: 240, beatDiv: '1/4' });
  assert.equal(fast[1], Math.round(SR / 4));
});

test('beatPoints: offsetFrames anchors the grid phase and 0 stays first', () => {
  const small = S.beatPoints(2 * SR, SR, { bpm: 120, beatDiv: '1/4', offsetFrames: 1000 });
  assert.deepEqual(small.slice(0, 4), [0, 1000, 23050, 45100]);
  // offset larger than one spacing: the grid also extends backwards
  const big = S.beatPoints(2 * SR, SR, { bpm: 120, beatDiv: '1/4', offsetFrames: 30000 });
  assert.deepEqual(big.slice(0, 4), [0, 7950, 30000, 52050]);
});

test('beatPoints: invalid input falls back sensibly', () => {
  assert.deepEqual(S.beatPoints(0, SR, { bpm: 120, beatDiv: '1/4' }), []);
  const noBpm = S.beatPoints(SR, SR, { beatDiv: '1/4' });
  assert.equal(noBpm[1], 22050); // 120 BPM default
  const badBpm = S.beatPoints(SR, SR, { bpm: -5, beatDiv: '1/4' });
  assert.equal(badBpm[1], 22050);
  const badDiv = S.beatPoints(SR, SR, { bpm: 120, beatDiv: 'nonsense' });
  assert.equal(badDiv[1], Math.round(0.25 * 0.5 * SR)); // '1/16'
  assert.ok(S.beatPoints(SR, SR).length > 1);
});

test('regionPoints: equal regions', () => {
  assert.deepEqual(S.regionPoints(1000, 4), [0, 250, 500, 750]);
  assert.deepEqual(S.regionPoints(1000, 1), [0]);
  assert.deepEqual(S.regionPoints(1000, 0), [0]);
  assert.deepEqual(S.regionPoints(3, 10), [0, 1, 2]);
  assert.deepEqual(S.regionPoints(0, 4), []);
  const pts = S.regionPoints(100001, 16);
  assert.equal(pts.length, 16);
  assertSortedUniqueInts(pts);
  assert.ok(pts[15] < 100001);
  // region sizes differ by at most one frame
  const sizes = pts.map((p, i) => (i + 1 < pts.length ? pts[i + 1] : 100001) - p);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

// ------------------------------------------------------------------ estimateBpm

function clickTrain(bpm, seconds, sr, seed) {
  const rng = mulberry32(seed || 51);
  const x = new Float32Array(Math.round(seconds * sr));
  const period = 60 / bpm;
  for (let t = 0.1; t < seconds - 0.1; t += period) addBurst(x, t, 0.8, 0.003, rng, sr, 0.015);
  return x;
}

test('estimateBpm: 120 BPM click train', () => {
  const bpm = S.estimateBpm(clickTrain(120, 12, SR), SR);
  assert.ok(bpm !== null && Math.abs(bpm - 120) <= 2, `got ${bpm}`);
});

test('estimateBpm: other tempi and sample rates', () => {
  for (const [tempo, sr] of [[90, 44100], [100, 48000], [128, 44100], [140, 96000], [75, 44100], [160, 44100]]) {
    const bpm = S.estimateBpm(clickTrain(tempo, 12, sr), sr);
    assert.ok(bpm !== null && Math.abs(bpm - tempo) <= 2, `tempo ${tempo} @ ${sr}: got ${bpm}`);
  }
});

test('estimateBpm: single-sample clicks and a custom range', () => {
  const x = silence(10);
  for (let t = 0.2; t < 9.8; t += 1.0) addClick(x, t, 0.9);
  const bpm = S.estimateBpm(x, SR, { minBpm: 50, maxBpm: 100 });
  assert.ok(bpm !== null && Math.abs(bpm - 60) <= 2, `got ${bpm}`);
});

test('estimateBpm: irregular noise, silence and too-short input give null', () => {
  const rng = mulberry32(52);
  const noise = silence(10);
  addNoise(noise, 0.3, rng);
  assert.equal(S.estimateBpm(noise, SR), null);
  assert.equal(S.estimateBpm(silence(10), SR), null);
  assert.equal(S.estimateBpm(new Float32Array(0), SR), null);
  assert.equal(S.estimateBpm(clickTrain(120, 0.8, SR), SR), null);
  // random, aperiodic hits
  const x = silence(12);
  let t = 0.2;
  while (t < 11.5) {
    addBurst(x, t, 0.8, 0.003, rng, SR, 0.015);
    t += 0.15 + 0.9 * rng();
  }
  const est = S.estimateBpm(x, SR);
  assert.ok(est === null || (est >= 70 && est <= 180));
});

// ------------------------------------------------------------------ snapToZeroCrossings

test('snapToZeroCrossings: points on a sine land on sign changes', () => {
  const f = 100;
  const x = new Float32Array(SR);
  for (let i = 0; i < x.length; i++) x[i] = Math.sin(2 * Math.PI * f * i / SR);
  const pts = [0, 3000, 9876, 20001, 33333, 44000];
  const maxSearch = 150;
  const out = S.snapToZeroCrossings(x, pts, maxSearch);
  assert.equal(out.length, pts.length);
  assert.equal(out[0], 0);
  assertSortedUniqueInts(out);
  out.forEach((p, i) => {
    if (i === 0) return;
    assert.ok(Math.abs(p - pts[i]) <= maxSearch, `moved too far: ${pts[i]} -> ${p}`);
    const crossing = x[p] === 0 || x[p - 1] * x[p] < 0;
    assert.ok(crossing, `no sign change at ${p}: ${x[p - 1]}, ${x[p]}`);
    // it is the nearest crossing: half a period is 220.5 samples, so |x| is tiny
    assert.ok(Math.abs(x[p]) < 0.03);
  });
});

test('snapToZeroCrossings: search window, ties, no crossing, duplicates, ordering', () => {
  const x = Float32Array.from([1, 1, -1, -1, -1, -1, 1, 1, 1, 1]);
  // crossings at index 2 (1 -> -1) and 6 (-1 -> 1)
  assert.deepEqual(S.snapToZeroCrossings(x, [4], 2), [2]); // tie: the earlier side wins
  assert.deepEqual(S.snapToZeroCrossings(x, [5], 2), [6]);
  assert.deepEqual(S.snapToZeroCrossings(x, [4], 1), [4]); // out of range: unchanged
  assert.deepEqual(S.snapToZeroCrossings(x, [4], 0), [4]);
  assert.deepEqual(S.snapToZeroCrossings(x, [2], 3), [2]); // already on a crossing
  // exact zero sample counts
  const z = Float32Array.from([0.5, 0.5, 0, 0.5, 0.5]);
  assert.deepEqual(S.snapToZeroCrossings(z, [3], 5), [2]);
  // DC offset: no sign change anywhere
  const dc = new Float32Array(100).map(() => 0.5);
  assert.deepEqual(S.snapToZeroCrossings(dc, [10, 50], 20), [10, 50]);
  // 0 is kept, snapping never moves a point to 0
  assert.deepEqual(S.snapToZeroCrossings(x, [0, 3], 5)[0], 0);
  assert.ok(S.snapToZeroCrossings(x, [1], 5)[0] >= 1);
  // duplicates collapse and the result is sorted
  assert.deepEqual(S.snapToZeroCrossings(x, [6, 5, 2, 3, 7, 5], 3), [2, 6]);
  assert.deepEqual(S.snapToZeroCrossings(x, [], 3), []);
});

// ------------------------------------------------------------------ pointsToRanges

test('pointsToRanges: basic cases', () => {
  assert.deepEqual(S.pointsToRanges([0], 100, 1), [{ start: 0, end: 100 }]);
  assert.deepEqual(S.pointsToRanges([], 100, 10), [{ start: 0, end: 100 }]);
  assert.deepEqual(S.pointsToRanges([0, 40, 70], 100, 10), [
    { start: 0, end: 40 }, { start: 40, end: 70 }, { start: 70, end: 100 }
  ]);
  // a point lacking the 0 start still covers [0, total)
  assert.deepEqual(S.pointsToRanges([40], 100, 10), [{ start: 0, end: 40 }, { start: 40, end: 100 }]);
  assert.deepEqual(S.pointsToRanges([0, 10], 0, 1), []);
});

test('pointsToRanges: too-close points are dropped, last short range merges backwards', () => {
  // 15 is closer than 10 to the kept 10? no: 15 - 10 = 5 < 10 -> dropped
  assert.deepEqual(S.pointsToRanges([0, 10, 15, 100], 200, 10), [
    { start: 0, end: 10 }, { start: 10, end: 100 }, { start: 100, end: 200 }
  ]);
  // dropping is relative to the previous *kept* point, so chains do not cascade
  assert.deepEqual(S.pointsToRanges([0, 6, 12, 18], 100, 10).map((r) => r.start), [0, 12]);
  // last range of 5 < 10 frames merges into the previous one
  assert.deepEqual(S.pointsToRanges([0, 50, 95], 100, 10), [{ start: 0, end: 50 }, { start: 50, end: 100 }]);
  // input is sorted / deduplicated / rounded first, out-of-range points ignored
  assert.deepEqual(S.pointsToRanges([60, 20.2, 20, 20, 500, -5, 100], 100, 10), [
    { start: 0, end: 20 }, { start: 20, end: 60 }, { start: 60, end: 100 }
  ]);
  // shorter than minFrames overall: one range
  assert.deepEqual(S.pointsToRanges([0, 3], 8, 10), [{ start: 0, end: 8 }]);
});

test('pointsToRanges: invariants on random input', () => {
  const rng = mulberry32(61);
  for (let trial = 0; trial < 300; trial++) {
    const total = 1 + Math.floor(rng() * 5000);
    const minFrames = 1 + Math.floor(rng() * 200);
    const count = Math.floor(rng() * 40);
    const pts = [];
    for (let i = 0; i < count; i++) pts.push((rng() * 1.2 - 0.1) * total); // some out of range, fractional
    const ranges = S.pointsToRanges(pts, total, minFrames);
    assertRanges(ranges, total, minFrames);
    const set = new Set(pts.map((p) => Math.round(p)).concat([0]));
    ranges.forEach((r) => assert.ok(set.has(r.start), `start ${r.start} was not an input point`));
  }
});

// ------------------------------------------------------------------ sliceSource

test('sliceSource: manual mode returns the whole file as one range', () => {
  const x = new Float32Array(12345);
  assert.deepEqual(S.sliceSource(x, SR, { mode: 'manual' }), [{ start: 0, end: 12345 }]);
});

test('sliceSource: empty input gives no ranges', () => {
  assert.deepEqual(S.sliceSource(new Float32Array(0), SR, { mode: 'transient' }), []);
  assert.deepEqual(S.sliceSource(new Float32Array(0), SR, { mode: 'manual' }), []);
});

test('sliceSource: region mode', () => {
  const x = new Float32Array(80000);
  const r = S.sliceSource(x, SR, { mode: 'region', regions: 8, minSliceMs: 30, snap: false });
  assert.equal(r.length, 8);
  assertRanges(r, 80000, Math.round(0.03 * SR));
  r.forEach((q) => assert.equal(q.end - q.start, 10000));
  // default region count
  assert.equal(S.sliceSource(x, SR, { mode: 'region', snap: false }).length, 16);
});

test('sliceSource: region mode respects minSliceMs', () => {
  const x = new Float32Array(SR); // 1 s
  const r = S.sliceSource(x, SR, { mode: 'region', regions: 128, minSliceMs: 100, snap: false });
  assertRanges(r, SR, Math.round(0.1 * SR));
  assert.ok(r.length <= 10);
});

test('sliceSource: beat mode on a given bpm', () => {
  const x = new Float32Array(4 * SR);
  const r = S.sliceSource(x, SR, { mode: 'beat', bpm: 120, beatDiv: '1/4', minSliceMs: 30, snap: false });
  assert.equal(r.length, 8);
  assertRanges(r, 4 * SR, Math.round(0.03 * SR));
  r.forEach((q) => assert.equal(q.end - q.start, 22050));
  const r16 = S.sliceSource(x, SR, { mode: 'beat', bpm: 120, beatDiv: '1/16', minSliceMs: 30, snap: false });
  assert.equal(r16.length, 32);
  // minSliceMs larger than a slice thins the grid out
  const thin = S.sliceSource(x, SR, { mode: 'beat', bpm: 120, beatDiv: '1/16', minSliceMs: 200, snap: false });
  assertRanges(thin, 4 * SR, Math.round(0.2 * SR));
  assert.ok(thin.length < 32);
});

test('sliceSource: beat mode with snap moves boundaries by at most 2 ms onto zero crossings', () => {
  const x = new Float32Array(4 * SR);
  for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * 441.7 * i / SR + 0.3);
  const r = S.sliceSource(x, SR, { mode: 'beat', bpm: 120, beatDiv: '1/4', minSliceMs: 30, snap: true });
  assertRanges(r, 4 * SR, Math.round(0.03 * SR));
  r.forEach((q, i) => {
    if (i === 0) return;
    const ideal = i * 22050;
    assert.ok(Math.abs(q.start - ideal) <= Math.round(0.002 * SR), `boundary ${i} moved ${q.start - ideal}`);
    assert.ok(x[q.start - 1] * x[q.start] <= 0, `boundary ${i} is not at a sign change`);
  });
});

test('sliceSource: beat mode with bpm 0 estimates the tempo, 120 when there is none', () => {
  const x = clickTrain(100, 12, SR, 71);
  const r = S.sliceSource(x, SR, { mode: 'beat', bpm: 0, beatDiv: '1/4', minSliceMs: 30, snap: false });
  const est = S.estimateBpm(x, SR);
  const spacing = 60 / est * SR;
  assert.ok(Math.abs(spacing - 0.6 * SR) < 0.02 * SR, `estimated spacing ${spacing}`);
  assert.ok(Math.abs(r[1].start - spacing) <= 1);
  // nothing to estimate: fallback to 120 BPM
  const quiet = new Float32Array(4 * SR);
  const f = S.sliceSource(quiet, SR, { mode: 'beat', bpm: 0, beatDiv: '1/4', minSliceMs: 30, snap: false });
  assert.equal(f.length, 8);
  assert.equal(f[1].start, 22050);
});

test('sliceSource: transient mode slices clicks and covers the whole file', () => {
  const times = [0.3, 0.8, 1.3, 1.9, 2.4];
  const x = silence(3);
  for (const t of times) addClick(x, t, 0.9);
  const settings = { mode: 'transient', sensitivity: 50, minSliceMs: 30, snap: false };
  const r = S.sliceSource(x, SR, settings);
  assertRanges(r, x.length, Math.round(0.03 * SR));
  assert.equal(r.length, times.length + 1);
  assertDetected(r.map((q) => q.start), times, 5);
  // snapped: every boundary sits on a zero sample / sign change, within 2 ms of the unsnapped one
  const snapped = S.sliceSource(x, SR, Object.assign({}, settings, { snap: true }));
  assertRanges(snapped, x.length, Math.round(0.03 * SR));
  assert.equal(snapped.length, r.length);
  snapped.forEach((q, i) => {
    if (i === 0) return;
    assert.ok(Math.abs(q.start - r[i].start) <= Math.round(0.002 * SR));
    assert.ok(x[q.start] === 0 || x[q.start - 1] * x[q.start] < 0, `boundary ${i} not at a zero crossing`);
  });
});

test('sliceSource: sensitivity and minSliceMs are honoured through the pipeline', () => {
  const rng = mulberry32(81);
  const x = silence(5);
  for (let k = 0; k < 12; k++) addBurst(x, 0.3 + 0.4 * k, 0.9 * Math.pow(0.55, k), 0.03, rng);
  const low = S.sliceSource(x, SR, { mode: 'transient', sensitivity: 0, minSliceMs: 30, snap: true });
  const high = S.sliceSource(x, SR, { mode: 'transient', sensitivity: 100, minSliceMs: 30, snap: true });
  assert.ok(high.length > low.length);
  assertRanges(low, x.length, Math.round(0.03 * SR));
  assertRanges(high, x.length, Math.round(0.03 * SR));
  const wide = S.sliceSource(x, SR, { mode: 'transient', sensitivity: 100, minSliceMs: 500, snap: true });
  assertRanges(wide, x.length, Math.round(0.5 * SR));
  assert.ok(wide.length < high.length);
});

test('sliceSource: silence is one slice, missing settings do not throw', () => {
  const r = S.sliceSource(silence(2), SR, { mode: 'transient', sensitivity: 100, minSliceMs: 30, snap: true });
  assert.deepEqual(r, [{ start: 0, end: 2 * SR }]);
  const d = S.sliceSource(silence(1), SR, undefined);
  assert.deepEqual(d, [{ start: 0, end: SR }]);
  const rng = mulberry32(82);
  const x = silence(2);
  addBurst(x, 0.5, 0.8, 0.05, rng);
  const dd = S.sliceSource(x, SR, {});
  assertRanges(dd, x.length, Math.round(0.03 * SR));
});

// ------------------------------------------------------------------ overview

test('overview: length, bounds and exactness against brute force', () => {
  const rng = mulberry32(91);
  const n = 10007;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = rng() * 2 - 1;
  for (const cols of [1, 7, 64, 512]) {
    const o = S.overview(x, cols);
    assert.ok(o instanceof Float32Array);
    assert.equal(o.length, 2 * cols);
    let gmin = Infinity;
    let gmax = -Infinity;
    for (let c = 0; c < cols; c++) {
      const a = Math.floor(c * n / cols);
      const b = Math.floor((c + 1) * n / cols);
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = a; i < b; i++) { mn = Math.min(mn, x[i]); mx = Math.max(mx, x[i]); }
      assert.equal(o[2 * c], mn, `min of column ${c}/${cols}`);
      assert.equal(o[2 * c + 1], mx, `max of column ${c}/${cols}`);
      assert.ok(o[2 * c] <= o[2 * c + 1]);
      gmin = Math.min(gmin, o[2 * c]);
      gmax = Math.max(gmax, o[2 * c + 1]);
    }
    let xmin = Infinity;
    let xmax = -Infinity;
    for (let i = 0; i < n; i++) { xmin = Math.min(xmin, x[i]); xmax = Math.max(xmax, x[i]); }
    assert.equal(gmin, xmin);
    assert.equal(gmax, xmax);
  }
});

test('overview: a spike shows up in its own column; constant and short signals', () => {
  const x = new Float32Array(1000);
  x[555] = 0.9;
  x[100] = -0.7;
  const o = S.overview(x, 10);
  assert.equal(o[2 * 5 + 1], Math.fround(0.9));
  assert.equal(o[2 * 1], Math.fround(-0.7));
  assert.equal(o[2 * 7 + 1], 0);
  const c = S.overview(new Float32Array(100).map(() => 0.25), 8);
  for (let i = 0; i < 16; i++) assert.equal(c[i], 0.25);
  // fewer samples than columns: each column still gets a real sample
  const few = S.overview(Float32Array.from([0.1, -0.2, 0.3]), 8);
  assert.equal(few.length, 16);
  for (let i = 0; i < 8; i++) {
    assert.ok(few[2 * i] <= few[2 * i + 1]);
    assert.ok([0.1, -0.2, 0.3].some((v) => Math.fround(v) === few[2 * i]));
  }
  assert.equal(few[0], Math.fround(0.1));
  assert.equal(few[14], Math.fround(0.3));
  // empty input
  const e = S.overview(new Float32Array(0), 4);
  assert.deepEqual(Array.from(e), [0, 0, 0, 0, 0, 0, 0, 0]);
});

// ------------------------------------------------------------------ performance

test('performance: 60 s of noise is analysed in well under 15 s', () => {
  const rng = mulberry32(99);
  const x = new Float32Array(60 * SR);
  for (let i = 0; i < x.length; i++) x[i] = (rng() * 2 - 1) * 0.5;
  const t0 = Date.now();
  const pts = S.detectTransients(x, SR, { sensitivity: 100 });
  const ranges = S.sliceSource(x, SR, { mode: 'transient', sensitivity: 100, minSliceMs: 30, snap: true });
  S.estimateBpm(x, SR);
  const ov = S.overview(x, 512);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 15000, `took ${elapsed} ms`);
  assert.ok(pts.length <= 128);
  assertRanges(ranges, x.length, Math.round(0.03 * SR));
  assert.equal(ov.length, 1024);
});
