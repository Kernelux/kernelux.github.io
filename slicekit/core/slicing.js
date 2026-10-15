'use strict';
// SliceKit core/slicing.js
// Transient / beat / region slicing, zero-crossing snap and waveform overview.
// Pure ES5, no Max globals. Typed arrays only.

var FFT = require('./fft');

// Mirrors Model.CONST (kept local on purpose: slicing must not require model.js).
var BEAT_DIVS = ['1/16', '1/16T', '1/8', '1/8T', '1/4', '1/4T', '1/2', '1/2T', '1 Bar', '2 Bars', '4 Bars'];
var BEAT_DIV_BEATS = [0.25, 1 / 6, 0.5, 1 / 3, 1, 2 / 3, 2, 4 / 3, 4, 8, 16]; // beats per slice

// Hard per-sample slice limit (also the default for settings.maxSlices).
var MAX_SLICES = 128;
var DEFAULT_MAX_SLICES = MAX_SLICES;
var DEFAULT_MIN_SLICE_MS = 30;
// Samples whose absolute peak stays below this (about -66 dBFS) are treated as
// silence by the transient detector (the log-compressed flux is so sensitive
// that dither / noise floor would otherwise produce random onsets).
var SILENCE_PEAK = 5e-4;
// Raw (un-normalised) spectral flux below this (in log-magnitude units summed
// over bins; a -70 dBFS click is about 10) is rounding noise or the phase ripple
// of a stationary tone, not an onset. The normalised ODF is never scaled up
// from it and no onset candidate may be weaker.
var MIN_ODF_PEAK = 10;

// ---------------------------------------------------------------- helpers

function clamp(x, lo, hi) {
  return x < lo ? lo : (x > hi ? hi : x);
}

function numOr(x, fallback) {
  return (typeof x === 'number' && isFinite(x)) ? x : fallback;
}

function numSort(a, b) {
  return a - b;
}

// Sorted ascending, unique, integers (non-finite values are dropped).
function sortedUniqueInts(points) {
  var tmp = [];
  var i;
  for (i = 0; i < points.length; i++) {
    var p = points[i];
    if (typeof p === 'number' && isFinite(p)) tmp.push(Math.round(p));
  }
  tmp.sort(numSort);
  var out = [];
  for (i = 0; i < tmp.length; i++) {
    if (out.length === 0 || tmp[i] !== out[out.length - 1]) out.push(tmp[i]);
  }
  return out;
}

// ---------------------------------------------------------------- toMono

// Average of all channels (the single channel itself, not a copy, when mono).
function toMono(channels) {
  if (!channels || channels.length === 0) return new Float32Array(0);
  var nc = channels.length;
  if (nc === 1) return channels[0];
  var n = channels[0].length;
  var c, i;
  for (c = 1; c < nc; c++) if (channels[c].length < n) n = channels[c].length;
  var out = new Float32Array(n);
  for (c = 0; c < nc; c++) {
    var ch = channels[c];
    for (i = 0; i < n; i++) out[i] += ch[i];
  }
  var inv = 1 / nc;
  for (i = 0; i < n; i++) out[i] *= inv;
  return out;
}

// ---------------------------------------------------------------- onset function

// Spectral-flux onset detection function.
// opts (optional): { frameSize, hop } overrides.
// Returns { odf: Float32Array (normalised to max 1), hop, frameSize, peak }
// where `peak` is the raw (un-normalised) maximum flux. odf[i] describes the
// change from frame i-1 to frame i; frame i covers samples [i*hop, i*hop+frameSize).
// Only complete frames are analysed (a file shorter than one frame yields a
// single zero-padded frame, i.e. odf = [0]).
function onsetFunction(mono, sr, opts) {
  opts = opts || {};
  var big = sr > 60000;
  var N = opts.frameSize > 0 ? opts.frameSize : (big ? 2048 : 1024);
  var hop = opts.hop > 0 ? opts.hop : (big ? 512 : 256);
  var n = mono.length;
  if (n === 0) return { odf: new Float32Array(0), hop: hop, frameSize: N, peak: 0 };

  // only complete frames: a zero-padded last frame would show up as a bogus
  // spectral change at the very end of the file
  var numFrames = n < N ? 1 : Math.floor((n - N) / hop) + 1;
  var odf = new Float32Array(numFrames);
  var win = FFT.hann(N);
  var re = new Float64Array(N);
  var im = new Float64Array(N);
  var bins = (N >> 1) + 1;
  var prev = new Float64Array(bins); // log magnitudes of the previous frame
  var la = new Float64Array(bins);
  var lb = new Float64Array(bins);
  var mask = N - 1;
  var peak = 0;
  var f, i, k, k2, s, avail, flux, d, ar, ai, br, bi, tmp;

  // Two real frames are transformed with one complex FFT: frame f in the real
  // part, frame f+1 in the imaginary part, then split by symmetry.
  for (f = 0; f < numFrames; f += 2) {
    var haveB = f + 1 < numFrames;
    s = f * hop;
    avail = n - s;
    if (avail > N) avail = N;
    for (i = 0; i < avail; i++) re[i] = mono[s + i] * win[i];
    for (; i < N; i++) re[i] = 0;
    if (haveB) {
      s = (f + 1) * hop;
      avail = n - s;
      if (avail > N) avail = N;
      for (i = 0; i < avail; i++) im[i] = mono[s + i] * win[i];
      for (; i < N; i++) im[i] = 0;
    } else {
      for (i = 0; i < N; i++) im[i] = 0;
    }
    FFT.fft(re, im);
    for (k = 0; k < bins; k++) {
      k2 = (N - k) & mask;
      ar = 0.5 * (re[k] + re[k2]);
      ai = 0.5 * (im[k] - im[k2]);
      la[k] = Math.log(1 + 100 * Math.sqrt(ar * ar + ai * ai));
      br = 0.5 * (im[k] + im[k2]);
      bi = 0.5 * (re[k2] - re[k]);
      lb[k] = Math.log(1 + 100 * Math.sqrt(br * br + bi * bi));
    }
    // flux of frame f (odf[0] stays 0: there is no previous frame)
    if (f > 0) {
      flux = 0;
      for (k = 0; k < bins; k++) {
        d = la[k] - prev[k];
        if (d > 0) flux += d;
      }
      odf[f] = flux;
      if (flux > peak) peak = flux;
    }
    if (haveB) {
      flux = 0;
      for (k = 0; k < bins; k++) {
        d = lb[k] - la[k];
        if (d > 0) flux += d;
      }
      odf[f + 1] = flux;
      if (flux > peak) peak = flux;
      tmp = prev; prev = lb; lb = tmp;
    }
  }

  if (peak > 0) {
    var inv = 1 / peak;
    for (f = 0; f < numFrames; f++) odf[f] *= inv;
  }
  return { odf: odf, hop: hop, frameSize: N, peak: peak };
}

// Moving median of `a` over [i-half, i+half] (truncated at the edges).
function movingMedian(a, half) {
  var n = a.length;
  var out = new Float32Array(n);
  var win = new Float64Array(2 * half + 2); // sorted window values
  var cnt = 0;
  var lo = 0;
  var hi = -1;
  var i, v, l, h, mid, j;
  for (i = 0; i < n; i++) {
    var newHi = i + half < n - 1 ? i + half : n - 1;
    var newLo = i - half > 0 ? i - half : 0;
    while (hi < newHi) {
      hi++;
      v = a[hi];
      l = 0; h = cnt;
      while (l < h) { mid = (l + h) >> 1; if (win[mid] < v) l = mid + 1; else h = mid; }
      for (j = cnt; j > l; j--) win[j] = win[j - 1];
      win[l] = v;
      cnt++;
    }
    while (lo < newLo) {
      v = a[lo];
      l = 0; h = cnt;
      while (l < h) { mid = (l + h) >> 1; if (win[mid] < v) l = mid + 1; else h = mid; }
      for (j = l; j < cnt - 1; j++) win[j] = win[j + 1];
      cnt--;
      lo++;
    }
    out[i] = (win[(cnt - 1) >> 1] + win[cnt >> 1]) * 0.5;
  }
  return out;
}

// Sensitivity 0..100 -> peak-picking threshold parameters.
// Both decrease monotonically as sensitivity grows, so the set of accepted
// candidates only ever grows.
function thresholdParams(sensitivity) {
  var t = 1 - clamp(sensitivity, 0, 100) / 100; // 0 = most sensitive
  return {
    factor: 1 + 1.5 * t,          // multiplier on the local median
    delta: 0.01 + 0.29 * t * t    // absolute offset (ODF is normalised to 1)
  };
}

// ---------------------------------------------------------------- onset refinement

// Move an onset estimate back to just before the attack.
//   est       sample position at/after the attack (end of the ODF frame)
//   lowBound  the result will not be below this
// The short amplitude envelope (about 1 ms centred mean of |x|) is searched
// around the estimate for its steepest rise; from there we walk back (at most
// ~10 ms) to the foot of the rise, i.e. the latest point whose envelope is
// within 10% of the rise height above the minimum.
function refineOnset(mono, sr, est, lowBound, hop) {
  var n = mono.length;
  var h = Math.max(1, Math.round(sr * 0.0005)); // half envelope width
  var L = 2 * h;                                // ~1 ms
  var back = Math.round(sr * 0.010);
  var hi = est < n - 1 ? est : n - 1;
  if (hi <= lowBound) return lowBound < n - 1 ? lowBound : n - 1;

  var winLo = est - hop - back;
  if (winLo < lowBound) winLo = lowBound;
  if (winLo > hi) winLo = hi;
  var envLo = winLo - back;
  if (envLo < lowBound) envLo = lowBound;
  var envHi = hi + L;

  // prefix sums of |x| over [base, end)
  var base = envLo - h;
  if (base < 0) base = 0;
  var end = envHi + h + 1;
  if (end > n) end = n;
  var len = end - base;
  var P = new Float64Array(len + 1);
  var i, v;
  for (i = 0; i < len; i++) {
    v = mono[base + i];
    P[i + 1] = P[i] + (v < 0 ? -v : v);
  }
  var count = envHi - envLo + 1;
  var E = new Float64Array(count);
  var a, b;
  for (i = 0; i < count; i++) {
    a = envLo + i - h - base;
    b = envLo + i + h - base;
    if (a < 0) a = 0; else if (a > len) a = len;
    if (b < 0) b = 0; else if (b > len) b = len;
    E[i] = (P[b] - P[a]) / L;
  }

  // steepest rise within [winLo, hi]
  var best = -1;
  var bestD = 0;
  var j, dd;
  for (j = winLo; j <= hi; j++) {
    dd = E[j + L - envLo] - E[j - envLo];
    if (dd >= bestD && dd > 1e-12) { bestD = dd; best = j; }
  }
  if (best < 0) {
    // no amplitude rise (timbral onset): best guess is the middle of the last hop
    var guess = est - (hop >> 1);
    if (guess < lowBound) guess = lowBound;
    return guess < hi ? guess : hi;
  }

  // walk back from the steepest point to the foot of the rise
  var footLo = best - back;
  if (footLo < envLo) footLo = envLo;
  var minE = E[best - envLo];
  for (j = footLo; j <= best; j++) {
    if (E[j - envLo] < minE) minE = E[j - envLo];
  }
  var rise = E[best + L - envLo] - minE;
  var tol = rise > 0 ? 0.1 * rise : 0;
  for (j = best; j > footLo; j--) {
    if (E[j - envLo] <= minE + tol) return j;
  }
  return footLo;
}

// ---------------------------------------------------------------- transients

// Transient detection. Returns sorted unique start frames, first is 0.
// opts: { sensitivity 0..100 (default 50), minSliceMs (default 30), maxSlices (default 128) }
// maxSlices bounds the number of slices (= returned points).
function detectTransients(mono, sr, opts) {
  opts = opts || {};
  var sens = clamp(numOr(opts.sensitivity, 50), 0, 100);
  var minSliceMs = numOr(opts.minSliceMs, DEFAULT_MIN_SLICE_MS);
  if (!(minSliceMs > 0)) minSliceMs = DEFAULT_MIN_SLICE_MS;
  var maxSlices = Math.floor(numOr(opts.maxSlices, DEFAULT_MAX_SLICES));
  if (!(maxSlices >= 1)) maxSlices = DEFAULT_MAX_SLICES;

  var n = mono.length;
  if (n < 2 || !(sr > 0) || maxSlices < 2) return [0];

  var pk = 0;
  var i, a;
  for (i = 0; i < n; i++) {
    a = mono[i];
    if (a < 0) a = -a;
    if (a > pk) pk = a;
  }
  if (pk < SILENCE_PEAK) return [0];

  var o = onsetFunction(mono, sr);
  if (!(o.peak >= MIN_ODF_PEAK)) return [0];
  var odf = o.odf;
  var hop = o.hop;
  var N = o.frameSize;
  var m = odf.length;

  var minFrames = Math.max(1, Math.round(minSliceMs * sr / 1000));
  var w = Math.max(1, Math.ceil(minFrames / hop));            // local-max half window (frames)
  var medHalf = Math.max(2, Math.round(0.1 * sr / hop));      // ~ +-0.1 s
  var med = movingMedian(odf, medHalf);
  var tp = thresholdParams(sens);

  // candidate peaks: above the adaptive threshold and the maximum of their
  // +-w neighbourhood (strict on the left, non-strict on the right so that two
  // candidates are always more than w frames apart).
  var cands = [];
  var j, v, ok, lim;
  for (i = 1; i < m; i++) {
    v = odf[i];
    if (v <= med[i] * tp.factor + tp.delta) continue;
    if (v * o.peak < MIN_ODF_PEAK) continue;
    if (i * hop + N < minFrames) continue;
    ok = true;
    for (j = i - w < 0 ? 0 : i - w; j < i; j++) {
      if (odf[j] >= v) { ok = false; break; }
    }
    if (!ok) continue;
    lim = i + w < m - 1 ? i + w : m - 1;
    for (j = i + 1; j <= lim; j++) {
      if (odf[j] > v) { ok = false; break; }
    }
    if (ok) cands.push({ i: i, v: v });
  }

  // keep the strongest when there are too many
  if (cands.length > maxSlices - 1) {
    cands.sort(function (p, q) { return (q.v - p.v) || (p.i - q.i); });
    cands.length = maxSlices - 1;
  }
  cands.sort(function (p, q) { return p.i - q.i; });

  // refine each onset backwards to just before the attack
  var out = [0];
  var prev = 0;
  var est, lo, r;
  for (i = 0; i < cands.length; i++) {
    est = cands[i].i * hop + N;
    lo = prev + minFrames;
    if (lo > n - 1) break;
    r = refineOnset(mono, sr, est, lo, hop);
    if (r < lo || r > n - 1) continue;
    out.push(r);
    prev = r;
  }
  return out;
}

// ---------------------------------------------------------------- grid slicing

// Grid points for a tempo. beatDiv is a string of BEAT_DIVS (an index is also
// accepted). The grid is anchored at offsetFrames (phase = offset mod spacing)
// and always includes 0.
function beatPoints(frames, sr, opts) {
  opts = opts || {};
  var total = Math.floor(numOr(frames, 0));
  if (!(total > 0)) return [];
  var bpm = numOr(opts.bpm, 0);
  if (!(bpm > 0)) bpm = 120;
  var idx = -1;
  if (typeof opts.beatDiv === 'number') {
    idx = (opts.beatDiv >= 0 && opts.beatDiv < BEAT_DIVS.length) ? Math.floor(opts.beatDiv) : -1;
  } else {
    for (var d = 0; d < BEAT_DIVS.length; d++) {
      if (BEAT_DIVS[d] === opts.beatDiv) { idx = d; break; }
    }
  }
  if (idx < 0) idx = 0;
  var spacing = BEAT_DIV_BEATS[idx] * 60 / bpm * sr;
  if (!(spacing >= 1)) spacing = 1;
  var off = numOr(opts.offsetFrames, 0);
  var phase = off - Math.floor(off / spacing) * spacing;
  var pts = [0];
  for (var k = 0; ; k++) {
    var p = Math.round(phase + k * spacing);
    if (p >= total) break;
    if (p > pts[pts.length - 1]) pts.push(p);
  }
  return pts;
}

// n equal regions: [0, total/n, 2*total/n, ...] (rounded, unique). n is
// clamped to MAX_SLICES.
function regionPoints(frames, n) {
  var total = Math.floor(numOr(frames, 0));
  if (!(total > 0)) return [];
  var regions = Math.floor(numOr(n, 1));
  if (regions < 1) regions = 1;
  if (regions > MAX_SLICES) regions = MAX_SLICES;
  var pts = [0];
  for (var i = 1; i < regions; i++) {
    var p = Math.round(i * total / regions);
    if (p >= total) break;
    if (p > pts[pts.length - 1]) pts.push(p);
  }
  return pts;
}

// ---------------------------------------------------------------- tempo

// Tempo estimate from the autocorrelation of the onset function over the lag
// range of [minBpm, maxBpm] (defaults 70..180). Returns BPM or null when there
// is no clear periodicity.
function estimateBpm(mono, sr, opts) {
  opts = opts || {};
  var minBpm = numOr(opts.minBpm, 70);
  var maxBpm = numOr(opts.maxBpm, 180);
  if (!(minBpm > 0)) minBpm = 70;
  if (!(maxBpm > 0)) maxBpm = 180;
  if (maxBpm < minBpm) { var t = minBpm; minBpm = maxBpm; maxBpm = t; }
  if (!mono || mono.length === 0 || !(sr > 0)) return null;

  var o = onsetFunction(mono, sr);
  if (!(o.peak >= MIN_ODF_PEAK)) return null;
  var odf = o.odf;
  var hop = o.hop;
  var m = odf.length;
  var fps = sr / hop;
  var lagMin = Math.max(2, Math.floor(fps * 60 / maxBpm));
  var lagMax = Math.ceil(fps * 60 / minBpm);
  if (m < 2 * lagMax + 2) return null;

  // light smoothing ([1 2 3 2 1]/9) so that a beat period that is not a whole
  // number of frames still correlates (otherwise short lags are penalised)
  var i, lag;
  var sm = new Float64Array(m);
  for (i = 0; i < m; i++) {
    sm[i] = (3 * odf[i]
      + 2 * ((i > 0 ? odf[i - 1] : 0) + (i + 1 < m ? odf[i + 1] : 0))
      + (i > 1 ? odf[i - 2] : 0) + (i + 2 < m ? odf[i + 2] : 0)) / 9;
  }
  var mean = 0;
  for (i = 0; i < m; i++) mean += sm[i];
  mean /= m;
  var x = new Float64Array(m);
  var e0 = 0;
  for (i = 0; i < m; i++) { x[i] = sm[i] - mean; e0 += x[i] * x[i]; }
  if (!(e0 > 1e-12)) return null;

  // unbiased normalised autocorrelation at one lag (cached)
  var cache = {};
  function acf(lag) {
    var c = cache[lag];
    if (c !== undefined) return c;
    var sum = 0;
    for (var q = 0; q + lag < m; q++) sum += x[q] * x[q + lag];
    c = (sum / e0) * (m / (m - lag));
    cache[lag] = c;
    return c;
  }

  // Candidate lags = local maxima of the autocorrelation inside the range.
  // They are ranked by a harmonic-enhanced score r(l) + 0.5 r(2l) + 0.25 r(4l)
  // (multiples only while the overlap is long enough), which prefers the beat
  // period over a sub-beat period that happens to be in range, and weighted by a
  // tempo prior.
  var bestLag = -1;
  var bestScore = 0;
  var bestVal = 0;
  var sumAbs = 0;
  var rl, score, wsum, mult, wgt, lagM;
  for (lag = lagMin; lag <= lagMax; lag++) {
    rl = acf(lag);
    sumAbs += Math.abs(rl);
    if (rl > acf(lag - 1) && rl >= acf(lag + 1) && rl > 0) {
      score = rl;
      wsum = 1;
      for (mult = 2; mult <= 4; mult *= 2) {
        lagM = lag * mult;
        wgt = mult === 2 ? 0.5 : 0.25;
        if (lagM < m / 2) { score += wgt * acf(lagM); wsum += wgt; }
      }
      score /= wsum;
      // mild log-Gaussian tempo prior (centre 120 BPM, sigma 1 octave): breaks the
      // tie between a period and its multiples in perfectly regular material
      lagM = Math.log(60 * fps / lag / 120) / Math.LN2;
      score *= Math.exp(-0.5 * lagM * lagM);
      if (score > bestScore) {
        bestScore = score;
        bestVal = rl;
        bestLag = lag;
      }
    }
  }
  if (bestLag < 0) return null;
  var meanAbs = sumAbs / (lagMax - lagMin + 1);
  if (bestVal < 0.1 || bestVal < 2 * meanAbs) return null;

  // parabolic interpolation for sub-frame precision
  var ra = acf(bestLag - 1);
  var rb = acf(bestLag);
  var rc = acf(bestLag + 1);
  var denom = ra - 2 * rb + rc;
  var lagF = bestLag;
  if (denom < 0) {
    var delta = 0.5 * (ra - rc) / denom;
    if (delta > -1 && delta < 1) lagF = bestLag + delta;
  }
  var bpm = 60 * fps / lagF;
  return Math.round(bpm * 100) / 100;
}

// ---------------------------------------------------------------- snapping & ranges

function isZeroCross(x, j) {
  var cur = x[j];
  if (cur === 0) return true;
  var prev = x[j - 1];
  return (prev < 0 && cur > 0) || (prev > 0 && cur < 0);
}

// Move every point (except 0) to the nearest sign change within
// maxSearchFrames (earlier side wins ties); points without one stay.
// Returns sorted unique ints.
function snapToZeroCrossings(mono, points, maxSearchFrames) {
  var n = mono.length;
  var maxS = Math.max(0, Math.floor(numOr(maxSearchFrames, 0)));
  var src = sortedUniqueInts(points);
  var out = [];
  for (var i = 0; i < src.length; i++) {
    var p = src[i];
    var best = p;
    if (p > 0 && p < n) {
      for (var d = 0; d <= maxS; d++) {
        var lo = p - d;
        if (lo >= 1 && isZeroCross(mono, lo)) { best = lo; break; }
        var hi = p + d;
        if (d > 0 && hi <= n - 1 && isZeroCross(mono, hi)) { best = hi; break; }
        if (lo < 1 && hi > n - 1) break;
      }
    }
    out.push(best);
  }
  return sortedUniqueInts(out);
}

// Sorted unique points -> contiguous ranges covering [0, totalFrames).
// A point closer than minFrames to the previous kept point is dropped; a
// too-short last range is merged into the previous one.
function pointsToRanges(points, totalFrames, minFrames) {
  var total = Math.floor(numOr(totalFrames, 0));
  if (!(total > 0)) return [];
  var minF = Math.round(numOr(minFrames, 1));
  if (minF < 1) minF = 1;
  var src = sortedUniqueInts(points || []);
  var kept = [0];
  var i, p;
  for (i = 0; i < src.length; i++) {
    p = src[i];
    if (p <= 0 || p >= total) continue;
    if (p - kept[kept.length - 1] >= minF) kept.push(p);
  }
  while (kept.length > 1 && total - kept[kept.length - 1] < minF) kept.pop();
  var ranges = [];
  for (i = 0; i < kept.length; i++) {
    ranges.push({ start: kept[i], end: i + 1 < kept.length ? kept[i + 1] : total });
  }
  return ranges;
}

// ---------------------------------------------------------------- pipeline

// Full pipeline for one source. `settings` = Source.slicing.
// Returns contiguous [{start, end}] covering [0, frames) ([] when frames is 0),
// at most `settings.maxSlices || 128` ranges in every mode.
function sliceSource(mono, sr, settings) {
  var s = settings || {};
  var frames = mono.length;
  if (frames <= 0) return [];
  var mode = s.mode || 'transient';
  if (mode === 'manual') return [{ start: 0, end: frames }];

  var minSliceMs = numOr(s.minSliceMs, DEFAULT_MIN_SLICE_MS);
  if (!(minSliceMs > 0)) minSliceMs = DEFAULT_MIN_SLICE_MS;
  var minFrames = Math.max(1, Math.round(minSliceMs * sr / 1000));

  var pts;
  if (mode === 'beat') {
    var bpm = numOr(s.bpm, 0);
    if (!(bpm > 0)) bpm = estimateBpm(mono, sr, null) || 120;
    pts = beatPoints(frames, sr, { bpm: bpm, beatDiv: s.beatDiv, offsetFrames: s.offsetFrames });
  } else if (mode === 'region') {
    pts = regionPoints(frames, s.regions > 0 ? s.regions : 16);
  } else {
    pts = detectTransients(mono, sr, {
      sensitivity: s.sensitivity,
      minSliceMs: minSliceMs,
      maxSlices: s.maxSlices
    });
  }
  if (s.snap) {
    pts = snapToZeroCrossings(mono, pts, Math.max(1, Math.round(0.002 * sr)));
  }
  var ranges = pointsToRanges(pts, frames, minFrames);

  // cap every mode (after snapping and min-length filtering) at maxSlices
  // ranges: keep the first maxSlices-1 cut points after 0, the last range
  // runs to the end of the file
  var cap = Math.floor(numOr(s.maxSlices, 0));
  if (!(cap >= 1)) cap = MAX_SLICES;
  if (ranges.length > cap) {
    ranges.length = cap;
    ranges[cap - 1].end = frames;
  }
  return ranges;
}

// ---------------------------------------------------------------- overview

// Waveform overview: Float32Array(2*columns) = [min0, max0, min1, max1, ...].
function overview(mono, columns) {
  var cols = Math.floor(numOr(columns, 1));
  if (cols < 1) cols = 1;
  var out = new Float32Array(2 * cols);
  var n = mono.length;
  if (n === 0) return out;
  for (var c = 0; c < cols; c++) {
    var a = Math.floor(c * n / cols);
    var b = Math.floor((c + 1) * n / cols);
    if (a > n - 1) a = n - 1;
    if (b <= a) b = a + 1;
    if (b > n) b = n;
    var mn = mono[a];
    var mx = mn;
    for (var i = a + 1; i < b; i++) {
      var v = mono[i];
      if (v < mn) mn = v;
      else if (v > mx) mx = v;
    }
    out[2 * c] = mn;
    out[2 * c + 1] = mx;
  }
  return out;
}

module.exports = {
  MAX_SLICES: MAX_SLICES,
  BEAT_DIVS: BEAT_DIVS,
  BEAT_DIV_BEATS: BEAT_DIV_BEATS,
  toMono: toMono,
  onsetFunction: onsetFunction,
  detectTransients: detectTransients,
  beatPoints: beatPoints,
  regionPoints: regionPoints,
  estimateBpm: estimateBpm,
  snapToZeroCrossings: snapToZeroCrossings,
  pointsToRanges: pointsToRanges,
  sliceSource: sliceSource,
  overview: overview
};
