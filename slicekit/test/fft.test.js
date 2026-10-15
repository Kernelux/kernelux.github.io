'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fft, hann, magnitudeSpectrum } = require('../core/fft');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function naiveDft(re, im) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < n; t++) {
      const a = -2 * Math.PI * k * t / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      sr += re[t] * c - im[t] * s;
      si += re[t] * s + im[t] * c;
    }
    outRe[k] = sr;
    outIm[k] = si;
  }
  return { re: outRe, im: outIm };
}

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

test('fft: impulse gives a flat unit spectrum', () => {
  for (const n of [2, 4, 8, 64, 1024]) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re[0] = 1;
    fft(re, im);
    for (let k = 0; k < n; k++) {
      assert.ok(Math.abs(re[k] - 1) < 1e-12, `re[${k}] for n=${n}`);
      assert.ok(Math.abs(im[k]) < 1e-12, `im[${k}] for n=${n}`);
    }
  }
});

test('fft: delayed impulse gives a pure phase ramp', () => {
  const n = 32;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re[3] = 1;
  fft(re, im);
  for (let k = 0; k < n; k++) {
    const a = -2 * Math.PI * k * 3 / n;
    assert.ok(Math.abs(re[k] - Math.cos(a)) < 1e-12);
    assert.ok(Math.abs(im[k] - Math.sin(a)) < 1e-12);
  }
});

test('fft: constant signal concentrates in bin 0', () => {
  const n = 128;
  const re = new Float64Array(n).map(() => 0.25);
  const im = new Float64Array(n);
  fft(re, im);
  assert.ok(Math.abs(re[0] - n * 0.25) < 1e-10);
  for (let k = 1; k < n; k++) {
    assert.ok(Math.abs(re[k]) < 1e-10);
    assert.ok(Math.abs(im[k]) < 1e-10);
  }
});

test('fft: cosine at bin k gives peaks at k and N-k of amplitude N/2', () => {
  const n = 256;
  const k0 = 17;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.cos(2 * Math.PI * k0 * i / n);
  fft(re, im);
  for (let k = 0; k < n; k++) {
    const mag = Math.hypot(re[k], im[k]);
    if (k === k0 || k === n - k0) assert.ok(Math.abs(mag - n / 2) < 1e-9, `peak ${k}`);
    else assert.ok(mag < 1e-9, `bin ${k} should be empty, got ${mag}`);
  }
});

test('fft: matches a naive DFT on random complex input (Float64Array)', () => {
  const rng = mulberry32(7);
  for (const n of [1, 2, 4, 8, 16, 32, 64, 256]) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) { re[i] = rng() * 2 - 1; im[i] = rng() * 2 - 1; }
    const ref = naiveDft(re, im);
    fft(re, im);
    assert.ok(maxAbsDiff(re, ref.re) < 1e-9, `re mismatch n=${n}`);
    assert.ok(maxAbsDiff(im, ref.im) < 1e-9, `im mismatch n=${n}`);
  }
});

test('fft: works on Float32Array input (single precision tolerance)', () => {
  const rng = mulberry32(8);
  const n = 128;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) { re[i] = rng() * 2 - 1; im[i] = rng() * 2 - 1; }
  const ref = naiveDft(re, im);
  fft(re, im);
  assert.ok(maxAbsDiff(re, ref.re) < 1e-3);
  assert.ok(maxAbsDiff(im, ref.im) < 1e-3);
});

test('fft: Parseval, sum |x|^2 = (1/N) sum |X|^2', () => {
  const rng = mulberry32(9);
  const n = 512;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let e = 0;
  for (let i = 0; i < n; i++) {
    re[i] = rng() * 2 - 1;
    im[i] = rng() * 2 - 1;
    e += re[i] * re[i] + im[i] * im[i];
  }
  fft(re, im);
  let f = 0;
  for (let k = 0; k < n; k++) f += re[k] * re[k] + im[k] * im[k];
  assert.ok(Math.abs(e - f / n) < 1e-9 * e);
});

test('fft: inverse via conjugation restores the signal', () => {
  const rng = mulberry32(10);
  const n = 1024;
  const orig = new Float64Array(n);
  for (let i = 0; i < n; i++) orig[i] = rng() * 2 - 1;
  const re = Float64Array.from(orig);
  const im = new Float64Array(n);
  fft(re, im);
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(re[i] / n - orig[i]) < 1e-12);
    assert.ok(Math.abs(im[i] / n) < 1e-12);
  }
});

test('fft: repeated calls and interleaved sizes give identical results (cache)', () => {
  const make = (n) => {
    const re = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin(i * 0.37) + (i % 5);
    return { re, im: new Float64Array(n) };
  };
  const a1 = make(64);
  fft(a1.re, a1.im);
  const b1 = make(1024);
  fft(b1.re, b1.im);
  const a2 = make(64);
  fft(a2.re, a2.im);
  const b2 = make(1024);
  fft(b2.re, b2.im);
  assert.deepEqual(Array.from(a1.re), Array.from(a2.re));
  assert.deepEqual(Array.from(a1.im), Array.from(a2.im));
  assert.deepEqual(Array.from(b1.re), Array.from(b2.re));
  assert.deepEqual(Array.from(b1.im), Array.from(b2.im));
});

test('fft: rejects non power-of-two lengths and mismatched arrays', () => {
  assert.throws(() => fft(new Float64Array(12), new Float64Array(12)));
  assert.throws(() => fft(new Float64Array(8), new Float64Array(16)));
});

test('hann: periodic window properties', () => {
  const N = 1024;
  const w = hann(N);
  assert.ok(w instanceof Float32Array);
  assert.equal(w.length, N);
  assert.equal(w[0], 0);
  assert.ok(Math.abs(w[N / 2] - 1) < 1e-6);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    assert.ok(w[i] >= 0 && w[i] <= 1);
    sum += w[i];
  }
  assert.ok(Math.abs(sum - N / 2) < 1e-3);
  // symmetric around N/2: w[i] == w[N-i]
  for (let i = 1; i < N; i++) assert.ok(Math.abs(w[i] - w[N - i]) < 1e-6);
  // rises monotonically up to the centre
  for (let i = 1; i <= N / 2; i++) assert.ok(w[i] >= w[i - 1]);
});

test('magnitudeSpectrum: length N/2+1 and bin-centred sine amplitude', () => {
  const N = 2048;
  const k0 = 100;
  const frame = new Float32Array(N);
  for (let i = 0; i < N; i++) frame[i] = Math.sin(2 * Math.PI * k0 * i / N);

  const rect = magnitudeSpectrum(frame, null);
  assert.ok(rect instanceof Float32Array);
  assert.equal(rect.length, N / 2 + 1);
  assert.ok(Math.abs(rect[k0] - N / 2) < 1e-2);
  assert.ok(rect[k0 + 5] < 1e-2);

  const win = hann(N);
  const hmag = magnitudeSpectrum(frame, win);
  assert.equal(hmag.length, N / 2 + 1);
  // Hann: peak = A * N / 4, neighbours = A * N / 8
  assert.ok(Math.abs(hmag[k0] - N / 4) < 1e-1);
  assert.ok(Math.abs(hmag[k0 + 1] - N / 8) < 1e-1);
  assert.ok(Math.abs(hmag[k0 - 1] - N / 8) < 1e-1);
  assert.ok(hmag[k0 + 4] < 1e-2);

  // peak bin is found at the right place for an arbitrary frequency too
  for (let i = 0; i < N; i++) frame[i] = Math.sin(2 * Math.PI * 37.2 * i / N);
  const m2 = magnitudeSpectrum(frame, win);
  let best = 0;
  for (let k = 1; k < m2.length; k++) if (m2[k] > m2[best]) best = k;
  assert.equal(best, 37);
});

test('magnitudeSpectrum: undefined window == null window, input untouched', () => {
  const N = 256;
  const rng = mulberry32(3);
  const frame = new Float32Array(N);
  for (let i = 0; i < N; i++) frame[i] = rng() - 0.5;
  const copy = Float32Array.from(frame);
  const a = magnitudeSpectrum(frame, null);
  const b = magnitudeSpectrum(frame, undefined);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.deepEqual(Array.from(frame), Array.from(copy));
});

test('magnitudeSpectrum: matches the naive DFT magnitude', () => {
  const N = 64;
  const rng = mulberry32(4);
  const frame = new Float32Array(N);
  for (let i = 0; i < N; i++) frame[i] = rng() * 2 - 1;
  const ref = naiveDft(frame, new Float64Array(N));
  const mag = magnitudeSpectrum(frame, null);
  for (let k = 0; k <= N / 2; k++) {
    assert.ok(Math.abs(mag[k] - Math.hypot(ref.re[k], ref.im[k])) < 1e-4);
  }
});

test('magnitudeSpectrum: optional output buffer is reused', () => {
  const N = 128;
  const frame = new Float32Array(N);
  frame[5] = 1;
  const out = new Float32Array(N / 2 + 1);
  const r = magnitudeSpectrum(frame, null, out);
  assert.equal(r, out);
  assert.ok(Math.abs(out[10] - 1) < 1e-6);
});

test('magnitudeSpectrum: rejects bad sizes and mismatched window', () => {
  assert.throws(() => magnitudeSpectrum(new Float32Array(100), null));
  assert.throws(() => magnitudeSpectrum(new Float32Array(64), hann(32)));
});
