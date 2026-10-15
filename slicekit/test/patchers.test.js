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
const recorder = one(dev, 'gen~'); // the capture recorder is the only gen~ in the device patcher

const RECORDER_CODE = [
  '// test recorder',
  'Buffer cap;',
  'Buffer wpb;',
  'History wp(0);',
  'if (dim(cap) > 0) {',
  '  poke(cap, in1, wp, 0);',
  '  poke(cap, in2, wp, 1);',
  '  poke(wpb, wp, 0, 0);',
  '  wp = (wp + 1) % dim(cap);',
  '}',
  'out1 = wp;',
  '',
].join('\n');

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
  assert.equal(glue.numoutlets, 5);
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
  const once = dev.targets(load, 0)[0].box;
  assert.equal(once.text, 'route bang 1', 'Load fires once per click');
  wired(dev, once, 0, dlg, 0);
  wired(dev, once, 1, dlg, 0);
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
  assert.equal(dev.boxes.filter((b) => /^buffer~ ---src\d+$/.test(b.text || '')).length, 16);
  // 16 sample buffers + the three capture buffers
  assert.equal(dev.boxes.filter((b) => /^buffer~ /.test(b.text || '')).length, 19);
});

test('feedback: glue out2 -> route -> [prepend set] -> control (all PROTOCOL feedback names)', () => {
  const table = loadControlTable();
  const names = table.filter((r) => r.feedback);
  assert.equal(names.length, 59); // 44 (v1) + 15 (v2: morphedit, capturebars, keepclip, 11 gest_*, src_simplers)
  assert.equal(names.filter((r) => r.feedbackRaw).length, 1);
  const routes = dev.byText(/^route (src|pad|kit|gest)_/);
  assert.ok(routes.length >= 1);
  for (const r of routes) wired(dev, glue, 2, r, 0);
  for (const row of names) {
    const ctl = control(row.varname);
    const owner = routes.filter((r) => r.text.split(' ').slice(1).includes(row.feedback));
    assert.equal(owner.length, 1, row.feedback + ' routed exactly once');
    const idx = owner[0].text.split(' ').slice(1).indexOf(row.feedback);
    const set = dev.targets(owner[0], idx);
    assert.equal(set.length, 1, row.feedback + ' has one destination');
    if (row.feedbackRaw) {
      // raw feedback (umenu `clear` / `append <item>`): straight into the control, never via [prepend set]
      assert.equal(set[0].box.id, ctl.id, row.feedback + ' goes straight to the control');
      assert.equal(set[0].inlet, 0);
      continue;
    }
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
    let first = dev.targets(ctl, 0);
    assert.ok(first.length >= 1, row.varname + ' outlet 0 connected');
    // buttons go through [route bang 1] (fires once per click, bang or 1/0), both outlets to the same box
    if (first.length === 1 && first[0].box.text === 'route bang 1') {
      const once = first[0].box;
      first = dev.targets(once, 0);
      assert.deepEqual(dev.targets(once, 1).map((t) => t.box.id), first.map((t) => t.box.id), row.varname + ' once-filter outlets');
    }
    // direct [prepend X] / [X( to glue, or (load) via opendialog
    const direct = first.map((t) => t.box).filter((b) => b.text === 'prepend ' + key || b.text === key);
    if (row.varname === 'sk_load') {
      assert.equal(first[0].box.text, 'opendialog sound');
    } else if (row.varname === 'sk_capfolder') {
      assert.equal(first[0].box.text, 'opendialog fold');
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

test('automatable set is exactly slot/chaos/repeat/rate/swing/alt/morph/scan/out; all else hidden', () => {
  const params = dev.boxes.filter((b) => b.parameter_enable === 1 && b.maxclass !== 'newobj');
  const auto = params.filter((b) => (b.saved_attribute_attributes.valueof.parameter_invisible || 0) === 0)
    .map((b) => b.varname).sort();
  assert.deepEqual(auto, ['sk_alt', 'sk_chaos', 'sk_morph', 'sk_out', 'sk_rate', 'sk_repeat', 'sk_scan', 'sk_slot', 'sk_swing']);
  for (const b of params) {
    const inv = b.saved_attribute_attributes.valueof.parameter_invisible || 0;
    assert.ok(inv === 0 || inv === 2, b.varname);
  }
  const names = params.map((b) => b.saved_attribute_attributes.valueof.parameter_longname);
  assert.equal(new Set(names).size, names.length, 'unique parameter_longname');
  // automatable params carry an initial value so Live's default is defined
  for (const v of ['sk_slot', 'sk_chaos', 'sk_repeat', 'sk_rate', 'sk_swing', 'sk_alt', 'sk_morph', 'sk_scan', 'sk_out']) {
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
  // v2 constants: the patcher enums follow ARCHITECTURE.md; model.js is compared once it defines them
  const enumOf = (v) => control(v).saved_attribute_attributes.valueof.parameter_enum;
  assert.deepEqual(enumOf('sk_capturebars'), arch.CAPTURE_BARS);
  assert.deepEqual(enumOf('sk_gest_ratefrom'), arch.GEST_RATES);
  assert.deepEqual(enumOf('sk_gest_rateto'), arch.GEST_RATES);
  assert.deepEqual(enumOf('sk_gest_beats'), arch.GEST_BEATS_LABELS);
  if (C.CAPTURE_BARS) assert.deepEqual(C.CAPTURE_BARS, arch.CAPTURE_BARS);
  if (C.GEST_RATES) assert.deepEqual(C.GEST_RATES, arch.GEST_RATES);
  if (C.GEST_BEATS_LABELS) assert.deepEqual(C.GEST_BEATS_LABELS, arch.GEST_BEATS_LABELS);
});

test('feedback names routed by the patch cover those used by max/glue.js', { skip: !fs.existsSync(path.join(ROOT, 'max', 'glue.js')) }, () => {
  const src = fs.readFileSync(path.join(ROOT, 'max', 'glue.js'), 'utf8');
  const used = new Set(Array.from(src.matchAll(/'((?:src|pad|kit|gest)_[a-z0-9]+)'/g), (m) => m[1]));
  const routed = new Set(dev.byText(/^route [a-z]/).flatMap((r) => r.text.split(' ').slice(1)));
  for (const n of used) assert.ok(routed.has(n), 'glue.js sends feedback "' + n + '" but no [route] handles it');
});

// ---- v2 topology: glue/5 outlets, capture buffers, recorder, simplers umenu, folder dialog -----------

test('v2 glue: v8 slicekit.js ---src ---skstate ---skview ---cap with 5 outlets', () => {
  assert.equal(glue.text, 'v8 slicekit.js ---src ---skstate ---skview ---cap');
  assert.equal(glue.text.split(' ')[5], '---cap', 'the 4th argument (jsarguments[4]) is the ring buffer name');
  assert.equal(glue.numinlets, 1);
  assert.equal(glue.numoutlets, 5);
  assert.equal(glue.outlettype.length, 5);
});

test('v2 capture buffers: ---cap 40000 2, ---capwp 10 1, ---capout 1000 2', () => {
  for (const t of ['buffer~ ---cap 40000 2', 'buffer~ ---capwp 10 1', 'buffer~ ---capout 1000 2']) {
    const b = one(dev, t);
    assert.equal(b.maxclass, 'newobj');
  }
  // the name suffixes line up with the glue convention: capName + 'wp' / capName + 'out'
  const names = dev.boxes.map((b) => b.text || '').filter((t) => /^buffer~ ---cap/.test(t)).map((t) => t.split(' ')[1]);
  assert.deepEqual(names.sort(), ['---cap', '---capout', '---capwp']);
});

test('v2 recorder: gen~ (dsp.gen, codebox, in 1/in 2/out 1) fed by poly~ L/R and glue outlet 4', () => {
  assert.equal(recorder.numinlets, 2);
  assert.equal(recorder.numoutlets, 1);
  wired(dev, poly, 0, recorder, 0);
  wired(dev, poly, 1, recorder, 1);
  wired(dev, glue, 4, recorder, 0);
  // tapped before live.gain~: the same poly~ outlets still feed the output gain
  wired(dev, poly, 0, control('sk_out'), 0);
  wired(dev, poly, 1, control('sk_out'), 1);

  assert.ok(recorder.patcher, 'embedded patcher');
  assert.equal(recorder.patcher.classnamespace, 'dsp.gen');
  const ix = indexPatcher(recorder.patcher);
  const cb = ix.boxes.find((b) => b.maxclass === 'codebox');
  assert.ok(cb && cb.code.trim().length > 0);
  assert.equal(cb.numinlets, 2);
  assert.equal(cb.numoutlets, 1);
  wired(ix, one(ix, 'in 1'), 0, cb, 0);
  wired(ix, one(ix, 'in 2'), 0, cb, 1);
  wired(ix, cb, 0, one(ix, 'out 1'), 0);
  assert.deepEqual(validate(device), []);
});

test('v2 Folder...: live.text -> [route bang 1] -> [opendialog fold] -> [prepend kit capturefolder] -> glue', () => {
  const folder = control('sk_capfolder');
  assert.equal(folder.maxclass, 'live.text');
  assert.equal(folder.mode, 0);
  assert.equal(folder.text, 'Folder…');
  const once = dev.targets(folder, 0)[0].box;
  assert.equal(dev.targets(folder, 0).length, 1);
  assert.equal(once.text, 'route bang 1', 'Folder... fires once per click');
  const dlg = one(dev, 'opendialog fold');
  const pre = one(dev, 'prepend kit capturefolder');
  wired(dev, once, 0, dlg, 0);
  wired(dev, once, 1, dlg, 0);
  wired(dev, dlg, 0, pre, 0);
  wired(dev, pre, 0, glue, 0);
  // the sample chooser is a different [opendialog]
  assert.equal(dev.byText(/^opendialog /).length, 2);
});

test('v2 sk_simplers umenu: not a Live parameter, raw route -> umenu, umenu outlet 0 -> prepend source fromsimpler -> glue', () => {
  const um = control('sk_simplers');
  assert.equal(um.maxclass, 'umenu');
  assert.equal(um.numinlets, 1);
  assert.equal(um.numoutlets, 3);
  assert.equal(um.outlettype[0], 'int');
  assert.ok(!um.parameter_enable, 'umenu is not a Live parameter');
  assert.equal(um.saved_attribute_attributes, undefined);
  assert.equal(um.presentation, 1);

  // raw feedback: glue out2 -> [route ... src_simplers ...] -> umenu inlet 0 (no [prepend set])
  const routes = dev.byText(/^route .*\bsrc_simplers\b/);
  assert.equal(routes.length, 1);
  const r = routes[0];
  wired(dev, glue, 2, r, 0);
  const idx = r.text.split(' ').slice(1).indexOf('src_simplers');
  const tg = dev.targets(r, idx);
  assert.equal(tg.length, 1);
  assert.equal(tg[0].box.id, um.id);
  assert.equal(tg[0].inlet, 0);
  assert.ok(dev.inc(um.id).every((l) => dev.byId.get(l.from).text !== 'prepend set'));

  // selection: umenu outlet 0 (index) -> [prepend source fromsimpler] -> glue
  const pre = one(dev, 'prepend source fromsimpler');
  assert.deepEqual(dev.targets(um, 0).map((t) => t.box.id), [pre.id]);
  wired(dev, pre, 0, glue, 0);
  assert.equal(dev.targets(um, 1).length, 0, 'item text outlet unused');

  // Find Simplers goes through the once-filter to [source simplerscan(
  const scan = control('sk_simplerscan');
  assert.equal(scan.mode, 0);
  assert.equal(scan.text, 'Find Simplers');
  const once = dev.targets(scan, 0)[0].box;
  assert.equal(once.text, 'route bang 1');
  const msg = one(dev, 'source simplerscan');
  assert.equal(msg.maxclass, 'message');
  wired(dev, once, 0, msg, 0);
  wired(dev, once, 1, msg, 0);
  wired(dev, msg, 0, glue, 0);
});

test('v2 buttons all go through [route bang 1] to a message box (or the dialog chain)', () => {
  const buttons = loadControlTable().filter((r) => r.maxclass === 'live.text' && r.mode === 'button');
  assert.ok(buttons.length >= 20);
  for (const row of buttons) {
    const b = control(row.varname);
    const first = dev.targets(b, 0);
    assert.equal(first.length, 1, row.varname);
    assert.equal(first[0].box.text, 'route bang 1', row.varname);
    assert.deepEqual(dev.targets(first[0].box, 1).map((t) => t.box.id), dev.targets(first[0].box, 0).map((t) => t.box.id));
  }
  for (const [v, msg] of [['sk_morphcopy', 'pad morphcopy'], ['sk_morphclear', 'pad morphclear'],
    ['sk_morphcopyall', 'kit morphcopyall'], ['sk_morphclearall', 'kit morphclearall'],
    ['sk_capture', 'kit capture'], ['sk_remapclip', 'kit remapclip']]) {
    const once = dev.targets(control(v), 0)[0].box;
    const m = one(dev, msg);
    assert.equal(m.maxclass, 'message', msg);
    wired(dev, once, 0, m, 0);
    wired(dev, once, 1, m, 0);
    wired(dev, m, 0, glue, 0);
  }
});

test('v2 controls: morph/scan, capture, gesture editors carry the table ranges, enums and messages', () => {
  const val = (v) => control(v).saved_attribute_attributes.valueof;
  for (const v of ['sk_morph', 'sk_scan']) {
    assert.equal(control(v).maxclass, 'live.dial');
    assert.equal(val(v).parameter_mmin, 0);
    assert.equal(val(v).parameter_mmax, 100);
    assert.equal(val(v).parameter_invisible, 0, v + ' is automatable');
    assert.equal(val(v).parameter_initial_enable, 1);
    assert.deepEqual(val(v).parameter_initial, [0]);
    assert.ok(!dev.inc(control(v).id).some((l) => dev.byId.get(l.from).text === 'prepend set'), v + ' has no feedback');
  }
  assert.equal(control('sk_morphedit').mode, 1);
  assert.equal(control('sk_morphedit').text, 'Edit B');
  assert.equal(control('sk_keepclip').mode, 1);
  assert.equal(control('sk_keepclip').text, 'Keep clip');
  assert.equal(control('sk_remapclip').text, 'Remap clip');
  assert.equal(control('sk_capture').text, 'Capture');
  assert.equal(control('sk_morphcopy').text, 'A→B');
  assert.equal(control('sk_morphclearall').text, 'All Clr B');

  assert.deepEqual(val('sk_capturebars').parameter_enum, ['1/2 Bar', '1 Bar', '2 Bars', '4 Bars', '8 Bars']);
  assert.deepEqual(val('sk_gest_sel').parameter_enum, ['1', '2', '3', '4']);
  assert.equal(control('sk_gest_sel').maxclass, 'live.tab');
  assert.deepEqual(val('sk_gest_beats').parameter_enum,
    ['1/16 bar', '1/8 bar', '1 beat', '2 beats', '1 bar', '2 bars', '4 bars']);
  assert.deepEqual(val('sk_gest_ratefrom').parameter_enum,
    ['off', '1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64']);
  assert.deepEqual(val('sk_gest_rateto').parameter_enum, val('sk_gest_ratefrom').parameter_enum);
  for (const v of ['sk_gest_cutfrom', 'sk_gest_cutto']) {
    assert.equal(val(v).parameter_mmin, 20);
    assert.equal(val(v).parameter_mmax, 20000);
    assert.ok(val(v).parameter_exponent > 1, v + ' exponential');
  }
  for (const v of ['sk_gest_pitchfrom', 'sk_gest_pitchto']) {
    assert.equal(val(v).parameter_mmin, -48);
    assert.equal(val(v).parameter_mmax, 48);
  }
  for (const v of ['sk_gest_ampfrom', 'sk_gest_ampto', 'sk_gest_curve']) {
    assert.equal(val(v).parameter_mmin, 0);
    assert.equal(val(v).parameter_mmax, 100);
  }
  // every gesture control is hidden, sends `gest <param>` and is fed back by a [route gest_*]
  const gestRoute = one(dev, /^route gest_/);
  assert.equal(gestRoute.text.split(' ').length - 1, 11);
  for (const v of dev.boxes.map((b) => b.varname).filter((n) => /^sk_gest_/.test(n || ''))) {
    assert.equal(val(v).parameter_invisible, 2, v);
    const pre = dev.targets(control(v), 0)[0].box;
    assert.match(pre.text, /^prepend gest /, v);
    wired(dev, pre, 0, glue, 0);
  }
});

test('v2 presentation: new groups sit inside the device and devicewidth hugs the content', () => {
  const groups = {
    morph: ['sk_morph', 'sk_scan', 'sk_morphedit', 'sk_morphcopy', 'sk_morphclear', 'sk_morphcopyall', 'sk_morphclearall'],
    gesture: ['sk_gest_sel', 'sk_gest_beats', 'sk_gest_ratefrom', 'sk_gest_rateto', 'sk_gest_cutfrom', 'sk_gest_cutto',
      'sk_gest_pitchfrom', 'sk_gest_pitchto', 'sk_gest_ampfrom', 'sk_gest_ampto', 'sk_gest_curve'],
    capture: ['sk_capture', 'sk_capturebars', 'sk_capfolder', 'sk_keepclip', 'sk_remapclip'],
    sample: ['sk_simplerscan', 'sk_simplers'],
  };
  for (const list of Object.values(groups)) {
    for (const v of list) {
      const b = control(v);
      assert.equal(b.presentation, 1, v);
      const [x, y, w, h] = b.presentation_rect;
      assert.ok(y + h <= 169 && x + w <= device.patcher.devicewidth, v);
    }
  }
  // the gesture editors are one left-to-right block right of the morph block
  const xOf = (v) => control(v).presentation_rect[0];
  assert.ok(xOf('sk_gest_sel') > xOf('sk_morph'));
  assert.ok(xOf('sk_out') > xOf('sk_gest_curve'));
  // every panel stays inside the 169 px height
  for (const b of dev.boxes.filter((x) => x.maxclass === 'panel')) {
    assert.ok(b.presentation_rect[1] >= 0 && b.presentation_rect[1] + b.presentation_rect[3] <= 169);
  }
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
    const recSrc = path.join(dir, 'recorder.genexpr');
    fs.writeFileSync(recSrc, RECORDER_CODE);
    const r = build({ outDir: path.join(dir, 'out'), voiceSrc: src, recorderSrc: recSrc, quiet: true });
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
    const recSrc = path.join(dir, 'recorder.genexpr');
    fs.writeFileSync(recSrc, RECORDER_CODE);
    const r = build({ outDir: dir, voiceSrc: path.join(dir, 'nope.genexpr'), recorderSrc: recSrc, quiet: true });
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /voice source .*nope\.genexpr not found.*placeholder/);
    const cb = codeboxOf(r.voice);
    assert.match(cb.code, /PLACEHOLDER/);
    assert.match(cb.code, /out1\s*=/);
    assert.deepEqual(validate(r.voice), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recorder code is read from recorderSrc at build time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const voiceSrc = path.join(dir, 'voice.genexpr');
    fs.writeFileSync(voiceSrc, 'out1 = in1;\nout2 = in1;\nout3 = 1;\n');
    const recSrc = path.join(dir, 'recorder.genexpr');
    fs.writeFileSync(recSrc, RECORDER_CODE);
    const r = build({ outDir: path.join(dir, 'out'), voiceSrc, recorderSrc: recSrc, quiet: true });
    assert.deepEqual(r.warnings, []);
    const gen = findBox(r.device, (b) => b.text === 'gen~');
    const cb = findBox({ patcher: gen.patcher }, (b) => b.maxclass === 'codebox');
    assert.equal(cb.code, RECORDER_CODE);
    assert.equal(cb.numinlets, 2);
    assert.equal(cb.numoutlets, 1);
    assert.deepEqual(validate(r.device), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing recorder.genexpr -> warning + silent placeholder codebox (still 2 inlets, valid)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const voiceSrc = path.join(dir, 'voice.genexpr');
    fs.writeFileSync(voiceSrc, 'out1 = in1;\nout2 = in1;\nout3 = 1;\n');
    const r = build({ outDir: dir, voiceSrc, recorderSrc: path.join(dir, 'nope.genexpr'), quiet: true });
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /recorder source .*nope\.genexpr not found.*placeholder/);
    const gen = findBox(r.device, (b) => b.text === 'gen~');
    const cb = findBox({ patcher: gen.patcher }, (b) => b.maxclass === 'codebox');
    assert.match(cb.code, /PLACEHOLDER/);
    assert.equal(cb.numinlets, 2);
    assert.deepEqual(validate(r.device), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recorder code that only uses in1 still gets 2 gen~ inlets (+ a warning)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicekit-build-'));
  try {
    const voiceSrc = path.join(dir, 'voice.genexpr');
    fs.writeFileSync(voiceSrc, 'out1 = in1;\nout2 = in1;\nout3 = 1;\n');
    const recSrc = path.join(dir, 'recorder.genexpr');
    fs.writeFileSync(recSrc, 'Buffer cap;\nout1 = in1;\n');
    const r = build({ outDir: dir, voiceSrc, recorderSrc: recSrc, quiet: true });
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /in2/);
    assert.deepEqual(validate(r.device), []);
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

test('validator: v2 topology errors', () => {
  const lineIdx = (j, pred) => j.patcher.lines.findIndex((l) => pred(l.patchline, (id) => findBox(j, (b) => b.id === id)));

  // recorder not fed by poly~ R
  let j = clone(device);
  let i = lineIdx(j, (l, box) => (box(l.source[0]).text || '').startsWith('poly~') && l.source[1] === 1 && box(l.destination[0]).text === 'gen~');
  assert.ok(i >= 0);
  j.patcher.lines.splice(i, 1);
  assert.ok(errorsOf(j).some((e) => /poly~ outlet 1 \(R\) -> recorder gen~ inlet 1/.test(e)));

  // glue out4 not wired to the recorder
  j = clone(device);
  i = lineIdx(j, (l, box) => (box(l.source[0]).text || '').startsWith('v8 ') && l.source[1] === 4);
  assert.ok(i >= 0);
  j.patcher.lines.splice(i, 1);
  assert.ok(errorsOf(j).some((e) => /glue outlet 4 -> recorder gen~ inlet 0/.test(e)));

  // glue with 4 outlets / without ---cap
  j = clone(device);
  const g = findBox(j, (b) => /^v8 /.test(b.text || ''));
  g.text = 'v8 slicekit.js ---src ---skstate ---skview';
  assert.ok(errorsOf(j).some((e) => /glue is missing argument ---cap/.test(e)));
  j = clone(device);
  const g2 = findBox(j, (b) => /^v8 /.test(b.text || ''));
  g2.text = 'v8 slicekit.js ---src ---skstate ---cap ---skview';
  assert.ok(errorsOf(j).some((e) => /glue argument 3 must be ---skview/.test(e)));
  j = clone(device);
  const g3 = findBox(j, (b) => /^v8 /.test(b.text || ''));
  j.patcher.lines = j.patcher.lines.filter((l) => !(l.patchline.source[0] === g3.id && l.patchline.source[1] === 4));
  g3.numoutlets = 4;
  g3.outlettype.pop();
  assert.ok(errorsOf(j).some((e) => /glue must have 1 inlet \/ 5 outlets/.test(e)));

  // a capture buffer is missing / has the wrong size
  for (const t of ['buffer~ ---cap 40000 2', 'buffer~ ---capwp 10 1', 'buffer~ ---capout 1000 2']) {
    j = clone(device);
    findBox(j, (b) => b.text === t).text = t + ' 1';
    assert.ok(errorsOf(j).some((e) => e.includes('expected exactly one [' + t + ']')), t);
  }

  // recorder: empty codebox / missing in 2
  j = clone(device);
  const gen = findBox(j, (b) => b.text === 'gen~');
  findBox({ patcher: gen.patcher }, (b) => b.maxclass === 'codebox').code = '  ';
  assert.ok(errorsOf(j).some((e) => /recorder codebox code is empty/.test(e)));
  j = clone(device);
  const gen2 = findBox(j, (b) => b.text === 'gen~');
  const inner = gen2.patcher;
  const in2 = inner.boxes.find((b) => b.box.text === 'in 2').box;
  inner.boxes = inner.boxes.filter((b) => b.box.id !== in2.id);
  inner.lines = inner.lines.filter((l) => l.patchline.source[0] !== in2.id);
  assert.ok(errorsOf(j).some((e) => /recorder gen~ patcher needs exactly one \[in 2\]/.test(e)));

  // poly~ must tap before live.gain~ only: an extra consumer of poly~ L is flagged
  j = clone(device);
  const poly0 = findBox(j, (b) => (b.text || '').startsWith('poly~'));
  const stray = findBox(j, (b) => b.text === 'plugout~');
  j.patcher.lines.push({ patchline: { source: [poly0.id, 0], destination: [stray.id, 0] } });
  assert.ok(errorsOf(j).some((e) => /poly~ outlet 0 feeds unexpected box/.test(e)));
});

test('validator: umenu raw feedback, non-parameter vis, once-filter and dialog chains', () => {
  // umenu fed through [prepend set] instead of raw
  let j = clone(device);
  const um = findBox(j, (b) => b.varname === 'sk_simplers');
  const route = findBox(j, (b) => /^route .*\bsrc_simplers\b/.test(b.text || ''));
  const idx = route.text.split(' ').slice(1).indexOf('src_simplers');
  j.patcher.lines = j.patcher.lines.filter((l) => !(l.patchline.source[0] === route.id && l.patchline.source[1] === idx));
  const ps = findBox(j, (b) => b.text === 'prepend set');
  j.patcher.lines.push({ patchline: { source: [route.id, idx], destination: [ps.id, 0] } });
  j.patcher.lines.push({ patchline: { source: [ps.id, 0], destination: [um.id, 0] } });
  assert.ok(errorsOf(j).some((e) => /sk_simplers: raw feedback route outlet/.test(e)));

  // umenu made a Live parameter
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_simplers').parameter_enable = 1;
  assert.ok(errorsOf(j).some((e) => /sk_simplers: must not be a Live parameter/.test(e)));

  // umenu with the wrong outlet count
  j = clone(device);
  const um2 = findBox(j, (b) => b.varname === 'sk_simplers');
  j.patcher.lines = j.patcher.lines.filter((l) => !(l.patchline.source[0] === um2.id && l.patchline.source[1] === 2));
  um2.numoutlets = 2;
  um2.outlettype = ['int', ''];
  assert.ok(errorsOf(j).some((e) => /sk_simplers: umenu must have 1 inlet \/ 3 outlets/.test(e)));

  // umenu index outlet no longer reaches the glue
  j = clone(device);
  const um3 = findBox(j, (b) => b.varname === 'sk_simplers');
  j.patcher.lines = j.patcher.lines.filter((l) => !(l.patchline.source[0] === um3.id && l.patchline.source[1] === 0));
  assert.ok(errorsOf(j).some((e) => /sk_simplers: no path control -> \.\.\. -> glue passing "source fromsimpler"/.test(e)));

  // Folder...: opendialog removed from the path (button straight to a prepend)
  j = clone(device);
  const dlgBox = findBox(j, (b) => b.text === 'opendialog fold');
  dlgBox.text = 'opendialog sound';
  assert.ok(errorsOf(j).some((e) => /sk_capfolder: no path control -> \.\.\. -> \[opendialog fold\]/.test(e)));

  // button without the once-filter
  j = clone(device);
  const cap = findBox(j, (b) => b.varname === 'sk_capture');
  const once = findBox(j, (b) => b.id === j.patcher.lines.find((l) => l.patchline.source[0] === cap.id).patchline.destination[0]);
  once.text = 'route bang';
  assert.ok(errorsOf(j).some((e) => /sk_capture: button outlet 0 must feed exactly one \[route bang 1\]/.test(e)));

  // new table rows are validated: wrong enum / range / flags
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_capturebars').saved_attribute_attributes.valueof.parameter_enum.pop();
  assert.ok(errorsOf(j).some((e) => /sk_capturebars: parameter_enum/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_gest_ratefrom').saved_attribute_attributes.valueof.parameter_enum[0] = 'none';
  assert.ok(errorsOf(j).some((e) => /sk_gest_ratefrom: parameter_enum/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_gest_cutfrom').saved_attribute_attributes.valueof.parameter_exponent = 1;
  assert.ok(errorsOf(j).some((e) => /sk_gest_cutfrom: \(exp\) needs parameter_exponent/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_morph').saved_attribute_attributes.valueof.parameter_invisible = 2;
  assert.ok(errorsOf(j).some((e) => /sk_morph: parameter_invisible 2 != 0/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_scan').saved_attribute_attributes.valueof.parameter_invisible = 2;
  assert.ok(errorsOf(j).some((e) => /sk_scan: parameter_invisible 2 != 0/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_gest_pitchfrom').saved_attribute_attributes.valueof.parameter_mmin = -24;
  assert.ok(errorsOf(j).some((e) => /sk_gest_pitchfrom: parameter_mmin/.test(e)));
  j = clone(device);
  findBox(j, (b) => b.varname === 'sk_keepclip').mode = 0;
  assert.ok(errorsOf(j).some((e) => /sk_keepclip: mode/.test(e)));
});

test('validator: control table parser handles the v2 rows (raw feedback, em-dash vis, umenu)', () => {
  const table = loadControlTable();
  const row = (v) => table.find((r) => r.varname === v);
  assert.equal(row('sk_simplers').maxclass, 'umenu');
  assert.equal(row('sk_simplers').feedback, 'src_simplers');
  assert.equal(row('sk_simplers').feedbackRaw, true);
  assert.equal(row('sk_simplers').vis, '—');
  assert.equal(row('sk_simplers').sends, 'source fromsimpler <index>');
  assert.equal(row('sk_capfolder').range, '→ opendialog fold');
  assert.equal(row('sk_capfolder').text, 'Folder…');
  assert.equal(row('sk_capturebars').range, 'CAPTURE_BARS');
  assert.equal(row('sk_morph').vis, 'A');
  assert.equal(row('sk_scan').vis, 'A');
  assert.equal(row('sk_gest_sel').range, '1, 2, 3, 4');
  assert.equal(table.filter((r) => r.feedbackRaw).length, 1);
  assert.equal(row('sk_drop').feedback, '');
  const consts = loadConstants();
  assert.deepEqual(consts.CAPTURE_BARS, ['1/2 Bar', '1 Bar', '2 Bars', '4 Bars', '8 Bars']);
  assert.equal(consts.GEST_RATES.length, 9);
  assert.equal(consts.GEST_BEATS_LABELS.length, 7);
});

test('validator: rejects non-patchers', () => {
  assert.deepEqual(validate({}), ['missing top-level "patcher" object']);
  assert.deepEqual(validate(null), ['missing top-level "patcher" object']);
});
