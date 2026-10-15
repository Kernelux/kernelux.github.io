'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { build } = require('../tools/build-patchers');
const {
  validate, indexPatcher, loadControlTable, loadConstants,
} = require('../tools/validate-patchers');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Default build: writes dist/SliceKit.maxpat and dist/slicekit.voice.maxpat
const built = build({ quiet: true });
const device = built.device;
const voice = built.voice;
const dev = indexPatcher(device.patcher);
const voi = indexPatcher(voice.patcher);

// ---- helpers -----------------------------------------------------------------------------------

/** the single box matching text (string | RegExp) */
function one(ix, text) {
  const f = ix.byText(text);
  assert.equal(f.length, 1, 'expected exactly one box matching ' + text + ', found ' + f.length);
  return f[0];
}

function wired(ix, a, outlet, b, inlet) {
  assert.ok(ix.hasLine(a, outlet, b, inlet),
    'missing patchline ' + (a.text || a.maxclass) + '[' + outlet + '] -> ' + (b.text || b.maxclass) + '[' + inlet + ']');
}

function control(v) {
  const f = dev.byVar(v);
  assert.equal(f.length, 1, 'control ' + v);
  return f[0];
}

const clone = (o) => structuredClone(o);

function findBox(json, pred) {
  return json.patcher.boxes.map((b) => b.box).find(pred);
}

/** the codebox inside the embedded gen~ of a voice patcher JSON */
function codeboxOf(voiceJson) {
  const gen = findBox(voiceJson, (b) => b.text === 'gen~');
  return findBox({ patcher: gen.patcher }, (b) => b.maxclass === 'codebox');
}

function errorsOf(json, opts) {
  return validate(json, opts);
}

const glue = one(dev, /^v8 slicekit\.js /);
const poly = one(dev, 'poly~ slicekit.voice 16');

// ---- files + validation ------------------------------------------------------------------------

test('build() writes both patchers and they validate', () => {
  assert.equal(built.files.length, 2);
  const devFile = path.join(DIST, 'SliceKit.maxpat');
  const voiceFile = path.join(DIST, 'slicekit.voice.maxpat');
  assert.deepEqual(built.files.sort(), [devFile, voiceFile].sort());
  for (const f of built.files) assert.ok(fs.existsSync(f), f + ' exists');
  assert.deepEqual(JSON.parse(fs.readFileSync(devFile, 'utf8')), device);
  assert.deepEqual(JSON.parse(fs.readFileSync(voiceFile, 'utf8')), voice);
  assert.deepEqual(validate(JSON.parse(fs.readFileSync(devFile, 'utf8'))), []);
  assert.deepEqual(validate(JSON.parse(fs.readFileSync(voiceFile, 'utf8'))), []);
});

test('device header: devicewidth, presentation, height <= 169', () => {
  const p = device.patcher;
  assert.equal(p.classnamespace, 'box');
  assert.equal(p.openinpresentation, 1);
  assert.ok(Number.isInteger(p.devicewidth) && p.devicewidth > 1000);
  let maxRight = 0;
  for (const b of dev.boxes) {
    if (b.presentation !== 1) continue;
    const [x, y, w, h] = b.presentation_rect;
    assert.ok(y + h <= 169, (b.varname || b.text || b.id) + ' too tall');
    assert.ok(x >= 0 && y >= 0);
    maxRight = Math.max(maxRight, x + w);
  }
  assert.ok(maxRight <= p.devicewidth && p.devicewidth - maxRight <= 8, 'devicewidth hugs the content');
  const ui = control('sk_ui');
  assert.deepEqual(ui.presentation_rect.slice(2), [600, 160]);
  assert.equal(ui.filename, 'slicekit-ui.js');
  assert.equal(ui.maxclass, 'jsui');
});

// ---- device wiring -----------------------------------------------------------------------------

test('MIDI: midiin -> midiparse -> prepend note/polypressure/pressure -> glue', () => {
  const midiin = one(dev, 'midiin');
  const parse = one(dev, 'midiparse');
  wired(dev, midiin, 0, parse, 0);
  for (const [outlet, text] of [[0, 'prepend note'], [1, 'prepend polypressure'], [4, 'prepend pressure']]) {
    const pre = one(dev, text);
    wired(dev, parse, outlet, pre, 0);
    wired(dev, pre, 0, glue, 0);
  }
  assert.equal(glue.numinlets, 1);
  assert.equal(glue.numoutlets, 4);
});

test('live.thisdevice -> [init( -> glue', () => {
  const td = one(dev, 'live.thisdevice');
  const init = one(dev, 'init');
  assert.equal(init.maxclass, 'message');
  wired(dev, td, 0, init, 0);
  wired(dev, init, 0, glue, 0);
});

test('drop and load chains', () => {
  const drop = control('sk_drop');
  assert.equal(drop.maxclass, 'live.drop');
  assert.ok(!drop.parameter_enable, 'live.drop is not a Live parameter');
  const pDrop = one(dev, 'prepend drop');
  wired(dev, drop, 0, pDrop, 0);
  wired(dev, pDrop, 0, glue, 0);

  const load = control('sk_load');
  assert.equal(load.maxclass, 'live.text');
  assert.equal(load.mode, 0);
  const dlg = one(dev, 'opendialog sound');
  const pLoad = one(dev, 'prepend load');
  wired(dev, load, 0, dlg, 0);
  wired(dev, dlg, 0, pLoad, 0);
  wired(dev, pLoad, 0, glue, 0);
});

test('glue outlet 0 -> poly~; plugphasor~ -> poly~; voiceend back to glue', () => {
  wired(dev, glue, 0, poly, 0);
  const phasor = one(dev, 'plugphasor~');
  wired(dev, phasor, 0, poly, 0);
  wired(dev, poly, 2, glue, 0);
  assert.equal(poly.numinlets, 1);
  assert.equal(poly.numoutlets, 3);
});

test('audio: poly~ L/R -> live.gain~ -> plugout~', () => {
  const out = control('sk_out');
  assert.equal(out.maxclass, 'live.gain~');
  wired(dev, poly, 0, out, 0);
  wired(dev, poly, 1, out, 1);
  const plugout = one(dev, 'plugout~');
  wired(dev, out, 0, plugout, 0);
  wired(dev, out, 1, plugout, 1);
  assert.equal(plugout.numinlets, 2);
  assert.equal(out.channels, 2);
  const v = out.saved_attribute_attributes.valueof;
  assert.equal(v.parameter_longname, 'Output');
  assert.equal(v.parameter_invisible, 0);
  assert.equal(v.parameter_mmin, -70);
  assert.equal(v.parameter_mmax, 6);
});

test('16 buffer~ ---src<i>, route 0..15, and the loaded <i> return path', () => {
  const route = one(dev, 'route ' + Array.from({ length: 16 }, (_, i) => i).join(' '));
  assert.equal(route.numoutlets, 17);
  wired(dev, glue, 1, route, 0);
  for (let i = 0; i < 16; i++) {
    const buf = one(dev, 'buffer~ ---src' + i);
    wired(dev, route, i, buf, 0);
    // right outlet bangs on read completion -> [t b] -> [loaded i( -> glue
    const tbs = dev.targets(buf, 1).map((t) => t.box).filter((b) => b.text === 't b');
    assert.equal(tbs.length, 1, 'buffer ' + i + ' -> t b');
    const msg = one(dev, 'loaded ' + i);
    assert.equal(msg.maxclass, 'message');
    wired(dev, tbs[0], 0, msg, 0);
    wired(dev, msg, 0, glue, 0);
  }
  assert.equal(dev.boxes.filter((b) => /^buffer~ /.test(b.text || '')).length, 16);
});

test('feedback: glue out2 -> route -> [prepend set] -> control (all PROTOCOL feedback names)', () => {
  const table = loadControlTable();
  const names = table.filter((r) => r.feedback);
  assert.equal(names.length, 44);
  const routes = dev.byText(/^route [a-z]/);
  assert.ok(routes.length >= 1);
  for (const r of routes) wired(dev, glue, 2, r, 0);
  for (const row of names) {
    const ctl = control(row.varname);
    const owner = routes.filter((r) => r.text.split(' ').slice(1).includes(row.feedback));
    assert.equal(owner.length, 1, row.feedback + ' routed exactly once');
    const idx = owner[0].text.split(' ').slice(1).indexOf(row.feedback);
    const set = dev.targets(owner[0], idx);
    assert.equal(set.length, 1, row.feedback + ' has one destination');
    assert.equal(set[0].box.text, 'prepend set');
    wired(dev, set[0].box, 0, ctl, 0);
  }
  // controls without feedback in the table are never fed by a [prepend set]
  for (const row of table.filter((r) => !r.feedback && !['jsui', 'live.drop'].includes(r.maxclass))) {
    const ctl = control(row.varname);
    const feeders = dev.inc(ctl.id).map((l) => dev.byId.get(l.from));
    assert.ok(feeders.every((b) => b.text !== 'prepend set'), row.varname + ' must not have feedback');
  }
});

test('every control reaches the glue through its prepend/message', () => {
  const table = loadControlTable();
  for (const row of table) {
    if (row.sends === 'audio') continue;
    const ctl = control(row.varname);
    const key = row.sends.replace(/<[^>]*>/g, '').replace(/\.\.\./g, '').trim();
    const first = dev.targets(ctl, 0);
    assert.ok(first.length >= 1, row.varname + ' outlet 0 connected');
    // direct [prepend X] / [X( to glue, or (load) via opendialog
    const direct = first.map((t) => t.box).filter((b) => b.text === 'prepend ' + key || b.text === key);
    if (row.varname === 'sk_load') {
      assert.equal(first[0].box.text, 'opendialog sound');
    } else {
      assert.equal(direct.length, 1, row.varname + ' -> ' + key);
      wired(dev, direct[0], 0, glue, 0);
    }
  }
});

test('jsui <-> glue', () => {
  const ui = control('sk_ui');
  wired(dev, glue, 3, ui, 0);
  const pUi = one(dev, 'prepend ui');
  wired(dev, ui, 0, pUi, 0);
  wired(dev, pUi, 0, glue, 0);
});

test('state dict (parameter_enable) and view dict', () => {
  const st = one(dev, 'dict ---skstate @parameter_enable 1');
  assert.equal(st.parameter_enable, 1);
  const v = st.saved_attribute_attributes.valueof;
  assert.equal(v.parameter_longname, 'SliceKit State');
  assert.equal(v.parameter_invisible, 1);
  assert.equal(v.parameter_type, 3);
  assert.ok(st.varname);
  const view = one(dev, 'dict ---skview');
  assert.ok(!view.parameter_enable);
  assert.ok(/---skstate/.test(glue.text) && /---skview/.test(glue.text) && /---src\b/.test(glue.text));
});

test('automatable set is exactly slot/chaos/repeat/rate/swing/alt/out; all else hidden', () => {
  const params = dev.boxes.filter((b) => b.parameter_enable === 1 && b.maxclass !== 'newobj');
  const auto = params.filter((b) => (b.saved_attribute_attributes.valueof.parameter_invisible || 0) === 0)
    .map((b) => b.varname).sort();
  assert.deepEqual(auto, ['sk_alt', 'sk_chaos', 'sk_out', 'sk_rate', 'sk_repeat', 'sk_slot', 'sk_swing']);
  for (const b of params) {
    const inv = b.saved_attribute_attributes.valueof.parameter_invisible || 0;
    assert.ok(inv === 0 || inv === 2, b.varname);
  }
  const names = params.map((b) => b.saved_attribute_attributes.valueof.parameter_longname);
  assert.equal(new Set(names).size, names.length, 'unique parameter_longname');
  // automatable params carry an initial value so Live's default is defined
  for (const v of ['sk_slot', 'sk_chaos', 'sk_repeat', 'sk_rate', 'sk_swing', 'sk_alt', 'sk_out']) {
    const a = control(v).saved_attribute_attributes.valueof;
    assert.equal(a.parameter_initial_enable, 1, v);
  }
});

test('enum items agree with core/model constants', { skip: !fs.existsSync(path.join(ROOT, 'core', 'model.js')) }, () => {
  const Model = require('../core/model');
  const C = Model.CONST;
  assert.deepEqual(control('sk_src_beatdiv').saved_attribute_attributes.valueof.parameter_enum, C.BEAT_DIVS);
  assert.deepEqual(control('sk_rate').saved_attribute_attributes.valueof.parameter_enum, C.REPEAT_DIVS);
  const arch = loadConstants();
  assert.deepEqual(arch.BEAT_DIVS, C.BEAT_DIVS);
  assert.deepEqual(arch.REPEAT_DIVS, C.REPEAT_DIVS);
});

test('feedback names routed by the patch cover those used by max/glue.js', { skip: !fs.existsSync(path.join(ROOT, 'max', 'glue.js')) }, () => {
  const src = fs.readFileSync(path.join(ROOT, 'max', 'glue.js'), 'utf8');
  const used = new Set(Array.from(src.matchAll(/'((?:src|pad|kit)_[a-z0-9]+)'/g), (m) => m[1]));
  const routed = new Set(dev.byText(/^route [a-z]/).flatMap((r) => r.text.split(' ').slice(1)));
  for (const n of used) assert.ok(routed.has(n), 'glue.js sends feedback "' + n + '" but no [route] handles it');
});

// ---- voice patcher -----------------------------------------------------------------------------

test('voice: in 1 / in~ 1 -> gen~ -> out~ 1/2, active -> edge~ -> int -> prepend voiceend -> out 3', () => {
  const inMsg = one(voi, 'in 1');
  const inSig = one(voi, 'in~ 1');
  const gen = one(voi, 'gen~');
  assert.equal(gen.numinlets, 1);
  assert.equal(gen.numoutlets, 3);
  assert.deepEqual(gen.outlettype, ['signal', 'signal', 'signal']);
  wired(voi, inMsg, 0, gen, 0);
  wired(voi, inSig, 0, gen, 0);
  wired(voi, gen, 0, one(voi, 'out~ 1'), 0);
  wired(voi, gen, 1, one(voi, 'out~ 2'), 0);
  const edge = one(voi, 'edge~');
  wired(voi, gen, 2, edge, 0);
  const hold = one(voi, 'int');
  wired(voi, edge, 1, hold, 0); // right outlet = falling edge
  const pre = one(voi, 'prepend voiceend');
  wired(voi, hold, 0, pre, 0);
  wired(voi, pre, 0, one(voi, 'out 3'), 0);
  wired(voi, one(voi, 'loadbang'), 0, one(voi, 'thispoly~'), 0);
  wired(voi, one(voi, 'thispoly~'), 0, hold, 1);
});

test('voice: embedded gen~ is a dsp.gen patcher with in 1, codebox, out 1..3', () => {
  const gen = one(voi, 'gen~');
  const inner = gen.patcher;
  assert.equal(inner.classnamespace, 'dsp.gen');
  const ix = indexPatcher(inner);
  const cb = ix.boxes.find((b) => b.maxclass === 'codebox');
  assert.ok(cb && cb.code.trim().length > 0);
  assert.equal(cb.numinlets, 1);
  assert.equal(cb.numoutlets, 3);
  wired(ix, one(ix, 'in 1'), 0, cb, 0);
  for (let i = 1; i <= 3; i++) wired(ix, cb, i - 1, one(ix, 'out ' + i), 0);
  assert.equal(one(ix, 'in 1').numinlets, 0);
  assert.equal(one(ix, 'out 1').numoutlets, 0);
});

// ---- build options -----------------------------------------------------------------------------

test('voice code is read from voiceSrc at build time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const src = path.join(dir, 'voice.genexpr');
    const code = '// test voice\nParam gain(1);\nout1 = in1 * gain;\nout2 = in1 * gain;\nout3 = 1;\n';
    fs.writeFileSync(src, code);
    const r = build({ outDir: path.join(dir, 'out'), voiceSrc: src, quiet: true });
    assert.deepEqual(r.warnings, []);
    assert.equal(codeboxOf(r.voice).code, code);
    assert.equal(codeboxOf(r.voice).numinlets, 1);
    assert.equal(codeboxOf(r.voice).numoutlets, 3);
    assert.deepEqual(validate(r.device), []);
    assert.deepEqual(validate(r.voice), []);
    for (const f of r.files) assert.ok(fs.existsSync(f));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing voice.genexpr -> warning + silent placeholder codebox', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const r = build({ outDir: dir, voiceSrc: path.join(dir, 'nope.genexpr'), quiet: true });
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /placeholder/);
    const cb = codeboxOf(r.voice);
    assert.match(cb.code, /PLACEHOLDER/);
    assert.match(cb.code, /out1\s*=/);
    assert.deepEqual(validate(r.voice), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the validator really catches problems -----------------------------------------------------

test('validator: structural errors', () => {
  let j = clone(device);
  j.patcher.boxes[1].box.id = j.patcher.boxes[0].box.id;
  assert.ok(errorsOf(j).some((e) => /duplicate box id/.test(e)));

  j = clone(device);
  j.patcher.lines[0].patchline.source[1] = 99;
  assert.ok(errorsOf(j).some((e) => /outlet 99/.test(e)));

  j = clone(device);
  j.patcher.lines[0].patchline.destination[1] = 42;
  assert.ok(errorsOf(j).some((e) => /inlet 42/.test(e)));

  j = clone(device);
  j.patcher.lines[0].patchline.destination[0] = 'obj-99999';
  assert.ok(errorsOf(j).some((e) => /does not exist/.test(e)));

  j = clone(device);
  delete j.patcher.boxes[0].box.patching_rect;
  assert.ok(errorsOf(j).some((e) => /patching_rect/.test(e)));
});

test('validator: control table errors', () => {
  let j = clone(device);
  const dropIdx = j.patcher.boxes.findIndex((b) => b.box.varname === 'sk_chaos');
  const id = j.patcher.boxes[dropIdx].box.id;
  j.patcher.boxes.splice(dropIdx, 1);
  j.patcher.lines = j.patcher.lines.filter((l) => l.patchline.source[0] !== id && l.patchline.destination[0] !== id);
  assert.ok(errorsOf(j).some((e) => /control sk_chaos missing/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_chaos').saved_attribute_attributes.valueof.parameter_invisible = 2;
  assert.ok(errorsOf(j).some((e) => /sk_chaos: parameter_invisible 2 != 0/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_pad_pitch').saved_attribute_attributes.valueof.parameter_invisible = 0;
  assert.ok(errorsOf(j).some((e) => /sk_pad_pitch: parameter_invisible 0 != 2/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_src_sens').maxclass = 'live.numbox';
  assert.ok(errorsOf(j).some((e) => /sk_src_sens: maxclass/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_pad_pitch').saved_attribute_attributes.valueof.parameter_mmax = 47;
  assert.ok(errorsOf(j).some((e) => /sk_pad_pitch: parameter_mmax/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_slot').saved_attribute_attributes.valueof.parameter_enum.pop();
  assert.ok(errorsOf(j).some((e) => /sk_slot: parameter_enum/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_src_snap').mode = 0;
  assert.ok(errorsOf(j).some((e) => /sk_src_snap: mode/.test(e)));

  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_chaos').varname = 'sk_swing';
  assert.ok(errorsOf(j).some((e) => /duplicate varname|present 2 times/.test(e)));
});

test('validator: presentation + parameter names', () => {
  let j = clone(device);
  const b = findBox(j, (x) => x.varname === 'sk_pad_pitch');
  b.presentation_rect = [b.presentation_rect[0], 150, 41, 48];
  assert.ok(errorsOf(j).some((e) => /sk_pad_pitch.*> 169/.test(e)));

  j = clone(device);
  findBox(j, (x) => x.varname === 'sk_pad_pitch').presentation_rect[0] = j.patcher.devicewidth;
  assert.ok(errorsOf(j).some((e) => /devicewidth/.test(e)));

  j = clone(device);
  const a = findBox(j, (x) => x.varname === 'sk_pad_pitch');
  const c = findBox(j, (x) => x.varname === 'sk_pad_fine');
  c.presentation_rect = a.presentation_rect.slice();
  assert.ok(errorsOf(j).some((e) => /presentation overlap/.test(e)));

  j = clone(device);
  findBox(j, (x) => x.varname === 'sk_pad_fine').saved_attribute_attributes.valueof.parameter_longname = 'Pad Pitch';
  assert.ok(errorsOf(j).some((e) => /duplicate parameter_longname "Pad Pitch"/.test(e)));
});

test('validator: wiring errors', () => {
  // cut the [prepend set] -> control line
  let j = clone(device);
  const ctl = findBox(j, (x) => x.varname === 'sk_pad_pitch');
  j.patcher.lines = j.patcher.lines.filter((l) => !(l.patchline.destination[0] === ctl.id && l.patchline.destination[1] === 0
    && j.patcher.boxes.find((b) => b.box.id === l.patchline.source[0]).box.text === 'prepend set'));
  assert.ok(errorsOf(j).some((e) => /sk_pad_pitch: route outlet/.test(e)));

  // cut control -> prepend
  j = clone(device);
  const ctl2 = findBox(j, (x) => x.varname === 'sk_chaos');
  j.patcher.lines = j.patcher.lines.filter((l) => l.patchline.source[0] !== ctl2.id);
  assert.ok(errorsOf(j).some((e) => /sk_chaos: no path control/.test(e)));

  // voice: break gen~ -> edge~
  const v = clone(voice);
  const gen = findBox(v, (x) => x.text === 'gen~');
  v.patcher.lines = v.patcher.lines.filter((l) => !(l.patchline.source[0] === gen.id && l.patchline.source[1] === 2));
  assert.ok(errorsOf(v).some((e) => /gen~ out2 -> edge~/.test(e)));

  // voice: empty codebox
  const v2 = clone(voice);
  codeboxOf(v2).code = '  ';
  assert.ok(errorsOf(v2).some((e) => /codebox code is empty/.test(e)));
});

test('validator: rejects non-patchers', () => {
  assert.deepEqual(validate({}), ['missing top-level "patcher" object']);
  assert.deepEqual(validate(null), ['missing top-level "patcher" object']);
});
