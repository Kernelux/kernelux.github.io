'use strict';
// SliceKit core/prng.js
// Seeded PRNG (mulberry32) + Fisher-Yates shuffle helpers.
// Pure ES5: no Math.imul (ES2015), so a 32-bit multiply is implemented by hand.

// 32-bit integer multiply (same result as Math.imul).
function imul(a, b) {
  var ah = (a >>> 16) & 0xffff;
  var al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff;
  var bl = b & 0xffff;
  // the high*low cross terms only matter modulo 2^16 (shifted left by 16)
  return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
}

// mulberry32(seed) -> function () { return float in [0, 1) }
// The seed is reduced to an unsigned 32-bit integer (`seed >>> 0`), so
// negative, fractional, NaN and huge seeds are all accepted deterministically.
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = imul(a ^ (a >>> 15), 1 | a);
    t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// randInt(rng, n) -> integer in [0, n). n <= 0 (or NaN) gives 0.
function randInt(rng, n) {
  if (!(n > 0)) return 0;
  var r = Math.floor(rng() * n);
  return r >= n ? n - 1 : (r < 0 ? 0 : r);
}

// shuffleInPlace(array, rng) -> array   (Fisher-Yates, in place, returns the same array)
function shuffleInPlace(array, rng) {
  var i, j, tmp;
  for (i = array.length - 1; i > 0; i--) {
    j = randInt(rng, i + 1);
    tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}

module.exports = {
  mulberry32: mulberry32,
  shuffleInPlace: shuffleInPlace,
  randInt: randInt
};
