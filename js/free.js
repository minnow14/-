// Mode B: free canvas. Jamo are placed, moved, scaled (non-uniformly), rotated and flipped.
// The document model is a plain snapshot; Konva is only used for on-screen editing.
// Export and thumbnails use renderSnapshot(), which draws the same ink boxes.
/* global Konva */
import { FONTS, fontString } from './fonts.js';
import { inkSize, drawInk } from './glyph.js';
import { drawHanGuide } from './fill.js';
import { isDark } from './ui.js';

export const BASE_SIZE = 300;
export const LOGICAL_W = 1080;
const koFontAt = (px) => fontString(FONTS.ko, px);

export function ratioHeight(ratio) {
  return ratio === '4:5' ? 1350 : 1080;
}

/** Guide ink: white on dark backgrounds, black on light ones (drawn with low alpha). */
export const guideColor = (bg) => (isDark(bg) ? '#ffffff' : '#000000');

/**
 * Draw a snapshot { bg, items[] } at W×H (logical width is 1080).
 * If `guide` is given (and has text), it is drawn under the jamo.
 */
export function renderSnapshot(canvas, snap, guide = null) {
  const W = canvas.width;
  const H = canvas.height;
  const k = W / LOGICAL_W;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = snap.bg;
  ctx.fillRect(0, 0, W, H);
  if (guide && guide.text) drawHanGuide(ctx, W, H, { ...guide, color: guideColor(snap.bg) });
  for (const it of snap.items) {
    const { w, h } = inkSize(it.ch, koFontAt, BASE_SIZE);
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(it.x, it.y);
    ctx.rotate((it.rotation * Math.PI) / 180);
    ctx.scale(it.scaleX, it.scaleY);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = it.fill;
    drawInk(ctx, it.ch, koFontAt, BASE_SIZE, it.flipX);
    ctx.restore();
  }
}

function makeNode(it) {
  const { w, h } = inkSize(it.ch, koFontAt, BASE_SIZE);
  const node = new Konva.Shape({
    x: it.x, y: it.y, rotation: it.rotation, scaleX: it.scaleX, scaleY: it.scaleY,
    width: w, height: h, offsetX: w / 2, offsetY: h / 2,
    fill: it.fill, draggable: true, name: 'jamo',
    sceneFunc(context, shape) {
      const c = context._context;
      c.fillStyle = shape.fill();
      drawInk(c, shape.getAttr('ch'), koFontAt, BASE_SIZE, shape.getAttr('flipX'));
    },
    hitFunc(context, shape) {
      context.beginPath();
      context.rect(0, 0, shape.width(), shape.height());
      context.closePath();
      context.fillStrokeShape(shape);
    },
  });
  node.setAttr('ch', it.ch);
  node.setAttr('flipX', !!it.flipX);
  return node;
}

function nodeToItem(n) {
  return {
    ch: n.getAttr('ch'), x: n.x(), y: n.y(), rotation: n.rotation(),
    scaleX: n.scaleX(), scaleY: n.scaleY(), fill: n.fill(), flipX: !!n.getAttr('flipX'),
  };
}

export class FreeCanvas {
  constructor(host, { onChange, onSelect } = {}) {
    this.host = host;
    this.onChange = onChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.ratio = '1:1';
    this.bg = '#ffffff';
    this.history = [];
    this.future = [];

    this.stage = new Konva.Stage({ container: host, width: 300, height: 300 });
    this.bgLayer = new Konva.Layer({ listening: false });
    this.bgRect = new Konva.Rect({ x: 0, y: 0, width: LOGICAL_W, height: 1080, fill: this.bg });
    // Tracing guide: not part of the document history, redrawn when text/ratio/bg change.
    this.guide = { text: '', maskFont: 'sans', style: 'fill', alpha: 0.18, include: false };
    this.guideCanvas = document.createElement('canvas');
    this.guideImage = new Konva.Image({ x: 0, y: 0, image: this.guideCanvas, width: LOGICAL_W, height: 1080, visible: false });
    this.bgLayer.add(this.bgRect, this.guideImage);
    this.layer = new Konva.Layer();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    this.tr = new Konva.Transformer({
      keepRatio: false,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 4,
      anchorSize: touch ? 22 : 12,
      anchorStroke: '#000', anchorFill: '#fff', anchorStrokeWidth: 1,
      borderStroke: '#888', borderStrokeWidth: 1, borderDash: [4, 3],
      rotateAnchorOffset: touch ? 36 : 28,
      padding: 4,
      ignoreStroke: true,
      flipEnabled: false,
    });
    this.layer.add(this.tr);
    this.stage.add(this.bgLayer, this.layer);

    this.stage.on('click tap', (e) => {
      if (e.target === this.stage || !e.target.hasName('jamo')) this.select(null);
      else this.select(e.target);
    });
    this.stage.on('dragstart', (e) => { if (e.target.hasName('jamo')) this.select(e.target); });
    this.layer.on('dragend transformend', () => { this.commit(); this.onSelect(this.selected()); });
    this.layer.on('transform', () => this.onSelect(this.selected()));

    new ResizeObserver(() => this.fit()).observe(host);
    this.fit();
    this.commit(true);
  }

  // ---- geometry ----
  logicalH() { return ratioHeight(this.ratio); }
  fit() {
    const w = this.host.clientWidth;
    if (!w) return;
    const k = w / LOGICAL_W;
    this.stage.size({ width: w, height: Math.round(this.logicalH() * k) });
    this.stage.scale({ x: k, y: k });
  }

  // ---- model ----
  nodes() { return this.layer.find('.jamo'); }
  snapshot() {
    return { ratio: this.ratio, bg: this.bg, items: this.nodes().map(nodeToItem) };
  }
  load(snap, { record = true } = {}) {
    this.select(null);
    this.nodes().forEach((n) => n.destroy());
    if (snap.ratio) this.ratio = snap.ratio;
    this.bgRect.height(this.logicalH());
    this.setBg(snap.bg, { record: false });
    for (const it of snap.items) this.layer.add(makeNode(it));
    this.tr.moveToTop();
    this.fit();
    this.layer.batchDraw();
    if (record) this.commit();
    else this.onChange();
  }
  commit(initial = false) {
    const s = JSON.stringify(this.snapshot());
    if (this.history[this.history.length - 1] === s) return;
    this.history.push(s);
    if (this.history.length > 100) this.history.shift();
    if (!initial) this.future = [];
    this.onChange();
  }
  canUndo() { return this.history.length > 1; }
  canRedo() { return this.future.length > 0; }
  undo() {
    if (!this.canUndo()) return;
    this.future.push(this.history.pop());
    this.load(JSON.parse(this.history[this.history.length - 1]), { record: false });
  }
  redo() {
    if (!this.canRedo()) return;
    const s = this.future.pop();
    this.history.push(s);
    this.load(JSON.parse(s), { record: false });
  }
  isEmpty() { return this.nodes().length === 0; }

  // ---- selection ----
  selected() { return this.tr.nodes()[0] || null; }
  select(node) {
    this.tr.nodes(node ? [node] : []);
    if (node) this.tr.moveToTop();
    this.layer.batchDraw();
    this.onSelect(node);
  }

  // ---- actions ----
  add(ch, fill) {
    const n = this.nodes().length;
    const jitter = (n % 5) * 24;
    const node = makeNode({
      ch, x: LOGICAL_W / 2 + jitter, y: this.logicalH() / 2 + jitter,
      rotation: 0, scaleX: 1, scaleY: 1, fill, flipX: false,
    });
    this.layer.add(node);
    this.select(node);
    this.commit();
  }
  duplicate() {
    const s = this.selected();
    if (!s) return;
    const it = nodeToItem(s);
    const node = makeNode({ ...it, x: it.x + 40, y: it.y + 40 });
    this.layer.add(node);
    this.select(node);
    this.commit();
  }
  remove() {
    const s = this.selected();
    if (!s) return;
    this.select(null);
    s.destroy();
    this.commit();
  }
  flip() {
    const s = this.selected();
    if (!s) return;
    s.setAttr('flipX', !s.getAttr('flipX'));
    this.layer.batchDraw();
    this.commit();
  }
  forward() {
    const s = this.selected();
    if (!s) return;
    const all = this.nodes();
    if (all.indexOf(s) < all.length - 1) { s.moveUp(); this.tr.moveToTop(); this.commit(); }
  }
  backward() {
    const s = this.selected();
    if (!s) return;
    if (this.nodes().indexOf(s) > 0) { s.moveDown(); this.commit(); }
  }
  clear() {
    if (this.isEmpty()) return;
    this.select(null);
    this.nodes().forEach((n) => n.destroy());
    this.layer.batchDraw();
    this.commit();
  }
  nudge(dx, dy) {
    const s = this.selected();
    if (!s) return;
    s.position({ x: s.x() + dx, y: s.y() + dy });
    this.layer.batchDraw();
    this.commit();
  }
  setFill(color) {
    const s = this.selected();
    if (!s) return;
    s.fill(color);
    this.layer.batchDraw();
    this.commit();
  }
  /** Uniform size multiplier, keeps the current stretch ratio. */
  setSize(v, record) {
    const s = this.selected();
    if (!s) return;
    const cur = Math.max(Math.abs(s.scaleX()), Math.abs(s.scaleY())) || 1;
    const f = v / cur;
    s.scale({ x: s.scaleX() * f, y: s.scaleY() * f });
    this.layer.batchDraw();
    if (record) this.commit();
  }
  setRotation(deg, record) {
    const s = this.selected();
    if (!s) return;
    s.rotation(deg);
    this.layer.batchDraw();
    if (record) this.commit();
  }
  setBg(color, { record = true } = {}) {
    this.bg = color;
    this.bgRect.fill(color);
    this.drawGuide();
    if (record) this.commit();
  }

  // ---- tracing guide ----
  /** Update guide settings (fonts for the text must already be loaded). */
  setGuide(patch) {
    Object.assign(this.guide, patch);
    this.drawGuide();
  }
  hasGuide() { return !!this.guide.text; }
  drawGuide() {
    const H = this.logicalH();
    const c = this.guideCanvas;
    if (c.width !== LOGICAL_W) c.width = LOGICAL_W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_W, H);
    if (this.guide.text) drawHanGuide(ctx, LOGICAL_W, H, { ...this.guide, color: guideColor(this.bg) });
    this.guideImage.size({ width: LOGICAL_W, height: H });
    this.guideImage.visible(!!this.guide.text);
    this.guideImage.image(c);
    this.bgLayer.batchDraw();
  }
  /** Change ratio and shift items so the composition stays vertically centred. */
  setRatio(ratio) {
    if (ratio === this.ratio) return;
    const dy = (ratioHeight(ratio) - this.logicalH()) / 2;
    this.ratio = ratio;
    this.nodes().forEach((n) => n.y(n.y() + dy));
    this.bgRect.height(this.logicalH());
    this.drawGuide();
    this.fit();
    this.layer.batchDraw();
    this.commit();
  }
}
