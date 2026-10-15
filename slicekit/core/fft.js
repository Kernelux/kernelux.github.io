'use strict';
// SliceKit core/fft.js
// Iterative in-place radix-2 complex FFT, Hann window and magnitude spectrum.
// Pure ES5, no Max globals. Bit-reversal tables and twiddle factors are cached
// per transform size, as are the scratch buffers used by magnitudeSpectrum.

var plans = {};      // size -> { rev, twr, twi }
var scratches = {};  // size -> { re, im }

function isPow2(n) {
  return n >= 1 && (n & (n - 1)) === 0;
}

// Per-size tables: bit-reversal permutation and twiddle factors stored
// contiguously per stage (for a butterfly half-size h the h factors
// e^{-j pi k / h}, k < h, live at [h + k]).
function getPlan(n) {
  var plan = plans[n];
  if (plan) return plan;
  var bits = 0;
  while ((1 << bits) < n) bits++;
  var rev = new Int32Array(n);
  var i, b, r, x, h, k, a;
  for (i = 0; i < n; i++) {
    r = 0;
    x = i;
    for (b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = r;
  }
  var twr = new Float64Array(n);
  var twi = new Float64Array(n);
  for (h = 1; h < n; h <<= 1) {
    for (k = 0; k < h; k++) {
      a = -Math.PI * k / h; // forward transform: e^{-j pi k / h}
      twr[h + k] = Math.cos(a);
      twi[h + k] = Math.sin(a);
    }
  }
  plan = { rev: rev, twr: twr, twi: twi };
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
  var twr = plan.twr;
  var twi = plan.twi;
  var i, j, t;

  for (i = 0; i < n; i++) {
    j = rev[i];
    if (j > i) {
      t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  if (n === 2) {
    var r0 = re[0], i0 = im[0];
    re[0] = r0 + re[1]; im[0] = i0 + im[1];
    re[1] = r0 - re[1]; im[1] = i0 - im[1];
    return;
  }

  // stages of size 2 and 4 fused (their twiddles are 1 and -j: no multiplies)
  var s, ar, ai, br, bi, cr, ci, dr, di, t0r, t0i, t1r, t1i, t2r, t2i, t3r, t3i;
  for (s = 0; s < n; s += 4) {
    ar = re[s]; ai = im[s];
    br = re[s + 1]; bi = im[s + 1];
    cr = re[s + 2]; ci = im[s + 2];
    dr = re[s + 3]; di = im[s + 3];
    t0r = ar + br; t0i = ai + bi;
    t1r = ar - br; t1i = ai - bi;
    t2r = cr + dr; t2i = ci + di;
    t3r = cr - dr; t3i = ci - di;
    re[s] = t0r + t2r; im[s] = t0i + t2i;
    re[s + 2] = t0r - t2r; im[s + 2] = t0i - t2i;
    re[s + 1] = t1r + t3i; im[s + 1] = t1i - t3r;
    re[s + 3] = t1r - t3i; im[s + 3] = t1i + t3r;
  }

  var half, size, start, k, a, b, wr, wi, xr, xi;
  for (half = 4; half < n; half <<= 1) {
    size = half << 1;
    for (start = 0; start < n; start += size) {
      for (k = 0; k < half; k++) {
        a = start + k;
        b = a + half;
        wr = twr[half + k];
        wi = twi[half + k];
        br = re[b]; bi = im[b];
        xr = br * wr - bi * wi;
        xi = br * wi + bi * wr;
        ar = re[a]; ai = im[a];
        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
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
