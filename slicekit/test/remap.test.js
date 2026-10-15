'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const { keyMapping, changedCount, remapNotes } = require('../core/remap');

const N = 128;

// 128-entry layout from a sparse { key: padId } object.
function layout(sparse) {
  const out = new Array(N).fill(null);
  for (const k of Object.keys(sparse)) out[Number(k)] = sparse[k];
  return out;
}

function identity() {
  const m = [];
  for (let k = 0; k < N; k++) m.push(k);
  return m;
}

// Identity mapping with the given { from: to } changes applied.
function mapOf(changes) {
  const m = identity();
  for (const k of Object.keys(changes)) m[Number(k)] = changes[k];
  return m;
}

test('identity: an unchanged layout maps every key to itself', () => {
  const keys = layout({ 0: 'kick', 1: 'snare', 10: 7, 64: '3', 127: 'hat' });
  const m = keyMapping(keys, keys.slice());
  assert.equal(m.length, N);
  assert.deepEqual(m, identity());
  assert.equal(changedCount(m), 0);
});

test('identity: empty layouts give the identity mapping', () => {
  assert.deepEqual(keyMapping(layout({}), layout({})), identity());
});

test('identity: every entry is an integer 0..127', () => {
  const m = keyMapping(layout({ 3: 'a' }), layout({ 90: 'a' }));
  assert.equal(m.length, N);
  for (const v of m) {
    assert.equal(Number.isInteger(v), true);
    assert.ok(v >= 0 && v < N);
  }
});

test('swap: two pads exchange keys', () => {
  const before = layout({ 10: 'A', 20: 'B' });
  const after = layout({ 10: 'B', 20: 'A' });
  const m = keyMapping(before, after);
  assert.deepEqual(m, mapOf({ 10: 20, 20: 10 }));
  assert.equal(changedCount(m), 2);
});

test('moved far: a pad jumps to the other end of the keyboard', () => {
  const m = keyMapping(layout({ 0: 'X' }), layout({ 127: 'X' }));
  assert.deepEqual(m, mapOf({ 0: 127 }));
  assert.equal(changedCount(m), 1);
});

test('duplicate: a pad on two new keys goes to the nearest one', () => {
  // 'D' was on 50; now on 40 and 60 (equal distance): lower key wins
  assert.equal(keyMapping(layout({ 50: 'D' }), layout({ 40: 'D', 60: 'D' }))[50], 40);
  // nearest wins regardless of order
  assert.equal(keyMapping(layout({ 50: 'D' }), layout({ 70: 'D', 53: 'D' }))[50], 53);
  assert.equal(keyMapping(layout({ 50: 'D' }), layout({ 48: 'D', 55: 'D' }))[50], 48);
  // tie one above and one below: lower key
  assert.equal(keyMapping(layout({ 50: 'D' }), layout({ 51: 'D', 49: 'D' }))[50], 49);
  // staying on its own key beats a closer-looking copy elsewhere (distance 0)
  assert.equal(keyMapping(layout({ 50: 'D' }), layout({ 50: 'D', 49: 'D' }))[50], 50);
});

test('duplicate: two old copies of a pad both go to the nearest new copy', () => {
  const m = keyMapping(layout({ 50: 'D', 52: 'D' }), layout({ 51: 'D' }));
  assert.deepEqual(m, mapOf({ 50: 51, 52: 51 }));
});

test('removed pad: its keys keep their place', () => {
  const m = keyMapping(layout({ 30: 'R', 31: 'S' }), layout({ 31: 'S' }));
  assert.deepEqual(m, identity());
  assert.equal(changedCount(m), 0);
});

test('removed pad: a null entry in the new layout never matches a string id', () => {
  // the string "null" must not match the empty entries of the new layout
  const m = keyMapping(layout({ 3: 'null' }), layout({ 9: null }));
  assert.equal(m[3], 3);
});

test('string vs number ids: 5 and "5" are the same pad', () => {
  assert.deepEqual(keyMapping(layout({ 5: 5 }), layout({ 5: '5' })), identity());
  // number before, string after
  assert.deepEqual(keyMapping(layout({ 5: 5 }), layout({ 9: '5' })), mapOf({ 5: 9 }));
  // string before, number after
  assert.deepEqual(keyMapping(layout({ 12: '7' }), layout({ 3: 7 })), mapOf({ 12: 3 }));
});

test('changedCount: counts only keys that do not map to themselves', () => {
  assert.equal(changedCount(identity()), 0);
  assert.equal(changedCount(mapOf({ 1: 2, 2: 1, 100: 3 })), 3);
  assert.equal(changedCount(mapOf({ 4: 4 })), 0);
  assert.equal(changedCount([]), 0);
  // short mapping: key 0 maps to 9, keys 1..127 are identity
  assert.equal(changedCount([9]), 1);
});

test('remapNotes: changed notes keep every other field and the input is not mutated', () => {
  const input = {
    notes: [
      {
        note_id: 'n1', pitch: 10, start_time: 0.5, duration: 0.25, velocity: 100,
        mute: 0, probability: 0.8, velocity_deviation: 5, release_velocity: 64,
      },
      {
        note_id: 'n2', pitch: 20, start_time: 1, duration: 0.5, velocity: 90,
        mute: 1, probability: 1, velocity_deviation: 0, release_velocity: 0,
      },
      {
        note_id: 'n3', pitch: 33, start_time: 2, duration: 1, velocity: 80,
        mute: 0, probability: 1, velocity_deviation: 0, release_velocity: 64,
      },
    ],
  };
  const snapshot = JSON.parse(JSON.stringify(input));
  const out = remapNotes(input, mapOf({ 10: 20, 20: 10 }), null);

  assert.deepEqual(input, snapshot, 'input must not be mutated');
  assert.deepEqual(out, {
    notes: [
      { ...snapshot.notes[0], pitch: 20 },
      { ...snapshot.notes[1], pitch: 10 },
    ],
  });
  assert.notEqual(out.notes[0], input.notes[0]);
});

test('remapNotes: protected keys are left untouched', () => {
  const input = {
    notes: [
      { note_id: 'a', pitch: 113, start_time: 0, duration: 1, velocity: 100 },
      { note_id: 'b', pitch: 10, start_time: 0, duration: 1, velocity: 100 },
    ],
  };
  const m = mapOf({ 10: 20, 113: 5 });
  const isMod = (key) => key >= 112;

  assert.deepEqual(remapNotes(input, m, isMod), {
    notes: [{ note_id: 'b', pitch: 20, start_time: 0, duration: 1, velocity: 100 }],
  });
  // without the guard the protected note would move too
  assert.equal(remapNotes(input, m, null).notes.length, 2);
  // isProtected receives each note's pitch
  const seen = [];
  remapNotes(input, m, (key) => { seen.push(key); return false; });
  assert.deepEqual(seen, [113, 10]);
});

test('remapNotes: notes that map to themselves are not returned', () => {
  const input = { notes: [{ note_id: 'a', pitch: 5 }] };
  assert.deepEqual(remapNotes(input, identity(), null), { notes: [] });
});

test('remapNotes: empty or missing notes give an empty result', () => {
  const m = mapOf({ 1: 2 });
  assert.deepEqual(remapNotes({}, m, null), { notes: [] });
  assert.deepEqual(remapNotes({ notes: [] }, m, null), { notes: [] });
  assert.deepEqual(remapNotes({ notes: null }, m, null), { notes: [] });
  assert.deepEqual(remapNotes(undefined, m), { notes: [] });
});

test('remapNotes: short mapping treats missing keys as identity', () => {
  // only key 0 is set (-> 9); keys 1..127 are identity
  const out = remapNotes(
    { notes: [{ note_id: 'a', pitch: 0 }, { note_id: 'b', pitch: 100 }] },
    [9],
    null
  );
  assert.deepEqual(out, { notes: [{ note_id: 'a', pitch: 9 }] });
});

test('remapNotes: pitches outside 0..127 are skipped', () => {
  const m = mapOf({ 0: 5 });
  const out = remapNotes(
    { notes: [
      { note_id: 'x', pitch: -1 },
      { note_id: 'y', pitch: 128 },
      { note_id: 'z', pitch: 0 },
    ] },
    m,
    null
  );
  assert.deepEqual(out, { notes: [{ note_id: 'z', pitch: 5 }] });
});

test('core/remap.js parses as ES5', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'core', 'remap.js'), 'utf8');
  assert.doesNotThrow(() => acorn.parse(src, { ecmaVersion: 5 }));
});

test('the ES5 parse check rejects ES2015 syntax', () => {
  // sanity check that the parser really is ES5-only
  assert.throws(() => acorn.parse('const a = 1;', { ecmaVersion: 5 }));
  assert.throws(() => acorn.parse('var f = () => 1;', { ecmaVersion: 5 }));
});
