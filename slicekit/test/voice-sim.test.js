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
// jump / redir (Scan switches a held note's slice, Reverse turns a hit around)
// ---------------------------------------------------------------------------

/** two distinct plateaus: A = 0.2 in [0, 10000), B = 0.8 in [20000, 30000), silence elsewhere */
function plateauBuffer() {
  const b = new Float32Array(40000);
  b.fill(0.2, 0, 10000);
  b.fill(0.8, 20000, 30000);
  return { channels: [b], sr: SR };
}

/** play a script on a sim and collect left / pos / env / active (concatenated) */
function playFull(sim, script, total, phaseFn) {
  const out = {
    left: new Float32Array(total), active: new Float32Array(total),
    pos: new Float64Array(total), env: new Float64Array(total)
  };
  const ev = script.slice().sort((a, b) => a.at - b.at);
  let t = 0, ei = 0;
  while (t < total) {
    while (ei < ev.length && ev[ei].at <= t) {
      Object.keys(ev[ei].set).forEach(k => sim.set(k, ev[ei].set[k]));
      ei++;
    }
    const until = Math.min(total, ei < ev.length ? ev[ei].at : total);
    const len = Math.max(1, until - t);
    const r = sim.process(len, phaseFn);
    out.left.set(r.left, t); out.active.set(r.active, t); out.pos.set(r.pos, t); out.env.set(r.env, t);
    t += len;
  }
  return out;
}

test('jump: a sounding hit moves to the new slice with the 1 ms declick; envelope and activity are not restarted', () => {
  const sim = make(plateauBuffer(), { pstart: 1000, pend: 9000, held: 1, att: 5, dec: 20, sus: 0.5, amp: 1 });
  const r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 3000, set: { pstart: 21000, pend: 29000, jump: 1 } }
  ], 3400);
  const j = eventsOf(sim, 'jump');
  assert.equal(j.length, 1);
  assert.equal(eventsOf(sim, 'start').length, 1, 'no second start: the hit was not restarted');
  const lag = j[0].n - 3000;
  assert.ok(lag >= 44 && lag <= 47, 'the move happens after the ~1 ms fade-out: ' + lag);
  // old material fades out, the playhead then sits at the new start and the new material fades in
  close(r.left[2990], 0.1, 1e-6, 'old plateau at sustain 0.5 (0.2 * 0.5)');
  assert.equal(r.left[3000 + lag - 1], 0, 'silent at the jump instant');
  assert.equal(r.pos[3000 + lag], 21000);
  assert.ok(r.pos[3000 + lag - 1] >= 3999 && r.pos[3000 + lag - 1] < 4100, 'old slice played on during the fade-out');
  close(r.left[3000 + lag + 80], 0.4, 1e-6, 'new plateau at sustain 0.5 (0.8 * 0.5)');
  for (let n = 3000; n < 3000 + lag - 1; n++) { assert.ok(r.left[n + 1] <= r.left[n] + 1e-9, 'monotonic fade-out at ' + n); }
  for (let n = 3000 + lag; n < 3000 + lag + 44; n++) { assert.ok(r.left[n + 1] >= r.left[n] - 1e-9, 'monotonic fade-in at ' + n); }
  assert.ok(maxStep(r.left, 2900, 3400) < 0.012, 'no click: max step ' + maxStep(r.left, 2900, 3400));
  // the envelope neither restarts nor dips: sustain level all the way, voice active all the way
  for (let n = 2500; n < 3400; n++) {
    assert.ok(Math.abs(r.env[n] - 0.5) < 1e-12, 'envelope untouched at ' + n);
    assert.equal(r.active[n], 1);
  }
  // for contrast: a trig at the same moment does restart the envelope (attack from 0)
  const sim2 = make(plateauBuffer(), { pstart: 1000, pend: 9000, held: 1, att: 5, dec: 20, sus: 0.5 });
  const r2 = playFull(sim2, [
    { at: 0, set: { trig: 1 } }, { at: 3000, set: { pstart: 21000, pend: 29000, trig: 2 } }
  ], 3400);
  assert.ok(r2.env[3000 + lag + 10] < 0.2, 'trig restarts the attack: ' + r2.env[3000 + lag + 10]);
});

test('jump: loop region, direction toggle (rptalt) and repeat grid - loop is re-latched, the other two are kept', () => {
  // micro-loop: the new loop region is in the new slice
  let sim = make(rampBuffer(40000), { pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1 });
  let r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 5000, set: { pstart: 21000, pend: 29000, jump: 1 } }
  ], 9000);
  const jn = eventsOf(sim, 'jump')[0];
  assert.equal(jn.looping, 1);
  assert.equal(r.pos[jn.n], 21000 + 0.5 * (8000 - 500), 'playhead at the new loop start');
  for (let n = jn.n; n < 9000; n++) { assert.ok(r.pos[n] >= 24750 && r.pos[n] < 25250, 'inside the new loop region at ' + n + ': ' + r.pos[n]); }
  for (let n = 3000; n < jn.n; n++) { assert.ok(r.pos[n] >= 4750 && r.pos[n] < 5250, 'inside the old loop region before'); }
  assert.ok(eventsOf(sim, 'wrap').length > 8);

  // repeat grid: lines fall on the same samples with and without a jump
  const spb = 22050;
  const base = { pstart: 1000, pend: 15000, rptdiv: 4, held: 1, playing: 1 };
  const plain = make(rampBuffer(40000), base);
  playFull(plain, [{ at: 0, set: { trig: 1 } }], spb, hostPhase(spb, 0));
  sim = make(rampBuffer(40000), base);
  r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 7000, set: { pstart: 20000, pend: 30000, jump: 1 } }
  ], spb, hostPhase(spb, 0));
  assert.deepEqual(eventsOf(sim, 'line').map(e => e.n), eventsOf(plain, 'line').map(e => e.n), 'grid not reset by the jump');
  assert.equal(eventsOf(sim, 'jump').length, 1);

  // rptalt: the toggle state is kept - a hit that plays mirrored keeps playing mirrored after the jump
  sim = make(rampBuffer(40000), { pstart: 1000, pend: 15000, rptdiv: 4, rptalt: 1, held: 1, playing: 1 });
  r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 7000, set: { pstart: 2000, pend: 12000, jump: 1 } }
  ], spb, hostPhase(spb, 0));
  const st = eventsOf(sim, 'start').map(e => e.n);
  const jm = eventsOf(sim, 'jump')[0];
  assert.deepEqual(eventsOf(sim, 'start').map(e => e.sdir), [1, -1, 1, -1], 'alternation continues undisturbed');
  assert.ok(jm.n > 7000 && jm.n < st[2], 'jump while the 2nd (mirrored) hit sounds');
  assert.equal(jm.sdir, -1, 'still mirrored');
  assert.equal(r.pos[jm.n], 12000, 'mirrored hit starts at the new pend');
  assert.ok(r.pos[jm.n + 10] < r.pos[jm.n + 9], 'and runs backwards');
});

test('jump while waiting between repeats or idle only remembers the counter; kill / trig / repeat line pending take over', () => {
  const spb = 22050;
  // waiting between repeats: nothing to move, the next repeat plays the new slice
  let sim = make(rampBuffer(40000), { pstart: 1000, pend: 1500, rptdiv: 4, held: 1, playing: 1 });
  let r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 3000, set: { pstart: 20000, pend: 21000, jump: 1 } }
  ], spb, hostPhase(spb, 0));
  assert.equal(eventsOf(sim, 'jump').length, 0, 'no move while waiting');
  assert.equal(eventsOf(sim, 'jumpreq').length, 0);
  for (let n = 700; n < 5500; n++) { assert.equal(r.active[n], 1, 'stays active (waiting) ' + n); assert.equal(r.left[n], 0); }
  const s = eventsOf(sim, 'start').map(e => e.n);
  assert.deepEqual(s, [0, 5513, 11025, 16538], 'repeats on the grid');
  assert.equal(r.pos[5513], 20000, 'next repeat plays the new slice');

  // idle: nothing happens at all; the counter is remembered
  sim = make(rampBuffer(40000), { pstart: 3000, pend: 4000 });
  sim.set('jump', 5);
  let q = sim.process(500);
  assert.ok(q.active.every(v => v === 0) && q.left.every(v => v === 0));
  assert.equal(sim.events.length, 0);
  sim.set('trig', 1);
  q = sim.process(100);
  assert.equal(q.pos[0], 3000, 'a later trig starts normally from pstart');
  sim.set('jump', 5);
  sim.set('pstart', 7000);
  sim.process(200);
  assert.equal(eventsOf(sim, 'jump').length, 0, 'the same counter value is no change');
  sim.set('jump', 6);
  sim.process(200);
  assert.equal(eventsOf(sim, 'jump').length, 1, 'a changed counter value moves the hit');
  // trig and jump in the same vector on an idle voice: the trig starts the hit, the jump is ignored
  sim = make(rampBuffer(40000), { pstart: 3000, pend: 6000, jump: 0 });
  sim.set('jump', 1);
  sim.set('trig', 1);
  sim.process(200);
  assert.equal(eventsOf(sim, 'start').length, 1);
  assert.equal(eventsOf(sim, 'jump').length, 0);

  // kill during / before the jump: the kill wins; trig during the jump fade: the new note wins
  sim = make(rampBuffer(40000), { pstart: 3000, pend: 9000, held: 1, trig: 1 });
  sim.process(1000);
  sim.set('kill', 1);
  sim.set('jump', 1);
  r = sim.process(300);
  assert.equal(eventsOf(sim, 'jump').length, 0, 'kill wins');
  assert.equal(r.active[299], 0);
  sim = make(rampBuffer(40000), { pstart: 3000, pend: 9000, held: 1, trig: 1 });
  sim.process(1000);
  sim.set('jump', 1);
  sim.process(10);
  sim.set('pstart', 5000);
  sim.set('trig', 2);
  sim.process(300);
  assert.equal(eventsOf(sim, 'jump').length, 0, 'the pending jump became a full restart');
  assert.equal(eventsOf(sim, 'start').length, 2);

  // a repeat line during a pending jump: the repeat restart takes over (full restart, kind 2)
  sim = make(rampBuffer(40000), { pstart: 1000, pend: 15000, rptdiv: 4, held: 1, playing: 1 });
  r = playFull(sim, [
    { at: 0, set: { trig: 1 } }, { at: 5500, set: { pstart: 20000, pend: 30000, jump: 1 } }
  ], 8000, hostPhase(spb, 0));
  assert.equal(eventsOf(sim, 'jump').length, 0);
  const st2 = eventsOf(sim, 'start');
  assert.equal(st2.length, 2);
  assert.equal(st2[1].kind, 2);
  assert.equal(r.pos[st2[1].n], 20000, 'the repeat plays the new slice');
});

test('redir: a sounding hit turns around where it is - same playhead, no fade, no restart', () => {
  const N = 20000;
  const sim = make(rampBuffer(N), { pstart: 1000, pend: 9000, held: 1, att: 5, dec: 10, sus: 0.7 });
  const r = playFull(sim, [
    { at: 0, set: { trig: 1 } },
    { at: 2000, set: { dir: -1, pend: 1000, redir: 1 } }
  ], 4500);
  assert.equal(r.pos[1999], 2999);
  assert.equal(r.pos[2000], 3000, 'the playhead is where it was');
  for (let k = 0; k < 1500; k++) { assert.equal(r.pos[2000 + k], 3000 - k, 'runs backwards at full speed from there ' + k); }
  // continuous: the output value is the ramp at the playhead times the (untouched) envelope
  const env = 0.7;
  for (let k = 5; k < 1500; k += 7) { close(r.left[2000 + k], env * (3000 - k) / N, 3e-6, 'sample ' + k); }
  assert.ok(maxStep(r.left, 1900, 2100) < 0.0002, 'no click at the turn: ' + maxStep(r.left, 1900, 2100));
  assert.equal(eventsOf(sim, 'start').length, 1);
  assert.equal(eventsOf(sim, 'jump').length, 0);
  for (let n = 1000; n < 4000; n++) { assert.ok(Math.abs(r.env[n] - 0.7) < 1e-9, 'envelope untouched'); }
  // it stops at the new pend (the slice start) with the usual end fade
  const end = firstIndex(r.active, 2000, v => v === 0);
  assert.equal(end, 2000 + 2000, 'ends when the playhead reaches pend 1000');
  assert.ok(Math.abs(r.left[end - 1]) < 0.01);
  // forward again: dir 1 and a nearer pend just shortens the hit
  const sim2 = make(rampBuffer(N), { pstart: 1000, pend: 9000, held: 1, trig: 1 });
  const r2 = playFull(sim2, [{ at: 2000, set: { pend: 4000, redir: 1 } }], 5000);
  assert.equal(firstIndex(r2.active, 100, v => v === 0), 3000, 'stop moved to 4000: ends 1000 samples later');
  // idle voice: nothing
  const sim3 = make(rampBuffer(N), { pstart: 1000, pend: 9000, held: 1 });
  sim3.set('redir', 1);
  const r3 = sim3.process(300);
  assert.ok(r3.active.every(v => v === 0) && sim3.events.length === 0);
});

test('redir: inside a micro-loop the loop region is mirrored; with the stop behind the playhead the hit ends with the end fade', () => {
  // loop: reversing keeps the playhead inside the same region
  let sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  let r = playFull(sim, [{ at: 4000, set: { dir: -1, pend: 1000, redir: 1 } }], 9000);
  for (let n = 100; n < 9000; n++) { assert.ok(r.pos[n] >= 4750 - 1e-9 && r.pos[n] <= 5250 + 1e-9, 'pos in the region at ' + n + ': ' + r.pos[n]); }
  // inside a loop the turn waits for the 1 ms declick (the crossfade partner flips), then runs backwards
  const turn = eventsOf(sim, 'redir')[0];
  assert.ok(turn.n >= 4044 && turn.n <= 4047, 'turn after the ~1 ms fade-out: ' + turn.n);
  assert.equal(turn.looping, 1);
  for (let n = 4001; n < turn.n; n++) { assert.ok(r.pos[n] - r.pos[n - 1] === 1 || r.pos[n] - r.pos[n - 1] === -499, 'still forward before the turn'); }
  for (let n = turn.n + 1; n < 9000; n++) {
    const d = r.pos[n] - r.pos[n - 1];
    assert.ok(d === -1 || d === 499, 'steps backwards, or wraps forward by loop length - 1: ' + d + ' at ' + n);
  }
  assert.equal(r.left[turn.n - 1], 0, 'silent at the turn');
  assert.equal(eventsOf(sim, 'start').length, 1, 'not a restart');
  assert.ok(eventsOf(sim, 'wrap').length >= 17, 'keeps wrapping: ' + eventsOf(sim, 'wrap').length);
  for (let n = 4000; n < 9000; n++) { assert.equal(r.active[n], 1); }
  assert.ok(maxStep(r.left, 3900, turn.n - 50) < 0.0015 && maxStep(r.left, turn.n + 60, 9000) < 0.0015, 'smooth loop either side');
  assert.ok(maxStep(r.left, turn.n - 50, turn.n + 60) < 0.008, 'the fade itself is gentle: ' + maxStep(r.left, turn.n - 50, turn.n + 60));
  assert.ok(r.left[turn.n + 80] > 0.18 && r.left[turn.n + 80] < 0.27, 'back at full level after the fade-in');

  // a jump arriving while the looped turn waits for its fade-out takes it over (and turns as well)
  sim = make(rampBuffer(20000), {
    pstart: 1000, pend: 9000, loopon: 1, loopsize: 500, looppos: 0.5, held: 1, trig: 1
  });
  r = playFull(sim, [
    { at: 4000, set: { dir: -1, pend: 1000, redir: 1 } },
    { at: 4010, set: { pstart: 12000, pend: 6000, jump: 1 } }
  ], 6000);
  assert.equal(eventsOf(sim, 'redir').length, 0);
  const jt = eventsOf(sim, 'jump');
  assert.equal(jt.length, 1);
  assert.equal(jt[0].sdir, -1);
  assert.equal(r.pos[jt[0].n], 12000 - 0.5 * (6000 - 500), 'new loop start of the reversed slice');
  for (let n = jt[0].n; n < 6000; n++) { assert.ok(r.pos[n] > 8750 && r.pos[n] <= 9250, 'inside the new region at ' + n); }

  // stop behind: constant buffer so the fade is visible; trigger mode, no repeat -> idle after ~2 ms
  sim = make(constBuffer(60000, 1), { pstart: 1000, pend: 9000, held: 1, trig: 1 });
  r = playFull(sim, [{ at: 3000, set: { pend: 2500, redir: 1 } }], 4000);
  const end = firstIndex(r.active, 3000, v => v === 0);
  assert.ok(end >= 3000 + 86 && end <= 3000 + 90, 'ends after the 2 ms end fade: ' + (end - 3000));
  assert.equal(r.left[3000], 1, 'the fade starts from the full level');
  for (let n = 3000; n < end - 1; n++) { assert.ok(r.left[n + 1] <= r.left[n] + 1e-9, 'monotonic fade at ' + n); }
  assert.ok(maxStep(r.left, 2900, 3200) < 0.015, 'no click: ' + maxStep(r.left, 2900, 3200));
  assert.equal(r.left[end], 0);
  assert.equal(eventsOf(sim, 'end').pop().why, 'pend');

  // with repeat on and the key held, the finished hit waits for the next repeat like any other
  const spb = 22050;
  sim = make(constBuffer(60000, 1), { pstart: 1000, pend: 9000, rptdiv: 4, held: 1, playing: 1, trig: 1 });
  r = playFull(sim, [{ at: 3000, set: { pend: 2500, redir: 1 } }], 8000, hostPhase(spb, 0));
  assert.equal(r.left[3200], 0);
  for (let n = 3000; n < 5500; n++) { assert.equal(r.active[n], 1, 'waiting, still active ' + n); }
  const w0 = eventsOf(sim, 'wait')[0].n;
  assert.ok(w0 >= 3086 && w0 <= 3092, 'waits after the end fade: ' + w0);
  assert.equal(eventsOf(sim, 'start')[1].n, 5513, 'the next repeat restarts it on the grid');
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

// ---------------------------------------------------------------------------
// cutoff smoothing (gesture sweeps update `cutoff` every ~15 ms)
// ---------------------------------------------------------------------------

const CS_KEEP = Math.exp(-1 / (0.01 * SR));       // one-pole memory per sample (tau 10 ms)
const CS_COEF = 1 - CS_KEEP;

/** Play a script of {at, set} events on a sim; collects left and the effective cutoff (Hz). */
function playScript(sim, script, total, phaseFn) {
  const out = { left: new Float32Array(total), cut: new Float64Array(total), active: new Float32Array(total) };
  const ev = script.slice().sort((a, b) => a.at - b.at);
  let t = 0, ei = 0;
  while (t < total) {
    while (ei < ev.length && ev[ei].at <= t) {
      Object.keys(ev[ei].set).forEach(k => sim.set(k, ev[ei].set[k]));
      ei++;
    }
    const until = Math.min(total, ei < ev.length ? ev[ei].at : total);
    const len = Math.max(1, until - t);
    const r = sim.process(len, phaseFn);
    out.left.set(r.left, t); out.cut.set(r.cut, t); out.active.set(r.active, t);
    t += len;
  }
  return out;
}

/** largest |log2| change of the cutoff between neighbouring rendered samples */
function maxOctaveStep(cut, from, to) {
  let m = 0;
  for (let i = from + 1; i < to; i++) {
    if (cut[i] > 0 && cut[i - 1] > 0) { m = Math.max(m, Math.abs(Math.log2(cut[i] / cut[i - 1]))); }
  }
  return m;
}

/** peak of |d| over a sliding window of w samples (envelope of an oscillating difference) */
function windowPeak(d, w) {
  const e = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) {
    let m = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) { m = Math.max(m, Math.abs(d[j])); }
    e[i] = m;
  }
  return e;
}

test('cutoff smoothing: a step mid-note glides as a one-pole in log2(Hz), tau 10 ms (no jump in the coefficient)', () => {
  const sim = make(sineBuffer(60000, 220, 0.6), { pstart: 0, pend: 50000, held: 1 });
  const r = playScript(sim, [
    { at: 0, set: { cutoff: 4000, trig: 1 } },
    { at: 3000, set: { cutoff: 500 } }
  ], 8000);
  // before the step: exactly the requested cutoff
  close(r.cut[1], 4000, 1e-6, 'cutoff before the step');
  close(r.cut[2999], 4000, 1e-6, 'unchanged until the step');
  // after the step: cs_n = target + (start - target) * keep^(n+1), in log2(Hz)
  const l0 = Math.log2(4000), l1 = Math.log2(500);
  for (const n of [0, 1, 10, 100, 441, 1000, 2000]) {
    const expected = Math.pow(2, l1 + (l0 - l1) * Math.pow(CS_KEEP, n + 1));
    close(r.cut[3000 + n] / expected, 1, 1e-9, 'cutoff ' + n + ' samples after the step');
  }
  // no jump: the very first sample moves by (distance * coefficient) only, never more
  const maxOct = (l0 - l1) * CS_COEF;
  assert.ok(r.cut[3000] < r.cut[2999] && r.cut[3000] > 3900, 'first sample barely moves: ' + r.cut[3000]);
  assert.ok(maxOctaveStep(r.cut, 2990, 8000) <= maxOct * (1 + 1e-9), 'per-sample change <= distance * coefficient');
  for (let n = 3001; n < 8000; n++) { assert.ok(r.cut[n] <= r.cut[n - 1], 'monotonic glide at ' + n); }
  // one time constant (441 samples): 63 % of the way in log2, 500 * 2^(3 * e^-1) ~ 1075 Hz
  close(r.cut[3000 + 440] / Math.pow(2, l1 + (l0 - l1) * Math.exp(-1)), 1, 1e-9, 'one tau after the step');
  close(r.cut[3000 + 440] / 1075, 1, 0.005, 'one tau after the step (absolute)');
  close(r.cut[7999] / 500, 1, 1e-3, 'settles on the target');
  // and the audio follows without a step
  assert.ok(maxStep(r.left, 2000, 8000) < 2 * Math.PI * 220 / SR * 0.6 * 1.05, 'no click in the audio');
});

test('cutoff smoothing: the old (unsmoothed) behaviour is gone - a 500 -> 20000 step is not an instant switch', () => {
  const buf = sineBuffer(60000, 1000, 0.5);
  const sim = make(buf, { pstart: 0, pend: 50000, held: 1 });
  const r = playScript(sim, [
    { at: 0, set: { cutoff: 500, trig: 1 } },
    { at: 5000, set: { cutoff: 20000 } }
  ], 12000);
  // an instant switch from the 500 Hz filter (-6 dB, ~-90 deg at 1 kHz) to dry would step by ~0.36
  const natural = 2 * Math.PI * 1000 / SR * 0.5;
  assert.ok(maxStep(r.left, 2000, 12000) < natural * 1.05, 'max step ' + maxStep(r.left, 2000, 12000));
});

test('cutoff smoothing: every (re)start snaps to the target - trig, retrigger, kill then trig, repeat line', () => {
  const buf = sineBuffer(60000, 220, 0.6);
  const SNAP = 1e-6;

  // idle voice: a new hit starts exactly at its cutoff, whatever the previous hit did
  let sim = make(buf, { pstart: 0, pend: 3000, held: 1 });
  let r = playScript(sim, [
    { at: 0, set: { cutoff: 500, trig: 1 } },
    { at: 5000, set: { cutoff: 8000, trig: 2 } }
  ], 7000);
  assert.equal(r.active[4000], 0, 'first hit is over');
  close(r.cut[5000], 8000, SNAP, 'first sample of the new hit');
  close(r.cut[0], 500, SNAP, 'first sample of the first hit');

  // retrigger of a sounding voice: it glides during the 1 ms fade-out, then snaps at the restart
  sim = make(buf, { pstart: 0, pend: 50000, held: 1 });
  r = playScript(sim, [
    { at: 0, set: { cutoff: 500, trig: 1 } },
    { at: 4000, set: { cutoff: 8000, trig: 2 } }
  ], 6000);
  const restart = eventsOf(sim, 'start')[1].n;
  assert.ok(restart > 4000 && restart < 4050, 'restart after the fade: ' + restart);
  assert.ok(r.cut[restart - 1] < 1000, 'still gliding during the fade-out: ' + r.cut[restart - 1]);
  close(r.cut[restart], 8000, SNAP, 'snapped at the restart');

  // kill, then trig during the kill fade: the new note wins and starts at its cutoff
  sim = make(buf, { pstart: 0, pend: 50000, held: 1 });
  r = playScript(sim, [
    { at: 0, set: { cutoff: 500, trig: 1 } },
    { at: 4000, set: { kill: 1 } },
    { at: 4020, set: { cutoff: 6000, trig: 2 } }
  ], 6000);
  const restart2 = eventsOf(sim, 'start')[1].n;
  assert.ok(restart2 > 4020 && restart2 < 4100, 'restart after kill + trig: ' + restart2);
  close(r.cut[restart2], 6000, SNAP, 'snapped after kill -> trig');
  assert.ok(r.cut[restart2 - 1] < 800, 'was gliding before: ' + r.cut[restart2 - 1]);

  // repeat: a waiting voice restarts on the line at the cutoff set in between; so does a sounding one
  const spb = 22050;
  for (const pend of [2000, 15000]) {
    sim = make(buf, { pstart: 1000, pend: pend, rptdiv: 4, held: 1, playing: 1 });
    r = playScript(sim, [
      { at: 0, set: { cutoff: 20000, trig: 1 } },
      { at: 3000, set: { cutoff: 300 } },
      { at: 8000, set: { cutoff: 5000 } }
    ], spb, hostPhase(spb, 0));
    const st = eventsOf(sim, 'start').map(e => e.n);
    assert.equal(st.length, 4, 'four hits (pend ' + pend + ')');
    close(r.cut[st[1]], 300, SNAP, 'repeat 1 at 300 Hz (pend ' + pend + ')');
    close(r.cut[st[2]], 5000, SNAP, 'repeat 2 at 5000 Hz (pend ' + pend + ')');
    close(r.cut[st[3]], 5000, SNAP, 'repeat 3 at 5000 Hz (pend ' + pend + ')');
    if (pend === 15000) { assert.ok(r.cut[st[2] - 1] < 4990 && r.cut[st[2] - 1] > 300, 'sounding repeat glided before snapping'); }
  }
});

test('cutoff bypass (>= 19000) is decided on the smoothed value and cross-faded: no switching click', () => {
  const N = 60000, TOTAL = 9000, STEP = 3000;
  for (const f of [3000, 8000]) {
    const buf = sineBuffer(N, f, 0.5);
    const base = { pstart: 0, pend: 50000, held: 1 };
    const dry = playScript(make(buf, base), [{ at: 0, set: { cutoff: 20000, trig: 1 } }], TOTAL);

    // 20000 -> 18000: stays dry until the smoothed cutoff crosses 19000, then fades to the filter in 2 ms
    const down = playScript(make(buf, base), [
      { at: 0, set: { cutoff: 20000, trig: 1 } }, { at: STEP, set: { cutoff: 18000 } }
    ], TOTAL);
    const d1 = new Float64Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) { d1[i] = down.left[i] - dry.left[i]; }
    const first = firstIndex(d1, 0, v => v !== 0);
    // smoothed value: log2(18000) + (log2(24000) - log2(18000)) * keep^(n+1) reaches 19000
    const nCross = Math.log((Math.log2(24000) - Math.log2(18000)) / (Math.log2(19000) - Math.log2(18000))) / -Math.log(CS_KEEP);
    assert.ok(Math.abs((first - STEP) - nCross) <= 3, f + ' Hz: bypass leaves at ' + (first - STEP) + ' vs ' + nCross.toFixed(1));
    assert.ok(down.cut[first - 1] >= 19000 && down.cut[first] < 19000, 'switch happens when the smoothed cutoff crosses 19000');
    const e1 = windowPeak(d1, 16);
    let maxE1 = 0, stepE1 = 0;
    for (let i = STEP; i < TOTAL; i++) { maxE1 = Math.max(maxE1, e1[i]); stepE1 = Math.max(stepE1, Math.abs(e1[i] - e1[i - 1])); }
    assert.ok(maxE1 > 0.03, 'the filter really engages: ' + maxE1);
    assert.ok(stepE1 < 0.15 * maxE1, f + ' Hz: filter fades in, no step (' + stepE1 + ' of ' + maxE1 + ')');
    // settles on the plain 18000 Hz filter
    const ref = playScript(make(buf, base), [{ at: 0, set: { cutoff: 18000, trig: 1 } }], TOTAL);
    assert.ok(maxAbsDiff(down.left.subarray(8000), ref.left.subarray(8000)) < 1e-5, 'same as a hit that started at 18000');

    // 500 -> 20000: filtered until the smoothed value crosses 19000, then 2 ms fade to the exact dry signal
    const up = playScript(make(buf, base), [
      { at: 0, set: { cutoff: 500, trig: 1 } }, { at: STEP, set: { cutoff: 20000 } }
    ], TOTAL);
    const d2 = new Float64Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) { d2[i] = up.left[i] - dry.left[i]; }
    let last = -1;
    for (let i = 0; i < TOTAL; i++) { if (d2[i] !== 0) { last = i; } }
    const nUp = Math.log((Math.log2(24000) - Math.log2(500)) / (Math.log2(24000) - Math.log2(19000))) / -Math.log(CS_KEEP);
    const cross = firstIndex(up.cut, STEP, v => v >= 19000);
    assert.ok(Math.abs((cross - STEP) - nUp) <= 3, f + ' Hz: crossing at ' + (cross - STEP) + ' vs ' + nUp.toFixed(1));
    assert.ok(last - cross >= 80 && last - cross <= 95, f + ' Hz: 2 ms cross-fade after the crossing: ' + (last - cross));
    assert.equal(maxAbsDiff(up.left.subarray(last + 1), dry.left.subarray(last + 1)), 0, 'exactly dry afterwards');
    const e2 = windowPeak(d2, 16);
    let maxE2 = 0, stepE2 = 0;
    for (let i = STEP; i < TOTAL; i++) { maxE2 = Math.max(maxE2, e2[i]); stepE2 = Math.max(stepE2, Math.abs(e2[i] - e2[i - 1])); }
    assert.ok(stepE2 < 0.15 * maxE2, f + ' Hz: filter fades out, no step (' + stepE2 + ' of ' + maxE2 + ')');
  }
  // a hit that starts at >= 19000 is dry from its first sample, also after a filtered hit
  const buf2 = sineBuffer(N, 3000, 0.5);
  const dry2 = playScript(make(buf2, { pstart: 0, pend: 3000, held: 1 }), [{ at: 0, set: { cutoff: 20000, trig: 1 } }], 3000);
  const two = playScript(make(buf2, { pstart: 0, pend: 3000, held: 1 }), [
    { at: 0, set: { cutoff: 400, trig: 1 } }, { at: 4000, set: { cutoff: 19000, trig: 2 } }
  ], 7000);
  assert.equal(maxAbsDiff(two.left.subarray(4000, 7000), dry2.left), 0, 'second hit is exactly dry');
  // ... and a hit that starts below 19000 is filtered from its first sample, whatever the previous hit was
  const afterDry = playScript(make(buf2, { pstart: 0, pend: 3000, held: 1 }), [
    { at: 0, set: { cutoff: 20000, trig: 1 } }, { at: 4000, set: { cutoff: 400, trig: 2 } }
  ], 7000);
  const afterFiltered = playScript(make(buf2, { pstart: 0, pend: 3000, held: 1 }), [
    { at: 0, set: { cutoff: 5000, trig: 1 } }, { at: 4000, set: { cutoff: 400, trig: 2 } }
  ], 7000);
  assert.equal(maxAbsDiff(afterDry.left.subarray(4000, 7000), afterFiltered.left.subarray(4000, 7000)), 0, 'hit start does not depend on the previous hit');
  assert.ok(rms(afterDry.left, 4100, 7000) < 0.05 * rms(dry2.left, 100, 3000), 'the 400 Hz filter is on from the start (3 kHz tone is cut)');
});

test('cutoff sweeps 20000 -> 500 and 500 -> 20000 over 1 s in 15 ms parameter steps: no click, no zipper', () => {
  const STEPS = 66;
  const every = Math.round(0.015 * SR);      // 662 samples
  const total = Math.round(1.0 * SR) + 6000;
  for (const f of [200, 3000]) {
    for (const dirUp of [false, true]) {
      const from = dirUp ? 500 : 20000, to = dirUp ? 20000 : 500;
      const script = [{ at: 0, set: { cutoff: from, trig: 1 } }];
      for (let k = 1; k <= STEPS; k++) {
        script.push({ at: k * every, set: { cutoff: from * Math.pow(to / from, k / STEPS) } });
      }
      const amp = 0.5;
      const sim = make(sineBuffer(80000, f, amp), { pstart: 0, pend: 70000, held: 1 });
      const r = playScript(sim, script, total);
      const label = f + ' Hz ' + from + '->' + to;
      for (let i = 0; i < total; i++) { assert.ok(Number.isFinite(r.left[i]), 'finite ' + label); }
      // the output never steps more than the plain sine does
      const natural = 2 * Math.PI * f / SR * amp;
      assert.ok(maxStep(r.left, 100, total) <= natural * 1.02, label + ' max step ' + maxStep(r.left, 100, total) + ' vs ' + natural);
      // the cutoff glides: no per-sample change beyond 0.001 octave (a raw 15 ms step is 0.08 octave)
      assert.ok(maxOctaveStep(r.cut, 0, total) < 0.001, label + ' cutoff step ' + maxOctaveStep(r.cut, 0, total));
      // and it ends on the final value (clamped to 0.45 * fs where the bypass takes over)
      close(r.cut[total - 1] / Math.min(to, 0.45 * SR), 1, 0.002, label + ' final cutoff');
      for (let n = 2; n < total; n++) {
        assert.ok(dirUp ? r.cut[n] >= r.cut[n - 1] - 1e-9 : r.cut[n] <= r.cut[n - 1] + 1e-9, label + ' monotonic sweep at ' + n);
      }
    }
  }
  // a swept-up voice ends up exactly dry
  const buf3 = sineBuffer(80000, 3000, 0.5);
  const script3 = [{ at: 0, set: { cutoff: 500, trig: 1 } }];
  for (let k = 1; k <= STEPS; k++) { script3.push({ at: k * every, set: { cutoff: 500 * Math.pow(40, k / STEPS) } }); }
  const swept = playScript(make(buf3, { pstart: 0, pend: 70000, held: 1 }), script3, total);
  const dry3 = playScript(make(buf3, { pstart: 0, pend: 70000, held: 1 }), [{ at: 0, set: { cutoff: 20000, trig: 1 } }], total);
  assert.equal(maxAbsDiff(swept.left.subarray(total - 2000), dry3.left.subarray(total - 2000)), 0, 'exactly dry once the sweep is over');
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
  assert.equal(Object.keys(VoiceSim.PARAMS).length, 28);
  const names = ['bufsr', 'pstart', 'pend', 'dir', 'pitch', 'amp', 'att', 'dec', 'sus', 'rel', 'gatemode', 'held',
    'loopon', 'loopsize', 'looppos', 'rptdiv', 'rptswing', 'rptalt', 'cutoff', 'drive', 'tape', 'tapems', 'bpm',
    'playing', 'trig', 'kill', 'jump', 'redir'];
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
const ALLOWED_CALLS = ['floor', 'abs', 'min', 'max', 'tanh', 'exp', 'log', 'tan', 'sqrt', 'peek', 'dim', 'channels'];
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
      'floor', 'abs', 'min', 'max', 'tanh', 'exp', 'tan', 'sqrt', 'peek', 'dim', 'channels', 'log', code);
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
          Math.tanh, Math.exp, Math.tan, Math.sqrt, peek, dim, channels, Math.log);
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
    'playing', 'trig', 'kill', 'jump', 'redir'];
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

test('parity: cutoff steps and sweeps mid-note (smoothing, bypass crossings both ways, snaps at restarts)', () => {
  // bright, stereo, deterministic material so that the filter really matters
  const rnd = mulberry32(4242);
  const l = new Float32Array(60000), r = new Float32Array(60000);
  for (let i = 0; i < 60000; i++) {
    const tone = 0.3 * Math.sin(2 * Math.PI * 2500 * i / SR);
    l[i] = tone + 0.3 * (rnd() * 2 - 1);
    r[i] = 0.3 * Math.sin(2 * Math.PI * 7000 * i / SR) + 0.3 * (rnd() * 2 - 1);
  }
  const buf = { channels: [l, r], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 55000, held: 1, cutoff: 20000, trig: 1 } },
    { at: 3000, set: { cutoff: 18000 } },          // bypass -> filter (crossing after ~17 ms)
    { at: 9000, set: { cutoff: 600 } },
    { at: 12000, set: { cutoff: 24000 } },         // filter -> bypass
    { at: 16000, set: { cutoff: 19000 } },         // exactly the bypass limit
    { at: 18000, set: { cutoff: 18999, trig: 2 } },    // retrigger with a changed cutoff (snap)
    { at: 21000, set: { cutoff: 90000 } },         // above the Param range of the filter clamp
    { at: 22000, set: { cutoff: 1 } },             // the lowest value (clamped to 10 Hz in the filter)
    { at: 24000, set: { cutoff: 3000, kill: 1 } },
    { at: 24050, set: { cutoff: 150, trig: 3 } },  // kill then trig: the new note wins
    { at: 26000, set: { cutoff: 20000, held: 0 } },
    { at: 27000, set: { cutoff: 800, held: 1, trig: 4, rptdiv: 8, playing: 1, pend: 4000 } }
  ];
  // a 1 s sweep in 15 ms steps (20000 -> 500) and back, starting at 30000
  const every = 662;
  for (let k = 1; k <= 66; k++) { script.push({ at: 30000 + k * every, set: { cutoff: 20000 * Math.pow(0.025, k / 66) } }); }
  for (let k = 1; k <= 66; k++) { script.push({ at: 75000 + k * every, set: { cutoff: 500 * Math.pow(40, k / 66) } }); }
  const out = parity(buf, script, 125000, hostPhase(SPB, 321));
  assert.ok(rms(out.left, 0, 3000) > 0.05 && rms(out.right, 80000, 90000) > 0.001, 'non-trivial audio');
});

test('parity: jump and redir (scan / reverse) in plain, looping, repeating, mirrored, tape and releasing hits', () => {
  const buf = { channels: [sineBuffer(60000, 260, 0.6).channels[0], sineBuffer(60000, 410, 0.5).channels[0]], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 20000, att: 5, dec: 40, sus: 0.6, rel: 60, gatemode: 1, held: 1, cutoff: 5000, trig: 1 } },
    { at: 3000, set: { pstart: 30000, pend: 45000, jump: 1 } },              // plain jump
    { at: 6000, set: { dir: -1, pend: 33000, redir: 1 } },                    // turn around
    { at: 9000, set: { pstart: 12000, pend: 6000, dir: -1, loopon: 1, loopsize: 300, looppos: 0.4, trig: 2 } },
    { at: 11000, set: { dir: 1, pend: 20000, redir: 2 } },                    // turn inside the loop (declicked)
    { at: 13000, set: { pstart: 40000, pend: 52000, dir: 1, jump: 2 } },     // jump with a loop
    { at: 13010, set: { jump: 3, pstart: 3000, pend: 9000 } },               // jump while the jump fades
    { at: 16000, set: { loopon: 0, pend: 3500, redir: 3 } },                  // stop behind: end fade
    { at: 18000, set: { jump: 4 } },                                          // jump when idle: remembered
    { at: 19000, set: { pstart: 5000, pend: 15000, trig: 3, rptdiv: 4, rptalt: 1, playing: 1, gatemode: 0 } },
    { at: 26000, set: { pstart: 20000, pend: 26000, jump: 5 } },             // inside a mirrored repeat hit
    { at: 31000, set: { jump: 6 } },
    { at: 31010, set: { redir: 4, dir: -1, pend: 4000 } },                   // redir during the jump fade (ignored)
    { at: 36000, set: { tape: 1, tapems: 120 } },
    { at: 37000, set: { pstart: 1000, pend: 9000, jump: 7 } },               // jump on a tape-stopping voice
    { at: 42000, set: { tape: 0, held: 0 } },
    { at: 43000, set: { pstart: 22000, pend: 24000, jump: 8, redir: 5 } },    // while waiting / released
    { at: 46000, set: { held: 1, trig: 4, rptdiv: 8, pstart: 2000, pend: 40000 } },
    { at: 48000, set: { kill: 1, jump: 9 } },                                 // kill wins
    { at: 50000, set: { trig: 5 } },
    { at: 50500, set: { trig: 6, jump: 10 } },                                // trig + jump in one vector
    { at: 52000, set: { pstart: 4000, pend: 41000, jump: 11, redir: 6 } }     // jump wins over a redir
  ];
  const out = parity(buf, script, 60000, hostPhase(SPB, 555));
  assert.ok(rms(out.left, 0, 3000) > 0.05);
  const names = out.events.map(e => e.type);
  ['jump', 'redir'].forEach(k => assert.ok(names.indexOf(k) >= 0, 'scenario exercises ' + k));
});

test('parity: a repeat line arriving while a jump or a looped turn is waiting for its fade-out', () => {
  const buf = { channels: [sineBuffer(60000, 330, 0.6).channels[0]], sr: SR };
  const script = [
    { at: 0, set: { pstart: 1000, pend: 15000, loopon: 1, loopsize: 400, looppos: 0.5, rptdiv: 4, playing: 1, held: 1, att: 8, dec: 30, sus: 0.5, trig: 1 } },
    { at: 5500, set: { dir: -1, pend: 1000, redir: 1 } },                     // looped turn pending at the line (5513)
    { at: 11010, set: { pstart: 30000, pend: 40000, dir: 1, jump: 1 } },     // jump pending at the line (11025)
    { at: 16520, set: { jump: 2 } },                                          // jump, then redir, then the line (16538)
    { at: 16525, set: { redir: 2, dir: -1, pend: 2000 } },
    { at: 19000, set: { redir: 3, dir: 1, pend: 14000 } },                    // looped turn pending ...
    { at: 19010, set: { jump: 3, pstart: 20000, pend: 26000 } },              // ... the jump takes it over
    { at: 22000, set: { loopon: 0, pstart: 1000, pend: 15000, dir: 1 } },
    { at: 27500, set: { jump: 4 } },                                          // not looping now
    { at: 33040, set: { redir: 4, dir: -1, pend: 5000 } }
  ];
  const out = parity(buf, script, 45000, hostPhase(SPB, 0));
  const kinds = out.events.filter(e => e.type === 'start').map(e => e.kind);
  assert.ok(kinds.filter(k => k === 2).length >= 4, 'repeat restarts happened: ' + kinds.join(','));
  assert.ok(out.events.filter(e => e.type === 'jump').length <= 2, 'the jumps that met a line became repeat restarts');
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
    let trigN = 0, killN = 0, jumpN = 0, redirN = 0;
    const total = 60000;
    let at = 0;
    while (at < total) {
      const set = {};
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const what = pick(['trig', 'trig', 'held', 'gatemode', 'loop', 'rpt', 'rpt', 'pitch', 'slice', 'slice', 'filter', 'drive',
          'tape', 'env', 'amp', 'kill', 'bpm', 'playing', 'bufsr', 'dir', 'jump', 'jump', 'redir', 'redir']);
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
        else if (what === 'filter') { set.cutoff = pick([1, 40, 300, 2000, 8000, 12000, 17500, 18999, 19000, 20000, 60000]); }
        else if (what === 'drive') { set.drive = pick([0, 0.2, 1]); }
        else if (what === 'tape') { set.tape = rnd() < 0.5 ? 1 : 0; set.tapems = pick([5, 50, 400]); }
        else if (what === 'env') { set.att = pick([0, 2, 30]); set.dec = pick([0, 10, 120]); set.sus = pick([0, 0.4, 1]); set.rel = pick([0, 5, 80, 400]); }
        else if (what === 'amp') { set.amp = pick([0, 0.3, 1, 2]); }
        else if (what === 'kill') { set.kill = ++killN; }
        else if (what === 'bpm') { set.bpm = pick([60, 90, 120, 174]); }
        else if (what === 'playing') { set.playing = rnd() < 0.5 ? 1 : 0; }
        else if (what === 'bufsr') { set.bufsr = pick([22050, 44100, 48000, 96000]); }
        else if (what === 'dir') { set.dir = rnd() < 0.5 ? 1 : -1; }
        else if (what === 'jump') {
          set.jump = ++jumpN;
          if (rnd() < 0.7) {
            const a = Math.floor(rnd() * frames), len = Math.floor(rnd() * 4000) + 1;
            set.pstart = a; set.pend = Math.min(frames + 500, a + len); set.dir = 1;
          }
        }
        else if (what === 'redir') {
          set.redir = ++redirN;
          set.dir = rnd() < 0.5 ? 1 : -1;
          set.pend = Math.floor(rnd() * frames);
        }
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
  ['trig', 'start:1', 'start:2', 'line', 'wait', 'wrap', 'kill', 'end:pend', 'end:release', 'end:kill', 'end:wait',
    'jumpreq', 'jump', 'redir'].forEach(key => {
    assert.ok((coverage[key] || 0) >= (key === 'end:wait' ? 3 : 10), 'fuzz coverage of "' + key + '": ' + (coverage[key] || 0));
  });
});
