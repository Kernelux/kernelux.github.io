'use strict';
/*
 * Tests for max/recorder.genexpr (the gen~ ring-buffer recorder used by "kit capture").
 *
 * Max is not available here, so, like test/voice-sim.test.js does for the voice,
 * the GenExpr file is
 *   1. linted against the GenExpr rules we rely on (block scope, History usage,
 *      allowed operators, reserved names, declarations first), and
 *   2. translated to JavaScript by a small translator and run sample by sample
 *      against mock buffer~ objects.
 * The translator is a trimmed copy of the one in voice-sim.test.js (that file
 * cannot be required without running its tests).
 * Run: cd slicekit && node --test test/recorder.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GENEXPR_FILE = path.join(__dirname, '..', 'max', 'recorder.genexpr');

// ---------------------------------------------------------------------------
// GenExpr -> JS translator and linter (subset needed by the recorder)
// ---------------------------------------------------------------------------

// names that must not be used for Buffers / Histories / variables (gen~ operators,
// constants, keywords). Same list as in voice-sim.test.js.
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
const ALLOWED_CALLS = ['dim', 'poke'];
const KEYWORDS = ['if', 'else'];
const INPUTS = ['in1', 'in2'];
const OUTPUTS = ['out1'];

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
  const text = raw.replace(/\/\/[^\n]*/g, '');

  const histories = {};
  const buffers = [];
  let hasParam = false;

  // declarations come first
  let pos = 0;
  for (;;) {
    const ws = /^\s*/.exec(text.slice(pos))[0].length;
    const rest = text.slice(pos + ws);
    let m;
    if ((m = /^History\s+(\w+)\s*\(\s*(-?[\d.]+)\s*\)\s*;/.exec(rest))) {
      histories[m[1]] = Number(m[2]);
      pos += ws + m[0].length;
    } else if ((m = /^Buffer\s+(\w+)\s*;/.exec(rest))) {
      buffers.push(m[1]);
      pos += ws + m[0].length;
    } else {
      break;
    }
  }
  const body = text.slice(pos);
  if (/\b(Param|History|Buffer|Data|Delay)\b/.test(body)) { errors.push('declarations must come before any code'); }
  if (/\bParam\b/.test(text)) { hasParam = true; errors.push('the recorder has no Params'); }

  Object.keys(histories).concat(buffers).forEach(n => {
    if (GEN_RESERVED.indexOf(n.toLowerCase()) >= 0) { errors.push('declared name clashes with a gen name: ' + n); }
  });

  const toks = tokenize(body);
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
  const histRead = {};
  const histWrite = {};
  const outputWrites = {};

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    if (t.k === 'op') {
      if (t.v === '{') {
        scopes.push(new Set()); depth++;
        const prev = toks[i - 1];
        if (!(prev && (prev.v === ')' || prev.v === 'else'))) { errors.push('unexpected block'); }
      } else if (t.v === '}') {
        scopes.pop(); depth--;
      } else if (t.v === ';') {
        pendingDecl.splice(0).forEach(n => { scopes[scopes.length - 1].add(n); });
      }
      continue;
    }
    if (t.k !== 'id') { continue; }
    const name = t.v;
    if (KEYWORDS.indexOf(name) >= 0) {
      if (name === 'if' && (!next || next.v !== '(')) { errors.push('if needs ('); }
      if (name === 'else' && (!next || (next.v !== '{' && next.v !== 'if'))) { errors.push('else needs { or if'); }
      continue;
    }
    if (next && next.v === '(') {
      if (ALLOWED_CALLS.indexOf(name) < 0) { errors.push('unknown function/operator: ' + name); }
      continue;
    }
    if (name in histories) {
      if (next && next.v === '=') { histWrite[name] = (histWrite[name] || []).concat([{ i: i, depth: depth }]); }
      else { histRead[name] = (histRead[name] || []).concat([{ i: i, depth: depth }]); }
      continue;
    }
    if (buffers.indexOf(name) >= 0) { continue; }
    if (INPUTS.indexOf(name) >= 0) {
      if (next && next.v === '=') { errors.push('assignment to input ' + name); }
      continue;
    }
    if (OUTPUTS.indexOf(name) >= 0) {
      if (next && next.v === '=') {
        outputWrites[name] = (outputWrites[name] || 0) + 1;
        if (depth !== 0) { errors.push(name + ' assigned inside a block'); }
      } else { errors.push(name + ' read'); }
      continue;
    }
    if (GEN_RESERVED.indexOf(name.toLowerCase()) >= 0) { errors.push('variable name clashes with a gen name: ' + name); }
    const isAssign = next && next.v === '=';
    const known = scopes.some(s => s.has(name));
    if (isAssign) {
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

  // History discipline: exactly one read ("x = h;") and one write ("h = x;"), both at top level,
  // read before write -> correct whatever the History read-after-write semantics are
  Object.keys(histories).forEach(h => {
    const r = histRead[h] || [];
    const w = histWrite[h] || [];
    if (r.length !== 1 || w.length !== 1) { errors.push('History ' + h + ' must be read once and written once (' + r.length + '/' + w.length + ')'); return; }
    if (r[0].depth !== 0 || w[0].depth !== 0) { errors.push('History ' + h + ' accessed inside a block'); }
    if (r[0].i > w[0].i) { errors.push('History ' + h + ' written before it is read'); }
    const local = toks[r[0].i - 2] && toks[r[0].i - 2].v;
    if (!(toks[r[0].i - 1].v === '=' && toks[r[0].i + 1].v === ';')) { errors.push('History read must be "x = ' + h + ';"'); }
    const wt = toks.slice(w[0].i, w[0].i + 4).map(x => x.v).join(' ');
    if (wt !== h + ' = ' + local + ' ;') { errors.push('History write must be "' + h + ' = ' + local + ';" got ' + wt); }
  });

  OUTPUTS.forEach(o => { if (outputWrites[o] !== 1) { errors.push(o + ' must be assigned exactly once'); } });
  locals.forEach(n => { if (!reads[n]) { warnings.push('assigned but never read: ' + n); } });

  // translate
  const mapped = toks.map(t => (t.k === 'id' && t.v in histories ? 'H.' + t.v : t.v));
  const js = [];
  js.push('var ' + Array.from(locals).concat(OUTPUTS).map(n => n + ' = NaN').join(', ') + ';');
  js.push(mapped.join(' '));
  js.push('return out1;');
  const code = js.join('\n');
  let fn = null;
  if (errors.length === 0) {
    fn = new Function('H', buffers[0], buffers[1], 'in1', 'in2', 'dim', 'poke', code);
  }
  return { errors: errors, warnings: warnings, histories: histories, buffers: buffers, hasParam: hasParam, fn: fn, code: code };
}

// ---------------------------------------------------------------------------
// mock gen~ runtime: buffer~ objects, dim(), poke()
// ---------------------------------------------------------------------------

/** a buffer~ with `frames` frames and `chans` channels (float32 like the real thing); null = not bound */
function makeBuffer(frames, chans) {
  const channels = [];
  for (let c = 0; c < chans; c++) { channels.push(new Float32Array(frames)); }
  return { channels: channels };
}

const dim = b => (b && b.channels && b.channels.length ? b.channels[0].length : 0);

/** gen~ poke(buffer, value, index, channel): default bound mode "ignore" for out-of-range index / channel */
const pokeCalls = [];
let recordPokes = false;      // only the tests that inspect the calls switch this on (the long ring test would flood it)
const poke = function (b, value, index, channel) {
  if (recordPokes) { pokeCalls.push({ buffer: b, value: value, index: index, channel: channel }); }
  if (!b || !b.channels) { return; }
  const ch = b.channels[channel];
  const i = Math.floor(index);
  if (!ch || i < 0 || i >= ch.length) { return; }
  ch[i] = value;
};

/** Run the translated recorder; the buffers can be swapped between calls (like `cap <name>` messages). */
function createRecorder(compiled, bufs) {
  const H = {};
  Object.keys(compiled.histories).forEach(n => { H[n] = compiled.histories[n]; });
  const bound = { cap: bufs.cap || null, wpb: bufs.wpb || null };
  return {
    H: H,
    bind(name, b) { bound[name] = b; },
    tick(l, r) { return compiled.fn(H, bound.cap, bound.wpb, l, r, dim, poke); },
    run(n, lf, rf) {
      const out = new Float64Array(n);
      for (let i = 0; i < n; i++) { out[i] = this.tick(lf(i), rf ? rf(i) : 0); }
      return out;
    }
  };
}

const RAW = fs.readFileSync(GENEXPR_FILE, 'utf8');
const COMPILED = compileGenExpr(RAW);

// ---------------------------------------------------------------------------
// lint
// ---------------------------------------------------------------------------

test('recorder.genexpr: lint (declarations, block scope, History discipline, operators, reserved names)', () => {
  assert.deepEqual(COMPILED.errors, []);
  assert.deepEqual(COMPILED.warnings, []);
  assert.ok(COMPILED.fn, 'compiles to JS');
  assert.equal(COMPILED.hasParam, false);
});

test('recorder.genexpr: Buffer cap, Buffer wpb, History wp, in1/in2, out1 as documented in PROTOCOL.md', () => {
  assert.deepEqual(COMPILED.buffers, ['cap', 'wpb']);
  assert.deepEqual(Object.keys(COMPILED.histories), ['wp']);
  assert.equal(COMPILED.histories.wp, 0);
  assert.ok(/\bin1\b/.test(RAW.replace(/\/\/[^\n]*/g, '')) && /\bin2\b/.test(RAW.replace(/\/\/[^\n]*/g, '')));
  const md = path.join(__dirname, '..', 'docs', 'PROTOCOL.md');
  if (fs.existsSync(md)) {
    const text = fs.readFileSync(md, 'utf8');
    assert.ok(text.indexOf('recorder.genexpr') >= 0, 'PROTOCOL.md documents the recorder');
  }
});

test('recorder.genexpr: poke argument order is (buffer, value, index, channel) in all three calls', () => {
  const code = RAW.replace(/\/\/[^\n]*/g, '');
  const calls = code.match(/poke\s*\([^)]*\)/g).map(c => c.replace(/\s+/g, ''));
  assert.deepEqual(calls, ['poke(cap,in1,wpos,0)', 'poke(cap,in2,wpos,1)', 'poke(wpb,wpos,0,0)']);
  // the mock above takes (buffer, value, index, channel): record what the translated code passes
  const cap = makeBuffer(4, 2), wpb = makeBuffer(2, 1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  pokeCalls.length = 0;
  recordPokes = true;
  rec.tick(0.25, -0.5);
  recordPokes = false;
  assert.deepEqual(pokeCalls.map(c => [c.buffer === cap ? 'cap' : c.buffer === wpb ? 'wpb' : '?', c.value, c.index, c.channel]),
    [['cap', 0.25, 0, 0], ['cap', -0.5, 0, 1], ['wpb', 0, 0, 0]]);
});

test('lint self-check: the checker really catches block-scope, History and operator mistakes', () => {
  const ok = 'Buffer cap;\nBuffer wpb;\nHistory wp(0);\nw = wp;\nwp = w;\nout1 = w;\n';
  assert.deepEqual(compileGenExpr(ok).errors, []);
  const bad1 = compileGenExpr('Buffer cap;\nBuffer wpb;\nHistory wp(0);\nw = wp;\nif (w >= 0) {\n  y = 1;\n}\nwp = y;\nout1 = w;\n');
  assert.ok(bad1.errors.some(e => /first assigned inside a block|out of scope/.test(e)), bad1.errors.join('; '));
  const bad2 = compileGenExpr('Buffer cap;\nBuffer wpb;\nHistory wp(0);\nwp = wp + 1;\nout1 = wp;\n');
  assert.ok(bad2.errors.some(e => /History/.test(e)), bad2.errors.join('; '));
  const bad3 = compileGenExpr('Buffer cap;\nBuffer wpb;\nHistory wp(0);\nw = wp;\nwp = w;\nmix = fmod(w, 2);\nout1 = mix;\n');
  assert.ok(bad3.errors.some(e => /clashes/.test(e)) && bad3.errors.some(e => /unknown function/.test(e)), bad3.errors.join('; '));
  const bad4 = compileGenExpr('Buffer cap;\nBuffer wpb;\nHistory wp(0);\nw = wp;\nif (w > 0) {\n  wp = w;\n}\nout1 = w;\n');
  assert.ok(bad4.errors.some(e => /History/.test(e)), bad4.errors.join('; '));
  const bad5 = compileGenExpr('Param a(1, min=0, max=2);\nBuffer cap;\nBuffer wpb;\nHistory wp(0);\nw = wp;\nwp = w;\nout1 = w;\n');
  assert.ok(bad5.errors.some(e => /no Params|declarations/.test(e)), bad5.errors.join('; '));
});

// ---------------------------------------------------------------------------
// behaviour
// ---------------------------------------------------------------------------

test('recorder: writes L and R into channels 0 and 1 at the write position; out1 is the next position', () => {
  const cap = makeBuffer(1000, 2), wpb = makeBuffer(10, 1);
  wpb.channels[0].fill(-1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  const L = i => (i + 1) * 0.001;
  const R = i => -(i + 1) * 0.002;
  const out = rec.run(600, L, R);
  for (let i = 0; i < 600; i++) {
    assert.equal(cap.channels[0][i], Math.fround(L(i)), 'L at ' + i);
    assert.equal(cap.channels[1][i], Math.fround(R(i)), 'R at ' + i);
    assert.equal(out[i], i + 1, 'out1 = next write position after sample ' + i);
  }
  for (let i = 600; i < 1000; i++) { assert.ok(cap.channels[0][i] === 0 && cap.channels[1][i] === 0, 'untouched at ' + i); }
  assert.equal(rec.H.wp, 600);
});

test('recorder: writes the position into frame 0 of wpb every sample (index of the frame just written)', () => {
  const cap = makeBuffer(100, 2), wpb = makeBuffer(10, 1);
  wpb.channels[0].fill(-1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  for (let i = 0; i < 250; i++) {
    rec.tick(i + 1, -(i + 1));
    assert.equal(wpb.channels[0][0], i % 100, 'wpb frame 0 after sample ' + i);
    // the frame it points to holds the newest sample
    assert.equal(cap.channels[0][wpb.channels[0][0]], i + 1);
    assert.equal(cap.channels[1][wpb.channels[0][0]], -(i + 1));
  }
  for (let i = 1; i < 10; i++) { assert.equal(wpb.channels[0][i], -1, 'other wpb frames untouched'); }
  // the ring is never written into wpb, nor wpb into the ring
  assert.equal(wpb.channels.length, 1);
});

test('recorder: the write position wraps at the buffer length and old frames are overwritten', () => {
  const cap = makeBuffer(8, 2), wpb = makeBuffer(10, 1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  const out = rec.run(20, i => i + 1, i => 100 + i);
  assert.deepEqual(Array.from(out), [1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4]);
  // sample i lives at i % 8; after 20 samples the ring holds the last 8 (12..19)
  for (let i = 12; i < 20; i++) {
    assert.equal(cap.channels[0][i % 8], i + 1);
    assert.equal(cap.channels[1][i % 8], 100 + i);
  }
  // reading [wp - N, wp) with wrap gives the last N samples in order (what the glue does)
  const wp = out[19];
  const last5 = [];
  for (let k = 5; k >= 1; k--) { last5.push(cap.channels[0][(wp - k + 8) % 8]); }
  assert.deepEqual(last5, [16, 17, 18, 19, 20]);
});

test('recorder: a 40 s stereo ring at 48 kHz wraps correctly and its positions are exact in a float32 buffer~', () => {
  const frames = 40 * 48000;
  const cap = makeBuffer(frames, 2), wpb = makeBuffer(10, 1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  const out = rec.run(frames + 7, i => i, null);
  assert.equal(out[frames - 2], frames - 1);
  assert.equal(out[frames - 1], 0, 'wraps to 0 after the last frame');
  assert.equal(out[frames + 6], 7);
  assert.equal(cap.channels[0][3], frames + 3, 'oldest frames were overwritten after one lap');
  assert.equal(cap.channels[0][frames - 1], frames - 1);
  assert.equal(wpb.channels[0][0], 6);
  // positions up to 40 s at 96 kHz are exactly representable in float32
  assert.equal(Math.fround(40 * 96000 - 1), 40 * 96000 - 1);
});

test('recorder: does nothing while the ring buffer is empty or not bound; starts at frame 0 once it has frames', () => {
  const wpb = makeBuffer(10, 1);
  wpb.channels[0].fill(123);
  // unbound
  const rec = createRecorder(COMPILED, { cap: null, wpb: wpb });
  pokeCalls.length = 0;
  recordPokes = true;
  let out = rec.run(50, i => i + 1, i => i + 1);
  assert.ok(out.every(v => v === 0), 'out1 stays 0');
  assert.equal(pokeCalls.length, 0, 'no poke at all');
  assert.equal(wpb.channels[0][0], 123, 'wpb untouched');
  assert.equal(rec.H.wp, 0);
  // bound, but zero frames
  const empty = makeBuffer(0, 2);
  rec.bind('cap', empty);
  out = rec.run(50, i => i + 1, i => i + 1);
  assert.ok(out.every(v => v === 0));
  assert.equal(pokeCalls.length, 0);
  recordPokes = false;
  assert.equal(wpb.channels[0][0], 123);
  assert.equal(empty.channels[0].length, 0);
  // the buffer gets its size later (the `cap` message arrives, buffer~ is resized): recording starts at 0
  const cap = makeBuffer(16, 2);
  rec.bind('cap', cap);
  out = rec.run(3, i => 10 + i, i => 20 + i);
  assert.deepEqual(Array.from(out), [1, 2, 3]);
  assert.deepEqual(Array.from(cap.channels[0].slice(0, 4)), [10, 11, 12, 0]);
  assert.deepEqual(Array.from(cap.channels[1].slice(0, 4)), [20, 21, 22, 0]);
  assert.equal(wpb.channels[0][0], 2);
});

test('recorder: an unbound / empty position buffer does not stop the ring from recording', () => {
  const cap = makeBuffer(16, 2);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: null });
  const out = rec.run(5, i => i + 1, i => -(i + 1));
  assert.deepEqual(Array.from(out), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(cap.channels[0].slice(0, 5)), [1, 2, 3, 4, 5]);
  rec.bind('wpb', makeBuffer(0, 1));
  rec.run(2, () => 0, () => 0);
  assert.equal(rec.H.wp, 7);
});

test('recorder: rebinding to a smaller ring wraps wp before writing; a larger ring just continues', () => {
  const big = makeBuffer(100, 2), wpb = makeBuffer(10, 1);
  const rec = createRecorder(COMPILED, { cap: big, wpb: wpb });
  rec.run(60, i => i + 1, null);
  assert.equal(rec.H.wp, 60);
  const small = makeBuffer(10, 2);
  rec.bind('cap', small);
  const out = rec.run(3, () => 9, () => 8);
  assert.deepEqual(Array.from(out), [1, 2, 3], 'wrapped to 0, wrote there, advanced');
  assert.deepEqual(Array.from(small.channels[0].slice(0, 4)), [9, 9, 9, 0]);
  assert.deepEqual(Array.from(small.channels[1].slice(0, 4)), [8, 8, 8, 0]);
  const bigger = makeBuffer(100, 2);
  rec.bind('cap', bigger);
  const out2 = rec.run(2, () => 7, () => 6);
  assert.deepEqual(Array.from(out2), [4, 5], 'continues from the current position');
  assert.equal(bigger.channels[0][3], 7);
  assert.equal(bigger.channels[0][4], 7);
});

test('recorder: a mono ring buffer keeps the left channel (poke to a missing channel is ignored)', () => {
  const cap = makeBuffer(8, 1), wpb = makeBuffer(10, 1);
  const rec = createRecorder(COMPILED, { cap: cap, wpb: wpb });
  rec.run(3, i => i + 1, () => 5);
  assert.deepEqual(Array.from(cap.channels[0].slice(0, 4)), [1, 2, 3, 0]);
  assert.equal(cap.channels.length, 1);
});
