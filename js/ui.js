// Small UI helpers shared by both modes.

export const PRESET_COLORS = ['#000000', '#ffffff', '#8c8c8c', '#d7261e', '#1d4ed8', '#f2b705', '#13795b'];

export function bi(zh, ko) {
  return `<span class="bi"><span class="zh">${zh}</span><span class="ko" lang="ko">${ko}</span></span>`;
}

let toastTimer;
export function toast(zh, ko) {
  const el = document.getElementById('toast');
  el.innerHTML = bi(zh, ko);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/** Segmented radio group: buttons with data-value. */
export function setSeg(seg, value) {
  seg.querySelectorAll('.seg-item').forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute('role', seg.getAttribute('role') === 'tablist' ? 'tab' : 'radio');
    b.setAttribute(seg.getAttribute('role') === 'tablist' ? 'aria-selected' : 'aria-checked', String(on));
  });
}
export function bindSeg(seg, onChange) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-item');
    if (!b || !seg.contains(b)) return;
    setSeg(seg, b.dataset.value);
    onChange(b.dataset.value);
  });
}

/** Colour swatches with presets and a custom colour input. */
export function buildSwatches(el, { value, onChange, label }) {
  el.innerHTML = '';
  el.setAttribute('role', 'radiogroup');
  if (label) el.setAttribute('aria-label', label);
  const buttons = PRESET_COLORS.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = c;
    b.dataset.color = c;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c);
    b.addEventListener('click', () => { api.set(c); onChange(c); });
    el.appendChild(b);
    return b;
  });
  const custom = document.createElement('label');
  custom.className = 'swatch swatch-custom';
  custom.title = '自訂顏色 / 직접 선택';
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', '自訂顏色 / 직접 선택');
  input.addEventListener('input', () => { api.set(input.value); onChange(input.value, true); });
  input.addEventListener('change', () => onChange(input.value, false));
  custom.appendChild(input);
  el.appendChild(custom);

  const api = {
    set(c) {
      const v = c.toLowerCase();
      let matched = false;
      buttons.forEach((b) => {
        const on = b.dataset.color === v;
        matched ||= on;
        b.setAttribute('aria-checked', String(on));
      });
      custom.setAttribute('aria-checked', String(!matched));
      if (!matched) custom.style.background = v;
      else custom.style.background = '';
      input.value = /^#[0-9a-f]{6}$/.test(v) ? v : '#000000';
    },
  };
  api.set(value);
  return api;
}

export function isDark(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
