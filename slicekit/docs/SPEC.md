# SliceKit — product spec

SliceKit is a Max for Live instrument for Ableton Live. This document says what it
does and why. For module boundaries and data shapes see `ARCHITECTURE.md`. For Max
message names and UI controls see `PROTOCOL.md`. For the manual test list see
`TESTING.md`.

Sections marked **v2** or **v3** are not part of the first release.

---

## 1. Concept

A SliceKit instance is one kit. The kit holds up to 16 samples. Each sample is cut
into slices, and all slices from all samples form one pool. Each MIDI key plays one
slice from that pool. The keyboard is laid out like several Simplers side by side,
but they share one instrument: one set of 16 voices, one shuffle, one chaos control
and one set of performance tools.

The reasons for building it:

- A Simpler plays one sample. A Drum Rack gives one Simpler per pad. Neither gives
  one shared pool of slices that can be shuffled across many samples, which is what
  micro-sampling in the style of Justice or SebastiAn needs.
- SliceKit is not a sequencer. Live is the sequencer: MIDI clips play the kit. The
  device has no pattern editor. Its performance tools (repeat, chaos, modifier keys)
  are played live or drawn into clips as ordinary notes.

## 2. Terms

| Term | Meaning |
|---|---|
| Source | One loaded audio file. Up to 16 per instrument. |
| Slice | A section of a source, from one start point to the next. |
| Pool | All slices of all sources. |
| Pad | The sound on a key: one slice plus its settings. |
| Base pad | The default pad of a slice. The layout places base pads. |
| Key | A MIDI note, 0 to 127. Only keys that hold a pad sound. |
| Map | Which pad sits on which key. |
| Slot | One map. There are 8 slots, A to H. |
| Layer | An extra pad that plays together with the pad on a key. Up to 3 per key. |
| Modifier key | A key in the modifier zone. It makes no sound; it changes how other notes play. |
| Lock | A key that the layout and shuffle leave alone. |
| Root key | The key where the layout starts. Default 36 (C1 in Live). |

## 3. Working with the device

- Click a source in the Sources list to select it. Its waveform and slices appear.
- Click a slice in the waveform to select it.
- Click a key on the keyboard grid to select it. Clicking also plays the key
  (audition). The pad panel edits the pad on the selected key.
- The Kit panel holds the layout, root key, map slots, shuffle and kit-building
  tools. The Performance panel holds chaos, repeat, swing and the modifier zone.
- A status line at the bottom reports the last action, errors and anything dropped
  (for example, slices that did not fit on the keyboard).

## 4. The three layers

1. **Pool.** The slices of the sources. Sources are added, sliced and analyzed here.
2. **Map.** Which pad sits on which key. There are 8 maps (slots). The layout,
   shuffle and kit-building tools work on the map.
3. **Pad settings.** Each pad has its own settings: pitch, envelope, filter, loop,
   reverse and more. Settings belong to the pad, not to the slice and not to the key.
   When a pad moves, its settings move with it.

Changing a pad changes only that pad. To apply the last edited pad parameter to
every pad that plays the same source, use **→ Sample**.

## 5. Samples and slicing

### 5.1 Adding samples

- Drag a file from the Live browser or from Finder onto the device, or press Load
  and choose a file.
- Up to 16 sources. A 17th is refused, and the status line says so.
- Each source gets a color from the 16-color palette (its slot number by default).
  The color shows on its keys.
- A new source is sliced with its own slicing settings (default: Transient). Adding
  or removing a source re-lays out the auto maps (see section 8).

Play mode, trigger/gate and slicing settings belong to each source.

### 5.2 Slicing modes

| Mode | How cuts are made | Settings |
|---|---|---|
| **Transient** | Spectral-flux onset detection finds hits. | Sensitivity 0 to 100 %. Low values keep only strong hits; high values keep weak ones too. |
| **Beat** | Cuts sit on a musical grid. | BPM (0 = estimate automatically, between 70 and 180 BPM). Division from 1/16 to 4 bars. The grid starts at the first frame of the file. |
| **Region** | N equal slices. | N from 2 to 128. |
| **Manual** | You place every cut. | Add, move and remove cuts in the waveform (section 5.4). |

Beat divisions: 1/16, 1/16T, 1/8, 1/8T, 1/4, 1/4T, 1/2, 1/2T, 1 bar, 2 bars, 4 bars.
(T = triplet.)

Options that apply to all modes:

- **Min slice length** (5 to 500 ms, default 30). A cut that would leave a slice
  shorter than this is dropped.
- **Snap** (on by default). Each cut moves to the nearest zero crossing within a short
  window, so a slice does not start with a click.
- At most 128 slices per source, which is the number of keys.

### 5.3 Re-slicing keeps the pads

Changing any slicing setting re-slices the source at once. Re-slicing keeps the
pads and their key positions:

- Each pad on the source moves to the new slice whose start is nearest to the start
  of its old slice. Its settings are unchanged.
- Each new slice ends up with exactly one base pad. A new slice with no pad gets a
  fresh base pad.
- Auto maps are re-laid out (section 8). Maps you have edited by hand keep their
  keys, and new pads are added after their highest occupied key.

### 5.4 Manual editing

In the waveform:

- Add a cut by clicking. The source switches to **Manual** mode and keeps the cuts
  it already had.
- Move a cut by dragging it. It stays between its neighbors.
- Remove a cut to merge its slice into the slice before it. The pads that pointed to
  the removed slice point to the merged slice.

Snap applies to manual cuts too.

## 6. Play modes

Play mode and trigger/gate are set per source.

### 6.1 Mono, Poly and Thru

- **Mono.** One voice per source at a time. A new hit cuts the previous hit of its
  source (or of every source, see choke scope). Use it for hats, snares and anything
  that must not stack.
- **Poly.** Hits overlap. The same key can sound more than once. Limited by the 16
  voices.
- **Thru.** Each hit plays the original record from the slice's start to the end of
  the source file. The hit is not cut at the slice's end, so it works like a hot cue:
  you jump into the recording and it keeps going. The keyboard layout does not limit
  the playback. With Reverse on, a Thru hit plays backwards from the slice to the
  start of the file. Thru is monophonic like Mono: a new hit cuts the previous hit of
  its source (or of every source, see choke scope).

### 6.2 Trigger and Gate

- **Trigger.** The hit plays to the end of its slice, whether or not the key is still
  held. Releasing the key stops repeat and the micro-loop, but not the hit. For Thru,
  the hit runs to the end of the file. Use Trigger for one-shots.
- **Gate.** Releasing the key starts the release stage of the envelope. The hit ends
  when the release finishes. Use Gate for sounds you play like a synth.

### 6.3 Choke scope

Choke scope is a global setting. It decides which voices a new **Mono** or **Thru**
hit cuts. **Poly** hits never cut anything. Slices layered on the same key never cut
each other.

- **Sample** (default). The hit cuts earlier voices of its own source.
- **All.** The hit cuts every earlier voice, of any source. Use it so that a closed hat
  on one sample stops an open hat on another.

## 7. Pads

### 7.1 Pad settings

| Setting | Range | Default | What it does |
|---|---|---|---|
| Reverse | off / on | off | Plays the hit backwards (section 7.2). |
| Pitch | −48 to +48 semitones | 0 | Changes playback speed. There is no time-stretch, so a higher pitch is also shorter. |
| Fine | −100 to +100 cents | 0 | Fine detune. |
| Gain | −60 to +12 dB | 0 | Level of the pad. |
| Attack | 0 to 2000 ms | 0 | Fade-in time. |
| Decay | 0 to 5000 ms | 300 | Time from the peak down to the sustain level. |
| Sustain | 0 to 100 % | 100 | Level held after the decay. |
| Release | 0 to 5000 ms | 30 | Fade-out time. In Gate mode it starts at key release. |
| Start offset | 0 to 1000 ms | 0 | Skips this much of the slice from the front. Clamped to the slice length. The slice end does not move. |
| Loop | off / on | off | Repeats a short piece of the hit while the key is held. |
| Loop size | 1 to 500 ms | 30 | Length of the loop. Clamped to the slice. |
| Loop position | 0 to 100 % | 0 | Where in the hit the loop starts. |
| Cutoff | 20 Hz to 20 kHz (log) | 20000 | Two-pole low-pass filter. At 19 kHz and above it is bypassed. |
| Drive | 0 to 100 % | 0 | Saturation. |
| Layers | up to 3 extra pads | none | See section 10.2. |

Notes:

- Decay, sustain and release shape the level over the hit. A long sample with
  sustain at 0 and a short decay becomes a blip.
- Lock and similar-swap are not pad settings. They are described in sections 8 and 10.

### 7.2 Reverse

- Reverse plays the slice backwards. It is a per-pad setting, so it travels with its
  sound: a reversed pad that is shuffled to another key stays reversed.
- A reversed hit has its transient (the sharpest, loudest part) at its end, so it
  sounds late against the MIDI note. Move the note earlier in the clip by roughly the
  length of the hit.
- To have the same slice both forward and reversed, duplicate the pad (section 10.3)
  and set Reverse on the copy.

### 7.3 Base pads and extra pads

Each slice has one base pad, and the layout places base pads. Extra pads appear on a
key only when you put them there: by Duplicate (section 11.3), by Spread (section 11.1)
or by Flip in the shuffle (section 9). Similar-swap (section 11.4) does not add a pad;
it changes which slice an existing pad plays. A layer (section 11.2) is a reference to
an existing pad, not a copy.

## 8. Layouts, root key and map slots

### 8.1 Layouts

Layouts place base pads on keys. The layout starts at the root key and fills upward.
Locked keys keep their pads. Modifier keys are skipped.

- **Zones.** Each source gets a contiguous block of keys. Sources are in the order
  they were added; slices are in time order inside each block.
  - **Zone align (Oct).** Each source after the first starts on the next key whose
    pitch matches the root key (the same note name in another octave), so every zone
    starts on the same note name.
- **Interleave.** Round-robin across sources: the first slice of source 1, then the
  first slice of source 2, and so on, then the second slices.
- **Sorted.** All base pads sorted by one property, from the root upward:
  - **Brightness:** spectral centroid, dark to bright.
  - **Loudness:** RMS level, quiet to loud.
  - **Length:** duration, short to long.
  Slices without analysis go last.

If the kit has more slices than there are keys from the root key to key 127, the
extra slices are not placed. The status line reports how many were dropped.

Changing the layout, the root key or the zone-align option re-lays out the auto maps.

### 8.2 Root key

The root key defaults to 36 (C1 in Live's naming). It is where the layout starts,
and it also sets the octave reference for zone align.

### 8.3 Map slots

- There are 8 slots, A to H. Each slot is a full map: 128 keys, each with a pad or
  empty, and a lock per key. Keys play the current slot.
- Switch slots with the slot tabs. The slot number is automatable.
- **Copy→X** copies the current slot's map into slot X, replacing it.
- **Auto.** An auto slot always shows the generated layout, and it is rebuilt when
  sources, slices, the layout or the root key change. Any manual change to a slot
  (shuffle, lock, spread, duplicate, assign, swap, clear, find best, similar-swap or
  layer) turns Auto off for that slot only. The **Layout** button rebuilds the unlocked
  keys of the current slot from the layout settings and turns Auto back on.
- Locks belong to a slot. A locked key keeps its pad through layouts and shuffles in
  that slot.

## 9. Shuffle

Shuffle rearranges the pads on the keys of the current slot. It never changes sources
or slices.

- **Scope.** *All* moves every unlocked key that has a pad. *Sample* moves only the
  pads that play the selected source.
- **Chaos mode.** Pads are permuted at random among the keys in scope.
- **Smart mode.** Pads are grouped by how they sound (length, loudness, attack,
  brightness and zero-crossing rate) and shuffled only within each group. Each key
  gets a pad that sounds like the one it had. Hats stay near hats.
- **Seed.** The same seed on the same state gives the same result. Each press of
  Shuffle uses the current seed and then adds 1 to it, so repeated presses give new
  results. To reproduce an earlier result, undo back to the same state, set the seed
  to the value it had, and press Shuffle.
- **Undo and redo.** Each shuffle is one step. 50 steps are kept.
- **Locks.** Locked keys do not move, and they are not used as destinations.
- **Flip %.** Each moved key has this chance of getting a reversed copy of its pad.
  The original pad is not changed, and other slots are not affected.
- **Reverse travels.** Reverse is a pad setting, so a reversed pad that moves stays
  reversed.

## 10. Performance

### 10.1 Chaos

- The chaos knob runs from 0 to 100 %. It is automatable.
- Each new hit has that chance of playing a random slice from the whole pool, instead
  of the slice on its key. At 0 nothing changes. At 100 every hit is random.
- The modifier action **chaos** (section 10.4) makes every hit random while held.

### 10.2 Repeat

- **Repeat** switches repeat on. While it is on and a key is held, the hit is
  retriggered on a grid until the key is released.
- **Rate:** 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32, 1/32T, 1/64. Repeats per beat are
  1, 2, 3, 4, 6, 8, 12 and 16. The rate is automatable.
- **Timing.** When Live's transport is playing, the grid follows Live's beat. When it
  is stopped, the grid runs on its own at Live's tempo.
- **Swing** (0 to 100 %). 0 % is straight. Larger values delay every second repeat.
  At 50 % the second repeat of each pair lands three-quarters of the way through the
  pair.
- **Alt.** Each repeat plays in the opposite direction to the one before. Alt is
  automatable.

Repeat, rate, swing and alt are all automatable.

### 10.3 Aftertouch

- **Press** (pressure to level) is off by default. When it is on, channel aftertouch
  scales the level of the held keys: more pressure is louder. Pressure uses the same
  curve as velocity (set by **Vel sens**), so with the default 50 % sensitivity no
  pressure gives half level and full pressure gives full level. This is how MPC-style
  repeats get louder or softer as you press.
- Channel aftertouch acts on all held keys, poly aftertouch on its own key.

### 10.4 Modifier zone

The modifier zone is a row of 12 keys. Its first key is the **Mods start** key, which
defaults to 96 (C6 in Live's naming). When the zone is on (**Mods** toggle), its keys:

- make no sound and are skipped by the layout;
- change how notes played while they are held sound. A modifier applies to every
  note held down while it is held, including notes that were already held when it
  was pressed.

Default layout of the zone (offset from the start key):

| Offset | Key (start 96) | Action | Effect while held |
|---|---|---|---|
| 0 | 96 | rpt 1/4 | Repeat at 1/4, whatever the Repeat toggle says. |
| 1 | 97 | rpt 1/8 | Repeat at 1/8. |
| 2 | 98 | rpt 1/8T | Repeat at 1/8 triplet. |
| 3 | 99 | rpt 1/16 | Repeat at 1/16. |
| 4 | 100 | rpt 1/16T | Repeat at 1/16 triplet. |
| 5 | 101 | rpt 1/32 | Repeat at 1/32. |
| 6 | 102 | rpt 1/64 | Repeat at 1/64. |
| 7 | 103 | reverse | Flips the direction of the hits. |
| 8 | 104 | octave down | Plays one octave lower. |
| 9 | 105 | octave up | Plays one octave higher. |
| 10 | 106 | tape | Playing sounds slow to a stop over one beat. On release they speed back up. |
| 11 | 107 | chaos | Every hit is a random slice from the pool. |

Modifier keys can be played live or drawn into a Live clip. A clip note on a modifier
key acts as holding that key for the length of the note.

## 11. Kit-building tools

These tools create or copy pads on the current map. Each one turns Auto off for the
slot it changes. Where a tool needs a second key, click it on the keyboard grid.

### 11.1 Spread

Inspired by the MPC 16 Levels function.

- Select a pad on key K. Choose a parameter (pitch, decay, start or cutoff), a count
  N (2 to 16) and a step (−24 to +24).
- Key K keeps its pad. The next N − 1 keys, skipping locked and modifier keys, receive
  copies of the pad, replacing whatever was on them (Undo restores it). Copy *i*
  (1 to N − 1) has the parameter set to base + *i* × step:
  - **Pitch:** semitones.
  - **Decay:** milliseconds, never below 0.
  - **Start:** start offset in milliseconds, never below 0.
  - **Cutoff:** the base cutoff times 2^(*i* × step / 12), so the step is in
    semitones. Results stay between 20 Hz and 20 kHz.

### 11.2 Layer

Inspired by the SP-404 Pad Link.

- Arm **Layer**, select a pad, then click another key. That key's pad is added as a
  layer of the selected key. Clicking a key that is already a layer removes it. The
  arm turns off after one key.
- A key can have up to 3 layers, so up to 4 slices play together. Each layer plays
  with its own settings. The layered key keeps its own pad.

### 11.3 Duplicate

- Arm **Dup**, select a pad, then click the target key. The target receives a copy of
  the selected pad: the same slice, with its own settings.
- Use it to have one slice both forward and reversed: duplicate, then set Reverse on
  the copy.

### 11.4 Similar ‹ ›

Inspired by the similarity maps in XO and Atlas 2.

- Select a pad and press ‹ or ›. Its slice is swapped for the next slice in a ranking.
  The ranking covers every analyzed slice of every source, sorted by distance from
  the pad's original slice. The original is at index 0; ‹ goes back toward it.
- Distance uses the same properties as shuffle's smart mode.
- The pad's pitch, envelope, filter and other settings stay the same.

### 11.5 Find best N

Inspired by Serato Sample's search for the strongest samples.

- Set N (4 to 64) and press **Find best**. The tool picks N slices from all sources.
  Each pick is strong (loud and present) and different from the picks before it.
- The unlocked keys of the current slot are cleared first, and the picks go on the
  keys from the root key upward. Locked keys stay. Undo restores the previous map.

## 12. Inspirations

| Product | What SliceKit takes from it |
|---|---|
| Akai MPC | Chop modes (transient, beat and region slicing); 16 Levels (Spread); note repeat (Repeat). |
| Roland SP-404 MKII | Skip-back sampling (Capture, v2); pad link (Layer). |
| Elektron Octatrack | Scenes that morph between settings (Morph knob, v2); a random slice LFO (Chaos). |
| Make Noise Morphagene | Gene size and slide (loop size and start offset); organizing slices by sound (Smart shuffle, Sorted layout). |
| Serato Sample | Finding the strongest samples (Find best N); stem separation (v3). |
| XO and Atlas 2 | Similarity between sounds (Similar ‹ ›; the similarity map, v3). |
| Output Arcade | Modifier keys (the modifier zone). |
| Stutter Edit 2 | Performance gestures (v2). |
| FL Studio Slicex | Two decks, meaning several sources playing side by side (zones and interleave layouts). |
| Ableton Live 12.3 | Stem separation (stem-linked sources, v3). |

## 13. Limits

| Item | Limit |
|---|---|
| Sources | 16 |
| Keys | 128 (MIDI 0 to 127) |
| Slices per source | 128 |
| Voices | 16 at a time. A 17th hit takes over the oldest voice. |
| Map slots | 8 (A to H) |
| Layers per key | 3 extra, so up to 4 slices per key |
| Output | One stereo output (Max for Live). No per-slice outputs in v1. |
| Undo steps | 50 |

### 13.1 Saving

- The instrument's state is saved with the Live Set: sources, slices, pads, map
  slots and settings.
- Sources are stored as file paths. If a file is moved or deleted, its source shows as
  not loaded and the rest of the kit still works. Drop the file again to restore it.
- Before moving a set, use **File > Collect All and Save**. This copies the samples
  into the project folder.

## 14. Non-goals for v1

- No pattern sequencer. Use Live's clips.
- No time-stretching. Pitch changes speed.
- No separate outputs per slice.
- No sample editing beyond slicing (no fades, normalizing or trimming).

## 15. Roadmap

### v1

Everything in this document.

### v2

- **Capture.** Skip-back: resample the last few seconds of the device output into a
  new source.
- **Gestures with ramps.** For example, a repeat that speeds up over time, or a
  filter sweep while a key is held.
- **Morph knob.** Move between two settings sets.
- **Scan knob.** Step through the slices with one control.
- **Import slice points from a Simpler.** Read a Simpler's slice points through the
  Live API.
- **Keep clip sounding the same.** When the map changes, remap the notes in clips so
  the same sounds still play.

### v3

- **Stem-linked sources.** Link a source to the stems from Live 12.3 so each stem can
  be sliced on its own.
- **Similarity map view.** A two-dimensional view of the pool, with similar slices
  close together.
- **Pitch-detected layout.** Place pads by detected pitch, for melodic material.

## 16. Legal note

Clearing samples is your responsibility when you release music, and in the EU even
very short, recognizable fragments need permission (Pelham v Hütter, CJEU 2019).
