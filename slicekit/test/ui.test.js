'use strict';
/*
 * Tests for max/ui.js (the jsui view).  The script is loaded into a node `vm`
 * context with mocked Max globals: mgraphics (records every call), outlet,
 * post, Dict, box, inlets/outlets, jsarguments.  Values that come out of the
 * context are inspected through primitives (or JSON round trips) because
 * objects created inside a vm context have a different Array.prototype.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_PATH = path.join(__dirname, '..', 'max', 'ui.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

const PALETTE = ['#FF5A5A', '#FFA54A', '#FFD84A', '#9BE35A', '#3FCF8E', '#3FD1D1', '#4AA8FF', '#7A7CFF',
  '#B57CFF', '#FF7CE0', '#FF8C8C', '#C9A27A', '#A0A0A0', '#6FD0FF', '#E0FF7C', '#FFB3D1'];

const MG_METHODS = ['init', 'redraw', 'set_source_rgba', 'rectangle', 'fill', 'stroke', 'move_to',
  'line_to', 'set_line_width', 'select_font_face', 'set_font_size', 'show_text', 'arc', 'close_path'];

/* ------------------------------------------------------------------ harness */

function plain(x) {
  return JSON.parse(JSON.stringify(x));
}

/*
 * Load ui.js into a fresh context.  mgraphics only offers the methods in
 * MG_METHODS, so using any other mgraphics call makes the script throw.
 */
function load(opts) {
  opts = opts || {};
  const log = [];
  const out = [];
  const posts = [];
  const dicts = {};
  const tasks = [];
  const mg = { relative_coords: 1, autofill: 1 };
  MG_METHODS.forEach((name) => {
    mg[name] = (...a) => { log.push([name, ...a]); };
  });
  mg.text_measure = (s) => [String(s).length * 5, 9];

  const w = opts.w || 600;
  const h = opts.h || 160;
  const sandbox = {
    mgraphics: mg,
    outlet: (n, ...a) => { assert.equal(n, 0, 'only outlet 0 is used'); out.push(a); },
    post: (...a) => { posts.push(a.join('')); },
    Dict: function Dict(name) {
      if (opts.dictThrows) { throw new Error('no such dict'); }
      this.stringify = () => (typeof dicts[name] === 'string' ? dicts[name] : JSON.stringify(dicts[name] === undefined ? {} : dicts[name]));
    },
    box: { rect: [10, 20, 10 + w, 20 + h] },
    jsarguments: opts.jsarguments || ['slicekit-ui.js'],
    module: { exports: {} }
  };
  /* Max's Task: schedule(ms) arms it, cancel() disarms it; env.tick() fires the armed ones */
  if (!opts.noTask) {
    sandbox.Task = function Task(fn, obj) {
      this.pending = null;
      this.cancels = 0;
      this.schedule = (ms) => { this.pending = ms; };
      this.cancel = () => { this.pending = null; this.cancels++; };
      this.fire = () => { this.pending = null; fn.call(obj); };
      tasks.push(this);
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'ui.js' });

  const env = {
    sb: sandbox, ex: sandbox.module.exports, mg, log, out, posts, dicts, tasks,
    tick() {
      const armed = tasks.filter((t) => t.pending !== null);
      armed.forEach((t) => t.fire());
      return armed.length;
    },
    get: (expr) => vm.runInContext(expr, sandbox),
    set: (name, view) => { dicts[name] = view; },
    show(view, name) {
      dicts[name || 'v'] = view;
      sandbox.viewdict(name || 'v');
    },
    msgs: () => out.map((m) => m.join(' ')),
    clear() { out.length = 0; log.length = 0; },
    redraws: () => log.filter((c) => c[0] === 'redraw').length,
    texts: () => log.filter((c) => c[0] === 'show_text').map((c) => c[1]),
    click(x, y, mods) {
      mods = mods || {};
      sandbox.onclick(x, y, 1, mods.cmd ? 1 : 0, mods.shift ? 1 : 0, 0, mods.option ? 1 : 0, mods.ctrl ? 1 : 0);
    },
    drag(x, y, mods) {
      mods = mods || {};
      sandbox.ondrag(x, y, 1, mods.cmd ? 1 : 0, mods.shift ? 1 : 0, 0, mods.option ? 1 : 0, mods.ctrl ? 1 : 0);
    },
    release(x, y) {
      sandbox.ondrag(x, y, 0, 0, 0, 0, 0, 0);
    },
    paint() {
      env.log.length = 0;
      sandbox.paint();
    }
  };
  return env;
}

function makeView(over) {
  const wave = [];
  for (let i = 0; i < 512; i++) {
    const a = Math.abs(0.8 * Math.sin(i / 20)) * (1 - i / 600);
    wave.push(-a, a);
  }
  const slices = [];
  for (let i = 0; i < 8; i++) { slices.push([i / 8, (i + 1) / 8]); }
  const keys = new Array(128).fill(-1);
  const flags = new Array(128).fill(0);
  for (let k = 36; k < 36 + 40; k++) { keys[k] = (k >> 2) % 3; }
  flags[37] = 1;
  flags[38] = 2;
  flags[39] = 4;
  flags[41] = 1 | 2 | 4;
  flags[42] = 16;
  flags[44] = 32;
  flags[46] = 2 | 32;
  return Object.assign({
    status: 'Ready - 8 slices',
    palette: PALETTE,
    sources: [
      { index: 0, id: 1, name: 'amen_break', color: 0, playMode: 'mono', trigMode: 'trigger', slices: 8, loaded: 1 },
      { index: 3, id: 5, name: 'vocal chop that has a very long name', color: 3, playMode: 'poly', trigMode: 'gate', slices: 12, loaded: 1 },
      { index: 7, id: 9, name: 'pending', color: 7, playMode: 'mono', trigMode: 'trigger', slices: 0, loaded: 0 }
    ],
    selectedSource: 0,
    wave,
    slices,
    selectedSlice: 2,
    keys,
    keyFlags: flags,
    selectedKey: 40,
    rootKey: 36,
    slot: 2,
    armed: '',
    selectedFrames: 480000
  }, over || {});
}

function fullView() {
  const sources = [];
  for (let i = 0; i < 16; i++) {
    sources.push({ index: i, id: i + 1, name: 'sample number ' + i, color: i, playMode: 'mono', trigMode: 'trigger', slices: 3 + i, loaded: i % 5 === 4 ? 0 : 1 });
  }
  const keys = [];
  const flags = [];
  for (let k = 0; k < 128; k++) {
    keys.push(k % 17 === 16 ? -1 : k % 16);
    flags.push((k % 64) & ~8);
  }
  for (let k = 96; k < 108; k++) { flags[k] = 8; keys[k] = -1; }
  return makeView({ sources, selectedSource: 5, keys, keyFlags: flags, selectedKey: 100, rootKey: 96, armed: 'layer', slot: 7, selectedFrames: 1234567 });
}

/* every number handed to mgraphics is finite and rectangles stay on the canvas */
function assertSanePaint(env, label) {
  const W = env.get('layout.w');
  const H = env.get('layout.h');
  for (const c of env.log) {
    for (const a of c.slice(1)) {
      if (typeof a === 'number') {
        assert.ok(Number.isFinite(a), `${label}: non-finite argument in ${c[0]}: ${JSON.stringify(c)}`);
      }
    }
    if (c[0] === 'rectangle') {
      const [, x, y, w, h] = c;
      assert.ok(w >= 0 && h >= 0, `${label}: negative rectangle ${JSON.stringify(c)}`);
      assert.ok(x >= -0.01 && y >= -0.01 && x + w <= W + 0.01 && y + h <= H + 0.01,
        `${label}: rectangle outside ${W}x${H}: ${JSON.stringify(c)}`);
    }
  }
}

/* ------------------------------------------------------------------ wiring */

test('top-level wiring: mgraphics setup, inlets/outlets, handlers, exports', () => {
  const env = load();
  assert.equal(env.log.filter((c) => c[0] === 'init').length, 1);
  assert.equal(env.mg.relative_coords, 0);
  assert.equal(env.mg.autofill, 0);
  assert.equal(env.get('inlets'), 1);
  assert.equal(env.get('outlets'), 1);
  for (const fn of ['paint', 'viewdict', 'refresh', 'bang', 'onresize', 'onclick', 'ondrag', 'ondblclick']) {
    assert.equal(typeof env.sb[fn], 'function', fn);
  }
  for (const fn of ['computeLayout', 'hitTest', 'keyAt', 'keyRect', 'tabAt', 'shiftedWinStart', 'followWinStart', 'normalizeView']) {
    assert.equal(typeof env.ex[fn], 'function', fn);
  }
});

test('file is ES5-clean and ASCII', () => {
  assert.ok(/^[\x00-\x7f]*$/.test(SRC), 'non-ASCII characters in ui.js');
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* optional */ }
  if (acorn) {
    assert.doesNotThrow(() => acorn.parse(SRC, { ecmaVersion: 5 }));
  }
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const forbidden = [
    [/=>/, 'arrow function'], [/`/, 'template literal'], [/\blet\b/, 'let'], [/\bconst\b/, 'const'],
    [/\bclass\b/, 'class'], [/\bnew (Map|Set|WeakMap|Promise)\b/, 'Map/Set/Promise'], [/\bSymbol\b/, 'Symbol'],
    [/\.(includes|startsWith|endsWith|repeat|padStart|padEnd|find|findIndex)\(/, 'ES6 method'],
    [/\.fill\([^)]/, 'Array.prototype.fill'], [/Object\.assign/, 'Object.assign'],
    [/\.\.\./, 'spread / rest (use the string "..." only inside quotes)']
  ];
  for (const [re, what] of forbidden) {
    const stripped = code.replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    assert.ok(!re.test(stripped), `forbidden ${what}`);
  }
});

/* ------------------------------------------------------------------ layout */

test('layout for 600x160', () => {
  const { ex } = load();
  const L = plain(ex.computeLayout(600, 160));
  assert.deepEqual(L.tabs, { x: 2, y: 1, w: 596, h: 18 });
  assert.deepEqual(L.wave, { x: 2, y: 21, w: 596, h: 70 });
  assert.deepEqual(L.keys, { x: 2, y: 93, w: 596, h: 50 });
  assert.deepEqual(L.status, { x: 2, y: 145, w: 596, h: 14 });
  assert.deepEqual(L.prev, { x: 2, y: 93, w: 14, h: 50 });
  assert.deepEqual(L.next, { x: 584, y: 93, w: 14, h: 50 });
  assert.deepEqual(L.board, { x: 18, y: 93, w: 564, h: 50 });
  assert.equal(L.whiteW * 28, L.board.w);
  assert.ok(L.blackH < L.board.h && L.blackH > L.board.h / 2);
  assert.ok(L.blackW < L.whiteW);
  assert.equal(L.w, 600);
  assert.equal(L.h, 160);
});

test('layout adapts to other sizes without overlap', () => {
  const { ex } = load();
  const big = plain(ex.computeLayout(900, 300));
  assert.deepEqual(big.tabs, { x: 2, y: 1, w: 896, h: 18 });
  assert.equal(big.status.h, 14);
  assert.equal(big.wave.h + big.keys.h, 300 - 2 - 6 - 32);
  assert.ok(big.wave.h > 100 && big.keys.h > 80);

  for (const [w, h] of [[600, 160], [900, 300], [320, 100], [200, 80], [1200, 160], [50, 50]]) {
    const L = plain(ex.computeLayout(w, h));
    const rows = [L.tabs, L.wave, L.keys, L.status];
    for (let i = 0; i < rows.length; i++) {
      assert.ok(rows[i].w > 0 && rows[i].h > 0, `${w}x${h} row ${i}`);
      assert.ok(rows[i].x >= 0 && rows[i].x + rows[i].w <= L.w, `${w}x${h} row ${i} horizontal`);
      if (i > 0) {
        assert.ok(rows[i].y >= rows[i - 1].y + rows[i - 1].h, `${w}x${h} row ${i} overlaps previous`);
      }
    }
    assert.ok(L.status.y + L.status.h <= L.h, `${w}x${h} status inside canvas`);
    assert.ok(L.board.w > 0 && L.board.x >= L.prev.x + L.prev.w && L.board.x + L.board.w <= L.next.x, `${w}x${h} board between arrows`);
  }
  /* sizes below the minimum are clamped */
  const tiny = plain(ex.computeLayout(50, 50));
  assert.equal(tiny.w, 80);
  assert.equal(tiny.h, 80);
});

test('onresize recomputes the layout and redraws; box.rect is the initial size', () => {
  const env = load({ w: 400, h: 120 });
  assert.equal(env.get('layout.w'), 600, 'default before the first paint');
  env.paint();
  assert.equal(env.get('layout.w'), 400);
  assert.equal(env.get('layout.h'), 120);
  assertSanePaint(env, '400x120 from box');

  env.clear();
  env.sb.onresize(300, 200);
  assert.equal(env.get('layout.w'), 300);
  assert.equal(env.get('layout.h'), 200);
  assert.ok(env.redraws() >= 1);
  env.paint();
  assert.equal(env.get('layout.w'), 300, 'box.rect no longer overrides after onresize');
  assertSanePaint(env, '300x200');
});

/* ------------------------------------------------------------- key geometry */

test('key <-> x mapping round-trips for every window position', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  for (const ws of [0, 1, 12, 35, 36, 37, 48, 60, 72, 79, 80]) {
    let whites = 0;
    for (let k = ws; k < ws + 48; k++) {
      const r = ex.keyRect(L, ws, k);
      assert.ok(r, `ws ${ws} key ${k} has a rect`);
      assert.ok(r.x >= L.board.x - 1e-9 && r.x + r.w <= L.board.x + L.board.w + 1e-9, `ws ${ws} key ${k} inside board`);
      assert.equal(r.black, ex.isBlackKey(k));
      if (!r.black) { whites++; }
      const c = ex.keyCenter(L, ws, k);
      assert.equal(ex.keyAt(L, ws, c.x, c.y), k, `ws ${ws} key ${k} center maps back`);
      assert.equal(ex.hitTest(L, ex.normalizeView(null), ws, c.x, c.y).key, k);
    }
    assert.equal(whites, 28, `ws ${ws}: 28 white keys`);
    assert.equal(ex.keyRect(L, ws, ws - 1), null);
    assert.equal(ex.keyRect(L, ws, ws + 48), null);
  }
});

test('white keys tile the board; black keys sit on the boundaries', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  const ws = 36;
  assert.equal(ex.keyRect(L, ws, 36).x, L.board.x);
  assert.ok(Math.abs(ex.keyRect(L, ws, 38).x - (L.board.x + L.whiteW)) < 1e-9);
  assert.ok(Math.abs(ex.keyRect(L, ws, 40).x - (L.board.x + 2 * L.whiteW)) < 1e-9);
  assert.ok(Math.abs(ex.keyRect(L, ws, 41).x - (L.board.x + 3 * L.whiteW)) < 1e-9, 'F follows E directly');
  const cs = ex.keyRect(L, ws, 37);
  assert.ok(Math.abs(cs.x + cs.w / 2 - (L.board.x + L.whiteW)) < 1e-9, 'C# centred on the C/D boundary');
  assert.equal(cs.h, L.blackH);
  assert.equal(ex.keyRect(L, ws, 36).h, L.board.h);
});

test('hit testing: black keys win over the white keys they overlap (top only)', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  const ws = 36;
  const bx = L.board.x + L.whiteW;              /* C#3 centre = boundary of C and D */
  const top = L.board.y + 2;
  const bottom = L.board.y + L.board.h - 2;
  assert.equal(ex.keyAt(L, ws, bx, top), 37);
  assert.equal(ex.keyAt(L, ws, bx - L.blackW / 2 + 0.5, top), 37);
  assert.equal(ex.keyAt(L, ws, bx + L.blackW / 2 - 0.5, top), 37);
  assert.equal(ex.keyAt(L, ws, bx - L.blackW / 2 - 0.5, top), 36, 'just left of the black key: C');
  assert.equal(ex.keyAt(L, ws, bx + L.blackW / 2 + 0.5, top), 38, 'just right of the black key: D');
  assert.equal(ex.keyAt(L, ws, bx - 1, bottom), 36, 'below the black key, left of the boundary: C');
  assert.equal(ex.keyAt(L, ws, bx + 1, bottom), 38, 'below the black key, right of the boundary: D');
  assert.equal(ex.keyAt(L, ws, bx, L.board.y + L.blackH - 0.5), 37);
  assert.equal(ex.keyAt(L, ws, bx + 0.01, L.board.y + L.blackH + 0.5), 38, 'first row under the black key');
  /* E and F have no black key between them */
  const ef = L.board.x + 3 * L.whiteW;
  assert.equal(ex.keyAt(L, ws, ef - 1, top), 40);
  assert.equal(ex.keyAt(L, ws, ef + 1, top), 41);
  /* outside the board */
  assert.equal(ex.keyAt(L, ws, L.board.x - 1, top), -1);
  assert.equal(ex.keyAt(L, ws, L.board.x + L.board.w, top), -1);
  assert.equal(ex.keyAt(L, ws, bx, L.board.y - 1), -1);
});

test('key window starting or ending on a black key is clamped to the board', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  const first = ex.keyRect(L, 37, 37);           /* C# first in the window */
  assert.equal(first.x, L.board.x);
  assert.ok(first.w < L.blackW && first.w > 0);
  const last = ex.keyRect(L, 35, 82);            /* A# last in the window */
  assert.ok(Math.abs(last.x + last.w - (L.board.x + L.board.w)) < 1e-9);
  assert.equal(ex.keyAt(L, 37, L.board.x + 1, L.board.y + 2), 37);
  assert.equal(ex.keyAt(L, 35, L.board.x + L.board.w - 1, L.board.y + 2), 82);
});

test('key outlines: white keys have notches next to black keys', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  assert.equal(ex.keyPolygon(L, 36, 36).length, 12, 'C: black key on the right only');
  assert.equal(ex.keyPolygon(L, 36, 38).length, 16, 'D: black keys on both sides');
  assert.equal(ex.keyPolygon(L, 36, 40).length, 12, 'E: black key on the left only');
  assert.equal(ex.keyPolygon(L, 36, 41).length, 12, 'F: F# on the right only');
  assert.equal(ex.keyPolygon(L, 36, 43).length, 16, 'G: F# and G# on both sides');
  assert.equal(ex.keyPolygon(L, 36, 47).length, 12, 'B: A# on the left only');
  assert.equal(ex.keyPolygon(L, 36, 48).length, 12, 'C: C# on the right only');
  assert.equal(ex.keyPolygon(L, 36, 37).length, 8, 'black key: plain rectangle');
  assert.equal(ex.keyPolygon(L, 37, 38).length, 16);
  assert.equal(ex.keyPolygon(L, 36, 20), null);
});

test('mod zone hatch segments stay inside their rectangle', () => {
  const { ex } = load();
  const segs = plain(ex.hatchSegments(10, 20, 14, 30, 5));
  assert.ok(segs.length > 5);
  for (const [x1, y1, x2, y2] of segs) {
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      assert.ok(x >= 10 - 1e-9 && x <= 24 + 1e-9 && y >= 20 - 1e-9 && y <= 50 + 1e-9, `(${x},${y}) outside`);
    }
    assert.ok(Math.abs((x1 - x2) - (y2 - y1)) < 1e-9, 'segments are 45 degrees');
  }
  assert.deepEqual(plain(ex.hatchSegments(0, 0, 0, 10, 5)), []);
});

/* --------------------------------------------------------------- key window */

test('window shifting: octave steps, clamp 0..80, last window ends on key 127', () => {
  const { ex } = load();
  assert.equal(ex.clampWinStart(-5), 0);
  assert.equal(ex.clampWinStart(100), 80);
  const up = [];
  for (let ws = 0; ; ) {
    up.push(ws);
    const n = ex.shiftedWinStart(ws, 1);
    if (n === ws) { break; }
    ws = n;
  }
  assert.deepEqual(up, [0, 12, 24, 36, 48, 60, 72, 80]);
  assert.equal(ex.shiftedWinStart(80, 1), 80);
  assert.equal(ex.shiftedWinStart(80, -1), 72, 'back from the non-C-aligned end lands on a C');
  assert.equal(ex.shiftedWinStart(72, -1), 60);
  assert.equal(ex.shiftedWinStart(12, -1), 0);
  assert.equal(ex.shiftedWinStart(0, -1), 0);
  /* every key 0..127 is reachable in some window of that walk */
  for (let k = 0; k < 128; k++) {
    assert.ok(up.some((ws) => k >= ws && k < ws + 48), `key ${k} reachable`);
  }
});

test('window follows the selection only when it leaves the window', () => {
  const { ex } = load();
  assert.equal(ex.followWinStart(36, 40), 36);
  assert.equal(ex.followWinStart(36, 83), 36);
  assert.equal(ex.followWinStart(36, 84), 48);
  assert.equal(ex.followWinStart(36, 100), 60);
  assert.equal(ex.followWinStart(36, 127), 80);
  assert.equal(ex.followWinStart(36, 35), 24);
  assert.equal(ex.followWinStart(36, 0), 0);
  assert.equal(ex.followWinStart(36, -1), 36);
  for (let ws = 0; ws <= 80; ws += 4) {
    for (let k = 0; k < 128; k++) {
      const n = ex.followWinStart(ws, k);
      assert.ok(k >= n && k < n + 48, `ws ${ws} key ${k} -> ${n}`);
    }
  }
});

test('initial window starts at the rootKey octave; refreshes follow selection and root changes', () => {
  const cases = [[36, 36], [24, 24], [50, 48], [0, 0], [127, 80], [96, 80]];
  for (const [root, expected] of cases) {
    const env = load();
    env.show(makeView({ rootKey: root, selectedKey: -1 }));
    assert.equal(env.get('winStart'), expected, `root ${root}`);
  }

  const env = load();
  env.show(makeView({ rootKey: 36, selectedKey: 40 }));
  assert.equal(env.get('winStart'), 36);

  /* selection outside the window: follow */
  env.dicts.v = makeView({ rootKey: 36, selectedKey: 100 });
  env.sb.refresh();
  assert.equal(env.get('winStart'), 60);

  /* user scrolls away; a refresh with the same selection leaves the window alone */
  env.sb.bang();
  assert.equal(env.get('winStart'), 60);
  const L = env.ex.computeLayout(600, 160);
  env.click(L.prev.x + 5, L.prev.y + 10);
  assert.equal(env.get('winStart'), 48);
  env.sb.refresh();
  assert.equal(env.get('winStart'), 48);

  /* a new selection inside the window does not move it; outside it does */
  env.dicts.v = makeView({ rootKey: 36, selectedKey: 60 });
  env.sb.refresh();
  assert.equal(env.get('winStart'), 48);
  env.dicts.v = makeView({ rootKey: 36, selectedKey: 5 });
  env.sb.refresh();
  assert.equal(env.get('winStart'), 0);

});

test('root key change shows the new root octave', () => {
  const env = load();
  env.show(makeView({ rootKey: 36, selectedKey: -1 }));
  env.dicts.v = makeView({ rootKey: 60, selectedKey: -1 });
  env.sb.refresh();
  assert.equal(env.get('winStart'), 60);
});

test('arrow buttons shift the window by an octave and send no message', () => {
  const env = load();
  env.show(makeView({ selectedKey: -1 }));
  const L = env.ex.computeLayout(600, 160);
  env.clear();
  env.click(L.next.x + 7, L.next.y + 25);
  assert.equal(env.get('winStart'), 48);
  env.click(L.next.x + 7, L.next.y + 25);
  env.click(L.next.x + 7, L.next.y + 25);
  env.click(L.next.x + 7, L.next.y + 25);
  assert.equal(env.get('winStart'), 80);
  env.click(L.next.x + 7, L.next.y + 25);
  assert.equal(env.get('winStart'), 80);
  env.click(L.prev.x + 7, L.prev.y + 25);
  assert.equal(env.get('winStart'), 72);
  assert.deepEqual(env.msgs(), []);
  assert.ok(env.redraws() >= 5);
  assert.equal(env.ex.hitTest(L, env.ex.normalizeView(null), 36, L.prev.x + 1, L.prev.y + 1).zone, 'prev');
  assert.equal(env.ex.hitTest(L, env.ex.normalizeView(null), 36, L.next.x + 1, L.next.y + 1).zone, 'next');
});

/* --------------------------------------------------------------------- tabs */

test('tab rectangles and hit testing with 1, 3 and 16 sources', () => {
  const { ex } = load();
  const L = ex.computeLayout(600, 160);
  for (const n of [1, 3, 8, 16]) {
    const rects = plain(ex.tabRects(L, n));
    assert.equal(rects.length, n);
    for (let i = 0; i < n; i++) {
      assert.ok(rects[i].w >= 8 && rects[i].w <= 120);
      assert.ok(rects[i].x + rects[i].w <= L.tabs.x + L.tabs.w + 1e-9);
      if (i > 0) { assert.ok(rects[i].x >= rects[i - 1].x + rects[i - 1].w); }
      assert.equal(ex.tabAt(L, n, rects[i].x + rects[i].w / 2, rects[i].y + 9), i, `n=${n} chip ${i}`);
      assert.equal(ex.tabAt(L, n, rects[i].x + 1, rects[i].y + 1), i);
    }
  }
  assert.equal(ex.tabAt(L, 0, 10, 5), -1);
  assert.equal(ex.tabAt(L, 3, L.tabs.x + L.tabs.w - 1, 5), -1, 'empty space right of the chips');
  assert.equal(ex.tabAt(L, 3, 10, L.tabs.y + L.tabs.h + 1), -1, 'below the tabs');
  assert.equal(ex.tabAt(L, 3, 10, L.tabs.y - 1), -1, 'above the tabs');
});

test('clicking a tab sends selectsource with the source index', () => {
  const env = load();
  env.show(makeView());
  const L = env.ex.computeLayout(600, 160);
  const rects = plain(env.ex.tabRects(L, 3));
  env.clear();
  env.click(rects[0].x + 5, 10);
  env.click(rects[1].x + 5, 10);
  env.click(rects[2].x + 5, 10);
  assert.deepEqual(env.msgs(), ['selectsource 0', 'selectsource 3', 'selectsource 7']);
  env.clear();
  env.sb.ondblclick(rects[1].x + 5, 10, 1, 0, 0, 0, 0, 0);
  assert.deepEqual(env.msgs(), ['selectsource 3']);
  env.clear();
  env.click(L.tabs.x + L.tabs.w - 2, 10);
  assert.deepEqual(env.msgs(), []);
});

/* ----------------------------------------------------------------- waveform */

function waveGeometry(env) {
  const L = env.ex.computeLayout(600, 160);
  const inner = plain(env.ex.waveInner(L));
  return {
    L, inner,
    x: (norm) => inner.x + norm * inner.w,
    y: L.wave.y + L.wave.h / 2
  };
}

test('waveform coordinate mapping and slice / marker hit testing', () => {
  const env = load();
  env.show(makeView());
  const { ex } = env;
  const g = waveGeometry(env);
  const view = ex.normalizeView(makeView());

  assert.equal(ex.xToNorm(g.L, g.inner.x), 0);
  assert.equal(ex.xToNorm(g.L, g.inner.x + g.inner.w), 1);
  assert.equal(ex.xToNorm(g.L, -50), 0);
  assert.equal(ex.xToNorm(g.L, 5000), 1);
  assert.ok(Math.abs(ex.normToX(g.L, ex.xToNorm(g.L, 123.5)) - 123.5) < 1e-9);

  assert.equal(ex.sliceAt(view.slices, 0), 0);
  assert.equal(ex.sliceAt(view.slices, 0.3), 2);
  assert.equal(ex.sliceAt(view.slices, 0.125), 1, 'boundary belongs to the slice that starts there');
  assert.equal(ex.sliceAt(view.slices, 1), 7);
  assert.equal(ex.sliceAt([], 0.5), -1);

  const mx = g.x(3 / 8);
  assert.equal(ex.markerAt(g.L, view.slices, mx), 3);
  assert.equal(ex.markerAt(g.L, view.slices, mx + 4), 3, '4 px away still counts');
  assert.equal(ex.markerAt(g.L, view.slices, mx - 4), 3);
  assert.equal(ex.markerAt(g.L, view.slices, mx + 4.5), -1);
  assert.equal(ex.markerAt(g.L, view.slices, g.x(0)), -1, 'the first slice start is not a marker');
  assert.equal(ex.markerAt(g.L, view.slices, g.x(1)), -1, 'neither is the end');

  const h = plain(ex.hitTest(g.L, view, 36, mx + 10, g.y));
  assert.equal(h.zone, 'wave');
  assert.equal(h.marker, -1);
  assert.equal(h.slice, 3);
});

test('click selects the slice under the cursor', () => {
  const env = load();
  env.show(makeView());
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(0.01), g.y);
  env.release(g.x(0.01), g.y);
  env.click(g.x(0.5 + 0.03), g.y);
  env.click(g.x(0.99), g.y);
  assert.deepEqual(env.msgs(), ['selectslice 0', 'selectslice 4', 'selectslice 7']);
});

test('shift-click adds a slice at the clicked frame', () => {
  const env = load();
  env.show(makeView({ selectedFrames: 480000 }));
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(0.5), g.y, { shift: true });
  assert.deepEqual(env.msgs(), ['addslice 240000']);
  env.clear();
  env.click(g.x(0.1234), g.y, { shift: true });
  assert.deepEqual(env.msgs(), ['addslice ' + Math.round(0.1234 * 480000)]);
  env.clear();
  env.click(g.x(0), g.y, { shift: true });
  assert.deepEqual(env.msgs(), ['addslice 1'], 'never frame 0');
  env.click(g.x(1), g.y, { shift: true });
  assert.deepEqual(env.msgs(), ['addslice 1', 'addslice 479999'], 'never the last frame');
  env.release(g.x(1), g.y);
  assert.equal(env.out.length, 2, 'no message on release');
});

test('view.frames is accepted when selectedFrames is missing', () => {
  const env = load();
  const v = makeView({ frames: 1000 });
  delete v.selectedFrames;
  env.show(v);
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(0.5), g.y, { shift: true });
  assert.deepEqual(env.msgs(), ['addslice 500']);
});

test('without selectedFrames adding / moving slices is disabled and the status explains why', () => {
  const env = load();
  const v = makeView();
  delete v.selectedFrames;
  env.show(v);
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(0.5), g.y, { shift: true });
  assert.deepEqual(env.msgs(), []);
  env.paint();
  assert.ok(env.texts().some((t) => /selectedFrames/.test(t)), 'hint shown');
  assertSanePaint(env, 'hint');

  /* marker drag: preview works, but no moveslice is sent */
  env.clear();
  env.click(g.x(3 / 8), g.y);
  env.drag(g.x(3 / 8) + 30, g.y);
  env.release(g.x(3 / 8) + 30, g.y);
  assert.deepEqual(env.msgs(), []);

  /* selection and removal still work */
  env.click(g.x(0.6), g.y);
  env.click(g.x(2 / 8) + 1, g.y, { option: true });
  assert.deepEqual(env.msgs(), ['selectslice 4', 'removeslice 2']);

  /* a refresh clears the hint */
  env.sb.refresh();
  env.paint();
  assert.ok(!env.texts().some((t) => /selectedFrames/.test(t)));
});

test('option-click on or near a marker removes the slice', () => {
  const env = load();
  env.show(makeView());
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(5 / 8), g.y, { option: true });
  env.click(g.x(2 / 8) + 3.5, g.y, { option: true });
  env.click(g.x(6 / 8) - 4, g.y, { option: true });
  assert.deepEqual(env.msgs(), ['removeslice 5', 'removeslice 2', 'removeslice 6']);
  env.clear();
  env.click(g.x(5 / 8) + 20, g.y, { option: true });
  env.click(g.x(0), g.y, { option: true });
  env.click(g.x(0) + 2, g.y, { option: true });
  assert.deepEqual(env.msgs(), [], 'not near a marker, and marker 0 does not exist');
  /* alt-click never starts a drag */
  env.click(g.x(5 / 8), g.y, { option: true });
  env.drag(g.x(5 / 8) + 20, g.y);
  env.release(g.x(5 / 8) + 20, g.y);
  assert.deepEqual(env.msgs(), ['removeslice 5']);
});

test('dragging a marker previews live and sends moveslice on release', () => {
  const env = load();
  env.show(makeView());
  const g = waveGeometry(env);
  const frames = 480000;
  env.clear();

  env.click(g.x(3 / 8) + 2, g.y);
  assert.deepEqual(env.msgs(), [], 'nothing on press');

  const target = g.x(0.40);
  env.drag(g.x(3 / 8) + 10, g.y);
  env.drag(target, g.y);
  assert.deepEqual(env.msgs(), [], 'nothing while dragging');
  assert.equal(env.get('ghost.index'), 3);
  assert.ok(Math.abs(env.get('ghost.norm') - 0.40) < 1e-9);

  /* the preview marker is painted at the dragged position */
  env.paint();
  const ghostX = Math.round(g.x(0.40)) + 0.5;
  const strokes = env.log.filter((c) => c[0] === 'line_to' && c[1] === ghostX);
  assert.ok(strokes.length >= 1, 'marker line painted at the preview x');
  assertSanePaint(env, 'drag preview');

  env.release(target, g.y);
  assert.deepEqual(env.msgs(), ['moveslice 3 ' + Math.round(0.40 * frames)]);
  assert.equal(env.get('drag'), null);

  /* the preview stays until the glue refreshes */
  assert.equal(env.get('ghost.index'), 3);
  env.sb.refresh();
  assert.equal(env.get('ghost'), null);
});

test('marker drag is clamped between the neighbouring markers', () => {
  const env = load();
  env.show(makeView());
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(3 / 8), g.y);
  env.drag(g.x(0.95), g.y);
  env.release(g.x(0.95), g.y);
  let m = env.msgs();
  assert.equal(m.length, 1);
  let f = Number(m[0].split(' ')[2]);
  assert.ok(f < 0.5 * 480000 && f > 0.49 * 480000, `right clamp: ${f}`);

  env.clear();
  env.click(g.x(3 / 8), g.y);
  env.drag(g.x(0.02), g.y);
  env.release(g.x(0.02), g.y);
  m = env.msgs();
  f = Number(m[0].split(' ')[2]);
  assert.ok(f > 0.25 * 480000 && f < 0.26 * 480000, `left clamp: ${f}`);
});

test('a marker press without real movement is just a slice selection', () => {
  const env = load();
  env.show(makeView());
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(3 / 8) + 1, g.y);
  env.drag(g.x(3 / 8) + 2, g.y);
  env.release(g.x(3 / 8) + 2, g.y);
  assert.deepEqual(env.msgs(), ['selectslice 3']);
  assert.equal(env.get('ghost'), null);
  env.clear();
  env.click(g.x(3 / 8) - 2, g.y);
  env.release(g.x(3 / 8) - 2, g.y);
  assert.deepEqual(env.msgs(), ['selectslice 2'], 'left of the marker is the previous slice');
});

test('the waveform is inert without a selected source', () => {
  const env = load();
  env.show(makeView({ selectedSource: -1, slices: [], wave: [], selectedSlice: -1 }));
  const g = waveGeometry(env);
  env.clear();
  env.click(g.x(0.5), g.y);
  env.click(g.x(0.5), g.y, { shift: true });
  env.click(g.x(0.5), g.y, { option: true });
  env.release(g.x(0.5), g.y);
  assert.deepEqual(env.msgs(), []);
  env.paint();
  assert.ok(env.texts().some((t) => /select a sample/.test(t)));
});

test('peaksForWidth resamples the overview to pixel columns', () => {
  const { ex } = load();
  const wave = [-0.5, 0.5, -1, 0.25, -0.1, 0.9, -0.2, 0.2];
  assert.deepEqual(plain(ex.peaksForWidth(wave, 4)), wave);
  assert.deepEqual(plain(ex.peaksForWidth(wave, 2)), [-1, 0.5, -0.2, 0.9]);
  assert.deepEqual(plain(ex.peaksForWidth(wave, 1)), [-1, 0.9]);
  assert.equal(ex.peaksForWidth(wave, 10).length, 20);
  assert.deepEqual(plain(ex.peaksForWidth([], 10)), []);
  assert.deepEqual(plain(ex.peaksForWidth([5, -5], 1)), [-1, 1], 'values are clamped to -1..1');
});

/* --------------------------------------------------------------------- keys */

function keyPoint(env, k) {
  const L = env.ex.computeLayout(600, 160);
  return env.ex.keyCenter(L, env.get('winStart'), k);
}

test('click on a key sends selectkey for every key of the window', () => {
  const env = load();
  env.show(makeView({ rootKey: 36, selectedKey: -1 }));
  env.clear();
  const expected = [];
  for (let k = 36; k < 84; k++) {
    const p = keyPoint(env, k);
    env.click(p.x, p.y);
    env.release(p.x, p.y);
    expected.push('selectkey ' + k);
  }
  assert.deepEqual(env.msgs(), expected);
});

test('shift-click auditions on press and releases on mouse up', () => {
  const env = load();
  env.show(makeView({ selectedKey: -1 }));
  const p = keyPoint(env, 60);
  env.clear();
  env.click(p.x, p.y, { shift: true });
  assert.deepEqual(env.msgs(), ['audition 60 100']);
  env.drag(p.x + 3, p.y, { shift: true });
  assert.deepEqual(env.msgs(), ['audition 60 100'], 'still held while dragging');
  env.release(p.x + 3, p.y);
  assert.deepEqual(env.msgs(), ['audition 60 100', 'auditionoff 60']);
  env.release(p.x, p.y);
  assert.equal(env.out.length, 2, 'a second release does nothing');

  /* black key */
  env.clear();
  const b = keyPoint(env, 61);
  env.click(b.x, b.y, { shift: true });
  env.release(b.x, b.y);
  assert.deepEqual(env.msgs(), ['audition 61 100', 'auditionoff 61']);
});

test('a lost release does not leave an audition hanging', () => {
  const env = load();
  env.show(makeView({ selectedKey: -1 }));
  const p = keyPoint(env, 60);
  const q = keyPoint(env, 62);
  env.clear();
  env.click(p.x, p.y, { shift: true });
  env.click(q.x, q.y, { shift: true });
  assert.deepEqual(env.msgs(), ['audition 60 100', 'auditionoff 60', 'audition 62 100']);
  env.clear();
  env.sb.onidle(5, 5);
  assert.deepEqual(env.msgs(), ['auditionoff 62']);
  env.sb.onidleout(5, 5);
  assert.deepEqual(env.msgs(), ['auditionoff 62']);
});

test('cmd-click (or ctrl-click) toggles the lock without selecting', () => {
  const env = load();
  env.show(makeView({ selectedKey: -1 }));
  const p = keyPoint(env, 50);
  env.clear();
  env.click(p.x, p.y, { cmd: true });
  env.release(p.x, p.y);
  env.click(p.x, p.y, { ctrl: true });
  env.release(p.x, p.y);
  assert.deepEqual(env.msgs(), ['lock 50', 'lock 50']);
});

test('double click: plain clicks repeat the selection, modified ones are ignored', () => {
  const env = load();
  env.show(makeView({ selectedKey: -1 }));
  const p = keyPoint(env, 55);
  env.clear();
  env.sb.ondblclick(p.x, p.y, 1, 0, 0, 0, 0, 0);
  env.sb.ondblclick(p.x, p.y, 1, 1, 0, 0, 0, 0);
  env.sb.ondblclick(p.x, p.y, 1, 0, 1, 0, 0, 0);
  env.sb.ondblclick(p.x, p.y, 1, 0, 0, 0, 1, 0);
  assert.deepEqual(env.msgs(), ['selectkey 55']);
});

test('clicks outside every control do nothing', () => {
  const env = load();
  env.show(makeView());
  const L = env.ex.computeLayout(600, 160);
  env.clear();
  env.click(L.status.x + 20, L.status.y + 5);
  env.click(0, 0);
  env.click(599, 159);
  env.click(L.board.x, L.keys.y - 1);
  env.release(0, 0);
  assert.deepEqual(env.msgs(), []);
});

/* ------------------------------------------------------------ refresh / dict */

test('viewdict stores the name, reads the dict and redraws; refresh and bang re-read it', () => {
  const env = load();
  env.sb.refresh();
  assert.equal(env.get('view.sources.length'), 0, 'no dict name yet: nothing is read');
  assert.ok(env.redraws() >= 1);

  env.set('myview', makeView({ status: 'first' }));
  env.clear();
  env.sb.viewdict('myview');
  assert.equal(env.get('dictName'), 'myview');
  assert.equal(env.get('view.status'), 'first');
  assert.equal(env.get('view.sources.length'), 3);
  assert.equal(env.redraws(), 1);

  env.dicts.myview = makeView({ status: 'second' });
  env.sb.refresh();
  assert.equal(env.get('view.status'), 'second');
  env.dicts.myview = makeView({ status: 'third' });
  env.sb.bang();
  assert.equal(env.get('view.status'), 'third');

  env.sb.viewdict();
  assert.equal(env.get('dictName'), 'myview', 'viewdict without a name is ignored');
});

test('a dict name passed as jsarguments[1] is used until viewdict arrives', () => {
  const env = load({ jsarguments: ['slicekit-ui.js', 'preset'] });
  assert.equal(env.get('dictName'), 'preset');
});

test('bad dict content does not throw and keeps the previous view', () => {
  const env = load();
  env.show(makeView({ status: 'ok' }));
  env.dicts.v = '{not json';
  assert.doesNotThrow(() => env.sb.refresh());
  assert.equal(env.get('view.status'), 'ok');
  assert.ok(env.posts.some((p) => /not valid JSON/.test(p)));

  const env2 = load({ dictThrows: true });
  assert.doesNotThrow(() => env2.sb.viewdict('x'));
  assert.ok(env2.posts.some((p) => /cannot read dict/.test(p)));
});

test('normalizeView fills defaults and sanitises garbage', () => {
  const { ex } = load();
  const v = plain(ex.normalizeView(null));
  assert.equal(v.status, '');
  assert.equal(v.palette.length, 16);
  assert.equal(v.sources.length, 0);
  assert.equal(v.selectedSource, -1);
  assert.equal(v.selectedSlice, -1);
  assert.equal(v.selectedKey, -1);
  assert.equal(v.rootKey, 36);
  assert.equal(v.slot, 0);
  assert.equal(v.armed, '');
  assert.equal(v.keys.length, 128);
  assert.equal(v.keyFlags.length, 128);
  assert.ok(v.keys.every((x) => x === -1));
  assert.ok(v.keyFlags.every((x) => x === 0));
  assert.equal(v.selectedFrames, 0);
  assert.equal(v.modStart, -1);

  const g = plain(ex.normalizeView({
    status: 12, palette: ['#fff', 'red', null], sources: [null, 'x', { name: 5, slices: -3 }],
    selectedSource: '2', wave: [1, 'a', 3], slices: [[0.2, 0.1], [2, 3], 'x', [0, 1, 2], [null, 1]],
    keys: [1.7, 'x', 300], keyFlags: [-4, 9], selectedKey: 1e9, rootKey: 999, slot: 99, armed: 'bogus',
    selectedFrames: -5
  }));
  assert.equal(g.status, '12');
  assert.equal(g.palette[0], PALETTE[0], 'invalid palette entries fall back to the default');
  assert.equal(g.sources.length, 1);
  assert.equal(g.sources[0].name, '5');
  assert.equal(g.sources[0].slices, 0);
  assert.equal(g.sources[0].loaded, 1, 'loaded defaults to 1');
  assert.equal(g.selectedSource, -1);
  assert.deepEqual(g.wave, [1, 0]);
  assert.deepEqual(g.slices, [[0.2, 0.2], [1, 1], [0, 1]]);
  assert.equal(g.keys[0], 1);
  assert.equal(g.keys[1], -1);
  assert.equal(g.keys[2], 300);
  assert.equal(g.keyFlags[0], 0);
  assert.equal(g.rootKey, 127);
  assert.equal(g.slot, 7);
  assert.equal(g.armed, '');
  assert.equal(g.selectedFrames, 0);

  const m = plain(ex.normalizeView({ keyFlags: [].concat(new Array(96).fill(0), new Array(12).fill(8)) }));
  assert.equal(m.modStart, 96, 'derived from the lowest mod-zone key');
  assert.equal(plain(ex.normalizeView({ modStart: 100 })).modStart, 100);
});

/* ------------------------------------------------------------------ helpers */

test('note names follow Live (middle C = C3 = key 60)', () => {
  const { ex } = load();
  assert.equal(ex.noteName(60), 'C3');
  assert.equal(ex.noteName(61), 'C#3');
  assert.equal(ex.noteName(36), 'C1');
  assert.equal(ex.noteName(0), 'C-2');
  assert.equal(ex.noteName(127), 'G8');
  assert.equal(ex.noteName(71), 'B3');
});

test('slot letters, armed text, mod labels', () => {
  const { ex } = load();
  assert.equal(ex.slotLetter(0), 'A');
  assert.equal(ex.slotLetter(7), 'H');
  assert.equal(ex.slotLetter(8), '-');
  assert.equal(ex.slotLetter('x'), '-');
  assert.equal(ex.armedText('layer'), 'LAYER: click a key');
  assert.equal(ex.armedText('dup'), 'DUP: click a key');
  assert.equal(ex.armedText(''), '');
  assert.equal(ex.modLabel(0), '4');
  assert.equal(ex.modLabel(7), 'Rv');
  assert.equal(ex.modLabel(11), 'Ch');
  assert.equal(ex.modLabel(12), 'G1');
  assert.equal(ex.modLabel(15), 'G4');
  assert.equal(ex.modLabel(16), '');
  assert.equal(ex.modLabel(-1), '');
});

test('hexToRgb and fitText', () => {
  const { ex } = load();
  assert.deepEqual(plain(ex.hexToRgb('#FF0000')), [1, 0, 0]);
  assert.deepEqual(plain(ex.hexToRgb('#000000')), [0, 0, 0]);
  assert.deepEqual(plain(ex.hexToRgb('nonsense')), [0.5, 0.5, 0.5]);
  /* the mock measures 5 px per character */
  assert.equal(ex.fitText('abcdefghij', 100), 'abcdefghij');
  assert.equal(ex.fitText('abcdefghij', 30), 'abc...');
  assert.equal(ex.fitText('abcdefghij', 20), 'abcd', 'no room for three characters plus dots: bare prefix');
  assert.equal(ex.fitText('abcdefghij', 15), 'abc');
  assert.equal(ex.fitText('abcdefghij', 10), 'ab');
  assert.equal(ex.fitText('abcdefghij', 4), '');
  assert.equal(ex.fitText('abcdefghij', 0), '');
  assert.equal(ex.fitText('', 10), '');
});

/* ----------------------------------------------------------------- painting */

test('paint on an empty view (no dict, empty dict)', () => {
  const env = load();
  assert.doesNotThrow(() => env.paint());
  assertSanePaint(env, 'no dict');
  assert.ok(env.texts().some((t) => /drop samples/.test(t)));
  assert.ok(env.texts().includes('no samples'));
  assert.ok(env.texts().includes('A'), 'slot letter');

  env.show({});
  assert.doesNotThrow(() => env.paint());
  assertSanePaint(env, 'empty dict');
});

test('paint a normal view: status, slot, tabs, C labels, flags', () => {
  const env = load();
  env.show(makeView({ armed: 'dup' }));
  env.paint();
  assertSanePaint(env, 'normal');
  const t = env.texts();
  assert.ok(t.includes('Ready - 8 slices'));
  assert.ok(t.includes('C'), 'slot C');
  assert.ok(t.includes('DUP: click a key'));
  assert.ok(t.includes('C1') && t.includes('C2') && t.includes('C3'), 'C labels of window 36..83');
  assert.ok(!t.includes('C0'));
  assert.ok(t.includes('amen_break'));
  assert.ok(t.some((s) => /\.\.\.$/.test(s)), 'long source name truncated');
  assert.ok(t.includes('E1 (40)'), 'selected key name in the status line');
  assert.ok(env.log.some((c) => c[0] === 'arc'), 'layer dot drawn');
  assert.ok(env.log.some((c) => c[0] === 'stroke'));
  assert.equal(env.log.filter((c) => c[0] === 'select_font_face').length, 1);
});

test('paint the full view: 16 sources, 128 keys, all flags, mod zone', () => {
  const env = load();
  env.show(fullView());
  assert.equal(env.get('winStart'), 80, 'root 96 clamps to the last window');
  env.paint();
  assertSanePaint(env, 'full');
  const t = env.texts();
  assert.equal(env.log.filter((c) => c[0] === 'rectangle' && c[2] === 1 && c[4] === 18).length, 16, '16 tab chips');
  assert.ok(t.filter((s) => s === 'sam').length >= 15, 'narrow chips show a bare prefix of the name');
  for (const lab of ['4', '8', '8T', '16', '16T', '32', '64', 'Rv', 'O-', 'O+', 'Tp', 'Ch']) {
    assert.ok(t.includes(lab), `mod label ${lab}`);
  }
  assert.ok(t.includes('LAYER: click a key'));
  assert.ok(t.includes('H'), 'slot H');
  assert.ok(t.includes('E6 (100)'));

  /* every size keeps the full view sane */
  for (const [w, h] of [[300, 120], [600, 160], [900, 300], [1400, 200], [90, 80]]) {
    env.sb.onresize(w, h);
    for (const ws of [0, 36, 80]) {
      env.get('winStart = ' + ws);
      assert.doesNotThrow(() => env.paint());
      assertSanePaint(env, `full ${w}x${h} ws ${ws}`);
    }
  }
});

test('paint every window position of a view with sounding / selected keys', () => {
  const env = load();
  const v = fullView();
  v.keyFlags[100] = 16 | 1 | 2 | 4 | 32;
  v.selectedKey = 100;
  env.show(v);
  for (let ws = 0; ws <= 80; ws++) {
    env.get('winStart = ' + ws);
    assert.doesNotThrow(() => env.paint(), `ws ${ws}`);
    assertSanePaint(env, `ws ${ws}`);
  }
});

test('paint a view with missing and odd optional fields', () => {
  const variants = [
    { status: 'only status' },
    { sources: [{ name: 'x' }] },
    { sources: [{ index: 2, name: 'x', slices: 3 }], selectedSource: 2 },
    { sources: [{ index: 2, name: 'x' }], selectedSource: 2, wave: [0, 0, 0, 0], slices: [] },
    { selectedSource: 4, wave: [0.1, 0.2], slices: [[0, 1]], selectedSlice: 0 },
    { selectedSource: 0, sources: [{ index: 0, name: '' }], slices: [[0, 0.5], [0.5, 1]], selectedSlice: 9 },
    { keys: [0, 1, 2], keyFlags: [63, 63] },
    { palette: ['bad'], keys: new Array(128).fill(99), keyFlags: new Array(128).fill(255) },
    { rootKey: -3, slot: -1, selectedKey: 500 },
    { armed: 'layer', status: null },
    { wave: [NaN, Infinity, -Infinity, null], slices: [[NaN, 2]], selectedSource: 0 },
    { selectedFrames: 'lots', frames: {} }
  ];
  variants.forEach((raw, i) => {
    const env = load();
    env.show(raw);
    assert.doesNotThrow(() => env.paint(), `variant ${i}`);
    assertSanePaint(env, `variant ${i}`);
  });
});

test('selected source tab is outlined and unloaded sources are dimmed', () => {
  const env = load();
  env.show(makeView());
  env.paint();
  const L = env.ex.computeLayout(600, 160);
  const rects = plain(env.ex.tabRects(L, 3));
  /* outline = a 1.5 px stroked rectangle inset by half a pixel */
  const outlines = env.log.filter((c) => c[0] === 'rectangle' && c[1] === rects[0].x + 0.5 && c[2] === rects[0].y + 0.5);
  assert.equal(outlines.length, 1);
  assert.equal(env.log.filter((c) => c[0] === 'rectangle' && c[1] === rects[1].x + 0.5 && c[2] === rects[1].y + 0.5).length, 0);
  /* swatch alpha of the unloaded source (idx 2) is 0.4 */
  const swatchIdx = env.log.findIndex((c) => c[0] === 'rectangle' && c[1] === rects[2].x + 3 && c[2] === rects[2].y + 4);
  assert.ok(swatchIdx > 0);
  const colorCall = env.log[swatchIdx - 1];
  assert.equal(colorCall[0], 'set_source_rgba');
  assert.equal(colorCall[4], 0.4);
});

/* ============================================================== v2 additions */

const MOD_LABELS_16 = ['4', '8', '8T', '16', '16T', '32', '64', 'Rv', 'O-', 'O+', 'Tp', 'Ch', 'G1', 'G2', 'G3', 'G4'];
const GEST_NAMES = ['kick roll', 'swoop', 'wobble', 'rise'];

/* a view whose 16-key mod zone starts at `start` (flag 8 on every zone key) */
function modZoneView(start, over) {
  const keys = new Array(128).fill(-1);
  const flags = new Array(128).fill(0);
  for (let k = 36; k < 36 + 40; k++) { keys[k] = (k >> 2) % 3; }
  for (let i = 0; i < 16; i++) { flags[start + i] = 8; }
  return makeView(Object.assign({
    keys, keyFlags: flags, modStart: start, rootKey: Math.min(start, 96), selectedKey: -1
  }, over || {}));
}

/* every v2 field on, B marks on a few pads */
function v2View(over) {
  const v = modZoneView(96, {
    morph: 63, morphEdit: 1, scan: 40, gesture: 1, gestureNames: GEST_NAMES, status: 'Ready - 8 slices'
  });
  for (const k of [80, 81, 82, 84, 85]) { v.keys[k] = k % 16; }
  v.keyFlags[80] = 64;
  v.keyFlags[81] = 64 | 1 | 2 | 4;
  v.keyFlags[82] = 64 | 16 | 32;
  v.keyFlags[84] = 64 | 4;
  v.keyFlags[85] = 64;
  return Object.assign(v, over || {});
}

/* [{text, x, y}] for every show_text of the last paint (the position is the preceding move_to) */
function textDraws(env) {
  const res = [];
  for (let i = 1; i < env.log.length; i++) {
    if (env.log[i][0] === 'show_text' && env.log[i - 1][0] === 'move_to') {
      res.push({ text: env.log[i][1], x: env.log[i - 1][1], y: env.log[i - 1][2] });
    }
  }
  return res;
}

/* rgb the rectangle (x, y, w, h) was filled with, or null */
function rectFill(env, r) {
  for (let i = 1; i < env.log.length; i++) {
    const c = env.log[i];
    if (c[0] === 'rectangle' && Math.abs(c[1] - r.x) < 1e-9 && Math.abs(c[2] - r.y) < 1e-9 &&
        Math.abs(c[3] - r.w) < 1e-9 && Math.abs(c[4] - r.h) < 1e-9 && env.log[i - 1][0] === 'set_source_rgba') {
      return env.log[i - 1].slice(1, 4);
    }
  }
  return null;
}

/* number of strokePoly(pts, color) calls: rgba, line width, move_to(pts[0..1]) ... */
function polyStrokes(env, pts, rgb) {
  let n = 0;
  for (let i = 2; i < env.log.length; i++) {
    const c = env.log[i];
    const col = env.log[i - 2];
    if (c[0] === 'move_to' && Math.abs(c[1] - pts[0]) < 1e-9 && Math.abs(c[2] - pts[1]) < 1e-9 &&
        col[0] === 'set_source_rgba' && env.log[i - 1][0] === 'set_line_width' &&
        rgb.every((v, j) => Math.abs(col[1 + j] - v) < 1e-9)) {
      n++;
    }
  }
  return n;
}

/* number of filled diamonds drawn with exactly these 4 points */
function diamonds(env, pts) {
  let n = 0;
  for (let i = 1; i + 5 < env.log.length; i++) {
    const m = env.log[i];
    if (m[0] !== 'move_to' || Math.abs(m[1] - pts[0]) > 1e-9 || Math.abs(m[2] - pts[1]) > 1e-9 ||
        env.log[i - 1][0] !== 'set_source_rgba') { continue; }
    let ok = true;
    for (let j = 1; j < 4; j++) {
      const c = env.log[i + j];
      ok = ok && c[0] === 'line_to' && Math.abs(c[1] - pts[2 * j]) < 1e-9 && Math.abs(c[2] - pts[2 * j + 1]) < 1e-9;
    }
    if (ok && env.log[i + 4][0] === 'close_path' && env.log[i + 5][0] === 'fill') { n++; }
  }
  return n;
}

/* ----------------------------------------------------------- normalizeView v2 */

test('v2 view fields: defaults for v1 views, sanitising for garbage', () => {
  const { ex } = load();
  const d = plain(ex.normalizeView(null));
  assert.equal(d.morph, 0);
  assert.equal(d.scan, 0);
  assert.equal(d.morphEdit, 0);
  assert.equal(d.gesture, -1);
  assert.deepEqual(d.gestureNames, ['', '', '', '']);
  const v1 = plain(ex.normalizeView(makeView()));
  assert.equal(v1.morph, 0);
  assert.equal(v1.gesture, -1);

  const g = plain(ex.normalizeView({ morph: 63, scan: 40.5, morphEdit: 1, gesture: 2, gestureNames: ['a', 'b', 'c', 'd'] }));
  assert.equal(g.morph, 63);
  assert.equal(g.scan, 40.5);
  assert.equal(g.morphEdit, 1);
  assert.equal(g.gesture, 2);
  assert.deepEqual(g.gestureNames, ['a', 'b', 'c', 'd']);

  assert.equal(plain(ex.normalizeView({ morph: 500, scan: -20 })).morph, 100);
  assert.equal(plain(ex.normalizeView({ morph: 500, scan: -20 })).scan, 0);
  assert.equal(plain(ex.normalizeView({ morph: 'x', scan: NaN })).morph, 0);
  assert.equal(plain(ex.normalizeView({ morphEdit: true })).morphEdit, 1);
  assert.equal(plain(ex.normalizeView({ morphEdit: '0' })).morphEdit, 0);
  assert.equal(plain(ex.normalizeView({ morphEdit: '1' })).morphEdit, 1);
  assert.equal(plain(ex.normalizeView({ morphEdit: null })).morphEdit, 0);
  for (const bad of [-1, 4, 99, 'x', null, NaN, {}]) {
    assert.equal(plain(ex.normalizeView({ gesture: bad })).gesture, -1, `gesture ${String(bad)}`);
  }
  assert.equal(plain(ex.normalizeView({ gesture: 3.9 })).gesture, 3);
  assert.deepEqual(plain(ex.normalizeView({ gestureNames: 'abc' })).gestureNames, ['', '', '', '']);
  assert.deepEqual(plain(ex.normalizeView({ gestureNames: ['a', null, 7, {}, 'extra'] })).gestureNames, ['a', '', '7', '']);
  assert.equal(plain(ex.normalizeView({ keyFlags: [64, 65] })).keyFlags[1], 65, 'bit 64 survives');
});

/* ---------------------------------------------------------- 16-key mod zone */

test('mod zone is 16 keys with the v2 labels', () => {
  const { ex } = load();
  assert.equal(ex.modLabel(11), 'Ch');
  for (let i = 0; i < 16; i++) { assert.equal(ex.modLabel(i), MOD_LABELS_16[i], `label ${i}`); }
  assert.equal(ex.modLabel(16), '');
  assert.equal(ex.constants.GESTURE_COUNT, 4);
  assert.equal(ex.constants.GESTURE_OFFSET, 12);

  /* the start is derived from the lowest flagged key or taken from modStart */
  const flags = new Array(128).fill(0);
  for (let i = 0; i < 16; i++) { flags[100 + i] = 8; }
  assert.equal(plain(ex.normalizeView({ keyFlags: flags })).modStart, 100);
  assert.equal(plain(ex.normalizeView({ keyFlags: flags, modStart: 112 })).modStart, 112);
  assert.equal(plain(ex.normalizeView({ keyFlags: flags, modStart: -1 })).modStart, -1, 'zone off');
});

test('all 16 zone keys are labelled, each on its own key', () => {
  for (const start of [96, 112, 64, 0]) {
    const env = load();
    env.show(modZoneView(start, { rootKey: start }));
    const ws = env.get('winStart');
    assert.ok(start >= ws && start + 16 <= ws + 48, `zone ${start} visible in window ${ws}`);
    env.paint();
    assertSanePaint(env, `zone ${start}`);
    const L = env.ex.computeLayout(600, 160);
    const draws = textDraws(env);
    for (let i = 0; i < 16; i++) {
      const r = env.ex.keyRect(L, ws, start + i);
      /* labels are centred: the mock measures 5 px per character */
      const lx = r.x + r.w / 2 - MOD_LABELS_16[i].length * 2.5;
      const hits = draws.filter((d) => d.text === MOD_LABELS_16[i] && Math.abs(d.x - lx) < 1e-9 &&
        d.y > r.y && d.y <= r.y + r.h + 1);
      assert.equal(hits.length, 1, `zone ${start} label ${MOD_LABELS_16[i]} on key ${start + i}`);
    }
    /* the gesture labels exist only on the zone keys (one draw each, no status text) */
    for (const g of ['G1', 'G2', 'G3', 'G4']) {
      assert.equal(draws.filter((d) => d.text === g).length, 1, `${g} once`);
    }
  }
});

test('zone keys without the mod flag are not labelled (12-key v1 zone still renders)', () => {
  const env = load();
  env.show(fullView());
  env.paint();
  const t = env.texts();
  for (const lab of ['G1', 'G2', 'G3', 'G4']) { assert.ok(!t.includes(lab), `no ${lab} in a 12-key zone`); }
  assert.ok(t.includes('Ch'));
});

test('hit testing in the 16-key zone: every zone key is selected by its own centre', () => {
  for (const start of [96, 112]) {
    const env = load();
    env.show(modZoneView(start, { rootKey: start }));
    const ws = env.get('winStart');
    const L = env.ex.computeLayout(600, 160);
    const view = env.ex.normalizeView(modZoneView(start));
    env.clear();
    const expected = [];
    for (let i = 0; i < 16; i++) {
      const p = env.ex.keyCenter(L, ws, start + i);
      assert.equal(env.ex.keyAt(L, ws, p.x, p.y), start + i);
      assert.equal(env.ex.hitTest(L, view, ws, p.x, p.y).key, start + i);
      env.click(p.x, p.y);
      env.release(p.x, p.y);
      expected.push('selectkey ' + (start + i));
    }
    assert.deepEqual(env.msgs(), expected);
    /* modifiers behave as on any other key */
    env.clear();
    const p = env.ex.keyCenter(L, ws, start + 14);
    env.click(p.x, p.y, { cmd: true });
    env.click(p.x, p.y, { shift: true });
    env.release(p.x, p.y);
    assert.deepEqual(env.msgs(), [`lock ${start + 14}`, `audition ${start + 14} 100`, `auditionoff ${start + 14}`]);
  }
});

/* ------------------------------------------------------------------ gestures */

test('active gesture key is highlighted (fill and outline) and the others are not', () => {
  const base = load();
  base.show(modZoneView(96, { rootKey: 96 }));
  base.paint();
  const L = base.ex.computeLayout(600, 160);
  const ws = base.get('winStart');
  const gcol = plain(base.get('COL.gesture'));
  const noGestureFill = [];
  for (let k = 96; k < 112; k++) { noGestureFill.push(rectFill(base, base.ex.keyRect(L, ws, k))); }
  for (let k = 96; k < 112; k++) {
    assert.equal(polyStrokes(base, base.ex.keyPolygon(L, ws, k), gcol), 0, `no outline on ${k} without a gesture`);
  }

  for (let g = 0; g < 4; g++) {
    const env = load();
    env.show(modZoneView(96, { rootKey: 96, gesture: g }));
    env.paint();
    assertSanePaint(env, `gesture ${g}`);
    assert.equal(env.ex.gestureKey(env.ex.normalizeView(modZoneView(96, { gesture: g }))), 96 + 12 + g);
    for (let k = 96; k < 112; k++) {
      const fill = rectFill(env, env.ex.keyRect(L, ws, k));
      const outlines = polyStrokes(env, env.ex.keyPolygon(L, ws, k), gcol);
      if (k === 108 + g) {
        assert.equal(outlines, 1, `gesture ${g}: key ${k} outlined`);
        assert.notDeepEqual(fill, noGestureFill[k - 96], `gesture ${g}: key ${k} fill changed`);
        /* the label of the highlighted key is white */
        const lab = textDraws(env).filter((d) => d.text === 'G' + (g + 1))[0];
        assert.ok(lab);
        const i = env.log.findIndex((c, j) => c[0] === 'show_text' && c[1] === 'G' + (g + 1) && env.log[j - 1][0] === 'move_to' && env.log[j - 1][1] === lab.x);
        assert.deepEqual(env.log[i - 2].slice(1, 4), [1, 1, 1]);
      } else {
        assert.equal(outlines, 0, `gesture ${g}: key ${k} not outlined`);
        assert.deepEqual(fill, noGestureFill[k - 96], `gesture ${g}: key ${k} fill unchanged`);
      }
    }
  }
});

test('gesture highlight: no gesture, invalid gesture, zone off, key out of the window', () => {
  const gcol = plain(load().get('COL.gesture'));
  const cases = [
    ['gesture -1', modZoneView(96, { rootKey: 96, gesture: -1 })],
    ['gesture 4', modZoneView(96, { rootKey: 96, gesture: 4 })],
    ['gesture missing', modZoneView(96, { rootKey: 96 })],
    ['zone off', modZoneView(96, { rootKey: 96, gesture: 1, modStart: -1, keyFlags: new Array(128).fill(0) })],
    ['key beyond 127', modZoneView(112, { rootKey: 112, gesture: 3, modStart: 127 })]
  ];
  for (const [label, raw] of cases) {
    const env = load();
    env.show(raw);
    env.paint();
    assertSanePaint(env, label);
    const L = env.ex.computeLayout(600, 160);
    const ws = env.get('winStart');
    for (let k = ws; k < ws + 48; k++) {
      assert.equal(polyStrokes(env, env.ex.keyPolygon(L, ws, k), gcol), 0, `${label}: key ${k}`);
    }
  }
  /* gesture key scrolled out of the window: nothing breaks, the status still names it */
  const env = load();
  env.show(modZoneView(96, { rootKey: 96, gesture: 2, gestureNames: GEST_NAMES }));
  env.get('winStart = 0');
  assert.doesNotThrow(() => env.paint());
  assertSanePaint(env, 'gesture key not visible');
  assert.ok(env.texts().includes('G3 wobble'));
});

test('status line names the active gesture; without names it shows just G<n>', () => {
  const env = load();
  env.show(modZoneView(96, { rootKey: 96, gesture: 1, gestureNames: GEST_NAMES }));
  env.paint();
  const t = env.texts();
  assert.ok(t.includes('G2 swoop'));
  for (const other of ['kick roll', 'wobble', 'rise']) { assert.ok(!t.some((s) => s.indexOf(other) >= 0), other); }
  assert.ok(t.includes('Ready - 8 slices'), 'status text kept');
  assert.ok(t.includes('C'), 'slot letter kept');

  const env2 = load();
  env2.show(modZoneView(96, { rootKey: 96, gesture: 2 }));
  env2.paint();
  /* key label + status */
  assert.equal(env2.texts().filter((s) => s === 'G3').length, 2);

  const env3 = load();
  env3.show(modZoneView(96, { rootKey: 96, gesture: 0, gestureNames: ['G1', '', '', ''] }));
  env3.paint();
  assert.equal(env3.texts().filter((s) => s === 'G1').length, 2, 'name equal to the label is not repeated');

  const env4 = load();
  env4.show(modZoneView(96, { rootKey: 96, gesture: -1, gestureNames: GEST_NAMES }));
  env4.paint();
  assert.ok(!env4.texts().some((s) => GEST_NAMES.indexOf(s) >= 0 || /^G\d /.test(s)), 'names alone show nothing');
});

/* ----------------------------------------------------------- morph B (bit 64) */

test('keyFlags bit 64 draws a diamond on the key, on white and black keys', () => {
  const v = makeView({ selectedKey: -1 });
  v.keyFlags[60] = 64;          /* C, white */
  v.keyFlags[61] = 64;          /* C#, black */
  v.keyFlags[62] = 64 | 1 | 2 | 4 | 16 | 32;  /* D with every other mark */
  const env = load();
  env.show(v);
  env.paint();
  assertSanePaint(env, 'bit 64');
  const L = env.ex.computeLayout(600, 160);
  const ws = env.get('winStart');
  for (const k of [60, 61, 62]) {
    const pts = plain(env.ex.morphMarkPoly(L, ws, k));
    assert.equal(pts.length, 8);
    assert.equal(diamonds(env, pts), 1, `diamond on key ${k}`);
  }
  /* no mark on a key without the bit, whatever else it carries */
  for (const k of [58, 59, 63, 64, 65]) {
    const pts = plain(env.ex.morphMarkPoly(L, ws, k));
    assert.equal(diamonds(env, pts), 0, `no diamond on key ${k}`);
  }
  assert.equal(env.ex.morphMarkPoly(L, ws, ws - 1), null);
  assert.equal(env.ex.morphMarkPoly(L, ws, ws + 48), null);

  /* clearing the bit removes exactly the diamond */
  const v2 = makeView({ selectedKey: -1 });
  v2.keyFlags[60] = 0;
  v2.keyFlags[61] = 0;
  v2.keyFlags[62] = 1 | 2 | 4 | 16 | 32;
  const env2 = load();
  env2.show(v2);
  env2.paint();
  const count = (e, name) => e.log.filter((c) => c[0] === name).length;
  assert.equal(count(env, 'close_path') - count(env2, 'close_path'), 3);
  assert.equal(count(env, 'fill') - count(env2, 'fill'), 3);
  assert.equal(count(env, 'arc'), count(env2, 'arc'), 'other marks unchanged');
  assert.equal(count(env, 'stroke'), count(env2, 'stroke'));
});

test('the B diamond stays clear of black keys, the glyphs and the key edges', () => {
  for (const [w, h] of [[300, 120], [400, 160], [600, 160], [900, 300], [1400, 200]]) {
    const { ex } = load();
    const L = ex.computeLayout(w, h);
    for (const ws of [0, 36, 37, 80]) {
      for (let k = ws; k < ws + 48; k++) {
        const pts = plain(ex.morphMarkPoly(L, ws, k));
        const xs = pts.filter((_, i) => i % 2 === 0);
        const ys = pts.filter((_, i) => i % 2 === 1);
        const x0 = Math.min(...xs); const x1 = Math.max(...xs);
        const y1 = Math.max(...ys);
        const r = ex.keyRect(L, ws, k);
        const tag = `${w}x${h} ws ${ws} key ${k}`;
        assert.ok(x0 >= r.x - 1e-9 && x1 <= r.x + r.w + 1e-9 && Math.min(...ys) >= r.y, `${tag}: inside the key`);
        if (r.black) {
          /* the lowered glyph column starts at +12, so its shackle top is at +9.5 */
          assert.ok(y1 <= r.y + 9.5, `${tag}: above the glyph column`);
        } else {
          assert.ok(y1 < r.y + L.blackH, `${tag}: in the exposed top part`);
          for (const nk of [k - 1, k + 1]) {
            if (nk >= ws && nk < ws + 48 && ex.isBlackKey(nk)) {
              const nr = ex.keyRect(L, ws, nk);
              assert.ok(x1 <= nr.x + 1e-9 || x0 >= nr.x + nr.w - 1e-9, `${tag}: clear of black key ${nk}`);
            }
          }
        }
      }
    }
  }
});

test('on a black key the glyph column starts below the B diamond', () => {
  const v = makeView({ selectedKey: -1 });
  v.keys[61] = 1;
  v.keyFlags[61] = 64 | 1;      /* lock glyph + B */
  const env = load();
  env.show(v);
  env.paint();
  const L = env.ex.computeLayout(600, 160);
  const ws = env.get('winStart');
  const r = env.ex.keyRect(L, ws, 61);
  const pts = plain(env.ex.morphMarkPoly(L, ws, 61));
  const lock = env.log.filter((c) => c[0] === 'rectangle' && Math.abs(c[1] - (r.x + r.w / 2 - 2.5)) < 1e-9 && c[3] === 5 && c[4] === 4);
  assert.equal(lock.length, 1);
  assert.ok(lock[0][2] - 2 >= Math.max(pts[1], pts[3], pts[5], pts[7]), 'shackle top is below the diamond');

  /* without B the lock sits where it always did */
  v.keyFlags[61] = 1;
  const env2 = load();
  env2.show(v);
  env2.paint();
  const lock2 = env2.log.filter((c) => c[0] === 'rectangle' && Math.abs(c[1] - (r.x + r.w / 2 - 2.5)) < 1e-9 && c[3] === 5 && c[4] === 4);
  assert.equal(lock2[0][2], r.y + 7 - 0.5);
});

/* ------------------------------------------------------------ status line v2 */

test('status indicators: absent on v1 views and for zero values', () => {
  const { ex } = load();
  assert.deepEqual(plain(ex.statusIndicators(ex.normalizeView(null))), []);
  assert.deepEqual(plain(ex.statusIndicators(ex.normalizeView(makeView()))), []);
  assert.deepEqual(plain(ex.statusIndicators(ex.normalizeView({ morph: 0, scan: 0, morphEdit: 0, gesture: -1 }))), []);

  const env = load();
  env.show(makeView({ armed: 'dup' }));
  env.paint();
  const t = env.texts();
  assert.ok(!t.some((s) => /EDIT B|MORPH|SCAN/.test(s)));
  assert.ok(t.includes('Ready - 8 slices') && t.includes('DUP: click a key') && t.includes('E1 (40)'));
  const L = env.ex.computeLayout(600, 160);
  assert.equal(env.log.filter((c) => c[0] === 'rectangle' && c[2] === L.status.y + 1).length, 0, 'no badge');

  const env2 = load();
  env2.show(makeView({ morph: 0, scan: 0, morphEdit: 0, gesture: -1 }));
  env2.paint();
  assert.ok(!env2.texts().some((s) => /EDIT B|MORPH|SCAN/.test(s)));
});

test('status indicators: EDIT B badge, MORPH nn%, SCAN nn%', () => {
  const L0 = load().ex.computeLayout(600, 160);
  const cases = [
    [{ morphEdit: 1 }, ['EDIT B'], ['MORPH', 'SCAN']],
    [{ morph: 40 }, ['MORPH 40%'], ['EDIT B', 'SCAN']],
    [{ scan: 25 }, ['SCAN 25%'], ['EDIT B', 'MORPH']],
    [{ morph: 100, scan: 1, morphEdit: 1 }, ['EDIT B', 'MORPH 100%', 'SCAN 1%'], []],
    [{ morph: 0.2 }, ['MORPH 1%'], ['EDIT B']],
    [{ morph: 63.6, scan: 99.5 }, ['MORPH 64%', 'SCAN 100%'], []]
  ];
  for (const [over, present, absent] of cases) {
    const env = load();
    env.show(makeView(Object.assign({ armed: 'layer' }, over)));
    env.paint();
    assertSanePaint(env, JSON.stringify(over));
    const t = env.texts();
    for (const p of present) { assert.ok(t.includes(p), `${JSON.stringify(over)}: ${p}`); }
    for (const a of absent) { assert.ok(!t.some((s) => s.indexOf(a) === 0), `${JSON.stringify(over)}: no ${a}`); }
    /* existing status content is all still there */
    assert.ok(t.includes('Ready - 8 slices'), 'status text');
    assert.ok(t.includes('LAYER: click a key'), 'armed');
    assert.ok(t.includes('E1 (40)'), 'selected key');
    assert.ok(t.includes('C') && t.includes('SLOT'), 'slot');
    /* the badge is a filled pill in the status row, only when morph edit is on */
    const pills = env.log.filter((c) => c[0] === 'rectangle' && c[2] === L0.status.y + 1 && c[4] === L0.status.h - 2);
    assert.equal(pills.length, over.morphEdit ? 1 : 0);
  }
});

test('the EDIT B badge is drawn in its own colour with the label centred inside', () => {
  const env = load();
  env.show(makeView({ morphEdit: 1 }));
  env.paint();
  const L = env.ex.computeLayout(600, 160);
  const pill = env.log.findIndex((c) => c[0] === 'rectangle' && c[2] === L.status.y + 1 && c[4] === L.status.h - 2);
  assert.ok(pill > 0);
  assert.deepEqual(env.log[pill - 1].slice(1, 4), plain(env.get('COL.editB')));
  assert.equal(env.log[pill - 1][4], 1, 'opaque');
  const r = env.log[pill];
  const lab = textDraws(env).filter((d) => d.text === 'EDIT B')[0];
  assert.ok(lab && lab.x >= r[1] && lab.x + 6 * 5 <= r[1] + r[3], 'label inside the badge');
  assert.ok(r[1] >= L.status.x && r[1] + r[3] <= L.status.x + L.status.w);
});

test('status indicators come before the status text and never overlap anything', () => {
  const views = {
    'badge + everything': v2View({ armed: 'layer', selectedKey: 100 }),
    'long status': v2View({ status: 'Loaded amen_break.wav - 8 slices, 4 bars at 172 bpm' }),
    'long gesture name': v2View({ gestureNames: ['an extremely long gesture name', 'x', 'y', 'z'], gesture: 0 }),
    'no status text': v2View({ status: '' }),
    'armed + key, no gesture': v2View({ armed: 'dup', selectedKey: 90, gesture: -1 })
  };
  for (const [label, raw] of Object.entries(views)) {
    for (const [w, h] of [[80, 80], [120, 90], [200, 100], [300, 120], [400, 160], [600, 160], [900, 300]]) {
      const env = load({ w, h });
      env.show(raw);
      env.sb.onresize(w, h);
      env.paint();
      assertSanePaint(env, `${label} ${w}x${h}`);
      const L = env.ex.computeLayout(w, h);
      const base = L.status.y + L.status.h / 2 + 3.2;
      const boxes = [];
      for (const d of textDraws(env)) {
        if (Math.abs(d.y - base) > 1e-9 || d.text === 'EDIT B' || d.text === 'B') { continue; }
        boxes.push({ name: d.text, x0: d.x, x1: d.x + 5 * d.text.length });
      }
      for (const c of env.log) {
        if (c[0] === 'rectangle' && c[2] === L.status.y + 1 && c[4] === L.status.h - 2) {
          boxes.push({ name: 'badge', x0: c[1], x1: c[1] + c[3] });
        }
      }
      const tag = `${label} ${w}x${h}`;
      for (const b of boxes) {
        assert.ok(b.x1 <= L.status.x + L.status.w + 1e-9, `${tag}: ${b.name} inside the right edge`);
      }
      const inside = boxes.filter((b) => b.x0 >= L.status.x - 1e-9);
      for (let i = 0; i < inside.length; i++) {
        for (let j = i + 1; j < inside.length; j++) {
          assert.ok(inside[i].x1 <= inside[j].x0 + 1e-9 || inside[j].x1 <= inside[i].x0 + 1e-9,
            `${tag}: ${inside[i].name} overlaps ${inside[j].name}`);
        }
      }
      /* an indicator other than the badge is only drawn together with the badge */
      const names = boxes.map((b) => b.name);
      if (names.some((n) => /^(MORPH|SCAN|G\d)/.test(n))) {
        assert.ok(names.indexOf('badge') >= 0, `${tag}: badge has priority`);
      }
    }
  }
});

test('wide status line fits everything; narrow ones drop MORPH / SCAN / gesture before the status text', () => {
  const raw = v2View({ status: 'Ready - 8 slices' });
  const env = load();
  env.show(raw);
  env.paint();
  const all = ['EDIT B', 'MORPH 63%', 'SCAN 40%', 'G2 swoop', 'Ready - 8 slices'];
  for (const a of all) { assert.ok(env.texts().includes(a), `600 wide: ${a}`); }

  /* order on the line: badge, MORPH, SCAN, gesture, status */
  const xs = all.map((a) => textDraws(env).filter((d) => d.text === a)[0].x);
  for (let i = 1; i < xs.length; i++) { assert.ok(xs[i] > xs[i - 1], `${all[i]} right of ${all[i - 1]}`); }

  /* narrow with a crowded right side: only the badge and (a prefix of) the status text remain */
  const narrow = load({ w: 300, h: 120 });
  narrow.show(Object.assign({}, raw, { armed: 'layer', selectedKey: 100 }));
  narrow.sb.onresize(300, 120);
  narrow.paint();
  const t = narrow.texts();
  assert.ok(!t.some((s) => /^(MORPH|SCAN)/.test(s)) && !t.includes('G2 swoop'), 'MORPH / SCAN / gesture dropped');
  const L = narrow.ex.computeLayout(300, 120);
  assert.equal(narrow.log.filter((c) => c[0] === 'rectangle' && c[2] === L.status.y + 1 && c[4] === L.status.h - 2).length, 1, 'badge kept');
  assert.ok(t.some((s) => s.indexOf('Rea') === 0), 'status text still readable: ' + JSON.stringify(t));

  /* tiny: the badge shrinks to "B" or disappears, nothing throws */
  for (const w of [80, 100, 140]) {
    const e = load({ w, h: 100 });
    e.show(raw);
    e.sb.onresize(w, 100);
    assert.doesNotThrow(() => e.paint());
    assertSanePaint(e, `tiny ${w}`);
  }
});

test('transient notes still replace the status text next to the indicators', () => {
  const env = load();
  const v = makeView({ morphEdit: 1, morph: 10 });
  delete v.selectedFrames;
  env.show(v);
  const g = waveGeometry(env);
  env.click(g.x(0.5), g.y, { shift: true });
  env.paint();
  const t = env.texts();
  assert.ok(t.some((s) => /selectedFrames/.test(s)));
  assert.ok(t.includes('EDIT B') && t.includes('MORPH 10%'));
  assert.ok(!t.includes('Ready - 8 slices'));
});

/* ------------------------------------------------------------ painting, v1/v2 */

test('paint v1-only and v2 views at several sizes (all window positions)', () => {
  const views = {
    'v1 normal': makeView(),
    'v1 full': fullView(),
    'v1 empty': {},
    'v2 full': v2View({ armed: 'dup', selectedKey: 110 }),
    'v2 zone at 112': modZoneView(112, { rootKey: 112, gesture: 3, gestureNames: GEST_NAMES, morph: 5, scan: 95, morphEdit: 1 }),
    'v2 only fields': { morph: 50, scan: 50, morphEdit: 1, gesture: 0, gestureNames: GEST_NAMES },
    'v2 zone off': v2View({ modStart: -1, keyFlags: v2View().keyFlags.map((f) => f & ~8) })
  };
  for (const [label, raw] of Object.entries(views)) {
    for (const [w, h] of [[80, 80], [160, 100], [300, 120], [600, 160], [900, 300], [1400, 200]]) {
      const env = load({ w, h });
      env.show(raw);
      env.sb.onresize(w, h);
      for (const ws of [0, 24, 36, 61, 80]) {
        env.get('winStart = ' + ws);
        assert.doesNotThrow(() => env.paint(), `${label} ${w}x${h} ws ${ws}`);
        assertSanePaint(env, `${label} ${w}x${h} ws ${ws}`);
      }
    }
  }
});

test('paint with odd or malformed v2 fields', () => {
  const variants = [
    { morph: 'a', scan: null, morphEdit: 'yes', gesture: 'b', gestureNames: 5 },
    { morph: NaN, scan: Infinity, morphEdit: NaN, gesture: Infinity, gestureNames: [null, undefined, NaN, {}] },
    { morph: -50, scan: 1e9, morphEdit: 7, gesture: 99, gestureNames: ['x'] },
    { gesture: 2, modStart: 126, gestureNames: new Array(10).fill('long long name') },
    { gesture: 0, modStart: 'x', gestureNames: ['a', 'b', 'c', 'd'] },
    { morph: 33, keyFlags: new Array(128).fill(127), keys: new Array(128).fill(3), gesture: 3, modStart: 100 },
    { morphEdit: true, morph: 12.5, scan: 0.4, gestureNames: ['ok', 'b', 'c', 'd'], gesture: 3 }
  ];
  variants.forEach((raw, i) => {
    const env = load();
    env.show(raw);
    assert.doesNotThrow(() => env.paint(), `variant ${i}`);
    assertSanePaint(env, `variant ${i}`);
  });
});

test('v2 additions keep the file ES5 / ASCII and use only mocked mgraphics calls', () => {
  assert.ok(/^[\x00-\x7f]*$/.test(SRC), 'ASCII only');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const used = new Set();
  code.replace(/mgraphics\.([a-z_]+)\(/g, (m, name) => { used.add(name); return m; });
  for (const name of used) {
    assert.ok(MG_METHODS.indexOf(name) >= 0 || name === 'text_measure', `mgraphics.${name} is not in the mock`);
  }
  let acorn = null;
  try { acorn = require('acorn'); } catch (e) { /* optional */ }
  if (acorn) {
    assert.doesNotThrow(() => acorn.parse(SRC, { ecmaVersion: 5 }));
  }
  /* no ES6+ syntax slipped into the new code: no arrows, spread, template strings, let/const */
  assert.ok(!/=>|`|\blet\b|\bconst\b/.test(code.replace(/'(?:[^'\\\n]|\\.)*'/g, "''")));
});

/* ============================================================ drag-to-swap keys */

const ARROW = '→';

function swapEnv(over, opts) {
  const env = load(opts);
  env.show(makeView(Object.assign({ selectedKey: -1 }, over || {})));
  env.clear();
  return env;
}

function arrowPoint(env, dir) {
  const L = env.ex.computeLayout(600, 160);
  const r = dir < 0 ? L.prev : L.next;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/* press `from`, move through `via` (key numbers or {x, y}), release at `to` */
function dragKeys(env, from, via, to, mods) {
  const at = (t) => (typeof t === 'number' ? keyPoint(env, t) : t);
  const p = at(from);
  env.click(p.x, p.y, mods);
  via.forEach((t) => { const q = at(t); env.drag(q.x, q.y, mods); });
  const e = at(to);
  env.release(e.x, e.y);
}

/* does the last paint use this rgb for any set_source_rgba? */
function usesColor(env, rgb) {
  return env.log.some((c) => c[0] === 'set_source_rgba' && rgb.every((v, i) => Math.abs(c[1 + i] - v) < 1e-9));
}

test('swap: dragging a key onto another key sends selectkey then swap on release', () => {
  const pairs = [[60, 62], [60, 61], [61, 60], [62, 65], [36, 83], [83, 36], [40, 41], [37, 38]];
  for (const [a, b] of pairs) {
    const env = swapEnv();
    dragKeys(env, a, [b], b);
    assert.deepEqual(env.msgs(), [`selectkey ${a}`, `swap ${a} ${b}`], `${a} -> ${b}`);
    assert.equal(env.get('drag'), null);
  }
  /* the pointer may wander over other keys on the way; only the release position counts */
  const env = swapEnv();
  dragKeys(env, 60, [62, 64, 66, 47], 71);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 71']);
  /* a release event without any drag event in between (fast flick) still swaps */
  const env2 = swapEnv();
  dragKeys(env2, 60, [], 70);
  assert.deepEqual(env2.msgs(), ['selectkey 60', 'swap 60 70']);
  /* nothing is sent while dragging */
  const env3 = swapEnv();
  const p = keyPoint(env3, 60);
  const q = keyPoint(env3, 70);
  env3.click(p.x, p.y);
  env3.drag(q.x, q.y);
  assert.deepEqual(env3.msgs(), ['selectkey 60']);
  env3.release(q.x, q.y);
  assert.deepEqual(env3.msgs(), ['selectkey 60', 'swap 60 70']);
  /* a second drag works too */
  dragKeys(env3, 70, [72], 72);
  assert.deepEqual(env3.msgs().slice(2), ['selectkey 70', 'swap 70 72']);
});

test('swap: a press and release on one key is just selectkey, as before', () => {
  const env = swapEnv();
  const expected = [];
  for (let k = 36; k < 84; k++) {
    const p = keyPoint(env, k);
    env.click(p.x, p.y);
    env.release(p.x, p.y);
    expected.push('selectkey ' + k);
  }
  assert.deepEqual(env.msgs(), expected);
  /* a few pixels of jitter inside the key too */
  env.clear();
  const p = keyPoint(env, 60);
  env.click(p.x, p.y);
  env.drag(p.x + 2, p.y + 1);
  env.release(p.x + 2, p.y + 1);
  assert.deepEqual(env.msgs(), ['selectkey 60']);
});

test('swap: releasing on the same key, outside the strip or on an arrow cancels', () => {
  const lay = load().ex.computeLayout(600, 160);
  const cancels = {
    'dragged away and back to the same key': (env) => dragKeys(env, 60, [70, 60], 60),
    'released on the source key after a long walk': (env) => dragKeys(env, 60, [80, 40, 61], 60),
    'released in the waveform': (env) => dragKeys(env, 60, [70], { x: 300, y: lay.wave.y + 10 }),
    'released above the canvas': (env) => dragKeys(env, 60, [70], { x: 300, y: -20 }),
    'released in the status line': (env) => dragKeys(env, 60, [70], { x: 300, y: lay.status.y + 3 }),
    'released in the gap under the keys': (env) => dragKeys(env, 60, [70], { x: 300, y: lay.keys.y + lay.keys.h + 0.5 }),
    'released left of the canvas': (env) => dragKeys(env, 60, [70], { x: -40, y: lay.keys.y + 10 }),
    'released right of the canvas': (env) => dragKeys(env, 60, [70], { x: 5000, y: lay.keys.y + 10 }),
    'released on the < arrow': (env) => dragKeys(env, 60, [70], arrowPoint(env, -1)),
    'released on the > arrow': (env) => dragKeys(env, 60, [70], arrowPoint(env, 1)),
    'released on the tabs': (env) => dragKeys(env, 60, [70], { x: 20, y: 8 })
  };
  for (const [label, run] of Object.entries(cancels)) {
    const env = swapEnv();
    run(env);
    assert.deepEqual(env.msgs(), ['selectkey 60'], label);
    assert.equal(env.get('drag'), null, label);
    assert.equal(env.get('winStart'), 36, `${label}: window unchanged`);
    /* and the view is clean again afterwards */
    env.paint();
    assert.ok(!usesColor(env, plain(env.get('COL.swap'))), `${label}: no swap highlight left`);
    assert.ok(!env.texts().some((t) => /^swap /.test(t)), `${label}: no swap status left`);
  }
});

test('swap: a few pixels of movement across a key border is not a swap', () => {
  const env = swapEnv();
  const L = env.ex.computeLayout(600, 160);
  const bx = L.board.x + 15 * L.whiteW;                 /* border of C3 (60) and D3 (62) */
  const y = L.board.y + L.board.h - 2;                  /* below the black key */
  assert.equal(env.ex.keyAt(L, 36, bx - 1, y), 60);
  assert.equal(env.ex.keyAt(L, 36, bx + 1, y), 62);
  env.click(bx - 1, y);
  env.drag(bx + 1, y);
  env.release(bx + 1, y);
  assert.deepEqual(env.msgs(), ['selectkey 60'], 'under the threshold');

  env.clear();
  env.click(bx - 2, y);
  env.drag(bx + 3, y);
  env.release(bx + 3, y);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 62'], 'over the threshold');
  assert.equal(env.ex.constants.SWAP_THRESHOLD, 4);
});

test('swap: shift (audition) and cmd / ctrl (lock) presses never swap', () => {
  const env = swapEnv();
  dragKeys(env, 60, [62], 62, { shift: true });
  assert.deepEqual(env.msgs(), ['audition 60 100', 'auditionoff 60']);

  env.clear();
  dragKeys(env, 60, [62], 62, { cmd: true });
  assert.deepEqual(env.msgs(), ['lock 60']);
  assert.equal(env.get('drag'), null, 'no drag state for a lock click');

  env.clear();
  dragKeys(env, 60, [62], 62, { ctrl: true });
  assert.deepEqual(env.msgs(), ['lock 60']);

  /* shift beats nothing: no highlight, no scroll while auditioning over an arrow */
  env.clear();
  const p = keyPoint(env, 60);
  const a = arrowPoint(env, 1);
  env.click(p.x, p.y, { shift: true });
  env.drag(a.x, a.y, { shift: true });
  assert.equal(env.tick(), 0);
  env.paint();
  assert.ok(!usesColor(env, plain(env.get('COL.swap'))));
  env.release(a.x, a.y);
  assert.deepEqual(env.msgs(), ['audition 60 100', 'auditionoff 60']);
  assert.equal(env.get('winStart'), 36);
});

test('swap: other drags and clicks are unaffected', () => {
  const env = swapEnv();
  const g = waveGeometry(env);
  /* marker drag still previews and moves */
  env.click(g.x(3 / 8), g.y);
  env.drag(g.x(0.4), g.y);
  env.release(g.x(0.4), g.y);
  assert.deepEqual(env.msgs(), ['moveslice 3 ' + Math.round(0.4 * 480000)]);
  /* a key press starts nothing else, a new press replaces a dangling swap drag */
  env.clear();
  const p = keyPoint(env, 60);
  const q = keyPoint(env, 62);
  env.click(p.x, p.y);
  env.click(q.x, q.y);              /* previous release was lost */
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'selectkey 62']);
  /* tabs and arrows still work after a swap */
  env.clear();
  dragKeys(env, 60, [70], 70);
  const L = env.ex.computeLayout(600, 160);
  env.click(L.next.x + 5, L.next.y + 10);
  assert.equal(env.get('winStart'), 48);
  env.click(env.ex.tabRects(L, 3)[1].x + 3, 8);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 70', 'selectsource 3']);
});

test('swap: a lost release cancels without a swap; refreshes mid-drag do not disturb it', () => {
  const env = swapEnv();
  const p = keyPoint(env, 60);
  const q = keyPoint(env, 70);
  env.click(p.x, p.y);
  env.drag(q.x, q.y);
  env.sb.onidle(5, 5);
  assert.deepEqual(env.msgs(), ['selectkey 60'], 'no swap, no auditionoff');
  assert.equal(env.get('drag'), null);
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs(), ['selectkey 60'], 'the late release does nothing');

  /* the glue refreshes the view after selectkey: the drag survives it */
  env.clear();
  env.click(p.x, p.y);
  env.dicts.v = makeView({ selectedKey: 60 });
  env.sb.refresh();
  env.drag(q.x, q.y);
  env.sb.refresh();
  env.paint();
  assert.ok(env.texts().includes(`swap C3 ${ARROW} ${'A#'}3`), 'still dragging');
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 70']);
});

test('swap: the status line shows "swap C3 -> D3" while dragging, the plain status otherwise', () => {
  const { ex } = load();
  assert.equal(ex.swapText(60, 62), `swap C3 ${ARROW} D3`);
  assert.equal(ex.swapText(61, 36), `swap C#3 ${ARROW} C1`);
  assert.equal(ex.swapText(60, -1), `swap C3 ${ARROW} ?`);

  const env = swapEnv({ status: 'Ready - 8 slices' });
  const p = keyPoint(env, 60);
  const q = keyPoint(env, 62);
  env.click(p.x, p.y);
  env.paint();
  assert.ok(env.texts().includes('Ready - 8 slices'), 'a bare press shows the normal status');
  assert.ok(!env.texts().some((t) => /^swap /.test(t)));

  env.drag(q.x, q.y);
  env.paint();
  assert.ok(env.texts().includes(`swap C3 ${ARROW} D3`));
  assert.ok(!env.texts().includes('Ready - 8 slices'));
  /* the colour of the status text matches the highlight */
  const i = env.log.findIndex((c) => c[0] === 'show_text' && c[1] === `swap C3 ${ARROW} D3`);
  assert.deepEqual(env.log[i - 2].slice(1, 4), plain(env.get('COL.swap')));

  env.drag(300, 5);                       /* over the tabs: no target */
  env.paint();
  assert.ok(env.texts().includes(`swap C3 ${ARROW} ?`));
  const r = keyPoint(env, 71);
  env.drag(r.x, r.y);
  env.paint();
  assert.ok(env.texts().includes(`swap C3 ${ARROW} B3`));

  env.release(r.x, r.y);
  env.paint();
  assert.ok(env.texts().includes('Ready - 8 slices'));
  assert.ok(!env.texts().some((t) => /^swap /.test(t)));
});

test('swap: source and target keys are highlighted while dragging, nothing after', () => {
  const env = swapEnv();
  const L = env.ex.computeLayout(600, 160);
  const swapCol = plain(env.get('COL.swap'));
  const rectOf = (k) => env.ex.keyRect(L, 36, k);
  const polyOf = (k) => plain(env.ex.keyPolygon(L, 36, k));
  const lineWidth = (k) => {
    const pts = polyOf(k);
    const i = env.log.findIndex((c, j) => c[0] === 'move_to' && c[1] === pts[0] && c[2] === pts[1] &&
      env.log[j - 1][0] === 'set_line_width' && env.log[j - 2][0] === 'set_source_rgba' &&
      swapCol.every((v, n) => Math.abs(env.log[j - 2][1 + n] - v) < 1e-9));
    return i < 0 ? null : env.log[i - 1][1];
  };

  env.paint();
  const base = {};
  [60, 61, 62, 63].forEach((k) => { base[k] = rectFill(env, rectOf(k)); });
  assert.ok(!usesColor(env, swapCol));

  const p = keyPoint(env, 60);
  const q = keyPoint(env, 62);
  env.click(p.x, p.y);
  env.drag(p.x + 1, p.y);
  env.paint();
  assert.ok(!usesColor(env, swapCol), 'inside the source key nothing is highlighted yet');

  env.drag(q.x, q.y);
  env.paint();
  assertSanePaint(env, 'swap drag');
  assert.equal(polyStrokes(env, polyOf(60), swapCol), 1, 'source outline');
  assert.equal(polyStrokes(env, polyOf(62), swapCol), 1, 'target outline');
  assert.equal(polyStrokes(env, polyOf(61), swapCol), 0);
  assert.equal(polyStrokes(env, polyOf(63), swapCol), 0);
  assert.equal(lineWidth(60), 1);
  assert.equal(lineWidth(62), 3, 'the target is outlined more strongly');
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const src = rectFill(env, rectOf(60));
  assert.ok(lum(src) < lum(base[60]), 'source is dimmed');
  const tgt = rectFill(env, rectOf(62));
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(tgt[i] - (base[62][i] + (swapCol[i] - base[62][i]) * 0.5)) < 1e-9, 'target is tinted');
  }
  assert.deepEqual(rectFill(env, rectOf(61)), base[61], 'other keys unchanged');
  assert.deepEqual(rectFill(env, rectOf(63)), base[63]);

  /* moving to another key moves the target highlight */
  const r = keyPoint(env, 63);
  env.drag(r.x, r.y);
  env.paint();
  assert.equal(polyStrokes(env, polyOf(62), swapCol), 0);
  assert.equal(polyStrokes(env, polyOf(63), swapCol), 1);
  assert.equal(polyStrokes(env, polyOf(60), swapCol), 1, 'source stays marked');

  /* off the keys: only the source stays marked */
  env.drag(300, 5);
  env.paint();
  assert.equal(polyStrokes(env, polyOf(63), swapCol), 0);
  assert.equal(polyStrokes(env, polyOf(60), swapCol), 1);

  /* back on the source key: no target either */
  env.drag(p.x, p.y);
  env.paint();
  assert.equal(polyStrokes(env, polyOf(60), swapCol), 1);
  assert.equal(env.log.filter((c) => c[0] === 'set_source_rgba' && swapCol.every((v, i) => Math.abs(c[1 + i] - v) < 1e-9) && c[4] === 1).length, 1 /* the status text */);

  env.release(q.x, q.y);
  env.paint();
  assert.ok(!usesColor(env, swapCol), 'highlight gone after the release');
  [60, 61, 62, 63].forEach((k) => { assert.deepEqual(rectFill(env, rectOf(k)), base[k], `key ${k} back to normal`); });
});

test('swap: highlights work on black keys and next to the gesture / B marks', () => {
  const v = modZoneView(96, { rootKey: 96, gesture: 1, morphEdit: 1 });
  v.keyFlags[85] = 64 | 4;
  v.keys[85] = 2;
  const env = load();
  env.show(v);
  env.clear();
  const ws = env.get('winStart');
  const L = env.ex.computeLayout(600, 160);
  const swapCol = plain(env.get('COL.swap'));
  const p = env.ex.keyCenter(L, ws, 85);          /* C#: black, has B + layers */
  const q = env.ex.keyCenter(L, ws, 109);         /* black mod key */
  env.click(p.x, p.y);
  env.drag(q.x, q.y);
  env.paint();
  assertSanePaint(env, 'swap with marks');
  assert.equal(polyStrokes(env, plain(env.ex.keyPolygon(L, ws, 85)), swapCol), 1);
  assert.equal(polyStrokes(env, plain(env.ex.keyPolygon(L, ws, 109)), swapCol), 1);
  assert.ok(env.texts().includes(`swap ${env.ex.noteName(85)} ${ARROW} ${env.ex.noteName(109)}`));
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs().slice(-1), ['swap 85 109']);
});

test('swap: hovering over an arrow scrolls the window by an octave per dwell (Task)', () => {
  const env = swapEnv();
  const p = keyPoint(env, 60);
  const next = arrowPoint(env, 1);
  const prev = arrowPoint(env, -1);
  const arrowRect = env.ex.computeLayout(600, 160).next;
  const arrowFill0 = (() => { env.paint(); return rectFill(env, arrowRect); })();

  env.click(p.x, p.y);
  assert.equal(env.tasks.length, 0, 'no timer for a plain press');
  env.drag(next.x, next.y);
  assert.equal(env.tasks.length, 1);
  assert.equal(env.tasks[0].pending, env.ex.constants.HOVER_MS, 'armed with the dwell time');
  assert.equal(env.get('winStart'), 36, 'nothing scrolls before the dwell');
  env.drag(next.x + 1, next.y);
  assert.equal(env.tasks[0].pending, env.ex.constants.HOVER_MS, 'moving on the same arrow does not restart it');
  env.paint();
  assert.notDeepEqual(rectFill(env, arrowRect), arrowFill0, 'the hovered arrow lights up');

  assert.equal(env.tick(), 1);
  assert.equal(env.get('winStart'), 48);
  assert.equal(env.tasks[0].pending, env.ex.constants.HOVER_MS, 'keeps scrolling while the pointer stays');
  env.tick();
  assert.equal(env.get('winStart'), 60);

  /* leaving the arrow stops it */
  const q = keyPoint(env, 70);
  env.drag(q.x, q.y);
  assert.equal(env.tasks[0].pending, null);
  assert.equal(env.tick(), 0);
  assert.equal(env.get('winStart'), 60);
  env.paint();
  assert.deepEqual(rectFill(env, arrowRect), arrowFill0, 'arrow back to normal');

  /* the window scrolled while dragging: the swap lands on a key that was off-screen */
  assert.equal(keyPoint(env, 110), null, 'key 110 is off-screen at window 60');
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 70']);

  /* second drag: scroll twice, then drop on a key that needed the scroll */
  env.clear();
  const s = keyPoint(env, 70);
  env.click(s.x, s.y);
  env.drag(next.x, next.y);
  env.tick();
  assert.equal(env.get('winStart'), 72);
  env.tick();
  assert.equal(env.get('winStart'), 80, 'last window');
  assert.equal(env.tasks[0].pending, null, 'at the end: no more scrolling');
  const t = keyPoint(env, 120);
  env.drag(t.x, t.y);
  env.paint();
  assert.equal(polyStrokes(env, plain(env.ex.keyPolygon(env.ex.computeLayout(600, 160), 80, 120)), plain(env.get('COL.swap'))), 1);
  env.release(t.x, t.y);
  assert.deepEqual(env.msgs(), ['selectkey 70', 'swap 70 120']);

  /* and back with the < arrow */
  env.clear();
  const u = keyPoint(env, 90);
  env.click(u.x, u.y);
  env.drag(prev.x, prev.y);
  env.tick();
  assert.equal(env.get('winStart'), 72);
  env.release(prev.x, prev.y);
  assert.deepEqual(env.msgs(), ['selectkey 90'], 'releasing on the arrow cancels');
  assert.equal(env.get('winStart'), 72, 'but the scrolled window stays');
  assert.equal(env.tasks[0].pending, null);
});

test('swap: the dwell timer is cancelled by release, abort and a lost release', () => {
  for (const how of ['release', 'idle', 'newpress']) {
    const env = swapEnv();
    const p = keyPoint(env, 60);
    const next = arrowPoint(env, 1);
    env.click(p.x, p.y);
    env.drag(next.x, next.y);
    assert.equal(env.tasks[0].pending, env.ex.constants.HOVER_MS);
    if (how === 'release') { env.release(next.x, next.y); }
    if (how === 'idle') { env.sb.onidle(1, 1); }
    if (how === 'newpress') { env.click(p.x, p.y); }
    assert.equal(env.tasks[0].pending, null, how);
    assert.equal(env.tick(), 0, how);
    assert.equal(env.get('winStart'), 36, how);
  }
  /* a stale timer firing after the drag ended does nothing */
  const env = swapEnv();
  const p = keyPoint(env, 60);
  const next = arrowPoint(env, 1);
  env.click(p.x, p.y);
  env.drag(next.x, next.y);
  const task = env.tasks[0];
  env.release(next.x, next.y);
  task.fire();
  assert.equal(env.get('winStart'), 36);
});

test('swap: without Max Task the dwell is measured on drag events', () => {
  const env = swapEnv({}, { noTask: true });
  const p = keyPoint(env, 60);
  const next = arrowPoint(env, 1);
  env.click(p.x, p.y);
  env.drag(next.x, next.y);
  assert.equal(env.get('winStart'), 36);
  env.drag(next.x + 1, next.y);
  assert.equal(env.get('winStart'), 36, 'too early');
  env.get('drag.hoverAt = 1');                    /* pretend the pointer has been here for a long time */
  env.drag(next.x + 2, next.y);
  assert.equal(env.get('winStart'), 48);
  env.drag(next.x + 1, next.y);
  assert.equal(env.get('winStart'), 48, 'one octave per dwell');
  const q = keyPoint(env, 70);
  env.drag(q.x, q.y);
  env.release(q.x, q.y);
  assert.deepEqual(env.msgs(), ['selectkey 60', 'swap 60 70']);
});

test('swap: a throwing Task constructor falls back to event dwell', () => {
  const env = swapEnv();
  env.sb.Task = function Task() { throw new Error('no tasks here'); };
  const p = keyPoint(env, 60);
  const next = arrowPoint(env, 1);
  env.click(p.x, p.y);
  assert.doesNotThrow(() => env.drag(next.x, next.y));
  env.get('drag.hoverAt = 1');
  env.drag(next.x + 1, next.y);
  assert.equal(env.get('winStart'), 48);
});

test('swap: painting during a swap drag stays sane at every size and window', () => {
  for (const [w, h] of [[80, 80], [160, 100], [300, 120], [600, 160], [900, 300], [1400, 200]]) {
    const env = load({ w, h });
    env.show(v2View({ armed: 'dup' }));
    env.sb.onresize(w, h);
    const L = env.ex.computeLayout(w, h);
    for (const ws of [0, 36, 61, 80]) {
      env.get('winStart = ' + ws);
      const a = env.ex.keyCenter(L, ws, ws + 5);
      const b = env.ex.keyCenter(L, ws, ws + 30);
      env.click(a.x, a.y);
      env.drag(b.x, b.y);
      assert.doesNotThrow(() => env.paint(), `${w}x${h} ws ${ws}`);
      assertSanePaint(env, `swap ${w}x${h} ws ${ws}`);
      env.drag(L.next.x + 3, L.next.y + 3);
      env.paint();
      assertSanePaint(env, `swap on arrow ${w}x${h} ws ${ws}`);
      env.release(b.x, b.y);
      env.get('winStart = ' + ws);
    }
  }
});
