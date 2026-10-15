# SliceKit handoff

For the next agent continuing this project **locally, on a machine with Ableton
Live and Max**. Read this file first, then `README.md`, then the docs it points to.

## 1. What this is

SliceKit is a Max for Live **instrument** for micro-sampling and chopping in the
style of Justice / SebastiAn. You load several samples (up to 16). Each is sliced
(transient / beat / region / manual, like Simpler), and **all slices from all
samples are laid out on the MIDI keyboard as one kit**, like several Simplers side
by side. On top of that: shuffle the kit, map slots A–H, per-pad settings (reverse,
pitch, ADSR, micro-loop, filter, drive, layers), repeat / chaos / modifier keys,
and v2 tools (Capture, Gestures, Morph, Scan, Simpler import, Keep clip).

Design decisions the user agreed to (don't revisit without asking them):
- It is a **"super Simpler"**, not a studio and not a 909 with its own patterns:
  Live's MIDI clips are the sequencer. The device only does what Live does badly.
- Play modes like Simpler but **per sample**: Mono / Poly / Thru, Trigger / Gate.
  **Thru follows the original record** (plays from the slice to the end of its own
  file), not the keyboard.
- Reverse is **per pad** and travels with the sound when shuffling.
- Shuffle changes the key→pad map. Recorded clips then play other sounds, which is
  intended. Seeds, undo, locks and map slots make it safe, and Keep clip is the
  opt-in opposite.
- Inspirations already folded in: MPC (chop modes, 16 Levels → Spread, note repeat),
  SP-404 (skip-back → Capture, pad link → Layer), Octatrack (scenes → Morph, random
  slice → Chaos), Morphagene (Scan, micro-loop), Serato Sample (Find best),
  XO / Atlas (Similar ‹ ›, smart shuffle), Output Arcade (modifier keys),
  Stutter Edit (Gestures).

## 2. Where things are

- Repo: `kernelux/kernelux.github.io` (the user's personal Jekyll website).
  SliceKit lives in the self-contained folder `slicekit/` on branch
  **`ccr-da4ae08f-bpew3g`**. It is not merged into `master`, and nothing outside
  `slicekit/` was changed.
- If the user wants it in its own repo, run
  `git subtree split --prefix=slicekit -b slicekit-only` and push that branch to a
  new repo. **Ask first:** creating a repo is the user's call.

```
slicekit/
  README.md            install, quick start, status, table of verified assumptions
  HANDOFF.md           this file
  core/                pure ES5 logic, no Max APIs (unit tested in Node)
    fft.js slicing.js features.js   analysis: onsets, beat/region, zero-cross snap, descriptors
    prng.js model.js                kit state: sources, slices, pads, 8 map slots, undo, shuffle, morph, gestures
    engine.js                       note handling → voice commands (allocation, choke, modes, repeat, mods, gestures, scan, morph)
    remap.js                        Keep clip key/note remapping
    voice-sim.js                    JS reference of the gen~ voice (tests compare it with the GenExpr)
  max/                 Max-side sources
    glue.js            the controller in the [v8] object (bundled with core/ into dist/slicekit.js)
    ui.js              jsui view (sample tabs, waveform + slice editing, key strip)
    voice.genexpr      gen~ codebox for one poly~ voice
    recorder.genexpr   gen~ codebox for the Capture ring recorder
  tools/               build.js (bundle + copy + patchers), build-patchers.js (generates .maxpat),
                       validate-patchers.js, check-es5.js
  dist/                GENERATED, committed: SliceKit.maxpat, slicekit.voice.maxpat, slicekit.js, slicekit-ui.js
  docs/                SPEC.md (product), ARCHITECTURE.md + PROTOCOL.md (binding contracts),
                       VOICE.md (DSP notes + unverified gen~ points), TESTING.md (187-step Live checklist)
  test/                node:test suites (748 tests)
```

## 3. State: code complete, never run in Max or Live

- v1 (everything in `docs/SPEC.md`) and v2 (SPEC §12–17 plus the 16-key modifier
  zone) are implemented.
- An end-to-end audit traced every SPEC feature through
  control → glue → model/engine → voice params or Live API → view.
  Its 8 gaps were fixed.
- `npm run check` is green: build, ES5 lint, patcher validation, 748 tests.
- **None of it has been loaded in Max or Live yet.** The cloud environment it was
  built in has no Max. Your job is to make it actually work in Live.

## 4. Commands

```
cd slicekit
npm install          # dev dependency: acorn (for the ES5 check)
npm run check        # build dist/ + ES5 lint + patcher validation + all tests
npm test             # tests only
npm run build        # regenerate dist/ after any source change
```

Rules:
- **Never hand-edit `dist/`.** Change `core/`, `max/` or `tools/build-patchers.js`,
  then `npm run build`.
- `core/*.js` and `max/*.js` must be **ES5**: no let/const/arrows/classes/template
  literals/Map/Set/includes/fill(value)/Object.assign. Max's legacy `js` object
  needs ES5; `v8` runs it too. `npm run lint` enforces this. Tools and tests may be
  modern JS.
- `voice.genexpr` and `core/voice-sim.js` must stay in step. `test/voice-sim.test.js`
  translates the GenExpr to JS and checks parity with the sim, and also lints the
  GenExpr. If you change one, change the other and run the voice tests.
  `recorder.genexpr` works the same way with `test/recorder.test.js`.
- `docs/ARCHITECTURE.md` and `docs/PROTOCOL.md` are the contracts: message names,
  voice params, view dict, control table. `validate-patchers.js` **parses the
  control table in PROTOCOL.md**, so a new control needs a new row there.
  Each doc's final "v2 additions" / "v2 fixes" sections override earlier text.

## 5. Installing into Live (see README "Install")

1. Live: drop a **Max Instrument** on a MIDI track and click **Edit**.
2. In Max, open `dist/SliceKit.maxpat`. Select all, copy, paste into the device
   (after deleting the default objects). Tick **Open in Presentation** in the
   patcher inspector.
3. Save as `SliceKit.amxd` **inside `dist/`**, next to `slicekit.js`,
   `slicekit-ui.js` and `slicekit.voice.maxpat`, so Max finds them.

Why this route: the `.amxd` format has a binary header we couldn't generate
reliably. If you find a way to build `.amxd` directly, add it to `tools/build.js`.

## 6. Iterating in Max

- The glue bundle sets `autowatch = 0`. After `npm run build`, reload the script by
  re-instantiating the `v8 slicekit.js ---src ---skstate ---skview ---cap` object:
  retype its box text, or close and reopen the device. The jsui reloads the same
  way.
- `slicekit.voice.maxpat` is loaded by `poly~ slicekit.voice 16`. After rebuilding
  it, reopen the device, or retype the poly~ box.
- **Two ways to change the device patch.** (a) Edit `tools/build-patchers.js`,
  rebuild, re-paste (clean, keeps tests valid). (b) Fix it in the Max editor for
  speed, then **port the same fix back into the generator** and make
  `npm run check` pass. Otherwise the next build overwrites it.
- Logs: the glue posts errors to the Max console prefixed `SliceKit:`. gen~ compile
  errors appear in the Max console when the voice / recorder gen~ is instantiated.
  The glue module has a `debug()` export (state snapshot) used by the tests. No Max
  message reaches it yet; wiring a `debug` message that `post()`s it would be a
  cheap first diagnostic.
- On Max 8, change `v8` to `js` in the glue object box (the code is ES5).

## 7. First things to do, in order

1. Load the device and **read the Max console**. Expect a few errors on the first
   launch.
2. **gen~ compile errors** (`max/voice.genexpr`, `max/recorder.genexpr`). Fix them in
   both the GenExpr and `core/voice-sim.js` (or the recorder test translator), keep
   parity green, rebuild. `docs/VOICE.md` lists the GenExpr points we couldn't
   verify: `log` as natural log, `Buffer src;` with no name argument, `poke`
   out-of-range behaviour, `||` / `!=` / negative literals, Param names that might
   clash (`dir`, `tape`, `kill`, `drive`, `playing`, `jump`, `redir`).
3. **Drop a sample** and check that it loads, gets sliced, the view shows the
   waveform and keys, and notes play. If buffers never "load", check the `buffer~`
   right outlet → `loaded <i>` wiring. The glue also polls frame counts as a
   fallback.
4. Work through `docs/TESTING.md` (groups 1–32, 187 steps) and fix what fails.
   Groups 24–31 are the v2 features.
5. Verify the Live API names that the docs couldn't confirm (README table):
   Simpler detection (`class_name` `OriginalSimpler` or `class_display_name`
   `Simpler`), Sample `file_path` and `slices`. If they're wrong, fix them in
   `max/glue.js` and the mocks in `test/glue.test.js`.
6. Save the Set, reopen it, and check that the state comes back. The state lives in
   `dict ---skstate @parameter_enable 1`; forum reports say this sometimes needs a
   save and reopen.

## 8. Assumptions not verified in Max/Live (check these when something breaks)

| area | assumption | where |
|---|---|---|
| gen~ | `src <buffer~>` re-points `Buffer src` through the poly~ `[in 1]` (documented, untested here) | voice.genexpr, glue/engine `src` |
| gen~ | recorder `cap` / `wpb` bindings; gen~ runs with `out1` unconnected | recorder.genexpr, build-patchers |
| poly~ | voice end: gen~ out3 → `edge~` right outlet → `int` (voice # from `thispoly~` on loadbang) → `prepend voiceend` → `out 3` | build-patchers (voice patch) |
| live.text | buttons may send bang or 1/0; every button goes through `[route bang 1]` so it fires once | build-patchers |
| umenu | 1 inlet / 3 outlets; `append` takes a multi-word item | build-patchers, glue `src_simplers` |
| opendialog | `opendialog fold` returns a folder path usable for `writewave` | glue capture |
| JS Buffer | `send('sizeinsamps', n)` is synchronous and keeps channels; `writewave` done within 300 ms | glue capture |
| patcher | `this.patcher.filepath` gives the .amxd path (default capture folder); may fail when frozen | build.js footer, glue |
| Live API | `get_notes_extended` returns a JSON string; `apply_note_modifications` accepts a JS object (fallback: JSON string) | glue keep clip |
| Live API | `live_set view detail_clip`, `this_device canonical_parent`, `playing_slot_index` paths | glue keep clip |
| Live API | tempo / is_playing observers via `new LiveAPI(cb, 'live_set')` after `init` | glue |
| M4L | `---` in the `v8` box arguments resolves to the device-unique prefix | glue args |
| params | the device exposes 89 Live parameters (9 automatable); unknown whether this matters | build-patchers |

## 9. Known limitations / next improvements (not started)

- **The device is about 2,376 px wide.** Split the UI into pages (e.g. a tab
  switching Play / Edit / v2 panels via scripting `hidden`), or move editors into a
  bpatcher. This is the top UX item.
- CPU: all 16 gen~ voices run all the time. Mute idle voices with `thispoly~ mute`.
  The engine knows when voices are free.
- The status says "Limited to 128 slices" even when a sample yields exactly 128
  (the glue can't tell an exact fit from truncation unless slicing reports it).
- Re-link on drop sets `source.path` directly; the model has no `setSourcePath`.
  Add one.
- `voiceend` carries no generation counter, so a stale end message can free a reused
  voice early. Documented in `core/engine.js`.
- Repeat after a sounding hit restarts about 1 ms late (fade before restart); a
  waiting voice restarts exactly on the grid.
- v3 roadmap in SPEC: stem-linked sources (Live 12.3 stems), similarity map view,
  pitch-detected layout.

## 10. Behaviour decisions already made (so you don't "fix" them)

- **Auto slots:** a slot shows the generated layout until a manual edit; manual
  edits turn `auto` off. Re-slicing keeps pad settings and key positions (nearest
  start, explicit mapping for manual cut edits).
- **Chaos** picks a random pad from the current slot's occupied keys, not the
  whole pool.
- **Swing** puts the 2nd line at 0.5 + 0.25×swing of the pair.
- **Repeat:** a held repeating voice stays "active" while waiting between hits (no
  `voiceend`), and turning repeat on restarts a held one-shot that already ended.
- **Priority:** gesture rate > repeat modifier > global Repeat. The most recently
  pressed modifier / gesture wins.
- **Scan** rotates over occupied keys before chaos. It switches held main voices
  through the `jump` voice param without restarting the envelope. Reverse modifier
  uses `redir`.
- **Morph:** linear, cutoff geometric, booleans switch at 50 %. Sounding voices get
  pitch / amp / cutoff / drive live.
- **Keep clip** follows every map change on the current slot (incl. swap, undo,
  sample add / remove / reslice), never slot switching or restore. `Remap clip`
  refuses to apply the same mapping twice.
- Undo is snapshot-based (50 steps). Adding or removing a sample clears history.

## 11. Working conventions

- Run `npm run check` before every commit. Keep tests green; add a test with every
  fix.
- When behaviour changes, update `docs/SPEC.md` (product), `docs/TESTING.md`
  (manual steps) and, for message or param changes, `docs/PROTOCOL.md` /
  `docs/ARCHITECTURE.md`.
- Commit on the same branch (or the user's choice). Don't merge into the website's
  `master` without asking.
- The user writes in English, sometimes with French words. They make music in
  Ableton; explain things in music terms, not code terms.
