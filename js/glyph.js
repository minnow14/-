// Glyph measuring and drawing based on the actual ink bounds, so that boxes fit
// the visible shape tightly (used by both the fill mode and the free canvas).

const measureCtx = document.createElement('canvas').getContext('2d');
const cache = new Map();
const REF = 100;

/** Ink metrics at 100px for the given font spec string builder. */
export function inkMetrics(text, fontAt) {
  const key = fontAt(REF) + '|' + text;
  let m = cache.get(key);
  if (!m) {
    measureCtx.font = fontAt(REF);
    const t = measureCtx.measureText(text);
    const left = t.actualBoundingBoxLeft || 0;
    const right = t.actualBoundingBoxRight || t.width;
    const ascent = t.actualBoundingBoxAscent || REF * 0.8;
    const descent = t.actualBoundingBoxDescent || 0;
    m = { left, ascent, w: Math.max(1, left + right), h: Math.max(1, ascent + descent) };
    cache.set(key, m);
  }
  return m;
}

export function clearMetricsCache() { cache.clear(); }

/**
 * Draw `text` so its ink box spans (0,0)–(w,h) at the given pixel size.
 * Returns the ink box size.
 */
export function drawInk(ctx, text, fontAt, size, flipX = false) {
  const m = inkMetrics(text, fontAt);
  const s = size / REF;
  const w = m.w * s;
  const h = m.h * s;
  ctx.save();
  if (flipX) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.font = fontAt(size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, m.left * s, m.ascent * s);
  ctx.restore();
  return { w, h };
}

export function inkSize(text, fontAt, size) {
  const m = inkMetrics(text, fontAt);
  return { w: (m.w * size) / REF, h: (m.h * size) / REF };
}
