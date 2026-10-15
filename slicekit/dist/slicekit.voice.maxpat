{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 9,
			"minor": 0,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [
			60,
			80,
			760,
			560
		],
		"openinpresentation": 0,
		"default_fontsize": 10,
		"default_fontface": 0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [
			8,
			8
		],
		"description": "SliceKit poly~ voice",
		"digest": "",
		"tags": "",
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "comment",
					"text": "SliceKit voice (poly~ instance). in 1 = voice messages, in~ 1 = host beat phase (0..1 per beat).",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						30,
						8,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "newobj",
					"text": "in 1",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						30,
						40,
						38,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "newobj",
					"text": "in~ 1",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": [
						"signal"
					],
					"patching_rect": [
						140,
						40,
						44,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "newobj",
					"text": "gen~",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"signal",
						"signal",
						"signal"
					],
					"patching_rect": [
						30,
						110,
						330,
						22
					],
					"patcher": {
						"fileversion": 1,
						"appversion": {
							"major": 9,
							"minor": 0,
							"revision": 0,
							"architecture": "x64",
							"modernui": 1
						},
						"classnamespace": "dsp.gen",
						"rect": [
							60,
							90,
							760,
							710
						],
						"openinpresentation": 0,
						"default_fontsize": 12,
						"default_fontname": "Arial",
						"boxes": [
							{
								"box": {
									"id": "obj-1",
									"maxclass": "newobj",
									"text": "in 1",
									"numinlets": 0,
									"numoutlets": 1,
									"outlettype": [
										""
									],
									"patching_rect": [
										30,
										20,
										40,
										22
									]
								}
							},
							{
								"box": {
									"id": "obj-2",
									"maxclass": "codebox",
									"code": "// SliceKit voice - gen~ codebox (GenExpr)\n// ======================================================================\n// One poly~ voice: plays a slice from a buffer~ with envelope, micro-loop,\n// beat-synced repeat, low-pass filter, drive, tape stop and click-free\n// (re)starts. Faithful port of core/voice-sim.js (the unit-tested JS\n// reference). See docs/VOICE.md for the state machine and open questions.\n//\n// INPUTS\n//   in1   host beat phase, 0..1 ramp once per beat (plugphasor~). Only used\n//         when Param `playing` = 1 (otherwise a free-running phase is used).\n// OUTPUTS\n//   out1  left   (mono buffers are duplicated to both outputs)\n//   out2  right\n//   out3  active: 1 from the start of a hit until the voice is idle again\n//         (end of slice reached, released, killed). A falling edge here is\n//         the \"voiceend\" report. While `held` = 1 and `rptdiv` > 0 a voice\n//         whose hit has finished stays active (silent) waiting for the next\n//         repeat.\n// BUFFER\n//   `Buffer src` is rebound with the message `src <buffer~ name>` sent to gen~.\n//\n// PARAMS (plain numbers, set with the message `<name> <value>`)\n//   bufsr     Hz       sample rate of the buffer\n//                      (increment = 2^(pitch/12) * bufsr / samplerate * tape)\n//   pstart    frames   playhead start (float)\n//   pend      frames   stop position; dir 1: pend > pstart, dir -1: pend < pstart\n//   dir       +-1      playback direction (< 0 = reverse)\n//   pitch     st       transposition in semitones\n//   amp       linear   output gain incl. velocity, smoothed with a ~5 ms one-pole\n//   att       ms       attack  (linear 0 -> 1; a 1 ms fade-in is always applied)\n//   dec       ms       decay   (exponential, -80 dB in `dec` ms, toward `sus`)\n//   sus       0..1     sustain level\n//   rel       ms       release (exponential, -80 dB in `rel` ms; minimum 1 ms)\n//   gatemode  0/1      1 = gate: held -> 0 starts the release.\n//                      0 = trigger: held -> 0 never releases; it only ends\n//                      repeat and micro-loop, the hit plays on to `pend`.\n//   held      0/1      key is down (named `held`: `gate` is a gen operator)\n//   loopon    0/1      micro-loop while held = 1\n//   loopsize  frames   loop length (clamped to [1, span])\n//   looppos   0..1     loop start inside the played range:\n//                      start + dir*looppos*(span - loopsize)\n//   rptdiv    1/beat   repeats per beat, 0 = off. Retrigger at grid lines\n//                      while held = 1\n//   rptswing  0..1     every 2nd grid line is delayed to pair position\n//                      0.5 + 0.25*rptswing\n//   rptalt    0/1      alternate direction on every repeat\n//   cutoff    Hz       2-pole low-pass (Simper TPT SVF, Q = 0.7071);\n//                      >= 19000 = bypass. Smoothed: one-pole (~10 ms) on\n//                      log2(Hz), snapped to the target at every (re)start. The\n//                      bypass is decided on the smoothed value and cross-faded\n//                      in 2 ms.\n//   drive     0..1     y = tanh(x*(1+9*drive))/tanh(1+9*drive) when > 0\n//                      (signal chain: filter -> drive -> envelope/fades -> amp)\n//   tape      0/1      1: rate factor falls linearly to 0 in `tapems`;\n//                      0: back to 1 within 10 ms\n//   tapems    ms       tape stop time\n//   bpm       BPM      free-running repeat grid (when playing = 0)\n//   playing   0/1      1: repeat grid from in1 (host phase), 0: free-running\n//   trig      counter  any change (re)starts the hit (1 ms fade-out first if\n//                      it is sounding). The first value must differ from 0.\n//   kill      counter  any change fades the voice out in 2 ms (choke)\n//\n// GenExpr rules followed here (see docs/VOICE.md):\n//   - Param/History/Buffer declarations first; no functions; only `//`\n//     comments; no operator assignments (plain `x = x + 1`).\n//   - GenExpr scopes variables to their {} block, so every temporary is\n//     assigned once at top level before it is used inside an if block.\n//   - Persistent state lives in History variables (h_*). Each is copied into\n//     a local at the top of the sample and written back at the very end, so\n//     the code never depends on whether a History read sees a write made in\n//     the same sample.\n\nParam bufsr(44100, min=1000, max=768000);\nParam pstart(0, min=0, max=1000000000);\nParam pend(0, min=0, max=1000000000);\nParam dir(1, min=-1, max=1);\nParam pitch(0, min=-96, max=96);\nParam amp(1, min=0, max=32);\nParam att(0, min=0, max=60000);\nParam dec(0, min=0, max=60000);\nParam sus(1, min=0, max=1);\nParam rel(30, min=0, max=60000);\nParam gatemode(0, min=0, max=1);\nParam held(0, min=0, max=1);\nParam loopon(0, min=0, max=1);\nParam loopsize(1000, min=0, max=1000000000);\nParam looppos(0, min=0, max=1);\nParam rptdiv(0, min=0, max=256);\nParam rptswing(0, min=0, max=1);\nParam rptalt(0, min=0, max=1);\nParam cutoff(20000, min=1, max=96000);\nParam drive(0, min=0, max=1);\nParam tape(0, min=0, max=1);\nParam tapems(500, min=1, max=60000);\nParam bpm(120, min=1, max=999);\nParam playing(0, min=0, max=1);\nParam trig(0, min=0, max=1000000000);\nParam kill(0, min=0, max=1000000000);\n\nBuffer src;\n\nHistory h_st(0);\nHistory h_mode(0);\nHistory h_pkind(1);\nHistory h_g(0);\nHistory h_pos(0);\nHistory h_sdir(1);\nHistory h_sstart(0);\nHistory h_sstop(0);\nHistory h_alt(0);\nHistory h_stage(0);\nHistory h_envv(0);\nHistory h_ampsm(1);\nHistory h_tf(1);\nHistory h_lw(0);\nHistory h_looping(0);\nHistory h_lstart(0);\nHistory h_lend(0);\nHistory h_llen(1);\nHistory h_lcprev(0);\nHistory h_lastk(-1);\nHistory h_fr(0);\nHistory h_plprev(0);\nHistory h_lastph(0);\nHistory h_rdprev(0);\nHistory h_swprev(0);\nHistory h_seentrig(0);\nHistory h_seenkill(0);\nHistory h_ic1l(0);\nHistory h_ic2l(0);\nHistory h_ic1r(0);\nHistory h_ic2r(0);\nHistory h_cs(14.29);\nHistory h_byp(1);\n\n// ---------------------------------------------------------------------\n// Per-sample temporaries. All assigned here, at top level, because GenExpr\n// variables are block scoped (a variable first assigned inside an if block\n// does not exist after it).\n// ---------------------------------------------------------------------\nsr = samplerate;\nnsrc = dim(src);\nchr = 0;\nif (channels(src) > 1) {\n  chr = 1;\n}\n\n// constants derived from the sample rate\nfadein_step = 1 / (0.001 * sr);\nrtfade_step = 1 / (0.001 * sr);\nkillfade_step = 1 / (0.002 * sr);\nendfade_len = 0.002 * sr;\ntape_back_step = 1 / (0.01 * sr);\nloopexit_step = 1 / (0.001 * sr);\nampcoef = 1 - exp(-1 / (0.005 * sr));\nbypstep = 1 / (0.002 * sr);\n\n// ---- load state ------------------------------------------------------\nst = h_st;\nmode = h_mode;\npkind = h_pkind;\ng = h_g;\npos = h_pos;\nsdir = h_sdir;\nsstart = h_sstart;\nsstop = h_sstop;\nalt = h_alt;\nstage = h_stage;\nenvv = h_envv;\nampsm = h_ampsm;\ntf = h_tf;\nlw = h_lw;\nlooping = h_looping;\nlstart = h_lstart;\nlend = h_lend;\nllen = h_llen;\nlcprev = h_lcprev;\nlastk = h_lastk;\nfr = h_fr;\nplprev = h_plprev;\nlastph = h_lastph;\nrdprev = h_rdprev;\nswprev = h_swprev;\nseentrig = h_seentrig;\nseenkill = h_seenkill;\nic1l = h_ic1l;\nic2l = h_ic2l;\nic1r = h_ic1r;\nic2r = h_ic2r;\ncs = h_cs;\nbyp = h_byp;\n\n// other temporaries (declared here for scope)\ntrigreq = 0;\nph = 0;\npl = 0;\nrd = 0;\nkidx = -1;\ngp = 0;\npairs = 0;\nodd = 0.5;\nfire = 0;\nrptact = 0;\ndorestart = 0;\ndd = 1;\nspan = 0;\nlc = 0;\nremain = 0;\nended = 0;\nfinish = 0;\nincr = 0;\naincr = 0;\nge = 1;\nxf = 1;\nstg = 0;\nattn = 0;\ndecn = 0;\nreln = 0;\nover = 0;\nvg = 0;\np1 = 0;\np2 = 0;\ni0 = 0;\nf1 = 0;\na0 = 0;\nb0 = 0;\na1 = 0;\nb1 = 0;\nxl = 0;\nxr = 0;\nctgt = 0;\ncscoef = 0;\nlcut = 0;\nfh = 0;\nbt = 0;\nfc = 0;\ngf = 0;\na1f = 0;\na2f = 0;\na3f = 0;\nv1 = 0;\nv2 = 0;\nv3 = 0;\nyl = 0;\nyr = 0;\nda = 1;\ndn = 1;\ndw = 0;\noutl = 0;\noutr = 0;\nouta = 0;\n\n// cutoff target (Hz) for the smoother: the bypass range (>= 19000) aims above\n// it so that the bypass is reached in finite time\nctgt = max(cutoff, 10);\nif (cutoff >= 19000) {\n  ctgt = 24000;\n}\n\n// ---- 1. host events: kill and trig ------------------------------------\nif (kill != seenkill) {\n  seenkill = kill;\n  if (st == 1) {\n    mode = 2;\n  }\n  if (st == 2) {\n    st = 0;\n    mode = 0;\n  }\n}\nif (trig != seentrig) {\n  seentrig = trig;\n  trigreq = 1;\n}\n\n// a finished hit that waits for the next repeat ends when the key is\n// released or repeat is turned off\nif (st == 2) {\n  if (held < 0.5 || rptdiv <= 0) {\n    st = 0;\n    mode = 0;\n  }\n}\n\n// ---- 2. repeat grid ---------------------------------------------------\n// phase in beats: host phase when playing, else free-running since note start\nph = in1;\nif (playing < 0.5) {\n  ph = fr;\n}\nif (ph < 0) {\n  ph = 0;\n}\npl = 0;\nif (playing > 0.5) {\n  pl = 1;\n}\nrd = rptdiv;\nkidx = -1;\nif (rd > 0) {\n  // grid lines come in pairs: the even line at pair position 0, the odd one\n  // at 0.5 + 0.25*swing; kidx numbers the lines\n  gp = ph * rd * 0.5;\n  pairs = floor(gp);\n  odd = 0.5 + 0.25 * rptswing;\n  kidx = 2 * pairs;\n  if (gp - pairs >= odd) {\n    kidx = kidx + 1;\n  }\n}\nfire = 0;\nrptact = 0;\nif (rd > 0 && held > 0.5 && st != 0) {\n  rptact = 1;\n}\nif (rptact > 0.5) {\n  // no retrigger on the very first look at the grid, nor when the phase\n  // source or the grid itself was just changed (playing / rptdiv / rptswing)\n  if (lastk >= 0 && pl == plprev && rd == rdprev && rptswing == swprev) {\n    if (ph - lastph < -0.5) {\n      // the beat phase wrapped around: always a new grid line (this is the\n      // only way to see it when rptdiv = 1, where the line index never changes)\n      fire = 1;\n    } else {\n      if (kidx > lastk) {\n        fire = 1;\n      }\n      // a tiny step backwards (phase jitter) must not count as a new line later\n      if (kidx < lastk && lastk - kidx <= 1) {\n        kidx = lastk;\n      }\n    }\n  }\n  lastk = kidx;\n  lastph = ph;\n} else {\n  lastk = -1;\n}\nplprev = pl;\nrdprev = rd;\nswprev = rptswing;\n\n// ---- 3. restart decisions ---------------------------------------------\ndorestart = 0;\nif (trigreq > 0.5) {\n  pkind = 1;\n  if (st == 1) {\n    mode = 1;\n  } else {\n    dorestart = 1;\n  }\n} else {\n  if (fire > 0.5) {\n    if (st == 2) {\n      pkind = 2;\n      dorestart = 1;\n    }\n    if (st == 1 && mode == 0) {\n      pkind = 2;\n      mode = 1;\n    }\n  }\n}\n// fade-out finished: jump now\nif (st == 1 && mode == 1 && g <= 0) {\n  dorestart = 1;\n}\n// kill fade finished\nif (dorestart < 0.5) {\n  if (st == 1 && mode == 2 && g <= 0) {\n    st = 0;\n    mode = 0;\n  }\n}\n\n// ---- 4. (re)start the hit ---------------------------------------------\nif (dorestart > 0.5) {\n  if (pkind == 1) {\n    // new note: direction toggle and free-running clock start over\n    alt = 0;\n    fr = 0;\n    lastk = -1;\n  } else {\n    // repeat: alternate direction when rptalt is on\n    if (rptalt > 0.5) {\n      alt = 1 - alt;\n    } else {\n      alt = 0;\n    }\n  }\n  // every hit starts with a cold filter (the gain stage is after the filter)\n  ic1l = 0;\n  ic2l = 0;\n  ic1r = 0;\n  ic2r = 0;\n  // every hit starts exactly at its cutoff (smoother snapped, bypass decided)\n  cs = log(ctgt) * 1.4426950408889634;\n  byp = 0;\n  if (ctgt >= 19000) {\n    byp = 1;\n  }\n  dd = 1;\n  if (dir < 0) {\n    dd = -1;\n  }\n  sdir = dd;\n  sstart = pstart;\n  sstop = pend;\n  if (alt > 0.5) {\n    sdir = 0 - dd;\n    sstart = pend;\n    sstop = pstart;\n  }\n  span = abs(pend - pstart);\n  lc = 0;\n  if (loopon > 0.5 && held > 0.5) {\n    lc = 1;\n  }\n  looping = 0;\n  llen = min(max(loopsize, 1), span);\n  if (lc > 0.5 && span >= 1) {\n    looping = 1;\n    lstart = sstart + sdir * looppos * (span - llen);\n    lend = lstart + sdir * llen;\n  }\n  lcprev = lc;\n  pos = sstart;\n  if (looping > 0.5) {\n    pos = lstart;\n  }\n  stage = 1;\n  envv = 0;\n  g = 0;\n  mode = 0;\n  ampsm = amp;\n  tf = 1;\n  lw = 0;\n  st = 1;\n}\n\n// ---- 5. render one sample ---------------------------------------------\nif (st == 1) {\n  // micro-loop enter / leave\n  span = abs(sstart - sstop);\n  lc = 0;\n  if (loopon > 0.5 && held > 0.5) {\n    lc = 1;\n  }\n  if (lc > 0.5 && lcprev < 0.5 && looping < 0.5 && span >= 1) {\n    // loop switched on while playing: arm it if its end is still ahead\n    llen = min(max(loopsize, 1), span);\n    lstart = sstart + sdir * looppos * (span - llen);\n    lend = lstart + sdir * llen;\n    if ((lend - pos) * sdir > 0) {\n      looping = 1;\n    }\n  }\n  if (lc < 0.5) {\n    looping = 0;\n  }\n  lcprev = lc;\n\n  // end of the slice reached?\n  remain = (sstop - pos) * sdir;\n  ended = 0;\n  if (looping < 0.5 && remain <= 0) {\n    ended = 1;\n  }\n\n  if (ended > 0.5) {\n    if (mode == 1) {\n      // a restart is pending: nothing left to fade, restart on the next sample\n      g = 0;\n    } else {\n      if (rptdiv > 0 && held > 0.5) {\n        st = 2;\n      } else {\n        st = 0;\n      }\n      g = 0;\n      mode = 0;\n    }\n  } else {\n    // tape stop / recovery\n    if (tape > 0.5) {\n      tf = max(tf - 1 / max(tapems * 0.001 * sr, 1), 0);\n    } else {\n      tf = min(tf + tape_back_step, 1);\n    }\n    // a tape-stopped voice whose key was released would never end\n    if (tf <= 0 && held < 0.5 && mode == 0) {\n      mode = 2;\n    }\n\n    // declick gain: 1 ms fade-in, 1 ms fade-out before a retrigger,\n    // 2 ms fade-out for kill\n    if (mode == 1) {\n      g = max(g - rtfade_step, 0);\n    } else {\n      if (mode == 2) {\n        g = max(g - killfade_step, 0);\n      } else {\n        g = min(g + fadein_step, 1);\n      }\n    }\n\n    // envelope: 1 attack, 2 decay, 3 sustain, 4 release\n    finish = 0;\n    if (gatemode > 0.5 && held < 0.5 && stage != 4) {\n      stage = 4;\n    }\n    stg = stage;\n    if (stg == 1) {\n      attn = att * 0.001 * sr;\n      if (attn <= 1) {\n        envv = 1;\n        stage = 2;\n      } else {\n        envv = envv + 1 / attn;\n        if (envv >= 1) {\n          envv = 1;\n          stage = 2;\n        }\n      }\n    }\n    if (stg == 2) {\n      decn = dec * 0.001 * sr;\n      if (decn <= 1) {\n        envv = sus;\n        stage = 3;\n      } else {\n        envv = sus + (envv - sus) * exp(-9.210340371976184 / decn);\n        if (envv - sus < 0.0001) {\n          envv = sus;\n          stage = 3;\n        }\n      }\n    }\n    if (stg == 3) {\n      envv = sus;\n    }\n    if (stg == 4) {\n      reln = max(rel * 0.001 * sr, 0.001 * sr);\n      envv = envv * exp(-9.210340371976184 / reln);\n      if (envv < 0.0001) {\n        envv = 0;\n        finish = 1;\n      }\n    }\n\n    // playback increment in buffer frames per sample\n    incr = sdir * exp(pitch * 0.05776226504666211) * bufsr / sr * tf;\n    aincr = abs(incr);\n\n    // fade-out lookahead: 2 ms (of output time) before the end is reached\n    ge = 1;\n    if (looping < 0.5 && aincr > 0.000001) {\n      ge = min(1, remain / (aincr * endfade_len));\n    }\n\n    // micro-loop crossfade weight. Inside the last xf frames of the loop the\n    // signal at (pos - sdir*llen) - the material just before the loop start,\n    // which plays on seamlessly after the wrap - is blended in. After the loop\n    // is left the weight fades out in 1 ms.\n    if (looping > 0.5) {\n      xf = max(1, min(0.005 * bufsr, 0.25 * llen));\n      lw = 1 - ((lend - pos) * sdir) / xf;\n      lw = min(max(lw, 0), 1);\n    } else {\n      lw = max(lw - loopexit_step, 0);\n    }\n\n    // read the buffer at pos (linear interpolation, silent outside)\n    p1 = pos;\n    i0 = floor(p1);\n    f1 = p1 - i0;\n    a0 = 0;\n    b0 = 0;\n    a1 = 0;\n    b1 = 0;\n    if (i0 >= 0 && i0 < nsrc) {\n      a0 = peek(src, i0, 0);\n      a1 = peek(src, i0, chr);\n    }\n    if (i0 + 1 >= 0 && i0 + 1 < nsrc) {\n      b0 = peek(src, i0 + 1, 0);\n      b1 = peek(src, i0 + 1, chr);\n    }\n    xl = a0 + (b0 - a0) * f1;\n    xr = a1 + (b1 - a1) * f1;\n\n    if (lw > 0) {\n      p2 = pos - sdir * llen;\n      i0 = floor(p2);\n      f1 = p2 - i0;\n      a0 = 0;\n      b0 = 0;\n      a1 = 0;\n      b1 = 0;\n      if (i0 >= 0 && i0 < nsrc) {\n        a0 = peek(src, i0, 0);\n        a1 = peek(src, i0, chr);\n      }\n      if (i0 + 1 >= 0 && i0 + 1 < nsrc) {\n        b0 = peek(src, i0 + 1, 0);\n        b1 = peek(src, i0 + 1, chr);\n      }\n      xl = xl * (1 - lw) + (a0 + (b0 - a0) * f1) * lw;\n      xr = xr * (1 - lw) + (a1 + (b1 - a1) * f1) * lw;\n    }\n\n    // cutoff smoothing: one-pole (~10 ms) on log2(Hz), so gesture sweeps that\n    // update `cutoff` every ~15 ms do not zipper\n    cscoef = 1 - exp(-1 / (0.01 * sr));\n    lcut = log(ctgt) * 1.4426950408889634;\n    cs = cs + (lcut - cs) * cscoef;\n    fh = exp(cs * 0.6931471805599453);\n    // bypass (>= 19000 Hz) is decided on the smoothed value; the filtered and\n    // dry signals are cross-faded in 2 ms so the switch never clicks\n    bt = 0;\n    if (fh >= 19000) {\n      bt = 1;\n    }\n    byp = min(max(bt, byp - bypstep), byp + bypstep);\n\n    // 2-pole TPT low-pass (Simper SVF) on the raw signal. It always runs so\n    // its state is warm; byp = 1 outputs the dry signal.\n    fc = min(max(fh, 10), 0.45 * sr);\n    gf = tan(3.141592653589793 * fc / sr);\n    a1f = 1 / (1 + gf * (gf + 1.4142135623730951));\n    a2f = gf * a1f;\n    a3f = gf * a2f;\n    v3 = xl - ic2l;\n    v1 = a1f * ic1l + a2f * v3;\n    v2 = ic2l + a2f * ic1l + a3f * v3;\n    ic1l = 2 * v1 - ic1l;\n    ic2l = 2 * v2 - ic2l;\n    yl = v2;\n    v3 = xr - ic2r;\n    v1 = a1f * ic1r + a2f * v3;\n    v2 = ic2r + a2f * ic1r + a3f * v3;\n    ic1r = 2 * v1 - ic1r;\n    ic2r = 2 * v2 - ic2r;\n    yr = v2;\n    yl = yl * (1 - byp) + xl * byp;\n    yr = yr * (1 - byp) + xr * byp;\n\n    // drive\n    // the shaped signal fades in over drive 0..0.1, so there is no level\n    // jump (tanh(x)/tanh(1) is ~+2.4 dB for small x) just above 0\n    if (drive > 0) {\n      da = 1 + 9 * drive;\n      dn = tanh(da);\n      dw = min(1, drive * 10);\n      yl = yl + (tanh(yl * da) / dn - yl) * dw;\n      yr = yr + (tanh(yr * da) / dn - yr) * dw;\n    }\n\n    // gain stage after filter and drive, so every fade ends in exact silence\n    // (no filter ring-out is ever chopped): declick * end fade * envelope *\n    // tape (amplitude ~ sqrt of the rate factor), then amp smoothed (~5 ms)\n    vg = g * ge * envv * sqrt(tf);\n    ampsm = ampsm + (amp - ampsm) * ampcoef;\n    outl = yl * vg * ampsm;\n    outr = yr * vg * ampsm;\n\n    // advance the playhead, wrap inside the micro-loop\n    pos = pos + incr;\n    if (looping > 0.5) {\n      over = (pos - lend) * sdir;\n      if (over >= 0) {\n        pos = pos - sdir * llen * (floor(over / llen) + 1);\n      }\n    }\n\n    // the envelope reached -80 dB: the voice is done (unless a restart is\n    // already pending, which then takes over on the next sample)\n    if (finish > 0.5) {\n      if (mode == 1) {\n        g = 0;\n      } else {\n        st = 0;\n        mode = 0;\n      }\n    }\n  }\n}\n\n// the free-running repeat clock runs while the voice is active\nif (st != 0) {\n  fr = fr + bpm / (60 * sr);\n}\n\nouta = 0;\nif (st != 0) {\n  outa = 1;\n}\n\n// ---- store state -------------------------------------------------------\nh_st = st;\nh_mode = mode;\nh_pkind = pkind;\nh_g = g;\nh_pos = pos;\nh_sdir = sdir;\nh_sstart = sstart;\nh_sstop = sstop;\nh_alt = alt;\nh_stage = stage;\nh_envv = envv;\nh_ampsm = ampsm;\nh_tf = tf;\nh_lw = lw;\nh_looping = looping;\nh_lstart = lstart;\nh_lend = lend;\nh_llen = llen;\nh_lcprev = lcprev;\nh_lastk = lastk;\nh_fr = fr;\nh_plprev = plprev;\nh_lastph = lastph;\nh_rdprev = rdprev;\nh_swprev = swprev;\nh_seentrig = seentrig;\nh_seenkill = seenkill;\nh_ic1l = ic1l;\nh_ic2l = ic2l;\nh_ic1r = ic1r;\nh_ic2r = ic2r;\nh_cs = cs;\nh_byp = byp;\n\nout1 = outl;\nout2 = outr;\nout3 = outa;\n",
									"fontface": 0,
									"fontname": "<Monospaced>",
									"fontsize": 12,
									"numinlets": 1,
									"numoutlets": 3,
									"outlettype": [
										"",
										"",
										""
									],
									"patching_rect": [
										30,
										56,
										640,
										520
									]
								}
							},
							{
								"box": {
									"id": "obj-3",
									"maxclass": "newobj",
									"text": "out 1",
									"numinlets": 1,
									"numoutlets": 0,
									"patching_rect": [
										30,
										600,
										46,
										22
									]
								}
							},
							{
								"box": {
									"id": "obj-4",
									"maxclass": "newobj",
									"text": "out 2",
									"numinlets": 1,
									"numoutlets": 0,
									"patching_rect": [
										120,
										600,
										46,
										22
									]
								}
							},
							{
								"box": {
									"id": "obj-5",
									"maxclass": "newobj",
									"text": "out 3",
									"numinlets": 1,
									"numoutlets": 0,
									"patching_rect": [
										210,
										600,
										46,
										22
									]
								}
							}
						],
						"lines": [
							{
								"patchline": {
									"source": [
										"obj-1",
										0
									],
									"destination": [
										"obj-2",
										0
									]
								}
							},
							{
								"patchline": {
									"source": [
										"obj-2",
										0
									],
									"destination": [
										"obj-3",
										0
									]
								}
							},
							{
								"patchline": {
									"source": [
										"obj-2",
										1
									],
									"destination": [
										"obj-4",
										0
									]
								}
							},
							{
								"patchline": {
									"source": [
										"obj-2",
										2
									],
									"destination": [
										"obj-5",
										0
									]
								}
							}
						],
						"originid": "pat-1"
					},
					"saved_object_attributes": {
						"globalpatchername": ""
					}
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "newobj",
					"text": "out~ 1",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						30,
						190,
						50,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"text": "out~ 2",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						190,
						190,
						50,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "comment",
					"text": "active (gen~ out 3) falling edge -> voiceend <voice#>",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						350,
						160,
						380,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"text": "edge~",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"bang",
						"bang"
					],
					"patching_rect": [
						350,
						190,
						44,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "newobj",
					"text": "int",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						"int"
					],
					"patching_rect": [
						350,
						250,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"text": "prepend voiceend",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						350,
						290,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "newobj",
					"text": "out 3",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						350,
						330,
						44,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "newobj",
					"text": "loadbang",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						520,
						190,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "newobj",
					"text": "thispoly~",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"int",
						"int",
						"int"
					],
					"patching_rect": [
						520,
						224,
						68,
						22
					]
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": [
						"obj-2",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-3",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						0
					],
					"destination": [
						"obj-5",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						1
					],
					"destination": [
						"obj-6",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						2
					],
					"destination": [
						"obj-8",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-8",
						1
					],
					"destination": [
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						0
					],
					"destination": [
						"obj-10",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-10",
						0
					],
					"destination": [
						"obj-11",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-12",
						0
					],
					"destination": [
						"obj-13",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-13",
						0
					],
					"destination": [
						"obj-9",
						1
					]
				}
			}
		],
		"bglocked": 0,
		"autosave": 0
	}
}
