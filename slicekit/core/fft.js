'use strict';
// SliceKit core/fft.js
// Iterative in-place radix-2 complex FFT, Hann window and magnitude spectrum.
// Pure ES5, no Max globals. Bit-reversal tables and twiddle factors are cached
// per transform size, as are the scratch buffers used by magnitudeSpectrum.

var plans = {};      // size -> { rev, cos, sin }
var scratches = {};  // size -> { re, im }

function isPow2(n) {
  return n >= 1 && (n & (n - 1)) === 0;
}

function getPlan(n) {
  var plan = plans[n];
  if (plan) return plan;
  var bits = 0;
  while ((1 << bits) < n) bits++;
  var rev = new Int32Array(n);
  var i, b, r, x;
  for (i = 0; i < n; i++) {
    r = 0;
    x = i;
    for (b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = r;
  }
  var half = n >> 1;
  var cos = new Float64Array(half > 0 ? half : 1);
  var sin = new Float64Array(half > 0 ? half : 1);
  for (i = 0; i < half; i++) {
    var a = -2 * Math.PI * i / n; // forward transform: e^{-j 2 pi i / n}
    cos[i] = Math.cos(a);
    sin[i] = Math.sin(a);
  }
  plan = { rev: rev, cos: cos, sin: sin };
  plans[n] = plan;
  return plan;
}

// In-place forward complex FFT (X[k] = sum x[n] e^{-j 2 pi k n / N}).
// re, im: Float64Array or Float32Array of the same power-of-two length.
function fft(re, im) {
  var n = re.length;
  if (im.length !== n) throw new Error('fft: re and im must have the same length');
  if (!isPow2(n)) throw new Error('fft: length must be a power of 2');
  if (n < 2) return;
  var plan = getPlan(n);
  var rev = plan.rev;
  var cs = plan.cos;
  var sn = plan.sin;
  var i, j, t;

  for (i = 0; i < n; i++) {
    j = rev[i];
    if (j > i) {
      t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  var size, half, step, start, k, tw, a, b, wr, wi, xr, xi;
  for (size = 2; size <= n; size <<= 1) {
    half = size >> 1;
    step = n / size;
    for (start = 0; start < n; start += size) {
      tw = 0;
      for (k = 0; k < half; k++) {
        a = start + k;
        b = a + half;
        wr = cs[tw];
        wi = sn[tw];
        xr = re[b] * wr - im[b] * wi;
        xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        tw += step;
      }
    }
  }
}

// Periodic Hann window (DFT-even): w[i] = 0.5 - 0.5 cos(2 pi i / N).
// w[0] = 0, w[N/2] = 1, sum = N/2.
function hann(N) {
  var w = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  }
  return w;
}

function getScratch(n) {
  var s = scratches[n];
  if (!s) {
    s = { re: new Float64Array(n), im: new Float64Array(n) };
    scratches[n] = s;
  }
  return s;
}

// Magnitude spectrum of a real frame (length N, power of 2).
// window: Float32Array of length N, or null/undefined for none (rectangular).
// out (optional): Float32Array of length >= N/2+1 to write into (avoids an
// allocation). Returns Float32Array(N/2+1) (or `out`). `frame` is not modified.
function magnitudeSpectrum(frame, window, out) {
  var n = frame.length;
  if (n < 2 || !isPow2(n)) throw new Error('magnitudeSpectrum: frame length must be a power of 2 >= 2');
  if (window && window.length !== n) throw new Error('magnitudeSpectrum: window length must equal frame length');
  var s = getScratch(n);
  var re = s.re;
  var im = s.im;
  var i;
  if (window) {
    for (i = 0; i < n; i++) { re[i] = frame[i] * window[i]; im[i] = 0; }
  } else {
    for (i = 0; i < n; i++) { re[i] = frame[i]; im[i] = 0; }
  }
  fft(re, im);
  var bins = (n >> 1) + 1;
  var mag = (out && out.length >= bins) ? out : new Float32Array(bins);
  for (i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

module.exports = {
  fft: fft,
  hann: hann,
  magnitudeSpectrum: magnitudeSpectrum
};
