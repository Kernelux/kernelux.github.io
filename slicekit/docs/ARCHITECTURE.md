# SliceKit — Architecture & contracts

SliceKit is a Max for Live **instrument**: a pool of slices from many samples, laid
out on the MIDI keyboard as one kit ("several Simplers side by side"), with
shuffle, map slots, repeat, chaos, layers, spread, similar-swap and modifier keys.

This file is the **contract** between modules. Every module must follow the APIs
below exactly; if you need a change, write it in your final report instead of
silently diverging.

## Hard constraints

1. **ES5 only** for everything that runs in Max (`core/*.js`, `max/*.js`):
   `var` only (no `let`/`const`), no arrow functions, no classes, no template
   literals, no destructuring, no spread, no default params, no `for...of`,
   no `Map`/`Set`/`Symbol`/`Promise`, no `Array.prototype.includes/find/fill`,
   no `Object.assign`, no `String.prototype.startsWith/includes/repeat/padStart`.
   Typed arrays (`Float32Array`) and `JSON` are allowed. Max's legacy `js`
   object is ES5; the newer `v8` object runs ES5 too.
   Tests (`test/*.test.js`) and tools (`tools/*.js`) run only in Node 22 and may
   use modern JS.
2. `core/*.js` are **pure**: no Max globals (`outlet`, `post`, `Buffer`, `Dict`,
   `LiveAPI`, `Task`, `messagename`, `jsarguments`). CommonJS:
   `var x = require('./x');` and `module.exports = {...}`. Only relative
   requires of other core modules.
3. `tools/build.js` bundles `core/*.js` + `max/glue.js` into `dist/slicekit.js`
   with a tiny CommonJS shim (Max does not get `require`). So only use
   `require('./name')` with literal strings (a lazy `require` inside a function
   is fine, the shim resolves it at call time).
4. No npm runtime dependencies. Dev dependency allowed: `acorn` (ES5 check).
5. Tests use `node:test` + `node:assert/strict`. Run: `npm test` inside `slicekit/`.
6. Do **not** run git commands that change state (no commit/checkout/stash/reset).

## File layout

```
slicekit/
  package.json            scripts: test, build, lint
  core/
    fft.js                radix-2 FFT helpers
    slicing.js            transient/beat/region slicing, zero-cross snap, overview
    features.js           per-slice descriptors, similarity, clustering, find-best
    prng.js               seeded PRNG + shuffle
    model.js              state: sources, slices, pads, map slots, undo, ops
    engine.js             note handling → voice commands (allocation, modes, repeat…)
    voice-sim.js          JS reference simulation of the gen~ voice (for tests)
  max/
    glue.js               Max-side controller (bundled into dist/slicekit.js)
    ui.js                 jsui view (copied to dist/slicekit-ui.js)
    voice.genexpr         gen~ codebox source for one voice
  tools/
    build.js              bundle + copy + run build-patchers
    build-patchers.js     generates dist/SliceKit.maxpat + dist/slicekit.voice.maxpat
    check-es5.js          acorn ecmaVersion 5 parse of all Max-bound files
    validate-patchers.js  structural check of generated .maxpat files
  test/                   *.test.js
  dist/                   built, committed (users without Node just copy this)
  docs/                   ARCHITECTURE.md, PROTOCOL.md, SPEC.md, TESTING.md
```

## Data model (serializable state, `version: 1`)

```js
state = {
  version: 1,
  nextId: 1,                    // shared id counter for sources, slices, pads
  sources: [Source],            // add order; max 16
  pads: { "<padId>": Pad },     // object keyed by id (string keys)
  slots: [MapSlot, ... x8],     // map slots A..H
  currentSlot: 0,
  globals: Globals
}

Source = {
  id, slot,                     // slot = buffer index 0..15 (lowest free on add)
  name, path,
  frames, sr, channels,         // 0 until the buffer is loaded
  color,                        // palette index 0..15 (= slot by default)
  playMode: 'mono'|'poly'|'thru',
  trigMode: 'trigger'|'gate',
  slicing: {
    mode: 'transient'|'beat'|'region'|'manual',
    sensitivity: 50,            // 0..100
    beatDiv: '1/16',            // see BEAT_DIVS
    regions: 16,
    bpm: 0,                     // 0 = auto-estimate
    minSliceMs: 30,
    snap: true                  // snap points to zero crossings
  },
  slices: [Slice]               // sorted by start, contiguous, cover [0, frames)
}

Slice = { id, start, end, features: Features|null }   // frames, end exclusive

Features = { durMs, peakDb, rmsDb, attackMs, centroidHz, zcr }

Pad = {
  id, sourceId, sliceId,
  base: true,                   // true = the default pad of its slice
  reverse: false,
  pitch: 0,                     // semitones -48..48
  fine: 0,                      // cents -100..100
  gainDb: 0,                    // -60..12
  attackMs: 0, decayMs: 300, sustain: 1, releaseMs: 30,   // sustain 0..1
  startOffsetMs: 0,             // 0..1000, clamped to slice length
  loopOn: false, loopSizeMs: 30, loopPos: 0,              // loopPos 0..1
  cutoffHz: 20000, drive: 0,    // drive 0..1
  layers: [],                   // up to 3 other padIds triggered together
  origSliceId: null, simIndex: 0  // similar-swap cursor (0 = original)
}

MapSlot = { keys: [128 x padId|null], locks: [128 x bool], auto: true }

Globals = {
  rootKey: 36, layout: 'zones'|'interleave'|'sorted', zoneAlign: false,
  sortBy: 'brightness'|'loudness'|'length',
  chokeScope: 'source'|'global',
  chaos: 0,                     // 0..100
  repeatOn: false, repeatDiv: '1/16', swing: 0, repeatAlt: false,
  shuffleMode: 'chaos'|'smart', shuffleScope: 'all'|'source', seed: 1, flipPct: 0,
  modZoneOn: false, modZoneStart: 96,
  velSens: 50, pressureToLevel: false,
  bestN: 16, spreadParam: 'pitch', spreadCount: 16, spreadStep: 1
}
```

Constants (exported by `core/model.js` as `Model.CONST`):

```js
BEAT_DIVS   = ['1/16','1/16T','1/8','1/8T','1/4','1/4T','1/2','1/2T','1 Bar','2 Bars','4 Bars']
BEAT_DIV_BEATS = [0.25, 1/6, 0.5, 1/3, 1, 2/3, 2, 4/3, 4, 8, 16]   // beats per slice
REPEAT_DIVS = ['1/4','1/8','1/8T','1/16','1/16T','1/32','1/32T','1/64']
REPEAT_PER_BEAT = [1, 2, 3, 4, 6, 8, 12, 16]                       // repeats per beat
MOD_ACTIONS = ['rpt:1/4','rpt:1/8','rpt:1/8T','rpt:1/16','rpt:1/16T','rpt:1/32',
               'rpt:1/64','reverse','octdown','octup','tape','chaos',
               'gest:0','gest:1','gest:2','gest:3']                    // offset 0..15 (v2: 16 keys)
MAX_SOURCES = 16, NUM_SLOTS = 8, NUM_KEYS = 128, MAX_LAYERS = 3
```

### Policies (model)

- **Auto slots**: a slot with `auto: true` always shows the generated layout.
  Structural changes (add/remove/reslice source, layout-affecting globals)
  re-apply the layout to every auto slot. Any manual op on a slot
  (shuffle, lock, spread, duplicate, assign, swap, clear, findBest, similar,
  layer) sets that slot's `auto = false`. `applyLayout(slot)` sets `auto = true`.
- **Layout** fills keys upward from `rootKey`, skipping locked keys (they keep
  their pad) and mod-zone keys. Only `base` pads are laid out. Overflow past key
  127 is dropped; `applyLayout` returns `{placed, dropped}`.
  - `zones`: sources in add order, slices in time order. With `zoneAlign`, each
    source after the first starts at the next key `k` with `(k - rootKey) % 12 == 0`.
  - `interleave`: round-robin across sources (s0[0], s1[0], s2[0], s0[1], ...).
  - `sorted`: all base pads sorted ascending by `centroidHz` (brightness),
    `rmsDb` (loudness) or `durMs` (length); slices without features last.
- **Reslice** (`setSlices`): every existing pad of the source is re-pointed to the
  new slice with the nearest `start` (pad settings and key positions survive).
  Each new slice must end up with exactly one `base` pad: among pads pointing at
  it, the lowest id that was base stays base, other former-base pads become
  `base:false`; new slices with no pad get a fresh base pad. Auto slots are
  re-laid-out; non-auto slots get the brand-new pads appended after their highest
  occupied key.
- **Remove source**: its pads are deleted, keys holding them are cleared in all
  slots, auto slots re-laid-out.
- **Shuffle** (current slot): keys in scope = keys with a pad, not locked, not
  mod-zone (scope `source` additionally requires the pad's source = `sourceId`).
  `chaos`: seeded Fisher–Yates permutation of those pads over those keys.
  `smart`: cluster those pads by features (k = max(1, round(n/6)), seeded
  k-means on normalized features; pads without features form their own cluster)
  and permute only within clusters, so each key gets a similar sound.
  Flip: each moved key, with probability `flipPct/100` (same seeded rng), gets a
  **copy** of its pad with `reverse` toggled (`base:false`) so other slots are
  unaffected. Deterministic for the same state + seed.
- **Undo**: snapshot-based (`JSON` of pads/slots/currentSlot/sources' slices and
  settings), max 50 steps. Consecutive `setPadParam` calls on the same pad+param
  coalesce into one step. `addSource`/`removeSource` clear the undo history.
- **Spread** (`spread(key, param, count, step)`): level 0 = the pad on `key`
  unchanged; levels 1..count-1 are copies placed on the following keys (skipping
  locked and mod-zone keys) with `param` = base + i*step. `pitch`: semitones;
  `decay`: ms (clamp ≥ 0); `start`: startOffsetMs (clamp ≥ 0); `cutoff`:
  `cutoffHz * 2^(i*step/12)` clamped 20..20000.
- **Similar swap** (`swapSimilar(key, dir)`): ranking = all slices with features,
  sorted by distance to the pad's `origSliceId` (set to the current slice on first
  swap; index 0 = original). `simIndex += dir` (clamped); pad's `sliceId`/`sourceId`
  change, settings stay.
- **Find best** (`findBest(n)`): pick n slices across all sources (features.findBest),
  clear unlocked non-mod keys of the current slot, place their base pads from
  `rootKey`.

## Module APIs

### core/fft.js
```js
fft(re, im)            // in-place radix-2, length power of 2 (Float64Array or Float32Array)
magnitudeSpectrum(frame /*Float32Array len N pow2*/, window /*Float32Array|null*/) -> Float32Array(N/2+1)
hann(N) -> Float32Array
```

### core/slicing.js
```js
toMono(channels /*Array<Float32Array>*/) -> Float32Array
onsetFunction(mono, sr, opts?) -> { odf: Float32Array, hop: int }      // spectral flux
detectTransients(mono, sr, { sensitivity, minSliceMs, maxSlices }) -> int[]  // start frames, first is 0
beatPoints(frames, sr, { bpm, beatDiv, offsetFrames }) -> int[]            // beatDiv string from BEAT_DIVS
regionPoints(frames, n) -> int[]
estimateBpm(mono, sr, { minBpm: 70, maxBpm: 180 }) -> number|null
snapToZeroCrossings(mono, points, maxSearchFrames) -> int[]                 // keeps 0, sorted, unique
pointsToRanges(points, totalFrames, minFrames) -> [{start, end}]            // drops too-close points
sliceSource(mono, sr, slicingSettings /*Source.slicing*/) -> [{start, end}] // full pipeline
overview(mono, columns) -> Float32Array(2*columns)                          // [min0,max0,min1,max1,...]
```
`maxSlices` default 128. Sensitivity 0 → few slices, 100 → many.
`sliceSource` with mode `manual` returns `[{start:0,end:frames}]` (manual
points live in the model).

### core/features.js
```js
sliceFeatures(mono, sr, start, end) -> Features
computeAll(mono, sr, ranges /*[{start,end}]*/) -> Features[]
normalize(featuresList /*Features[]*/) -> number[][]     // z-scored vectors; dims: log durMs, rmsDb, attackMs, log centroidHz, zcr
distance(a, b) -> number                                  // euclidean on normalized vectors
rankSimilar(targetIndex, featuresList) -> int[]           // indices sorted by distance, target first
kmeans(vectors, k, rng /*function -> [0,1)*/) -> int[]    // labels, deterministic for a given rng
findBest(featuresList, n, { diversity: 0.5 }) -> int[]    // indices; strong + diverse (greedy)
```

### core/prng.js
```js
mulberry32(seed) -> function () { return float in [0,1) }
shuffleInPlace(array, rng) -> array        // Fisher–Yates
randInt(rng, n) -> int in [0, n)
```

### core/model.js
```js
var Model = require('./model');
Model.CONST                      // constants above
Model.PALETTE                    // 16 hex strings, see PROTOCOL.md
Model.create(deps?) -> model     // deps = { features: <features module> } (default require('./features'))
Model.fromJSON(obj, deps?) -> model

model.state                      // live state object (read-only for callers)
model.toJSON() -> plain object (deep copy)
model.onChange(fn)               // fn(kind) after each mutation; kind in 'sources'|'slices'|'pads'|'map'|'globals'|'all'

// sources
model.addSource({ name, path }) -> Source|null       // null when 16 sources
model.setSourceInfo(sourceId, { frames, sr, channels })
model.removeSource(sourceId)
model.getSource(id) / model.getSourceBySlot(slot) / model.listSources()
model.setSourceSettings(sourceId, partial)          // playMode, trigMode, color, and slicing.* keys at top level of partial:
                                                    // { mode, sensitivity, beatDiv, regions, bpm, minSliceMs, snap }
model.setSlices(sourceId, ranges)                   // reslice policy; new slices get features:null
model.setSliceFeatures(sourceId, featuresArray)     // aligned with source.slices
model.addSlicePoint(sourceId, frame)                // manual edits → mode 'manual'
model.moveSlicePoint(sourceId, sliceIndex, frame)   // moves start of slice i (i>0), clamped between neighbours
model.removeSlicePoint(sourceId, sliceIndex)        // merges slice i into i-1 (i>0)
model.getSlice(sliceId) -> Slice (with extra .sourceId)
model.getSlicesOfSource(sourceId) -> Slice[]

// pads
model.getPad(padId)
model.getPadOnKey(key, slot?) -> Pad|null            // slot defaults to current
model.setPadParam(padId, name, value)                // names = Pad field names above (not id/sourceId/sliceId/base/layers)
model.applyParamToSource(padId, name)
model.duplicatePad(fromKey, toKey) -> Pad|null
model.toggleLayer(key, otherKey) -> bool             // true if now layered
model.swapSimilar(key, dir) -> Pad|null
model.spread(key, param, count, step) -> int[]       // keys written

// keys & slots
model.currentSlot()                                  // getter (function)
model.setCurrentSlot(i)
model.getSlotKeys(slot?) -> (padId|null)[]
model.isLocked(key, slot?) / model.setLock(key, bool) / model.toggleLock(key)
model.isModKey(key) / model.modOffset(key) -> 0..11 or -1
model.clearKey(key) / model.swapKeys(a, b) / model.assignPad(key, padId)
model.copySlot(from, to)
model.applyLayout(slot?) -> { placed, dropped }
model.shuffle({ mode, scope, sourceId, seed, flipPct }) -> { moved }
model.findBest(n) -> { placed }
model.occupiedKeys(slot?) -> int[]                   // keys with pads, excluding mod-zone keys

// globals
model.globals()                                      // getter (function) -> Globals object
model.setGlobal(name, value)                         // validates/clamps; layout-affecting keys re-layout auto slots

// undo
model.undo() / model.redo() / model.canUndo() / model.canRedo()
```

### core/engine.js
```js
var Engine = require('./engine');
var e = Engine.create({ model, numVoices: 16, rng: Math.random,
                        bufferName: function (slot) { return 'src' + slot; } });
e.noteOn(key, vel) -> Command[]          // vel 0 → noteOff
e.noteOff(key) -> Command[]
e.pressure(value /*0..127*/) -> Command[]
e.polyPressure(key, value) -> Command[]
e.voiceEnded(voiceIndex /*0-based*/)
e.setTransport({ bpm, playing }) -> Command[]
e.refreshHeld() -> Command[]             // re-apply repeat/global changes to held voices
e.panic() -> Command[]
e.activeKeys() -> int[]

Command = { voice: int /* 0-based, -1 = all voices */, params: [[name, value], ...] }
```
Voice parameter names/semantics: see PROTOCOL.md §Voice. Engine uses only the
model methods listed above (`getPadOnKey`, `getPad`, `getSlice`, `getSource`,
`isModKey`, `modOffset`, `occupiedKeys`, `globals`).

### core/voice-sim.js
JS mirror of `max/voice.genexpr` for tests:
```js
VoiceSim.create({ sampleRate, buffer: { channels: [Float32Array...], sr } })
sim.set(name, value)          // same param names as the gen~ voice
sim.process(n, beatPhase /*function(i)->0..1 | null*/) -> { left: Float32Array, right: Float32Array, active: Float32Array }
```

## v2 additions (binding)

These sections extend the v1 contract above and override it where they differ
(e.g. the mod zone is now 16 keys).

### Constants (add to `Model.CONST`; engine keeps local copies)
```js
MOD_ZONE_SIZE = 16                       // mod zone = modZoneStart .. modZoneStart+15, modZoneStart 0..112
GEST_BEATS        = [0.25, 0.5, 1, 2, 4, 8, 16]
GEST_BEATS_LABELS = ['1/16 bar','1/8 bar','1 beat','2 beats','1 bar','2 bars','4 bars']
GEST_RATES        = ['off','1/4','1/8','1/8T','1/16','1/16T','1/32','1/32T','1/64']   // 'off' + REPEAT_DIVS
CAPTURE_BARS      = ['1/2 Bar','1 Bar','2 Bars','4 Bars','8 Bars']
CAPTURE_BEATS     = [2, 4, 8, 16, 32]
MORPH_PARAMS      = ['pitch','fine','gainDb','attackMs','decayMs','sustain','releaseMs',
                     'startOffsetMs','loopSizeMs','loopPos','cutoffHz','drive','reverse','loopOn']
```

### Data model additions
```js
Pad.morph = {}            // B values: { <MORPH_PARAMS name>: value }, only the params that were set
Globals += {
  morph: 0, morphEdit: false,          // morph 0..100
  scan: 0,                             // 0..100
  keepClip: false,
  captureBars: '2 Bars', captureFolder: '',
  gestureSel: 0,
  gestures: [Gesture x4]
}
Gesture = { name, beats, rateFrom, rateTo, cutFrom, cutTo, pitchFrom, pitchTo, ampFrom, ampTo, curve }
// defaults
// 0 'Build' beats 4  rate '1/8'->'1/64'  cut 20000->1200  pitch 0->0    amp 1->1    curve 0.3
// 1 'Rise'  beats 4  rate '1/16'->'1/16' cut 20000->20000 pitch 0->12   amp 1->1    curve 0
// 2 'Drop'  beats 2  rate 'off'->'off'   cut 20000->600   pitch 0->-24  amp 1->0.6  curve 0.5
// 3 'Fade'  beats 4  rate '1/32'->'1/32' cut 20000->20000 pitch 0->0    amp 1->0    curve 0
```
`fromJSON` fills all of these with defaults for v1 states (old saved sets must still load).
Copies (duplicate, flip, spread, similar-swap copies) keep `morph`.

### Model API additions (core/model.js)
```js
model.setPadMorphParam(padId, name, value)   // MORPH_PARAMS only; same clamps as setPadParam; undoable, coalesced like setPadParam
model.copyPadToMorph(padId) / model.clearPadMorph(padId)
model.copyAllToMorph() / model.clearAllMorph()
model.applyMorphParamToSource(padId, name)   // copy this pad's B value of `name` to all pads of the same source
model.effectivePad(padId, m /*0..1*/) -> plain object with every Pad field, morph applied:
    numbers: A + (B - A) * m; cutoffHz geometric: A * (B/A)^m; booleans (reverse, loopOn): m >= 0.5 ? B : A;
    params without a B value stay A. Returns null for an unknown pad.
model.setGestureParam(index 0..3, name, value) // names: name, beats (number in GEST_BEATS or index), rateFrom/rateTo
                                               // ('off'/REPEAT_DIVS string or index into GEST_RATES), cutFrom/cutTo 20..20000,
                                               // pitchFrom/pitchTo -48..48, ampFrom/ampTo 0..1, curve 0..1
model.getGesture(index) -> Gesture
model.setGlobal(...) accepts: morph, morphEdit, scan, keepClip, captureBars (string or index), captureFolder (string), gestureSel 0..3
model.isModKey / modOffset use the 16-key zone; modZoneStart clamps to 0..112.
```

### Engine API additions (core/engine.js)
```js
Engine.create({ ..., now: function () { return Date.now(); } })   // ms clock, injectable for tests
e.tick() -> Command[]          // advance active gesture ramps; send changed params to sounding voices
e.needsTick() -> bool          // true while a gesture modifier is held
e.refreshMorph() -> Command[]  // morph changed: sounding voices get pitch/amp/cutoff/drive from effectivePad
e.refreshScan() -> Command[]   // scan changed: held main voices switch to the rotated pad's slice (src, bufsr,
                               // pstart, pend, dir, loopsize, looppos, pitch, amp, cutoff, drive) without trig
```
Semantics:
- **Morph**: every place the engine reads pad params it uses `model.effectivePad(pad.id, globals().morph/100)`
  (fall back to the pad itself if the model has no `effectivePad`).
- **Scan**: for a non-mod key k, occ = `occupiedKeys()` (ascending); if scan > 0 and occ has ≥ 2 keys and k is in occ,
  play the pad on `occ[(idx + round(scan/100*(occ.length-1))) % occ.length]`. Applied before chaos.
- **Gestures** (`gest:i` mod keys): most recently pressed held gesture is active; progress
  t = clamp((now - start) / (beats*60000/bpm), 0, 1), shaped u = t^(1 + 4*curve).
  - rate: if both from/to are 'off' the gesture does not touch repeat; if one is 'off' the other is used
    for the whole gesture; else interpolate log2(REPEAT_PER_BEAT) and snap to the nearest REPEAT_PER_BEAT value.
    Gesture rate has priority over repeat modifiers, which have priority over the global repeat.
  - cutoff: g = cutFrom * (cutTo/cutFrom)^u; voice cutoff = clamp(padCutoff * g / 20000, 20, 20000).
  - pitch: + (pitchFrom + (pitchTo - pitchFrom) * u) semitones (on top of octave mods).
  - amp: × (ampFrom + (ampTo - ampFrom) * u).
  - Applies to sounding voices and to notes started while it is held; on release everything reverts.
  - `tick()` only emits params whose value changed (rptdiv) or moved by more than a small epsilon.

### core/remap.js (new, pure ES5)
```js
keyMapping(oldKeys /*128 padId|null*/, newKeys) -> int[128]
    // for each key k whose pad p moved: the key in newKeys holding p nearest to k; else k (unchanged / pad gone)
changedCount(mapping) -> int
remapNotes(notesDict /*{notes:[{note_id,pitch,start_time,duration,velocity,mute,...}]}*/, mapping, isProtected /*fn(key)->bool*/)
    -> { notes: [...changed notes with new pitch, all other fields kept] }   // protected (mod-zone) and unmapped notes untouched
```
