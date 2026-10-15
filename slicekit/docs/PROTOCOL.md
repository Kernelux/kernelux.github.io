# SliceKit — Max protocol

How the Max pieces talk to each other: patch topology, glue messages, UI
controls, the gen~ voice parameters and the jsui view dict.

## Patch topology (device patcher `SliceKit.maxpat`)

```
[live.thisdevice] --bang--> [init( ---------------------------------------\
[midiin] -> [midiparse]                                                    |
     out0 (note list)       -> [prepend note]         ------------------->|
     out1 (poly pressure)   -> [prepend polypressure] ------------------->|
     out4 (aftertouch int)  -> [prepend pressure]     ------------------->|
[live.drop] -> [prepend drop] ------------------------------------------->|
[live.text Load] -> [opendialog sound] -> [prepend load] ---------------->|
UI controls -> [prepend source|pad|kit <param>] ------------------------->|
[jsui slicekit-ui.js] -> [prepend ui] ----------------------------------->|
[poly~ ...] outlet 2 (voiceend <i>) ------------------------------------->|
[buffer~ ---src<i>] right outlet -> [t b] -> [loaded <i>( --------------->|
                                                                           v
                     [v8 slicekit.js ---src ---skstate ---skview]   (inlet 0 gets everything)
                      out0 -> [poly~ slicekit.voice 16]
                      out1 -> [route 0 1 2 ... 15] -> each -> [buffer~ ---src<i>]
                      out2 -> [route <feedback names>] -> [prepend set] -> control
                      out3 -> [jsui]   (viewdict <name>, refresh)
[plugphasor~] -> [poly~] inlet 0 (signal: beat phase 0..1)
[poly~] outlet 0 (L), 1 (R) -> [live.gain~ Output] -> [plugout~ 1 2]
[dict ---skstate @parameter_enable 1]   (state saved with the Live Set)
[dict ---skview]                        (view model for jsui)
```

Notes
- `---` is replaced by Max for Live with a per-device-instance number, so two
  SliceKit instances never share buffers or dicts. The glue gets the resolved
  names from its arguments: `jsarguments[1]` = buffer prefix (buffer i is
  `prefix + i`), `jsarguments[2]` = state dict name, `jsarguments[3]` = view dict name.
- The glue object is `v8` (Max 9). Because the code is ES5 the user can swap it
  to `js` on Max 8 without other changes.
- 16 buffers `---src0` … `---src15` exist in the patch from the start.

## Glue inlet messages (patch → glue)

| message | meaning |
|---|---|
| `init` | device ready (live.thisdevice). Restore state from the state dict, start LiveAPI observers for `live_set tempo` and `live_set is_playing`, send `viewdict <name>` to the jsui. |
| `drop <path>` / `load <path>` | add a sample. |
| `loaded <bufIndex>` | buffer~ finished reading. (Glue also polls with a Task as a fallback.) |
| `note <pitch> <vel>` | MIDI note (vel 0 = note off). |
| `polypressure <pitch> <value>` | poly aftertouch. |
| `pressure <value>` | channel aftertouch. |
| `voiceend <voice 1-based>` | a poly~ voice went silent. |
| `source <param> <value>` | edit the **selected sample**. params: `playmode 0..2` (mono/poly/thru), `trigmode 0..1` (trigger/gate), `slicemode 0..3` (transient/beat/region/manual), `sensitivity 0..100`, `beatdiv <index into BEAT_DIVS>`, `regions <n>`, `bpm <float, 0=auto>`, `minslice <ms>`, `snap 0..1`, `reslice`, `remove`. Changing slicemode/sensitivity/beatdiv/regions/bpm/minslice/snap reslices immediately. |
| `pad <param> <value>` | edit the pad on the **selected key**. params: `reverse 0/1`, `pitch st`, `fine cents`, `gain dB`, `attack ms`, `decay ms`, `sustain 0..100`, `release ms`, `start ms`, `loop 0/1`, `loopsize ms`, `looppos 0..100`, `cutoff Hz`, `drive 0..100`, `lock 0/1`, `similar -1/1`, `layerarm 0/1`, `duparm 0/1`, `spreadparam 0..3` (pitch/decay/start/cutoff), `spreadcount n`, `spreadstep x`, `spread`, `applysource` (copy the last edited pad param to all pads of the same sample), `clear`. |
| `kit <param> <value>` | kit/global: `slot 0..7`, `copyslot 0..7` (copy current slot to target), `layout 0..2` (zones/interleave/sorted), `zonealign 0/1`, `sortby 0..2` (brightness/loudness/length), `root <key>`, `relayout`, `shuffle`, `shufflemode 0/1` (chaos/smart), `shufflescope 0/1` (all/sample), `seed n`, `flip 0..100`, `undo`, `redo`, `bestn n`, `findbest`, `chokescope 0/1` (sample/all), `modzone 0/1`, `modstart <key>`, `velsens 0..100`, `chaos 0..100`, `repeat 0/1`, `rate <index into REPEAT_DIVS>`, `swing 0..100`, `alt 0/1`, `pressure2level 0/1`, `panic`. |
| `ui <action> ...` | from jsui: `selectsource <index>`, `selectkey <key>`, `audition <key> <vel>`, `auditionoff <key>`, `selectslice <sliceIndex>`, `addslice <frame>`, `moveslice <sliceIndex> <frame>`, `removeslice <sliceIndex>`, `lock <key>` (toggle). |

Arming: when `layerarm` is on, the next `ui selectkey k` toggles the pad on `k`
as a layer of the selected pad (selection stays), then disarms. Same for
`duparm`: the next selected key receives a duplicate of the selected pad.

Automatable parameters (Live remembers them, they may arrive before `init`):
`kit slot`, `kit chaos`, `kit repeat`, `kit rate`, `kit swing`, `kit alt`.
The glue caches the last value of each and re-applies them after restoring the
state dict, so Live's automation/recall wins over the dict.

Shuffle: uses `globals.seed`, then increments the seed and sends `kit_seed` feedback.

## Glue outlets (glue → patch)

| outlet | format |
|---|---|
| 0 → poly~ | `target <n>` (1-based voice, 0 = all) followed by `<param> <value>` messages for that voice; see §Voice. |
| 1 → buffers | `<bufIndex> replace <path>` or `<bufIndex> clear` (route strips the index). |
| 2 → controls | `<feedback name> <value>` (see table); patch routes each to `[prepend set]` → control so it does not echo. |
| 3 → jsui | `viewdict <dictName>`, `refresh`. |

## UI controls

`vis`: `A` = automatable + stored by Live (parameter_invisible 0), `H` = hidden
(parameter_invisible 2; glue restores these from the state dict).

| varname | object | range / items | sends | feedback name | vis |
|---|---|---|---|---|---|
| sk_drop | live.drop | — | `drop <path>` | — | — |
| sk_load | live.text (button) "Load" | → opendialog | `load <path>` | — | H |
| sk_src_playmode | live.tab | Mono, Poly, Thru | `source playmode` | src_playmode | H |
| sk_src_trigmode | live.tab | Trig, Gate | `source trigmode` | src_trigmode | H |
| sk_src_slicemode | live.menu | Transient, Beat, Region, Manual | `source slicemode` | src_slicemode | H |
| sk_src_sens | live.dial | 0–100 % | `source sensitivity` | src_sensitivity | H |
| sk_src_beatdiv | live.menu | BEAT_DIVS | `source beatdiv` | src_beatdiv | H |
| sk_src_regions | live.numbox | 2–128 int | `source regions` | src_regions | H |
| sk_src_bpm | live.numbox | 0–250 float | `source bpm` | src_bpm | H |
| sk_src_minslice | live.numbox | 5–500 ms | `source minslice` | src_minslice | H |
| sk_src_snap | live.text (toggle) "Snap" | 0/1 | `source snap` | src_snap | H |
| sk_src_reslice | live.text (button) "Reslice" | — | `source reslice` | — | H |
| sk_src_remove | live.text (button) "Remove" | — | `source remove` | — | H |
| sk_pad_reverse | live.text (toggle) "Rev" | 0/1 | `pad reverse` | pad_reverse | H |
| sk_pad_pitch | live.dial | -48–48 st | `pad pitch` | pad_pitch | H |
| sk_pad_fine | live.dial | -100–100 ct | `pad fine` | pad_fine | H |
| sk_pad_gain | live.dial | -60–12 dB | `pad gain` | pad_gain | H |
| sk_pad_attack | live.dial | 0–2000 ms (exp) | `pad attack` | pad_attack | H |
| sk_pad_decay | live.dial | 0–5000 ms (exp) | `pad decay` | pad_decay | H |
| sk_pad_sustain | live.dial | 0–100 % | `pad sustain` | pad_sustain | H |
| sk_pad_release | live.dial | 0–5000 ms (exp) | `pad release` | pad_release | H |
| sk_pad_start | live.dial | 0–1000 ms | `pad start` | pad_start | H |
| sk_pad_loop | live.text (toggle) "Loop" | 0/1 | `pad loop` | pad_loop | H |
| sk_pad_loopsize | live.dial | 1–500 ms (exp) | `pad loopsize` | pad_loopsize | H |
| sk_pad_looppos | live.dial | 0–100 % | `pad looppos` | pad_looppos | H |
| sk_pad_cutoff | live.dial | 20–20000 Hz (exp) | `pad cutoff` | pad_cutoff | H |
| sk_pad_drive | live.dial | 0–100 % | `pad drive` | pad_drive | H |
| sk_pad_lock | live.text (toggle) "Lock" | 0/1 | `pad lock` | pad_lock | H |
| sk_pad_simprev | live.text (button) "‹ Sim" | — | `pad similar -1` | — | H |
| sk_pad_simnext | live.text (button) "Sim ›" | — | `pad similar 1` | — | H |
| sk_pad_layer | live.text (toggle) "Layer" | 0/1 | `pad layerarm` | pad_layerarm | H |
| sk_pad_dup | live.text (toggle) "Dup" | 0/1 | `pad duparm` | pad_duparm | H |
| sk_pad_spreadparam | live.menu | Pitch, Decay, Start, Cutoff | `pad spreadparam` | pad_spreadparam | H |
| sk_pad_spreadcount | live.numbox | 2–16 int | `pad spreadcount` | pad_spreadcount | H |
| sk_pad_spreadstep | live.numbox | -24–24 float | `pad spreadstep` | pad_spreadstep | H |
| sk_pad_spread | live.text (button) "Spread" | — | `pad spread` | — | H |
| sk_pad_apply | live.text (button) "→ Sample" | — | `pad applysource` | — | H |
| sk_pad_clear | live.text (button) "Clear" | — | `pad clear` | — | H |
| sk_slot | live.tab | A–H | `kit slot` | kit_slot | A |
| sk_copyslot | live.menu | Copy→A … Copy→H | `kit copyslot` | — | H |
| sk_layout | live.menu | Zones, Interleave, Sorted | `kit layout` | kit_layout | H |
| sk_zonealign | live.text (toggle) "Oct" | 0/1 | `kit zonealign` | kit_zonealign | H |
| sk_sortby | live.menu | Bright, Loud, Length | `kit sortby` | kit_sortby | H |
| sk_root | live.numbox (MIDI note) | 0–127 | `kit root` | kit_root | H |
| sk_relayout | live.text (button) "Layout" | — | `kit relayout` | — | H |
| sk_shuffle | live.text (button) "Shuffle" | — | `kit shuffle` | — | H |
| sk_shufflemode | live.tab | Chaos, Smart | `kit shufflemode` | kit_shufflemode | H |
| sk_shufflescope | live.tab | All, Sample | `kit shufflescope` | kit_shufflescope | H |
| sk_seed | live.numbox | 0–9999 int | `kit seed` | kit_seed | H |
| sk_flip | live.dial | 0–100 % | `kit flip` | kit_flip | H |
| sk_undo | live.text (button) "Undo" | — | `kit undo` | — | H |
| sk_redo | live.text (button) "Redo" | — | `kit redo` | — | H |
| sk_bestn | live.numbox | 4–64 int | `kit bestn` | kit_bestn | H |
| sk_best | live.text (button) "Find best" | — | `kit findbest` | — | H |
| sk_chokescope | live.tab | Sample, All | `kit chokescope` | kit_chokescope | H |
| sk_modzone | live.text (toggle) "Mods" | 0/1 | `kit modzone` | kit_modzone | H |
| sk_modstart | live.numbox (MIDI note) | 0–116 | `kit modstart` | kit_modstart | H |
| sk_velsens | live.dial | 0–100 % | `kit velsens` | kit_velsens | H |
| sk_pressure | live.text (toggle) "Press" | 0/1 | `kit pressure2level` | kit_pressure2level | H |
| sk_chaos | live.dial | 0–100 % | `kit chaos` | — | A |
| sk_repeat | live.text (toggle) "Repeat" | 0/1 | `kit repeat` | — | A |
| sk_rate | live.menu | REPEAT_DIVS | `kit rate` | — | A |
| sk_swing | live.dial | 0–100 % | `kit swing` | — | A |
| sk_alt | live.text (toggle) "Alt" | 0/1 | `kit alt` | — | A |
| sk_out | live.gain~ "Output" | -70–6 dB | audio | — | A |
| sk_ui | jsui (slicekit-ui.js) | — | `ui ...` | — | — |

## Voice (gen~ inside `slicekit.voice.maxpat`, one per poly~ voice)

poly~ voice patch: `[in 1]` (messages) and `[in~ 1]` (beat phase signal) both go
into gen~ inlet 0. gen~ outlets: 0 → `[out~ 1]`, 1 → `[out~ 2]`, 2 (active
0/1 signal) → `[edge~]` right outlet (falling edge) → `[int]` holding the
voice index from `[thispoly~]` (banged at loadbang) → `[prepend voiceend]` → `[out 3]`.
So poly~ outlets are 0 = L, 1 = R, 2 = messages.

gen~ inputs: `in1` = host beat phase (0..1 ramp per beat, from plugphasor~).

Messages (all are gen~ `Param`s set by `<name> <value>`, except `src`, which
rebinds the codebox `Buffer src` to the buffer~ named by the value):

| name | unit | meaning |
|---|---|---|
| `src` | buffer~ name | buffer to read |
| `bufsr` | Hz | buffer sample rate (playback rate × bufsr / samplerate) |
| `pstart` | frames | playhead start (float) |
| `pend` | frames | stop position; if `dir` = 1 then pend > pstart, if `dir` = -1 then pend < pstart |
| `dir` | ±1 | playback direction |
| `pitch` | semitones | rate = 2^(pitch/12) × bufsr / samplerate × tape factor |
| `amp` | linear | gain incl. velocity (smoothed ~5 ms) |
| `att`, `dec`, `rel` | ms | envelope segments |
| `sus` | 0..1 | sustain level |
| `gatemode` | 0/1 | 1 = gate: held→0 starts release. 0 = trigger: held→0 only stops repeat & loop, the hit plays to its end. |
| `held` | 0/1 | key held (named `held` because `gate` is a gen~ operator) |
| `loopon` | 0/1 | micro-loop |
| `loopsize` | frames | loop length (clamped to slice) |
| `looppos` | 0..1 | loop start position within the played range |
| `rptdiv` | repeats per beat | 0 = off; retrigger at grid lines while held = 1 |
| `rptswing` | 0..1 | delays every 2nd grid line by up to 1/4 of a pair (0.5→0.75 of the pair) |
| `rptalt` | 0/1 | alternate direction on each repeat |
| `cutoff` | Hz | 2-pole low-pass, ≥ 19000 = bypass |
| `drive` | 0..1 | tanh saturation amount |
| `tape` | 0/1 | 1 = rate falls to 0 over `tapems`, 0 = back to normal |
| `tapems` | ms | tape stop time |
| `bpm` | BPM | for the free-running grid when the transport is stopped |
| `playing` | 0/1 | 1 = use `in1` host phase for the repeat grid |
| `trig` | counter | any change (re)starts the voice from `pstart` (≈1 ms fade-out first if sounding) |
| `kill` | counter | any change = fast fade-out (≈2 ms) then silent (choke) |

Engine send order when starting a voice: `src`, `bufsr`, `pstart`, `pend`, `dir`,
`pitch`, `amp`, `att`, `dec`, `sus`, `rel`, `gatemode`, `loopon`, `loopsize`,
`looppos`, `rptdiv`, `rptswing`, `rptalt`, `cutoff`, `drive`, `tape`, `tapems`,
`held 1`, then `trig <n>` last.

Thru: `pend` = source end (`frames`) forward, `0` reversed. Reverse (non-thru):
`pstart` = slice end, `pend` = slice start, `dir` = -1. Start offset moves the start
inward (forward: slice.start+offset, reverse: slice.end-offset).

## View dict (`---skview`, written by glue, read by jsui on `refresh`)

```js
{
  status: "string shown at the bottom",
  palette: [16 hex strings],
  sources: [{ index, id, name, color, playMode, trigMode, slices: n, loaded: 0|1 }],
  selectedSource: index | -1,
  selectedFrames: n,                       // frame count of the selected source (0 if none)
  wave: [min0, max0, min1, max1, ...],     // overview of the selected source, 512 columns
  slices: [[startNorm, endNorm], ...],     // selected source slices, 0..1
  selectedSlice: index | -1,
  keys: [128 ints],                         // palette index of the source on each key, -1 = empty
  keyFlags: [128 ints],                     // bitmask: 1 locked, 2 reversed, 4 has layers, 8 mod zone, 16 sounding, 32 non-base copy
  selectedKey: key | -1,
  rootKey: n,
  slot: 0..7,
  armed: "" | "layer" | "dup"
}
```

## Palette (index → color)

```
0 #FF5A5A  1 #FFA54A  2 #FFD84A  3 #9BE35A  4 #3FCF8E  5 #3FD1D1  6 #4AA8FF  7 #7A7CFF
8 #B57CFF  9 #FF7CE0 10 #FF8C8C 11 #C9A27A 12 #A0A0A0 13 #6FD0FF 14 #E0FF7C 15 #FFB3D1
```
