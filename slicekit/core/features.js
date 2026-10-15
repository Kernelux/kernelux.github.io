'use strict';
// SliceKit core/features.js
// Per-slice descriptors, similarity ranking, k-means clustering and "find best".
// Pure ES5, no Max globals.

var FFT = require('./fft');

var FLOOR_DB = -120;
var CENTROID_FRAME = 2048;
var CENTROID_MAX_FRAMES = 8;
var STD_FLOOR = 1e-6;

var hannFull = null;

function clamp(x, lo, hi) {
  return x < lo ? lo : (x > hi ? hi : x);
}

function numOr(x, fallback) {
  return (typeof x === 'number' && isFinite(x)) ? x : fallback;
}

function toDb(amp) {
  if (!(amp > 1e-6)) return FLOOR_DB;
  var db = 20 * Math.log(amp) / Math.LN10;
  return db < FLOOR_DB ? FLOOR_DB : db;
}

// ---------------------------------------------------------------- descriptors

// Magnitude-weighted spectral centroid (Hz), averaged over up to 8 frames of
// 2048 samples spread evenly over the slice. Slices shorter than 2048 use one
// zero-padded frame (the Hann window spans the actual content). DC is removed
// per frame.
function spectralCentroid(mono, sr, s, len) {
  var F = CENTROID_FRAME;
  if (!hannFull) hannFull = FFT.hann(F);
  var count = len <= F ? 1 : Math.min(CENTROID_MAX_FRAMES, Math.ceil(len / F));
  var re = new Float64Array(F);
  var im = new Float64Array(F);
  var bins = (F >> 1) + 1;
  var sum = 0;
  var used = 0;
  var f, i, k, pos, avail, mean, win, num, den, mag, x;
  for (f = 0; f < count; f++) {
    pos = count === 1 ? s : s + Math.round(f * (len - F) / (count - 1));
    avail = Math.min(F, s + len - pos);
    if (avail < 1) continue;
    mean = 0;
    for (i = 0; i < avail; i++) mean += mono[pos + i];
    mean /= avail;
    win = avail === F ? hannFull : null;
    for (i = 0; i < avail; i++) {
      x = mono[pos + i] - mean;
      if (win) x *= win[i];
      else x *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / avail);
      re[i] = x;
      im[i] = 0;
    }
    for (; i < F; i++) { re[i] = 0; im[i] = 0; }
    FFT.fft(re, im);
    num = 0;
    den = 0;
    for (k = 0; k < bins; k++) {
      mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      num += k * mag;
      den += mag;
    }
    if (den > 1e-9) {
      sum += (num / den) * sr / F;
      used++;
    }
  }
  return used > 0 ? sum / used : 0;
}

// Features of mono[start, end): { durMs, peakDb, rmsDb, attackMs, centroidHz, zcr }
function sliceFeatures(mono, sr, start, end) {
  var n = mono.length;
  var s = clamp(Math.floor(numOr(start, 0)), 0, n);
  var e = clamp(Math.floor(numOr(end, n)), s, n);
  var len = e - s;
  if (len <= 0 || !(sr > 0)) {
    return { durMs: 0, peakDb: FLOOR_DB, rmsDb: FLOOR_DB, attackMs: 0, centroidHz: 0, zcr: 0 };
  }

  var L = Math.max(1, Math.round(sr * 0.001)); // ~1 ms envelope window
  var peak = 0;
  var sumSq = 0;
  var cross = 0;
  var acc = 0;
  var envMax = 0;
  var i, v, a, prev, old;

  prev = mono[s];
  for (i = 0; i < len; i++) {
    v = mono[s + i];
    a = v < 0 ? -v : v;
    if (a > peak) peak = a;
    sumSq += v * v;
    if (i > 0 && ((prev >= 0) !== (v >= 0))) cross++;
    prev = v;
    acc += a;
    if (i >= L) {
      old = mono[s + i - L];
      acc -= (old < 0 ? -old : old);
    }
    if (acc > envMax) envMax = acc;
  }

  // attack: first point where the smoothed envelope reaches 98% of its maximum
  // (robust against a flat-topped envelope), reported at the window centre.
  var attackIdx = 0;
  var thr = envMax * 0.98;
  acc = 0;
  for (i = 0; i < len; i++) {
    v = mono[s + i];
    acc += (v < 0 ? -v : v);
    if (i >= L) {
      old = mono[s + i - L];
      acc -= (old < 0 ? -old : old);
    }
    if (acc >= thr) { attackIdx = i; break; }
  }
  var attackSamples = attackIdx - (L - 1) / 2;
  if (attackSamples < 0) attackSamples = 0;

  return {
    durMs: len * 1000 / sr,
    peakDb: toDb(peak),
    rmsDb: toDb(Math.sqrt(sumSq / len)),
    attackMs: attackSamples * 1000 / sr,
    centroidHz: spectralCentroid(mono, sr, s, len),
    zcr: cross / len
  };
}

// Features for every range ([{start, end}]).
function computeAll(mono, sr, ranges) {
  var out = [];
  for (var i = 0; i < ranges.length; i++) {
    out.push(sliceFeatures(mono, sr, ranges[i].start, ranges[i].end));
  }
  return out;
}

// ---------------------------------------------------------------- normalisation

function safe(x) {
  return (typeof x === 'number' && isFinite(x)) ? x : 0;
}

function featureVector(f) {
  return [
    Math.log(1 + Math.max(0, safe(f.durMs))),
    safe(f.rmsDb),
    Math.log(1 + Math.max(0, safe(f.attackMs))),
    Math.log(1 + Math.max(0, safe(f.centroidHz))),
    safe(f.zcr)
  ];
}

// z-score of values[i] for i where valid[i]; invalid entries get 0.
function zscores(values, valid) {
  var n = values.length;
  var out = new Array(n);
  var cnt = 0;
  var mean = 0;
  var i;
  for (i = 0; i < n; i++) {
    if (valid[i]) { mean += values[i]; cnt++; }
  }
  if (cnt === 0) {
    for (i = 0; i < n; i++) out[i] = 0;
    return out;
  }
  mean /= cnt;
  var varSum = 0;
  for (i = 0; i < n; i++) {
    if (valid[i]) varSum += (values[i] - mean) * (values[i] - mean);
  }
  var std = Math.sqrt(varSum / cnt);
  if (std < STD_FLOOR) std = STD_FLOOR;
  for (i = 0; i < n; i++) out[i] = valid[i] ? (values[i] - mean) / std : 0;
  return out;
}

// Z-scored feature vectors, one per entry, dims:
//   [log(1+durMs), rmsDb, log(1+attackMs), log(1+centroidHz), zcr]
// Each dimension is z-scored across the list (std floor 1e-6). Entries without
// features (null/undefined) do not take part in the statistics and get zeros.
function normalize(featuresList) {
  var n = featuresList.length;
  var valid = new Array(n);
  var vecs = new Array(n);
  var i, d;
  for (i = 0; i < n; i++) {
    valid[i] = !!featuresList[i];
    vecs[i] = valid[i] ? featureVector(featuresList[i]) : [0, 0, 0, 0, 0];
  }
  var DIMS = 5;
  var out = new Array(n);
  for (i = 0; i < n; i++) out[i] = new Array(DIMS);
  var col = new Array(n);
  var z;
  for (d = 0; d < DIMS; d++) {
    for (i = 0; i < n; i++) col[i] = vecs[i][d];
    z = zscores(col, valid);
    for (i = 0; i < n; i++) out[i][d] = z[i];
  }
  return out;
}

// Euclidean distance between two (normalised) vectors.
function distance(a, b) {
  var len = Math.min(a.length, b.length);
  var s = 0;
  for (var i = 0; i < len; i++) {
    var d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Indices sorted by distance to the target (target first). Entries without
// features come last (in index order).
function rankSimilar(targetIndex, featuresList) {
  var n = featuresList.length;
  if (!(targetIndex >= 0 && targetIndex < n)) return [];
  var vecs = normalize(featuresList);
  var items = [];
  var rest = [];
  var i, dist;
  for (i = 0; i < n; i++) {
    if (i === targetIndex) continue;
    if (!featuresList[i] || !featuresList[targetIndex]) {
      rest.push(i);
      continue;
    }
    dist = distance(vecs[targetIndex], vecs[i]);
    items.push({ i: i, d: dist });
  }
  items.sort(function (p, q) { return (p.d - q.d) || (p.i - q.i); });
  var out = [targetIndex];
  for (i = 0; i < items.length; i++) out.push(items[i].i);
  for (i = 0; i < rest.length; i++) out.push(rest[i]);
  return out;
}

// ---------------------------------------------------------------- k-means

function sqDist(a, b) {
  var s = 0;
  var len = a.length < b.length ? a.length : b.length;
  for (var i = 0; i < len; i++) {
    var d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

// k-means with k-means++ initialisation. Returns labels (0..k-1) per vector.
// Deterministic for a given `rng` (function -> [0,1)).
function kmeans(vectors, k, rng) {
  var n = vectors.length;
  var labels = [];
  var i, c, it;
  if (n === 0) return labels;
  k = Math.floor(numOr(k, 1));
  if (k < 1) k = 1;
  if (k >= n) {
    for (i = 0; i < n; i++) labels.push(i);
    return labels;
  }
  var dim = vectors[0].length;
  var rand = typeof rng === 'function' ? rng : function () { return 0.5; };

  // --- k-means++ initialisation
  var chosen = new Array(n);
  for (i = 0; i < n; i++) chosen[i] = false;
  var centers = [];
  var d2 = new Float64Array(n);
  var first = Math.floor(rand() * n);
  if (first < 0) first = 0;
  if (first > n - 1) first = n - 1;
  chosen[first] = true;
  centers.push(Array.prototype.slice.call(vectors[first]));
  for (i = 0; i < n; i++) d2[i] = sqDist(vectors[i], centers[0]);
  var total, r, acc, pick, last;
  for (c = 1; c < k; c++) {
    total = 0;
    for (i = 0; i < n; i++) total += d2[i];
    pick = -1;
    if (total > 0) {
      r = rand() * total;
      acc = 0;
      last = -1;
      for (i = 0; i < n; i++) {
        if (d2[i] > 0 && !chosen[i]) {
          last = i;
          acc += d2[i];
          if (acc > r) { pick = i; break; }
        }
      }
      if (pick < 0) pick = last;
    }
    if (pick < 0) {
      // all remaining points coincide with a centre: take the first unchosen
      for (i = 0; i < n; i++) if (!chosen[i]) { pick = i; break; }
    }
    chosen[pick] = true;
    centers.push(Array.prototype.slice.call(vectors[pick]));
    for (i = 0; i < n; i++) {
      var dd = sqDist(vectors[i], centers[c]);
      if (dd < d2[i]) d2[i] = dd;
    }
  }

  // --- Lloyd iterations
  for (i = 0; i < n; i++) labels.push(-1);
  var counts = new Array(k);
  var dist = new Float64Array(n); // squared distance of each point to its centre
  var j, d, best, bestD, changed, far, farD;
  for (it = 0; it < 25; it++) {
    changed = false;
    for (c = 0; c < k; c++) counts[c] = 0;
    for (i = 0; i < n; i++) {
      best = 0;
      bestD = sqDist(vectors[i], centers[0]);
      for (c = 1; c < k; c++) {
        d = sqDist(vectors[i], centers[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
      dist[i] = bestD;
      counts[best]++;
    }
    // empty clusters take the point farthest from its centre (from a cluster with > 1 members)
    for (c = 0; c < k; c++) {
      if (counts[c] > 0) continue;
      far = -1;
      farD = -1;
      for (i = 0; i < n; i++) {
        if (counts[labels[i]] > 1 && dist[i] > farD) { farD = dist[i]; far = i; }
      }
      if (far < 0) break;
      counts[labels[far]]--;
      labels[far] = c;
      counts[c] = 1;
      dist[far] = 0;
      changed = true;
    }
    if (!changed && it > 0) break;
    // recompute centres
    for (c = 0; c < k; c++) {
      var cen = centers[c];
      for (j = 0; j < dim; j++) cen[j] = 0;
    }
    for (i = 0; i < n; i++) {
      var cc = centers[labels[i]];
      var v = vectors[i];
      for (j = 0; j < dim; j++) cc[j] += v[j];
    }
    for (c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (j = 0; j < dim; j++) centers[c][j] /= counts[c];
      }
    }
  }
  return labels;
}

// ---------------------------------------------------------------- find best

// Pick n strong ("punchy": loud, high peak, fast attack) and diverse slices.
// score = z(rmsDb) + z(peakDb) - 0.5 * z(log(1+attackMs)); the first pick is
// the best score, then greedily the index maximising
//   (1 - d) * scoreNorm + d * minDistToChosenNorm       (d = diversity)
// Entries without features are never picked. Returns min(n, #with features)
// distinct indices.
function findBest(featuresList, n, opts) {
  var diversity = clamp(numOr(opts && opts.diversity, 0.5), 0, 1);
  var len = featuresList.length;
  var want = Math.floor(numOr(n, 0));
  var valid = new Array(len);
  var nValid = 0;
  var i;
  for (i = 0; i < len; i++) {
    valid[i] = !!featuresList[i];
    if (valid[i]) nValid++;
  }
  if (want <= 0 || nValid === 0) return [];
  if (want > nValid) want = nValid;

  var vecs = normalize(featuresList);
  var peaks = new Array(len);
  for (i = 0; i < len; i++) peaks[i] = valid[i] ? safe(featuresList[i].peakDb) : 0;
  var zPeak = zscores(peaks, valid);

  var score = new Array(len);
  var sMin = Infinity;
  var sMax = -Infinity;
  for (i = 0; i < len; i++) {
    if (!valid[i]) { score[i] = 0; continue; }
    score[i] = vecs[i][1] + zPeak[i] - 0.5 * vecs[i][2];
    if (score[i] < sMin) sMin = score[i];
    if (score[i] > sMax) sMax = score[i];
  }
  var span = sMax - sMin;
  var scoreNorm = new Array(len);
  for (i = 0; i < len; i++) {
    scoreNorm[i] = (valid[i] && span > 1e-12) ? (score[i] - sMin) / span : 0;
  }

  var chosen = [];
  var taken = new Array(len);
  var minDist = new Array(len);
  for (i = 0; i < len; i++) { taken[i] = false; minDist[i] = Infinity; }

  // first pick: best score (lowest index on ties)
  var pick = -1;
  for (i = 0; i < len; i++) {
    if (valid[i] && (pick < 0 || score[i] > score[pick])) pick = i;
  }

  var maxMd, val, bestVal, md, dd;
  while (true) {
    chosen.push(pick);
    taken[pick] = true;
    if (chosen.length >= want) break;
    for (i = 0; i < len; i++) {
      if (valid[i] && !taken[i]) {
        dd = distance(vecs[i], vecs[pick]);
        if (dd < minDist[i]) minDist[i] = dd;
      }
    }
    maxMd = 0;
    for (i = 0; i < len; i++) {
      if (valid[i] && !taken[i] && minDist[i] > maxMd) maxMd = minDist[i];
    }
    pick = -1;
    bestVal = -Infinity;
    for (i = 0; i < len; i++) {
      if (!valid[i] || taken[i]) continue;
      md = maxMd > 0 ? minDist[i] / maxMd : 0;
      val = (1 - diversity) * scoreNorm[i] + diversity * md;
      if (val > bestVal) { bestVal = val; pick = i; }
    }
    if (pick < 0) break;
  }
  return chosen;
}

module.exports = {
  sliceFeatures: sliceFeatures,
  computeAll: computeAll,
  normalize: normalize,
  distance: distance,
  rankSimilar: rankSimilar,
  kmeans: kmeans,
  findBest: findBest
};
