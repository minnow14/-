// Mode A engine: render Han characters as a mask, then fill the mask with Hangul words / jamo.
import { FONTS, fontString, ensureFont } from './fonts.js';
import { inkMetrics, drawInk } from './glyph.js';

const HAN_RE = /\p{Script=Han}/u;
export const isHan = (ch) => HAN_RE.test(ch);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Choose the grid (cols × rows) that gives the largest square cell. */
function bestGrid(n, aw, ah) {
  let best = { cols: 1, rows: n, cell: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cell = Math.min(aw / cols, ah / rows);
    if (cell > best.cell + 0.5) best = { cols, rows, cell };
  }
  return best;
}

/** Layout of each Han glyph: font size and ink-box origin. */
function layoutHan(chars, W, H, hanFontAt) {
  const pad = W * 0.06;
  const { cols, rows, cell } = bestGrid(chars.length, W - pad * 2, H - pad * 2);
  return {
    cell,
    glyphs: chars.map((ch, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, chars.length - row * cols);
      const col = i % cols;
      const cx = W / 2 + (col - (inRow - 1) / 2) * cell;
      const cy = H / 2 + (row - (rows - 1) / 2) * cell;
      const m = inkMetrics(ch, hanFontAt);
      const size = (100 * cell * 0.94) / Math.max(m.w, m.h);
      const s = size / 100;
      return { ch, size, x: cx - (m.w * s) / 2, y: cy - (m.h * s) / 2 };
    }),
  };
}

export const hanSpecFor = (maskFont) => (maskFont === 'serif' ? FONTS.hanSerif : FONTS.hanSans);

/**
 * Draw Han characters as a tracing guide, using the same layout as the fill mask.
 * guide: { text, maskFont, style: 'fill' | 'outline', color, alpha }
 */
export function drawHanGuide(ctx, W, H, guide) {
  const chars = Array.from(guide.text || '').filter(isHan).slice(0, 4);
  if (!chars.length) return;
  const hanFontAt = (px) => fontString(hanSpecFor(guide.maskFont), px);
  const { glyphs } = layoutHan(chars, W, H, hanFontAt);
  ctx.save();
  ctx.globalAlpha = guide.alpha;
  ctx.fillStyle = guide.color;
  ctx.strokeStyle = guide.color;
  ctx.lineWidth = Math.max(2, W / 270);
  ctx.lineJoin = 'round';
  for (const g of glyphs) {
    const m = inkMetrics(g.ch, hanFontAt);
    const s = g.size / 100;
    ctx.font = hanFontAt(g.size);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const x = g.x + m.left * s;
    const y = g.y + m.ascent * s;
    if (guide.style === 'outline') ctx.strokeText(g.ch, x, y);
    else ctx.fillText(g.ch, x, y);
  }
  ctx.restore();
}

/** Fonts needed to render these options. Call before renderFill. */
export async function prepareFill(opts) {
  const han = hanSpecFor(opts.maskFont);
  const koText = [...opts.words, ...opts.jamo].join('') || '가';
  await Promise.all([ensureFont(han, opts.hanzi || '愛'), ensureFont(FONTS.koFill, koText)]);
}

/**
 * Render the artwork onto `canvas` (its width/height define output size).
 * opts: { hanzi, maskFont, words[], jamo[], material, density(1-10),
 *         sizeMode, rotate, outline, fg, bg, seed }
 * Returns { placed, empty } where empty means there was nothing to fill with.
 */
export function renderFill(canvas, opts) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, W, H);

  const chars = Array.from(opts.hanzi || '').filter(isHan).slice(0, 4);
  if (!chars.length) return { placed: 0, empty: true };

  const hanSpec = hanSpecFor(opts.maskFont);
  const hanFontAt = (px) => fontString(hanSpec, px);
  const koFontAt = (px) => fontString(FONTS.koFill, px);
  const { glyphs } = layoutHan(chars, W, H, hanFontAt);

  // 1. Mask: draw the Han glyphs and sample them onto a coarse grid.
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.fillStyle = '#000';
  for (const g of glyphs) {
    mctx.save();
    mctx.translate(g.x, g.y);
    drawInk(mctx, g.ch, hanFontAt, g.size);
    mctx.restore();
  }
  const g = Math.max(2, Math.round(W / 270)); // grid step in px
  const gw = Math.ceil(W / g);
  const gh = Math.ceil(H / g);
  const alpha = mctx.getImageData(0, 0, W, H).data;
  const inside = new Uint8Array(gw * gh);
  const insideList = [];
  for (let gy = 0; gy < gh; gy++) {
    const py = Math.min(H - 1, gy * g + (g >> 1));
    for (let gx = 0; gx < gw; gx++) {
      const px = Math.min(W - 1, gx * g + (g >> 1));
      if (alpha[(py * W + px) * 4 + 3] > 127) {
        inside[gy * gw + gx] = 1;
        insideList.push(gy * gw + gx);
      }
    }
  }

  // Optional outline of the Han glyphs underneath.
  if (opts.outline) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = opts.fg;
    ctx.lineWidth = Math.max(1, W / 540);
    for (const gl of glyphs) {
      const m = inkMetrics(gl.ch, hanFontAt);
      const s = gl.size / 100;
      ctx.font = hanFontAt(gl.size);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.strokeText(gl.ch, gl.x + m.left * s, gl.y + m.ascent * s);
    }
    ctx.restore();
  }

  // 2. Token pools.
  const words = opts.material === 'jamo' ? [] : opts.words.filter(Boolean);
  const jamo = opts.material === 'word' ? [] : opts.jamo.filter(Boolean);
  if (!words.length && !jamo.length) return { placed: 0, empty: true };
  const rand = rng(opts.seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const nextToken = () => {
    if (!words.length) return pick(jamo);
    if (!jamo.length) return pick(words);
    return rand() < 0.5 ? pick(words) : pick(jamo);
  };

  // 3. Token size follows stroke thickness (≈ 2 × area / perimeter of the mask),
  //    so strokes hold several rows of text and the character stays readable.
  let perimeter = 0;
  for (const idx of insideList) {
    const gx = idx % gw;
    const gy = (idx - gx) / gw;
    if (gx === 0 || gy === 0 || gx === gw - 1 || gy === gh - 1
      || !inside[idx - 1] || !inside[idx + 1] || !inside[idx - gw] || !inside[idx + gw]) perimeter++;
  }
  const stroke = Math.max(g * 3, ((2 * insideList.length) / Math.max(1, perimeter)) * g);
  const t = (Math.min(10, Math.max(1, opts.density)) - 1) / 9;
  const base = stroke * (0.62 - 0.44 * t); // target ink height
  const phases = opts.sizeMode === 'random'
    ? [1.35, 1.05, 0.82, 0.64, 0.5, 0.39, 0.3, 0.23]
    : [0.5];
  const occupied = new Uint8Array(gw * gh);
  const placed = [];
  const insideArea = insideList.length * g * g;

  const fits = (cx, cy, w, h, cos, sin, gap) => {
    const hw = w / 2 + gap;
    const hh = h / 2 + gap;
    const step = g * 1.2;
    let total = 0;
    let out = 0;
    for (let v = -hh; v <= hh; v += step) {
      for (let u = -hw; u <= hw; u += step) {
        const x = cx + u * cos - v * sin;
        const y = cy + u * sin + v * cos;
        const gx = Math.floor(x / g);
        const gy = Math.floor(y / g);
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return false;
        const idx = gy * gw + gx;
        if (occupied[idx]) return false;
        total++;
        // Allow a little spill outside the stroke for an organic edge, but only for the ink box.
        if (!inside[idx] && Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2) {
          out++;
          if (out > total * 0.03 + 1) return false;
        }
      }
    }
    return true;
  };

  const mark = (cx, cy, w, h, cos, sin, gap) => {
    const hw = w / 2 + gap;
    const hh = h / 2 + gap;
    const step = g * 0.7;
    for (let v = -hh; v <= hh; v += step) {
      for (let u = -hw; u <= hw; u += step) {
        const gx = Math.floor((cx + u * cos - v * sin) / g);
        const gy = Math.floor((cy + u * sin + v * cos) / g);
        if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) occupied[gy * gw + gx] = 1;
      }
    }
  };

  for (const mult of phases) {
    const inkAvg = base * mult;
    const attempts = Math.min(20000, Math.max(600, Math.round((insideArea / (inkAvg * inkAvg)) * 7)));
    for (let i = 0; i < attempts; i++) {
      const token = nextToken();
      const inkH = opts.sizeMode === 'random' ? inkAvg * (0.85 + rand() * 0.3) : inkAvg;
      const m = inkMetrics(token, koFontAt);
      const size = (inkH * 100) / m.h; // font size giving that ink height
      const w = (m.w * size) / 100;
      const h = inkH;
      let angle = 0;
      if (opts.rotate === 'random') {
        angle = pick([0, 0, 90, -90]) + (rand() - 0.5) * 24;
      }
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cellIdx = insideList[Math.floor(rand() * insideList.length)];
      const cx = (cellIdx % gw) * g + rand() * g;
      const cy = Math.floor(cellIdx / gw) * g + rand() * g;
      const gap = Math.max(g * 0.3, inkH * 0.04);
      if (!fits(cx, cy, w, h, cos, sin, gap * 0.5)) continue;
      mark(cx, cy, w, h, cos, sin, gap * 0.5);
      placed.push({ token, size, cx, cy, w, h, rad });
    }
  }

  // 4. Draw tokens.
  ctx.fillStyle = opts.fg;
  for (const p of placed) {
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.rotate(p.rad);
    ctx.translate(-p.w / 2, -p.h / 2);
    drawInk(ctx, p.token, koFontAt, p.size);
    ctx.restore();
  }
  return { placed: placed.length, empty: false };
}
