'use strict';
/*
 * Tests for core/voice-sim.js (JS reference of the gen~ voice) and for the
 * faithfulness of max/voice.genexpr.
 *
 * Max is not available here, so the GenExpr file is
 *   1. linted against the GenExpr rules we rely on (block scope, History
 *      usage, allowed operators, reserved names, declarations first, ...), and
 *   2. compiled to JavaScript by a tiny GenExpr -> JS translator and run
 *      sample by sample against the simulation on scripted and random
 *      scenarios ("parity" tests).
 * Run: cd slicekit && node --test test/voice-sim.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const VoiceSim = require('../core/voice-sim.js');

const SR = 44100;
const GENEXPR_FILE = path.join(__dirname, '..', 'max', 'voice.genexpr');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function rampBuffer(n, sr) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) { b[i] = i / n; }
  return { channels: [b], sr: sr || SR };
}

function constBuffer(n, value, sr) {
  const b = new Float32Array(n);
  b.fill(value);
  return { channels: [b], sr: sr || SR };
}

function sineBuffer(n, freq, amp, sr) {
  const rate = sr || SR;
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) { b[i] = amp * Math.sin(2 * Math.PI * freq * i / rate); }
  return { channels: [b], sr: rate };
}

function make(buffer, params, opts) {
  const sim = VoiceSim.create({
    sampleRate: (opts && opts.sampleRate) || SR,
    buffer: buffer,
    log: true
  });
  const keys = Object.keys(params || {});
  for (let i = 0; i < keys.length; i++) { sim.set(keys[i], params[keys[i]]); }
  return sim;
}

/** host beat phase: spb samples per beat, `offset` samples into the beat at k = 0 */
function hostPhase(spb, offset) {
  return function (i, k) { return ((k + (offset || 0)) % spb) / spb; };
}

function rms(arr, from, to) {
  let s = 0;
  for (let i = from; i < to; i++) { s += arr[i] * arr[i]; }
  return Math.sqrt(s / (to - from));
}

function maxAbsDiff(a, b) {
  let m = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m || d !== d) { m = d; }
  }
  return m;
}

function maxStep(arr, from, to) {
  let m = 0;
  for (let i = from + 1; i < to; i++) { m = Math.max(m, Math.abs(arr[i] - arr[i - 1])); }
  return m;
}

function firstIndex(arr, from, pred) {
  for (let i = from; i < arr.length; i++) { if (pred(arr[i], i)) { return i; } }
  return -1;
}

function eventsOf(sim, type) {
  return sim.events.filter(function (e) { return e.type === type; });
}

function close(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol,
    (msg || 'value') + ': ' + actual + ' vs expected ' + expected + ' (tol ' + tol + ')');
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// playback
// ---------------------------------------------------------------------------

test('idle voice is silent and inactive; trig starts it (active 1 from the trig sample)', () => {
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 5000 });
  const a = sim.process(100);
  assert.ok(a.active.every(v => v === 0));
  assert.ok(a.left.every(v => v === 0) && a.right.every(v => v === 0));
  sim.set('trig', 1);
  const b = sim.process(10);
  assert.equal(b.active[0], 1);
  assert.equal(b.pos[0], 1000);
});

test('forward play reads the expected samples and stops at pend', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 1000, pend: 5000, dir: 1, trig: 1 });
  const r = sim.process(6000);
  for (let n = 100; n < 3800; n++) {
    close(r.left[n], (1000 + n) / N, 2e-6, 'left[' + n + ']');
    assert.equal(r.right[n], r.left[n], 'mono duplicated to right');
  }
  assert.equal(r.active[3999], 1);
  assert.equal(r.active[4000], 0);
  for (let n = 4000; n < 6000; n++) { assert.equal(r.left[n], 0); }
  let maxPos = 0;
  for (let n = 0; n < 4000; n++) { maxPos = Math.max(maxPos, r.pos[n]); }
  assert.ok(maxPos < 5000, 'never reads at or beyond pend');
  const end = eventsOf(sim, 'end');
  assert.equal(end.length, 1);
  assert.equal(end[0].n, 4000);
});

test('reverse play reads the expected samples and stops at pend', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 5000, pend: 1000, dir: -1, trig: 1 });
  const r = sim.process(6000);
  for (let n = 100; n < 3800; n++) { close(r.left[n], (5000 - n) / N, 2e-6, 'left[' + n + ']'); }
  assert.equal(r.active[3999], 1);
  assert.equal(r.active[4000], 0);
  let minPos = 1e9;
  for (let n = 0; n < 4000; n++) { minPos = Math.min(minPos, r.pos[n]); }
  assert.ok(minPos > 1000, 'never reads at or beyond pend');
});

test('no click at the end: the last samples ramp to ~0 (and start is faded in)', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 10000, pend: 14000, trig: 1 });
  const r = sim.process(5000);
  // ramp value is ~0.5..0.7 here, so a hard stop would be a jump of ~0.7
  assert.ok(Math.abs(r.left[3999]) < 0.01, 'last sample ~0, got ' + r.left[3999]);
  assert.ok(Math.abs(r.left[0]) < 0.02, 'first sample ~0, got ' + r.left[0]);
  assert.ok(maxStep(r.left, 0, 4001) < 0.02, 'no big step anywhere');
  // monotonic fade over the last 2 ms (88 samples)
  for (let n = 3925; n < 3999; n++) { assert.ok(r.left[n + 1] <= r.left[n] + 1e-7, 'monotonic fade at ' + n); }
  assert.ok(r.left[3900] > 0.6 * r.left[3800], 'fade does not start earlier than 2 ms');
});

test('pitch: +12 doubles the speed, -12 halves it, +7 is 2^(7/12)', () => {
  const N = 20000;
  let sim = make(rampBuffer(N), { pstart: 1000, pend: 5000, pitch: 12, trig: 1 });
  let r = sim.process(2500);
  for (let n = 100; n < 1800; n++) { close(r.left[n], (1000 + 2 * n) / N, 3e-6, 'pitch+12 left[' + n + ']'); }
  assert.equal(r.active[1999], 1);
  assert.equal(r.active[2000], 0);
  sim = make(rampBuffer(N), { pstart: 1000, pend: 5000, pitch: -12, trig: 1 });
  r = sim.process(9000);
  for (let n = 100; n < 7000; n += 7) { close(r.left[n], (1000 + 0.5 * n) / N, 3e-6, 'pitch-12 left[' + n + ']'); }
  sim = make(rampBuffer(N), { pstart: 1000, pend: 5000, pitch: 7, trig: 1 });
  r = sim.process(2000);
  const f = Math.pow(2, 7 / 12);
  for (let n = 100; n < 1500; n += 11) { close(r.left[n], (1000 + f * n) / N, 3e-6, 'pitch+7 left[' + n + ']'); }
});

test('bufsr and sample rate scale the speed', () => {
  const N = 20000;
  // buffer recorded at 22050 played at 44100: half speed
  let sim = make(rampBuffer(N, 22050), { pstart: 1000, pend: 3000, bufsr: 22050, trig: 1 });
  let r = sim.process(4500);
  for (let n = 100; n < 3500; n += 13) { close(r.left[n], (1000 + 0.5 * n) / N, 3e-6, 'half[' + n + ']'); }
  // 88200 on 44100: double speed
  sim = make(rampBuffer(N, 88200), { pstart: 1000, pend: 5000, bufsr: 88200, trig: 1 });
  r = sim.process(2500);
  for (let n = 100; n < 1800; n += 13) { close(r.left[n], (1000 + 2 * n) / N, 3e-6, 'double[' + n + ']'); }
  // 44100 buffer on a 48000 Hz host
  sim = make(rampBuffer(N, 44100), { pstart: 1000, pend: 5000, bufsr: 44100, trig: 1 }, { sampleRate: 48000 });
  r = sim.process(4600);
  const inc = 44100 / 48000;
  for (let n = 100; n < 4000; n += 13) { close(r.left[n], (1000 + inc * n) / N, 3e-6, '48k[' + n + ']'); }
  // bufsr defaults to the buffer's rate in the sim
  sim = make(rampBuffer(N, 22050), { pstart: 1000, pend: 3000, trig: 1 });
  assert.equal(sim.get('bufsr'), 22050);
});

test('stereo buffers use channels 0/1; mono is duplicated', () => {
  const N = 20000;
  const l = new Float32Array(N), r2 = new Float32Array(N);
  for (let i = 0; i < N; i++) { l[i] = i / N; r2[i] = 1 - i / N; }
  const sim = make({ channels: [l, r2], sr: SR }, { pstart: 1000, pend: 3000, trig: 1 });
  const r = sim.process(1500);
  for (let n = 100; n < 1500; n += 17) {
    close(r.left[n], (1000 + n) / N, 2e-6, 'L');
    close(r.right[n], 1 - (1000 + n) / N, 2e-6, 'R');
  }
});

test('reads outside [0, frames) are silent; the hit still runs to pend', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 19000, pend: 21000, trig: 1 });
  const r = sim.process(2500);
  close(r.left[500], 19500 / N, 2e-6);
  for (let n = 1002; n < 1990; n++) { assert.equal(r.left[n], 0, 'silent past the end at ' + n); }
  assert.equal(r.active[1500], 1, 'still active while the playhead is past the buffer end');
  assert.equal(r.active[2000], 0);
});

test('trig with an unchanged value does not retrigger; counters wrapping to 1 do', () => {
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 9000, trig: 1000000 });
  sim.process(2000);
  sim.set('trig', 1000000);
  const r = sim.process(100);
  assert.equal(eventsOf(sim, 'start').length, 1);
  assert.equal(r.active[50], 1);
  sim.set('trig', 1);
  sim.process(20);
  assert.equal(eventsOf(sim, 'start').length, 1, 'retrigger is pending during the 1 ms fade');
  sim.process(100);
  assert.equal(eventsOf(sim, 'start').length, 2);
});

// ---------------------------------------------------------------------------
// trigger / gate, envelope
// ---------------------------------------------------------------------------

test('trigger mode: held -> 0 does not release; the hit plays to pend', () => {
  const sim = make(constBuffer(60000, 1), { pstart: 0, pend: 40000, gatemode: 0, held: 1, trig: 1, rel: 20 });
  sim.process(2000);
  sim.set('held', 0);
  const r = sim.process(40000);
  for (let n = 10; n < 37900; n += 3) { close(r.left[n], 1, 1e-6, 'level ' + n); }
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.equal(end + 2000, 40000);
});

test('gate mode: held -> 0 starts an exponential release that ends the voice at -80 dB', () => {
  const sim = make(constBuffer(60000, 1), { pstart: 0, pend: 40000, gatemode: 1, held: 1, trig: 1, rel: 20 });
  sim.process(2000);
  sim.set('held', 0);
  const r = sim.process(3000);
  const relN = 0.020 * SR; // 882
  close(r.left[Math.round(relN / 2)], Math.exp(-9.2103 / 2), 0.0015, 'level at half the release');
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.ok(end >= relN - 5 && end <= relN + 3, 'voice ends after ~rel ms: ' + end);
  assert.equal(r.left[end], 0);
  // while held the gate voice plays on to pend
  const sim2 = make(constBuffer(60000, 1), { pstart: 0, pend: 40000, gatemode: 1, held: 1, trig: 1, rel: 20 });
  const r2 = sim2.process(41000);
  assert.equal(firstIndex(r2.active, 0, v => v === 0), 40000);
  // release time has a 1 ms floor
  const sim3 = make(constBuffer(60000, 1), { pstart: 0, pend: 40000, gatemode: 1, held: 1, trig: 1, rel: 0 });
  sim3.process(1000);
  sim3.set('held', 0);
  const r3 = sim3.process(200);
  const end3 = firstIndex(r3.active, 0, v => v === 0);
  assert.ok(end3 >= 38 && end3 <= 46, 'rel 0 -> 1 ms release: ' + end3);
  assert.ok(maxStep(r3.left, 0, end3) < 0.2, 'no click on a zero release');
});

test('ADSR shape: linear attack, exponential decay to sustain, sustain, exponential release', () => {
  const sim = make(constBuffer(100000, 1), {
    pstart: 0, pend: 90000, att: 10, dec: 20, sus: 0.5, rel: 30, gatemode: 1, held: 1, trig: 1
  });
  const r = sim.process(4000);
  const attN = 0.010 * SR;   // 441
  const decN = 0.020 * SR;   // 882
  for (let n = 50; n < 440; n += 5) { close(r.left[n], (n + 1) / attN, 1e-5, 'attack ' + n); }
  close(r.left[440], 1, 1e-6, 'attack peak');
  for (let n = 441; n < 1300; n++) { assert.ok(r.left[n + 1] <= r.left[n] + 1e-9, 'decay is monotonic at ' + n); }
  close(r.left[441 + 441], 0.5 + 0.5 * Math.exp(-9.2103 * 441 / 882), 0.002, 'decay midpoint');
  close(r.left[441 + 1000], 0.5, 1e-6, 'sustain');
  close(r.left[3000], 0.5, 1e-6, 'sustain later');
  assert.equal(r.active[3000], 1);

  const sim2 = make(constBuffer(100000, 1), {
    pstart: 0, pend: 90000, att: 10, dec: 20, sus: 0.5, rel: 30, gatemode: 1, held: 1, trig: 1
  });
  sim2.process(3000);
  sim2.set('held', 0);
  const r2 = sim2.process(2000);
  const relN = 0.030 * SR; // 1323
  close(r2.left[Math.round(relN / 2)], 0.5 * Math.exp(-9.2103 / 2), 0.0008, 'release midpoint');
  const end = firstIndex(r2.active, 0, v => v === 0);
  const expected = relN * Math.log(0.5 / 0.0001) / 9.2103;
  assert.ok(Math.abs(end - expected) < 4, 'release ends at -80 dB: ' + end + ' vs ' + expected);
  // monotonic release
  for (let n = 0; n < end - 1; n++) { assert.ok(r2.left[n + 1] <= r2.left[n] + 1e-9); }
});

test('sustain 0 in trigger mode decays to silence but the hit still plays to pend', () => {
  const sim = make(constBuffer(60000, 1), { pstart: 0, pend: 20000, att: 0, dec: 10, sus: 0, trig: 1 });
  const r = sim.process(21000);
  assert.ok(Math.abs(r.left[2000]) < 1e-3);
  assert.equal(r.active[19000], 1);
  assert.equal(firstIndex(r.active, 0, v => v === 0), 20000);
});

test('amp: smoothed with a ~5 ms one-pole during the note, but not at note start', () => {
  const sim = make(constBuffer(60000, 1), { pstart: 0, pend: 50000, amp: 0.7, trig: 1 });
  let r = sim.process(1000);
  close(r.left[100], 0.7, 1e-6, 'no glide at the note start');
  sim.set('amp', 0.35);
  r = sim.process(1500);
  const tau = 0.005 * SR;
  close(r.left[220], 0.35 + 0.35 * Math.exp(-221 / tau), 0.002, 'one-pole step response');
  close(r.left[1400], 0.35 + 0.35 * Math.exp(-1401 / tau), 2e-4, 'keeps converging');
  close(r.left[1499], 0.35, 1e-3, 'settles');
});

// ---------------------------------------------------------------------------
// kill, retrigger
// ---------------------------------------------------------------------------

test('kill fades to 0 within ~2 ms and the voice goes idle; kill on an idle voice is a no-op', () => {
  const sim = make(constBuffer(60000, 1), { pstart: 0, pend: 50000, trig: 1 });
  sim.process(1000);
  sim.set('kill', 1);
  const r = sim.process(300);
  close(r.left[44], 0.5, 0.02, 'halfway after 1 ms');
  for (let n = 0; n < 88; n++) { assert.ok(r.left[n + 1] <= r.left[n] + 1e-9, 'monotonic'); }
  const z = firstIndex(r.left, 0, v => v === 0);
  assert.ok(z >= 85 && z <= 91, 'silent after ~2 ms: ' + z);
  const a = firstIndex(r.active, 0, v => v === 0);
  assert.ok(a >= 85 && a <= 92, 'inactive after ~2 ms: ' + a);
  // idle voice: kill does nothing, a later trig still plays
  sim.set('kill', 2);
  sim.process(100);
  sim.set('trig', 2);
  const r2 = sim.process(500);
  assert.equal(r2.active[10], 1);
  close(r2.left[300], 1, 1e-6);
});

test('retrigger while sounding: ~1 ms fade-out, jump to pstart, envelope restarts', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 1000, pend: 9000, trig: 1 });
  sim.process(1000);
  sim.set('trig', 2);
  const r = sim.process(600);
  const starts = eventsOf(sim, 'start');
  assert.equal(starts.length, 2);
  const lag = starts[1].n - 1000;
  assert.ok(lag >= 44 && lag <= 47, 'jump after the ~1 ms fade: ' + lag);
  for (let n = 0; n < 600; n++) { assert.equal(r.active[n], 1, 'stays active across the retrigger'); }
  assert.ok(maxStep(r.left, 0, 600) < 0.01, 'no click across the retrigger');
  assert.equal(r.left[lag - 1], 0);
  const s = lag;
  close(r.pos[s], 1000, 0, 'restarts at pstart');
  for (let m = 60; m < 400; m += 9) { close(r.left[s + m], (1000 + m) / N, 2e-6, 'new hit ' + m); }
  // envelope restarts at attack
  const sim2 = make(constBuffer(60000, 1), { pstart: 0, pend: 50000, att: 10, trig: 1 });
  sim2.process(3000);
  sim2.set('trig', 2);
  const r2 = sim2.process(700);
  const s2 = eventsOf(sim2, 'start')[1].n - 3000;
  close(r2.left[s2 + 200], 201 / 441, 1e-4, 'attack restarts from 0');
  close(r2.left[s2 + 500], 1, 1e-6);
});

test('a retrigger arriving just before the end of the hit is not lost', () => {
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, trig: 1 });
  sim.process(990);
  sim.set('trig', 2);
  const r = sim.process(600);
  assert.equal(eventsOf(sim, 'start').length, 2);
  assert.equal(r.active[300], 1);
  // gate-mode voice in its release tail, retriggered just before it ends
  const sim2 = make(constBuffer(60000, 1), { pstart: 0, pend: 50000, gatemode: 1, held: 1, rel: 20, trig: 1 });
  sim2.process(1000);
  sim2.set('held', 0);
  sim2.process(840);
  sim2.set('held', 1);
  sim2.set('trig', 2);
  sim2.process(300);
  assert.equal(eventsOf(sim2, 'start').length, 2);
  assert.equal(eventsOf(sim2, 'end').length, 0, 'voice never went idle');
});

// ---------------------------------------------------------------------------
// micro-loop
// ---------------------------------------------------------------------------

test('micro-loop: playback starts at the loop start, stays inside the region, wraps with a crossfade', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  const r = sim.process(20000);
  const ls = 1000 + 0.5 * (8000 - 500); // 4750
  assert.equal(r.pos[0], ls);
  for (let n = 0; n < 20000; n++) {
    assert.ok(r.pos[n] >= ls && r.pos[n] < ls + 500, 'pos in region at ' + n + ': ' + r.pos[n]);
    assert.equal(r.active[n], 1);
  }
  assert.equal(eventsOf(sim, 'wrap').length, 40);
  // crossfade: a hard wrap would jump by 500/N = 0.025, the blend moves ~125x slower
  assert.ok(maxStep(r.left, 60, 20000) < 0.0015, 'smooth wrap, max step ' + maxStep(r.left, 60, 20000));
  // output only uses material from [ls - xf, le)
  const xf = Math.min(0.005 * SR, 125);
  let lo = 1, hi = 0;
  for (let n = 100; n < 20000; n++) { lo = Math.min(lo, r.left[n]); hi = Math.max(hi, r.left[n]); }
  assert.ok(lo >= (ls - xf) / N - 1e-4 && hi <= (ls + 500) / N + 1e-4, 'range ' + lo + '..' + hi);
});

test('micro-loop: held -> 0 leaves the loop and plays on to pend (trigger mode)', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1, gatemode: 0
  });
  const r1 = sim.process(10000);
  assert.equal(r1.active[9999], 1);
  sim.set('held', 0);
  const r = sim.process(6000);
  const exitPos = r.pos[0];
  assert.ok(exitPos >= 4750 && exitPos < 5250);
  let prev = -1;
  for (let n = 0; n < 6000 && r.active[n] === 1; n++) {
    assert.ok(r.pos[n] > prev, 'monotonic after exit');
    prev = r.pos[n];
  }
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.ok(Math.abs(end - (9000 - exitPos)) <= 1, 'ends at pend: ' + end + ' vs ' + (9000 - exitPos));
  assert.equal(eventsOf(sim, 'end')[0].why, 'pend');
});

test('micro-loop: held -> 0 in gate mode leaves the loop and releases', () => {
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1, gatemode: 1, rel: 30
  });
  sim.process(10000);
  sim.set('held', 0);
  const r = sim.process(6000);
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.ok(end > 1000 && end < 1500, 'ends with the release tail: ' + end);
  assert.equal(eventsOf(sim, 'end').pop().why, 'release');
  assert.ok(maxStep(r.left, 0, end) < 0.003, 'no click on exit');
});

test('micro-loop: loopon -> 0 while held leaves the loop; loopon -> 1 while playing arms it', () => {
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  sim.process(5000);
  sim.set('loopon', 0);
  const r = sim.process(5000);
  const p0 = r.pos[0];
  for (let n = 1; n < 100; n++) { assert.ok(r.pos[n] > r.pos[n - 1]); }
  assert.ok(Math.abs(r.pos[100] - p0 - 100) < 1e-6);
  assert.equal(firstIndex(r.active, 0, v => v === 0) > 0, true);
  // arm the loop live, before the loop region is reached
  const sim2 = make(rampBuffer(20000), {
    pstart: 1000, pend: 9000, loopon: 0, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  sim2.process(1500);
  sim2.set('loopon', 1);
  const r2 = sim2.process(8000);
  assert.ok(Math.abs(r2.pos[0] - 2500) < 1.5, 'plain playback first');
  assert.ok(Math.abs(r2.pos[1000] - 3500) < 1.5, 'plain playback until the region is reached');
  const w = eventsOf(sim2, 'wrap');
  assert.ok(w.length >= 10, 'wraps once the region is reached: ' + w.length);
  for (let n = 3000; n < 8000; n++) { assert.ok(r2.pos[n] >= 4750 && r2.pos[n] < 5250); }
});

test('micro-loop: reverse direction loops inside its region too; loop is clamped to the slice', () => {
  const sim = make(rampBuffer(20000), {
    pstart: 9000, pend: 1000, dir: -1, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  const r = sim.process(8000);
  assert.equal(r.pos[0], 5250);
  for (let n = 0; n < 8000; n++) { assert.ok(r.pos[n] > 4750 && r.pos[n] <= 5250, 'pos ' + r.pos[n]); }
  const sim2 = make(rampBuffer(20000), {
    pstart: 1000, pend: 1300, loopon: 1, loopsize: 5000, looppos: 1, held: 1, trig: 1
  });
  const r2 = sim2.process(3000);
  for (let n = 0; n < 3000; n++) { assert.ok(r2.pos[n] >= 1000 && r2.pos[n] < 1300); }
});

// ---------------------------------------------------------------------------
// repeat
// ---------------------------------------------------------------------------

function starts(sim) { return eventsOf(sim, 'start'); }

test('repeat (host phase): rptdiv 4 over one beat = 4 hits incl. the aligned note start', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 2000, rptdiv: 4, held: 1, playing: 1, trig: 1
  });
  const r = sim.process(spb, hostPhase(spb, 0));
  const s = starts(sim);
  assert.equal(s.length, 4);
  assert.deepEqual(s.map(e => e.n), [0, 5513, 11025, 16538]);
  assert.deepEqual(s.map(e => e.kind), [1, 2, 2, 2]);
  for (let n = 0; n < spb; n++) { assert.equal(r.active[n], 1, 'finished hits keep the voice active while repeating'); }
  assert.ok(eventsOf(sim, 'wait').length >= 3);
  // sound at the start of every repeat
  for (let i = 0; i < s.length; i++) { close(r.left[s[i].n + 200], (1000 + 200) / 20000, 2e-6, 'hit ' + i); }
  // the phase wrap is the next grid line
  sim.process(100, hostPhase(spb, 0));
  assert.equal(starts(sim).length, 5);
  assert.equal(starts(sim)[4].n, spb);
});

test('repeat: over several beats the hits sit exactly on the grid', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 1500, rptdiv: 3, held: 1, playing: 1, trig: 1
  });
  sim.process(spb * 3, hostPhase(spb, 0));
  const lines = eventsOf(sim, 'line').map(e => e.n);
  assert.equal(lines.length, 8);
  for (let b = 0; b < 3; b++) {
    for (let j = 0; j < 3; j++) {
      if (b === 0 && j === 0) { continue; }
      const idx = b * 3 + j - 1;
      assert.ok(Math.abs(lines[idx] - (b + j / 3) * spb) <= 1, 'line ' + idx + ' at ' + lines[idx]);
    }
  }
});

test('repeat: rptdiv 1 (quarter notes) and 2 retrigger once per line, also at the beat wrap', () => {
  const spb = 22050;
  [[1, [22050, 44100, 66150]], [2, [11025, 22050, 33075, 44100, 55125, 66150]]].forEach(([div, expected]) => {
    const sim = make(rampBuffer(20000), { pstart: 1000, pend: 1500, rptdiv: div, held: 1, playing: 1, trig: 1 });
    sim.process(spb * 3 + 100, hostPhase(spb, 0));
    const lines = eventsOf(sim, 'line').map(e => e.n);
    assert.equal(lines.length, expected.length, 'rptdiv ' + div + ' lines ' + lines.join(','));
    expected.forEach((e, i) => assert.ok(Math.abs(lines[i] - e) <= 1, 'rptdiv ' + div + ' line ' + i + ' at ' + lines[i]));
  });
});

test('repeat: changing rptdiv / rptswing while holding does not fire a spurious retrigger', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 1500, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(7000, hostPhase(spb, 0));
  const before = eventsOf(sim, 'line').length;
  sim.set('rptdiv', 3);
  sim.process(3, hostPhase(spb, 0));
  sim.set('rptswing', 0.5);
  sim.process(3, hostPhase(spb, 0));
  assert.equal(eventsOf(sim, 'line').length, before);
  // and it keeps repeating on the new grid: gp = ph*3/2, next line at ph = 2/3
  sim.process(spb, hostPhase(spb, 0));
  assert.ok(eventsOf(sim, 'line').length > before);
  // turning repeat on while holding starts counting from the next line
  const sim2 = make(rampBuffer(20000), { pstart: 1000, pend: 15000, rptdiv: 0, held: 1, playing: 1, trig: 1 });
  sim2.process(7000, hostPhase(spb, 0));
  sim2.set('rptdiv', 4);
  sim2.process(10, hostPhase(spb, 0));
  assert.equal(eventsOf(sim2, 'line').length, 0);
  sim2.process(5000, hostPhase(spb, 0));
  assert.equal(eventsOf(sim2, 'line').length, 1);
});

test('repeat: phase jitter around a grid line fires once; a backward seek resyncs without firing', () => {
  const spb = 22050;
  // phase that steps back by a hair right after crossing each quarter line
  const jitter = function (i, k) {
    let ph = (k % spb) / spb;
    const line = Math.round(ph * 4) / 4;
    if (ph > line && ph < line + 3 / spb && line > 0) { ph = ph - 2 / spb * ((k % 2) + 1); }
    return Math.max(0, ph);
  };
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 1500, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(spb, jitter);
  assert.equal(eventsOf(sim, 'line').length, 3, 'one retrigger per line despite jitter');
  // transport relocation backwards by 0.3 beat (more than one line)
  const sim2 = make(rampBuffer(20000), { pstart: 1000, pend: 1500, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  const seek = function (i, k) { return (k < 17000 ? k / spb : (k - 6600) / spb) % 1; };
  sim2.process(17000, seek);
  const n0 = eventsOf(sim2, 'line').length;
  sim2.process(1, seek);
  assert.equal(eventsOf(sim2, 'line').length, n0, 'seek back: no retrigger');
  sim2.process(spb, seek);
  assert.ok(eventsOf(sim2, 'line').length > n0, 'repeating continues after the relocation');
});

test('repeat while sounding: new hit starts ~1 ms after the grid line (fade-out first)', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 15000, rptdiv: 4, held: 1, playing: 1, trig: 1
  });
  const r = sim.process(spb, hostPhase(spb, 0));
  const lines = eventsOf(sim, 'line').map(e => e.n);
  const st = starts(sim).map(e => e.n);
  assert.deepEqual(lines, [5513, 11025, 16538]);
  assert.equal(st.length, 4);
  for (let i = 1; i < 4; i++) {
    assert.ok(st[i] - lines[i - 1] >= 44 && st[i] - lines[i - 1] <= 47, 'restart lag ' + (st[i] - lines[i - 1]));
  }
  assert.ok(maxStep(r.left, 0, spb) < 0.02, 'no clicks between repeats');
});

test('repeat: swing delays every 2nd line (odd line at pair position 0.5 + 0.25*swing)', () => {
  const spb = 22050;
  function lineTimes(swing) {
    const sim = make(rampBuffer(20000), {
      pstart: 1000, pend: 2000, rptdiv: 4, rptswing: swing, held: 1, playing: 1, trig: 1
    });
    sim.process(spb + 10, hostPhase(spb, 0));
    return eventsOf(sim, 'line').map(e => e.n);
  }
  assert.deepEqual(lineTimes(0), [5513, 11025, 16538, 22050]);
  assert.deepEqual(lineTimes(1), [8269, 11025, 19294, 22050]);
  // swing 0.5 -> odd line at pair position 0.625 -> grid pos 1.25 -> 0.3125 beat
  const t = lineTimes(0.5);
  assert.deepEqual([t[0], t[1]], [6891, 11025]);
  assert.ok(Math.abs(t[2] - (0.5 + 0.3125) * spb) <= 1);
});

test('repeat: rptalt alternates direction on every repeat; a new trig starts forward again', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 3000, rptdiv: 4, rptalt: 1, held: 1, playing: 1, trig: 1
  });
  const r = sim.process(spb, hostPhase(spb, 0));
  const s = starts(sim);
  assert.deepEqual(s.map(e => e.sdir), [1, -1, 1, -1]);
  // the reversed hit starts at the other end of the same span and runs back
  assert.equal(r.pos[s[1].n], 3000);
  assert.equal(r.pos[s[1].n + 10], 2990);
  close(r.left[s[1].n + 200], (3000 - 200) / 20000, 2e-6, 'reverse hit');
  assert.equal(r.pos[s[2].n], 1000);
  // new note: alternation restarts forward
  sim.set('trig', 2);
  sim.process(200, hostPhase(spb, 0));
  const s2 = starts(sim);
  assert.equal(s2[s2.length - 1].sdir, 1);
  assert.equal(s2[s2.length - 1].kind, 1);
  // base reverse (dir -1): repeats alternate -1, +1, -1, ...
  const sim2 = make(rampBuffer(20000), {
    pstart: 3000, pend: 1000, dir: -1, rptdiv: 2, rptalt: 1, held: 1, playing: 1, trig: 1
  });
  sim2.process(spb, hostPhase(spb, 0));
  assert.deepEqual(starts(sim2).map(e => e.sdir), [-1, 1]);
  // rptalt 0 never alternates
  const sim3 = make(rampBuffer(20000), {
    pstart: 1000, pend: 3000, rptdiv: 4, rptalt: 0, held: 1, playing: 1, trig: 1
  });
  sim3.process(spb, hostPhase(spb, 0));
  assert.deepEqual(starts(sim3).map(e => e.sdir), [1, 1, 1, 1]);
});

test('repeat: a note started off the grid counts from the next line', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, held: 1, playing: 1 });
  sim.process(2000, hostPhase(spb, 0));
  sim.set('trig', 1);
  sim.process(spb, hostPhase(spb, 0)); // the host phase just keeps running
  const s = starts(sim);
  assert.equal(s[0].n, 2000);
  assert.equal(s[1].n, 5513);
});

test('repeat (free-running, playing = 0): grid from bpm since the note start', () => {
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, bpm: 120, held: 1, playing: 0, trig: 1 });
  sim.process(22050);
  const lines = eventsOf(sim, 'line').map(e => e.n);
  assert.equal(lines.length, 3);
  [5513, 11025, 16538].forEach((expect, i) => assert.ok(Math.abs(lines[i] - expect) <= 1, 'line ' + i + ' ' + lines[i]));
  // half the tempo: twice the spacing
  const sim2 = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, bpm: 60, held: 1, playing: 0, trig: 1 });
  sim2.process(44100);
  const l2 = eventsOf(sim2, 'line').map(e => e.n);
  assert.equal(l2.length, 3);
  assert.ok(Math.abs(l2[0] - 11025) <= 1);
  // the free-running clock restarts with every new note
  sim.set('trig', 2);
  sim.process(6000);
  const l3 = eventsOf(sim, 'line').map(e => e.n);
  assert.ok(Math.abs(l3[l3.length - 1] - (22050 + 5513)) <= 1, 'first repeat of the 2nd note');
});

test('repeat: off when rptdiv = 0 or the key is released; switching the phase source does not retrigger', () => {
  const spb = 22050;
  let sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 0, held: 1, playing: 1, trig: 1 });
  sim.process(spb, hostPhase(spb, 0));
  assert.equal(starts(sim).length, 1);
  // key released: repeating stops, the waiting voice goes idle
  sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  let r = sim.process(7000, hostPhase(spb, 0));
  assert.equal(r.active[6999], 1);
  sim.set('held', 0);
  r = sim.process(spb, hostPhase(spb, 0));
  assert.equal(r.active[0], 0);
  assert.equal(starts(sim).length, 2);
  // repeat turned off while waiting
  sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(3000, hostPhase(spb, 0));
  sim.set('rptdiv', 0);
  r = sim.process(100, hostPhase(spb, 0));
  assert.equal(r.active[0], 0);
  // playing 1 -> 0 mid-note: the phase source changes but no retrigger is fired by the switch itself
  sim = make(rampBuffer(20000), { pstart: 1000, pend: 15000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(6000, hostPhase(spb, 0));
  const before = eventsOf(sim, 'line').length;
  sim.set('playing', 0);
  sim.process(20, hostPhase(spb, 0));
  assert.equal(eventsOf(sim, 'line').length, before);
});

test('repeat: releasing the key while a hit is still sounding stops further repeats but plays the hit out', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 15000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(7000, hostPhase(spb, 0));
  assert.equal(starts(sim).length, 2);
  const startN = starts(sim)[1].n;
  sim.set('held', 0);
  const r = sim.process(20000, hostPhase(spb, 0));
  assert.equal(starts(sim).length, 2, 'no more repeats');
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.equal(end + 7000, startN + 14000, 'the running hit plays to pend');
});

test('repeat: kill ends a waiting voice at once; unheld trigger voices still end after their hit', () => {
  const spb = 22050;
  const sim = make(rampBuffer(20000), { pstart: 1000, pend: 2000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  sim.process(3000, hostPhase(spb, 0));
  sim.set('kill', 1);
  const r = sim.process(10, hostPhase(spb, 0));
  assert.equal(r.active[0], 0);
  assert.equal(r.left[0], 0);
});

// ---------------------------------------------------------------------------
// filter, drive
// ---------------------------------------------------------------------------

test('filter: 2-pole low-pass attenuates highs, passes lows, -3 dB at the cutoff, bypass >= 19000', () => {
  const N = 60000;
  function level(freq, cutoff) {
    const sim = make(sineBuffer(N, freq, 0.5), { pstart: 0, pend: 50000, cutoff: cutoff, trig: 1 });
    const r = sim.process(20000);
    return rms(r.left, 4000, 16000);
  }
  const ref = level(10000, 20000);
  const hi = level(10000, 500);
  assert.ok(hi / ref < 0.01, 'highs cut by > 40 dB: ' + hi / ref);
  const lo = level(100, 2000) / level(100, 20000);
  assert.ok(lo > 0.98 && lo < 1.02, 'lows pass: ' + lo);
  const fc = level(1000, 1000) / level(1000, 20000);
  assert.ok(Math.abs(fc - Math.SQRT1_2) < 0.02, '-3 dB at fc: ' + fc);
  // 12 dB/oct: one octave above fc is ~ -12 dB
  const oct = level(4000, 1000) / level(4000, 20000);
  assert.ok(oct > 0.05 && oct < 0.09, '2-pole slope: ' + oct);
  // bypass at >= 19000 is exactly the dry signal
  const dry = make(sineBuffer(N, 3000, 0.5), { pstart: 0, pend: 50000, cutoff: 20000, trig: 1 }).process(3000);
  const byp = make(sineBuffer(N, 3000, 0.5), { pstart: 0, pend: 50000, cutoff: 19000, trig: 1 }).process(3000);
  const fil = make(sineBuffer(N, 3000, 0.5), { pstart: 0, pend: 50000, cutoff: 18999, trig: 1 }).process(3000);
  assert.equal(maxAbsDiff(byp.left, dry.left), 0, 'bypass is bit-exact');
  assert.ok(maxAbsDiff(fil.left, dry.left) > 1e-3);
  // channels filter independently (stereo)
  const a = sineBuffer(N, 10000, 0.5).channels[0];
  const b = sineBuffer(N, 100, 0.5).channels[0];
  const sim = make({ channels: [a, b], sr: SR }, { pstart: 0, pend: 50000, cutoff: 1000, trig: 1 });
  const r = sim.process(10000);
  assert.ok(rms(r.left, 3000, 9000) < 0.01 && rms(r.right, 3000, 9000) > 0.3);
});

test('filter: no click when the voice restarts on a hot filter state', () => {
  const sim = make(sineBuffer(60000, 200, 0.9), { pstart: 0, pend: 50000, cutoff: 800, trig: 1 });
  sim.process(5000);
  sim.set('trig', 2);
  const r = sim.process(300);
  assert.ok(maxStep(r.left, 0, 300) < 0.05);
});

test('drive: bounded tanh saturation, level-independent normalisation, off at 0', () => {
  const N = 40000;
  for (const d of [0.1, 0.5, 1]) {
    const sim = make(sineBuffer(N, 440, 1), { pstart: 0, pend: 30000, drive: d, trig: 1 });
    const r = sim.process(20000);
    let peak = 0;
    for (let n = 0; n < 20000; n++) { peak = Math.max(peak, Math.abs(r.left[n])); }
    assert.ok(peak <= 1 + 1e-5, 'drive ' + d + ' peak ' + peak);
    assert.ok(peak > 0.97, 'drive ' + d + ' reaches full scale');
  }
  // a quiet input is boosted: tanh(0.1*10)/tanh(10)
  let sim = make(constBuffer(40000, 0.1), { pstart: 0, pend: 30000, drive: 1, trig: 1 });
  let r = sim.process(2000);
  close(r.left[1000], Math.tanh(1) / Math.tanh(10), 1e-4);
  // drive 0 is the identity
  sim = make(constBuffer(40000, 0.1), { pstart: 0, pend: 30000, drive: 0, trig: 1 });
  r = sim.process(2000);
  close(r.left[1000], 0.1, 1e-6);
  // amp scales after the saturation, so the bound is amp
  sim = make(sineBuffer(N, 440, 1), { pstart: 0, pend: 30000, drive: 1, amp: 0.5, trig: 1 });
  r = sim.process(5000);
  let peak = 0;
  for (let n = 0; n < 5000; n++) { peak = Math.max(peak, Math.abs(r.left[n])); }
  assert.ok(peak <= 0.5 + 1e-5);
  // hot input stays bounded by 1/tanh(1+9*drive)
  sim = make(constBuffer(40000, 1.5), { pstart: 0, pend: 30000, drive: 0.5, trig: 1 });
  r = sim.process(2000);
  assert.ok(Math.abs(r.left[1000]) <= 1 / Math.tanh(5.5) + 1e-6);
});

// ---------------------------------------------------------------------------
// tape
// ---------------------------------------------------------------------------

test('tape stop: rate falls linearly to 0 over tapems, voice stays active while held, recovers in ~10 ms', () => {
  const N = 100000;
  const sim = make(rampBuffer(N), { pstart: 1000, pend: 90000, held: 1, trig: 1, tapems: 100 });
  sim.process(1000);
  sim.set('tape', 1);
  const T = 0.100 * SR; // 4410
  const r1 = sim.process(T + 3000);
  const start = r1.pos[0];
  close(r1.pos[0], 1000 + 1000, 1e-9, 'plain speed before');
  // position after the stop: sum of (1 - (t+1)/T)
  const frozen = r1.pos[T + 2000];
  close(frozen - start, (T - 1) / 2, 1.5, 'distance travelled while stopping');
  assert.equal(r1.pos[T + 100], r1.pos[T + 2900], 'frozen once the factor is 0');
  assert.equal(r1.left[T + 500], 0, 'silent at factor 0');
  for (let n = 0; n < T + 3000; n++) { assert.equal(r1.active[n], 1); }
  // amplitude falls with sqrt of the factor
  const mid = Math.round(T / 2);
  const factor = 1 - (mid + 1) / T;
  close(r1.left[mid], Math.sqrt(factor) * r1.pos[mid] / N, 2e-4, 'amplitude ~ sqrt(rate)');
  // recovery
  sim.set('tape', 0);
  const r2 = sim.process(600);
  assert.ok(r2.pos[459] - r2.pos[458] > 0.999, 'full speed again within ~10 ms');
  assert.ok(r2.pos[200] - r2.pos[199] < 0.6 && r2.pos[200] - r2.pos[199] > 0.4, 'linear recovery');
  assert.ok(r2.left[500] > 0.01, 'sound is back');
});

test('tape stop: a stopped trigger-mode voice whose key is released does not hang', () => {
  const sim = make(rampBuffer(100000), { pstart: 1000, pend: 90000, held: 1, trig: 1, tape: 1, tapems: 20 });
  sim.process(3000);
  assert.equal(sim.process(1).active[0], 1);
  sim.set('held', 0);
  const r = sim.process(300);
  const end = firstIndex(r.active, 0, v => v === 0);
  assert.ok(end > 0 && end < 100, 'dies quickly: ' + end);
  // gate mode: the release ends it
  const sim2 = make(rampBuffer(100000), { pstart: 1000, pend: 90000, held: 1, trig: 1, tape: 1, tapems: 20, gatemode: 1, rel: 30 });
  sim2.process(3000);
  sim2.set('held', 0);
  const r2 = sim2.process(3000);
  assert.ok(firstIndex(r2.active, 0, v => v === 0) > 0);
});

// ---------------------------------------------------------------------------
// misc API
// ---------------------------------------------------------------------------

test('API: params table, clamping, unknown names, src ignored, setBuffer, null phase', () => {
  const sim = VoiceSim.create({ sampleRate: SR });
  sim.set('src', 'whatever');
  assert.throws(() => sim.set('gate', 1), /unknown param/);
  sim.set('pitch', 500);
  assert.equal(sim.get('pitch'), 96);
  sim.set('dir', -5);
  assert.equal(sim.get('dir'), -1);
  sim.set('sus', 'x');
  assert.equal(sim.get('sus'), 1);
  // no buffer: plays (silently) and ends
  sim.set('dir', 1);
  sim.set('pitch', 0);
  sim.set('pstart', 0);
  sim.set('pend', 100);
  sim.set('trig', 1);
  let r = sim.process(200);
  assert.equal(r.active[50], 1);
  assert.equal(r.active[150], 0);
  // buffer given later
  sim.setBuffer(rampBuffer(1000));
  sim.set('trig', 2);
  r = sim.process(200, null);
  assert.ok(r.left[30] > 0.005, 'audio from the buffer set later: ' + r.left[30]);
  assert.equal(Object.keys(VoiceSim.PARAMS).length, 26);
  const names = ['bufsr', 'pstart', 'pend', 'dir', 'pitch', 'amp', 'att', 'dec', 'sus', 'rel', 'gatemode', 'held',
    'loopon', 'loopsize', 'looppos', 'rptdiv', 'rptswing', 'rptalt', 'cutoff', 'drive', 'tape', 'tapems', 'bpm',
    'playing', 'trig', 'kill'];
  assert.deepEqual(Object.keys(VoiceSim.PARAMS), names);
});

test('48 kHz host: fade times follow the sample rate', () => {
  const sim = make(constBuffer(60000, 1, 48000), { pstart: 0, pend: 50000, bufsr: 48000, trig: 1 }, { sampleRate: 48000 });
  sim.process(1000);
  sim.set('kill', 1);
  const r = sim.process(300);
  const a = firstIndex(r.active, 0, v => v === 0);
  assert.ok(a >= 94 && a <= 99, '2 ms at 48 kHz: ' + a);
});

// ---------------------------------------------------------------------------
// GenExpr -> JS translator and linter
// ---------------------------------------------------------------------------

// names that must not be used for Params / Histories / variables (gen~ operators,
// constants, keywords). From the gen~ operator reference; conservative.
const GEN_RESERVED = [
  'abs', 'acos', 'acosh', 'add', 'and', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'atodb', 'average', 'bool',
  'buffer', 'ceil', 'change', 'channels', 'clamp', 'clip', 'codebox', 'constant', 'cos', 'cosh', 'counter',
  'cycle', 'data', 'dbtoa', 'dcblock', 'degrees', 'degtorad', 'delay', 'delta', 'dim', 'div', 'elapsed', 'eq',
  'eqp', 'exp', 'exp2', 'expr', 'fastcos', 'fastexp', 'fastpow', 'fastsin', 'fasttan', 'fixdenorm', 'fixnan',
  'float', 'floor', 'fold', 'fract', 'ftom', 'gate', 'gt', 'gte', 'gtep', 'gtp', 'halfpi', 'history', 'hypot',
  'in', 'int', 'invpi', 'isdenorm', 'isnan', 'latch', 'lerp', 'ln10', 'ln2', 'log', 'log10', 'log10e', 'log2',
  'log2e', 'lookup', 'lt', 'lte', 'ltep', 'ltp', 'max', 'mc_channel', 'mc_channelcount', 'min', 'mix', 'mod',
  'mstosamps', 'mtof', 'mul', 'nearest', 'neg', 'neq', 'neqp', 'noise', 'not', 'or', 'out', 'param', 'pass',
  'peek', 'phasor', 'phi', 'pi', 'poke', 'pow', 'radians', 'radtodeg', 'rate', 'rdiv', 'rmod', 'round', 'rsub',
  'sah', 'sample', 'samplerate', 'samples', 'sampstoms', 'scale', 'selector', 'sign', 'sin', 'sinh', 'slide',
  'smoothstep', 'splat', 'sqrt', 'sqrt1_2', 'sqrt2', 'step', 'sub', 'switch', 't60', 't60time', 'tan', 'tanh',
  'train', 'triangle', 'trunc', 'twopi', 'vectorsize', 'voice', 'voicecount', 'wave', 'wrap', 'xor', 'e',
  'epsilon', 'maxfloat',
  'if', 'else', 'for', 'while', 'break', 'continue', 'return', 'function', 'var', 'let', 'const', 'true', 'false',
  'null', 'param', 'history', 'buffer', 'data', 'delay'
];
const ALLOWED_CALLS = ['floor', 'abs', 'min', 'max', 'tanh', 'exp', 'tan', 'sqrt', 'peek', 'dim', 'channels'];
const KEYWORDS = ['if', 'else'];
const BUILTIN_VALUES = ['in1', 'samplerate'];
const OUTPUTS = ['out1', 'out2', 'out3'];

function tokenize(text) {
  const re = /\s+|([A-Za-z_][A-Za-z0-9_]*)|(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|(==|!=|<=|>=|&&|\|\||[+\-*\/%]=|\+\+|--)|(.)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) { out.push({ k: 'id', v: m[1] }); }
    else if (m[2]) { out.push({ k: 'num', v: m[2] }); }
    else if (m[3]) { out.push({ k: 'op', v: m[3] }); }
    else if (m[4]) { out.push({ k: 'op', v: m[4] }); }
  }
  return out;
}

/** Parse + lint + translate a GenExpr codebox into a JS function. */
function compileGenExpr(raw) {
  const errors = [];
  const warnings = [];
  if (/\/\*/.test(raw)) { errors.push('block comments are not used (use //)'); }
  let text = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

  const params = {};
  const histories = {};
  let bufferName = null;
  const order = [];

  // declarations come first
  let pos = 0;
  for (;;) {
    const ws = /^\s*/.exec(text.slice(pos))[0].length;
    const rest = text.slice(pos + ws);
    let m;
    if ((m = /^Param\s+(\w+)\s*\(([^)]*)\)\s*;/.exec(rest))) {
      const parts = m[2].split(',').map(s => s.trim());
      const def = Number(parts[0]);
      const p = { def: def, min: null, max: null };
      parts.slice(1).forEach(kv => {
        const mm = /^(min|max)\s*=\s*(-?[\d.]+)$/.exec(kv);
        if (!mm) { errors.push('bad Param attribute: ' + kv); } else { p[mm[1]] = Number(mm[2]); }
      });
      if (m[1] in params) { errors.push('duplicate Param ' + m[1]); }
      params[m[1]] = p;
      order.push(m[1]);
      pos += ws + m[0].length;
    } else if ((m = /^History\s+(\w+)\s*\(\s*(-?[\d.]+)\s*\)\s*;/.exec(rest))) {
      histories[m[1]] = Number(m[2]);
      pos += ws + m[0].length;
    } else if ((m = /^Buffer\s+(\w+)\s*;/.exec(rest))) {
      bufferName = m[1];
      pos += ws + m[0].length;
    } else {
      break;
    }
  }
  const body = text.slice(pos);
  if (/\b(Param|History|Buffer|Data|Delay)\b/.test(body)) { errors.push('declarations must come before any code'); }

  Object.keys(params).forEach(n => {
    if (params[n].min === null || params[n].max === null) { errors.push('Param ' + n + ' needs explicit min and max'); }
  });
  const declared = Object.keys(params).concat(Object.keys(histories)).concat(bufferName ? [bufferName] : []);
  declared.forEach(n => {
    if (GEN_RESERVED.indexOf(n.toLowerCase()) >= 0) { errors.push('declared name clashes with a gen name: ' + n); }
  });
  Object.keys(histories).forEach(n => { if (!/^h_/.test(n)) { errors.push('History names start with h_: ' + n); } });

  const toks = tokenize(body);

  // forbidden constructs
  toks.forEach(t => {
    if (t.k === 'num' && /[eE]/.test(t.v)) { errors.push('scientific notation: ' + t.v); }
    if (t.k === 'op' && ['%', '++', '--', '+=', '-=', '*=', '/=', '%=', '?', ':'].indexOf(t.v) >= 0) {
      errors.push('operator not used in this file: ' + t.v);
    }
    if (t.k === 'op' && !/^(==|!=|<=|>=|&&|\|\||[-+*\/<>=!(){};,.])$/.test(t.v)) { errors.push('unexpected character: ' + t.v); }
  });

  // scope / History / call checks
  const scopes = [new Set()];
  let depth = 0;
  const pendingDecl = [];
  const locals = new Set();
  const reads = {};
  const writes = {};
  const histRead = {};
  const histWrite = {};
  const outputWrites = {};
  const topLevelStmt = [];   // for History statement shape checks
  let stmtStart = 0;
  const braceStack = [];

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    if (t.k === 'op') {
      if (t.v === '{') {
        scopes.push(new Set()); depth++;
        const prev = toks[i - 1];
        // if / else blocks only
        if (!(prev && ((prev.v === ')' ) || prev.v === 'else'))) { errors.push('unexpected block'); }
        braceStack.push(i);
      } else if (t.v === '}') {
        scopes.pop(); depth--;
      } else if (t.v === ';') {
        pendingDecl.splice(0).forEach(n => { scopes[scopes.length - 1].add(n); });
        if (depth === 0) { topLevelStmt.push([stmtStart, i]); }
        stmtStart = i + 1;
      }
      if (t.v === '{' || t.v === '}') { if (depth === 0) { stmtStart = i + 1; } }
      continue;
    }
    if (t.k !== 'id') { continue; }
    const name = t.v;
    if (KEYWORDS.indexOf(name) >= 0) {
      if (name === 'if') {
        if (!next || next.v !== '(') { errors.push('if needs ('); }
      }
      if (name === 'else') {
        if (!next || (next.v !== '{' && next.v !== 'if')) { errors.push('else needs { or if'); }
      }
      continue;
    }
    if (next && next.v === '(') {
      if (ALLOWED_CALLS.indexOf(name) < 0) { errors.push('unknown function/operator: ' + name); }
      continue;
    }
    if (name in params) {
      if (next && next.v === '=') { errors.push('assignment to Param ' + name); }
      continue;
    }
    if (name in histories) {
      const isWrite = next && next.v === '=';
      if (isWrite) {
        histWrite[name] = (histWrite[name] || []).concat([{ i: i, depth: depth }]);
      } else {
        histRead[name] = (histRead[name] || []).concat([{ i: i, depth: depth }]);
      }
      continue;
    }
    if (name === bufferName || BUILTIN_VALUES.indexOf(name) >= 0) { continue; }
    if (OUTPUTS.indexOf(name) >= 0) {
      if (next && next.v === '=') { outputWrites[name] = (outputWrites[name] || 0) + 1; if (depth !== 0) { errors.push(name + ' assigned inside a block'); } }
      else { errors.push(name + ' read'); }
      continue;
    }
    if (GEN_RESERVED.indexOf(name.toLowerCase()) >= 0) { errors.push('variable name clashes with a gen name: ' + name); }
    const isAssign = next && next.v === '=';
    const known = scopes.some(s => s.has(name));
    if (isAssign) {
      writes[name] = (writes[name] || 0) + 1;
      if (!known) {
        if (depth !== 0) { errors.push('variable first assigned inside a block: ' + name); }
        pendingDecl.push(name);
        locals.add(name);
      }
    } else {
      reads[name] = (reads[name] || 0) + 1;
      if (!known) { errors.push('variable used out of scope / before assignment: ' + name + ' (token ' + i + ')'); }
    }
  }
  if (depth !== 0) { errors.push('unbalanced braces'); }

  // History discipline: exactly one read ("x = h_x;") and one write ("h_x = x;"),
  // both at top level, read before write -> independent of History semantics
  Object.keys(histories).forEach(h => {
    const r = histRead[h] || [];
    const w = histWrite[h] || [];
    if (r.length !== 1 || w.length !== 1) { errors.push('History ' + h + ' must be read once and written once (' + r.length + '/' + w.length + ')'); return; }
    if (r[0].depth !== 0 || w[0].depth !== 0) { errors.push('History ' + h + ' accessed inside a block'); }
    if (r[0].i > w[0].i) { errors.push('History ' + h + ' written before it is read'); }
    const rt = toks.slice(r[0].i - 2, r[0].i + 2).map(x => x.v).join(' ');
    const wt = toks.slice(w[0].i, w[0].i + 4).map(x => x.v).join(' ');
    const base = h.replace(/^h_/, '');
    if (!(toks[r[0].i - 2].v === base && toks[r[0].i - 1].v === '=' && toks[r[0].i + 1].v === ';')) { errors.push('History read must be "' + base + ' = ' + h + ';" got ' + rt); }
    if (!(wt === h + ' = ' + base + ' ;')) { errors.push('History write must be "' + h + ' = ' + base + ';" got ' + wt); }
  });

  OUTPUTS.forEach(o => { if (outputWrites[o] !== 1) { errors.push(o + ' must be assigned exactly once'); } });

  // dead variables
  locals.forEach(n => { if (!reads[n]) { warnings.push('assigned but never read: ' + n); } });

  // translate
  const mapped = toks.map(t => {
    if (t.k === 'id' && t.v in histories) { return 'H.' + t.v; }
    return t.v;
  });
  const js = [];
  js.push('var ' + Object.keys(params).map(n => n + ' = P.' + n).join(', ') + ';');
  const localList = Array.from(locals).concat(OUTPUTS);
  js.push('var ' + localList.map(n => n + ' = NaN').join(', ') + ';');
  js.push(mapped.join(' '));
  js.push('return [out1, out2, out3];');
  const code = js.join('\n');
  let fn = null;
  if (errors.length === 0) {
    fn = new Function('P', 'H', bufferName || 'src', 'samplerate', 'in1',
      'floor', 'abs', 'min', 'max', 'tanh', 'exp', 'tan', 'sqrt', 'peek', 'dim', 'channels', code);
  }
  return { errors: errors, warnings: warnings, params: params, histories: histories, bufferName: bufferName, order: order, fn: fn, code: code };
}

/** Same API as VoiceSim.create but running the translated voice.genexpr. */
function createGenVoice(compiled, opts) {
  const P = {};
  Object.keys(compiled.params).forEach(n => { P[n] = compiled.params[n].def; });
  const H = {};
  Object.keys(compiled.histories).forEach(n => { H[n] = compiled.histories[n]; });
  let buf = opts.buffer || null;
  const samplerate = opts.sampleRate || SR;
  let count = 0;
  const peek = function (b, i, ch) {
    if (!b || !b.channels || i < 0 || i >= b.channels[0].length || ch >= b.channels.length) { return 0; }
    return b.channels[ch][i];
  };
  const dim = b => (b && b.channels && b.channels.length ? b.channels[0].length : 0);
  const channels = b => (b && b.channels ? b.channels.length : 0);
  if (buf && buf.sr) { P.bufsr = buf.sr; }
  return {
    set(name, value) {
      if (name === 'src') { return; }
      const p = compiled.params[name];
      if (!p) { throw new Error('unknown param ' + name); }
      let v = Number(value);
      if (v !== v) { return; }
      if (v < p.min) { v = p.min; }
      if (v > p.max) { v = p.max; }
      P[name] = v;
    },
    setBuffer(b) { buf = b; },
    process(n, phaseFn) {
      const left = new Float32Array(n), right = new Float32Array(n), active = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const ph = phaseFn ? phaseFn(i, count) : 0;
        const o = compiled.fn(P, H, buf, samplerate, ph, Math.floor, Math.abs, Math.min, Math.max,
          Math.tanh, Math.exp, Math.tan, Math.sqrt, peek, dim, channels);
        left[i] = o[0]; right[i] = o[1]; active[i] = o[2];
        count++;
      }
      return { left: left, right: right, active: active };
    }
  };
}

const RAW_GENEXPR = fs.readFileSync(GENEXPR_FILE, 'utf8');
const COMPILED = compileGenExpr(RAW_GENEXPR);

test('voice.genexpr: lint (block scope, History discipline, operators, reserved names, declarations)', () => {
  assert.deepEqual(COMPILED.errors, []);
  assert.deepEqual(COMPILED.warnings, []);
  assert.ok(COMPILED.fn, 'compiles to JS');
  assert.equal(COMPILED.bufferName, 'src');
});

test('voice.genexpr: Param declarations match VoiceSim.PARAMS (names, order, defaults, ranges)', () => {
  const simNames = Object.keys(VoiceSim.PARAMS);
  assert.deepEqual(COMPILED.order, simNames);
  simNames.forEach(n => {
    assert.deepEqual(COMPILED.params[n], VoiceSim.PARAMS[n], n);
  });
});

test('voice.genexpr: PROTOCOL.md voice parameters are all present', () => {
  const protocol = ['bufsr', 'pstart', 'pend', 'dir', 'pitch', 'amp', 'att', 'dec', 'sus', 'rel', 'gatemode', 'held',
    'loopon', 'loopsize', 'looppos', 'rptdiv', 'rptswing', 'rptalt', 'cutoff', 'drive', 'tape', 'tapems', 'bpm',
    'playing', 'trig', 'kill'];
  assert.deepEqual(COMPILED.order.slice().sort(), protocol.slice().sort());
  const docs = path.join(__dirname, '..', 'docs', 'PROTOCOL.md');
  if (fs.existsSync(docs)) {
    const md = fs.readFileSync(docs, 'utf8');
    protocol.forEach(n => assert.ok(md.indexOf('`' + n + '`') >= 0, n + ' documented in PROTOCOL.md'));
  }
});

test('lint self-check: the checker really catches block-scope and History mistakes', () => {
  const bad1 = compileGenExpr('Param a(1, min=0, max=2);\nHistory h_x(0);\nx = h_x;\nif (a > 0) {\n  y = 1;\n}\nz = y;\nh_x = x;\nout1 = z;\nout2 = 0;\nout3 = 0;\n');
  assert.ok(bad1.errors.some(e => /first assigned inside a block|out of scope/.test(e)), bad1.errors.join('; '));
  const bad2 = compileGenExpr('Param a(1, min=0, max=2);\nHistory h_x(0);\nx = h_x;\nh_x = x + 1;\nq = h_x;\nout1 = q;\nout2 = 0;\nout3 = 0;\n');
  assert.ok(bad2.errors.some(e => /History/.test(e)), bad2.errors.join('; '));
  const bad3 = compileGenExpr('Param mix(1, min=0, max=2);\nout1 = fmod(mix, 2);\nout2 = 0;\nout3 = 0;\n');
  assert.ok(bad3.errors.some(e => /clashes/.test(e)) && bad3.errors.some(e => /unknown function/.test(e)), bad3.errors.join('; '));
  const bad4 = compileGenExpr('Param a(1);\nout1 = a;\nout2 = 0;\nout3 = 0;\n');
  assert.ok(bad4.errors.some(e => /min and max/.test(e)));
});

// ---------------------------------------------------------------------------
// parity: voice.genexpr (translated) vs voice-sim.js
// ---------------------------------------------------------------------------

function applyScript(engine, script, total, phaseFn) {
  const left = new Float32Array(total), right = new Float32Array(total), active = new Float32Array(total);
  const ev = script.slice().sort((a, b) => a.at - b.at);
  let t = 0;
  let ei = 0;
  while (t < total) {
    while (ei < ev.length && ev[ei].at <= t) {
      Object.keys(ev[ei].set).forEach(k => engine.set(k, ev[ei].set[k]));
      ei++;
    }
    const until = Math.min(total, ei < ev.length ? ev[ei].at : total);
    const len = Math.max(1, until - t);
    const r = engine.process(len, phaseFn);
    left.set(r.left, t); right.set(r.right, t); active.set(r.active, t);
    t += len;
  }
  return { left: left, right: right, active: active };
}

function parity(buffer, script, total, phaseFn, sampleRate) {
  const sim = VoiceSim.create({ sampleRate: sampleRate || SR, buffer: buffer, log: true });
  const gen = createGenVoice(COMPILED, { sampleRate: sampleRate || SR, buffer: buffer });
  const a = applyScript(sim, script, total, phaseFn);
  const b = applyScript(gen, script, total, phaseFn);
  const di = firstIndex(a.active, 0, (v, i) => v !== b.active[i]);
  assert.ok(di < 0, 'active outputs identical (first difference at sample ' + di + ')');
  const dl = maxAbsDiff(a.left, b.left), dr = maxAbsDiff(a.right, b.right);
  assert.ok(dl < 1e-6 && dr < 1e-6, 'audio parity: ' + dl + ' / ' + dr);
  a.events = sim.events;
  return a;
}

const SPB = 22050;

test('parity: forward / reverse / pitch / envelope / filter / drive / amp / kill / retrigger script', () => {
  const buf = { channels: [sineBuffer(60000, 220, 0.6).channels[0], sineBuffer(60000, 330, 0.5).channels[0]], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 30000, att: 5, dec: 40, sus: 0.6, rel: 50, gatemode: 1, held: 1, cutoff: 3000, drive: 0.4, amp: 0.8, trig: 1 } },
    { at: 4000, set: { amp: 0.4, pitch: 5 } },
    { at: 8000, set: { trig: 2, pitch: -7, cutoff: 700 } },
    { at: 12000, set: { held: 0 } },
    { at: 16000, set: { held: 1, pstart: 40000, pend: 20000, dir: -1, drive: 1, cutoff: 20000, trig: 3 } },
    { at: 20000, set: { kill: 1 } },
    { at: 21000, set: { gatemode: 0, trig: 4, pstart: 2000, pend: 9000, dir: 1, pitch: 0 } },
    { at: 24000, set: { trig: 5 } }
  ];
  const out = parity(buf, script, 40000, null);
  assert.ok(rms(out.left, 0, 40000) > 0.01, 'non-trivial audio');
});

test('parity: micro-loop (forward, reverse, live enable / exit) scenarios', () => {
  const buf = { channels: [sineBuffer(60000, 180, 0.7).channels[0]], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 20000, loopon: 1, loopsize: 600, looppos: 0.3, held: 1, trig: 1 } },
    { at: 9000, set: { held: 0 } },
    { at: 14000, set: { loopon: 0, held: 1, gatemode: 1, trig: 2 } },
    { at: 15000, set: { loopon: 1 } },
    { at: 20000, set: { loopon: 0 } },
    { at: 22000, set: { pstart: 30000, pend: 10000, dir: -1, loopon: 1, loopsize: 80, looppos: 1, trig: 3 } },
    { at: 30000, set: { held: 0, rel: 100 } }
  ];
  const out = parity(buf, script, 45000, null);
  assert.ok(rms(out.left, 0, 9000) > 0.1);
});

test('parity: repeat (host phase and free-running), swing, alternate direction, tape stop', () => {
  const buf = { channels: [sineBuffer(60000, 300, 0.7).channels[0]], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 4000, rptdiv: 4, rptswing: 0.6, rptalt: 1, playing: 1, bpm: 120, held: 1, trig: 1 } },
    { at: 30000, set: { rptdiv: 3, rptswing: 0, pstart: 1000, pend: 12000 } },
    { at: 50000, set: { playing: 0, bpm: 97, rptdiv: 6 } },
    { at: 70000, set: { tape: 1, tapems: 300 } },
    { at: 85000, set: { tape: 0 } },
    { at: 95000, set: { held: 0 } },
    { at: 99000, set: { trig: 2, held: 1, rptdiv: 8, rptalt: 0, playing: 1, dir: -1, pstart: 6000, pend: 1000 } }
  ];
  const out = parity(buf, script, 130000, hostPhase(SPB, 777));
  assert.ok(rms(out.left, 0, 20000) > 0.05);
});

test('parity: 48 kHz, mono and stereo, thru-style end beyond the buffer, tiny slices', () => {
  const buf = { channels: [sineBuffer(20000, 500, 0.5, 48000).channels[0]], sr: 48000 };
  const script = [
    { at: 0, set: { bufsr: 48000, pstart: 19000, pend: 22000, trig: 1, held: 1 } },
    { at: 5000, set: { pstart: 100, pend: 106, trig: 2 } },
    { at: 6000, set: { pstart: 500, pend: 0, dir: -1, trig: 3, pitch: 12 } },
    { at: 9000, set: { bufsr: 22050, pstart: 0, pend: 20000, dir: 1, trig: 4, pitch: 0 } }
  ];
  parity(buf, script, 30000, null, 48000);
});

test('parity: random scenarios (seeded fuzz of every parameter and event)', () => {
  const coverage = {};
  function count(key) { coverage[key] = (coverage[key] || 0) + 1; }
  for (let seed = 1; seed <= 32; seed++) {
    const rnd = mulberry32(seed * 7919);
    const pick = a => a[Math.floor(rnd() * a.length)];
    const frames = 30000;
    const stereo = rnd() < 0.5;
    const ch = [new Float32Array(frames)];
    if (stereo) { ch.push(new Float32Array(frames)); }
    ch.forEach(c => { for (let i = 0; i < frames; i++) { c[i] = (rnd() * 2 - 1) * 0.8; } });
    const buf = { channels: ch, sr: pick([44100, 48000, 22050]) };
    const script = [];
    let trigN = 0, killN = 0;
    const total = 60000;
    let at = 0;
    while (at < total) {
      const set = {};
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const what = pick(['trig', 'trig', 'held', 'gatemode', 'loop', 'rpt', 'rpt', 'pitch', 'slice', 'slice', 'filter', 'drive',
          'tape', 'env', 'amp', 'kill', 'bpm', 'playing', 'bufsr', 'dir']);
        if (what === 'trig') { set.trig = ++trigN; }
        else if (what === 'held') { set.held = rnd() < 0.55 ? 1 : 0; }
        else if (what === 'gatemode') { set.gatemode = rnd() < 0.5 ? 1 : 0; }
        else if (what === 'loop') { set.loopon = rnd() < 0.5 ? 1 : 0; set.loopsize = pick([1, 20, 300, 2000, 90000]); set.looppos = pick([0, 0.25, 1, rnd()]); }
        else if (what === 'rpt') { set.rptdiv = pick([0, 0, 1, 2, 3, 4, 6, 8, 12, 16]); set.rptswing = pick([0, 0.5, 1]); set.rptalt = rnd() < 0.5 ? 1 : 0; }
        else if (what === 'pitch') { set.pitch = pick([-24, -12, -5, 0, 0, 3, 7, 12, 19]); }
        else if (what === 'slice') {
          const a = Math.floor(rnd() * frames), len = Math.floor(rnd() * 4000) + 1;
          if (rnd() < 0.5) { set.pstart = a; set.pend = Math.min(frames + 500, a + len); set.dir = 1; }
          else { set.pstart = Math.min(frames, a + len); set.pend = a; set.dir = -1; }
        }
        else if (what === 'filter') { set.cutoff = pick([40, 300, 2000, 12000, 19000, 20000]); }
        else if (what === 'drive') { set.drive = pick([0, 0.2, 1]); }
        else if (what === 'tape') { set.tape = rnd() < 0.5 ? 1 : 0; set.tapems = pick([5, 50, 400]); }
        else if (what === 'env') { set.att = pick([0, 2, 30]); set.dec = pick([0, 10, 120]); set.sus = pick([0, 0.4, 1]); set.rel = pick([0, 5, 80, 400]); }
        else if (what === 'amp') { set.amp = pick([0, 0.3, 1, 2]); }
        else if (what === 'kill') { set.kill = ++killN; }
        else if (what === 'bpm') { set.bpm = pick([60, 90, 120, 174]); }
        else if (what === 'playing') { set.playing = rnd() < 0.5 ? 1 : 0; }
        else if (what === 'bufsr') { set.bufsr = pick([22050, 44100, 48000, 96000]); }
        else if (what === 'dir') { set.dir = rnd() < 0.5 ? 1 : -1; }
      }
      script.push({ at: at, set: set });
      at += 1 + Math.floor(rnd() * 2500);
    }
    // always have one clean start
    script.unshift({ at: 0, set: { pstart: 1000, pend: 9000, held: 1, trig: ++trigN } });
    const a = parity(buf, script, total, hostPhase(SPB, Math.floor(rnd() * SPB)), pick([44100, 48000]));
    a.events.forEach(e => count(e.type + (e.kind ? ':' + e.kind : '') + (e.why ? ':' + e.why : '')));
    for (let i = 0; i < total; i++) {
      assert.ok(Number.isFinite(a.left[i]) && Number.isFinite(a.right[i]), 'finite output (seed ' + seed + ' at ' + i + ')');
      assert.ok(a.active[i] === 0 || a.active[i] === 1);
      if (a.active[i] === 0) { assert.ok(a.left[i] === 0 && a.right[i] === 0, 'silent when inactive (seed ' + seed + ' at ' + i + ')'); }
      assert.ok(Math.abs(a.left[i]) < 40, 'bounded output');
    }
  }
  // the random scenarios must really visit every state-machine path
  ['trig', 'start:1', 'start:2', 'line', 'wait', 'wrap', 'kill', 'end:pend', 'end:release', 'end:kill', 'end:wait'].forEach(key => {
    assert.ok((coverage[key] || 0) >= (key === 'end:wait' ? 3 : 10), 'fuzz coverage of "' + key + '": ' + (coverage[key] || 0));
  });
});
