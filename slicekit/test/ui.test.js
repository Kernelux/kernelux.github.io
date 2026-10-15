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
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'ui.js' });

  const env = {
    sb: sandbox, ex: sandbox.module.exports, mg, log, out, posts, dicts,
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
  assert.equal(ex.modLabel(12), '');
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
