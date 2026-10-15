# SliceKit voice — behaviour notes

The voice is one gen~ codebox (`max/voice.genexpr`, one per poly~ instance) with a
JS twin, `core/voice-sim.js`, that mirrors it statement for statement. Parameter
names, units and the message protocol are in `PROTOCOL.md` §Voice; this file
describes what the voice *does* with them and what still has to be confirmed in Max.

Tests: `cd slicekit && node --test test/voice-sim.test.js`. Besides the behaviour
tests, the test file lints `voice.genexpr` (block scope, History usage, operators,
reserved names), translates it to JS and runs it sample by sample against the
simulation (scripted + 32 random scenarios). So "the sim is right" implies "the
GenExpr file does the same", *provided* GenExpr behaves the way the lint assumes
(see the last section).

## Signal chain

```
buffer (linear interp, mono -> both channels)
  -> 2-pole TPT low-pass (cutoff, bypassed >= 19000 Hz; always running)
  -> drive  tanh(x*(1+9d))/tanh(1+9d)   (only if drive > 0)
  -> gain stage:  g (declick) * ge (end fade) * envelope * sqrt(tape factor)
  -> amp (5 ms one-pole)  -> out1 / out2
```

The gain stage sits after filter and drive on purpose: every fade then ends in
exact silence (a filter tail can never be chopped when the voice goes idle) and
`|y| <= amp` whatever the drive. The filter state is cleared at every (re)start.

## State machine

`st`: 0 idle, 1 sounding, 2 waiting (hit finished, key held, repeat on: silent
but `active` stays 1). `mode` (only while `st` = 1): 0 normal, 1 restart pending
(1 ms fade-out running), 2 kill (2 ms fade-out running). Envelope `stage`:
1 attack, 2 decay, 3 sustain, 4 release.

| from | event | to |
|---|---|---|
| idle, waiting | `trig` | restart at once → sounding |
| waiting | repeat line | restart at once → sounding |
| sounding (mode 0) | `trig` or repeat line | mode 1; when the fade-out reaches 0: restart → sounding (mode 0) |
| sounding | `kill` | mode 2; when the fade-out reaches 0: idle |
| sounding | `kill` then `trig` (or `trig` during the kill fade) | mode 1 (the new note wins) |
| waiting | `kill` | idle |
| sounding | playhead reaches `pend` (not looping) | waiting if `held` = 1 and `rptdiv` > 0, else idle |
| sounding | envelope < 1e-4 in release | idle |
| sounding | tape factor 0 and `held` = 0 | mode 2 → idle |
| waiting | `held` = 0 or `rptdiv` = 0 | idle |
| sounding, mode 1 | end of slice / end of release reached before the fade finishes | the pending restart still happens (never lost) |

A restart sets: position = start (or loop start), envelope = attack from 0,
`g` = 0 (1 ms fade-in), amp snapped, tape factor 1, filter cleared, loop region
latched, and for a new note (`trig`) the direction flip and the free-running
repeat clock are reset.

Per sample, in this order: (1) `kill`/`trig` change detection; (2) repeat-grid
phase and line detection; (3) restart decisions; (4) restart; (5) render
(loop enter/leave, end check, tape, declick gain, envelope, read, filter, drive,
gain stage, advance + loop wrap). `out3` (`active`) is `st != 0` at the end of
the sample, so it rises on the first sample of a hit and falls on the first
sample after the voice went idle.

Fixed times (all scale with the sample rate): fade-in 1 ms, retrigger fade-out
1 ms, kill fade-out 2 ms, end-of-slice fade-out 2 ms (output time), amp
smoothing 5 ms, tape recovery 10 ms, loop crossfade `min(5 ms of source,
loopsize/4)`, loop-exit blend 1 ms, minimum release 1 ms.

## Parameters

| param | behaviour |
|---|---|
| `trig` | Any change starts the hit. Idle/waiting: immediate. Sounding: 1 ms fade-out, then jump. **The first value must differ from 0** (Param default is 0; the engine counters start at 1). Several changes inside one signal vector count once. |
| `kill` | Any change: 2 ms fade-out, then idle. No-op on an idle voice; ends a waiting voice at once. A `trig` arriving during the fade takes over. |
| `pstart` / `pend` / `dir` | Latched at (re)start. `dir` < 0 is reverse. The hit ends when the playhead reaches `pend` in the play direction (`remain <= 0`), after a linear 2 ms fade-out lookahead (not while micro-looping). Reads outside `[0, frames)` are silent; the hit still runs to `pend`. |
| `pitch`, `bufsr`, `tape` | Increment per sample = `dir * 2^(pitch/12) * bufsr/samplerate * tapeFactor`; read live every sample. |
| `amp` | Snaps to the value at every (re)start, then follows changes with a 5 ms one-pole (polyphonic pressure). |
| `att` | Linear 0 → 1 over `att` ms (<= 1 sample: instant; the 1 ms fade-in still applies). |
| `dec`, `sus` | Exponential approach to `sus`, 1e-4 (-80 dB) of the span reached after `dec` ms, then locked to `sus` (follows live `sus` changes). |
| `rel` | Exponential, -80 dB in `rel` ms when starting from 1 (shorter from lower levels), minimum 1 ms; the voice ends when the envelope is below 1e-4. |
| `gatemode`/`held` | Gate (1): `held` = 0 starts the release (level-based, any stage). Trigger (0): no release; the envelope stays at `sus` and the hit plays to `pend`. In both modes `held` = 0 ends repeat and micro-loop. With `held` = 0 and no repeat the hit simply continues to `pend`. |
| `loopon`, `loopsize`, `looppos` | Loop engaged while `loopon` = 1 and `held` = 1. Region: `ls = start + dir*looppos*(span - L)`, `L = clamp(loopsize, 1, span)`, `span = |pend - pstart|` (all in play direction, so mirrored on alternated repeats). Playback starts at `ls`, wraps at `ls + dir*L` (multiple wraps if the increment exceeds `L`). The crossfade blends in the signal one loop length *earlier* (material just before `ls`) over the last `xf` frames, so the output stays within `[ls - xf, ls + L)`. Region and `L` are **latched at (re)start / when the loop is switched on**; changing `loopsize`/`looppos` mid-loop has no effect until the next trigger. Switching `loopon`/`held` off leaves the loop (blend fades in 1 ms) and plays on to `pend`. Switching it on while playing arms it if the loop end is still ahead of the playhead (otherwise ignored until the next trigger). |
| `rptdiv`, `rptswing`, `rptalt`, `bpm`, `playing` | See below. |
| `cutoff` | `>= 19000` bypasses the filter output (state still runs). Below: Simper TPT SVF, Q = 1/sqrt(2), cutoff clamped to [10 Hz, 0.45·fs]. |
| `drive` | Applied when > 0 (no cross-fade: the small-signal gain jumps by +2.4 dB between 0 and tiny values — see limitations). |
| `tape`, `tapems` | `tape` = 1: factor falls by `1/tapems` per ms (a full stop from 1 takes exactly `tapems`; from a lower value proportionally less) and the output is scaled by `sqrt(factor)`. `tape` = 0: back to 1 in 10 ms. Factor 0 = playhead frozen, silent, voice stays active while `held` = 1. A stopped voice whose key is released (`held` = 0) dies with the 2 ms kill fade (otherwise it could never end in trigger mode). Reset to 1 at every (re)start. |

### Repeat

* Phase `ph` = `in1` when `playing` = 1, otherwise a free-running phase in beats
  that starts at 0 with every new note (`trig`, not with repeats) and advances
  `bpm/60/fs` per sample. Grid position `gp = ph*rptdiv/2`; lines come in pairs,
  even line at pair position 0, odd line at `0.5 + 0.25*rptswing`. With an odd
  `rptdiv` the last line of a beat is an even one, so swing delays only the odd
  lines inside the beat (1/8T: line 1 only; 1/4: no effect).
* A retrigger is fired when `held` = 1, `rptdiv` > 0 and the voice is active and
  the line index grows, or the phase wraps backwards by more than half a beat
  (the only event for `rptdiv` = 1). Nothing fires on the first sample after a
  note start, after `playing`/`rptdiv`/`rptswing`/`held` changed, for tiny
  backward steps of the phase, or when the phase jumps back by two or more
  lines (transport relocate; resync without firing).
* The note start counts as a line (4 hits in a beat for `rptdiv` = 4 when the
  note starts on the beat). A note started off the grid first repeats at the next line.
* **Timing:** a waiting voice restarts on the line itself. A *sounding* voice
  first fades out for 1 ms, so its new hit starts ~1 ms (44–47 samples) after
  the line. This follows the spec ("restart like trig"); if tighter timing is
  wanted, detect the line 1 ms early (the host bpm is known).
* Each repeat restarts like `trig` (jump to `pstart`, envelope from attack, amp
  snaps, tape factor 1). `rptalt` = 1: every repeat flips the direction (start
  and stop swap, `dir` inverts), a new note starts un-flipped.
* **A voice stays active (silent) between repeats** when its hit has finished
  while `held` = 1 and `rptdiv` > 0, so the engine gets no `voiceend` and the
  repeats continue; it goes idle (falling edge on `active`) when the key is
  released or repeat is switched off. A one-shot that ended *before* repeat was
  switched on stays idle (repeat cannot resume it; the engine would have to send
  a new `trig`).
* While a hit is still sounding when `held` goes 0, no further repeats fire and
  the hit plays out.

## Engine contract (what the voice relies on)

* Send `held 1` before `trig` (PROTOCOL order); `trig`/`kill` values must change
  on every send, the first `trig` must not be 0. The engine's counters (1..10^6,
  wrapping to 1) satisfy this; the Param ranges allow up to 10^9.
* `voiceend` (falling edge of `active`) means: one-shot finished, release done,
  killed, or key released while waiting. Retriggering a sounding voice is
  seamless (no falling edge).
* Messages that arrive in the same signal vector are seen together; order inside
  a vector is lost (only the final values matter), except `kill` before `trig`.

## Differences sim ↔ gen~ (intentional)

* Sim `bufsr` defaults to `buffer.sr` at `create`; the gen~ Param default is 44100.
* Sim `set` throws on unknown names and ignores `src`; both clamp to the Param min/max.
* Sim has logging (`create({log:true})`, `sim.events`) and extra outputs `pos`,
  `env` for tests. `beatPhase(i, k)` receives the index in this call and the
  global sample index.

## Known limitations / decisions to review

* Linear interpolation only (no cubic).
* `drive` has no dry/wet ramp: any drive > 0 applies the full normalised tanh,
  whose small-signal gain is `(1+9d)/tanh(1+9d)` (+2.4 dB just above 0, +20 dB at d = 1).
  A smooth onset (`mix(x, sat, min(1, 10*d))`) is a one-line change in both files.
* The end-of-slice fade is skipped while looping, so a loop whose end coincides
  with `pend` that is left within the last 2 ms of the slice can step.
* Retrigger latency (1 ms) for repeats of a sounding hit, see above.
* Loop parameters are latched, see above.
* `tape` factor from partial values uses a constant slope (see table).

## GenExpr: verified against the docs vs. to be checked in Max

Verified (Cycling '74 documentation / tutorials, via search; the doc pages could
not be fetched directly, only searched):

* `Param name(default, min=a, max=b);` at the top of the codebox; `Buffer name;`
  declares a buffer~ reference whose name can be re-pointed by sending
  `<name> <buffer~ name>` to gen~; `History name(init);` at the top, written at
  the end of the code (declare / use / update).
* `peek(buf, index, channel)`: defaults `index=samples`, `interp=none`,
  `boundmode=ignore` (out of range reads 0), channel argument zero-based;
  `dim(buf)` and `channels(buf)` give frames and channel count.
* `for(i=0; i<n; i+=1)`, `if / else if / else`, `break`, `continue`, `&&` and the
  ternary `?:` are supported (this file uses none of the loops or ternaries,
  only `if / else` with braces, `&&`, `||` and comparisons).
* Variables are **block scoped**; temporaries must be assigned before the first
  `if` that uses them. The file assigns every temporary once at top level (the
  test lints for this).
* Operators used exist and are common to gen/gen~: `floor abs min max exp tan
  tanh sqrt peek dim channels`; `samplerate` is usable as a constant in a codebox.

Not verifiable here — check in Max (the codebox either compiles or prints an
error in the Max console, nothing here should be silent):

1. **Compiles at all**: operators `||` and `!=` (standard GenExpr, not found
   verbatim in the pages I could search), negative literals (`History
   h_lastk(-1)`, `exp(-9.21/x)`), `//` comments only, 26 `Param` lines with
   explicit `min`/`max`.
2. **Variable names vs. reserved words.** The names were checked against the
   operator list I know (`mode`, `stage`, `pos`, `span`, `odd`, `over`, `fire`,
   `ended`, `finish`, `remain`, `incr`, `fr`, `lw`, `lc`, `ge`, `vg`, `dd`,
   `rd`, `pl`, `ph`, `st`, `g`, ...). If Max reports a name as reserved, prefix
   all locals with `v_` (the sim only needs the same rename for line-by-line
   readability; the test keeps working).
3. **Param names vs. gen~/poly~ message names.** No clash with gen operators
   (`gate` was the only one found, hence `held`); gen~ object messages
   (`reset`, `clear`, `bang`, `exportcode`, `open`, ...) and poly~ messages
   (`target`, `note`, `mute`, `steal`, ...) are not used as Param names. `dir`,
   `tape`, `kill`, `drive`, `playing` are the ones I cannot rule out completely.
4. **`Buffer src;` rebinding** by the message `src <name>` through the poly~ voice
   `[in 1]`, and `dim(src)` = 0 / reads = 0 on an empty or missing buffer.
   Also that `channels(src)` and `dim(src)` accept a `Buffer` (documented for
   `Data`/`Buffer` operators; the examples I found used `Data`).
5. **Param range handling.** Every Param has explicit wide `min`/`max` so the
   answer to "are values > 1 clamped by default" does not matter; if gen~ does not
   accept `min`/`max` for some name, drop them (the sim clamps identically, nothing else depends on it).
6. **Float precision.** Positions are held in a `History`; gen~ runs 64-bit
   floats in Max 8/9 (default). With 32-bit floats positions beyond ~16 M frames
   (6 min at 44.1 kHz) would lose sub-sample precision.
7. **`in1` period.** The repeat grid assumes `in1` is a 0..1 ramp *per beat*;
   `plugphasor~` must be configured for a one-beat period (the voice cannot check this).
8. **History semantics.** The code reads each History once into a local at the
   top and writes it once at the bottom, so it is correct whether or not a read
   after a write in the same sample sees the new value.
9. **CPU.** Active voices evaluate `tan` and 2–3 `exp` per sample; idle voices
   evaluate a handful of constants and branches only. Nothing allocates.
