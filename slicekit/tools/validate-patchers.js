#!/usr/bin/env node
'use strict';

/*
 * validate-patchers.js - structural validation of the generated .maxpat files.
 *
 *   validate(patcherJson, opts?) -> string[]   (empty array = valid)
 *   node tools/validate-patchers.js [file...]  validates dist/SliceKit.maxpat and
 *                                              dist/slicekit.voice.maxpat (or the given files);
 *                                              exit code 1 on errors.
 *
 * Generic checks (every patcher, embedded gen~ patchers included):
 *   unique box ids, rects, patchlines reference existing boxes with outlet < numoutlets and
 *   inlet < numinlets.
 * Device patcher (has "devicewidth"): the control table of docs/PROTOCOL.md is parsed and every
 *   varname must exist exactly once with the right maxclass / mode / text / range / enum / flags
 *   (parameter_invisible 0 = A, 2 = H), sit inside the device area (height <= 169), be wired to
 *   the glue ("sends") and to a [route] -> [prepend set] chain ("feedback"); parameter_longname
 *   must be unique; presentation boxes must not overlap.
 * Voice patcher (contains a gen~): poly~ voice wiring and a non-empty codebox.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEVICE_HEIGHT = 169;

// ------------------------------------------------------------------------------------------------
// Docs parsing (PROTOCOL.md control table, ARCHITECTURE.md constants)
// ------------------------------------------------------------------------------------------------

/**
 * Parse the "UI controls" table of PROTOCOL.md.
 * @returns {{varname,maxclass,mode,paren,text,range,sends,feedback,vis}[]}
 */
function loadControlTable(protocolPath) {
  const md = fs.readFileSync(protocolPath || path.join(ROOT, 'docs', 'PROTOCOL.md'), 'utf8');
  const start = md.indexOf('## UI controls');
  if (start < 0) throw new Error('PROTOCOL.md: "## UI controls" section not found');
  const rest = md.slice(start + 3);
  const nextHeading = rest.search(/\n## /);
  const section = nextHeading < 0 ? rest : rest.slice(0, nextHeading);
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().replace(/`/g, ''));
    if (cells.length < 6) continue;
    if (cells[0] === 'varname' || /^-+$/.test(cells[0])) continue;
    const obj = /^([A-Za-z0-9_.~]+)\s*(?:\(([^)]*)\))?\s*(?:["“]([^"”]*)["”])?\s*$/.exec(cells[1]);
    if (!obj) throw new Error('PROTOCOL.md: cannot parse object cell "' + cells[1] + '" of ' + cells[0]);
    const paren = obj[2] || '';
    rows.push({
      varname: cells[0],
      maxclass: obj[1],
      paren,
      mode: obj[1] === 'live.text' ? paren : '',
      text: obj[3] || '',
      range: cells[2],
      sends: cells[3],
      feedback: cells[4] === '—' ? '' : cells[4],
      vis: cells[5],
    });
  }
  if (rows.length < 40) throw new Error('PROTOCOL.md: control table looks truncated (' + rows.length + ' rows)');
  return rows;
}

/** Parse BEAT_DIVS / REPEAT_DIVS from ARCHITECTURE.md; null entries when not parseable. */
function loadConstants(archPath) {
  let md = '';
  try {
    md = fs.readFileSync(archPath || path.join(ROOT, 'docs', 'ARCHITECTURE.md'), 'utf8');
  } catch (e) {
    return { BEAT_DIVS: null, REPEAT_DIVS: null };
  }
  const arr = (name) => {
    const m = new RegExp('\\b' + name + '\\s*=\\s*\\[([^\\]]*)\\]').exec(md);
    if (!m) return null;
    return Array.from(m[1].matchAll(/'([^']*)'/g), (x) => x[1]);
  };
  return { BEAT_DIVS: arr('BEAT_DIVS'), REPEAT_DIVS: arr('REPEAT_DIVS') };
}

function expectedEnum(range, consts) {
  const t = range.trim();
  if (t === 'BEAT_DIVS') return consts.BEAT_DIVS;
  if (t === 'REPEAT_DIVS') return consts.REPEAT_DIVS;
  if (t === 'A–H') return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const copy = /^Copy→([A-Z])\s*…\s*Copy→([A-Z])$/.exec(t);
  if (copy) {
    const out = [];
    for (let c = copy[1].charCodeAt(0); c <= copy[2].charCodeAt(0); c++) out.push('Copy→' + String.fromCharCode(c));
    return out;
  }
  if (t.includes(',')) return t.split(',').map((s) => s.trim());
  return null;
}

function numericRange(range) {
  const m = /^(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)/.exec(range.trim().replace(/−/g, '-'));
  return m ? { min: parseFloat(m[1]), max: parseFloat(m[2]) } : null;
}

// ------------------------------------------------------------------------------------------------
// Patcher index
// ------------------------------------------------------------------------------------------------

/** Build lookup structures for a (sub)patcher object (the value of the "patcher" key). */
function indexPatcher(root) {
  const boxes = (root.boxes || []).map((b) => b.box);
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const lines = (root.lines || []).map((l) => ({
    from: l.patchline.source[0], out: l.patchline.source[1],
    to: l.patchline.destination[0], in: l.patchline.destination[1],
  }));
  const outgoing = new Map();
  const incoming = new Map();
  for (const ln of lines) {
    if (!outgoing.has(ln.from)) outgoing.set(ln.from, []);
    if (!incoming.has(ln.to)) incoming.set(ln.to, []);
    outgoing.get(ln.from).push(ln);
    incoming.get(ln.to).push(ln);
  }
  const ix = {
    boxes,
    byId,
    lines,
    out: (id) => outgoing.get(id) || [],
    inc: (id) => incoming.get(id) || [],
    /** boxes whose text matches (string = exact, RegExp = test) */
    byText: (t) => boxes.filter((b) => (typeof b.text === 'string')
      && (t instanceof RegExp ? t.test(b.text) : b.text === t)),
    byVar: (v) => boxes.filter((b) => b.varname === v),
    /** is there a patchline a[outlet] -> b[inlet] ? */
    hasLine: (a, outlet, b, inlet) => lines.some((l) => l.from === a.id && l.out === outlet
      && l.to === b.id && l.in === inlet),
    /** destinations of a[outlet] */
    targets: (a, outlet) => lines.filter((l) => l.from === a.id && (outlet === undefined || l.out === outlet))
      .map((l) => ({ box: byId.get(l.to), inlet: l.in, outlet: l.out })),
  };
  return ix;
}

function isRect(r) {
  return Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function overlaps(a, b) {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

function nameOf(b) {
  return (b.varname ? b.varname : (b.text ? '"' + b.text + '"' : b.maxclass)) + ' (' + b.id + ')';
}

function tokens(s) {
  return String(s).trim().split(/\s+/).filter(Boolean);
}

/** does token list `hay` contain `needle` as a contiguous run? */
function containsTokens(hay, needle) {
  const h = tokens(hay);
  const n = tokens(needle);
  if (!n.length) return true;
  for (let i = 0; i + n.length <= h.length; i++) {
    if (n.every((t, j) => h[i + j] === t)) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------
// Generic structural checks
// ------------------------------------------------------------------------------------------------

function checkStructure(root, where, errors, opts) {
  const err = (m) => errors.push(where + ': ' + m);
  if (!Array.isArray(root.boxes)) { err('"boxes" is not an array'); return; }
  if (!Array.isArray(root.lines)) { err('"lines" is not an array'); return; }

  const ids = new Set();
  for (const wrap of root.boxes) {
    const b = wrap && wrap.box;
    if (!b) { err('boxes entry without "box"'); continue; }
    if (typeof b.id !== 'string' || !b.id) { err('box without id'); continue; }
    if (ids.has(b.id)) err('duplicate box id ' + b.id);
    ids.add(b.id);
    if (typeof b.maxclass !== 'string') err(nameOf(b) + ': missing maxclass');
    if (!Number.isInteger(b.numinlets) || b.numinlets < 0) err(nameOf(b) + ': bad numinlets');
    if (!Number.isInteger(b.numoutlets) || b.numoutlets < 0) err(nameOf(b) + ': bad numoutlets');
    if (b.numoutlets > 0 && (!Array.isArray(b.outlettype) || b.outlettype.length !== b.numoutlets)) {
      err(nameOf(b) + ': outlettype length != numoutlets');
    }
    if (!isRect(b.patching_rect) || b.patching_rect[2] <= 0 || b.patching_rect[3] <= 0) {
      err(nameOf(b) + ': bad patching_rect');
    }
    if (b.presentation === 1 && (!isRect(b.presentation_rect) || b.presentation_rect[2] <= 0 || b.presentation_rect[3] <= 0)) {
      err(nameOf(b) + ': presentation=1 but bad presentation_rect');
    }
    if (b.maxclass === 'newobj' && (typeof b.text !== 'string' || !b.text)) err(nameOf(b) + ': newobj without text');
    if (b.patcher) {
      if (!b.patcher.classnamespace) err(nameOf(b) + ': embedded patcher without classnamespace');
      checkStructure(b.patcher, where + ' > ' + nameOf(b), errors, { overlap: false });
    }
  }

  const byId = new Map(root.boxes.filter((w) => w && w.box).map((w) => [w.box.id, w.box]));
  const seenLines = new Set();
  for (const wrap of root.lines) {
    const l = wrap && wrap.patchline;
    if (!l || !Array.isArray(l.source) || !Array.isArray(l.destination)) { err('malformed patchline'); continue; }
    const [sid, sout] = l.source;
    const [did, din] = l.destination;
    const key = sid + ':' + sout + '>' + did + ':' + din;
    if (seenLines.has(key)) err('duplicate patchline ' + key);
    seenLines.add(key);
    const s = byId.get(sid);
    const d = byId.get(did);
    if (!s) { err('patchline source box "' + sid + '" does not exist'); continue; }
    if (!d) { err('patchline destination box "' + did + '" does not exist'); continue; }
    if (!Number.isInteger(sout) || sout < 0 || sout >= s.numoutlets) {
      err('patchline ' + key + ': outlet ' + sout + ' >= numoutlets (' + s.numoutlets + ') of ' + nameOf(s));
    }
    if (!Number.isInteger(din) || din < 0 || din >= d.numinlets) {
      err('patchline ' + key + ': inlet ' + din + ' >= numinlets (' + d.numinlets + ') of ' + nameOf(d));
    }
  }

  if (opts && opts.overlap) {
    const items = root.boxes.map((w) => w.box).filter((b) => b && isRect(b.patching_rect) && b.maxclass !== 'panel');
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (overlaps(items[i].patching_rect, items[j].patching_rect)) {
          err('patching-view overlap: ' + nameOf(items[i]) + ' and ' + nameOf(items[j]));
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Device checks
// ------------------------------------------------------------------------------------------------

function valueOfAttrs(b) {
  return (b.saved_attribute_attributes && b.saved_attribute_attributes.valueof) || {};
}

function checkDevice(root, errors, opts) {
  const err = (m) => errors.push('device: ' + m);
  const ix = indexPatcher(root);
  const dw = root.devicewidth;

  if (typeof dw !== 'number' || !(dw > 0)) err('missing/invalid devicewidth');
  if (root.classnamespace !== 'box') err('classnamespace must be "box"');
  if (root.openinpresentation !== 1) err('openinpresentation must be 1');

  // --- presentation area ------------------------------------------------------------------------
  const presBoxes = ix.boxes.filter((b) => b.presentation === 1 && isRect(b.presentation_rect));
  let maxRight = 0;
  for (const b of presBoxes) {
    const [x, y, w, h] = b.presentation_rect;
    maxRight = Math.max(maxRight, x + w);
    if (x < 0 || y < 0) err('presentation_rect of ' + nameOf(b) + ' has negative origin');
    if (y + h > DEVICE_HEIGHT) err('presentation_rect of ' + nameOf(b) + ' ends at y=' + (y + h) + ' > ' + DEVICE_HEIGHT);
    if (typeof dw === 'number' && x + w > dw) err('presentation_rect of ' + nameOf(b) + ' ends at x=' + (x + w) + ' > devicewidth ' + dw);
  }
  if (typeof dw === 'number' && dw < maxRight) err('devicewidth ' + dw + ' < content width ' + maxRight);
  const flat = presBoxes.filter((b) => b.maxclass !== 'panel');
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (overlaps(flat[i].presentation_rect, flat[j].presentation_rect)) {
        err('presentation overlap: ' + nameOf(flat[i]) + ' and ' + nameOf(flat[j]));
      }
    }
  }

  // --- parameters: names ----------------------------------------------------------------------
  const longnames = new Map();
  for (const b of ix.boxes) {
    if (b.parameter_enable !== 1) continue;
    const v = valueOfAttrs(b);
    if (!v.parameter_longname) { err(nameOf(b) + ': parameter_enable=1 without parameter_longname'); continue; }
    if (longnames.has(v.parameter_longname)) {
      err('duplicate parameter_longname "' + v.parameter_longname + '" (' + longnames.get(v.parameter_longname) + ', ' + nameOf(b) + ')');
    }
    longnames.set(v.parameter_longname, nameOf(b));
    if (![0, 1, 2].includes(v.parameter_invisible === undefined ? 0 : v.parameter_invisible)) {
      err(nameOf(b) + ': bad parameter_invisible');
    }
  }

  // varnames unique
  const vars = new Map();
  for (const b of ix.boxes) {
    if (!b.varname) continue;
    if (vars.has(b.varname)) err('duplicate varname ' + b.varname);
    vars.set(b.varname, b);
  }

  // --- glue + control table ---------------------------------------------------------------------
  const glues = ix.byText(/^v8\s+slicekit\.js\b/);
  if (glues.length !== 1) { err('expected exactly one [v8 slicekit.js ...] glue, found ' + glues.length); return; }
  const glue = glues[0];
  if (glue.numinlets !== 1 || glue.numoutlets !== 4) err('glue must have 1 inlet / 4 outlets');
  for (const a of ['---src', '---skstate', '---skview']) {
    if (!tokens(glue.text).includes(a)) err('glue is missing argument ' + a);
  }

  let table;
  try {
    table = opts.table || loadControlTable(opts.protocolPath);
  } catch (e) {
    err(e.message);
    return;
  }
  const consts = loadConstants(opts.archPath);
  const routes = ix.byText(/^route\s/);

  for (const row of table) {
    const found = ix.byVar(row.varname);
    if (found.length === 0) { err('control ' + row.varname + ' missing'); continue; }
    if (found.length > 1) { err('control ' + row.varname + ' present ' + found.length + ' times'); continue; }
    const b = found[0];
    const tag = row.varname;
    if (b.maxclass !== row.maxclass) {
      err(tag + ': maxclass ' + b.maxclass + ' != ' + row.maxclass);
      continue;
    }
    // presentation
    if (b.presentation !== 1 || !isRect(b.presentation_rect)) err(tag + ': not in presentation');

    // parameter flags
    const v = valueOfAttrs(b);
    if (row.vis === 'A' || row.vis === 'H') {
      if (b.parameter_enable !== 1) err(tag + ': parameter_enable must be 1');
      const inv = v.parameter_invisible === undefined ? 0 : v.parameter_invisible;
      const want = row.vis === 'A' ? 0 : 2;
      if (inv !== want) err(tag + ': parameter_invisible ' + inv + ' != ' + want + ' (' + row.vis + ')');
    } else if (b.parameter_enable) {
      err(tag + ': must not be a Live parameter (parameter_enable should be 0)');
    }

    // live.text mode / text
    if (row.maxclass === 'live.text') {
      const wantMode = row.mode === 'toggle' ? 1 : 0;
      if (row.mode !== 'toggle' && row.mode !== 'button') err(tag + ': PROTOCOL object cell has no (button|toggle)');
      if (b.mode !== wantMode) err(tag + ': mode ' + b.mode + ' != ' + wantMode + ' (' + row.mode + ')');
      if (row.text && b.text !== row.text) err(tag + ': text "' + b.text + '" != "' + row.text + '"');
      if (row.text && wantMode === 1 && b.texton !== row.text) err(tag + ': texton "' + b.texton + '" != "' + row.text + '"');
    }
    if (row.maxclass === 'jsui') {
      if (row.paren && b.filename !== row.paren) err(tag + ': filename "' + b.filename + '" != "' + row.paren + '"');
    }
    if (row.maxclass === 'live.numbox' && row.paren === 'MIDI note' && v.parameter_unitstyle !== 8) {
      err(tag + ': MIDI note numbox needs parameter_unitstyle 8');
    }

    // ranges / enums
    if (row.maxclass === 'live.tab' || row.maxclass === 'live.menu') {
      if (v.parameter_type !== 2) err(tag + ': parameter_type must be 2 (enum)');
      const want = expectedEnum(row.range, consts);
      if (want === null && (row.range === 'BEAT_DIVS' || row.range === 'REPEAT_DIVS')) {
        err(tag + ': cannot parse ' + row.range + ' from ARCHITECTURE.md');
      } else if (want && JSON.stringify(v.parameter_enum) !== JSON.stringify(want)) {
        err(tag + ': parameter_enum ' + JSON.stringify(v.parameter_enum) + ' != ' + JSON.stringify(want));
      }
      if (Array.isArray(v.parameter_enum) && v.parameter_mmax !== v.parameter_enum.length - 1) {
        err(tag + ': parameter_mmax must be enum length - 1');
      }
    } else if (['live.dial', 'live.numbox', 'live.gain~'].includes(row.maxclass)) {
      const r = numericRange(row.range);
      if (!r) { err(tag + ': cannot parse numeric range "' + row.range + '"'); } else {
        if (v.parameter_mmin !== r.min) err(tag + ': parameter_mmin ' + v.parameter_mmin + ' != ' + r.min);
        if (v.parameter_mmax !== r.max) err(tag + ': parameter_mmax ' + v.parameter_mmax + ' != ' + r.max);
      }
      if (/\bint\b/.test(row.range) && v.parameter_type !== 1) err(tag + ': parameter_type must be 1 (int)');
      if (/\bfloat\b/.test(row.range) && v.parameter_type !== 0) err(tag + ': parameter_type must be 0 (float)');
      if (/\(exp\)/.test(row.range) && !(v.parameter_exponent > 1)) err(tag + ': (exp) needs parameter_exponent > 1');
      if (!/\(exp\)/.test(row.range) && v.parameter_exponent > 1) err(tag + ': unexpected parameter_exponent');
    }

    // wiring: control -> ... -> glue, passing a box that carries the "sends" text
    const key = row.sends.replace(/<[^>]*>/g, '').replace(/\.\.\./g, '').trim();
    if (key && key !== 'audio' && key !== '—') {
      const okPath = findPaths(ix, b, glue).some((trail) => trail.some((t) => containsTokens(t.text || '', key)));
      if (!okPath) err(tag + ': no path control -> ... -> glue passing "' + key + '"');
    }
    if (row.sends === 'audio') {
      const outs = ix.out(b.id).filter((l) => l.out <= 1);
      if (outs.length < 2) err(tag + ': audio outlets 0/1 are not both connected');
    }

    // feedback: glue out2 -> [route ..name..] -> [prepend set] -> control
    if (row.feedback) {
      const owners = routes.filter((r) => tokens(r.text).slice(1).includes(row.feedback));
      if (owners.length !== 1) { err(tag + ': feedback "' + row.feedback + '" must be in exactly one [route], found ' + owners.length); continue; }
      const r = owners[0];
      if (!ix.out(glue.id).some((l) => l.out === 2 && l.to === r.id && l.in === 0)) {
        err(tag + ': route for ' + row.feedback + ' is not fed by glue outlet 2');
      }
      const idx = tokens(r.text).slice(1).indexOf(row.feedback);
      const viaSet = ix.targets(r, idx).filter((t) => t.box.text === 'prepend set');
      if (viaSet.length !== 1 || !ix.hasLine(viaSet[0].box, 0, b, 0)) {
        err(tag + ': route outlet ' + idx + ' (' + row.feedback + ') -> [prepend set] -> control not wired');
      }
    }
  }
}

/** All simple paths control(outlet 0 of the start) -> glue inlet 0; each path = intermediate boxes. */
function findPaths(ix, start, glue) {
  const results = [];
  const walk = (box, firstHop, trail, seen) => {
    for (const ln of ix.out(box.id)) {
      if (firstHop && ln.out !== 0) continue;
      const dst = ix.byId.get(ln.to);
      if (!dst) continue;
      if (dst === glue) { if (ln.in === 0) results.push(trail.slice()); continue; }
      if (seen.has(dst.id) || trail.length >= 6) continue;
      seen.add(dst.id);
      trail.push(dst);
      walk(dst, false, trail, seen);
      trail.pop();
      seen.delete(dst.id);
    }
  };
  walk(start, true, [], new Set([start.id]));
  return results;
}

// ------------------------------------------------------------------------------------------------
// Voice checks
// ------------------------------------------------------------------------------------------------

function checkVoice(root, errors) {
  const err = (m) => errors.push('voice: ' + m);
  const ix = indexPatcher(root);
  const one = (text) => {
    const f = ix.byText(text);
    if (f.length !== 1) { err('expected exactly one [' + text + '], found ' + f.length); return null; }
    return f[0];
  };
  const inMsg = one('in 1');
  const inSig = one('in~ 1');
  const outL = one('out~ 1');
  const outR = one('out~ 2');
  const outMsg = one('out 3');
  const edge = one('edge~');
  const hold = one('int');
  const pre = one('prepend voiceend');
  const lb = one('loadbang');
  const tp = one('thispoly~');
  const gens = ix.byText('gen~');
  if (gens.length !== 1) { err('expected exactly one [gen~]'); return; }
  const gen = gens[0];
  if (gen.numinlets !== 1 || gen.numoutlets !== 3) err('gen~ must have 1 inlet / 3 outlets');
  if (!gen.patcher || gen.patcher.classnamespace !== 'dsp.gen') {
    err('gen~ has no embedded dsp.gen patcher');
    return;
  }
  const gi = indexPatcher(gen.patcher);
  const codeboxes = gi.boxes.filter((b) => b.maxclass === 'codebox');
  if (codeboxes.length !== 1) { err('gen~ patcher needs exactly one codebox'); return; }
  const cb = codeboxes[0];
  if (typeof cb.code !== 'string' || !cb.code.trim()) err('codebox code is empty');
  for (const t of ['in 1', 'out 1', 'out 2', 'out 3']) {
    if (gi.byText(t).length !== 1) err('gen~ patcher needs exactly one [' + t + ']');
  }

  const L = (a, o, b, i, what) => {
    if (a && b && !ix.hasLine(a, o, b, i)) err('missing wire ' + what);
  };
  L(inMsg, 0, gen, 0, 'in 1 -> gen~');
  L(inSig, 0, gen, 0, 'in~ 1 -> gen~');
  L(gen, 0, outL, 0, 'gen~ out0 -> out~ 1');
  L(gen, 1, outR, 0, 'gen~ out1 -> out~ 2');
  L(gen, 2, edge, 0, 'gen~ out2 -> edge~');
  L(edge, 1, hold, 0, 'edge~ right outlet -> int');
  L(hold, 0, pre, 0, 'int -> prepend voiceend');
  L(pre, 0, outMsg, 0, 'prepend voiceend -> out 3');
  L(lb, 0, tp, 0, 'loadbang -> thispoly~');
  L(tp, 0, hold, 1, 'thispoly~ -> int (right inlet)');
}

// ------------------------------------------------------------------------------------------------
// validate()
// ------------------------------------------------------------------------------------------------

/**
 * @param {object} patcherJson parsed .maxpat ({ patcher: {...} })
 * @param {{kind?: 'device'|'voice', protocolPath?: string, archPath?: string}} [opts]
 * @returns {string[]} error messages (empty when valid)
 */
function validate(patcherJson, opts) {
  opts = opts || {};
  const errors = [];
  const root = patcherJson && patcherJson.patcher;
  if (!root || typeof root !== 'object') return ['missing top-level "patcher" object'];

  const hasGen = Array.isArray(root.boxes) && root.boxes.some((w) => w && w.box && w.box.text === 'gen~');
  const kind = opts.kind || (root.devicewidth !== undefined ? 'device' : (hasGen ? 'voice' : 'generic'));

  checkStructure(root, 'patcher', errors, { overlap: kind === 'device' });
  if (errors.length && kind !== 'generic') {
    // wiring checks are meaningless on a structurally broken patcher
    return errors;
  }
  if (kind === 'device') checkDevice(root, errors, opts);
  else if (kind === 'voice') checkVoice(root, errors);
  return errors;
}

module.exports = {
  validate, loadControlTable, loadConstants, indexPatcher, containsTokens, DEVICE_HEIGHT,
};

if (require.main === module) {
  const files = process.argv.slice(2);
  const targets = files.length ? files : [
    path.join(ROOT, 'dist', 'SliceKit.maxpat'),
    path.join(ROOT, 'dist', 'slicekit.voice.maxpat'),
  ];
  let failed = false;
  for (const f of targets) {
    let errs;
    try {
      errs = validate(JSON.parse(fs.readFileSync(f, 'utf8')));
    } catch (e) {
      errs = ['cannot read/parse: ' + e.message];
    }
    if (errs.length) {
      failed = true;
      console.error(path.relative(process.cwd(), f) + ': ' + errs.length + ' error(s)');
      errs.forEach((e) => console.error('  - ' + e));
    } else {
      console.log(path.relative(process.cwd(), f) + ': OK');
    }
  }
  process.exit(failed ? 1 : 0);
}
