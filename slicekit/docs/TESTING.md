# SliceKit — manual test checklist

Run these steps in Ableton Live with the SliceKit device, on your Mac or PC. Work
through the groups in order: later groups assume the earlier ones passed.

Each step says what to do and what you should see (**Expected**). Mark a step as
failed if the result differs. Then follow **Reporting problems** at the end, using
the step number.

Steps are numbered continuously, so a step number identifies a test on its own.

## Before you start

- Live 12 with Max for Live. SliceKit runs on Max 9.
- Open the Max Console and keep it visible. Where it lives depends on your Live
  version; look under the Max for Live menu. Clear it before each group, so the lines
  you copy later belong to the steps you just ran.
- Prepare three test files (WAV or AIFF) in one folder you can open from Finder:
  - **drums.wav**: a drum loop, two bars at 120 BPM.
  - **pad.wav**: a sustained pad or chord.
  - **word.wav**: a short spoken word or vocal phrase.
- Start with a new Live Set and an empty MIDI track.
- "A key with X's color" means a key on the keyboard grid with the color of source X
  in the Sources list. The default root key is 36 (C1 in Live).

---

## 1. Install and load

1. Drag SliceKit from the Live browser onto a MIDI track.
   Expected: the device opens. The Sources list is empty, no keys show pads, and the
   status line is empty or says the kit is ready.
2. Read the Max Console.
   Expected: no error lines (red text). Lines that start with `SliceKit:` are
   information and are fine.
3. Press Shuffle, Layout and Undo without any samples loaded.
   Expected: nothing crashes. The status line may say there is nothing to do.

## 2. Drop samples

4. Drag drums.wav from the Live browser onto the device's drop area.
   Expected: one source appears in the Sources list with its file name and a colored
   marker. Its waveform and slice marks appear. Keys are filled from key 36 upward.
5. Drag pad.wav, then word.wav, from Finder onto the device, one after the other.
   Expected: the Sources list shows three sources, each with a different color. The
   keys are filled in blocks in the order the sources were added: drums, then pad,
   then word.
6. Press Load, choose a fourth audio file and confirm.
   Expected: a fourth source is added, and its keys come after the others.
7. Drag a non-audio file (for example a .txt file) onto the device.
   Expected: no source is added. The status line says the file could not be loaded.
   Nothing crashes.
8. Click drums in the Sources list, then click pad, then click drums again.
   Expected: the waveform and slice marks change to match the selected source each
   time.

## 3. Slicing modes and sensitivity

Select drums.wav for these steps. The Sources list row shows the slice count.

9. Set slicing mode to Transient and sensitivity to 50 %.
   Expected: cut marks sit on the main drum hits. Note the slice count; you will
   compare against it.
10. Set sensitivity to 0 %.
    Expected: noticeably fewer cuts than in step 9 (a handful at most).
11. Set sensitivity to 100 %.
    Expected: more cuts than in step 9, including on quieter hits. The count never
    goes above 128.
12. Set sensitivity back to 50 %, then set Min slice length to 200 ms.
    Expected: no two cuts are closer than 200 ms. The slice count is lower than in
    step 9.
13. Set Min slice length back to 30 ms. Turn Snap off, then back on.
    Expected: cut positions shift slightly when Snap changes. With Snap on, playing a
    slice from its start gives a clean start with no click.
14. Set mode to Beat, BPM to 120, division to 1/8.
    Expected: 16 evenly spaced cuts on the grid, for the two-bar loop.
15. Set division to 1/4.
    Expected: 8 cuts.
16. Set BPM to 0 (auto).
    Expected: a tempo is estimated and the cuts line up with the beats of the loop. If
    the estimate is wrong, enter the loop's real tempo by hand.
17. Set division to 4 Bars.
    Expected: one slice for the two-bar loop.
18. Set mode to Region and regions to 8.
    Expected: 8 equal slices, each one eighth of the file long.
19. Set regions to 128.
    Expected: drums fills keys 36 to 127 (92 keys). The other sources get no keys
    because drums uses them all. The status line reports how many slices did not fit.
20. Set mode back to Transient and sensitivity to 50 %.
    Expected: all three sources have keys again, in the same zone order as before.

## 4. Manual slice edits

Select drums.wav.

21. Without changing the mode, Shift-click in the waveform between two existing cuts to add a
    cut.
    Expected: the mode switches to Manual, the existing cuts stay, a new cut appears, the
    slice count goes up by one, and the new slice has a key.
22. Drag one cut left, then right.
    Expected: the cut moves. It cannot pass the cut next to it. The two slices on
    either side change length.
23. Select a cut and Alt-click it (Option-click on a Mac) to remove it.
    Expected: the two slices merge and the slice count goes down by one. No error. The
    keys that played the removed slice still make sound.
24. Set mode to Transient. Select key 36 and turn Reverse on. Change sensitivity to 70 %.
    Expected: the cuts change. Key 36 is still reversed, because the Reverse setting
    stays with its pad when the slices change.
25. Set sensitivity back to 50 %, and reverse key 36 back to forward.
    Expected: the waveform and keys match step 20.

## 5. Play modes (Mono, Poly, Thru) and Trigger / Gate

Select drums.wav for steps 26 to 28.

26. Set play mode to Mono. Play a drums key twice, about 100 ms apart.
    Expected: the second hit cuts the first. Only one hit sounds at a time.
27. Set play mode to Poly. Play the same key twice, about 100 ms apart.
    Expected: both hits sound together and overlap.
28. Set play mode to Thru. Select a slice in the middle of the waveform, then play its
    key.
    Expected: playback starts at that slice and keeps going past the slice's end to the
    end of the drums file.
29. With Thru still on, turn Reverse on for that key, play it, then turn Reverse off.
    Expected: the hit plays backwards, from the slice toward the start of the file.

Select word.wav for steps 30 and 31.

30. Set trigger/gate to Trigger. Hold a word.wav key for about 0.2 s, then release it.
    Expected: the whole slice plays out after you release the key.
31. Set trigger/gate to Gate. Hold the same key for about 0.2 s, then release it.
    Expected: the sound stops shortly after release (about the Release time, 30 ms by
    default), without playing to the end of the slice.

Reset for the next group: drums to Poly and Trigger, word to Trigger.

## 6. Choke scope

32. Set drums to Mono, pad to Poly. Set choke scope to Sample. Hold a pad.wav key so it
    sustains. While it sounds, play a drums key twice, about 100 ms apart.
    Expected: the two drums hits cut each other. The held pad.wav note keeps sounding.
33. Set choke scope to All. Keep the pad.wav key held and play a drums key.
    Expected: the held pad.wav note is cut by the drums hit, because a mono hit cuts
    earlier voices of any source.
34. Set choke scope back to Sample and reset drums to Poly.
    Expected: drums plays in Poly and choke scope reads Sample again.

## 7. Reverse per pad

35. Select a pad.wav key. Turn Reverse on, play it, then turn Reverse off and play it.
    Expected: the reversed hit plays backwards, so its attack comes at the end of the
    hit. The forward hit has its attack at the start. Reverse changes only the key you
    selected.

## 8. Pad parameters

Use a pad.wav key for steps 36 to 46. Play it with a held note of about one second.

36. Set Pitch to +12, play the key, then set Pitch to −12 and play it again.
    Expected: the first note is one octave higher than the default, and the second is one
    octave lower. Set Pitch back to 0.
37. Set Fine to +50 cents, then −50 cents, holding the key each time.
    Expected: the pitch is slightly sharp, then slightly flat. A sustained sound may beat
    slightly against the unmodified version. Set Fine back to 0.
38. Set Gain to −60 dB, play it, then +12 dB, play it, then 0 dB.
    Expected: almost silent at −60, clearly louder at +12, normal at 0.
39. Set Attack to 500 ms and play the key. Set Attack back to 0.
    Expected: the sound fades in over about half a second.
40. ADSR carving: set Decay to 50 ms, Sustain to 0 %, and Release to 30 ms. Hold the key
    for one second, then release it.
    Expected: a short blip that dies within about 50 ms. Set Decay back to 300 ms,
    Sustain to 100 %.
41. Set Start offset to 200 ms and play the key.
    Expected: each hit skips the first 200 ms of its slice. Then set Start offset to
    1000 ms on a short slice.
    Expected: no error. The offset is limited to the slice length, so the hit may be very
    short. Set Start offset back to 0.
42. Loop on, Loop size 30 ms, Loop position 0 %. Hold the key for one second.
    Expected: a short piece of the sound repeats while the key is held. Set Loop position
    to 50 %; the repeated piece now comes from the middle of the hit. Set Loop size to
    300 ms; the repeats are slower. Turn Loop off.
43. Set Cutoff to 500 Hz and play the key.
    Expected: a dull, muffled sound. Set Cutoff to 20000 Hz; full brightness returns.
44. Set Drive to 100 %, play the key, then set Drive to 0 %.
    Expected: audible saturation and grit at 100 %, clean at 0 %.
45. Check that every pad setting is back at its default: Pitch 0, Fine 0, Gain 0 dB,
    Attack 0, Decay 300 ms, Sustain 100 %, Release 30 ms, Start 0, Loop off, Cutoff
    20000 Hz, Drive 0 %.
    Expected: the key sounds the same as it did before step 36.

## 9. Layouts and root key

46. Set layout to Zones, Zone align off, root key 36.
    Expected: each source forms one block of keys. The blocks follow the order the sources
    were added. The first block begins at key 36.
47. Turn Zone align on.
    Expected: each source after the first starts on a C key (48, 60, 72 and so on, for root
    36). Turn Zone align off.
48. Set layout to Interleave.
    Expected: neighboring keys come from different sources in turn: drums, pad, word,
    drums, and so on.
49. Set layout to Sorted, sort by Brightness.
    Expected: from the lowest key upward, the sounds get brighter. Play the lowest and the
    highest key and compare them.
50. Sort by Loudness, then by Length.
    Expected: by Loudness, the quietest sound is at the bottom and the loudest at the top.
    By Length, the shortest is at the bottom and the longest at the top.
51. Set layout back to Zones, Zone align off, sort back to Brightness.
52. Set root key to 48.
    Expected: the whole layout moves up one octave. Keys below 48 are empty. Set root key
    back to 36.

## 10. Map slots and automation

53. On slot A, press Copy→B.
    Expected: switch to slot B. It shows the same keys as slot A.
54. On slot B, clear key 36. Switch to slot A.
    Expected: key 36 on slot A still has its pad. The change on B did not affect A.
55. Select slot C and press Shuffle (Chaos, All, seed 1).
    Expected: keys in slot C change. Slot A is unchanged. Slot C no longer follows the
    generated layout (step 56 shows this).
56. Load a fourth source (any file).
    Expected: slot A (still auto) now includes the new source's keys. Slot C keeps its
    shuffled arrangement and does not change.
57. Automation: in Live, draw an automation curve for the device's map slot parameter that
    moves from A to C to E over four bars. Play a clip or hold notes while the transport
    runs.
    Expected: the kit switches as the curve runs. Notes already held keep their sound.
    New notes use the new slot. No notes get stuck.

Set the slot back to A for the next group.

## 11. Shuffle (chaos, smart, scope, seed, undo, locks, flip)

Use slot A, which is auto. Undo any earlier changes first.

58. Set mode to Chaos, scope to All, seed to 1. Press Shuffle.
    Expected: sounds move to different keys. The number of filled keys is the same as
    before. Nothing is lost.
59. Press Undo, then Redo.
    Expected: Undo returns the arrangement from step 58. Redo applies the shuffle again.
60. Press Undo. Set seed to 1 and press Shuffle.
    Expected: the arrangement matches step 58 exactly. This shows the result depends only
    on the state and the seed. Press Undo to go back.
61. Press Shuffle again without changing the seed or undoing.
    Expected: the arrangement differs from step 58, because the seed moved on.
62. Press Undo. Set mode to Smart, scope to All, seed 1, and press Shuffle.
    Expected: short sounds (clicks, hats, short words) swap with other short sounds, and
    long sounds with long ones. Judge by ear.
63. Press Undo. Set scope to Sample, select pad.wav in the Sources list, set mode to
    Chaos, and press Shuffle.
    Expected: only keys that play pad.wav move. Keys with drums or word sounds stay where
    they were.
64. Press Undo. Select key 40 and press Lock. Set scope to All and press Shuffle.
    Expected: key 40 keeps its pad. The other keys move. Then unlock key 40.
65. Set Flip to 50 %, scope to All, and press Shuffle on slot C.
    Expected: about half the moved keys play reversed. Switch to slot A and check the same
    keys: slot A is unchanged, because Flip only affects the slot you shuffled.
66. Set Flip to 0 %. Press Undo until the shuffles are cleared.
    Expected: no reversed pads remain from the Flip test.

## 12. Spread

67. Select key 40 (any pad). Set Spread parameter to Pitch, count 8, step 1. Press Spread.
    Expected: keys 40 to 47 each sound one semitone higher than the key below. Key 40 is
    unchanged. Keys 41 to 47 now hold copies of key 40's pad.
68. Press Undo.
    Expected: keys 41 to 47 return to what they held before.
69. Set Spread parameter to Decay, step 100 ms, count 4. Press Spread on key 40.
    Expected: each key rings longer than the key below: about 300, 400, 500 and 600 ms.
    Press Undo.
70. Set Spread parameter to Cutoff, step −6, count 4. Press Spread on key 40.
    Expected: each key is clearly darker than the one below it. Press Undo.
71. Lock key 43. Set Spread parameter to Pitch, step 1, count 6. Press Spread on key 40.
    Expected: key 43 keeps its own pad. The copies go to keys 41, 42, 44, 45 and 46. Undo
    and unlock key 43.

## 13. Layer

72. Select key 36. Arm Layer, then click key 40.
    Expected: key 40's sound is now a layer of key 36. Pressing key 36 plays both sounds
    together. The Layer arm turns off after the click.
73. Select key 36, arm Layer, and click key 40 again.
    Expected: the layer is removed. Key 36 plays only its own sound.
74. Add layers to key 36 from keys 40, 41 and 42. Then try to add key 44 as a fourth
    layer.
    Expected: the fourth layer is not added. Key 36 plays at most four sounds at once.
75. Remove the layers on keys 40, 41 and 42 by arming Layer and clicking each again.
    Expected: key 36 plays only its own sound.

## 14. Duplicate

76. Select a pad.wav key with Reverse off. Arm Dup, then click an empty key (for example,
    one above the filled keys) or a key with another source's color.
    Expected: the clicked key now plays the same slice as the selected key.
77. Turn Reverse on for the copy only.
    Expected: the copy plays reversed. The original key still plays forward.
78. Change the copy's Decay to 100 ms.
    Expected: the original's decay is unchanged.

## 15. Similar ‹ ›

79. Select a key with a pad.wav sound (for example, a key in the middle of the pad.wav
    block). Press Sim › three times.
    Expected: the key plays a different slice that sounds similar in length, loudness and
    brightness. Its pitch, envelope and Reverse settings stay the same. The key now holds a
    copy of the pad (not a base pad), and the base pad keeps its own slice.
80. Press ‹ Sim three times.
    Expected: the key returns to its original slice. Pressing ‹ Sim again does nothing.

## 16. Find best N

81. Set Best N to 8 and press Find best.
    Expected: eight keys from key 36 upward are filled with slices from all sources, which
    sound strong and varied. The other unlocked keys in this slot are empty.
82. Press Undo. Lock key 36 before pressing Find best again.
    Expected: key 36 keeps its pad. The other seven keys get new picks. Undo and unlock key
    36.

## 17. Chaos knob

83. Set Chaos to 0 %. Play one key ten times, one hit at a time.
    Expected: every hit plays the same slice.
84. Set Chaos to 50 %. Play the same key twenty times.
    Expected: about half the hits play a different slice. The mix changes from hit to hit.
85. Set Chaos to 100 %. Play the same key ten times.
    Expected: every hit plays a different pad from the current map.
86. Set Chaos back to 0 %. Draw an automation ramp from 0 to 100 % over four bars, with
    notes playing on the key.
    Expected: the hits get more random as the ramp rises.

## 18. Repeat, rate, swing and alt (transport stopped and playing)

Set the tempo to 120 BPM and stop the transport for steps 87 to 89.

87. Turn Repeat on and set Rate to 1/16. Hold a key for one second.
    Expected: about 8 retriggers in that second (one every 0.125 s).
88. Set Rate to 1/8T. Hold the key for one second.
    Expected: about 6 retriggers.
89. Set Rate to 1/16T. Hold the key for one second.
    Expected: about 12 retriggers.

Start the transport for steps 90 and 91. Turn the metronome on if you can.

90. With Rate 1/16, hold a key across one bar.
    Expected: retriggers land on the sixteenth-note grid, in time with Live's beat.
91. Stop the transport, set the tempo to 90 BPM, and hold a key.
    Expected: about 6 retriggers per second at 1/16, slower than at 120 BPM.

Set the tempo back to 120 BPM for the next steps.

92. Start the transport. Set Rate to 1/16 and Swing to 50 %. Hold a key across one bar.
    Expected: every second repeat is late, giving a long-short pattern rather than even
    spacing. At 50 % the second repeat of each pair lands 62.5 % of the way through the pair.
     Set Swing to 0 %.
93. Set Swing to 0 %, Rate to 1/8, and turn Alt on. Use a pad.wav key with Reverse off.
    Hold it for one bar.
    Expected: each repeat plays in the opposite direction to the one before. Turn Alt off.
94. Turn Repeat off. Hold a key for one second.
    Expected: the key plays once, with no retriggers.
95. Automate Repeat (on in bar 2) and Rate (from 1/4 to 1/32) in Live, and play with the
    transport running.
    Expected: repeat switches on and the rate changes with the automation.

## 19. Modifier zone

With the default start at 96, the modifier keys are 96 (rpt 1/4), 97 (rpt 1/8),
98 (rpt 1/8T), 99 (rpt 1/16), 100 (rpt 1/16T), 101 (rpt 1/32), 102 (rpt 1/64),
103 (reverse), 104 (octave down), 105 (octave up), 106 (tape) and 107 (chaos). Keys 108 to 111 are the gesture keys G1 to G4 (group 26), so the zone is 16 keys, 96 to 111.

96. Turn Mods on. Play keys 96 to 111 one at a time.
    Expected: they make no sound and show as modifier keys on the grid. Keys 108 to 111 show as G1 to G4.
97. Hold key 97 and, while it is held, play a pad.wav key for about one second.
    Expected: the note retriggers at 1/8 while key 97 is held. When you release key 97,
    the retriggers stop.
98. Hold key 103 (reverse) and play a drums key.
    Expected: the hit plays reversed while key 103 is held. Release it; the next hit
    plays forward.
99. Hold key 104 and play a key that has a pad (for example, the key from step 97). Then
    hold key 105 and play the same key.
    Expected: the first note sounds one octave lower, the second one octave higher.
100. Hold key 106 (tape) while a pad.wav note is held.
     Expected: the held sound slows to a stop in about one second. Release key 106.
     Expected: the sound speeds back up to normal.
101. Hold key 107 (chaos) and play one key ten times.
     Expected: each hit plays a random slice. Release key 107. Expected: the key plays its
     own slice again.
102. In a Live clip, draw one note on key 97 covering a bar. Play the clip with the
     transport running.
     Expected: repeats at 1/8 play while the note sounds. Key 97 itself makes no sound.
103. Turn Mods off.
     Expected: keys 96 to 111 act as normal keys. They play whatever pad is on them, or
     nothing if empty. Turn Mods back on.

## 20. Aftertouch

Skip this section if you have no keyboard or controller with aftertouch.

104. Turn Press (pressure to level) on. Hold a key and press harder on the aftertouch
     controller, then ease off.
     Expected: the note gets louder as pressure rises and quieter as it falls. It does not
     go silent when you ease off.
105. Turn Press off. Hold a key and press harder.
     Expected: aftertouch has no effect on the level.

## 21. Save and reopen the Live Set (state restored)

106. Build a state: three sources; two pads edited (one reversed, one with Decay at 50 ms);
     Chaos at 30 %; layout Sorted by Brightness; slot B copied from A and changed on one key;
     Repeat on at 1/8T. Save the Live Set, close it, and reopen it.
     Expected: everything comes back: sources and waveforms, slices, the reversed and decay
     settings on their keys, both slots with their own keys, Chaos at 30 %, the layout, and
     the Repeat settings. No error lines in the Max Console.
107. Move drums.wav to another folder. Reopen the Live Set.
     Expected: the drums source shows as not loaded. The other sources still work. Move the
     file back and drop it into the device again to restore it. Dropping it again re-links the
     existing drums source; no new source is added.
108. Use File > Collect All and Save. Move the whole project folder somewhere else and
     reopen the set.
     Expected: all samples load, and none are reported missing.

## 22. Two instances on two tracks do not interfere

109. Add a second SliceKit on another MIDI track. Load pad.wav into it, not into the first
     instance.
     Expected: each instance has its own sources. Changing one instance's layout or Chaos
     does not change the other.
110. Play both tracks together.
     Expected: each instance plays only its own samples. No sound from one instance's
     sample comes from the other.
111. Save and reopen the Live Set.
     Expected: each instance restores its own state.

## 23. Limits and CPU sanity (16 voices)

112. Load sources until there are 16. You can drop the same file several times. Then try to
     add a 17th.
     Expected: the 17th is refused, the status line says the limit is reached, and the device
     keeps working.
113. Set play mode to Poly on every source, Decay to 3000 ms and Sustain to 100 %. Hold 16
     keys at once, as a chord across the keyboard.
     Expected: all 16 voices sound with no dropouts or clicks. Note the CPU reading in
     Live's CPU meter.
114. With every source still on Poly, hold 17 keys at once.
     Expected: no crash and no stuck note. The oldest voice is cut to make room. Release all
     keys.
115. Turn Repeat on at 1/64 and Chaos at 50 %. Hold four keys for 30 seconds with the
     transport running.
     Expected: no dropouts. Note the CPU reading at the start and the end.
116. Stop the transport while notes are held with Repeat on. Release all keys.
     Expected: the repeats stop. No note stays stuck after all keys are released.

## 24. Capture (skip-back)

Groups 24 to 32 test v2. Start them with a fresh Set: one SliceKit on an empty MIDI
track, with drums.wav, pad.wav and word.wav loaded (as in group 2). Group 23 fills all
16 source slots, and a capture needs a free one. Capture records what this device plays,
so keep drums.wav sounding during these steps.

117. Set the tempo to 120 BPM and Capture length to 2 Bars. Play drums.wav (a clip or held
     keys) with the transport running for about 10 seconds, then press **Capture**.
     Expected: about 0.3 seconds later a new source appears in the Sources list, named
     SliceKit Capture followed by a date and time. Its keys are filled after the other
     sources. The status line reads Captured 2 Bars → <file name>.
118. Find the capture file in the folder that holds SliceKit.amxd. Play it in Finder or a
     player.
     Expected: a file named SliceKit Capture YYYYMMDD-HHMMSS.wav is there. It is stereo,
     about 4 seconds long, and plays the drums from just before you pressed Capture.
119. Select the new source. Set its mode to Beat, BPM 120, division 1/4. Play a few of its
     keys.
     Expected: eight cuts, one per beat. Each key plays one beat of the captured audio.
120. Play a few keys of the captured source, then set Capture length to 1 Bar and press
     Capture.
     Expected: a second capture file and a second new source appear. The first captured
     source is unchanged. No error lines in the Max Console.
121. Press **Folder…**, choose another folder, set Capture length to 1 Bar, and press
     Capture.
     Expected: the new WAV file is written to the folder you chose, not to the folder that
     holds the device.
122. Set the tempo to 40 BPM and Capture length to 8 Bars. Play for about 50 seconds, then
     press Capture. Set the tempo back to 120 BPM.
     Expected: a capture file is still written and loaded, with no error. Its length is
     under 48 seconds (what 8 bars at 40 BPM would be), because the ring holds 40 seconds.

## 25. Import from a Simpler

This group needs two Simplers in the Set. Name the tracks Track Drums and Track Rack, so
the menu items are easy to tell apart.

123. On a MIDI track named Track Drums, add a Simpler, load drums.wav, switch it to Slice
     mode with Transient slicing, and set its playback mode to Mono. Note how many slice
     markers it shows.
     Expected: the Simpler shows slice markers on drums.wav.
124. On a MIDI track named Track Rack, put a Simpler inside an Instrument Rack or Drum Rack.
     Load pad.wav into it, in Classic mode.
     Expected: the Simpler sits in the rack's chain. No error lines in the Max Console.
125. In SliceKit, press **Find Simplers**, then open the Simpler menu.
     Expected: the menu lists Track Drums / Simpler and Track Rack / <chain name> / Simpler. The Simpler
     inside the rack is listed.
126. Choose Track Drums / Simpler.
     Expected: a new source named drums.wav appears. Its cut marks match the Simpler's slice
     markers (same count, same positions). Its slicing mode reads Manual, and its play mode
     reads Mono.
127. Choose Track Rack / Simpler.
     Expected: a new source named pad.wav appears. It has no slice points from the Simpler,
     so SliceKit slices it normally (Transient). Play one of its keys: it sounds like the
     Simpler's sample.
128. In Live, set the Simpler on Track Drums to Poly. In SliceKit, choose Track Drums /
     Simpler again.
     Expected: a second drums source is added, and its play mode reads Poly. The first
     drums source is unchanged.

## 26. Gestures

Turn Mods on for these steps (start key 96). Keys 108 to 111 are G1 to G4. Use a pad.wav
key for the held-note tests. At 120 BPM, one bar is 2 seconds, two beats are 1 second,
and 1/16 bar is 0.125 seconds.

129. Turn Mods on. Play keys 108 to 111 one at a time.
     Expected: they make no sound. The grid shows them as G1, G2, G3 and G4.
130. Select gesture tab 1, then tabs 2, 3 and 4, and read each gesture's settings.
     Expected: 1 Build: length 1 bar, repeat 1/8 to 1/64, cutoff 20 kHz to 1.2 kHz, pitch 0
     to 0, level 100 to 100 %, curve 30 %. 2 Rise: 1 bar, 1/16 to 1/16, 20 kHz to 20 kHz,
     pitch 0 to +12, level 100 to 100 %, curve 0 %. 3 Drop: 2 beats, off to off, 20 kHz to
     600 Hz, pitch 0 to -24, level 100 to 60 %, curve 50 %. 4 Fade: 1 bar, 1/32 to 1/32,
     20 kHz to 20 kHz, pitch 0 to 0, level 100 to 0 %, curve 0 %.
131. Rise: press and hold a pad.wav key. While it is held, press G2 (key 109) and keep it
     down for about 2 seconds, then release G2 and keep the note.
     Expected: the pitch climbs smoothly to one octave higher over the first 2 seconds, and
     stays there while G2 is held. When you release G2, the pitch returns to normal at once.
132. Drop: with Repeat off, hold a pad.wav key. While it is held, press G3 (key 110) for
     about one second.
     Expected: the note falls two octaves in about a second, gets darker, and gets about 40 %
     quieter. It does not repeat.
133. Build: with Repeat off, hold a drums key. While it is held, press G1 (key 108) for one
     bar (2 seconds).
     Expected: the hits come closer together through the bar, so the repeat speeds up from
     1/8 to 1/64, and the sound gets darker. Releasing G1 stops the repeats.
134. Fade: hold a pad.wav key. While it is held, press G4 (key 111) for one bar.
     Expected: the note repeats at 1/32 through the bar and fades to silence by its end.
     Release G4 early: the level returns to normal at once.
135. Set Build's length to 1/16 bar. Hold a drums key and press G1 briefly.
     Expected: the whole ramp is over in 0.125 seconds. Set Build's length back to 1 bar.
136. Priority: set Repeat on at 1/4. Hold key 97 (the 1/8 repeat modifier) and a pad.wav key.
     While both are held, press G4 (key 111).
     Expected: the note repeats at 1/32, the gesture's rate. It does not use 1/4 or 1/8.
     Set Repeat off.
137. Most recent wins: hold a pad.wav key. Press G3 and keep it down. While G3 is still held,
     press G2.
     Expected: Rise is active, so the pitch climbs. Release G2 while G3 is still held:
     Drop applies again, so the pitch falls. Release G3 and everything is back to normal.
138. Set Mods start to 112. Check that keys 112 to 127 are modifier keys, with G1 on key 120
     and G4 on key 127. Then set Mods start back to 96.
     Expected: keys 108 to 111 are ordinary keys again and play whatever pads are on them.

## 27. Gestures while repeating

Transport playing at 120 BPM. Mods on (start key 96).

139. Set Repeat on at 1/16. Hold a drums key and press G1 (Build) for one bar.
     Expected: repeats start at 1/8 and speed up through the bar, reaching 1/64 at the end.
     The repeat follows the gesture, not the 1/16 setting.
140. Keep Repeat on at 1/16. Hold a pad.wav key and press G3 (Drop) for about one second.
     Expected: the note keeps repeating at 1/16, because Drop does not change the repeat
     rate, while its pitch and level fall.
141. Set Repeat off. Hold a pad.wav key and press G1 (Build).
     Expected: the note still repeats. A gesture with a rate overrides the Repeat toggle.
142. Set Repeat on at 1/16. Hold a pad.wav key and press G1. While the key is still held,
     release G1.
     Expected: the repeats return to the global 1/16 at once, and keep going while the key is
     held. Release the key and they stop. Set Repeat off.

## 28. Morph

Use one pad.wav key for steps 143 to 151. Before step 143, check that the pad's pitch is
0, its cutoff is 20000 Hz, its Reverse is off, and it has no B settings.

143. Select the pad and press **A→B**. Set Morph to 100 %, play the key, then set Morph back
     to 0 %.
     Expected: the pad now has B settings equal to its A settings, so the sound is the same
     at 0 % and at 100 %.
144. Turn **Edit B** on. Set Pitch to +12 and Cutoff to 500 Hz. Turn Edit B off.
     Expected: with Edit B on, the Pitch and Cutoff controls show +12 and 500 Hz. With Edit B
     off they show 0 and 20000 Hz again, the A settings.
145. With Morph at 0 %, play the key. Then set Morph to 100 % and play it. Then set Morph to
     50 % and play it.
     Expected: at 0 % the normal sound. At 100 % one octave up and dull. At 50 % a tritone up
     (6 semitones), with the cutoff at about 3.2 kHz, the middle of 20 kHz and 500 Hz on a log
     scale. A straight-line middle would be about 10 kHz, which is much brighter.
146. Turn Edit B on and set Reverse on, which sets the B value only. Turn Edit B off. Set
     Morph to 49 % and play the key, then set Morph to 50 % and play it.
     Expected: at 49 % the note plays forward. At 50 % it plays reversed. Set Morph to 0 %.
     The Reverse control shows off, the A value.
147. Hold the key for about 3 seconds with Morph at 0 %. While it is held, move Morph slowly
     to 100 %.
     Expected: the held note's pitch and brightness follow the knob. The note does not
     restart. Reverse and Loop do not switch on a held note; they take effect on the next hit.
148. Arm **Dup**, select this pad, and click an empty key outside the modifier zone. Set Morph
     to 100 %, then play the copy and the original.
     Expected: the copy has the same B settings, so it sounds the same as the original at every
     Morph setting. Press Undo to remove the copy.
149. Press **Clr B** on this pad. Set Morph to 100 % and play the key.
     Expected: the pad sounds like its A settings again: pitch 0, cutoff 20000 Hz.
150. Press **All A→B**, then set Morph to 100 %. Then press **All Clr B** and set Morph to
     100 % again.
     Expected: after All A→B, Morph changes no pad, because every B equals its A. After
     All Clr B, Morph changes no pad either, because no pad has B settings.
151. In Live, draw an automation curve on the Morph knob from 0 to 100 % over four bars. First
     set this pad's B to pitch +12 and cutoff 500 Hz, as in step 144. Play a clip that holds
     the pad's key.
     Expected: the sound moves from A to B over four bars, in a smooth curve. Notes already
     sounding follow the curve. Each new note starts at the Morph value of the moment it starts.

## 29. Scan

Setup: drums, pad and word in the Zones layout, auto map, Mods off, Repeat off, Morph 0 %,
Scan 0 %, Chaos 0 %. Before step 152, note what key 36 (a drums key) and a pad.wav key sound
like.

152. Set Scan to 0 %. Play key 36 and a pad.wav key.
     Expected: they sound as before. Nothing changes.
153. Set Scan to 25 % with the transport stopped. Play key 36, then the pad.wav key.
     Expected: key 36 plays a different slice from elsewhere in the kit. Its colour on the grid
     does not change, because the map did not change. Set Scan back to 0 %: key 36 plays its
     own slice again.
154. Set Scan to 100 %. Play each of the three keys (one from each source).
     Expected: each key plays a slice that is not its own. Set Scan back to 0 %.
155. Hold a pad.wav key for about 3 seconds with Scan at 0 %. While it is still held, move
     Scan to 50 %.
     Expected: the held note jumps to the new slice at once. Its playhead moves into the new slice
     and its envelope carries on. No new hit starts, and the
     attack does not repeat.
156. Set Repeat on at 1/16 and Scan to 0 %, with the transport playing. Hold a pad.wav key.
     Over about 8 bars, move Scan slowly from 0 to 100 %. Then set Repeat off.
     Expected: the repeated hits change one by one. Each change comes at the next repeat, not in
     the middle of a hit.
157. In Live, draw an automation curve on Scan from 0 to 100 % over four bars. Play a clip with
     notes on several keys.
     Expected: the kit rotates as the curve runs. Notes already sounding switch slice without
     retriggering. No note stays stuck when the clip stops.
158. Set Scan to 50 % and Chaos to 100 %. Play one key ten times. Then set both back to 0 %.
     Expected: every hit plays a random slice, so chaos still applies on top of Scan.

## 30. Keep clip sounding the same

Setup: Mods on. On a MIDI track, make a clip one bar long, with one note each on keys 36, 40
and 44 (one per beat), and one note on key 97 that covers the whole bar. Use slot A (auto).
Transport playing. Keep clip starts off.

159. Keep clip off. Press Shuffle (Chaos, All, seed 1). Look at the clip in the piano roll,
     then play it.
     Expected: the sounds on keys 36, 40 and 44 have changed, but the notes in the clip have
     not moved. They are still on keys 36, 40 and 44.
160. Press **Remap clip**.
     Expected: the status line reads Clip remapped: N notes. N counts the notes that moved (at
     most 3; the note on key 97 is not counted). The notes move to the keys where their sounds
     now are, so the clip sounds as it did before the shuffle. The note on key 97 stays on 97.
161. Press Undo, then press **Remap clip**.
     Expected: the map is back to its original state, and the notes return to keys 36, 40 and 44.
162. Set Keep clip on. Press Shuffle (Chaos, All, seed 2).
     Expected: the notes move at once to the keys where their sounds went. The status line reads
     Clip remapped. The note on key 97 does not move.
163. With Keep clip still on, press Undo.
     Expected: the notes move back to keys 36, 40 and 44.
164. With Keep clip on, change Layout from Zones to Interleave, then back to Zones.
     Expected: after each change the notes follow their sounds, so the clip sounds the same as
     before the change.
165. With Keep clip on, switch to slot B, then back to slot A.
     Expected: switching does not rewrite the clip. The notes stay on their keys. On slot B the
     clip plays whatever B holds on those keys. Back on A, the clip sounds as before.
166. Create a second clip on the device's track, with a note on key 40, and open it in the
     detail view. With Keep clip on, press Shuffle.
     Expected: the clip open in the detail view is rewritten. The first clip is not changed.

## 31. Save and reopen with v2 settings

167. Set Morph to 40 %, and give a pad B settings (pitch +12, cutoff 500 Hz, as in group 28).
     Set Build's length to 2 beats and Drop's level to 30 %. Turn Keep clip on. Set Capture
     length to 4 Bars and choose a capture folder with **Folder…**. Set Scan to 35 % and Chaos
     to 30 %. Set Repeat on at 1/8T and turn Mods on. Save the Live Set, close it, and reopen it.
     Expected: everything comes back: Morph at 40 %, the pad's B settings (with Edit B on), Build's
     length of 2 beats, Drop's level of 30 %, Keep clip on, Capture length 4 Bars and the capture
     folder, Scan at 35 %, Chaos at 30 %, and the Repeat settings. No error lines in the Max Console.
168. Play the pad at Morph 40 % and Scan 35 %, and compare it with the sound before you saved.
     Expected: the same sound.
169. With Keep clip on, press Shuffle.
     Expected: the clip is remapped (status: Clip remapped), so the setting survived the reopen.
170. Open a Set saved before v2, for example the one from step 106.
     Expected: it opens with no error lines. Morph is 0 %, Scan is 0 %, Keep clip is off, Capture
     length is 2 Bars, and the gestures are at their defaults (Build, Rise, Drop, Fade). Its pads
     sound as before. If the Set has Mods on and pads on keys 108 to 111, those pads are now
     gesture keys and make no sound. Turn Mods off to play them.

## 32. v2 behaviours from the completeness audit

Use the Set from group 31, or a fresh Set with drums.wav, pad.wav and word.wav loaded.

171. Click key 36. Shift-click key 40 and hold the mouse button for one second. Cmd-click
     (Ctrl-click on Windows) key 44, then Cmd-click it again.
     Expected: the plain click selects key 36, and the PAD panel shows its pad, with no sound.
     Shift-click plays key 40 for as long as the button is held, then it stops. The first
     Cmd-click locks key 44 (its lock mark shows). The second unlocks it.
172. Drag key 36 onto key 40. Then drag key 40 back onto key 36.
     Expected: the pads on keys 36 and 40 swap, and the selection moves to the target key each
     time. After the second drag the map is as it was before step 172. Keep clip is off, so no
     clip changes.
173. Turn Keep clip on. Put a note on key 36 in a clip and play the clip briefly. Drag key 36
     onto key 40, then press Undo.
     Expected: after the drag, the note moves to key 40, because its pad now sits there. Undo
     moves the note back to key 36.
174. Select a key with a base pad (the default pad of its slice) and press Sim › once. Then
     press Undo.
     Expected: the key plays the next similar slice. The key now holds a copy (a non-base pad),
     and the original base pad keeps its own slice. Undo removes the copy, and the key plays
     its original pad again.
175. Copy slot A to B. On slot B, clear keys so that only 8 pads are left (for example, clear
     every key above the eighth pad). Set Chaos to 100 % and select slot B. Play key 36 ten
     times, then set Chaos back to 0 %.
     Expected: every hit plays one of the 8 pads on slot B. No hit plays a sound that exists
     only on slot A.
176. Find the controls by panel: the slot tabs in PERFORM; Mods and Mod start in KIT; Layer,
     Dup, Spread and ‹ Sim › in PAD; Reslice and Remove in SAMPLE; Clear in PAD.
     Expected: each control is where the panel list in section 3 says.
177. Set Vel sens to 0 %. Play a key softly, then hard. Set Vel sens to 100 % and do the same.
     Expected: at 0 % the soft and hard hits play at the same level. At 100 % a soft hit is much
     quieter than a hard one.
178. Select drums.wav and press Reslice without changing any setting.
     Expected: the slices stay the same, and every key keeps its pad. No new source is added.
179. Select word.wav and press Remove. Then drop word.wav into the device again.
     Expected: Remove deletes the source and clears its keys in every slot. Dropping the file again
     adds it as a new source, with its keys after the others. The re-link rule of step 107 applies
     only to a sample whose file was missing.
180. Select a key with a pad and press Clear.
     Expected: the key is empty in the current slot. Other slots keep their pads. Undo restores the pad.
181. Look at the colours in the Sources list.
     Expected: each sample's colour matches its slot number from the palette (the first sample is
     red, slot 0). No control changes it.
182. Set Slice mode to Beat, BPM 120, division 1/16, on a file at least 20 seconds long (for
     example, a long loop).
     Expected: exactly 128 slices. The status line reads "Limited to 128 slices".
183. Starting from the result of step 182, switch to Manual and Shift-click the waveform once more.
     Expected: the new cut is not added, and the status line reads "Limited to 128 slices".
184. Set Snap on. Shift-click the waveform to add a cut in the middle of drums.wav, then play the
     new slice from its start. Turn Snap off and repeat.
     Expected: with Snap on, the slice starts without a click. With Snap off, the cut stays where
     you clicked.
185. Hold a pad.wav key for 1.5 seconds with Mods on. While it sounds, hold key 103 (reverse) for
     about 0.5 seconds, then release it.
     Expected: the hit turns around at the moment you press key 103. It plays backwards from where
     it was, without restarting. When you release key 103, it turns forward again from where it is.
186. Set Repeat off. Hold a drums key (Trigger mode) for about 2 seconds, past the end of its hit.
     While it is still held, press key 97 (repeat 1/8).
     Expected: the hit that had already finished starts again and repeats at 1/8 until you release
     the key. Release it: the repeats stop.
187. Use Poly sources with long decay (for example, pad.wav with Decay 3000 ms, Trigger mode).
     Hold 16 keys so that 16 voices sound. Release one key; its voice keeps sounding, because
     Trigger mode lets the hit finish. Then press a 17th key while the other 15 are still held.
     Expected: the new hit takes the released voice, which is no longer held. The 15 held notes
     all keep sounding. No stuck notes after all keys are released.

---

## Reporting problems

When a step fails, send the following:

1. The step number and the group title, for example "step 33, Choke scope".
2. The lines from the Max Console that start with `SliceKit:`, plus any red error lines
   from the same moment. Copy them as plain text. Clear the console before a test if you
   want a short log.
3. Your versions: Live, Max, and your OS (macOS or Windows, with the version number).
4. The sample files you used: format, sample rate, length, and the file name if you can
   share it.
5. Whether the problem happens every time, and the steps you took before it.
6. If it involves the Live Set, a copy of the set, saved with **File > Collect All and
   Save**.
