'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const prng = require('../core/prng');

// Reference implementation using Math.imul (not allowed in core/, fine here).
function reference(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seq(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

test('exports the documented API', () => {
  assert.equal(typeof prng.mulberry32, 'function');
  assert.equal(typeof prng.shuffleInPlace, 'function');
  assert.equal(typeof prng.randInt, 'function');
});

test('mulberry32 matches the Math.imul reference for many seeds', () => {
  for (const seed of [0, 1, 2, 7, 42, 1234, 99999, 0x7fffffff, 0x80000000, 0xffffffff]) {
    assert.deepEqual(seq(prng.mulberry32(seed), 2000), seq(reference(seed), 2000), 'seed ' + seed);
  }
});

test('mulberry32 known first values for seed 1', () => {
  const r = prng.mulberry32(1);
  assert.equal(r(), 0.6270739405881613);
  assert.equal(r(), 0.002735721180215478);
  assert.equal(r(), 0.5274470399599522);
});

test('mulberry32 is deterministic per seed and independent per instance', () => {
  const a = prng.mulberry32(5);
  const b = prng.mulberry32(5);
  const first = seq(a, 50);
  // interleave: b must not be affected by a
  assert.deepEqual(seq(b, 50), first);
  assert.notDeepEqual(seq(prng.mulberry32(6), 50), first);
});

test('mulberry32 outputs stay in [0, 1) and look uniform', () => {
  const r = prng.mulberry32(2024);
  let sum = 0;
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, 'out of range: ' + v);
    sum += v;
    buckets[Math.floor(v * 10)]++;
  }
  assert.ok(Math.abs(sum / N - 0.5) < 0.02, 'mean ' + sum / N);
  for (const b of buckets) assert.ok(b > N / 10 * 0.9 && b < N / 10 * 1.1, 'bucket ' + b);
});

test('mulberry32 accepts odd seeds deterministically (negative, fractional, NaN, huge, string)', () => {
  assert.deepEqual(seq(prng.mulberry32(-1), 10), seq(prng.mulberry32(0xffffffff), 10));
  assert.deepEqual(seq(prng.mulberry32(3.9), 10), seq(prng.mulberry32(3), 10));
  assert.deepEqual(seq(prng.mulberry32(NaN), 10), seq(prng.mulberry32(0), 10));
  assert.deepEqual(seq(prng.mulberry32(4294967296 + 9), 10), seq(prng.mulberry32(9), 10));
  assert.deepEqual(seq(prng.mulberry32('12'), 10), seq(prng.mulberry32(12), 10));
  assert.deepEqual(seq(prng.mulberry32(undefined), 10), seq(prng.mulberry32(0), 10));
});

test('randInt returns integers in [0, n)', () => {
  const r = prng.mulberry32(3);
  const seen = {};
  for (let i = 0; i < 2000; i++) {
    const v = prng.randInt(r, 7);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 7, 'v=' + v);
    seen[v] = true;
  }
  assert.equal(Object.keys(seen).length, 7);
});

test('randInt edge cases', () => {
  const r = prng.mulberry32(3);
  assert.equal(prng.randInt(r, 1), 0);
  assert.equal(prng.randInt(r, 0), 0);
  assert.equal(prng.randInt(r, -5), 0);
  assert.equal(prng.randInt(r, NaN), 0);
  assert.equal(prng.randInt(() => 0, 10), 0);
  assert.equal(prng.randInt(() => 0.9999999999, 10), 9);
  // a misbehaving rng returning exactly 1 must not escape the range
  assert.equal(prng.randInt(() => 1, 10), 9);
});

test('shuffleInPlace returns the same array and keeps the elements', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = prng.shuffleInPlace(arr, prng.mulberry32(11));
  assert.equal(out, arr);
  assert.deepEqual(arr.slice().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('shuffleInPlace is deterministic per seed and differs across seeds', () => {
  const mk = () => Array.from({ length: 20 }, (_, i) => i);
  const a = prng.shuffleInPlace(mk(), prng.mulberry32(77));
  const b = prng.shuffleInPlace(mk(), prng.mulberry32(77));
  const c = prng.shuffleInPlace(mk(), prng.mulberry32(78));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.notDeepEqual(a, mk(), 'a 20-element shuffle should not be the identity');
});

test('shuffleInPlace handles empty and single-element arrays without consuming randomness', () => {
  let calls = 0;
  const rng = () => { calls++; return 0.5; };
  assert.deepEqual(prng.shuffleInPlace([], rng), []);
  assert.deepEqual(prng.shuffleInPlace([42], rng), [42]);
  assert.equal(calls, 0);
});

test('shuffleInPlace consumes exactly n-1 random numbers', () => {
  let calls = 0;
  const base = prng.mulberry32(1);
  prng.shuffleInPlace([1, 2, 3, 4, 5, 6], () => { calls++; return base(); });
  assert.equal(calls, 5);
});

test('shuffleInPlace reaches every permutation of 3 elements', () => {
  const seen = {};
  for (let seed = 0; seed < 300; seed++) {
    seen[prng.shuffleInPlace([0, 1, 2], prng.mulberry32(seed)).join('')] = true;
  }
  assert.equal(Object.keys(seen).length, 6);
});

test('shuffleInPlace is unbiased enough (position of element 0 over many seeds)', () => {
  const counts = [0, 0, 0, 0, 0];
  const N = 5000;
  for (let seed = 0; seed < N; seed++) {
    const a = prng.shuffleInPlace([0, 1, 2, 3, 4], prng.mulberry32(seed));
    counts[a.indexOf(0)]++;
  }
  for (const c of counts) assert.ok(c > N / 5 * 0.85 && c < N / 5 * 1.15, 'count ' + c);
});

test('shuffleInPlace works on arrays of objects', () => {
  const objs = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }];
  prng.shuffleInPlace(objs, prng.mulberry32(9));
  assert.deepEqual(objs.map((o) => o.a).sort(), [1, 2, 3, 4]);
});

test('prng.js is ES5-clean (acorn ecmaVersion 5 + banned API scan)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'core', 'prng.js'), 'utf8');
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* optional */ }
  if (acorn) acorn.parse(src, { ecmaVersion: 5 });
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\bMath\.imul\b/, /=>/, /\blet\b/, /\bconst\b/, /`/, /\bclass\b/, /\bObject\.assign\b/, /\bnew\s+(Map|Set)\b/, /\.includes\(/]) {
    assert.ok(!re.test(code), 'banned construct ' + re);
  }
});
