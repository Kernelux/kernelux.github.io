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

21. Without changing the mode, click in the waveform between two existing cuts to add a
    cut.
    Expected: the mode switches to Manual, the existing cuts stay, a new cut appears, the
    slice count goes up by one, and the new slice has a key.
22. Drag one cut left, then right.
    Expected: the cut moves. It cannot pass the cut next to it. The two slices on
    either side change length.
23. Select a cut and remove it.
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
    brightness. Its pitch, envelope and Reverse settings stay the same.
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
    Expected: every hit plays a different slice.
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
    spacing. Set Swing to 0 %.
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
103 (reverse), 104 (octave down), 105 (octave up), 106 (tape) and 107 (chaos).

96. Turn Mods on. Play keys 96 to 107 one at a time.
    Expected: they make no sound and show as modifier keys on the grid.
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
     Expected: keys 96 to 107 act as normal keys. They play whatever pad is on them, or
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
     file back and drop it into the device again to restore it.
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
