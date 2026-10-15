'use strict';
/*
 * Glue tests. The real bundle (tools/build.js -> bundle()) runs in a vm context
 * with mocked Max globals: outlet, post, Buffer (synthetic audio), Dict,
 * LiveAPI, Task (virtual clock) , messagename, jsarguments. Messages go in
 * through the bundle's real entry points (anything(), loadbang(), ...).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const builder = require('../tools/build');

const BUNDLE = builder.bundle({ banner: 'test' });

// ---------------------------------------------------------------------------
// Synthetic audio
// ---------------------------------------------------------------------------

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A few decaying bursts on a quiet floor. Deterministic per path. Paths containing
// "mono" give one channel, everything else stereo.
function synthAudio(p, seconds) {
  const sr = 44100;
  const secs = seconds || 1.6;
  const frames = Math.round(sr * secs);
  const nch = /mono/.test(p) ? 1 : 2;
  const seed = hashStr(p);
  const r = rng(seed);
  const starts = [0.03, 0.28, 0.53, 0.83, 1.08, 1.33].map((t) => t + (seed % 5) * 0.004);
  const tonal = (seed % 2) === 0;
  const freq = 120 + (seed % 7) * 90;
  const channels = [];
  for (let c = 0; c < nch; c++) {
    const d = new Float32Array(frames);
    for (let i = 0; i < frames; i++) { d[i] = (r() - 0.5) * 0.0004; }
    for (const t0 of starts) {
      const s0 = Math.round(t0 * sr);
      const len = Math.round(0.14 * sr);
      for (let i = 0; i < len && s0 + i < frames; i++) {
        const env = Math.exp(-i / (0.03 * sr));
        const body = tonal ? Math.sin(2 * Math.PI * freq * i / sr) * 0.7 + (r() - 0.5) * 0.3 : (r() * 2 - 1);
        d[s0 + i] += 0.9 * env * body;
      }
    }
    channels.push(d);
  }
  return { channels, sr, frames };
}

// ---------------------------------------------------------------------------
// Mock Max world
// ---------------------------------------------------------------------------

// Mimics what a Max dict does to JSON: booleans become 1/0, null becomes the
// symbol "null", empty arrays vanish and one-element arrays are flattened.
function maxQuirk(v) {
  if (v === true) { return 1; }
  if (v === false) { return 0; }
  if (v === null) { return 'null'; }
  if (Array.isArray(v)) {
    if (v.length === 0) { return undefined; }
    const a = v.map(maxQuirk);
    return a.length === 1 ? a[0] : a;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      const q = maxQuirk(v[k]);
      if (q !== undefined) { o[k] = q; }
    }
    return o;
  }
  return v;
}

// Value of the synthetic capture ring at (channel, frame): unique enough to catch a wrong copy order.
function ringValue(c, i) { return (((i * 7 + c * 3) % 997) + 1) / 1000; }

const CLOCK_BASE = Date.UTC(2026, 0, 2, 3, 4, 5);   // what Date.now() returns at virtual time 0

function createWorld(opts) {
  opts = opts || {};
  const names = opts.args || ['slicekit.js', 'tsrc', 'tstate', 'tview', 'tcap'];
  const prefix = names[1] || '---src';
  const stateName = names[2] || '---skstate';
  const viewName = names[3] || '---skview';
  const capName = names[4] || '---cap';
  const world = {
    now: 0,
    log: [],
    posts: [],
    dicts: opts.dicts || {},
    buffers: {},
    tasks: new Set(),
    liveInstances: [],
    liveCalls: [],
    bufCalls: [],
    written: {},
    autoload: opts.autoload !== false,
    failPeek: false,
    peekCalls: 0,
    prefix, stateName, viewName, capName
  };

  function loadInto(slot, p) {
    world.buffers[prefix + slot] = world.written[p]
      ? { channels: world.written[p].channels.map((c) => Float32Array.from(c)), sr: world.written[p].sr, frames: world.written[p].frames }
      : synthAudio(p, opts.seconds);
  }

  // Capture ring (filled with ringValue), recorder write position and staging buffer.
  if (opts.ring !== false) {
    const sr = 44100;
    const ringFrames = Math.round(sr * (opts.ringSeconds || 8));
    const ring = [new Float32Array(ringFrames), new Float32Array(ringFrames)];
    if (!opts.silentRing) {
      for (let c = 0; c < 2; c++) { for (let i = 0; i < ringFrames; i++) { ring[c][i] = ringValue(c, i); } }
    }
    world.buffers[capName] = { channels: ring, sr, frames: ringFrames };
    world.buffers[capName + 'wp'] = { channels: [Float32Array.of(opts.wp === undefined ? 100000 : opts.wp)], sr, frames: 1 };
    world.buffers[capName + 'out'] = { channels: [new Float32Array(sr), new Float32Array(sr)], sr, frames: sr };
  }

  const outletFn = function (n, ...args) {
    world.log.push({ n, args });
    if (n === 1 && args[1] === 'replace' && world.autoload) { loadInto(args[0], args[2]); }
    if (n === 1 && args[1] === 'clear') {
      const b = world.buffers[prefix + args[0]];
      if (b) { b.channels.forEach((c) => c.fill(0)); }
    }
  };

  class MockBuffer {
    constructor(name) { this.name = name; }
    b() { return world.buffers[this.name]; }
    framecount() { const b = this.b(); return b ? b.frames : 0; }
    channelcount() { const b = this.b(); return b ? b.channels.length : 0; }
    length() { const b = this.b(); return b ? b.frames / b.sr * 1000 : 0; }
    peek(ch, start, count) {
      world.peekCalls++;
      if (world.failPeek) { throw new Error('peek exploded'); }
      const b = this.b();
      assert.ok(ch >= 1 && ch <= b.channels.length, 'peek channel is 1-based');
      const d = b.channels[ch - 1];
      if (this.name.startsWith(capName)) { world.bufCalls.push({ op: 'peek', name: this.name, ch, start, count }); }
      if (count === 1) { return d[start]; }
      return Array.from(d.subarray(start, start + count));
    }
    poke(ch, start, values) {
      const b = this.b();
      assert.ok(Array.isArray(values), 'poke gets an array');
      assert.ok(ch >= 1 && ch <= b.channels.length, 'poke channel is 1-based');
      assert.ok(start >= 0 && start + values.length <= b.frames, 'poke inside the buffer');
      world.bufCalls.push({ op: 'poke', name: this.name, ch, start, count: values.length });
      b.channels[ch - 1].set(values, start);
    }
    send(msg, ...args) {
      world.bufCalls.push({ op: 'send', name: this.name, msg, args });
      const b = this.b();
      if (msg === 'sizeinsamps') {
        const n = args[0];
        world.buffers[this.name] = { channels: b.channels.map(() => new Float32Array(n)), sr: b.sr, frames: n };
      } else if (msg === 'writewave') {
        world.written[args[0]] = { channels: b.channels.map((c) => Float32Array.from(c)), sr: b.sr, frames: b.frames };
      }
    }
    freepeer() {}
  }

  class MockDict {
    constructor(name) { this.name = name; }
    parse(s) {
      const obj = JSON.parse(s);
      world.dicts[this.name] = JSON.stringify(opts.quirks && this.name === stateName ? maxQuirk(obj) : obj);
    }
    stringify() {
      if (opts.dictThrows) { throw new Error('dict exploded'); }
      return world.dicts[this.name] || '{}';
    }
    clear() { world.dicts[this.name] = '{}'; }
    get(k) { return JSON.parse(world.dicts[this.name] || '{}')[k]; }
    set(k, v) { const o = JSON.parse(world.dicts[this.name] || '{}'); o[k] = v; world.dicts[this.name] = JSON.stringify(o); }
  }

  class MockTask {
    constructor(fn, owner) {
      this.fn = fn; this.owner = owner; this.interval = 0;
      this.due = null; this.remaining = 0; this.every = 0;
      world.tasks.add(this);
    }
    schedule(ms) { this.due = world.now + ms; this.remaining = 1; this.every = 0; }
    repeat(n) {
      this.every = Math.max(1, this.interval);
      this.remaining = n === undefined ? Infinity : n;
      this.due = world.now + this.every;
    }
    cancel() { this.due = null; this.remaining = 0; }
    execute() { this.fn.call(this.owner); }
    freepeer() { world.tasks.delete(this); }
  }

  // opts.live: { '<path>': { id, props: { name: [..] }, counts: { devices: n }, calls: { fn(...args) } } }
  class MockLiveAPI {
    constructor(cb, p) {
      if (opts.liveThrows) { throw new Error('no Live here'); }
      this.cb = cb; this.path = p; this.property = '';
      world.liveInstances.push(this);
    }
    node() { return (opts.live || {})[this.path] || null; }
    get id() { const n = this.node(); return n ? String(n.id === undefined ? 1 : n.id) : '0'; }
    get(prop) { const n = this.node(); return n && n.props && n.props[prop] !== undefined ? n.props[prop] : []; }
    getcount(prop) { const n = this.node(); return n && n.counts && n.counts[prop] ? n.counts[prop] : 0; }
    call(name, ...args) {
      world.liveCalls.push({ path: this.path, name, args });
      const n = this.node();
      return n && n.calls && n.calls[name] ? n.calls[name](...args) : undefined;
    }
    freepeer() {}
  }

  const sandbox = {
    outlet: outletFn,
    post: (s) => { world.posts.push(String(s)); },
    Buffer: MockBuffer,
    Dict: MockDict,
    Task: MockTask,
    jsarguments: names,
    messagename: '',
    __now: () => CLOCK_BASE + world.now
  };
  if (!opts.noLive) { sandbox.LiveAPI = MockLiveAPI; }
  if (opts.patcher !== undefined) { sandbox.patcher = opts.patcher; }
  const ctx = vm.createContext(sandbox);
  vm.runInContext('Date.now = function () { return __now(); };', ctx);   // the engine's clock follows the virtual one
  vm.runInContext(BUNDLE, ctx, { filename: 'dist/slicekit.js' });
  world.ctx = ctx;

  world.get = (expr) => vm.runInContext(expr, ctx);

  world.send = (name, ...args) => {
    if (name === 'bang' || name === 'loadbang') { return ctx[name](); }
    if (name === 'msg_int' || name === 'msg_float' || name === 'list') { return ctx[name](...args); }
    ctx.messagename = name;
    return ctx.anything(...args);
  };

  world.advance = (ms) => {
    const end = world.now + ms;
    for (;;) {
      let next = null;
      for (const t of world.tasks) {
        if (t.due !== null && t.due <= end && (!next || t.due < next.due)) { next = t; }
      }
      if (!next) { break; }
      world.now = Math.max(world.now, next.due);
      next.remaining -= 1;
      next.due = (next.remaining > 0 && next.every > 0) ? world.now + next.every : null;
      next.fn.call(next.owner);
    }
    world.now = end;
  };
  world.settle = () => world.advance(1000);

  world.clear = () => { world.log.length = 0; world.posts.length = 0; };
  world.out = (n) => world.log.filter((e) => e.n === n).map((e) => e.args);
  world.take = (n) => {
    const res = world.out(n);
    world.log = world.log.filter((e) => e.n !== n);
    return res;
  };
  // Outlet 0 as a list of { voice, params } (voice is the 1-based `target`).
  world.commands = (consume) => {
    const msgs = world.out(0);
    const cmds = [];
    let cur = null;
    for (const m of msgs) {
      if (m[0] === 'target') { cur = { target: m[1], params: [] }; cmds.push(cur); } else if (cur) { cur.params.push(m); }
    }
    if (consume) { world.take(0); }
    return cmds;
  };
  world.feedback = (consume) => {
    const fb = world.out(2);
    if (consume) { world.take(2); }
    return fb;
  };
  world.state = () => JSON.parse(world.dicts[stateName]);
  world.view = () => JSON.parse(world.dicts[viewName]);
  world.glue = () => world.get('__skGlue').debug();
  world.model = () => world.glue().model;
  // Deep copy of an object from inside the vm (different realm) into this one.
  world.plain = (x) => JSON.parse(JSON.stringify(x));

  world.init = () => { world.send('init'); world.settle(); };
  world.load = (p) => {
    world.send('drop', p);
    world.settle();
  };
  return world;
}

// Ready world with n loaded samples.
function loadedWorld(paths, opts) {
  const w = createWorld(opts);
  w.init();
  (paths || ['/audio/drums.wav']).forEach((p) => w.load(p));
  w.clear();
  return w;
}

function padOnKey(st, key, slot) {
  const s = st.slots[slot === undefined ? st.currentSlot : slot];
  const id = s.keys[key];
  return id === null || id === undefined ? null : st.pads[String(id)];
}

const SRC_FB = ['playmode', 'trigmode', 'slicemode', 'sensitivity', 'beatdiv', 'regions', 'bpm', 'minslice', 'snap'].map((n) => 'src_' + n);
const PAD_FB = ['reverse', 'pitch', 'fine', 'gain', 'attack', 'decay', 'sustain', 'release', 'start', 'loop', 'loopsize', 'looppos',
  'cutoff', 'drive', 'lock', 'layerarm', 'duparm', 'spreadparam', 'spreadcount', 'spreadstep'].map((n) => 'pad_' + n);
const KIT_FB = ['slot', 'layout', 'zonealign', 'sortby', 'root', 'shufflemode', 'shufflescope', 'seed', 'flip', 'bestn', 'chokescope',
  'modzone', 'modstart', 'velsens', 'pressure2level'].map((n) => 'kit_' + n);
const V2_FB = ['kit_morphedit', 'kit_capturebars', 'kit_keepclip', 'gest_sel', 'gest_beats', 'gest_ratefrom', 'gest_rateto',
  'gest_cutfrom', 'gest_cutto', 'gest_pitchfrom', 'gest_pitchto', 'gest_ampfrom', 'gest_ampto', 'gest_curve'];
const ALL_FB = SRC_FB.concat(PAD_FB, KIT_FB, V2_FB);

// ---------------------------------------------------------------------------
// Entry points & bundle
// ---------------------------------------------------------------------------

test('bundle declares the Max entry points', () => {
  const w = createWorld();
  assert.equal(w.get('inlets'), 1);
  assert.equal(w.get('outlets'), 5);
  assert.equal(w.get('autowatch'), 0);
  ['loadbang', 'bang', 'msg_int', 'msg_float', 'list', 'anything', 'notifydeleted'].forEach((f) => {
    assert.equal(w.get('typeof ' + f), 'function', f);
  });
  assert.equal(w.get('typeof require'), 'undefined', 'bundle must not depend on require');
});

test('bundle is ES5 and has a banner', () => {
  assert.match(BUNDLE, /^\/\* SliceKit bundle/);
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* optional */ }
  if (acorn) {
    assert.doesNotThrow(() => acorn.parse(BUNDLE, { ecmaVersion: 5 }));
  }
});

test('build() writes dist files into a directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const res = builder.build({ outDir: dir, patchers: false, log() {} });
    assert.ok(fs.existsSync(path.join(dir, 'slicekit.js')));
    assert.ok(res.files.length >= 1);
    const src = fs.readFileSync(path.join(dir, 'slicekit.js'), 'utf8');
    assert.match(src, /built \d{4}-\d\d-\d\dT/);
    assert.match(src, /function anything\(\)/);
    if (fs.existsSync(path.join(__dirname, '..', 'max', 'ui.js'))) {
      assert.ok(fs.existsSync(path.join(dir, 'slicekit-ui.js')));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('names come from jsarguments, with defaults when missing', () => {
  const w = createWorld({ args: ['slicekit.js'] });
  w.send('init');
  assert.deepEqual(w.out(3)[0], ['viewdict', '---skview']);
  w.send('drop', '/audio/drums.wav');
  assert.deepEqual(w.out(1)[0], [0, 'replace', '/audio/drums.wav']);
  w.settle();
  w.clear();
  w.send('note', 36, 100);
  const src = w.commands()[0].params.find((p) => p[0] === 'src');
  assert.equal(src[1], '---src0');
  assert.ok(w.dicts['---skstate'] && w.dicts['---skview']);

  const w2 = createWorld();
  w2.send('init');
  assert.deepEqual(w2.out(3)[0], ['viewdict', 'tview']);
  assert.deepEqual(w2.out(3)[1], ['refresh']);
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

test('drop -> poll -> slices exist, state and view dicts written', () => {
  const w = createWorld();
  w.init();
  w.clear();
  w.send('drop', '/audio/my drums.wav');
  assert.deepEqual(w.out(1), [[0, 'replace', '/audio/my drums.wav']]);
  w.settle();

  const st = w.state();
  assert.equal(st.sources.length, 1);
  const s = st.sources[0];
  assert.equal(s.name, 'my drums.wav');
  assert.equal(s.path, '/audio/my drums.wav');
  assert.equal(s.frames, 70560);
  assert.equal(s.sr, 44100);
  assert.equal(s.channels, 2);
  assert.ok(s.slices.length >= 3, 'transient slicing found the bursts: ' + s.slices.length);
  assert.equal(s.slices[0].start, 0);
  assert.equal(s.slices[s.slices.length - 1].end, s.frames);
  assert.ok(s.slices.every((sl) => sl.features && typeof sl.features.durMs === 'number'), 'features computed');

  const v = w.view();
  assert.equal(v.sources.length, 1);
  assert.equal(v.sources[0].loaded, 1);
  assert.equal(v.sources[0].slices, s.slices.length);
  assert.equal(v.selectedSource, 0);
  assert.equal(v.selectedFrames, 70560);
  assert.equal(v.wave.length, 1024);
  assert.equal(v.slices.length, s.slices.length);
  assert.equal(v.slices[0][0], 0);
  assert.equal(v.slices[v.slices.length - 1][1], 1);
  assert.equal(v.palette.length, 16);
  assert.equal(v.keys.length, 128);
  assert.equal(v.keyFlags.length, 128);
  assert.ok(v.keys.filter((c) => c >= 0).length >= s.slices.length);
  assert.equal(v.status, 'Loaded my drums.wav: ' + s.slices.length + ' slices');
  assert.ok(w.out(3).some((m) => m[0] === 'refresh'));
  assert.ok(v.wave.some((x) => x !== 0), 'overview has audio');
});

test('`load` is an alias, several paths in one drop add several sources', () => {
  const w = createWorld();
  w.init();
  w.send('load', '/audio/a.wav');
  w.send('drop', '/audio/b.wav', '/audio/mono c.wav');
  w.settle();
  const st = w.state();
  assert.deepEqual(st.sources.map((s) => s.name), ['a.wav', 'b.wav', 'mono c.wav']);
  assert.deepEqual(st.sources.map((s) => s.slot), [0, 1, 2]);
  assert.equal(st.sources[2].channels, 1);
  assert.ok(st.sources.every((s) => s.slices.length > 1));
  assert.equal(w.view().selectedSource, 2, 'last loaded source is selected');
});

test('`loaded <slot>` processes immediately and only once', () => {
  const w = createWorld();
  w.init();
  w.send('drop', '/audio/drums.wav');
  assert.ok(Object.keys(w.glue().pending).length === 1);
  w.send('loaded', 0);
  assert.equal(Object.keys(w.glue().pending).length, 0);
  const n = w.model().getSourceBySlot(0).slices.length;
  assert.ok(n >= 3);
  const peeks = w.peekCalls;
  w.send('loaded', 0); // not pending any more: ignored
  w.settle();
  assert.equal(w.peekCalls, peeks, 'buffer read once');
  assert.equal(w.model().getSourceBySlot(0).slices.length, n);
});

test('stereo is mixed down to mono (peek is 1-based, chunked)', () => {
  const w = createWorld();
  w.init();
  w.load('/audio/drums.wav');
  const mono = w.glue().monoCache[w.model().getSourceBySlot(0).id];
  const buf = w.buffers.tsrc0;
  assert.equal(mono.length, buf.frames);
  for (const i of [100, 1500, 12345, 70000]) {
    assert.ok(Math.abs(mono[i] - (buf.channels[0][i] + buf.channels[1][i]) / 2) < 1e-6);
  }
});

test('16 samples max', () => {
  const w = createWorld({ seconds: 0.6 });
  w.init();
  for (let i = 0; i < 16; i++) { w.load('/audio/s' + i + '.wav'); }
  assert.equal(w.state().sources.length, 16);
  w.clear();
  w.send('drop', '/audio/one-too-many.wav');
  assert.equal(w.out(1).length, 0, 'no buffer message');
  w.settle();
  assert.equal(w.view().status, '16 samples max');
  assert.equal(w.state().sources.length, 16);
});

test('a buffer that never loads is dropped after 30 s', () => {
  const w = createWorld({ autoload: false });
  w.init();
  w.send('drop', '/audio/ghost.wav');
  w.advance(29000);
  assert.equal(w.model().listSources().length, 1, 'still waiting');
  w.advance(3000);
  assert.equal(w.model().listSources().length, 0);
  assert.equal(w.view().status, 'Could not load ghost.wav');
  assert.deepEqual(w.out(1).pop(), [0, 'clear']);
  assert.ok(w.posts.some((p) => p.startsWith('SliceKit:')));
});

test('an exception while reading the buffer is contained', () => {
  const w = createWorld();
  w.init();
  w.failPeek = true;
  assert.doesNotThrow(() => { w.send('drop', '/audio/drums.wav'); w.settle(); });
  assert.ok(w.posts.some((p) => p.startsWith('SliceKit:') && /peek exploded/.test(p)));
  assert.equal(w.model().listSources().length, 0, 'half-loaded source is removed');
  w.failPeek = false;
  w.load('/audio/drums.wav');
  assert.equal(w.model().listSources().length, 1, 'still works afterwards');
});

// ---------------------------------------------------------------------------
// Notes & engine
// ---------------------------------------------------------------------------

test('note on sends target + voice params ending in trig; note off releases', () => {
  const w = loadedWorld();
  w.send('note', 36, 100);
  const cmds = w.commands(true);
  assert.ok(cmds.length >= 1);
  const c = cmds[0];
  assert.ok(c.target >= 1 && c.target <= 16, 'voice is 1-based');
  const names = c.params.map((p) => p[0]);
  for (const n of ['src', 'pstart', 'pend', 'dir', 'pitch', 'amp', 'att', 'dec', 'sus', 'rel', 'held']) {
    assert.ok(names.includes(n), 'has ' + n);
  }
  assert.equal(names[names.length - 1], 'trig');
  assert.equal(c.params.find((p) => p[0] === 'src')[1], 'tsrc0');
  assert.equal(c.params.find((p) => p[0] === 'held')[1], 1);
  assert.ok(c.params.every((p) => typeof p[1] === 'string' || Number.isFinite(p[1])));

  w.send('note', 36, 0);
  const off = w.commands(true);
  assert.ok(off.length >= 1);
  assert.equal(off[0].target, c.target);
  assert.deepEqual(off[0].params.find((p) => p[0] === 'held'), ['held', 0]);
});

test('a key without a pad is silent; pressure messages are accepted', () => {
  const w = loadedWorld();
  w.send('note', 120, 100);
  assert.equal(w.commands().length, 0);
  w.send('note', 36, 100);
  w.commands(true);
  assert.doesNotThrow(() => {
    w.send('pressure', 90);
    w.send('polypressure', 36, 80);
    w.send('kit', 'pressure2level', 1);
    w.send('pressure', 100);
    w.send('polypressure', 36, 60);
  });
  w.commands().forEach((c) => assert.ok(c.target >= 0 && c.target <= 16));
});

test('ui audition / auditionoff play the key', () => {
  const w = loadedWorld();
  w.send('ui', 'audition', 37, 110);
  const on = w.commands(true);
  assert.ok(on.length >= 1);
  assert.equal(on[0].params[on[0].params.length - 1][0], 'trig');
  w.send('ui', 'auditionoff', 37);
  assert.ok(w.commands(true).length >= 1);
});

test('voiceend frees the voice and clears the sounding flag in the view', () => {
  const w = loadedWorld();
  w.send('note', 36, 100);
  const voice = w.commands(true)[0].target;
  w.advance(100);
  assert.equal(w.view().keyFlags[36] & 16, 16, 'sounding after note on');
  w.send('note', 36, 0);
  w.send('voiceend', voice);
  w.advance(100);
  assert.equal(w.view().keyFlags[36] & 16, 0, 'not sounding after voiceend');
  // voice is reusable
  w.commands(true);
  w.send('note', 36, 100);
  assert.ok(w.commands(true).length >= 1);
});

test('transport from LiveAPI is forwarded to the voices', () => {
  const w = createWorld();
  w.init();
  assert.equal(w.liveInstances.length, 2);
  assert.deepEqual(w.liveInstances.map((l) => l.property).sort(), ['is_playing', 'tempo']);
  assert.ok(w.liveInstances.every((l) => l.path === 'live_set'));
  w.clear();
  w.liveInstances.find((l) => l.property === 'tempo').cb(['tempo', 140]);
  let cmds = w.commands(true);
  assert.equal(cmds.length, 1);
  assert.equal(cmds[0].target, 0);
  assert.deepEqual(cmds[0].params.find((p) => p[0] === 'bpm'), ['bpm', 140]);
  w.liveInstances.find((l) => l.property === 'is_playing').cb(['is_playing', 1]);
  cmds = w.commands(true);
  assert.deepEqual(cmds[0].params.find((p) => p[0] === 'playing'), ['playing', 1]);
  assert.deepEqual(cmds[0].params.find((p) => p[0] === 'bpm'), ['bpm', 140]);
  assert.doesNotThrow(() => w.liveInstances[0].cb(['bogus']));
});

test('missing or failing LiveAPI does not break init', () => {
  const a = createWorld({ noLive: true });
  assert.doesNotThrow(() => a.send('init'));
  assert.deepEqual(a.out(3)[0], ['viewdict', 'tview']);
  const b = createWorld({ liveThrows: true });
  assert.doesNotThrow(() => b.send('init'));
  assert.ok(b.posts.some((p) => p.startsWith('SliceKit:')));
  assert.deepEqual(b.out(3)[0], ['viewdict', 'tview']);
});

// ---------------------------------------------------------------------------
// Selection & feedback
// ---------------------------------------------------------------------------

test('selecting a key sends every feedback name with UI-unit values', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 38);
  const fb = w.feedback(true);
  const names = fb.map((m) => m[0]);
  assert.deepEqual(names.slice().sort(), ALL_FB.slice().sort());
  assert.equal(new Set(names).size, names.length, 'each name once');
  const map = Object.fromEntries(fb);
  const st = w.state();
  const pad = padOnKey(st, 38);
  assert.ok(pad);
  const g = st.globals;
  const src = st.sources[0];
  assert.equal(map.src_playmode, ['mono', 'poly', 'thru'].indexOf(src.playMode));
  assert.equal(map.src_trigmode, ['trigger', 'gate'].indexOf(src.trigMode));
  assert.equal(map.src_slicemode, 0);
  assert.equal(map.src_sensitivity, src.slicing.sensitivity);
  assert.equal(map.src_beatdiv, 0);
  assert.equal(map.src_regions, src.slicing.regions);
  assert.equal(map.src_snap, src.slicing.snap ? 1 : 0);
  assert.equal(map.pad_pitch, pad.pitch);
  assert.equal(map.pad_gain, pad.gainDb);
  assert.ok(Math.abs(map.pad_sustain - pad.sustain * 100) < 1e-3, 'sustain in percent');
  assert.ok(Math.abs(map.pad_drive - pad.drive * 100) < 1e-3, 'drive in percent');
  assert.ok(Math.abs(map.pad_looppos - pad.loopPos * 100) < 1e-3, 'looppos in percent');
  assert.equal(map.pad_cutoff, pad.cutoffHz);
  assert.equal(map.pad_decay, pad.decayMs);
  assert.equal(map.pad_reverse, 0);
  assert.equal(map.pad_lock, 0);
  assert.equal(map.pad_layerarm, 0);
  assert.equal(map.pad_duparm, 0);
  assert.equal(map.kit_slot, st.currentSlot);
  assert.equal(map.kit_root, g.rootKey);
  assert.equal(map.kit_seed, g.seed);
  assert.equal(map.kit_layout, ['zones', 'interleave', 'sorted'].indexOf(g.layout));
  assert.equal(map.kit_shufflemode, ['chaos', 'smart'].indexOf(g.shuffleMode));
  assert.equal(map.kit_bestn, g.bestN);
  assert.equal(map.kit_velsens, g.velSens);
  assert.equal(map.pad_spreadparam, ['pitch', 'decay', 'start', 'cutoff'].indexOf(g.spreadParam));
  assert.equal(map.pad_spreadcount, g.spreadCount);
});

test('selection follows the key: source, slice and view', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  const st = w.state();
  const nA = st.sources[0].slices.length;
  w.send('ui', 'selectkey', 36 + 2);
  w.settle();
  let v = w.view();
  assert.equal(v.selectedKey, 38);
  assert.equal(v.selectedSource, 0);
  assert.equal(v.selectedSlice, 2);
  w.send('ui', 'selectkey', 36 + nA + 1); // second sample (zones layout)
  w.settle();
  v = w.view();
  assert.equal(v.selectedSource, 1);
  assert.equal(v.selectedSlice, 1);
  assert.equal(v.selectedFrames, st.sources[1].frames);
  assert.deepEqual(v.slices.length, st.sources[1].slices.length);
  assert.equal(v.rootKey, 36);
  assert.equal(v.slot, 0);
  assert.equal(v.armed, '');
  // selecting a source directly
  w.clear();
  w.send('ui', 'selectsource', 0);
  w.settle();
  v = w.view();
  assert.equal(v.selectedSource, 0);
  assert.equal(v.selectedSlice, 0);
  assert.equal(w.feedback().length, ALL_FB.length, 'full feedback on source change');
  // selecting a slice selects its key
  w.send('ui', 'selectslice', 3);
  w.settle();
  v = w.view();
  assert.equal(v.selectedSlice, 3);
  assert.equal(v.selectedKey, 39);
});

test('key flags: locked, reversed, mod zone, layers, copies', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 37);
  w.send('pad', 'lock', 1);
  w.send('ui', 'selectkey', 38);
  w.send('pad', 'reverse', 1);
  w.send('kit', 'modzone', 1);
  w.settle();
  const v = w.view();
  assert.equal(v.keyFlags[37] & 1, 1);
  assert.equal(v.keyFlags[38] & 2, 2);
  const modStart = w.state().globals.modZoneStart;
  assert.equal(v.keyFlags[modStart] & 8, 8);
  assert.equal(v.keyFlags[modStart + 11] & 8, 8);
  assert.equal(v.keyFlags[36] & 8, 0);
  assert.equal(v.keys[modStart], -1);
  assert.ok(v.keys[36] >= 0);
});

test('without a pad on the selected key, pad edits are ignored and feedback snaps back', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 120);
  w.feedback(true);
  const before = JSON.stringify(w.state().pads);
  w.send('pad', 'pitch', 9);
  w.settle();
  assert.equal(JSON.stringify(w.state().pads), before);
  assert.deepEqual(w.feedback().find((m) => m[0] === 'pad_pitch'), ['pad_pitch', 0]);
});

// ---------------------------------------------------------------------------
// Pad edits
// ---------------------------------------------------------------------------

test('pad params edit the pad on the selected key, with unit conversion', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 38);
  w.feedback(true);
  w.send('pad', 'pitch', 5);
  assert.deepEqual(w.feedback().find((m) => m[0] === 'pad_pitch'), ['pad_pitch', 5]);
  w.send('pad', 'fine', 20);
  w.send('pad', 'gain', -6);
  w.send('pad', 'attack', 10);
  w.send('pad', 'decay', 250);
  w.send('pad', 'sustain', 50);
  w.send('pad', 'release', 80);
  w.send('pad', 'start', 12);
  w.send('pad', 'loop', 1);
  w.send('pad', 'loopsize', 40);
  w.send('pad', 'looppos', 25);
  w.send('pad', 'cutoff', 1500);
  w.send('pad', 'drive', 40);
  w.send('pad', 'reverse', 1);
  w.settle();
  const st = w.state();
  const p = padOnKey(st, 38);
  assert.equal(p.pitch, 5);
  assert.equal(p.fine, 20);
  assert.equal(p.gainDb, -6);
  assert.equal(p.attackMs, 10);
  assert.equal(p.decayMs, 250);
  assert.ok(Math.abs(p.sustain - 0.5) < 1e-9);
  assert.equal(p.releaseMs, 80);
  assert.equal(p.startOffsetMs, 12);
  assert.equal(p.loopOn, true);
  assert.equal(p.loopSizeMs, 40);
  assert.ok(Math.abs(p.loopPos - 0.25) < 1e-9);
  assert.equal(p.cutoffHz, 1500);
  assert.ok(Math.abs(p.drive - 0.4) < 1e-9);
  assert.equal(p.reverse, true);
  assert.equal(padOnKey(st, 37).pitch, 0, 'neighbouring pad untouched');
  assert.equal(padOnKey(st, 39).pitch, 0);
  const fb = Object.fromEntries(w.feedback());
  assert.ok(Math.abs(fb.pad_sustain - 50) < 1e-6);
  assert.ok(Math.abs(fb.pad_drive - 40) < 1e-6);

  // the edit reaches the voice
  w.commands(true);
  w.send('note', 38, 100);
  const params = Object.fromEntries(w.commands(true)[0].params);
  assert.equal(params.pitch, 5.2, 'pitch + fine/100');
  assert.equal(params.dir, -1, 'reversed');
});

test('undo / redo revert pad edits and update the controls', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 38);
  w.send('pad', 'pitch', 7);
  w.settle();
  assert.equal(padOnKey(w.state(), 38).pitch, 7);
  w.feedback(true);
  w.send('kit', 'undo');
  assert.deepEqual(w.feedback().find((m) => m[0] === 'pad_pitch'), ['pad_pitch', 0]);
  w.settle();
  assert.equal(padOnKey(w.state(), 38).pitch, 0);
  w.feedback(true);
  w.send('kit', 'redo');
  assert.deepEqual(w.feedback().find((m) => m[0] === 'pad_pitch'), ['pad_pitch', 7]);
  w.settle();
  assert.equal(padOnKey(w.state(), 38).pitch, 7);
  assert.doesNotThrow(() => { w.send('kit', 'redo'); w.send('kit', 'undo'); w.send('kit', 'undo'); w.send('kit', 'undo'); });
});

test('pad lock toggles the lock on the selected key', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 40);
  w.send('pad', 'lock', 1);
  w.settle();
  assert.equal(w.state().slots[0].locks[40], true);
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'pad_lock').pop(), ['pad_lock', 1]);
  w.send('pad', 'lock', 0);
  w.settle();
  assert.equal(w.state().slots[0].locks[40], false);
  w.send('ui', 'lock', 41);
  w.settle();
  assert.equal(w.state().slots[0].locks[41], true);
  w.send('ui', 'lock', 41);
  w.settle();
  assert.equal(w.state().slots[0].locks[41], false);
});

test('pad clear empties the key', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 38);
  w.send('pad', 'clear');
  w.settle();
  assert.equal(padOnKey(w.state(), 38), null);
  assert.equal(w.view().keys[38], -1);
});

test('pad applysource copies the last edited param to the whole sample', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('pad', 'applysource'); // nothing selected / nothing edited: harmless
  w.send('ui', 'selectkey', 37);
  w.send('pad', 'applysource');
  assert.equal(w.view().status === undefined, false);
  w.send('pad', 'decay', 555);
  w.send('pad', 'applysource');
  w.settle();
  const st = w.state();
  const srcId = padOnKey(st, 37).sourceId;
  const pads = Object.values(st.pads).filter((p) => p.sourceId === srcId);
  assert.ok(pads.length >= 3);
  assert.ok(pads.every((p) => p.decayMs === 555));
  const other = Object.values(st.pads).filter((p) => p.sourceId !== srcId);
  assert.ok(other.length > 0 && other.every((p) => p.decayMs !== 555), 'other samples untouched');
});

test('layer arming: next selectkey layers that pad, selection stays', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 36);
  w.feedback(true);
  w.send('pad', 'layerarm', 1);
  assert.deepEqual(w.feedback().find((m) => m[0] === 'pad_layerarm'), ['pad_layerarm', 1]);
  w.settle();
  assert.equal(w.view().armed, 'layer');
  w.feedback(true);
  w.send('ui', 'selectkey', 39);
  w.settle();
  const st = w.state();
  const v = w.view();
  assert.equal(v.selectedKey, 36, 'selection stays');
  assert.equal(v.armed, '');
  assert.equal(v.keyFlags[36] & 4, 4, 'has layers');
  assert.deepEqual(padOnKey(st, 36).layers, [padOnKey(st, 39).id]);
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'pad_layerarm').pop(), ['pad_layerarm', 0]);
  // a layered note triggers two voices
  w.commands(true);
  w.send('note', 36, 100);
  assert.equal(w.commands(true).length, 2);
  // arming again and picking the same pad un-layers
  w.send('pad', 'layerarm', 1);
  w.send('ui', 'selectkey', 39);
  w.settle();
  assert.deepEqual(padOnKey(w.state(), 36).layers, []);
});

test('dup arming: next selectkey receives a copy of the selected pad', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 37);
  w.send('pad', 'pitch', 3);
  w.send('pad', 'duparm', 1);
  w.settle();
  assert.equal(w.view().armed, 'dup');
  w.send('ui', 'selectkey', 100);
  w.settle();
  const st = w.state();
  const orig = padOnKey(st, 37);
  const copy = padOnKey(st, 100);
  assert.ok(copy);
  assert.notEqual(copy.id, orig.id);
  assert.equal(copy.sliceId, orig.sliceId);
  assert.equal(copy.pitch, 3);
  assert.equal(w.view().armed, '');
  assert.equal(w.view().selectedKey, 100, 'selection moves to the duplicate');
});

test('arming without a selected key is refused', () => {
  const w = createWorld();
  w.init();
  w.send('pad', 'layerarm', 1);
  w.send('pad', 'duparm', 1);
  w.settle();
  assert.equal(w.view().armed, '');
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'pad_layerarm').pop(), ['pad_layerarm', 0]);
});

test('the first key of a freshly loaded sample is selected automatically', () => {
  const w = createWorld();
  w.init();
  w.load('/audio/drums.wav');
  assert.equal(w.view().selectedKey, 36);
  w.load('/audio/b.wav');
  assert.equal(w.view().selectedKey, 36, 'an existing selection is kept');
  assert.equal(w.view().selectedSource, 1, 'the new sample is selected');
});

test('spread writes pitch variations on the following keys', () => {
  const w = loadedWorld();
  w.send('ui', 'selectkey', 36);
  w.send('pad', 'spreadparam', 0);
  w.send('pad', 'spreadcount', 4);
  w.send('pad', 'spreadstep', 2);
  w.send('pad', 'spread');
  w.settle();
  const st = w.state();
  assert.equal(st.globals.spreadParam, 'pitch');
  assert.equal(st.globals.spreadCount, 4);
  assert.equal(st.globals.spreadStep, 2);
  assert.deepEqual([36, 37, 38, 39].map((k) => padOnKey(st, k).pitch), [0, 2, 4, 6]);
  const sl = padOnKey(st, 36).sliceId;
  assert.ok([37, 38, 39].every((k) => padOnKey(st, k).sliceId === sl));
});

test('similar swap changes the slice under the selected key and the selection follows', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('ui', 'selectkey', 37);
  w.settle();
  const orig = padOnKey(w.state(), 37);
  w.send('pad', 'similar', 1);
  w.settle();
  const swapped = padOnKey(w.state(), 37);
  assert.equal(swapped.simIndex, 1);
  assert.notEqual(swapped.sliceId, orig.sliceId);
  assert.equal(swapped.origSliceId, orig.sliceId);
  const v = w.view();
  const slice = w.model().getSlice(swapped.sliceId);
  const srcIdx = w.state().sources.findIndex((s) => s.id === swapped.sourceId);
  assert.equal(v.selectedSource, srcIdx);
  assert.equal(v.selectedSlice, w.state().sources[srcIdx].slices.findIndex((s) => s.id === slice.id));
  w.send('pad', 'similar', -1);
  w.settle();
  const back = padOnKey(w.state(), 37);
  assert.equal(back.simIndex, 0);
  assert.equal(back.sliceId, orig.sliceId);
});

// ---------------------------------------------------------------------------
// Kit
// ---------------------------------------------------------------------------

test('kit shuffle uses the seed, increments it, reports kit_seed and changes the map', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('kit', 'seed', 5);
  w.settle();
  const before = w.state();
  assert.equal(before.globals.seed, 5);
  w.feedback(true);
  w.send('kit', 'shuffle');
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'kit_seed').pop(), ['kit_seed', 6]);
  w.settle();
  const after = w.state();
  assert.equal(after.globals.seed, 6);
  assert.notDeepEqual(after.slots[0].keys, before.slots[0].keys, 'map changed');
  assert.deepEqual(after.slots[0].keys.filter((k) => k !== null).sort(), before.slots[0].keys.filter((k) => k !== null).sort(),
    'same set of pads without flip');
  // same seed, same state -> same shuffle (deterministic)
  const w2 = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w2.send('kit', 'seed', 5);
  w2.send('kit', 'shuffle');
  w2.settle();
  assert.deepEqual(w2.state().slots[0].keys, after.slots[0].keys);
  // undo restores the map
  w.send('kit', 'undo');
  w.settle();
  assert.deepEqual(w.state().slots[0].keys, before.slots[0].keys);
  // seed keeps counting
  w.send('kit', 'shuffle');
  w.settle();
  assert.equal(w.state().globals.seed, 7);
});

test('shuffle respects scope=sample (selected source) and mode', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  const before = w.state();
  const idB = before.sources[1].id;
  w.send('ui', 'selectsource', 1);
  w.send('kit', 'shufflescope', 1);
  w.send('kit', 'shufflemode', 1);
  w.send('kit', 'shuffle');
  w.settle();
  const after = w.state();
  assert.equal(after.globals.shuffleScope, 'source');
  assert.equal(after.globals.shuffleMode, 'smart');
  after.slots[0].keys.forEach((id, k) => {
    if (id === null || id === undefined) { return; }
    const was = before.slots[0].keys[k];
    if (before.pads[String(was)].sourceId !== idB) {
      assert.equal(id, was, 'key ' + k + ' of the other sample unchanged');
    }
  });
});

test('kit params map to globals', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('kit', 'layout', 1);
  w.send('kit', 'zonealign', 1);
  w.send('kit', 'sortby', 2);
  w.send('kit', 'root', 48);
  w.send('kit', 'flip', 25);
  w.send('kit', 'bestn', 6);
  w.send('kit', 'chokescope', 1);
  w.send('kit', 'modzone', 1);
  w.send('kit', 'modstart', 90);
  w.send('kit', 'velsens', 80);
  w.send('kit', 'pressure2level', 1);
  w.send('kit', 'shufflemode', 1);
  w.send('kit', 'shufflescope', 1);
  w.settle();
  const g = w.state().globals;
  assert.equal(g.layout, 'interleave');
  assert.equal(g.zoneAlign, true);
  assert.equal(g.sortBy, 'length');
  assert.equal(g.rootKey, 48);
  assert.equal(g.flipPct, 25);
  assert.equal(g.bestN, 6);
  assert.equal(g.chokeScope, 'global');
  assert.equal(g.modZoneOn, true);
  assert.equal(g.modZoneStart, 90);
  assert.equal(g.velSens, 80);
  assert.equal(g.pressureToLevel, true);
  assert.equal(g.shuffleMode, 'smart');
  assert.equal(g.shuffleScope, 'source');
  const fb = Object.fromEntries(w.feedback());
  assert.equal(fb.kit_layout, 1);
  assert.equal(fb.kit_root, 48);
  assert.equal(fb.kit_sortby, 2);
  assert.equal(fb.kit_modstart, 90);
  const v = w.view();
  assert.equal(v.rootKey, 48);
  assert.ok(v.keys[48] >= 0 && v.keys[47] === -1, 'layout starts at the new root');
  assert.equal(v.keyFlags[90] & 8, 8);
});

test('kit slot / copyslot / relayout', () => {
  const w = loadedWorld();
  w.send('kit', 'copyslot', 2);
  w.send('kit', 'slot', 2);
  w.settle();
  const st = w.state();
  assert.equal(st.currentSlot, 2);
  assert.deepEqual(st.slots[2].keys, st.slots[0].keys);
  assert.equal(w.view().slot, 2);
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'kit_slot').pop(), ['kit_slot', 2]);
  w.send('ui', 'selectkey', 40);
  w.send('pad', 'clear');
  w.settle();
  assert.equal(padOnKey(w.state(), 40), null);
  assert.ok(padOnKey(w.state(), 40, 0), 'slot A still has it');
  w.send('kit', 'relayout');
  w.settle();
  assert.ok(padOnKey(w.state(), 40), 'relayout fills the slot again');
  w.send('kit', 'slot', 99);
  w.settle();
  assert.equal(w.state().currentSlot, 7, 'clamped');
});

test('kit findbest places bestn slices from the root', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('kit', 'bestn', 4);
  w.send('kit', 'findbest');
  w.settle();
  const st = w.state();
  const occupied = st.slots[0].keys.map((id, k) => (id === null ? -1 : k)).filter((k) => k >= 0);
  assert.equal(occupied.length, 4);
  assert.equal(occupied[0], 36);
});

test('kit repeat/rate/swing/alt refresh held voices', () => {
  const w = loadedWorld();
  w.send('source', 'trigmode', 1);
  w.send('note', 36, 100);
  const voice = w.commands(true)[0].target;
  w.send('kit', 'rate', 5);
  w.send('kit', 'repeat', 1);
  let cmds = w.commands(true);
  assert.ok(cmds.some((c) => c.target === voice && c.params.some((p) => p[0] === 'rptdiv' && p[1] > 0)), 'held voice repeats');
  w.send('kit', 'swing', 50);
  w.send('kit', 'alt', 1);
  cmds = w.commands(true);
  assert.ok(cmds.some((c) => c.target === voice && c.params.some((p) => p[0] === 'rptswing')));
  assert.ok(cmds.some((c) => c.target === voice && c.params.some((p) => p[0] === 'rptalt' && p[1] === 1)));
  const g = w.model().globals();
  assert.equal(g.repeatDiv, '1/32');
  assert.equal(g.repeatOn, true);
  assert.equal(g.swing, 50);
  assert.equal(g.repeatAlt, true);
  w.send('kit', 'chaos', 40);
  assert.equal(w.model().globals().chaos, 40);
});

test('kit panic kills all voices', () => {
  const w = loadedWorld();
  w.send('note', 36, 100);
  w.commands(true);
  w.send('kit', 'panic');
  const cmds = w.commands(true);
  assert.ok(cmds.length >= 1);
  assert.ok(cmds.some((c) => c.params.some((p) => p[0] === 'kill')));
});

// ---------------------------------------------------------------------------
// Source edits & manual slicing
// ---------------------------------------------------------------------------

test('source slicing params reslice immediately; features stay aligned', () => {
  const w = loadedWorld();
  const n0 = w.model().getSourceBySlot(0).slices.length;
  w.send('source', 'slicemode', 2);
  w.send('source', 'regions', 8);
  w.settle();
  let s = w.state().sources[0];
  assert.equal(s.slicing.mode, 'region');
  assert.equal(s.slicing.regions, 8);
  assert.equal(s.slices.length, 8);
  assert.ok(s.slices.every((sl) => sl.features), 'features for every new slice');
  assert.equal(s.slices[0].start, 0);
  assert.equal(s.slices[7].end, s.frames);
  const fb = Object.fromEntries(w.feedback());
  assert.equal(fb.src_slicemode, 2);
  assert.equal(fb.src_regions, 8);
  assert.equal(w.view().slices.length, 8);
  assert.equal(w.view().sources[0].slices, 8);

  w.send('source', 'slicemode', 0);
  w.send('source', 'sensitivity', 90);
  w.settle();
  const hi = w.state().sources[0].slices.length;
  w.send('source', 'sensitivity', 10);
  w.settle();
  const lo = w.state().sources[0].slices.length;
  assert.ok(hi >= lo, 'higher sensitivity gives at least as many slices (' + hi + ' vs ' + lo + ')');
  assert.ok(hi >= n0 || n0 >= lo);
  w.send('source', 'minslice', 100);
  w.send('source', 'snap', 0);
  w.send('source', 'bpm', 120);
  w.send('source', 'beatdiv', 2);
  w.send('source', 'slicemode', 1);
  w.settle();
  s = w.state().sources[0];
  assert.equal(s.slicing.mode, 'beat');
  assert.equal(s.slicing.minSliceMs, 100);
  assert.equal(s.slicing.snap, false);
  assert.equal(s.slicing.bpm, 120);
  assert.equal(s.slicing.beatDiv, '1/8');
  const sliceCount = s.slices.length;
  assert.ok(sliceCount >= 2 && s.slices.every((sl) => sl.features));
  w.send('source', 'reslice');
  w.settle();
  assert.equal(w.state().sources[0].slices.length, sliceCount, 'reslice with unchanged settings is stable');
});

test('source playmode / trigmode', () => {
  const w = loadedWorld();
  w.send('source', 'playmode', 2);
  w.send('source', 'trigmode', 1);
  w.settle();
  const s = w.state().sources[0];
  assert.equal(s.playMode, 'thru');
  assert.equal(s.trigMode, 'gate');
  assert.equal(w.view().sources[0].playMode, 'thru');
  assert.equal(w.view().sources[0].trigMode, 'gate');
  const fb = Object.fromEntries(w.feedback());
  assert.equal(fb.src_playmode, 2);
  assert.equal(fb.src_trigmode, 1);
});

test('source remove clears the buffer and the keys', () => {
  const w = loadedWorld(['/audio/a.wav', '/audio/b.wav']);
  w.send('ui', 'selectsource', 0);
  w.send('source', 'remove');
  w.settle();
  assert.deepEqual(w.out(1).pop(), [0, 'clear']);
  const st = w.state();
  assert.equal(st.sources.length, 1);
  assert.equal(st.sources[0].name, 'b.wav');
  const v = w.view();
  assert.equal(v.sources.length, 1);
  assert.equal(v.selectedSource, 0);
  assert.equal(v.selectedFrames, 70560);
  w.send('source', 'remove');
  w.settle();
  assert.equal(w.state().sources.length, 0);
  assert.equal(w.view().selectedSource, -1);
  assert.equal(w.view().selectedFrames, 0);
  assert.equal(w.view().wave.length, 0);
  assert.doesNotThrow(() => w.send('source', 'remove'));
});

test('manual slice editing keeps features and switches to manual mode', () => {
  const w = loadedWorld();
  const frames = w.state().sources[0].frames;
  const n0 = w.state().sources[0].slices.length;
  w.send('ui', 'addslice', Math.floor(frames * 0.9));
  w.settle();
  let s = w.state().sources[0];
  assert.equal(s.slicing.mode, 'manual');
  assert.equal(s.slices.length, n0 + 1);
  assert.ok(s.slices.every((sl) => sl.features));
  assert.deepEqual(w.feedback().filter((m) => m[0] === 'src_slicemode').pop(), ['src_slicemode', 3]);

  // normalized position is accepted too
  w.send('ui', 'addslice', 0.5);
  w.settle();
  s = w.state().sources[0];
  assert.equal(s.slices.length, n0 + 2);
  assert.ok(s.slices.some((sl) => Math.abs(sl.start - frames / 2) <= 1));

  const idx = 1;
  const target = Math.floor((s.slices[idx].start + s.slices[idx].end) / 2);
  w.send('ui', 'moveslice', idx, target);
  w.settle();
  s = w.state().sources[0];
  assert.equal(s.slices.length, n0 + 2);
  assert.ok(Math.abs(s.slices[idx].start - target) <= 1 || s.slices[idx].start > 0);
  assert.ok(s.slices.every((sl) => sl.features));

  w.send('ui', 'removeslice', idx);
  w.settle();
  s = w.state().sources[0];
  assert.equal(s.slices.length, n0 + 1);
  assert.ok(s.slices.every((sl) => sl.features));
  assert.equal(w.view().slices.length, n0 + 1);

  // a manual source is not resliced by parameter changes
  w.send('source', 'sensitivity', 70);
  w.send('source', 'reslice');
  w.settle();
  assert.equal(w.state().sources[0].slices.length, n0 + 1);
  assert.equal(w.state().sources[0].slicing.mode, 'manual');
  // switching away re-runs the slicer
  w.send('source', 'slicemode', 2);
  w.settle();
  assert.equal(w.state().sources[0].slices.length, w.state().sources[0].slicing.regions);
});

// ---------------------------------------------------------------------------
// State save / restore
// ---------------------------------------------------------------------------

test('state is saved to the dict (debounced) and not before init', () => {
  const w = createWorld();
  w.send('kit', 'chaos', 12);
  w.settle();
  assert.equal(w.dicts.tstate, undefined, 'nothing written before init');
  w.send('init');
  w.send('kit', 'seed', 77);
  w.advance(100);
  assert.equal(w.dicts.tstate, undefined, 'debounced');
  w.send('kit', 'seed', 78);
  w.advance(250);
  assert.equal(w.dicts.tstate, undefined, 'debounce restarts');
  w.advance(100);
  assert.equal(w.state().globals.seed, 78);
  assert.equal(w.state().version, 1);
});

test('init restores sources, slices and pads from the dict without reslicing', () => {
  const w1 = loadedWorld(['/audio/drums.wav', '/audio/mono b.wav']);
  w1.send('ui', 'selectkey', 38);
  w1.send('pad', 'pitch', 7);
  w1.send('pad', 'decay', 421);
  w1.send('kit', 'chaos', 33);
  w1.send('kit', 'shuffle');
  // manual slices: a reslice would collapse them to a single slice
  w1.send('ui', 'selectsource', 1);
  const f = w1.state().sources[1].frames;
  w1.send('ui', 'addslice', Math.floor(f * 0.33));
  w1.send('ui', 'addslice', Math.floor(f * 0.66));
  w1.settle();
  const saved = w1.state();
  const manual = saved.sources[1];
  assert.equal(manual.slicing.mode, 'manual');

  const w2 = createWorld({ dicts: w1.dicts });
  w2.send('init');
  const reloads = w2.out(1);
  assert.deepEqual(reloads, [[0, 'replace', '/audio/drums.wav'], [1, 'replace', '/audio/mono b.wav']]);
  assert.deepEqual(w2.out(3)[0], ['viewdict', 'tview']);
  w2.settle();

  const restored = w2.plain(w2.model().toJSON());
  assert.deepEqual(restored.sources, saved.sources, 'slices & features kept, not recomputed');
  assert.deepEqual(restored.pads, saved.pads);
  assert.deepEqual(restored.slots, saved.slots);
  assert.deepEqual(restored.globals, saved.globals);
  assert.equal(restored.sources[1].slices.length, manual.slices.length);

  const v = w2.view();
  assert.equal(v.sources.length, 2);
  assert.ok(v.sources.every((s) => s.loaded === 1), 'buffers reloaded');
  assert.equal(v.wave.length, 1024);
  assert.ok(v.wave.some((x) => x !== 0), 'overview rebuilt');
  assert.equal(v.selectedFrames, saved.sources[0].frames);
  assert.equal(v.keys.filter((c) => c >= 0).length, saved.slots[0].keys.filter((k) => k !== null).length);

  // it plays: the restored engine points at the re-created buffers
  w2.clear();
  const key = saved.slots[0].keys.findIndex((id) => id !== null);
  w2.send('note', key, 100);
  const cmds = w2.commands(true);
  assert.ok(cmds.length >= 1);
  assert.match(String(cmds[0].params.find((p) => p[0] === 'src')[1]), /^tsrc[01]$/);

  // editing continues to work on the restored model
  w2.send('ui', 'selectkey', 38);
  w2.send('pad', 'pitch', 2);
  w2.settle();
  assert.equal(padOnKey(w2.state(), 38).pitch, 2);
});

test('restore re-slices only when the file changed (frame count differs)', () => {
  const w1 = loadedWorld(['/audio/drums.wav']);
  w1.settle();
  const w2 = createWorld({ dicts: w1.dicts, seconds: 1.0 });
  w2.send('init');
  w2.settle();
  const s = w2.state ? w2.plain(w2.model().toJSON()).sources[0] : null;
  assert.equal(s.frames, 44100);
  assert.equal(s.slices[s.slices.length - 1].end, 44100, 'slices cover the new length');
});

test('automatable params received before init win over the dict', () => {
  const w1 = loadedWorld(['/audio/drums.wav']);
  w1.send('kit', 'chaos', 10);
  w1.send('kit', 'slot', 1);
  w1.send('kit', 'swing', 5);
  w1.settle();
  assert.equal(w1.state().globals.chaos, 10);
  assert.equal(w1.state().currentSlot, 1);

  const w2 = createWorld({ dicts: w1.dicts });
  w2.send('kit', 'chaos', 77);
  w2.send('kit', 'slot', 3);
  w2.send('kit', 'rate', 5);
  w2.send('kit', 'repeat', 1);
  w2.send('kit', 'swing', 40);
  w2.send('kit', 'alt', 1);
  w2.send('init');
  w2.settle();
  const m = w2.model();
  const g = w2.plain(m.globals());
  assert.equal(g.chaos, 77);
  assert.equal(g.repeatDiv, '1/32');
  assert.equal(g.repeatOn, true);
  assert.equal(g.swing, 40);
  assert.equal(g.repeatAlt, true);
  assert.equal(m.currentSlot(), 3);
  assert.deepEqual(w2.feedback().filter((f) => f[0] === 'kit_slot').pop(), ['kit_slot', 3]);
  assert.equal(w2.plain(m.toJSON()).sources.length, 1, 'rest of the state restored');
  // and it was saved again
  assert.equal(w2.state().globals.chaos, 77);
  assert.equal(w2.state().currentSlot, 3);
});

test('restore survives the lossy Max dict round trip (1/0 bools, "null", flattened arrays)', () => {
  const w1 = loadedWorld(['/audio/drums.wav', '/audio/b.wav'], { quirks: true });
  w1.send('ui', 'selectkey', 38);
  w1.send('pad', 'reverse', 1);
  w1.send('pad', 'lock', 1);
  w1.send('pad', 'layerarm', 1);
  w1.send('ui', 'selectkey', 40);
  w1.send('kit', 'shuffle');
  w1.settle();
  const raw = w1.state();
  assert.equal(raw.pads[Object.keys(raw.pads)[0]].reverse === 0 || raw.pads[Object.keys(raw.pads)[0]].reverse === 1, true,
    'the mock dict really mangled booleans');
  const w2 = createWorld({ dicts: w1.dicts, quirks: true });
  w2.send('init');
  assert.equal(w2.posts.filter((p) => /restore/.test(p)).length, 0, w2.posts.join('|'));
  w2.settle();
  const m = w2.plain(w2.model().toJSON());
  assert.equal(m.sources.length, 2);
  const key38 = padOnKey(m, 38);
  assert.ok(key38 && key38.reverse === true, 'bool restored: ' + JSON.stringify(key38));
  assert.ok(m.slots.every((s) => s.keys.length === 128 && s.locks.length === 128));
  assert.ok(m.slots.every((s) => s.keys.every((k) => k === null || typeof k === 'number')));
  assert.ok(m.slots.every((s) => s.locks.every((b) => typeof b === 'boolean')));
  assert.ok(Object.values(m.pads).every((p) => Array.isArray(p.layers)));
  assert.equal(typeof m.globals.repeatOn, 'boolean');
  assert.ok(m.sources.every((s) => typeof s.slicing.snap === 'boolean'));
  assert.equal(w2.view().sources.length, 2);
});

test('a corrupt or empty state dict is ignored', () => {
  const dicts = { tstate: '{"nonsense": true' };
  const a = createWorld({ dicts });
  assert.doesNotThrow(() => a.send('init'));
  assert.equal(a.model().listSources().length, 0);
  const b = createWorld({ dicts: { tstate: '{}' } });
  assert.doesNotThrow(() => b.send('init'));
  const c = createWorld({ dicts: { tstate: '{"version":1,"sources":"garbage"}' } });
  assert.doesNotThrow(() => c.send('init'));
  assert.ok(c.model().listSources().length === 0);
  const d = createWorld({ dictThrows: true });
  assert.doesNotThrow(() => d.send('init'));
  assert.ok(d.posts.some((p) => p.startsWith('SliceKit:')));
  assert.deepEqual(d.out(3)[0], ['viewdict', 'tview']);
});

test('nothing is sent to controls or jsui before init; init sends everything', () => {
  const w = createWorld();
  w.send('loadbang');
  w.send('kit', 'slot', 2);
  w.send('kit', 'chaos', 20);
  w.send('drop', '/audio/early.wav');
  w.settle();
  assert.equal(w.out(2).length, 0, 'no feedback');
  assert.equal(w.out(3).length, 0, 'no view output');
  assert.equal(w.dicts.tview, undefined);
  assert.equal(w.dicts.tstate, undefined);
  w.send('init');
  assert.equal(w.out(2).length, ALL_FB.length, 'full feedback at init');
  assert.deepEqual(w.out(3).slice(0, 2), [['viewdict', 'tview'], ['refresh']]);
  assert.deepEqual(w.out(2).find((m) => m[0] === 'kit_slot'), ['kit_slot', 2]);
  assert.ok(w.dicts.tview);
});

test('notifydeleted flushes a pending save and is safe to call twice', () => {
  const w = createWorld();
  w.init();
  w.send('kit', 'seed', 4242 % 9999);
  w.advance(50);
  assert.equal(w.dicts.tstate, undefined, 'debounce still pending');
  assert.doesNotThrow(() => w.get('notifydeleted')());
  assert.equal(w.state().globals.seed, 4242 % 9999);
  assert.doesNotThrow(() => w.get('notifydeleted')());
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

test('unknown or malformed messages never throw', () => {
  const w = loadedWorld();
  const bad = [
    ['bogus', 1, 2], ['pad', 'nope', 1], ['kit', 'zzz'], ['ui', 'selectkey', 'abc'], ['ui', 'wat'],
    ['source', 'wat', 1], ['note', 'x', 'y'], ['note'], ['pad'], ['kit'], ['ui'], ['source'], ['loaded', 'abc'],
    ['loaded'], ['voiceend', 'q'], ['voiceend'], ['drop'], ['load', ''], ['constructor'], ['__proto__'],
    ['hasOwnProperty'], ['toString'], ['polypressure'], ['pressure'], ['pressure', 'loud'],
    ['ui', 'selectkey', 9999], ['ui', 'selectkey', -5], ['ui', 'addslice'], ['ui', 'moveslice', 99, 1e12],
    ['ui', 'removeslice', 99], ['ui', 'selectslice', 99], ['ui', 'selectsource', 99], ['ui', 'audition'],
    ['kit', 'slot', 'x'], ['kit', 'rate', 999], ['kit', 'layout', -3], ['pad', 'pitch', 'abc'],
    ['pad', 'spreadparam', 77], ['source', 'slicemode', 77], ['kit', 'copyslot', 55]
  ];
  for (const m of bad) {
    assert.doesNotThrow(() => w.send(...m), 'message ' + JSON.stringify(m));
  }
  assert.doesNotThrow(() => { w.send('msg_int', 5); w.send('msg_float', 1.5); w.send('list', 1, 2, 3); w.send('bang'); w.send('loadbang'); });
  w.settle();
  assert.ok(w.posts.every((p) => p.startsWith('SliceKit:')), 'all posts carry the prefix');
  // still alive
  w.send('ui', 'selectkey', 36);
  w.send('note', 36, 100);
  assert.ok(w.commands(true).length >= 1);
});

test('errors inside handlers are posted with the prefix, not thrown', () => {
  const w = loadedWorld();
  const glue = w.glue();
  const real = glue.model.setGlobal;
  glue.model.setGlobal = function () { throw new Error('boom'); };
  assert.doesNotThrow(() => w.send('kit', 'velsens', 10));
  glue.model.setGlobal = real;
  const err = w.posts.find((p) => /boom/.test(p));
  assert.ok(err && err.startsWith('SliceKit:'), w.posts.join('|'));
  assert.doesNotThrow(() => w.send('kit', 'velsens', 11));
  assert.equal(w.model().globals().velSens, 11);
});

test('unknown message names are reported once', () => {
  const w = createWorld();
  w.send('frobnicate');
  w.send('frobnicate');
  assert.equal(w.posts.filter((p) => /frobnicate/.test(p)).length, 1);
});

test('view refresh is coalesced: many edits, one refresh per 30 ms window', () => {
  const w = loadedWorld();
  w.clear();
  for (let i = 0; i < 20; i++) { w.send('ui', 'selectkey', 36 + (i % 5)); }
  assert.equal(w.out(3).length, 0, 'nothing written synchronously');
  w.advance(40);
  assert.equal(w.out(3).filter((m) => m[0] === 'refresh').length, 1);
});

test('bang writes the view dict immediately', () => {
  const w = loadedWorld();
  w.clear();
  w.send('bang');
  assert.deepEqual(w.out(3), [['refresh']]);
});
