#!/usr/bin/env node
'use strict';

/*
 * build-patchers.js - generates the two Max patchers of SliceKit.
 *
 *   dist/SliceKit.maxpat          device patcher (paste into / save as a Max Instrument)
 *   dist/slicekit.voice.maxpat    poly~ voice abstraction with an embedded gen~ codebox
 *                                 (code read from max/voice.genexpr at build time)
 *
 * The device patcher embeds a second gen~ (the capture recorder, code read from
 * max/recorder.genexpr at build time); a missing source file gives a warning and a silent placeholder.
 *
 * The contract is docs/PROTOCOL.md (patch topology, UI control table, voice wiring).
 * Tooling only: Node 22, modern JS allowed, no dependencies.
 *
 *   node tools/build-patchers.js        build both files into dist/ and validate them
 *
 * API:  build({ outDir, voiceSrc, recorderSrc, quiet }) -> { device, voice, files, warnings, devicewidth }
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'dist');
const DEFAULT_VOICE_SRC = path.join(ROOT, 'max', 'voice.genexpr');
const DEFAULT_RECORDER_SRC = path.join(ROOT, 'max', 'recorder.genexpr');

const DEVICE_HEIGHT = 169;
const NUM_VOICES = 16;
const NUM_BUFFERS = 16;

// Mirrors Model.CONST in docs/ARCHITECTURE.md (validate-patchers.js re-parses the doc).
const BEAT_DIVS = ['1/16', '1/16T', '1/8', '1/8T', '1/4', '1/4T', '1/2', '1/2T', '1 Bar', '2 Bars', '4 Bars'];
const REPEAT_DIVS = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/32T', '1/64'];
const GEST_RATES = ['off'].concat(REPEAT_DIVS);
const GEST_BEATS_LABELS = ['1/16 bar', '1/8 bar', '1 beat', '2 beats', '1 bar', '2 bars', '4 bars'];
const CAPTURE_BARS = ['1/2 Bar', '1 Bar', '2 Bars', '4 Bars', '8 Bars'];

const APP_VERSION = { major: 9, minor: 0, revision: 0, architecture: 'x64', modernui: 1 };

// Max for Live parameter attribute enums
const PTYPE = { float: 0, int: 1, enum: 2, blob: 3 };
const UNIT = { int: 0, float: 1, ms: 2, hz: 3, db: 4, pct: 5, pan: 6, st: 7, note: 8, custom: 9, native: 10 };
const VIS = { A: 0, S: 1, H: 2 }; // A automatable+stored, S stored only (state dict), H hidden

// ------------------------------------------------------------------------------------------------
// Small geometry / text helpers
// ------------------------------------------------------------------------------------------------

/** Rough pixel width of a Max box with this text (Arial 10). Generous on purpose. */
function textWidth(text, minW) {
  return Math.max(minW || 24, Math.ceil(String(text).length * 6.0) + 14);
}

// ------------------------------------------------------------------------------------------------
// Known I/O of built-in objects (checked against docs.cycling74.com; see final report for doubts)
// ------------------------------------------------------------------------------------------------

function ioFor(text) {
  const tok = text.trim().split(/\s+/);
  const name = tok[0];
  const args = tok.slice(1);
  switch (name) {
    case 'midiin': return [1, ['int']];
    case 'midiparse': return [1, ['', '', '', '', '', '', '']];
    case 'prepend': return [2, ['']];
    case 'live.thisdevice': return [1, ['bang', 'int', 'int']];
    case 'opendialog': return [1, ['', 'bang']];
    case 'plugphasor~': return [1, ['signal']];
    case 'plugout~': return [2, []];
    case 'buffer~': return [1, ['float', 'bang']];
    case 'route': return [args.length === 1 ? 2 : 1, new Array(args.length + 1).fill('')];
    case 't': case 'trigger': return [1, args.map((a) => ({ b: 'bang', i: 'int', f: 'float' }[a] || ''))];
    case 'v8': return [1, ['', '', '', '', '']]; // glue: poly~, buffers, controls, jsui, recorder
    case 'dict': return [2, ['dictionary', '', '', 'bang']];
    case 'loadbang': return [1, ['bang']];
    case 'thispoly~': return [1, ['int', 'int', 'int']];
    case 'edge~': return [1, ['bang', 'bang']];
    case 'int': case 'i': return [2, ['int']];
    case 'in': return [0, ['']];
    case 'in~': return [0, ['signal']];
    case 'out~': return [1, []];
    case 'out': return [1, []];
    case 'poly~': return [1, ['signal', 'signal', '']]; // voice patch: in/in~ 1 -> 1 inlet; out~ 1, out~ 2, out 3
    case 'gen~': return [1, ['signal', 'signal', 'signal']]; // voice; the recorder gen~ is built with newobj()
    default: throw new Error('build-patchers: no I/O entry for object "' + name + '"');
  }
}

// ------------------------------------------------------------------------------------------------
// Patcher builder
// ------------------------------------------------------------------------------------------------

class Patcher {
  constructor(opts) {
    opts = opts || {};
    this.classnamespace = opts.classnamespace || 'box';
    this.rect = opts.rect || [50, 80, 1500, 900];
    this.boxes = [];
    this.lines = [];
    this._n = 0;
  }

  _add(box) {
    const b = Object.assign({ id: 'obj-' + (++this._n) }, box);
    this.boxes.push(b);
    return b;
  }

  _present(b, pres) {
    if (pres) {
      b.presentation = 1;
      b.presentation_rect = pres;
    }
    return b;
  }

  /** newobj(text, ins, outs, outlettype, rect, extra) */
  newobj(text, ins, outs, outlettype, rect, extra) {
    const b = {
      maxclass: 'newobj', text, numinlets: ins, numoutlets: outs,
    };
    if (outs > 0) b.outlettype = outlettype && outlettype.length === outs ? outlettype : new Array(outs).fill('');
    b.patching_rect = rect;
    return this._add(Object.assign(b, extra || {}));
  }

  /** newobj with the I/O looked up in the table above. */
  obj(text, rect, extra) {
    const io = ioFor(text);
    if (!rect[2]) rect = [rect[0], rect[1], textWidth(text), rect[3] || 22];
    return this.newobj(text, io[0], io[1].length, io[1], rect, extra);
  }

  msg(text, rect) {
    const r = rect.length === 2 ? [rect[0], rect[1], textWidth(text, 30), 22] : rect;
    return this._add({
      maxclass: 'message', text, numinlets: 2, numoutlets: 1, outlettype: [''], patching_rect: r,
    });
  }

  comment(text, rect, extra) {
    const r = rect.length === 2 ? [rect[0], rect[1], textWidth(text), 20] : rect;
    return this._add(Object.assign({
      maxclass: 'comment', text, numinlets: 1, numoutlets: 0, patching_rect: r,
    }, extra || {}));
  }

  // ---- Max for Live UI objects ----------------------------------------------------------------

  _live(maxclass, ins, types, s, rect, pres, extra) {
    const b = {
      maxclass, numinlets: ins, numoutlets: types.length, outlettype: types,
      parameter_enable: 1, patching_rect: rect,
    };
    this._present(b, pres);
    b.saved_attribute_attributes = { valueof: valueOf(s) };
    b.varname = s.v;
    return this._add(Object.assign(b, extra || {}));
  }

  liveDial(s, rect, pres) {
    return this._live('live.dial', 1, ['', 'float'], s, rect, pres);
  }

  liveTab(s, rect, pres) {
    return this._live('live.tab', 1, ['', '', 'float'], s, rect, pres, {
      num_lines_patching: 1, num_lines_presentation: 1, fontsize: 9.0,
    });
  }

  liveMenu(s, rect, pres) {
    return this._live('live.menu', 1, ['', '', 'float'], s, rect, pres, { fontsize: 9.0 });
  }

  liveNumbox(s, rect, pres) {
    return this._live('live.numbox', 1, ['', 'float'], s, rect, pres, { fontsize: 9.0 });
  }

  /** live.text: s.t === 'button' -> mode 0, 'toggle' -> mode 1 */
  liveText(s, rect, pres) {
    return this._live('live.text', 1, ['', ''], s, rect, pres, {
      mode: s.t === 'toggle' ? 1 : 0, text: s.text, texton: s.text, fontsize: 9.0,
    });
  }

  /**
   * Classic umenu (not a Live parameter). Outlets: 0 = item index (int), 1 = item text, 2 = dumpout.
   * The glue fills it with raw `clear` / `append <item>` messages.
   */
  umenu(s, rect, pres) {
    const b = {
      maxclass: 'umenu', numinlets: 1, numoutlets: 3, outlettype: ['int', '', ''],
      parameter_enable: 0, fontsize: 9.0, patching_rect: rect,
    };
    this._present(b, pres);
    b.varname = s.v;
    return this._add(b);
  }

  liveDrop(s, rect, pres) {
    const b = {
      maxclass: 'live.drop', numinlets: 1, numoutlets: 2, outlettype: ['', ''],
      parameter_enable: 0, patching_rect: rect,
    };
    this._present(b, pres);
    b.varname = s.v;
    return this._add(b);
  }

  liveGain(s, rect, pres) {
    return this._live('live.gain~', 2, ['signal', 'signal', '', 'float', ''], s, rect, pres, { channels: 2 });
  }

  jsui(s, filename, rect, pres) {
    const b = {
      maxclass: 'jsui', filename, numinlets: 1, numoutlets: 1, outlettype: [''],
      parameter_enable: 0, patching_rect: rect,
    };
    this._present(b, pres);
    b.varname = s.v;
    return this._add(b);
  }

  /** Subtle rounded background panel (translucent grey works on every Live theme). */
  panel(pres, rect) {
    return this._add(this._present({
      maxclass: 'panel', background: 1, border: 1, rounded: 8, mode: 0,
      bgcolor: [0.5, 0.5, 0.5, 0.1], bordercolor: [0.5, 0.5, 0.5, 0.28],
      numinlets: 1, numoutlets: 0, patching_rect: rect,
    }, pres));
  }

  liveComment(text, pres, rect, opts) {
    opts = opts || {};
    return this._add(this._present({
      maxclass: 'live.comment', text, fontsize: opts.fontsize || 9.0, textjustification: opts.just || 0,
      numinlets: 1, numoutlets: 0, patching_rect: rect,
    }, pres));
  }

  /** gen~ codebox (dsp.gen patchers only). */
  codebox(code, nIn, nOut, rect) {
    return this._add({
      maxclass: 'codebox', code, fontface: 0, fontname: '<Monospaced>', fontsize: 12.0,
      numinlets: nIn, numoutlets: nOut, outlettype: new Array(nOut).fill(''), patching_rect: rect,
    });
  }

  connect(a, outlet, b, inlet) {
    if (a.maxclass === undefined || b.maxclass === undefined) throw new Error('connect: pass boxes');
    if (!(outlet < a.numoutlets)) {
      throw new Error('connect: outlet ' + outlet + ' out of range for ' + a.id + ' (' + (a.text || a.maxclass) + ')');
    }
    if (!(inlet < b.numinlets)) {
      throw new Error('connect: inlet ' + inlet + ' out of range for ' + b.id + ' (' + (b.text || b.maxclass) + ')');
    }
    this.lines.push({ patchline: { source: [a.id, outlet], destination: [b.id, inlet] } });
  }

  toJSON(props) {
    return {
      patcher: Object.assign({
        fileversion: 1,
        appversion: APP_VERSION,
        classnamespace: this.classnamespace,
        rect: this.rect,
      }, props || {}, {
        boxes: this.boxes.map((b) => ({ box: b })),
        lines: this.lines,
      }),
    };
  }
}

/** saved_attribute_attributes.valueof for a control spec (see CONTROLS). */
function valueOf(s) {
  const v = { parameter_longname: s.name, parameter_shortname: s.short || s.name };
  const enumItems = s.t === 'tab' || s.t === 'menu' ? s.items
    : (s.t === 'toggle' || s.t === 'button' ? ['off', 'on'] : null);
  if (enumItems) {
    v.parameter_type = PTYPE.enum;
    v.parameter_enum = enumItems;
    v.parameter_mmax = enumItems.length - 1;
  } else {
    v.parameter_type = PTYPE[s.ptype || 'float'];
    v.parameter_mmin = s.min;
    v.parameter_mmax = s.max;
    v.parameter_unitstyle = UNIT[s.unit || 'float'];
    if (s.units) v.parameter_units = s.units;
    if (s.exp) v.parameter_exponent = s.exp;
  }
  if (s.init !== undefined) {
    v.parameter_initial_enable = 1;
    v.parameter_initial = [s.init];
  }
  v.parameter_invisible = VIS[s.vis];
  return v;
}

// ------------------------------------------------------------------------------------------------
// Control table (mirror of PROTOCOL.md "UI controls"; validate-patchers.js checks it against the doc)
//   t: dial | tab | menu | numbox | toggle | button | umenu | drop | gain | jsui
//   send: text of [prepend ...] (dial/tab/menu/numbox/toggle/umenu) or of the [message( box (button)
//   fb: feedback name routed from glue outlet 2 -> [prepend set] -> control
//       (raw: true -> the route outlet goes straight into the control, no [prepend set])
//   vis: A (automatable) | H (hidden) | '-' (not a Live parameter). init is only given to automatable params.
// ------------------------------------------------------------------------------------------------

const dial = (v, name, short, min, max, send, fb, o) => Object.assign(
  { v, t: 'dial', name, short, min, max, send, fb, vis: 'H', ptype: 'float', unit: 'float' }, o);
const numbox = (v, name, short, min, max, send, fb, o) => Object.assign(
  { v, t: 'numbox', name, short, min, max, send, fb, vis: 'H', ptype: 'int', unit: 'int' }, o);
const tab = (v, name, short, items, send, fb, o) => Object.assign(
  { v, t: 'tab', name, short, items, send, fb, vis: 'H' }, o);
const menu = (v, name, short, items, send, fb, o) => Object.assign(
  { v, t: 'menu', name, short, items, send, fb, vis: 'H' }, o);
const toggle = (v, name, text, send, fb, o) => Object.assign(
  { v, t: 'toggle', name, short: text, text, send, fb, vis: 'H' }, o);
const button = (v, name, text, send, o) => Object.assign(
  { v, t: 'button', name, short: text, text, send, vis: 'H' }, o);
// umenu: not a Live parameter; `fb` is a raw feedback (route outlet -> umenu inlet, no [prepend set])
const umenu = (v, send, fb) => ({ v, t: 'umenu', send, fb, raw: true, vis: '-' });

const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const SAMPLE_CONTROLS = [
  tab('sk_src_playmode', 'Sample Play Mode', 'Play', ['Mono', 'Poly', 'Thru'], 'source playmode', 'src_playmode'),
  tab('sk_src_trigmode', 'Sample Trig Mode', 'Trig', ['Trig', 'Gate'], 'source trigmode', 'src_trigmode'),
  menu('sk_src_slicemode', 'Slice Mode', 'Slice', ['Transient', 'Beat', 'Region', 'Manual'], 'source slicemode', 'src_slicemode'),
  dial('sk_src_sens', 'Slice Sensitivity', 'Sens', 0, 100, 'source sensitivity', 'src_sensitivity', { unit: 'pct' }),
  menu('sk_src_beatdiv', 'Slice Beat Division', 'Beat Div', BEAT_DIVS, 'source beatdiv', 'src_beatdiv'),
  numbox('sk_src_regions', 'Slice Regions', 'Regions', 2, 128, 'source regions', 'src_regions'),
  numbox('sk_src_bpm', 'Slice BPM', 'BPM', 0, 250, 'source bpm', 'src_bpm', { ptype: 'float', unit: 'float' }),
  numbox('sk_src_minslice', 'Slice Min Length', 'Min Slice', 5, 500, 'source minslice', 'src_minslice', { unit: 'ms' }),
  toggle('sk_src_snap', 'Slice Snap', 'Snap', 'source snap', 'src_snap'),
  button('sk_src_reslice', 'Slice Reslice', 'Reslice', 'source reslice'),
  button('sk_src_remove', 'Sample Remove', 'Remove', 'source remove'),
  button('sk_simplerscan', 'Find Simplers', 'Find Simplers', 'source simplerscan'),
  umenu('sk_simplers', 'source fromsimpler', 'src_simplers'),
];

const PAD_CONTROLS = [
  toggle('sk_pad_reverse', 'Pad Reverse', 'Rev', 'pad reverse', 'pad_reverse'),
  dial('sk_pad_pitch', 'Pad Pitch', 'Pitch', -48, 48, 'pad pitch', 'pad_pitch', { ptype: 'int', unit: 'st' }),
  dial('sk_pad_fine', 'Pad Fine', 'Fine', -100, 100, 'pad fine', 'pad_fine', { ptype: 'int', unit: 'custom', units: 'ct' }),
  dial('sk_pad_gain', 'Pad Gain', 'Gain', -60, 12, 'pad gain', 'pad_gain', { unit: 'db' }),
  dial('sk_pad_attack', 'Pad Attack', 'Atk', 0, 2000, 'pad attack', 'pad_attack', { unit: 'ms', exp: 3 }),
  dial('sk_pad_decay', 'Pad Decay', 'Dec', 0, 5000, 'pad decay', 'pad_decay', { unit: 'ms', exp: 3 }),
  dial('sk_pad_sustain', 'Pad Sustain', 'Sus', 0, 100, 'pad sustain', 'pad_sustain', { unit: 'pct' }),
  dial('sk_pad_release', 'Pad Release', 'Rel', 0, 5000, 'pad release', 'pad_release', { unit: 'ms', exp: 3 }),
  dial('sk_pad_start', 'Pad Start', 'Start', 0, 1000, 'pad start', 'pad_start', { unit: 'ms' }),
  toggle('sk_pad_loop', 'Pad Loop', 'Loop', 'pad loop', 'pad_loop'),
  dial('sk_pad_loopsize', 'Pad Loop Size', 'LpSize', 1, 500, 'pad loopsize', 'pad_loopsize', { unit: 'ms', exp: 3 }),
  dial('sk_pad_looppos', 'Pad Loop Pos', 'LpPos', 0, 100, 'pad looppos', 'pad_looppos', { unit: 'pct' }),
  dial('sk_pad_cutoff', 'Pad Cutoff', 'Cutoff', 20, 20000, 'pad cutoff', 'pad_cutoff', { unit: 'hz', exp: 3 }),
  dial('sk_pad_drive', 'Pad Drive', 'Drive', 0, 100, 'pad drive', 'pad_drive', { unit: 'pct' }),
  toggle('sk_pad_lock', 'Pad Lock', 'Lock', 'pad lock', 'pad_lock'),
  button('sk_pad_simprev', 'Pad Similar Prev', '‹ Sim', 'pad similar -1'),
  button('sk_pad_simnext', 'Pad Similar Next', 'Sim ›', 'pad similar 1'),
  toggle('sk_pad_layer', 'Pad Layer Arm', 'Layer', 'pad layerarm', 'pad_layerarm'),
  toggle('sk_pad_dup', 'Pad Duplicate Arm', 'Dup', 'pad duparm', 'pad_duparm'),
  menu('sk_pad_spreadparam', 'Spread Param', 'Spread', ['Pitch', 'Decay', 'Start', 'Cutoff'], 'pad spreadparam', 'pad_spreadparam'),
  numbox('sk_pad_spreadcount', 'Spread Count', 'Count', 2, 16, 'pad spreadcount', 'pad_spreadcount'),
  numbox('sk_pad_spreadstep', 'Spread Step', 'Step', -24, 24, 'pad spreadstep', 'pad_spreadstep', { ptype: 'float', unit: 'float' }),
  button('sk_pad_spread', 'Pad Spread', 'Spread', 'pad spread'),
  button('sk_pad_apply', 'Pad Apply To Sample', '→ Sample', 'pad applysource'),
  button('sk_pad_clear', 'Pad Clear', 'Clear', 'pad clear'),
];

// PERFORM first (the five automatable kit params + slot), then the hidden KIT params
const PERFORM_CONTROLS = [
  tab('sk_slot', 'Slot', 'Slot', SLOTS, 'kit slot', 'kit_slot', { vis: 'A', init: 0 }),
  dial('sk_chaos', 'Chaos', 'Chaos', 0, 100, 'kit chaos', null, { vis: 'A', unit: 'pct', init: 0 }),
  toggle('sk_repeat', 'Repeat', 'Repeat', 'kit repeat', null, { vis: 'A', init: 0 }),
  menu('sk_rate', 'Rate', 'Rate', REPEAT_DIVS, 'kit rate', null, { vis: 'A', init: 3 }),
  dial('sk_swing', 'Swing', 'Swing', 0, 100, 'kit swing', null, { vis: 'A', unit: 'pct', init: 0 }),
  toggle('sk_alt', 'Alt', 'Alt', 'kit alt', null, { vis: 'A', init: 0 }),
];

const KIT_CONTROLS = [
  menu('sk_copyslot', 'Copy Slot To', 'Copy', SLOTS.map((s) => 'Copy→' + s), 'kit copyslot', null),
  menu('sk_layout', 'Kit Layout', 'Layout', ['Zones', 'Interleave', 'Sorted'], 'kit layout', 'kit_layout'),
  toggle('sk_zonealign', 'Kit Zone Align', 'Oct', 'kit zonealign', 'kit_zonealign'),
  menu('sk_sortby', 'Kit Sort By', 'Sort', ['Bright', 'Loud', 'Length'], 'kit sortby', 'kit_sortby'),
  numbox('sk_root', 'Kit Root Key', 'Root', 0, 127, 'kit root', 'kit_root', { unit: 'note' }),
  button('sk_relayout', 'Kit Relayout', 'Layout', 'kit relayout'),
  button('sk_shuffle', 'Kit Shuffle', 'Shuffle', 'kit shuffle'),
  tab('sk_shufflemode', 'Shuffle Mode', 'Mode', ['Chaos', 'Smart'], 'kit shufflemode', 'kit_shufflemode'),
  tab('sk_shufflescope', 'Shuffle Scope', 'Scope', ['All', 'Sample'], 'kit shufflescope', 'kit_shufflescope'),
  numbox('sk_seed', 'Shuffle Seed', 'Seed', 0, 9999, 'kit seed', 'kit_seed'),
  dial('sk_flip', 'Shuffle Flip', 'Flip', 0, 100, 'kit flip', 'kit_flip', { unit: 'pct' }),
  button('sk_undo', 'Kit Undo', 'Undo', 'kit undo'),
  button('sk_redo', 'Kit Redo', 'Redo', 'kit redo'),
  numbox('sk_bestn', 'Find Best N', 'Best N', 4, 64, 'kit bestn', 'kit_bestn'),
  button('sk_best', 'Kit Find Best', 'Find best', 'kit findbest'),
  tab('sk_chokescope', 'Choke Scope', 'Choke', ['Sample', 'All'], 'kit chokescope', 'kit_chokescope'),
  toggle('sk_modzone', 'Mod Zone', 'Mods', 'kit modzone', 'kit_modzone'),
  numbox('sk_modstart', 'Mod Zone Start', 'Mod Start', 0, 112, 'kit modstart', 'kit_modstart', { unit: 'note' }),
  dial('sk_velsens', 'Velocity Sens', 'Vel', 0, 100, 'kit velsens', 'kit_velsens', { unit: 'pct' }),
  toggle('sk_pressure', 'Pressure To Level', 'Press', 'kit pressure2level', 'kit_pressure2level'),
];

// MORPH / SCAN (two automatable dials + the B-values editing buttons), CAPTURE and the clip helpers
const MORPH_CONTROLS = [
  dial('sk_morph', 'Morph', 'Morph', 0, 100, 'kit morph', null, { vis: 'A', unit: 'pct', init: 0 }),
  dial('sk_scan', 'Scan', 'Scan', 0, 100, 'kit scan', null, { vis: 'A', unit: 'pct', init: 0 }),
  toggle('sk_morphedit', 'Morph Edit B', 'Edit B', 'kit morphedit', 'kit_morphedit'),
  button('sk_morphcopy', 'Morph Copy A To B', 'A→B', 'pad morphcopy'),
  button('sk_morphclear', 'Morph Clear B', 'Clr B', 'pad morphclear'),
  button('sk_morphcopyall', 'Morph Copy All A To B', 'All A→B', 'kit morphcopyall'),
  button('sk_morphclearall', 'Morph Clear All B', 'All Clr B', 'kit morphclearall'),
];

const CAPTURE_CONTROLS = [
  button('sk_capture', 'Capture', 'Capture', 'kit capture'),
  menu('sk_capturebars', 'Capture Length', 'Cap Bars', CAPTURE_BARS, 'kit capturebars', 'kit_capturebars'),
  toggle('sk_keepclip', 'Keep Clip', 'Keep clip', 'kit keepclip', 'kit_keepclip'),
  button('sk_remapclip', 'Remap Clip', 'Remap clip', 'kit remapclip'),
];

// GESTURE editor: select tab + one set of editors for the selected gesture
const GESTURE_CONTROLS = [
  tab('sk_gest_sel', 'Gesture Select', 'Gesture', ['1', '2', '3', '4'], 'gest sel', 'gest_sel'),
  menu('sk_gest_beats', 'Gesture Length', 'Length', GEST_BEATS_LABELS, 'gest beats', 'gest_beats'),
  menu('sk_gest_ratefrom', 'Gesture Rate From', 'Rate From', GEST_RATES, 'gest ratefrom', 'gest_ratefrom'),
  menu('sk_gest_rateto', 'Gesture Rate To', 'Rate To', GEST_RATES, 'gest rateto', 'gest_rateto'),
  dial('sk_gest_cutfrom', 'Gesture Cutoff From', 'From', 20, 20000, 'gest cutfrom', 'gest_cutfrom', { unit: 'hz', exp: 3 }),
  dial('sk_gest_cutto', 'Gesture Cutoff To', 'To', 20, 20000, 'gest cutto', 'gest_cutto', { unit: 'hz', exp: 3 }),
  dial('sk_gest_pitchfrom', 'Gesture Pitch From', 'From', -48, 48, 'gest pitchfrom', 'gest_pitchfrom', { ptype: 'int', unit: 'st' }),
  dial('sk_gest_pitchto', 'Gesture Pitch To', 'To', -48, 48, 'gest pitchto', 'gest_pitchto', { ptype: 'int', unit: 'st' }),
  dial('sk_gest_ampfrom', 'Gesture Amp From', 'From', 0, 100, 'gest ampfrom', 'gest_ampfrom', { unit: 'pct' }),
  dial('sk_gest_ampto', 'Gesture Amp To', 'To', 0, 100, 'gest ampto', 'gest_ampto', { unit: 'pct' }),
  dial('sk_gest_curve', 'Gesture Curve', 'Curve', 0, 100, 'gest curve', 'gest_curve', { unit: 'pct' }),
];

const SPECIAL = {
  drop: { v: 'sk_drop', t: 'drop' },
  load: button('sk_load', 'Load Sample', 'Load', 'load'),
  capfolder: button('sk_capfolder', 'Capture Folder', 'Folder…', 'kit capturefolder'),
  ui: { v: 'sk_ui', t: 'jsui' },
  out: { v: 'sk_out', t: 'gain', name: 'Output', short: 'Output', min: -70, max: 6, ptype: 'float', unit: 'db', vis: 'A', init: 0 },
};

const GRID_CONTROLS = SAMPLE_CONTROLS.concat(PAD_CONTROLS, PERFORM_CONTROLS, KIT_CONTROLS,
  MORPH_CONTROLS, CAPTURE_CONTROLS, GESTURE_CONTROLS);

// ------------------------------------------------------------------------------------------------
// Presentation layout (device is 169 px high; everything below is absolute device coordinates)
// ------------------------------------------------------------------------------------------------

function presentationLayout() {
  const pres = {};
  const panels = [];
  const titles = [];
  const labels = [];
  const H = DEVICE_HEIGHT;

  // a panel + its title; y0/h default to the full device height (stacked panels pass their own)
  const section = (ox, w, title, y0, h) => {
    y0 = y0 === undefined ? 2 : y0;
    h = h === undefined ? H - 4 : h;
    panels.push([ox, y0, w, h]);
    titles.push({ text: title, rect: [ox + 6, y0 + 2, Math.max(40, w - 12), 13] });
  };
  const put = (v, ox, x, y, w, h) => { pres[v] = [ox + x, y, w, h]; };
  const label = (text, ox, x, y, w, h) => labels.push({ text, rect: [ox + x, y, w, h || 12] });

  let ox = 2;

  // --- left block: drop zone, Load, Remove -----------------------------------------------------
  section(ox, 84, 'DROP SAMPLES');
  put('sk_drop', ox, 2, 19, 80, 88);
  put('sk_load', ox, 2, 111, 80, 18);
  put('sk_src_remove', ox, 2, 133, 80, 18);
  ox += 84 + 4;

  // --- jsui view -------------------------------------------------------------------------------
  pres.sk_ui = [ox, 3, 600, 160];
  ox += 600 + 4;

  // --- SAMPLE ----------------------------------------------------------------------------------
  const sampleX = ox;
  section(ox, 244, 'SAMPLE');
  put('sk_src_playmode', ox, 6, 22, 108, 18);
  put('sk_src_trigmode', ox, 118, 22, 72, 18);
  put('sk_src_sens', ox, 198, 22, 41, 48);
  label('Slice by', ox, 6, 64, 78);
  label('Beat div', ox, 88, 64, 58);
  label('Regions', ox, 150, 64, 44);
  put('sk_src_slicemode', ox, 6, 77, 78, 17);
  put('sk_src_beatdiv', ox, 88, 77, 58, 17);
  put('sk_src_regions', ox, 150, 77, 40, 15);
  label('BPM', ox, 6, 106, 40);
  label('Min ms', ox, 50, 106, 40);
  put('sk_src_bpm', ox, 6, 119, 40, 15);
  put('sk_src_minslice', ox, 50, 119, 40, 15);
  put('sk_src_snap', ox, 94, 118, 44, 16);
  put('sk_src_reslice', ox, 142, 118, 56, 16);
  put('sk_simplerscan', ox, 6, 142, 70, 16);
  put('sk_simplers', ox, 80, 142, 158, 17);
  ox += 244 + 4;

  // --- PAD -------------------------------------------------------------------------------------
  section(ox, 356, 'PAD');
  ['sk_pad_pitch', 'sk_pad_fine', 'sk_pad_gain', 'sk_pad_start',
    'sk_pad_attack', 'sk_pad_decay', 'sk_pad_sustain', 'sk_pad_release'].forEach((v, i) => {
    put(v, ox, 6 + i * 43, 18, 41, 48);
  });
  ['sk_pad_loopsize', 'sk_pad_looppos', 'sk_pad_cutoff', 'sk_pad_drive'].forEach((v, i) => {
    put(v, ox, 6 + i * 43, 68, 41, 48);
  });
  label('Spread', ox, 184, 68, 54);
  label('Count', ox, 242, 68, 38);
  label('Step', ox, 284, 68, 38);
  put('sk_pad_spreadparam', ox, 184, 81, 54, 17);
  put('sk_pad_spreadcount', ox, 242, 81, 38, 15);
  put('sk_pad_spreadstep', ox, 284, 81, 38, 15);
  put('sk_pad_spread', ox, 184, 102, 54, 16);
  ['sk_pad_reverse', 'sk_pad_loop', 'sk_pad_lock', 'sk_pad_layer', 'sk_pad_dup'].forEach((v, i) => {
    put(v, ox, 6 + i * 48, 122, 46, 16);
  });
  put('sk_pad_simprev', ox, 6, 142, 46, 16);
  put('sk_pad_simnext', ox, 54, 142, 46, 16);
  put('sk_pad_apply', ox, 102, 142, 60, 16);
  put('sk_pad_clear', ox, 166, 142, 46, 16);
  ox += 356 + 4;

  // --- KIT -------------------------------------------------------------------------------------
  section(ox, 330, 'KIT');
  label('Arrange', ox, 6, 18, 70);
  label('Sort by', ox, 80, 18, 56);
  label('Root', ox, 178, 18, 40);
  put('sk_layout', ox, 6, 31, 70, 17);
  put('sk_sortby', ox, 80, 31, 56, 17);
  put('sk_zonealign', ox, 140, 31, 34, 16);
  put('sk_root', ox, 178, 31, 40, 15);
  put('sk_relayout', ox, 222, 31, 48, 16);
  label('Seed', ox, 202, 50, 40);
  put('sk_shuffle', ox, 6, 64, 52, 18);
  put('sk_shufflemode', ox, 62, 64, 66, 18);
  put('sk_shufflescope', ox, 132, 64, 66, 18);
  put('sk_seed', ox, 202, 66, 40, 15);
  put('sk_undo', ox, 246, 64, 36, 16);
  put('sk_redo', ox, 286, 64, 36, 16);
  put('sk_flip', ox, 6, 92, 41, 48);
  put('sk_velsens', ox, 50, 92, 41, 48);
  label('Best N', ox, 100, 92, 40);
  label('Mod start', ox, 262, 92, 60);
  put('sk_bestn', ox, 100, 105, 40, 15);
  put('sk_best', ox, 144, 103, 60, 18);
  put('sk_modzone', ox, 214, 103, 44, 16);
  put('sk_modstart', ox, 262, 105, 40, 15);
  label('Choke', ox, 100, 126, 50);
  label('Copy slot to', ox, 240, 126, 80);
  put('sk_chokescope', ox, 100, 139, 84, 18);
  put('sk_pressure', ox, 190, 139, 44, 16);
  put('sk_copyslot', ox, 240, 139, 80, 17);
  ox += 330 + 4;

  // --- PERFORM ---------------------------------------------------------------------------------
  section(ox, 180, 'PERFORM');
  put('sk_slot', ox, 6, 22, 168, 20);
  put('sk_chaos', ox, 6, 52, 41, 48);
  put('sk_swing', ox, 52, 52, 41, 48);
  put('sk_repeat', ox, 102, 52, 72, 18);
  label('Rate', ox, 102, 74, 72);
  put('sk_rate', ox, 102, 87, 72, 17);
  put('sk_alt', ox, 102, 108, 72, 16);
  label('Rewrite clip on map change', ox, 6, 128, 168);
  put('sk_keepclip', ox, 6, 141, 84, 16);
  put('sk_remapclip', ox, 94, 141, 80, 16);
  ox += 180 + 4;

  // --- MORPH / SCAN (top) + CAPTURE (bottom), one stacked column --------------------------------
  section(ox, 176, 'MORPH / SCAN', 2, 110);
  put('sk_morph', ox, 6, 19, 41, 48);
  put('sk_scan', ox, 50, 19, 41, 48);
  put('sk_morphedit', ox, 98, 21, 70, 18);
  put('sk_morphcopy', ox, 6, 72, 80, 16);
  put('sk_morphclear', ox, 90, 72, 80, 16);
  put('sk_morphcopyall', ox, 6, 92, 80, 16);
  put('sk_morphclearall', ox, 90, 92, 80, 16);
  section(ox, 176, 'CAPTURE', 114, 53);
  put('sk_capture', ox, 6, 137, 52, 18);
  put('sk_capturebars', ox, 62, 137, 58, 17);
  put('sk_capfolder', ox, 124, 137, 46, 18);
  ox += 176 + 4;

  // --- GESTURE ---------------------------------------------------------------------------------
  section(ox, 322, 'GESTURE');
  label('Gesture', ox, 6, 19, 100);
  label('Length', ox, 110, 19, 68);
  label('Rate from', ox, 182, 19, 62);
  label('Rate to', ox, 248, 19, 62);
  put('sk_gest_sel', ox, 6, 32, 100, 18);
  put('sk_gest_beats', ox, 110, 32, 68, 17);
  put('sk_gest_ratefrom', ox, 182, 32, 62, 17);
  put('sk_gest_rateto', ox, 248, 32, 62, 17);
  label('Cutoff', ox, 6, 56, 84);
  label('Pitch', ox, 96, 56, 84);
  label('Amp', ox, 186, 56, 84);
  label('Curve', ox, 276, 56, 41);
  put('sk_gest_cutfrom', ox, 6, 70, 41, 48);
  put('sk_gest_cutto', ox, 49, 70, 41, 48);
  put('sk_gest_pitchfrom', ox, 96, 70, 41, 48);
  put('sk_gest_pitchto', ox, 139, 70, 41, 48);
  put('sk_gest_ampfrom', ox, 186, 70, 41, 48);
  put('sk_gest_ampto', ox, 229, 70, 41, 48);
  put('sk_gest_curve', ox, 276, 70, 41, 48);
  label('Hold a gesture key (G1-G4 in the Mods zone): the sweep runs From -> To over Length, Curve bends the ramp.',
    ox, 6, 126, 310, 36);
  ox += 322 + 4;

  // --- Output ----------------------------------------------------------------------------------
  section(ox, 48, '');
  titles.pop(); // no title for the output strip
  put('sk_out', ox, 4, 4, 40, 161);
  ox += 48;

  return { pres, panels, titles, labels, sampleX, devicewidth: ox + 2 };
}

// ------------------------------------------------------------------------------------------------
// Device patcher
// ------------------------------------------------------------------------------------------------

const GRID_X0 = 400; // patching grid columns start here (inputs live in the column to the left)
const COL_W = 176;
const COLS = 7;

function buildDevice(recorderCode, warnings) {
  const p = new Patcher({ rect: [50, 80, 1500, 900] });
  const lay = presentationLayout();
  const size = (v) => [lay.pres[v][2], lay.pres[v][3]];
  const specs = {};
  GRID_CONTROLS.concat([SPECIAL.drop, SPECIAL.load, SPECIAL.capfolder, SPECIAL.ui, SPECIAL.out])
    .forEach((s) => { specs[s.v] = s; });

  // glue first (everything feeds it); its position is fixed once the grid height is known.
  // Arguments: buffer prefix, state dict, view dict, capture ring buffer name. 5 outlets (4 = recorder).
  const glue = p.obj('v8 slicekit.js ---src ---skstate ---skview ---cap', [GRID_X0, 0, 380, 22]);

  // ---- INPUTS (left column) -----------------------------------------------------------------
  p.comment('INPUTS  (everything below feeds inlet 0 of the glue)', [20, 14, 340, 20]);

  const thisdev = p.obj('live.thisdevice', [20, 44, 120, 22]);
  const init = p.msg('init', [20, 78, 40, 22]);
  p.connect(thisdev, 0, init, 0);
  p.connect(init, 0, glue, 0);

  p.comment('MIDI', [20, 116, 60, 20]);
  const midiin = p.obj('midiin', [20, 138, 56, 22]);
  const midiparse = p.obj('midiparse', [20, 168, 250, 22]);
  p.connect(midiin, 0, midiparse, 0);
  const pNote = p.obj('prepend note', [20, 204, 0, 22]);
  const pPoly = p.obj('prepend polypressure', [112, 204, 0, 22]);
  const pPress = p.obj('prepend pressure', [252, 204, 0, 22]);
  p.connect(midiparse, 0, pNote, 0);
  p.connect(midiparse, 1, pPoly, 0);
  p.connect(midiparse, 4, pPress, 0);
  [pNote, pPoly, pPress].forEach((b) => p.connect(b, 0, glue, 0));

  p.comment('DROP / LOAD', [20, 252, 120, 20]);
  const drop = p.liveDrop(SPECIAL.drop, [20, 274, 80, 40], lay.pres.sk_drop);
  const pDrop = p.obj('prepend drop', [20, 328, 0, 22]);
  p.connect(drop, 0, pDrop, 0);
  p.connect(pDrop, 0, glue, 0);

  // button -> [route bang 1] (once per click) -> [opendialog <type>] -> [prepend <msg>] -> glue
  const dialogChain = (spec, y, dlgText, prependText) => {
    const btn = p.liveText(spec, [20, y, 80, 18], lay.pres[spec.v]);
    const once = p.obj('route bang 1', [110, y, 0, 22]);
    const dialog = p.obj(dlgText, [20, y + 32, 0, 22]);
    const pre = p.obj(prependText, [20, y + 68, 0, 22]);
    p.connect(btn, 0, once, 0);
    p.connect(once, 0, dialog, 0);
    p.connect(once, 1, dialog, 0);
    p.connect(dialog, 0, pre, 0);
    p.connect(pre, 0, glue, 0);
    return btn;
  };
  dialogChain(SPECIAL.load, 372, 'opendialog sound', 'prepend load');
  p.comment('CAPTURE FOLDER  (folder chooser)', [20, 484, 220, 20]);
  dialogChain(SPECIAL.capfolder, 508, 'opendialog fold', 'prepend kit capturefolder');

  // ---- CONTROL BANDS (grid) -----------------------------------------------------------------
  const routes = []; // { box, names }
  const controlBoxes = {};
  const makeControl = (c, rect) => {
    const pr = lay.pres[c.v];
    switch (c.t) {
      case 'dial': return p.liveDial(c, rect, pr);
      case 'tab': return p.liveTab(c, rect, pr);
      case 'menu': return p.liveMenu(c, rect, pr);
      case 'numbox': return p.liveNumbox(c, rect, pr);
      case 'toggle': case 'button': return p.liveText(c, rect, pr);
      case 'umenu': return p.umenu(c, rect, pr);
      default: throw new Error('unknown control type ' + c.t);
    }
  };

  const bands = [
    { title: 'SAMPLE  - source <param>   (feedback src_* -> prepend set; src_simplers -> umenu directly)', list: SAMPLE_CONTROLS },
    { title: 'PAD  - pad <param>   (feedback pad_* -> prepend set)', list: PAD_CONTROLS },
    { title: 'PERFORM + KIT  - kit <param>   (feedback kit_* -> prepend set)', list: PERFORM_CONTROLS.concat(KIT_CONTROLS) },
    {
      title: 'MORPH / SCAN / CAPTURE / CLIP  - kit|pad <param>   (feedback kit_* -> prepend set; Folder... is in the INPUTS column)',
      list: MORPH_CONTROLS.concat(CAPTURE_CONTROLS),
    },
    { title: 'GESTURE  - gest <param>   (feedback gest_* -> prepend set)', list: GESTURE_CONTROLS },
  ];

  let y = 50;
  bands.forEach((band) => {
    p.comment(band.title, [GRID_X0, y, 640, 20]);
    const names = band.list.filter((c) => c.fb).map((c) => c.fb);
    const route = p.obj('route ' + names.join(' '), [GRID_X0, y + 26, COLS * COL_W - 16, 22]);
    routes.push({ box: route, names });
    let ry = y + 74;
    for (let r = 0; r * COLS < band.list.length; r++) {
      const row = band.list.slice(r * COLS, (r + 1) * COLS);
      const maxH = Math.max.apply(null, row.map((c) => size(c.v)[1]));
      row.forEach((c, i) => {
        const x = GRID_X0 + i * COL_W;
        const [w, h] = size(c.v);
        const box = makeControl(c, [x, ry + 30, w, h]);
        controlBoxes[c.v] = box;
        if (c.fb && c.raw) {
          // raw feedback (umenu: `clear` / `append <item>`): straight from the route into the control
          p.connect(route, names.indexOf(c.fb), box, 0);
          p.comment('raw: clear / append', [x, ry, 130, 20]);
        } else if (c.fb) {
          const ps = p.obj('prepend set', [x, ry, 0, 22]);
          p.connect(route, names.indexOf(c.fb), ps, 0);
          p.connect(ps, 0, box, 0);
        }
        const belowY = ry + 30 + h + 10;
        if (c.t === 'button') {
          // [route bang 1] fires once per click whether live.text sends a bang or 1 then 0.
          const once = p.obj('route bang 1', [x, belowY, 0, 22]);
          const m = p.msg(c.send, [x, belowY + 28, textWidth(c.send, 30), 22]);
          p.connect(box, 0, once, 0);
          p.connect(once, 0, m, 0);
          p.connect(once, 1, m, 0);
          p.connect(m, 0, glue, 0);
        } else {
          const pre = p.obj('prepend ' + c.send, [x, belowY, 0, 22]);
          p.connect(box, 0, pre, 0);
          p.connect(pre, 0, glue, 0);
        }
      });
      ry += 30 + maxH + 10 + 22 + 28 + 20;
    }
    y = ry + 24;
  });

  // ---- GLUE ---------------------------------------------------------------------------------
  const G = y + 30;
  glue.patching_rect = [GRID_X0, G, 380, 22];
  p.comment('GLUE  outlet 0 -> poly~ | 1 -> buffers | 2 -> feedback routes | 3 -> jsui | 4 -> capture recorder', [GRID_X0, G - 26, 620, 20]);

  routes.forEach((r) => p.connect(glue, 2, r.box, 0));

  // jsui view (patching copy is small; presentation is 600x160)
  const jsui = p.jsui(SPECIAL.ui, 'slicekit-ui.js', [GRID_X0 + 420, G + 36, 170, 90], lay.pres.sk_ui);
  const pUi = p.obj('prepend ui', [GRID_X0 + 420, G + 140, 0, 22]);
  p.connect(glue, 3, jsui, 0);
  p.connect(jsui, 0, pUi, 0);
  p.connect(pUi, 0, glue, 0);

  // ---- AUDIO --------------------------------------------------------------------------------
  p.comment('AUDIO', [GRID_X0 - 140, G + 54, 60, 20]);
  const phasor = p.obj('plugphasor~', [GRID_X0 - 140, G + 78, 0, 22]);
  const poly = p.obj('poly~ slicekit.voice ' + NUM_VOICES, [GRID_X0, G + 110, 240, 22]);
  p.connect(glue, 0, poly, 0);
  p.connect(phasor, 0, poly, 0);
  p.connect(poly, 2, glue, 0); // voiceend <i>

  const out = p.liveGain(SPECIAL.out, [GRID_X0, G + 176, 48, 100], lay.pres.sk_out);
  const plugout = p.obj('plugout~', [GRID_X0, G + 296, 0, 22]);
  p.connect(poly, 0, out, 0);
  p.connect(poly, 1, out, 1);
  p.connect(out, 0, plugout, 0);
  p.connect(out, 1, plugout, 1);

  // ---- CAPTURE: recorder gen~ writes the (pre-gain) output into a 40 s ring buffer --------------
  const CX = GRID_X0 + 70;
  p.comment('CAPTURE  poly~ L/R (before live.gain~) -> recorder gen~ -> ring buffer ---cap; glue outlet 4 binds the buffers (cap / wpb)',
    [CX, G + 276, 760, 20]);
  const rec = buildRecorder(recorderCode, warnings);
  const recorder = p.newobj('gen~', 2, 1, ['signal'], [CX, G + 304, 130, 22], {
    patcher: rec,
    saved_object_attributes: { globalpatchername: '' },
  });
  p.connect(poly, 0, recorder, 0);
  p.connect(poly, 1, recorder, 1);
  p.connect(glue, 4, recorder, 0);
  p.obj('buffer~ ---cap 40000 2', [CX + 160, G + 304, 0, 22]);
  p.obj('buffer~ ---capwp 10 1', [CX + 330, G + 304, 0, 22]);
  p.obj('buffer~ ---capout 1000 2', [CX + 490, G + 304, 0, 22]);
  p.comment('ring 40 s stereo', [CX + 160, G + 332, 140, 20]);
  p.comment('write position (frame 0)', [CX + 330, G + 332, 150, 20]);
  p.comment('export staging (.wav)', [CX + 490, G + 332, 150, 20]);

  // ---- STATE DICTS --------------------------------------------------------------------------
  p.comment('STATE (saved with the Live Set) / VIEW MODEL (jsui)', [GRID_X0 + 70, G + 176, 360, 20]);
  p.obj('dict ---skstate @parameter_enable 1', [GRID_X0 + 70, G + 200, 0, 22], {
    parameter_enable: 1,
    saved_attribute_attributes: {
      valueof: {
        parameter_longname: 'SliceKit State',
        parameter_shortname: 'State',
        parameter_type: PTYPE.blob,
        parameter_invisible: VIS.S,
      },
    },
    varname: 'sk_state',
  });
  p.obj('dict ---skview', [GRID_X0 + 70, G + 232, 0, 22], { varname: 'sk_view' });

  // ---- BUFFERS ------------------------------------------------------------------------------
  const BX = GRID_X0 + 660;
  const BP = 112; // buffer column pitch
  p.comment('BUFFERS  glue outlet 1:  <i> replace <path> | <i> clear   -  right outlet of buffer~ -> loaded <i>', [BX, G + 36, 700, 20]);
  const route16 = p.obj('route ' + Array.from({ length: NUM_BUFFERS }, (_, i) => i).join(' '),
    [BX, G + 62, NUM_BUFFERS * BP + 6, 22]);
  p.connect(glue, 1, route16, 0);
  for (let i = 0; i < NUM_BUFFERS; i++) {
    const x = BX + i * BP;
    const buf = p.obj('buffer~ ---src' + i, [x, G + 112, 0, 22]);
    const tb = p.obj('t b', [x, G + 152, 0, 22]);
    const loaded = p.msg('loaded ' + i, [x, G + 188, textWidth('loaded ' + i, 30), 22]);
    p.connect(route16, i, buf, 0);
    p.connect(buf, 1, tb, 0);
    p.connect(tb, 0, loaded, 0);
    p.connect(loaded, 0, glue, 0);
  }

  // ---- presentation-only decorations, parked in a lane right of the patch --------------------
  const laneX = GRID_X0 + COLS * COL_W + 48; // right of the control grid, top of the canvas (buffers are at the bottom)
  p.comment('PRESENTATION-ONLY: panels, section titles, labels (no function)', [laneX, 14, 420, 20]);
  let lane = 0;
  const park = () => {
    const col = lane % 3;
    const row = Math.floor(lane / 3);
    lane++;
    return [laneX + col * 140, 44 + row * 24, 130, 18];
  };
  lay.panels.forEach((r) => { p.panel(r, park()); });
  lay.titles.forEach((t) => { p.liveComment(t.text, t.rect, park(), { fontsize: 10.0 }); });
  lay.labels.forEach((l) => { p.liveComment(l.text, l.rect, park(), { fontsize: 9.0 }); });

  const json = p.toJSON({
    openinpresentation: 1,
    default_fontsize: 10.0,
    default_fontface: 0,
    default_fontname: 'Arial',
    gridonopen: 1,
    gridsize: [8.0, 8.0],
    gridsnaponopen: 1,
    objectsnaponopen: 1,
    enablehscroll: 1,
    enablevscroll: 1,
    devicewidth: lay.devicewidth,
    description: 'SliceKit - slices from many samples on the MIDI keyboard',
    digest: '',
    tags: '',
  });
  json.patcher.bglocked = 0;
  json.patcher.autosave = 0;
  return { json, devicewidth: lay.devicewidth };
}

// ------------------------------------------------------------------------------------------------
// Voice patcher (poly~ abstraction) with embedded gen~
// ------------------------------------------------------------------------------------------------

const PLACEHOLDER_CODE = [
  '// SliceKit voice PLACEHOLDER - max/voice.genexpr was not found at build time.',
  '// Outputs silence; "active" (out3) stays 0 so no voiceend is ever sent.',
  'out1 = in1 * 0;',
  'out2 = in1 * 0;',
  'out3 = in1 * 0;',
  '',
].join('\n');

const RECORDER_PLACEHOLDER_CODE = [
  '// SliceKit recorder PLACEHOLDER - max/recorder.genexpr was not found at build time.',
  '// Records nothing: Capture would produce silence.',
  'out1 = in1 * 0 + in2 * 0;',
  '',
].join('\n');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function maxIndex(code, prefix) {
  let m = 0;
  for (const mt of stripComments(code).matchAll(new RegExp('\\b' + prefix + '(\\d+)\\b', 'g'))) {
    m = Math.max(m, parseInt(mt[1], 10));
  }
  return m;
}

/**
 * Inner dsp.gen patcher: `in 1..boxIns` -> codebox -> `out 1..boxOuts`.
 * The codebox gets as many inlets / outlets as the code uses (in<N> / out<N>); padIns raises the inlet
 * count to boxIns so every `in` object can be wired even if the code ignores the last ones.
 * @returns {{json: object, nIn: number, nOut: number}}
 */
function genPatcher(code, boxIns, boxOuts, padIns) {
  const nIn = maxIndex(code, 'in');
  const nOut = maxIndex(code, 'out');
  const cbIn = padIns ? Math.max(nIn, boxIns) : nIn;
  const lines = code.split('\n').length;
  const boxH = Math.min(520, Math.max(140, lines * 16 + 24));

  const g = new Patcher({ classnamespace: 'dsp.gen', rect: [60, 90, 760, boxH + 190] });
  const ins = [];
  for (let i = 1; i <= boxIns; i++) ins.push(g.newobj('in ' + i, 0, 1, [''], [30 + (i - 1) * 90, 20, 40, 22]));
  const cb = g.codebox(code, cbIn, nOut, [30, 56, 640, boxH]);
  ins.forEach((b, i) => { if (i < cbIn) g.connect(b, 0, cb, i); });
  const outY = 56 + boxH + 24;
  for (let i = 1; i <= boxOuts; i++) {
    const o = g.newobj('out ' + i, 1, 0, [], [30 + (i - 1) * 90, outY, 46, 22]);
    if (i <= nOut) g.connect(cb, i - 1, o, 0);
  }
  const json = g.toJSON({ openinpresentation: 0, default_fontsize: 12.0, default_fontname: 'Arial' }).patcher;
  json.originid = 'pat-1';
  return { json, nIn, nOut };
}

/** The capture recorder: in1/in2 = L/R, out1 = write position. Returns the inner dsp.gen patcher. */
function buildRecorder(code, warnings) {
  const g = genPatcher(code, 2, 1, true);
  if (g.nIn < 2) {
    warnings.push('recorder code references only in1..in' + g.nIn + ' (need in1 L, in2 R) - missing inputs are not recorded');
  }
  if (g.nOut < 1) warnings.push('recorder code does not reference out1 (write position) - gen~ outlet left unconnected');
  return g.json;
}

function buildVoice(code, warnings) {
  // ---- inner gen~ patcher ---------------------------------------------------------------------
  const inner = genPatcher(code, 1, 3, false);
  if (inner.nIn < 1) warnings.push('voice code does not reference in1 (host beat phase) - gen~ inlet left unconnected');
  if (inner.nOut < 3) {
    warnings.push('voice code references only out1..out' + inner.nOut + ' (need out1 L, out2 R, out3 active) - missing gen~ outputs are silent');
  }
  const innerJson = inner.json;

  // ---- voice patcher --------------------------------------------------------------------------
  const v = new Patcher({ rect: [60, 80, 760, 560] });
  v.comment('SliceKit voice (poly~ instance). in 1 = voice messages, in~ 1 = host beat phase (0..1 per beat).', [30, 8, 640, 20]);
  const inMsg = v.obj('in 1', [30, 40, 0, 22]);
  const inSig = v.obj('in~ 1', [140, 40, 0, 22]);
  const gen = v.newobj('gen~', 1, 3, ['signal', 'signal', 'signal'], [30, 110, 330, 22], {
    patcher: innerJson,
    saved_object_attributes: { globalpatchername: '' },
  });
  v.connect(inMsg, 0, gen, 0);
  v.connect(inSig, 0, gen, 0);

  const outL = v.obj('out~ 1', [30, 190, 0, 22]);
  const outR = v.obj('out~ 2', [190, 190, 0, 22]);
  v.connect(gen, 0, outL, 0);
  v.connect(gen, 1, outR, 0);

  v.comment('active (gen~ out 3) falling edge -> voiceend <voice#>', [350, 160, 380, 20]);
  const edge = v.obj('edge~', [350, 190, 0, 22]);
  const hold = v.obj('int', [350, 250, 0, 22]);
  const pre = v.obj('prepend voiceend', [350, 290, 0, 22]);
  const outMsg = v.obj('out 3', [350, 330, 0, 22]);
  v.connect(gen, 2, edge, 0);
  v.connect(edge, 1, hold, 0); // right outlet = non-zero -> zero
  v.connect(hold, 0, pre, 0);
  v.connect(pre, 0, outMsg, 0);

  const lb = v.obj('loadbang', [520, 190, 0, 22]);
  const tp = v.obj('thispoly~', [520, 224, 0, 22]);
  v.connect(lb, 0, tp, 0);
  v.connect(tp, 0, hold, 1); // voice number (1-based) stored in [int]

  const json = v.toJSON({
    openinpresentation: 0,
    default_fontsize: 10.0,
    default_fontface: 0,
    default_fontname: 'Arial',
    gridonopen: 1,
    gridsize: [8.0, 8.0],
    description: 'SliceKit poly~ voice',
    digest: '',
    tags: '',
  });
  json.patcher.bglocked = 0;
  json.patcher.autosave = 0;
  return json;
}

// ------------------------------------------------------------------------------------------------
// build()
// ------------------------------------------------------------------------------------------------

function writeJsonAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, '\t') + '\n');
  fs.renameSync(tmp, file);
}

/** Read a gen~ source file; missing/empty -> warning + placeholder code. */
function readGenCode(src, what, placeholder, warnings) {
  let code = null;
  try {
    code = fs.readFileSync(src, 'utf8');
  } catch (e) {
    code = null;
  }
  if (code === null || code.trim() === '') {
    warnings.push(what + ' source ' + src + (code === null ? ' not found' : ' is empty')
      + ' - embedding a silent placeholder codebox');
    return placeholder;
  }
  return code.replace(/\r\n/g, '\n');
}

/**
 * Build both patchers.
 * @param {{outDir?: string, voiceSrc?: string, recorderSrc?: string, quiet?: boolean}} [opts]
 * @returns {{device: object, voice: object, files: string[], warnings: string[], devicewidth: number}}
 */
function build(opts) {
  opts = opts || {};
  const outDir = opts.outDir || DEFAULT_OUT_DIR;
  const voiceSrc = opts.voiceSrc || DEFAULT_VOICE_SRC;
  const recorderSrc = opts.recorderSrc || DEFAULT_RECORDER_SRC;
  const warnings = [];

  // parameter long names must be unique (Live would silently rename duplicates)
  const seen = new Set();
  GRID_CONTROLS.concat([SPECIAL.load, SPECIAL.capfolder, SPECIAL.out]).forEach((c) => {
    if (c.vis === '-') return; // not a Live parameter (umenu)
    if (seen.has(c.name)) throw new Error('duplicate parameter_longname: ' + c.name);
    seen.add(c.name);
  });

  const code = readGenCode(voiceSrc, 'voice', PLACEHOLDER_CODE, warnings);
  const recorderCode = readGenCode(recorderSrc, 'recorder', RECORDER_PLACEHOLDER_CODE, warnings);
  const device = buildDevice(recorderCode, warnings);
  const voice = buildVoice(code, warnings);

  const deviceFile = path.join(outDir, 'SliceKit.maxpat');
  const voiceFile = path.join(outDir, 'slicekit.voice.maxpat');
  writeJsonAtomic(deviceFile, device.json);
  writeJsonAtomic(voiceFile, voice);

  if (!opts.quiet) warnings.forEach((w) => console.warn('[build-patchers] WARNING: ' + w));
  return {
    device: device.json, voice, files: [deviceFile, voiceFile], warnings, devicewidth: device.devicewidth,
  };
}

module.exports = {
  build,
  // exposed for tests / tooling
  CONTROLS: GRID_CONTROLS.concat([SPECIAL.load, SPECIAL.capfolder, SPECIAL.out]),
  DEVICE_HEIGHT,
  PLACEHOLDER_CODE,
  RECORDER_PLACEHOLDER_CODE,
};

if (require.main === module) {
  const result = build();
  console.log('[build-patchers] wrote');
  result.files.forEach((f) => console.log('  ' + path.relative(process.cwd(), f)));
  console.log('[build-patchers] device width ' + result.devicewidth + ' x ' + DEVICE_HEIGHT + ' px');
  let errors = [];
  try {
    const { validate } = require('./validate-patchers');
    result.files.forEach((f) => {
      const errs = validate(JSON.parse(fs.readFileSync(f, 'utf8')));
      errs.forEach((e) => errors.push(path.basename(f) + ': ' + e));
    });
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    console.warn('[build-patchers] validate-patchers.js not available - skipping validation');
  }
  if (errors.length) {
    console.error('[build-patchers] validation FAILED:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('[build-patchers] validation OK');
}
