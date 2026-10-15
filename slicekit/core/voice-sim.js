'use strict';
/*
 * SliceKit voice - JS reference simulation (pure ES5, CommonJS).
 *
 * Statement-for-statement mirror of max/voice.genexpr (the gen~ codebox).
 * Variable names, order of operations and constants are identical on purpose,
 * so that test/voice-sim.test.js can check the two against each other. The
 * only intended differences are Max-specific plumbing (Param / History /
 * Buffer declarations, `in1`, `out1..3`, `peek`, `dim`, `channels`).
 *
 *   var sim = VoiceSim.create({ sampleRate: 44100,
 *                               buffer: { channels: [Float32Array, ...], sr: 44100 } });
 *   sim.set('pstart', 0);                       // same names as the gen~ Params
 *   sim.process(n, function (i, k) { return phase; })
 *       -> { left, right, active, pos, env, cut }  // Float32Array x3, Float64Array x3
 *
 * `beatPhase(i, k)` gives the host beat phase (0..1 per beat) for sample `i`
 * of this call (`k` = sample index since creation); null means phase 0.
 * `pos` / `env` / `cut` are extras for tests (playhead before the read,
 * envelope, effective filter cutoff in Hz after smoothing; -1 when not rendering).
 * The `src` param is accepted and ignored (the buffer is given at create or
 * with setBuffer). Unknown names throw. Values are clamped to the same
 * [min, max] as the `Param` declarations in voice.genexpr.
 */

// name -> default / min / max. Keep in sync with the Param lines of
// max/voice.genexpr (a unit test compares them).
var PARAMS = {
  bufsr: { def: 44100, min: 1000, max: 768000 },
  pstart: { def: 0, min: 0, max: 1000000000 },
  pend: { def: 0, min: 0, max: 1000000000 },
  dir: { def: 1, min: -1, max: 1 },
  pitch: { def: 0, min: -96, max: 96 },
  amp: { def: 1, min: 0, max: 32 },
  att: { def: 0, min: 0, max: 60000 },
  dec: { def: 0, min: 0, max: 60000 },
  sus: { def: 1, min: 0, max: 1 },
  rel: { def: 30, min: 0, max: 60000 },
  gatemode: { def: 0, min: 0, max: 1 },
  held: { def: 0, min: 0, max: 1 },
  loopon: { def: 0, min: 0, max: 1 },
  loopsize: { def: 1000, min: 0, max: 1000000000 },
  looppos: { def: 0, min: 0, max: 1 },
  rptdiv: { def: 0, min: 0, max: 256 },
  rptswing: { def: 0, min: 0, max: 1 },
  rptalt: { def: 0, min: 0, max: 1 },
  cutoff: { def: 20000, min: 1, max: 96000 },
  drive: { def: 0, min: 0, max: 1 },
  tape: { def: 0, min: 0, max: 1 },
  tapems: { def: 500, min: 1, max: 60000 },
  bpm: { def: 120, min: 1, max: 999 },
  playing: { def: 0, min: 0, max: 1 },
  trig: { def: 0, min: 0, max: 1000000000 },
  kill: { def: 0, min: 0, max: 1000000000 }
};

var floor = Math.floor;
var abs = Math.abs;
var min = Math.min;
var max = Math.max;
var exp = Math.exp;
var log = Math.log;
var tan = Math.tan;
var sqrt = Math.sqrt;

// Math.tanh is ES6; this file must stay ES5-safe
function tanh(x) {
  var e2;
  if (x > 20) { return 1; }
  if (x < -20) { return -1; }
  e2 = exp(2 * x);
  return (e2 - 1) / (e2 + 1);
}

function create(opts) {
  opts = opts || {};
  var samplerate = (typeof opts.sampleRate === 'number' && opts.sampleRate > 0) ? opts.sampleRate : 44100;
  var logOn = !!opts.log;
  var events = [];
  var sampleCount = 0;

  var src = null;       // { channels: [Float32Array...], sr }
  var P = {};           // current param values
  var name;

  // --- History state (see voice.genexpr) ---
  var h_st = 0, h_mode = 0, h_pkind = 1, h_g = 0, h_pos = 0, h_sdir = 1;
  var h_sstart = 0, h_sstop = 0, h_alt = 0, h_stage = 0, h_envv = 0, h_ampsm = 1;
  var h_tf = 1, h_lw = 0, h_looping = 0, h_lstart = 0, h_lend = 0, h_llen = 1;
  var h_lcprev = 0, h_lastk = -1, h_fr = 0, h_plprev = 0, h_lastph = 0, h_rdprev = 0, h_swprev = 0;
  var h_seentrig = 0;
  var h_seenkill = 0, h_ic1l = 0, h_ic2l = 0, h_ic1r = 0, h_ic2r = 0;
  var h_cs = 14.29, h_byp = 1;

  // --- outputs of the last tick ---
  var out1 = 0, out2 = 0, out3 = 0;
  var dbgPos = 0;
  var dbgEnv = 0;
  var dbgCut = -1;

  for (name in PARAMS) {
    if (Object.prototype.hasOwnProperty.call(PARAMS, name)) { P[name] = PARAMS[name].def; }
  }

  function setBuffer(b) {
    src = b || null;
  }

  // gen: dim(src) / channels(src) / peek(src, index, channel) (0 outside)
  function dim() {
    return (src && src.channels && src.channels.length) ? src.channels[0].length : 0;
  }
  function channels() {
    return (src && src.channels) ? src.channels.length : 0;
  }
  function peek(index, ch) {
    var data;
    if (!src || !src.channels || src.channels.length === 0) { return 0; }
    data = src.channels[ch];
    if (!data || index < 0 || index >= data.length) { return 0; }
    return data[index];
  }

  function logEvent(type, extra) {
    var e = { n: sampleCount, type: type };
    var key;
    if (extra) {
      for (key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) { e[key] = extra[key]; }
      }
    }
    events.push(e);
  }

  // One sample. Everything below follows voice.genexpr top to bottom.
  function tick(in1) {
    var bufsr = P.bufsr, pstart = P.pstart, pend = P.pend, dir = P.dir, pitch = P.pitch;
    var amp = P.amp, att = P.att, dec = P.dec, sus = P.sus, rel = P.rel;
    var gatemode = P.gatemode, held = P.held, loopon = P.loopon, loopsize = P.loopsize;
    var looppos = P.looppos, rptdiv = P.rptdiv, rptswing = P.rptswing, rptalt = P.rptalt;
    var cutoff = P.cutoff, drive = P.drive, tape = P.tape, tapems = P.tapems, bpm = P.bpm;
    var playing = P.playing, trig = P.trig, kill = P.kill;

    var sr = samplerate;
    var nsrc = dim();
    var chr = 0;
    var fadein_step, rtfade_step, killfade_step, endfade_len, tape_back_step, loopexit_step, ampcoef;
    var bypstep;
    var st, mode, pkind, g, pos, sdir, sstart, sstop, alt, stage, envv, ampsm, tf, lw;
    var looping, lstart, lend, llen, lcprev, lastk, fr, plprev, lastph, rdprev, swprev, seentrig, seenkill;
    var ic1l, ic2l, ic1r, ic2r, cs, byp;
    var trigreq = 0, ph = 0, pl = 0, rd = 0, kidx = -1, gp = 0, pairs = 0, odd = 0.5;
    var fire = 0, rptact = 0, dorestart = 0, dd = 1, span = 0, lc = 0, remain = 0;
    var ended = 0, finish = 0, incr = 0, aincr = 0, ge = 1, xf = 1, stg = 0;
    var attn = 0, decn = 0, reln = 0, over = 0, vg = 0, p1 = 0, p2 = 0, i0 = 0, f1 = 0;
    var a0 = 0, b0 = 0, a1 = 0, b1 = 0, xl = 0, xr = 0;
    var ctgt = 0, cscoef = 0, lcut = 0, fh = 0, bt = 0;
    var fc = 0, gf = 0, a1f = 0, a2f = 0, a3f = 0, v1 = 0, v2 = 0, v3 = 0;
    var yl = 0, yr = 0, da = 1, dn = 1, dw = 0, outl = 0, outr = 0, outa = 0;

    if (channels() > 1) {
      chr = 1;
    }

    // constants derived from the sample rate
    fadein_step = 1 / (0.001 * sr);
    rtfade_step = 1 / (0.001 * sr);
    killfade_step = 1 / (0.002 * sr);
    endfade_len = 0.002 * sr;
    tape_back_step = 1 / (0.01 * sr);
    loopexit_step = 1 / (0.001 * sr);
    ampcoef = 1 - exp(-1 / (0.005 * sr));
    bypstep = 1 / (0.002 * sr);

    // ---- load state ----
    st = h_st;
    mode = h_mode;
    pkind = h_pkind;
    g = h_g;
    pos = h_pos;
    sdir = h_sdir;
    sstart = h_sstart;
    sstop = h_sstop;
    alt = h_alt;
    stage = h_stage;
    envv = h_envv;
    ampsm = h_ampsm;
    tf = h_tf;
    lw = h_lw;
    looping = h_looping;
    lstart = h_lstart;
    lend = h_lend;
    llen = h_llen;
    lcprev = h_lcprev;
    lastk = h_lastk;
    fr = h_fr;
    plprev = h_plprev;
    lastph = h_lastph;
    rdprev = h_rdprev;
    swprev = h_swprev;
    seentrig = h_seentrig;
    seenkill = h_seenkill;
    ic1l = h_ic1l;
    ic2l = h_ic2l;
    ic1r = h_ic1r;
    ic2r = h_ic2r;
    cs = h_cs;
    byp = h_byp;

    // cutoff target (Hz) for the smoother: the bypass range (>= 19000) aims
    // above it so that the bypass is reached in finite time
    ctgt = max(cutoff, 10);
    if (cutoff >= 19000) {
      ctgt = 24000;
    }

    // ---- 1. host events: kill and trig ----
    if (kill !== seenkill) {
      seenkill = kill;
      if (st === 1) {
        mode = 2;
        if (logOn) { logEvent('kill'); }
      }
      if (st === 2) {
        st = 0;
        mode = 0;
        if (logOn) { logEvent('kill'); logEvent('end', { why: 'kill' }); }
      }
    }
    if (trig !== seentrig) {
      seentrig = trig;
      trigreq = 1;
      if (logOn) { logEvent('trig'); }
    }

    // a finished hit that waits for the next repeat ends when the key is
    // released or repeat is turned off
    if (st === 2) {
      if (held < 0.5 || rptdiv <= 0) {
        st = 0;
        mode = 0;
        if (logOn) { logEvent('end', { why: 'wait' }); }
      }
    }

    // ---- 2. repeat grid ----
    ph = in1;
    if (playing < 0.5) {
      ph = fr;
    }
    if (ph < 0) {
      ph = 0;
    }
    pl = 0;
    if (playing > 0.5) {
      pl = 1;
    }
    rd = rptdiv;
    kidx = -1;
    if (rd > 0) {
      gp = ph * rd * 0.5;
      pairs = floor(gp);
      odd = 0.5 + 0.25 * rptswing;
      kidx = 2 * pairs;
      if (gp - pairs >= odd) {
        kidx = kidx + 1;
      }
    }
    fire = 0;
    rptact = 0;
    if (rd > 0 && held > 0.5 && st !== 0) {
      rptact = 1;
    }
    if (rptact > 0.5) {
      if (lastk >= 0 && pl === plprev && rd === rdprev && rptswing === swprev) {
        if (ph - lastph < -0.5) {
          fire = 1;
        } else {
          if (kidx > lastk) {
            fire = 1;
          }
          if (kidx < lastk && lastk - kidx <= 1) {
            kidx = lastk;
          }
        }
      }
      lastk = kidx;
      lastph = ph;
    } else {
      lastk = -1;
    }
    plprev = pl;
    rdprev = rd;
    swprev = rptswing;

    // ---- 3. restart decisions ----
    dorestart = 0;
    if (trigreq > 0.5) {
      pkind = 1;
      if (st === 1) {
        mode = 1;
      } else {
        dorestart = 1;
      }
    } else {
      if (fire > 0.5) {
        if (logOn) { logEvent('line', { k: kidx }); }
        if (st === 2) {
          pkind = 2;
          dorestart = 1;
        }
        if (st === 1 && mode === 0) {
          pkind = 2;
          mode = 1;
        }
      }
    }
    if (st === 1 && mode === 1 && g <= 0) {
      dorestart = 1;
    }
    if (dorestart < 0.5) {
      if (st === 1 && mode === 2 && g <= 0) {
        st = 0;
        mode = 0;
        if (logOn) { logEvent('end', { why: 'kill' }); }
      }
    }

    // ---- 4. (re)start the hit ----
    if (dorestart > 0.5) {
      if (pkind === 1) {
        alt = 0;
        fr = 0;
        lastk = -1;
      } else {
        if (rptalt > 0.5) {
          alt = 1 - alt;
        } else {
          alt = 0;
        }
      }
      ic1l = 0;
      ic2l = 0;
      ic1r = 0;
      ic2r = 0;
      // every hit starts exactly at its cutoff (smoother snapped, bypass decided)
      cs = log(ctgt) * 1.4426950408889634;
      byp = 0;
      if (ctgt >= 19000) {
        byp = 1;
      }
      dd = 1;
      if (dir < 0) {
        dd = -1;
      }
      sdir = dd;
      sstart = pstart;
      sstop = pend;
      if (alt > 0.5) {
        sdir = 0 - dd;
        sstart = pend;
        sstop = pstart;
      }
      span = abs(pend - pstart);
      lc = 0;
      if (loopon > 0.5 && held > 0.5) {
        lc = 1;
      }
      looping = 0;
      llen = min(max(loopsize, 1), span);
      if (lc > 0.5 && span >= 1) {
        looping = 1;
        lstart = sstart + sdir * looppos * (span - llen);
        lend = lstart + sdir * llen;
      }
      lcprev = lc;
      pos = sstart;
      if (looping > 0.5) {
        pos = lstart;
      }
      stage = 1;
      envv = 0;
      g = 0;
      mode = 0;
      ampsm = amp;
      tf = 1;
      lw = 0;
      st = 1;
      if (logOn) { logEvent('start', { kind: pkind, sdir: sdir, alt: alt, looping: looping }); }
    }

    // ---- 5. render one sample ----
    dbgPos = -1;
    dbgCut = -1;
    if (st === 1) {
      span = abs(sstart - sstop);
      lc = 0;
      if (loopon > 0.5 && held > 0.5) {
        lc = 1;
      }
      if (lc > 0.5 && lcprev < 0.5 && looping < 0.5 && span >= 1) {
        llen = min(max(loopsize, 1), span);
        lstart = sstart + sdir * looppos * (span - llen);
        lend = lstart + sdir * llen;
        if ((lend - pos) * sdir > 0) {
          looping = 1;
        }
      }
      if (lc < 0.5) {
        looping = 0;
      }
      lcprev = lc;

      remain = (sstop - pos) * sdir;
      ended = 0;
      if (looping < 0.5 && remain <= 0) {
        ended = 1;
      }

      if (ended > 0.5) {
        if (mode === 1) {
          g = 0;
        } else {
          if (rptdiv > 0 && held > 0.5) {
            st = 2;
            if (logOn) { logEvent('wait'); }
          } else {
            st = 0;
            if (logOn) { logEvent('end', { why: 'pend' }); }
          }
          g = 0;
          mode = 0;
        }
      } else {
        // tape stop / recovery
        if (tape > 0.5) {
          tf = max(tf - 1 / max(tapems * 0.001 * sr, 1), 0);
        } else {
          tf = min(tf + tape_back_step, 1);
        }
        if (tf <= 0 && held < 0.5 && mode === 0) {
          mode = 2;
        }

        // declick gain
        if (mode === 1) {
          g = max(g - rtfade_step, 0);
        } else {
          if (mode === 2) {
            g = max(g - killfade_step, 0);
          } else {
            g = min(g + fadein_step, 1);
          }
        }

        // envelope: 1 attack, 2 decay, 3 sustain, 4 release
        finish = 0;
        if (gatemode > 0.5 && held < 0.5 && stage !== 4) {
          stage = 4;
        }
        stg = stage;
        if (stg === 1) {
          attn = att * 0.001 * sr;
          if (attn <= 1) {
            envv = 1;
            stage = 2;
          } else {
            envv = envv + 1 / attn;
            if (envv >= 1) {
              envv = 1;
              stage = 2;
            }
          }
        }
        if (stg === 2) {
          decn = dec * 0.001 * sr;
          if (decn <= 1) {
            envv = sus;
            stage = 3;
          } else {
            envv = sus + (envv - sus) * exp(-9.210340371976184 / decn);
            if (envv - sus < 0.0001) {
              envv = sus;
              stage = 3;
            }
          }
        }
        if (stg === 3) {
          envv = sus;
        }
        if (stg === 4) {
          reln = max(rel * 0.001 * sr, 0.001 * sr);
          envv = envv * exp(-9.210340371976184 / reln);
          if (envv < 0.0001) {
            envv = 0;
            finish = 1;
          }
        }

        // playback increment in buffer frames per sample
        incr = sdir * exp(pitch * 0.05776226504666211) * bufsr / sr * tf;
        aincr = abs(incr);

        // fade-out lookahead before the end
        ge = 1;
        if (looping < 0.5 && aincr > 0.000001) {
          ge = min(1, remain / (aincr * endfade_len));
        }

        // micro-loop crossfade weight
        if (looping > 0.5) {
          xf = max(1, min(0.005 * bufsr, 0.25 * llen));
          lw = 1 - ((lend - pos) * sdir) / xf;
          lw = min(max(lw, 0), 1);
        } else {
          lw = max(lw - loopexit_step, 0);
        }

        // read the buffer at pos (linear interpolation, silent outside)
        p1 = pos;
        i0 = floor(p1);
        f1 = p1 - i0;
        a0 = 0;
        b0 = 0;
        a1 = 0;
        b1 = 0;
        if (i0 >= 0 && i0 < nsrc) {
          a0 = peek(i0, 0);
          a1 = peek(i0, chr);
        }
        if (i0 + 1 >= 0 && i0 + 1 < nsrc) {
          b0 = peek(i0 + 1, 0);
          b1 = peek(i0 + 1, chr);
        }
        xl = a0 + (b0 - a0) * f1;
        xr = a1 + (b1 - a1) * f1;

        if (lw > 0) {
          p2 = pos - sdir * llen;
          i0 = floor(p2);
          f1 = p2 - i0;
          a0 = 0;
          b0 = 0;
          a1 = 0;
          b1 = 0;
          if (i0 >= 0 && i0 < nsrc) {
            a0 = peek(i0, 0);
            a1 = peek(i0, chr);
          }
          if (i0 + 1 >= 0 && i0 + 1 < nsrc) {
            b0 = peek(i0 + 1, 0);
            b1 = peek(i0 + 1, chr);
          }
          xl = xl * (1 - lw) + (a0 + (b0 - a0) * f1) * lw;
          xr = xr * (1 - lw) + (a1 + (b1 - a1) * f1) * lw;
        }

        // cutoff smoothing: one-pole (~10 ms) on log2(Hz), so gesture sweeps that
        // update `cutoff` every ~15 ms do not zipper
        cscoef = 1 - exp(-1 / (0.01 * sr));
        lcut = log(ctgt) * 1.4426950408889634;
        cs = cs + (lcut - cs) * cscoef;
        fh = exp(cs * 0.6931471805599453);
        // bypass (>= 19000 Hz) is decided on the smoothed value and ramped in 2 ms
        bt = 0;
        if (fh >= 19000) {
          bt = 1;
        }
        byp = min(max(bt, byp - bypstep), byp + bypstep);

        // 2-pole TPT low-pass (Simper SVF) on the raw signal, always running
        fc = min(max(fh, 10), 0.45 * sr);
        dbgCut = fc;
        gf = tan(3.141592653589793 * fc / sr);
        a1f = 1 / (1 + gf * (gf + 1.4142135623730951));
        a2f = gf * a1f;
        a3f = gf * a2f;
        v3 = xl - ic2l;
        v1 = a1f * ic1l + a2f * v3;
        v2 = ic2l + a2f * ic1l + a3f * v3;
        ic1l = 2 * v1 - ic1l;
        ic2l = 2 * v2 - ic2l;
        yl = v2;
        v3 = xr - ic2r;
        v1 = a1f * ic1r + a2f * v3;
        v2 = ic2r + a2f * ic1r + a3f * v3;
        ic1r = 2 * v1 - ic1r;
        ic2r = 2 * v2 - ic2r;
        yr = v2;
        yl = yl * (1 - byp) + xl * byp;
        yr = yr * (1 - byp) + xr * byp;

        // drive
        // the shaped signal fades in over drive 0..0.1 (no level jump above 0)
        if (drive > 0) {
          da = 1 + 9 * drive;
          dn = tanh(da);
          dw = Math.min(1, drive * 10);
          yl = yl + (tanh(yl * da) / dn - yl) * dw;
          yr = yr + (tanh(yr * da) / dn - yr) * dw;
        }

        // gain stage after filter and drive, so every fade ends in exact silence:
        // declick * end fade * envelope * tape (~ sqrt of the rate factor),
        // then amp smoothed (~5 ms)
        vg = g * ge * envv * sqrt(tf);
        ampsm = ampsm + (amp - ampsm) * ampcoef;
        outl = yl * vg * ampsm;
        outr = yr * vg * ampsm;

        dbgPos = pos;

        // advance the playhead, wrap inside the micro-loop
        pos = pos + incr;
        if (looping > 0.5) {
          over = (pos - lend) * sdir;
          if (over >= 0) {
            pos = pos - sdir * llen * (floor(over / llen) + 1);
            if (logOn) { logEvent('wrap'); }
          }
        }

        if (finish > 0.5) {
          if (mode === 1) {
            g = 0;
          } else {
            st = 0;
            mode = 0;
            if (logOn) { logEvent('end', { why: 'release' }); }
          }
        }
      }
    }

    // the free-running repeat clock runs while the voice is active
    if (st !== 0) {
      fr = fr + bpm / (60 * sr);
    }

    outa = 0;
    if (st !== 0) {
      outa = 1;
    }

    // ---- store state ----
    h_st = st;
    h_mode = mode;
    h_pkind = pkind;
    h_g = g;
    h_pos = pos;
    h_sdir = sdir;
    h_sstart = sstart;
    h_sstop = sstop;
    h_alt = alt;
    h_stage = stage;
    h_envv = envv;
    h_ampsm = ampsm;
    h_tf = tf;
    h_lw = lw;
    h_looping = looping;
    h_lstart = lstart;
    h_lend = lend;
    h_llen = llen;
    h_lcprev = lcprev;
    h_lastk = lastk;
    h_fr = fr;
    h_plprev = plprev;
    h_lastph = lastph;
    h_rdprev = rdprev;
    h_swprev = swprev;
    h_seentrig = seentrig;
    h_seenkill = seenkill;
    h_ic1l = ic1l;
    h_ic2l = ic2l;
    h_ic1r = ic1r;
    h_ic2r = ic2r;
    h_cs = cs;
    h_byp = byp;

    dbgEnv = envv;
    out1 = outl;
    out2 = outr;
    out3 = outa;
  }

  function set(pname, value) {
    var def, v;
    if (pname === 'src') { return; }
    def = Object.prototype.hasOwnProperty.call(PARAMS, pname) ? PARAMS[pname] : null;
    if (!def) { throw new Error('VoiceSim: unknown param "' + pname + '"'); }
    v = Number(value);
    if (v !== v) { return; }
    if (v < def.min) { v = def.min; }
    if (v > def.max) { v = def.max; }
    P[pname] = v;
  }

  function get(pname) {
    if (!Object.prototype.hasOwnProperty.call(P, pname)) {
      throw new Error('VoiceSim: unknown param "' + pname + '"');
    }
    return P[pname];
  }

  function process(n, beatPhase) {
    var left = new Float32Array(n);
    var right = new Float32Array(n);
    var active = new Float32Array(n);
    var pos = new Float64Array(n);
    var env = new Float64Array(n);
    var cut = new Float64Array(n);
    var i, ph;
    for (i = 0; i < n; i++) {
      ph = beatPhase ? beatPhase(i, sampleCount) : 0;
      tick(ph);
      left[i] = out1;
      right[i] = out2;
      active[i] = out3;
      pos[i] = dbgPos;
      env[i] = dbgEnv;
      cut[i] = dbgCut;
      sampleCount++;
    }
    return { left: left, right: right, active: active, pos: pos, env: env, cut: cut };
  }

  setBuffer(opts.buffer || null);
  if (src && typeof src.sr === 'number' && src.sr > 0) {
    // sim convenience: `bufsr` starts at the buffer's rate (gen~ default: 44100)
    P.bufsr = max(PARAMS.bufsr.min, min(PARAMS.bufsr.max, src.sr));
  }

  return {
    set: set,
    get: get,
    setBuffer: setBuffer,
    process: process,
    sampleRate: samplerate,
    /** event log (only filled when create({log:true})): {n, type, ...} */
    events: events,
    /** samples processed since creation */
    time: function () { return sampleCount; }
  };
}

module.exports = {
  create: create,
  PARAMS: PARAMS
};
