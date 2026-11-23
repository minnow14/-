// App shell: routing, home page, and wiring of both editor modes.
import { CONSONANTS, VOWELS, ALL_JAMO, JAMO_INFO, uniqueJamo, decompose } from './jamo.js';
import { FONTS, ensureFont } from './fonts.js';
import { clearMetricsCache } from './glyph.js';
import { renderFill, prepareFill, isHan } from './fill.js';
import { FreeCanvas, renderSnapshot, ratioHeight } from './free.js';
import { initShare } from './share.js';
import { bi, setSeg, bindSeg, buildSwatches, isDark } from './ui.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const newSeed = () => Math.floor(Math.random() * 1e9);
const parseWords = (s) => s.split(/[\s,，、]+/).filter(Boolean);

// ---------------------------------------------------------------- examples
const FILL_DEFAULT = {
  hanzi: '愛', maskFont: 'sans', words: '사랑', jamo: ['ㄹ', 'ㅅ', 'ㅇ', 'ㅏ'],
  material: 'mix', density: 6, sizeMode: 'random', rotate: 'none', outline: false,
  fg: '#000000', bg: '#ffffff', ratio: '1:1', seed: 20260,
};

const EXAMPLES = [
  {
    mode: 'fill',
    title: ['「愛」用 사랑 填滿', '愛를 ‘사랑’으로 채우기'],
    state: { ...FILL_DEFAULT },
  },
  {
    mode: 'fill',
    title: ['「福」用 복 填滿', '福을 ‘복’으로 채우기'],
    state: { ...FILL_DEFAULT, hanzi: '福', words: '복', jamo: uniqueJamo('복'), density: 6, fg: '#000000', bg: '#d7261e', seed: 3108 },
  },
  {
    mode: 'fill',
    title: ['「台灣」用 대만 填滿', '台灣을 ‘대만’으로 채우기'],
    state: { ...FILL_DEFAULT, hanzi: '台灣', maskFont: 'serif', words: '대만', jamo: uniqueJamo('대만'), density: 7, rotate: 'random', fg: '#ffffff', bg: '#000000', seed: 886 },
  },
  {
    mode: 'free',
    title: ['用三個 ㅁ 拼出「品」', 'ㅁ 세 개로 品 만들기'],
    jamo: 'ㅁ ㅁ ㅁ',
    snapshot: {
      ratio: '1:1', bg: '#000000',
      items: [
        { ch: 'ㅁ', x: 540, y: 330, rotation: 0, scaleX: 1.55, scaleY: 1.2, fill: '#ffffff', flipX: false },
        { ch: 'ㅁ', x: 318, y: 765, rotation: 0, scaleX: 1.3, scaleY: 1.35, fill: '#ffffff', flipX: false },
        { ch: 'ㅁ', x: 762, y: 765, rotation: 0, scaleX: 1.3, scaleY: 1.35, fill: '#ffffff', flipX: false },
      ],
    },
  },
];

function fillOpts(st) {
  return {
    hanzi: st.hanzi, maskFont: st.maskFont, words: parseWords(st.words), jamo: st.jamo,
    material: st.material, density: st.density, sizeMode: st.sizeMode, rotate: st.rotate,
    outline: st.outline, fg: st.fg, bg: st.bg, seed: st.seed,
  };
}

function setWrapRatio(wrap, ratio) {
  const [w, h] = ratio.split(':');
  wrap.style.setProperty('--arw', w);
  wrap.style.setProperty('--arh', h);
}

// ---------------------------------------------------------------- home
async function initHome(startExample) {
  const heroCanvas = $('#hero-canvas');
  const hero = { ...FILL_DEFAULT };
  prepareFill(fillOpts(hero)).then(() => renderFill(heroCanvas, fillOpts(hero)));

  const wrap = $('#examples');
  for (const ex of EXAMPLES) {
    const card = document.createElement('article');
    card.className = 'ex-card';
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 540;
    const jamoText = ex.jamo || decompose(ex.state.words).join(' ');
    card.innerHTML = `
      <div class="ex-body">
        <span class="ex-tag">${ex.mode === 'fill' ? 'A' : 'B'}</span>
        <span class="ex-title">${bi(ex.title[0], ex.title[1])}</span>
        <span class="ex-jamo" lang="ko">${jamoText}</span>
        <button type="button" class="btn btn-line">${bi('用這個開始', '이 예시로 시작')}</button>
      </div>`;
    card.prepend(canvas);
    canvas.setAttribute('aria-label', ex.title.join(' / '));
    $('button', card).addEventListener('click', () => startExample(ex));
    wrap.appendChild(card);

    if (ex.mode === 'fill') {
      prepareFill(fillOpts(ex.state)).then(() => renderFill(canvas, fillOpts(ex.state)));
    } else {
      ensureFont(FONTS.ko, ex.jamo).then(() => renderSnapshot(canvas, ex.snapshot));
    }
  }
}

// ---------------------------------------------------------------- mode A
function initFill() {
  const st = clone(FILL_DEFAULT);
  let jamoManual = false;
  const canvas = $('#fill-canvas');
  const wrap = $('#fill-wrap');
  const loading = $('#fill-loading');
  const note = $('#fill-note');
  const hanziIn = $('#fill-hanzi');
  const hanziHint = $('#fill-hanzi-hint');
  const wordsIn = $('#fill-words');
  const density = $('#fill-density');
  const outline = $('#fill-outline');
  const segs = {
    ratio: $('[data-control="fill-ratio"]'),
    maskFont: $('[data-control="fill-font"]'),
    material: $('[data-control="fill-material"]'),
    sizeMode: $('[data-control="fill-size"]'),
    rotate: $('[data-control="fill-rotate"]'),
  };

  // Jamo chips
  const chipsEl = $('#fill-jamo');
  const chips = {};
  const addChip = (j) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = j.ch;
    b.title = `${j.ch} ${j.ko} · ${j.rom}`;
    b.addEventListener('click', () => {
      jamoManual = true;
      const set = new Set(st.jamo);
      if (set.has(j.ch)) set.delete(j.ch); else set.add(j.ch);
      st.jamo = ALL_JAMO.map((x) => x.ch).filter((c) => set.has(c));
      syncChips();
      schedule();
    });
    chips[j.ch] = b;
    chipsEl.appendChild(b);
  };
  CONSONANTS.forEach(addChip);
  const gap = document.createElement('span');
  gap.className = 'chip-gap';
  chipsEl.appendChild(gap);
  VOWELS.forEach(addChip);
  const syncChips = () => {
    const set = new Set(st.jamo);
    for (const [ch, b] of Object.entries(chips)) b.setAttribute('aria-pressed', String(set.has(ch)));
  };

  const fg = buildSwatches($('[data-swatches="fill-fg"]'), { value: st.fg, label: '文字顏色 / 글자색', onChange: (c) => { st.fg = c; schedule(); } });
  const bg = buildSwatches($('[data-swatches="fill-bg"]'), { value: st.bg, label: '背景顏色 / 배경색', onChange: (c) => { st.bg = c; schedule(); } });

  function syncMaterialFields() {
    $$('[data-show-for]', $('#view-fill')).forEach((el) => {
      el.hidden = !el.dataset.showFor.split(' ').includes(st.material);
    });
  }

  function syncUI() {
    hanziIn.value = st.hanzi;
    wordsIn.value = st.words;
    density.value = st.density;
    outline.checked = st.outline;
    for (const [k, seg] of Object.entries(segs)) setSeg(seg, st[k]);
    syncChips();
    fg.set(st.fg);
    bg.set(st.bg);
    syncMaterialFields();
    setWrapRatio(wrap, st.ratio);
    hanziHint.hidden = true;
  }

  // Rendering (debounced, latest call wins)
  let token = 0;
  let timer;
  async function render() {
    const my = ++token;
    const opts = fillOpts(st);
    const slow = setTimeout(() => { if (my === token) loading.hidden = false; }, 250);
    await prepareFill(opts);
    clearTimeout(slow);
    if (my !== token) return;
    loading.hidden = true;
    const H = ratioHeight(st.ratio);
    if (canvas.height !== H) canvas.height = H;
    const res = renderFill(canvas, opts);
    const n = Array.from(st.hanzi).length;
    if (!n) note.innerHTML = bi('請輸入漢字', '한자를 입력하세요');
    else if (res.empty) note.innerHTML = bi('請輸入單字或選擇字母', '단어를 입력하거나 자모를 고르세요');
    else if (n >= 3) note.innerHTML = bi('字數越多，每個字越小', '글자가 많을수록 작아져요');
    else note.innerHTML = '';
    note.hidden = !note.innerHTML;
  }
  function schedule(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(render, delay);
  }

  // IME-safe text inputs (Zhuyin / Cangjie for Han, 2-set for Hangul)
  const imeInput = (el, handler) => {
    let composing = false;
    el.addEventListener('compositionstart', () => { composing = true; });
    el.addEventListener('compositionend', () => { composing = false; handler(); });
    el.addEventListener('input', (e) => { if (!composing && !e.isComposing) handler(); });
  };
  imeInput(hanziIn, () => {
    const raw = Array.from(hanziIn.value);
    const han = raw.filter(isHan);
    const kept = han.slice(0, 4);
    let warn = '';
    if (han.length < raw.length) warn = bi('只能輸入漢字', '한자만 입력할 수 있어요');
    else if (han.length > 4) warn = bi('最多 4 個字', '최대 4자까지 가능해요');
    hanziHint.innerHTML = warn;
    hanziHint.classList.toggle('is-warn', !!warn);
    hanziHint.hidden = !warn;
    if (kept.join('') !== hanziIn.value) hanziIn.value = kept.join('');
    st.hanzi = kept.join('');
    schedule();
  });
  imeInput(wordsIn, () => {
    st.words = wordsIn.value;
    if (!jamoManual) { st.jamo = uniqueJamo(st.words); syncChips(); }
    schedule();
  });

  bindSeg(segs.ratio, (v) => { st.ratio = v; setWrapRatio(wrap, v); schedule(0); });
  bindSeg(segs.maskFont, (v) => { st.maskFont = v; schedule(0); });
  bindSeg(segs.material, (v) => { st.material = v; syncMaterialFields(); schedule(0); });
  bindSeg(segs.sizeMode, (v) => { st.sizeMode = v; schedule(0); });
  bindSeg(segs.rotate, (v) => { st.rotate = v; schedule(0); });
  density.addEventListener('input', () => { st.density = +density.value; schedule(); });
  outline.addEventListener('change', () => { st.outline = outline.checked; schedule(0); });
  $('#fill-shuffle').addEventListener('click', () => { st.seed = newSeed(); schedule(0); });
  $('#fill-invert').addEventListener('click', () => {
    [st.fg, st.bg] = [st.bg, st.fg];
    fg.set(st.fg);
    bg.set(st.bg);
    schedule(0);
  });

  // Mobile tabs
  const tabs = $('[data-tabs="fill"]');
  const showTab = (name) => {
    $$('.tab', tabs).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('[data-panel]', $('#view-fill')).forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
  };
  tabs.addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); });
  showTab('hanzi');

  syncUI();

  return {
    render,
    load(state) {
      Object.assign(st, clone(state), { ratio: '1:1' });
      jamoManual = true;
      syncUI();
      schedule(0);
    },
    shareProvider: {
      name: () => st.hanzi,
      getRatio: () => st.ratio,
      async setRatio(v) { st.ratio = v; setSeg(segs.ratio, v); setWrapRatio(wrap, v); await render(); },
      async render() { await render(); return canvas; },
    },
  };
}

// ---------------------------------------------------------------- mode B
async function initFree() {
  const wrap = $('#free-wrap');
  const loading = $('#free-loading');
  const empty = $('#free-empty');
  const props = $('#free-props');
  const sizeIn = $('#free-size');
  const rotIn = $('#free-rot');
  const rotOut = $('#free-rot-out');
  const ratioSeg = $('[data-control="free-ratio"]');
  const paletteSeg = $('[data-control="free-palette"]');
  const palette = $('#free-palette');
  const tip = $('#jamo-tip');
  let color = '#000000';

  loading.hidden = false;
  await ensureFont(FONTS.ko, ALL_JAMO.map((j) => j.ch).join(''));
  clearMetricsCache();
  loading.hidden = true;

  let fc;
  const fgSw = buildSwatches($('[data-swatches="free-fg"]'), {
    value: color, label: '顏色 / 색상',
    onChange: (c, live) => {
      color = c;
      const s = fc.selected();
      if (!s) return;
      if (live) { s.fill(c); fc.layer.batchDraw(); } else fc.setFill(c);
    },
  });
  const bgSw = buildSwatches($('[data-swatches="free-bg"]'), {
    value: '#ffffff', label: '背景 / 배경',
    onChange: (c, live) => {
      // Keep new jamo visible: flip the default black/white ink when the background flips.
      if (isDark(c) && color === '#000000') color = '#ffffff';
      if (!isDark(c) && color === '#ffffff') color = '#000000';
      fc.setBg(c, { record: !live });
    },
  });

  const toolbar = $('#view-free .toolbar');
  function syncTools() {
    const sel = !!fc.selected();
    $$('[data-needs-sel]', toolbar).forEach((b) => { b.disabled = !sel; });
    $('[data-act="undo"]', toolbar).disabled = !fc.canUndo();
    $('[data-act="redo"]', toolbar).disabled = !fc.canRedo();
    $('[data-act="clear"]', toolbar).disabled = fc.isEmpty();
  }
  function onChange() {
    empty.hidden = !fc.isEmpty();
    empty.classList.toggle('on-dark', isDark(fc.bg));
    setSeg(ratioSeg, fc.ratio);
    setWrapRatio(wrap, fc.ratio);
    bgSw.set(fc.bg);
    syncTools();
  }
  function onSelect(node) {
    props.hidden = !node;
    if (node) {
      fgSw.set(node.fill());
      sizeIn.value = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
      let r = Math.round(node.rotation()) % 360;
      if (r > 180) r -= 360;
      if (r < -180) r += 360;
      rotIn.value = r;
      rotOut.textContent = `${r}°`;
    }
    if (fc) syncTools();
  }

  fc = new FreeCanvas($('#free-stage'), { onChange: () => fc && onChange(), onSelect });
  onChange();

  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'clear') {
      if (!window.confirm('清除全部？ / 전체 지울까요?')) return;
    }
    ({ undo: () => fc.undo(), redo: () => fc.redo(), duplicate: () => fc.duplicate(), flip: () => fc.flip(),
      forward: () => fc.forward(), backward: () => fc.backward(), delete: () => fc.remove(), clear: () => fc.clear() })[act]();
  });

  sizeIn.addEventListener('input', () => fc.setSize(+sizeIn.value, false));
  sizeIn.addEventListener('change', () => fc.setSize(+sizeIn.value, true));
  rotIn.addEventListener('input', () => { rotOut.textContent = `${rotIn.value}°`; fc.setRotation(+rotIn.value, false); });
  rotIn.addEventListener('change', () => fc.setRotation(+rotIn.value, true));
  bindSeg(ratioSeg, (v) => fc.setRatio(v));

  // Palette with long-press name tooltip
  function buildPalette(kind) {
    palette.innerHTML = '';
    for (const j of kind === 'v' ? VOWELS : CONSONANTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pal-key';
      b.textContent = j.ch;
      b.title = `${j.ch} ${j.ko} · ${j.rom}`;
      b.setAttribute('aria-label', `${j.ch} ${j.ko} ${j.rom}`);
      palette.appendChild(b);
    }
  }
  let pressTimer;
  let longPressed = false;
  const hideTip = () => { tip.hidden = true; };
  palette.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.pal-key');
    if (!b) return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      const j = JAMO_INFO[b.textContent];
      const r = b.getBoundingClientRect();
      tip.innerHTML = `<b>${j.ch}</b><span lang="ko">${j.ko}</span> · ${j.rom}`;
      tip.style.left = `${r.left + r.width / 2}px`;
      tip.style.top = `${r.top}px`;
      tip.hidden = false;
      longPressed = true;
    }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => palette.addEventListener(ev, () => {
    clearTimeout(pressTimer);
    if (longPressed) setTimeout(hideTip, 900);
  }));
  palette.addEventListener('contextmenu', (e) => e.preventDefault());
  palette.addEventListener('click', (e) => {
    const b = e.target.closest('.pal-key');
    if (!b) return;
    if (longPressed) { longPressed = false; return; }
    fc.add(b.textContent, color);
  });
  bindSeg(paletteSeg, buildPalette);
  setSeg(paletteSeg, 'c');
  buildPalette('c');

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (currentRoute !== 'free' || e.target.closest('input, textarea, dialog[open]')) return;
    const mod = e.metaKey || e.ctrlKey;
    const step = e.shiftKey ? 10 : 2;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) fc.redo(); else fc.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); fc.redo(); }
    else if (mod && k === 'd') { e.preventDefault(); fc.duplicate(); }
    else if (!fc.selected()) return;
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); fc.remove(); }
    else if (k === 'arrowleft') { e.preventDefault(); fc.nudge(-step, 0); }
    else if (k === 'arrowright') { e.preventDefault(); fc.nudge(step, 0); }
    else if (k === 'arrowup') { e.preventDefault(); fc.nudge(0, -step); }
    else if (k === 'arrowdown') { e.preventDefault(); fc.nudge(0, step); }
    else if (k === 'escape') fc.select(null);
  });

  return {
    fc,
    fit: () => fc.fit(),
    load(snap) { fc.load(clone(snap)); color = isDark(snap.bg) ? '#ffffff' : '#000000'; },
    shareProvider: {
      name: () => 'free',
      getRatio: () => fc.ratio,
      async setRatio(v) { fc.setRatio(v); },
      async render() {
        const c = document.createElement('canvas');
        c.width = 1080;
        c.height = ratioHeight(fc.ratio);
        renderSnapshot(c, fc.snapshot());
        return c;
      },
    },
  };
}

// ---------------------------------------------------------------- routing
let currentRoute = null;
let fillMode = null;
let freeModePromise = null;
let pendingFreeSnapshot = null;

const getFree = () => {
  if (!freeModePromise) freeModePromise = initFree();
  return freeModePromise;
};

async function route() {
  const h = location.hash;
  const r = h.startsWith('#/fill') ? 'fill' : h.startsWith('#/free') ? 'free' : 'home';
  const changed = r !== currentRoute;
  currentRoute = r;
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== r; });
  $('#editor-header').hidden = r === 'home';
  $$('.mode-tabs .seg-item').forEach((a) => {
    const on = a.dataset.route === r;
    a.classList.toggle('is-current', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (changed && r !== 'home') window.scrollTo(0, 0);
  if (r === 'fill') fillMode.render();
  if (r === 'free') {
    const free = await getFree();
    free.fit();
    if (pendingFreeSnapshot) { free.load(pendingFreeSnapshot); pendingFreeSnapshot = null; }
  }
}

function startExample(ex) {
  if (ex.mode === 'fill') {
    fillMode.load(ex.state);
    location.hash = '#/fill';
  } else {
    pendingFreeSnapshot = ex.snapshot;
    if (location.hash === '#/free') route();
    else location.hash = '#/free';
  }
}

// ---------------------------------------------------------------- boot
function boot() {
  // Metrics measured before a font slice arrives would be wrong; drop them when fonts finish loading.
  if (document.fonts) document.fonts.addEventListener('loadingdone', clearMetricsCache);

  fillMode = initFill();
  const share = initShare();
  initHome(startExample);

  $$('[data-open-share]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.openShare === 'fill') share.open(fillMode.shareProvider);
    else share.open((await getFree()).shareProvider);
  }));

  const help = $('#help-sheet');
  $('#help-btn').addEventListener('click', () => {
    $$('[data-help]', help).forEach((l) => { l.hidden = l.dataset.help !== currentRoute; });
    help.showModal();
  });
  help.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => help.close()));
  help.addEventListener('click', (e) => { if (e.target === help) help.close(); });

  window.addEventListener('hashchange', route);
  route();
}

boot();
