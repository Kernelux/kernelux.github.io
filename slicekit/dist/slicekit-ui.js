/*
 * SliceKit - jsui view (mgraphics).  ES5 only (Max legacy js / v8 engine).
 *
 * Copied to dist/slicekit-ui.js by tools/build.js and loaded by a [jsui].
 * The glue writes a "view dict" (see docs/PROTOCOL.md) and tells us about it:
 *
 *     viewdict <name>   remember the dict name, then refresh
 *     refresh | bang    re-read the dict and redraw
 *
 * Everything the user does is sent out of outlet 0 as `<action> ...`; the patch
 * puts [prepend ui] after the jsui:
 *
 *     selectsource <index>   selectkey <key>   audition <key> <vel>
 *     auditionoff <key>      selectslice <i>   addslice <frame>
 *     moveslice <i> <frame>  removeslice <i>   lock <key>
 *     swap <fromKey> <toKey>   (drag a key onto another key)
 *
 * Besides the fields documented in PROTOCOL.md the view may carry
 *     selectedFrames   frame count of the selected source (needed to turn a
 *                      normalized waveform position into addslice/moveslice
 *                      frames; without it those two actions are disabled)
 *     modStart         first key of the 16-key modifier zone (otherwise it is
 *                      derived from the lowest key with the "mod zone" flag)
 *
 * v2 fields (all optional; a v1 view renders exactly as before):
 *     morph            0..100, shown as "MORPH nn%" in the status line when > 0
 *     morphEdit        0/1, shows the "EDIT B" badge
 *     scan             0..100, shown as "SCAN nn%" when > 0
 *     gesture          index 0..3 of the active gesture or -1; highlights the
 *                      matching G1..G4 key of the mod zone
 *     gestureNames     4 strings; the active gesture's name goes in the status line
 *     keyFlags bit 64  the pad has morph B values (small diamond on the key)
 *
 * Layout (default 600x160, any size >= 80 px high works):
 *     source tabs   18 px   one chip per source
 *     waveform      ~58 %   of the remaining height
 *     keyboard      ~42 %   48 keys (4 octaves) with < > buttons
 *     status line   14 px   [EDIT B] [MORPH] [SCAN] [gesture] status ...  key  SLOT x
 *
 * The file is organised as: Max wiring, constants, pure helpers (layout, key
 * geometry, hit testing), state + event handlers, painting, exports for the
 * node tests.
 */

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
inlets = 1;
outlets = 1;

var host = this;

/* ------------------------------------------------------------------ constants */

var DEFAULT_W = 600;
var DEFAULT_H = 160;
var MIN_W = 80;
var MIN_H = 80;

var PAD_X = 2;
var PAD_Y = 1;
var GAP = 2;
var TABS_H = 18;
var STATUS_H = 14;
var ARROW_W = 14;
var ARROW_GAP = 2;
var MIN_WAVE_H = 16;
var MIN_KEYS_H = 24;
var KEYS_SHARE = 0.42;

var NUM_KEYS = 128;
var WIN_KEYS = 48;
var WIN_WHITES = 28;
var MAX_WIN_START = NUM_KEYS - WIN_KEYS;
var BLACK_H_SHARE = 0.62;
var BLACK_W_SHARE = 0.6;

var MARKER_TOL = 4;
var DRAG_THRESHOLD = 3;
var AUDITION_VEL = 100;
var SWAP_THRESHOLD = 4;       /* px a key press must travel before it becomes a swap drag */
var HOVER_MS = 450;           /* dwell on a < > arrow while swap-dragging before the window scrolls */

var FLAG_LOCK = 1;
var FLAG_REV = 2;
var FLAG_LAYERS = 4;
var FLAG_MOD = 8;
var FLAG_SOUNDING = 16;
var FLAG_COPY = 32;
var FLAG_MORPHB = 64;

var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var IS_BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
var WHITES_BELOW = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
/* labels for the 16 mod zone keys: 12 modifier actions in Model.CONST.MOD_ACTIONS
 * order, then the four gesture keys */
var MOD_LABELS = ['4', '8', '8T', '16', '16T', '32', '64', 'Rv', 'O-', 'O+', 'Tp', 'Ch',
    'G1', 'G2', 'G3', 'G4'];
var GESTURE_COUNT = 4;
var GESTURE_OFFSET = 12;      /* mod zone offset of the first gesture key (G1) */
var STATUS_MIN_TEXT = 48;     /* px kept for the status text before optional indicators are dropped */
var SLOT_LETTERS = 'ABCDEFGH';

var DEFAULT_PALETTE = ['#FF5A5A', '#FFA54A', '#FFD84A', '#9BE35A',
    '#3FCF8E', '#3FD1D1', '#4AA8FF', '#7A7CFF',
    '#B57CFF', '#FF7CE0', '#FF8C8C', '#C9A27A',
    '#A0A0A0', '#6FD0FF', '#E0FF7C', '#FFB3D1'];

var COL = {
    bg: [0.118, 0.118, 0.118],
    panel: [0.082, 0.082, 0.082],
    chip: [0.165, 0.165, 0.165],
    chipSel: [0.235, 0.235, 0.235],
    border: [0.27, 0.27, 0.27],
    text: [0.82, 0.82, 0.82],
    dim: [0.46, 0.46, 0.46],
    white: [1, 1, 1],
    black: [0, 0, 0],
    amber: [1, 0.78, 0.25],
    keyEmptyW: [0.235, 0.235, 0.235],
    keyEmptyB: [0.14, 0.14, 0.14],
    keyLine: [0.06, 0.06, 0.06],
    modW: [0.23, 0.19, 0.31],
    modB: [0.16, 0.13, 0.23],
    hatch: [0.72, 0.64, 0.92],
    gesture: [0.36, 0.86, 0.95],
    editB: [1, 0.45, 0.28],
    morphTxt: [1, 0.66, 0.48],
    scanTxt: [0.56, 0.86, 0.56],
    swap: [1, 0.42, 0.78],
    sounding: [1, 0.93, 0.37],
    ink: [0.05, 0.05, 0.05],
    inkLight: [0.92, 0.92, 0.92]
};

/* ------------------------------------------------------------- small helpers */

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

function isNum(v) {
    return typeof v === 'number' && isFinite(v);
}

function toInt(v, d) {
    return isNum(v) ? Math.floor(v) : d;
}

function hexToRgb(hex) {
    var m = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(hex));
    if (!m) {
        return [0.5, 0.5, 0.5];
    }
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance(c) {
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

/* Live naming: key 60 = C3, key 0 = C-2 */
function noteName(k) {
    k = Math.floor(k);
    return NOTE_NAMES[((k % 12) + 12) % 12] + (Math.floor(k / 12) - 2);
}

function slotLetter(slot) {
    var s = toInt(slot, -1);
    return (s >= 0 && s < SLOT_LETTERS.length) ? SLOT_LETTERS.charAt(s) : '-';
}

function armedText(armed) {
    if (armed === 'layer') {
        return 'LAYER: click a key';
    }
    if (armed === 'dup') {
        return 'DUP: click a key';
    }
    return '';
}

function modLabel(offset) {
    return (offset >= 0 && offset < MOD_LABELS.length) ? MOD_LABELS[offset] : '';
}

/* 0/1 from a number, boolean or numeric string */
function toFlag(x) {
    if (typeof x === 'string') {
        x = Number(x);
    }
    return (x === true || (isNum(x) && x !== 0)) ? 1 : 0;
}

/* "nn" percent text for a 0..100 value that is > 0 (never shows 0%) */
function pctText(x) {
    return String(clamp(Math.round(x), 1, 100));
}

function inRect(r, x, y) {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/* ------------------------------------------------------------ view sanitising */

/*
 * Turn whatever the dict held into a complete, well-typed view so that the
 * painting and hit-testing code never has to check for missing fields.
 */
function normalizeView(raw) {
    var r = (raw && typeof raw === 'object') ? raw : {};
    var v = {};
    var i;

    v.status = (r.status === undefined || r.status === null) ? '' : String(r.status);

    v.palette = [];
    v.paletteRgb = [];
    for (i = 0; i < 16; i++) {
        var p = (Array.isArray(r.palette) && typeof r.palette[i] === 'string' &&
            /^#[0-9a-fA-F]{6}$/.test(r.palette[i])) ? r.palette[i] : DEFAULT_PALETTE[i];
        v.palette.push(p);
        v.paletteRgb.push(hexToRgb(p));
    }

    v.sources = [];
    if (Array.isArray(r.sources)) {
        for (i = 0; i < r.sources.length && i < 16; i++) {
            var s = r.sources[i];
            if (!s || typeof s !== 'object') {
                continue;
            }
            v.sources.push({
                index: toInt(s.index, v.sources.length),
                id: s.id,
                name: (s.name === undefined || s.name === null) ? '' : String(s.name),
                color: toInt(s.color, i),
                playMode: s.playMode,
                trigMode: s.trigMode,
                slices: Math.max(0, toInt(s.slices, 0)),
                loaded: (s.loaded === undefined) ? 1 : (s.loaded ? 1 : 0)
            });
        }
    }

    v.selectedSource = toInt(r.selectedSource, -1);
    v.selectedSlice = toInt(r.selectedSlice, -1);
    v.selectedKey = toInt(r.selectedKey, -1);
    v.rootKey = clamp(toInt(r.rootKey, 36), 0, NUM_KEYS - 1);
    v.slot = clamp(toInt(r.slot, 0), 0, 7);
    v.armed = (r.armed === 'layer' || r.armed === 'dup') ? r.armed : '';

    var frames = isNum(r.selectedFrames) ? r.selectedFrames : (isNum(r.frames) ? r.frames : 0);
    v.selectedFrames = frames > 0 ? Math.floor(frames) : 0;

    v.wave = [];
    if (Array.isArray(r.wave)) {
        var n = r.wave.length - (r.wave.length % 2);
        for (i = 0; i < n; i++) {
            v.wave.push(isNum(r.wave[i]) ? r.wave[i] : 0);
        }
    }

    v.slices = [];
    if (Array.isArray(r.slices)) {
        for (i = 0; i < r.slices.length; i++) {
            var sl = r.slices[i];
            if (Array.isArray(sl) && isNum(sl[0]) && isNum(sl[1])) {
                var a = clamp(sl[0], 0, 1);
                var b = clamp(sl[1], 0, 1);
                v.slices.push([a, b < a ? a : b]);
            }
        }
    }

    v.keys = [];
    v.keyFlags = [];
    for (i = 0; i < NUM_KEYS; i++) {
        var kv = Array.isArray(r.keys) ? toInt(r.keys[i], -1) : -1;
        v.keys.push(kv < 0 ? -1 : kv);
        var fv = Array.isArray(r.keyFlags) ? toInt(r.keyFlags[i], 0) : 0;
        v.keyFlags.push(fv < 0 ? 0 : fv);
    }

    if (isNum(r.modStart)) {
        v.modStart = Math.floor(r.modStart);
    } else {
        v.modStart = -1;
        for (i = 0; i < NUM_KEYS; i++) {
            if (v.keyFlags[i] & FLAG_MOD) {
                v.modStart = i;
                break;
            }
        }
    }

    /* v2 fields */
    v.morph = isNum(r.morph) ? clamp(r.morph, 0, 100) : 0;
    v.scan = isNum(r.scan) ? clamp(r.scan, 0, 100) : 0;
    v.morphEdit = toFlag(r.morphEdit);
    var g = toInt(r.gesture, -1);
    v.gesture = (g >= 0 && g < GESTURE_COUNT) ? g : -1;
    v.gestureNames = [];
    for (i = 0; i < GESTURE_COUNT; i++) {
        var gn = Array.isArray(r.gestureNames) ? r.gestureNames[i] : '';
        v.gestureNames.push((typeof gn === 'string' || isNum(gn)) ? String(gn) : '');
    }
    return v;
}

function modOffsetOf(v, k) {
    if (v.modStart < 0) {
        return -1;
    }
    var o = k - v.modStart;
    return (o >= 0 && o < MOD_LABELS.length) ? o : -1;
}

/* key of the active gesture (G1..G4 in the mod zone) or -1 */
function gestureKey(v) {
    if (v.gesture < 0 || v.modStart < 0) {
        return -1;
    }
    var k = v.modStart + GESTURE_OFFSET + v.gesture;
    return k < NUM_KEYS ? k : -1;
}

function findSource(v, index) {
    for (var i = 0; i < v.sources.length; i++) {
        if (v.sources[i].index === index) {
            return v.sources[i];
        }
    }
    return null;
}

/* ------------------------------------------------------------------- layout */

/*
 * All rectangles are {x, y, w, h} in pixels.
 *   tabs    source chips
 *   wave    waveform panel (the drawable interior is waveInner())
 *   keys    whole keyboard strip; prev / next are the < > buttons,
 *           board is the area holding the 48 keys
 *   status  one text line
 */
function computeLayout(w, h) {
    w = Math.max(MIN_W, Math.round(isNum(w) ? w : DEFAULT_W));
    h = Math.max(MIN_H, Math.round(isNum(h) ? h : DEFAULT_H));

    var iw = w - 2 * PAD_X;
    var flex = h - 2 * PAD_Y - 3 * GAP - TABS_H - STATUS_H;
    var keysH = Math.max(MIN_KEYS_H, Math.round(flex * KEYS_SHARE));
    var waveH = flex - keysH;
    if (waveH < MIN_WAVE_H) {
        waveH = MIN_WAVE_H;
        keysH = flex - waveH;
    }

    var tabs = { x: PAD_X, y: PAD_Y, w: iw, h: TABS_H };
    var wave = { x: PAD_X, y: tabs.y + TABS_H + GAP, w: iw, h: waveH };
    var keys = { x: PAD_X, y: wave.y + waveH + GAP, w: iw, h: keysH };
    var status = { x: PAD_X, y: keys.y + keysH + GAP, w: iw, h: STATUS_H };
    var board = {
        x: keys.x + ARROW_W + ARROW_GAP,
        y: keys.y,
        w: iw - 2 * (ARROW_W + ARROW_GAP),
        h: keysH
    };
    var whiteW = board.w / WIN_WHITES;

    return {
        w: w,
        h: h,
        tabs: tabs,
        wave: wave,
        keys: keys,
        prev: { x: keys.x, y: keys.y, w: ARROW_W, h: keysH },
        next: { x: keys.x + iw - ARROW_W, y: keys.y, w: ARROW_W, h: keysH },
        board: board,
        status: status,
        whiteW: whiteW,
        blackW: whiteW * BLACK_W_SHARE,
        blackH: Math.round(keysH * BLACK_H_SHARE)
    };
}

/* interior of the waveform panel; normalized positions map onto this */
function waveInner(L) {
    return { x: L.wave.x + 1, y: L.wave.y + 1, w: L.wave.w - 2, h: L.wave.h - 2 };
}

function xToNorm(L, x) {
    var inner = waveInner(L);
    return clamp((x - inner.x) / inner.w, 0, 1);
}

function normToX(L, norm) {
    var inner = waveInner(L);
    return inner.x + norm * inner.w;
}

/* normalized waveform position -> frame (0 = not possible: frames unknown) */
function normToFrame(frames, norm) {
    if (!(frames > 1)) {
        return 0;
    }
    return clamp(Math.round(norm * frames), 1, frames - 1);
}

/* ------------------------------------------------------------------- tabs */

function tabRects(L, n) {
    var rects = [];
    if (n <= 0) {
        return rects;
    }
    var a = L.tabs;
    var gap = 2;
    var cw = Math.floor((a.w - (n - 1) * gap) / n);
    cw = clamp(cw, 2, 120);
    for (var i = 0; i < n; i++) {
        rects.push({ x: a.x + i * (cw + gap), y: a.y, w: cw, h: a.h });
    }
    return rects;
}

/* index of the chip under x,y or -1 (the 2 px gap belongs to the left chip) */
function tabAt(L, n, x, y) {
    if (n <= 0 || !inRect(L.tabs, x, y)) {
        return -1;
    }
    var rects = tabRects(L, n);
    var step = rects[0].w + 2;
    var i = Math.floor((x - L.tabs.x) / step);
    if (i < 0 || i >= n) {
        return -1;
    }
    return i;
}

/* ------------------------------------------------------------ key geometry */

function isBlackKey(k) {
    return IS_BLACK[((k % 12) + 12) % 12] === 1;
}

function whitesBefore(n) {
    return Math.floor(n / 12) * 7 + WHITES_BELOW[n % 12];
}

/* number of white keys between the window start and key k */
function whiteIndex(ws, k) {
    return whitesBefore(k) - whitesBefore(ws);
}

function clampWinStart(ws) {
    return clamp(ws, 0, MAX_WIN_START);
}

function octaveStart(k) {
    return Math.floor(k / 12) * 12;
}

/*
 * Window start after pressing < (dir -1) or > (dir +1).  Steps are octaves
 * and the last window ends on key 127 (start 80), which is not C-aligned;
 * stepping back from it lands on the C below.
 */
function shiftedWinStart(ws, dir) {
    if (dir > 0) {
        return clampWinStart((Math.floor(ws / 12) + 1) * 12);
    }
    return clampWinStart(ws % 12 ? octaveStart(ws) : ws - 12);
}

/* window start that shows key k (unchanged if it is already visible) */
function followWinStart(ws, k) {
    if (k < 0 || k >= NUM_KEYS || (k >= ws && k < ws + WIN_KEYS)) {
        return ws;
    }
    if (k < ws) {
        return clampWinStart(octaveStart(k));
    }
    return clampWinStart(octaveStart(k) - 36);
}

/* rectangle of key k for the window starting at ws, or null if not visible */
function keyRect(L, ws, k) {
    if (k < ws || k >= ws + WIN_KEYS) {
        return null;
    }
    var b = L.board;
    var wi = whiteIndex(ws, k);
    if (!isBlackKey(k)) {
        return { x: b.x + wi * L.whiteW, y: b.y, w: L.whiteW, h: b.h, black: false };
    }
    /* a black key sits on the boundary left of the next white key */
    var cx = b.x + wi * L.whiteW;
    var x0 = Math.max(b.x, cx - L.blackW / 2);
    var x1 = Math.min(b.x + b.w, cx + L.blackW / 2);
    return { x: x0, y: b.y, w: x1 - x0, h: L.blackH, black: true };
}

/* white key at white-key position wi (0..27) of the window */
function whiteKeyAt(ws, wi) {
    var count = 0;
    for (var k = ws; k < ws + WIN_KEYS; k++) {
        if (!isBlackKey(k)) {
            if (count === wi) {
                return k;
            }
            count++;
        }
    }
    return -1;
}

/* key under x,y or -1; black keys are on top of the white ones */
function keyAt(L, ws, x, y) {
    var b = L.board;
    if (!inRect(b, x, y)) {
        return -1;
    }
    var k;
    if (y < b.y + L.blackH) {
        for (k = ws; k < ws + WIN_KEYS; k++) {
            if (isBlackKey(k)) {
                var r = keyRect(L, ws, k);
                if (x >= r.x && x < r.x + r.w) {
                    return k;
                }
            }
        }
    }
    var wi = clamp(Math.floor((x - b.x) / L.whiteW), 0, WIN_WHITES - 1);
    return whiteKeyAt(ws, wi);
}

/* a point that hits key k (middle of its exposed part), or null */
function keyCenter(L, ws, k) {
    var r = keyRect(L, ws, k);
    if (!r) {
        return null;
    }
    if (r.black) {
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    return { x: r.x + r.w / 2, y: r.y + (L.blackH + r.h) / 2 };
}

/*
 * Outline of a key as a flat [x0, y0, x1, y1, ...] polygon.  White keys have
 * notches where a neighbouring black key (inside the window) overlaps them.
 */
function keyPolygon(L, ws, k) {
    var r = keyRect(L, ws, k);
    if (!r) {
        return null;
    }
    if (r.black) {
        return [r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h];
    }
    var nb = L.blackW / 2;
    var bh = L.blackH;
    var left = k - 1 >= ws && isBlackKey(k - 1);
    var right = k + 1 < ws + WIN_KEYS && isBlackKey(k + 1);
    var xl = r.x;
    var xr = r.x + r.w;
    var yt = r.y;
    var yb = r.y + r.h;
    var pts = [left ? xl + nb : xl, yt, right ? xr - nb : xr, yt];
    if (right) {
        pts.push(xr - nb, yt + bh, xr, yt + bh);
    }
    pts.push(xr, yb, xl, yb);
    if (left) {
        pts.push(xl, yt + bh, xl + nb, yt + bh);
    }
    return pts;
}

/*
 * Diamond [x0, y0, ...] marking a pad that has morph B values.  It sits at the
 * top of the key, centred in the part not covered by neighbouring black keys,
 * above the lock / reverse / layer glyphs.  null if the key is not visible.
 */
function morphMarkPoly(L, ws, k) {
    var r = keyRect(L, ws, k);
    if (!r) {
        return null;
    }
    var nb = L.blackW / 2;
    var lo = r.x;
    var hi = r.x + r.w;
    if (!r.black) {
        if (k - 1 >= ws && isBlackKey(k - 1)) {
            lo += nb;
        }
        if (k + 1 < ws + WIN_KEYS && isBlackKey(k + 1)) {
            hi -= nb;
        }
    }
    var rad = clamp((hi - lo) / 2 - 0.5, 1, 2.5);
    var cx = (lo + hi) / 2;
    var cy = r.y + 1.5 + rad;
    return [cx, cy - rad, cx + rad, cy, cx, cy + rad, cx - rad, cy];
}

/* 45 degree hatch lines clipped to a rectangle: [[x1, y1, x2, y2], ...] */
function hatchSegments(x, y, w, h, step) {
    var segs = [];
    if (w <= 0 || h <= 0 || step <= 0) {
        return segs;
    }
    for (var d = step; d < w + h; d += step) {
        segs.push([
            x + Math.min(d, w),
            y + Math.max(0, d - w),
            x + Math.max(0, d - h),
            y + Math.min(d, h)
        ]);
    }
    return segs;
}

/* ----------------------------------------------------------- waveform helpers */

/* min/max pairs for W pixel columns: [min0, max0, min1, max1, ...] */
function peaksForWidth(wave, W) {
    var out = [];
    var cols = Math.floor(wave.length / 2);
    if (cols <= 0 || W <= 0) {
        return out;
    }
    for (var px = 0; px < W; px++) {
        var c0 = Math.floor(px * cols / W);
        var c1 = Math.max(c0 + 1, Math.floor((px + 1) * cols / W));
        if (c1 > cols) {
            c1 = cols;
        }
        var mn = Infinity;
        var mx = -Infinity;
        for (var c = c0; c < c1; c++) {
            var a = wave[2 * c];
            var b = wave[2 * c + 1];
            mn = Math.min(mn, a, b);
            mx = Math.max(mx, a, b);
        }
        out.push(clamp(mn, -1, 1), clamp(mx, -1, 1));
    }
    return out;
}

/* slice containing the normalized position (the last one at the very end) */
function sliceAt(slices, norm) {
    var n = slices.length;
    if (!n) {
        return -1;
    }
    for (var i = 0; i < n; i++) {
        if (norm < slices[i][1]) {
            return i;
        }
    }
    return n - 1;
}

/* marker i (> 0, start of slice i) within MARKER_TOL px of x, else -1 */
function markerAt(L, slices, x) {
    var best = -1;
    var bestD = Infinity;
    for (var i = 1; i < slices.length; i++) {
        var d = Math.abs(normToX(L, slices[i][0]) - x);
        if (d <= MARKER_TOL && d < bestD) {
            best = i;
            bestD = d;
        }
    }
    return best;
}

/* ---------------------------------------------------------------- hit testing */

/*
 * What is under x,y?
 *   {zone: 'tab', index}                 index into view.sources
 *   {zone: 'wave', norm, slice, marker}  slice / marker = -1 when none
 *   {zone: 'key', key}
 *   {zone: 'prev'} {zone: 'next'} {zone: 'status'} {zone: 'none'}
 */
function hitTest(L, v, ws, x, y) {
    var i;
    if (inRect(L.tabs, x, y)) {
        i = tabAt(L, v.sources.length, x, y);
        return i >= 0 ? { zone: 'tab', index: i } : { zone: 'none' };
    }
    if (inRect(L.wave, x, y)) {
        var norm = xToNorm(L, x);
        return {
            zone: 'wave',
            norm: norm,
            slice: sliceAt(v.slices, norm),
            marker: markerAt(L, v.slices, x)
        };
    }
    if (inRect(L.prev, x, y)) {
        return { zone: 'prev' };
    }
    if (inRect(L.next, x, y)) {
        return { zone: 'next' };
    }
    if (inRect(L.board, x, y)) {
        i = keyAt(L, ws, x, y);
        return i >= 0 ? { zone: 'key', key: i } : { zone: 'none' };
    }
    if (inRect(L.status, x, y)) {
        return { zone: 'status' };
    }
    return { zone: 'none' };
}

/* ------------------------------------------------------------------- state */

var dictName = '';
var view = normalizeView(null);
var winStart = 36;
var winInit = false;
var lastRoot = -1;
var lastSelKey = -2;
var size = { w: DEFAULT_W, h: DEFAULT_H };
var gotResize = false;
var layout = computeLayout(DEFAULT_W, DEFAULT_H);
var drag = null;        /* active mouse gesture, see onclick() */
var scrollTask = null;  /* Max Task that scrolls the key window while swap-dragging over < > */
var ghost = null;       /* {index, norm}: marker shown at its dragged position until the next refresh */
var note = '';          /* transient status text that replaces view.status until the next refresh */
var fontSize = -1;

if (typeof jsarguments !== 'undefined' && jsarguments && jsarguments.length > 1 &&
    typeof jsarguments[1] === 'string' && jsarguments[1] !== '') {
    dictName = jsarguments[1];
}

function redraw() {
    mgraphics.redraw();
}

function setNote(text) {
    note = text;
    redraw();
}

function emit(name, a, b) {
    if (b !== undefined) {
        outlet(0, name, a, b);
    } else if (a !== undefined) {
        outlet(0, name, a);
    } else {
        outlet(0, name);
    }
}

function setSize(w, h) {
    if (isNum(w) && isNum(h) && w > 0 && h > 0) {
        size.w = w;
        size.h = h;
        layout = computeLayout(w, h);
    }
}

/* before the first onresize() fall back to the box rectangle */
function syncSize() {
    if (gotResize) {
        return;
    }
    try {
        var r = host.box.rect;
        if (r && r.length >= 4) {
            var w = r[2] - r[0];
            var h = r[3] - r[1];
            if (w > 0 && h > 0 && (w !== size.w || h !== size.h)) {
                setSize(w, h);
            }
        }
    } catch (e) {
        /* no box in this environment: keep the default size */
    }
}

/* adopt a new view and update the keyboard window */
function setView(raw) {
    view = normalizeView(raw);
    ghost = null;
    note = '';
    if (!winInit) {
        winStart = clampWinStart(octaveStart(view.rootKey));
        winInit = true;
        lastRoot = view.rootKey;
    } else if (view.rootKey !== lastRoot) {
        winStart = clampWinStart(octaveStart(view.rootKey));
        lastRoot = view.rootKey;
    }
    if (view.selectedKey !== lastSelKey) {
        winStart = followWinStart(winStart, view.selectedKey);
        lastSelKey = view.selectedKey;
    }
}

function shiftWindow(dir) {
    winStart = shiftedWinStart(winStart, dir);
    redraw();
}

/* ------------------------------------------------------------ Max messages */

function viewdict(name) {
    if (arguments.length === 0) {
        return;
    }
    dictName = String(name);
    refresh();
}

function refresh() {
    if (!dictName) {
        redraw();
        return;
    }
    var json;
    try {
        json = new Dict(dictName).stringify();
    } catch (e) {
        post('slicekit-ui: cannot read dict "' + dictName + '": ' + e + '\n');
        return;
    }
    var raw;
    try {
        raw = JSON.parse(json);
    } catch (e2) {
        post('slicekit-ui: view dict "' + dictName + '" is not valid JSON\n');
        return;
    }
    setView(raw);
    redraw();
}

function bang() {
    refresh();
}

function onresize(w, h) {
    gotResize = true;
    setSize(w, h);
    redraw();
}

/* ------------------------------------------------------------- mouse events */

/* end whatever gesture is still running (a release event was lost) */
function abortDrag() {
    if (drag && drag.type === 'audition') {
        emit('auditionoff', drag.key);
    }
    stopScroll();
    drag = null;
}

/* ---- swap drag: press a key, drag it onto another key, release ---- */

function stopScroll() {
    if (scrollTask) {
        try {
            scrollTask.cancel();
        } catch (e) {
            /* nothing scheduled */
        }
    }
}

/* arm the dwell timer; false when Max's Task is not available */
function startScroll() {
    if (typeof Task !== 'function') {
        return false;
    }
    try {
        if (!scrollTask) {
            scrollTask = new Task(scrollTick, host);
        }
        scrollTask.schedule(HOVER_MS);
        return true;
    } catch (e) {
        scrollTask = null;
        return false;
    }
}

function scrollTick() {
    if (!drag || drag.type !== 'swap' || !drag.hover) {
        return;
    }
    var before = winStart;
    shiftWindow(drag.hover);
    drag.hoverAt = Date.now();
    if (winStart !== before) {
        drag.timer = startScroll();
    }
}

/* the pointer is over the < (-1) or > (+1) arrow, or over neither (0) */
function hoverArrow(dir) {
    if (dir === drag.hover) {
        /* without a Task the dwell is measured on drag events */
        if (dir && !drag.timer && Date.now() - drag.hoverAt >= HOVER_MS) {
            drag.hoverAt = Date.now();
            shiftWindow(dir);
        }
        return;
    }
    stopScroll();
    drag.hover = dir;
    drag.hoverAt = Date.now();
    drag.timer = dir ? startScroll() : false;
    redraw();
}

/* {from, to} while a key is being dragged away from its place (to = -1: not over a key), else null */
function swapDrag() {
    if (drag && drag.type === 'swap' && drag.moved) {
        return { from: drag.key, to: drag.target };
    }
    return null;
}

function swapText(from, to) {
    return 'swap ' + noteName(from) + ' \u2192 ' + (to >= 0 ? noteName(to) : '?');
}

function dragSwap(x, y) {
    if (!drag.moved) {
        var dx = x - drag.x0;
        var dy = y - drag.y0;
        if (dx * dx + dy * dy < SWAP_THRESHOLD * SWAP_THRESHOLD) {
            return;
        }
        drag.moved = true;
    }
    var hit = hitTest(layout, view, winStart, x, y);
    var target = (hit.zone === 'key' && hit.key !== drag.key) ? hit.key : -1;
    var dir = hit.zone === 'prev' ? -1 : (hit.zone === 'next' ? 1 : 0);
    hoverArrow(dir);
    if (target !== drag.target || !drag.shown) {
        drag.target = target;
        drag.shown = true;
        redraw();
    }
}

/* releasing on another key swaps; anywhere else (same key, arrows, outside) cancels */
function releaseSwap(x, y) {
    stopScroll();
    if (!drag.moved) {
        return;
    }
    var hit = hitTest(layout, view, winStart, x, y);
    if (hit.zone === 'key' && hit.key !== drag.key) {
        emit('swap', drag.key, hit.key);
    }
}

function keyDown(k, cmd, shift, x, y) {
    if (cmd) {
        emit('lock', k);
    } else if (shift) {
        emit('audition', k, AUDITION_VEL);
        drag = { type: 'audition', key: k };
    } else {
        emit('selectkey', k);
        drag = { type: 'swap', key: k, x0: x, y0: y, moved: false, target: -1, shown: false, hover: 0, hoverAt: 0, timer: false };
    }
}

function waveDown(hit, x, shift, option) {
    if (view.selectedSource < 0) {
        return;
    }
    if (option) {
        if (hit.marker >= 1) {
            emit('removeslice', hit.marker);
        }
        return;
    }
    if (shift) {
        var f = normToFrame(view.selectedFrames, hit.norm);
        if (f > 0) {
            emit('addslice', f);
        } else {
            setNote('cannot add a slice: the view has no selectedFrames');
        }
        return;
    }
    if (hit.marker >= 1) {
        drag = {
            type: 'marker',
            index: hit.marker,
            startX: x,
            moved: false,
            norm: view.slices[hit.marker][0]
        };
        return;
    }
    if (hit.slice >= 0) {
        emit('selectslice', hit.slice);
    }
}

function onclick(x, y, but, cmd, shift, capslock, option, ctrl) {
    abortDrag();
    ghost = null;
    var hit = hitTest(layout, view, winStart, x, y);
    if (hit.zone === 'tab') {
        emit('selectsource', view.sources[hit.index].index);
    } else if (hit.zone === 'wave') {
        waveDown(hit, x, shift, option);
    } else if (hit.zone === 'prev') {
        shiftWindow(-1);
    } else if (hit.zone === 'next') {
        shiftWindow(1);
    } else if (hit.zone === 'key') {
        keyDown(hit.key, cmd || ctrl, shift, x, y);
    }
}

function dragMarker(x) {
    var s = view.slices;
    var i = drag.index;
    if (!drag.moved && Math.abs(x - drag.startX) < DRAG_THRESHOLD) {
        return;
    }
    drag.moved = true;
    var eps = 1 / waveInner(layout).w;
    var lo = s[i - 1][0] + eps;
    var hi = s[i][1] - eps;
    drag.norm = lo < hi ? clamp(xToNorm(layout, x), lo, hi) : s[i][0];
    ghost = { index: i, norm: drag.norm };
    redraw();
}

function releaseMarker(x) {
    var i = drag.index;
    if (drag.moved) {
        var f = normToFrame(view.selectedFrames, drag.norm);
        if (f > 0) {
            emit('moveslice', i, f);
        } else {
            ghost = null;
            setNote('cannot move the slice: the view has no selectedFrames');
        }
    } else {
        ghost = null;
        var sl = sliceAt(view.slices, xToNorm(layout, x));
        if (sl >= 0) {
            emit('selectslice', sl);
        }
    }
}

function ondrag(x, y, but, cmd, shift, capslock, option, ctrl) {
    if (!drag) {
        return;
    }
    if (but) {
        if (drag.type === 'marker') {
            dragMarker(x);
        } else if (drag.type === 'swap') {
            dragSwap(x, y);
        }
        return;
    }
    if (drag.type === 'marker') {
        releaseMarker(x);
    } else if (drag.type === 'audition') {
        emit('auditionoff', drag.key);
    } else if (drag.type === 'swap') {
        releaseSwap(x, y);
    }
    drag = null;
    redraw();
}

/*
 * Double click: only plain selections are repeated.  Anything with a modifier
 * (lock toggle, audition, slice editing) was already handled by onclick, and
 * running it twice would undo it.
 */
function ondblclick(x, y, but, cmd, shift, capslock, option, ctrl) {
    if (cmd || shift || option || ctrl) {
        return;
    }
    var hit = hitTest(layout, view, winStart, x, y);
    if (hit.zone === 'tab') {
        emit('selectsource', view.sources[hit.index].index);
    } else if (hit.zone === 'key') {
        emit('selectkey', hit.key);
    }
}

/* mouse moves with no button down: a pending audition / swap lost its release */
function onidle(x, y) {
    if (drag && (drag.type === 'audition' || drag.type === 'swap')) {
        var wasSwap = drag.type === 'swap' && drag.moved;
        abortDrag();
        if (wasSwap) {
            redraw();
        }
    }
}

function onidleout(x, y) {
    onidle(x, y);
}

/* --------------------------------------------------------------- painting */

function setRGBA(c, a) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], a === undefined ? 1 : a);
}

function fillRect(x, y, w, h, c, a) {
    setRGBA(c, a);
    mgraphics.rectangle(x, y, Math.max(0, w), Math.max(0, h));
    mgraphics.fill();
}

function strokeRect(x, y, w, h, c, a, lw) {
    setRGBA(c, a);
    mgraphics.set_line_width(lw || 1);
    mgraphics.rectangle(x, y, Math.max(0, w), Math.max(0, h));
    mgraphics.stroke();
}

function strokePoly(pts, c, a, lw) {
    setRGBA(c, a);
    mgraphics.set_line_width(lw || 1);
    mgraphics.move_to(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) {
        mgraphics.line_to(pts[i], pts[i + 1]);
    }
    mgraphics.close_path();
    mgraphics.stroke();
}

function setFont(px) {
    if (px !== fontSize) {
        mgraphics.set_font_size(px);
        fontSize = px;
    }
}

function textW(s) {
    var m = mgraphics.text_measure(s);
    return (m && m.length) ? m[0] : s.length * fontSize * 0.55;
}

/*
 * Shorten s to at most maxW pixels at font size px: "abc..." when at least
 * three characters fit before the dots, else a bare prefix, else "".
 */
function fitText(s, maxW, px) {
    s = String(s);
    if (px) {
        setFont(px);
    }
    if (maxW <= 0) {
        return '';
    }
    if (textW(s) <= maxW) {
        return s;
    }
    var lo = 0;
    var hi = s.length;
    while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        if (textW(s.substring(0, mid) + '...') <= maxW) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    if (lo >= 3) {
        return s.substring(0, lo) + '...';
    }
    lo = 0;
    hi = s.length;
    while (lo < hi) {
        var mid2 = Math.ceil((lo + hi) / 2);
        if (textW(s.substring(0, mid2)) <= maxW) {
            lo = mid2;
        } else {
            hi = mid2 - 1;
        }
    }
    return s.substring(0, lo);
}

/* draw text with its baseline at y; align is 'left' (default), 'right' or 'center' */
function drawText(s, x, y, px, c, a, align) {
    if (s === '') {
        return;
    }
    setFont(px);
    var xx = x;
    if (align === 'right') {
        xx = x - textW(s);
    } else if (align === 'center') {
        xx = x - textW(s) / 2;
    }
    setRGBA(c, a);
    mgraphics.move_to(xx, y);
    mgraphics.show_text(s);
}

function paintTabs(L, v) {
    var rects = tabRects(L, v.sources.length);
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var src = v.sources[i];
        var sel = src.index === v.selectedSource;
        var col = v.paletteRgb[((src.color % 16) + 16) % 16];
        var live = src.loaded ? 1 : 0.4;

        fillRect(r.x, r.y, r.w, r.h, sel ? COL.chipSel : COL.chip, 1);
        if (r.w < 14) {
            /* too narrow for text: the colour swatch fills the chip */
            fillRect(r.x + 1, r.y + 4, Math.max(1, r.w - 2), r.h - 8, col, live);
        } else {
            fillRect(r.x + 3, r.y + 4, 5, r.h - 8, col, live);

            var base = r.y + r.h / 2 + 3.2;
            var left = r.x + 12;
            var right = r.x + r.w - 4;
            if (r.w >= 60) {
                var cnt = String(src.slices);
                drawText(cnt, right, base, 8, COL.dim, live, 'right');
                right -= textW(cnt) + 4;
            }
            drawText(fitText(src.name, right - left, 9), left, base, 9, COL.text, src.loaded ? 1 : 0.45, 'left');
        }

        if (sel) {
            strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, col, 1, 1.5);
        }
    }
    if (!rects.length) {
        drawText('no samples', L.tabs.x + 6, L.tabs.y + L.tabs.h / 2 + 3.2, 9, COL.dim, 1, 'left');
    }
}

function strokeColumns(peaks, W, x0, midY, amp, selLo, selHi, wantSel, c, a) {
    var any = false;
    for (var px = 0; px < W; px++) {
        var inSel = px >= selLo && px < selHi;
        if (inSel !== wantSel) {
            continue;
        }
        var x = x0 + px + 0.5;
        var y1 = midY - peaks[2 * px + 1] * amp;
        var y2 = midY - peaks[2 * px] * amp;
        if (y2 - y1 < 1) {
            var m = (y1 + y2) / 2;
            y1 = m - 0.5;
            y2 = m + 0.5;
        }
        mgraphics.move_to(x, y1);
        mgraphics.line_to(x, y2);
        any = true;
    }
    if (any) {
        setRGBA(c, a);
        mgraphics.set_line_width(1);
        mgraphics.stroke();
    }
}

function paintWave(L, v) {
    var r = L.wave;
    fillRect(r.x, r.y, r.w, r.h, COL.panel, 1);

    var src = findSource(v, v.selectedSource);
    if (v.selectedSource < 0 || (!src && !v.slices.length && !v.wave.length)) {
        drawText(v.sources.length ? 'select a sample' : 'drop samples on the device',
            r.x + r.w / 2, r.y + r.h / 2 + 3.5, 10, COL.dim, 1, 'center');
        strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, COL.border, 1, 1);
        return;
    }

    var col = v.paletteRgb[src ? ((src.color % 16) + 16) % 16 : 0];
    var inner = waveInner(L);
    var W = Math.floor(inner.w);
    var midY = inner.y + inner.h / 2;
    var amp = inner.h / 2 - 2;
    var i;

    /* slice shading */
    for (i = 0; i < v.slices.length; i++) {
        var s = v.slices[i];
        var x0 = inner.x + s[0] * inner.w;
        var x1 = inner.x + s[1] * inner.w;
        if (i === v.selectedSlice) {
            fillRect(x0, inner.y, x1 - x0, inner.h, col, 0.22);
        } else {
            fillRect(x0, inner.y, x1 - x0, inner.h, COL.white, (i % 2) ? 0.07 : 0.025);
        }
    }

    /* centre line + waveform */
    fillRect(inner.x, midY, inner.w, 1, COL.white, 0.08);
    var peaks = peaksForWidth(v.wave, W);
    if (peaks.length) {
        var selLo = 0;
        var selHi = 0;
        if (v.selectedSlice >= 0 && v.selectedSlice < v.slices.length) {
            selLo = Math.floor(v.slices[v.selectedSlice][0] * W);
            selHi = Math.ceil(v.slices[v.selectedSlice][1] * W);
        }
        strokeColumns(peaks, W, inner.x, midY, amp, selLo, selHi, false, col, selHi > selLo ? 0.6 : 0.85);
        if (selHi > selLo) {
            strokeColumns(peaks, W, inner.x, midY, amp, selLo, selHi, true, col, 1);
        }
    }

    /* selected slice frame */
    if (v.selectedSlice >= 0 && v.selectedSlice < v.slices.length) {
        var ss = v.slices[v.selectedSlice];
        var sx0 = inner.x + ss[0] * inner.w;
        var sx1 = inner.x + ss[1] * inner.w;
        fillRect(sx0, inner.y, sx1 - sx0, 2, col, 0.9);
        fillRect(sx0, inner.y + inner.h - 2, sx1 - sx0, 2, col, 0.9);
    }

    /* markers: start of every slice but the first */
    for (i = 1; i < v.slices.length; i++) {
        var norm = (ghost && ghost.index === i) ? ghost.norm : v.slices[i][0];
        var mx = Math.round(inner.x + norm * inner.w) + 0.5;
        var hot = (ghost && ghost.index === i) || i === v.selectedSlice || i === v.selectedSlice + 1;
        setRGBA(COL.white, hot ? 0.95 : 0.4);
        mgraphics.set_line_width(1);
        mgraphics.move_to(mx, inner.y);
        mgraphics.line_to(mx, inner.y + inner.h);
        mgraphics.stroke();
        mgraphics.move_to(mx - 3, inner.y);
        mgraphics.line_to(mx + 3, inner.y);
        mgraphics.line_to(mx, inner.y + 4);
        mgraphics.close_path();
        mgraphics.fill();
    }

    strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, COL.border, 1, 1);
}

/* little glyphs for the key flags; (cx, cy) is the glyph centre */
function drawLockGlyph(cx, cy, ink) {
    setRGBA(ink, 0.9);
    mgraphics.rectangle(cx - 2.5, cy - 0.5, 5, 4);
    mgraphics.fill();
    mgraphics.set_line_width(1);
    mgraphics.move_to(cx - 1.5, cy - 0.5);
    mgraphics.line_to(cx - 1.5, cy - 2.5);
    mgraphics.line_to(cx + 1.5, cy - 2.5);
    mgraphics.line_to(cx + 1.5, cy - 0.5);
    mgraphics.stroke();
}

function drawReverseGlyph(cx, cy, ink) {
    setRGBA(ink, 0.9);
    mgraphics.move_to(cx - 3, cy);
    mgraphics.line_to(cx + 2, cy - 3);
    mgraphics.line_to(cx + 2, cy + 3);
    mgraphics.close_path();
    mgraphics.fill();
}

function drawDotGlyph(cx, cy, ink) {
    setRGBA(ink, 0.9);
    mgraphics.move_to(cx + 2, cy);
    mgraphics.arc(cx, cy, 2, 0, Math.PI * 2);
    mgraphics.fill();
}

function paintKey(L, v, k) {
    var r = keyRect(L, winStart, k);
    var black = r.black;
    var f = v.keyFlags[k];
    var pi = v.keys[k];
    var fill;

    if (f & FLAG_MOD) {
        fill = black ? COL.modB : COL.modW;
    } else if (pi >= 0) {
        var pc = v.paletteRgb[pi % 16];
        fill = black ? mixRgb(pc, COL.black, 0.38) : pc;
    } else {
        fill = black ? COL.keyEmptyB : COL.keyEmptyW;
    }
    if (f & FLAG_SOUNDING) {
        fill = mixRgb(fill, COL.white, 0.45);
    }
    var isGesture = k === gestureKey(v);
    if (isGesture) {
        fill = mixRgb(fill, COL.gesture, 0.6);
    }
    var swp = swapDrag();
    if (swp && k === swp.from) {
        fill = mixRgb(fill, COL.black, 0.45);     /* picked up */
    } else if (swp && k === swp.to) {
        fill = mixRgb(fill, COL.swap, 0.5);       /* drop target */
    }
    fillRect(r.x, r.y, r.w, r.h, fill, 1);
    strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, COL.keyLine, 0.9, 1);

    var ink = luminance(fill) > 0.5 ? COL.ink : COL.inkLight;
    var cx = r.x + r.w / 2;
    var i;

    /* mod zone: hatch + action label */
    if (f & FLAG_MOD) {
        var segs = hatchSegments(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 5);
        setRGBA(COL.hatch, 0.3);
        mgraphics.set_line_width(1);
        for (i = 0; i < segs.length; i++) {
            mgraphics.move_to(segs[i][0], segs[i][1]);
            mgraphics.line_to(segs[i][2], segs[i][3]);
        }
        mgraphics.stroke();
        var lab = modLabel(modOffsetOf(v, k));
        var ly = black ? r.y + r.h / 2 + 3 : r.y + L.blackH + 9;
        drawText(lab, cx, ly, 7, isGesture ? COL.white : COL.inkLight, 0.95, 'center');
    }

    /* morph B values: diamond at the top of the key */
    var hasB = (f & FLAG_MORPHB) ? 1 : 0;
    if (hasB) {
        var dia = morphMarkPoly(L, winStart, k);
        setRGBA(ink, 0.9);
        mgraphics.move_to(dia[0], dia[1]);
        for (i = 2; i < dia.length; i += 2) {
            mgraphics.line_to(dia[i], dia[i + 1]);
        }
        mgraphics.close_path();
        mgraphics.fill();
    }

    /* lock / reversed / layers glyphs: a row on white keys, a column on black ones */
    var glyphs = [];
    if (f & FLAG_LOCK) {
        glyphs.push(drawLockGlyph);
    }
    if (f & FLAG_REV) {
        glyphs.push(drawReverseGlyph);
    }
    if (f & FLAG_LAYERS) {
        glyphs.push(drawDotGlyph);
    }
    /* on black keys the column starts lower when the diamond sits at the top */
    var top = black ? 7 + (hasB ? 5 : 0) : 7;
    var step = clamp(Math.floor((r.h - 1 - top) / Math.max(1, glyphs.length)), 4, 8);
    for (i = 0; i < glyphs.length; i++) {
        if (black) {
            glyphs[i](cx, r.y + top + i * step, ink);
        } else {
            glyphs[i](cx + (i - (glyphs.length - 1) / 2) * 7, r.y + L.blackH + 6, ink);
        }
    }

    /* copy (non-base pad): corner mark */
    if (f & FLAG_COPY) {
        setRGBA(ink, 0.85);
        mgraphics.move_to(r.x + r.w - 1, r.y + r.h - 6);
        mgraphics.line_to(r.x + r.w - 1, r.y + r.h - 1);
        mgraphics.line_to(r.x + r.w - 6, r.y + r.h - 1);
        mgraphics.close_path();
        mgraphics.fill();
    }

    /* C labels and the root key marker */
    var roomForBoth = r.h - L.blackH >= 19;
    if (!black && k % 12 === 0 && !(f & FLAG_MOD) && (roomForBoth || !glyphs.length)) {
        drawText(noteName(k), cx, r.y + r.h - 4, 8, pi >= 0 ? COL.ink : COL.dim, 0.8, 'center');
    }
    if (k === v.rootKey) {
        fillRect(cx - 3, r.y + r.h - 3, 6, 2, ink, 0.8);
    }
}

function paintArrow(r, dir, enabled, hot) {
    fillRect(r.x, r.y, r.w, r.h, hot ? mixRgb(COL.chipSel, COL.swap, 0.35) : COL.chip, enabled ? 1 : 0.5);
    var cx = r.x + r.w / 2;
    var cy = r.y + r.h / 2;
    setRGBA(COL.text, enabled ? 0.9 : 0.25);
    /* dir -1 points left (<), +1 points right (>) */
    mgraphics.move_to(cx - dir * 3, cy - 5);
    mgraphics.line_to(cx + dir * 3, cy);
    mgraphics.line_to(cx - dir * 3, cy + 5);
    mgraphics.close_path();
    mgraphics.fill();
}

function paintKeys(L, v) {
    var ws = winStart;
    var k;
    fillRect(L.board.x, L.board.y, L.board.w, L.board.h, COL.panel, 1);
    var sw = swapDrag();
    paintArrow(L.prev, -1, ws > 0, !!sw && drag.hover === -1);
    paintArrow(L.next, 1, ws < MAX_WIN_START, !!sw && drag.hover === 1);

    for (k = ws; k < ws + WIN_KEYS; k++) {
        if (!isBlackKey(k)) {
            paintKey(L, v, k);
        }
    }
    for (k = ws; k < ws + WIN_KEYS; k++) {
        if (isBlackKey(k)) {
            paintKey(L, v, k);
        }
    }

    /* outlines last so black keys never cover them */
    for (k = ws; k < ws + WIN_KEYS; k++) {
        if (v.keyFlags[k] & FLAG_SOUNDING) {
            strokePoly(keyPolygon(L, ws, k), COL.sounding, 1, 2);
        }
    }
    var gk = gestureKey(v);
    if (gk >= ws && gk < ws + WIN_KEYS) {
        strokePoly(keyPolygon(L, ws, gk), COL.gesture, 1, 2);
    }
    if (v.selectedKey >= ws && v.selectedKey < ws + WIN_KEYS) {
        strokePoly(keyPolygon(L, ws, v.selectedKey), COL.white, 1, 2);
    }
    if (sw) {
        if (sw.from >= ws && sw.from < ws + WIN_KEYS) {
            strokePoly(keyPolygon(L, ws, sw.from), COL.swap, 0.9, 1);
        }
        if (sw.to >= ws && sw.to < ws + WIN_KEYS) {
            strokePoly(keyPolygon(L, ws, sw.to), COL.swap, 1, 3);
        }
    }
}

/*
 * Optional status indicators in priority order: [{kind, text, short?}].
 * Absent / zero v2 fields give an empty list.
 */
function statusIndicators(v) {
    var out = [];
    if (v.morphEdit) {
        out.push({ kind: 'edit', text: 'EDIT B', short: 'B' });
    }
    if (v.morph > 0) {
        out.push({ kind: 'morph', text: 'MORPH ' + pctText(v.morph) + '%' });
    }
    if (v.scan > 0) {
        out.push({ kind: 'scan', text: 'SCAN ' + pctText(v.scan) + '%' });
    }
    if (v.gesture >= 0) {
        var tag = 'G' + (v.gesture + 1);
        var name = v.gestureNames[v.gesture];
        out.push({ kind: 'gesture', text: (name && name !== tag) ? tag + ' ' + name : tag });
    }
    return out;
}

function measure(s, px) {
    setFont(px);
    return textW(s);
}

function paintStatus(L, v) {
    var r = L.status;
    var base = r.y + r.h / 2 + 3.2;
    var right = r.x + r.w - 4;

    drawText(slotLetter(v.slot), right, base, 10, COL.white, 1, 'right');
    right -= textW(slotLetter(v.slot)) + 4;
    drawText('SLOT', right, base, 8, COL.dim, 1, 'right');
    right -= textW('SLOT') + 12;

    if (v.selectedKey >= 0) {
        var kn = noteName(v.selectedKey) + ' (' + v.selectedKey + ')';
        drawText(kn, right, base, 9, COL.text, 1, 'right');
        right -= textW(kn) + 12;
    }
    var armed = armedText(v.armed);
    if (armed) {
        drawText(armed, right, base, 9, COL.amber, 1, 'right');
        right -= textW(armed) + 12;
    }

    /*
     * Left side: EDIT B badge, MORPH, SCAN and gesture indicators, then the
     * status text in whatever room is left.  The badge is only dropped when it
     * does not fit at all (then a bare "B"); the others make way for the
     * status text once less than STATUS_MIN_TEXT px would remain for it.
     */
    var sd = swapDrag();
    var text = sd ? swapText(sd.from, sd.to) : (note || v.status);
    var left = r.x + 4;
    var inds = statusIndicators(v);
    for (var i = 0; i < inds.length; i++) {
        var ind = inds[i];
        var room = right - left - ((ind.kind === 'edit' || !text) ? 0 : STATUS_MIN_TEXT);
        if (ind.kind === 'edit') {
            var label = ind.text;
            var pw = measure(label, 8) + 10;
            if (pw > room) {
                label = ind.short;
                pw = measure(label, 8) + 10;
            }
            if (pw <= room) {
                fillRect(left, r.y + 1, pw, r.h - 2, COL.editB, 1);
                drawText(label, left + pw / 2, base, 8, COL.ink, 1, 'center');
                left += pw + 6;
            }
        } else {
            var s = ind.text;
            if (measure(s, 9) > room - 6) {
                s = (ind.kind === 'gesture' && room - 6 >= 24) ? fitText(s, room - 6, 9) : '';
            }
            if (s) {
                var col = ind.kind === 'morph' ? COL.morphTxt : (ind.kind === 'scan' ? COL.scanTxt : COL.gesture);
                drawText(s, left, base, 9, col, 1, 'left');
                left += textW(s) + 10;
            }
        }
    }
    drawText(fitText(text, right - left, 9), left, base, 9, sd ? COL.swap : (note ? COL.amber : COL.text), 1, 'left');
}

function paint() {
    syncSize();
    var L = layout;
    fontSize = -1;
    fillRect(0, 0, L.w, L.h, COL.bg, 1);
    mgraphics.select_font_face('Arial');
    paintTabs(L, view);
    paintWave(L, view);
    paintKeys(L, view);
    paintStatus(L, view);
}

/* ------------------------------------------------------------- node exports */

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        constants: {
            WIN_KEYS: WIN_KEYS,
            WIN_WHITES: WIN_WHITES,
            MAX_WIN_START: MAX_WIN_START,
            MARKER_TOL: MARKER_TOL,
            DRAG_THRESHOLD: DRAG_THRESHOLD,
            AUDITION_VEL: AUDITION_VEL,
            FLAG_MORPHB: FLAG_MORPHB,
            GESTURE_COUNT: GESTURE_COUNT,
            GESTURE_OFFSET: GESTURE_OFFSET,
            STATUS_MIN_TEXT: STATUS_MIN_TEXT,
            SWAP_THRESHOLD: SWAP_THRESHOLD,
            HOVER_MS: HOVER_MS
        },
        normalizeView: normalizeView,
        computeLayout: computeLayout,
        waveInner: waveInner,
        xToNorm: xToNorm,
        normToX: normToX,
        normToFrame: normToFrame,
        tabRects: tabRects,
        tabAt: tabAt,
        isBlackKey: isBlackKey,
        whiteIndex: whiteIndex,
        clampWinStart: clampWinStart,
        shiftedWinStart: shiftedWinStart,
        followWinStart: followWinStart,
        keyRect: keyRect,
        keyAt: keyAt,
        keyCenter: keyCenter,
        keyPolygon: keyPolygon,
        hatchSegments: hatchSegments,
        peaksForWidth: peaksForWidth,
        sliceAt: sliceAt,
        markerAt: markerAt,
        hitTest: hitTest,
        noteName: noteName,
        slotLetter: slotLetter,
        armedText: armedText,
        modLabel: modLabel,
        gestureKey: gestureKey,
        morphMarkPoly: morphMarkPoly,
        statusIndicators: statusIndicators,
        swapText: swapText,
        hexToRgb: hexToRgb,
        fitText: fitText
    };
}
