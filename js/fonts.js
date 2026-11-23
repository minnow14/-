// Font specs and loading. Fonts come from Google Fonts (SIL OFL 1.1).
// Google Fonts splits CJK fonts into unicode-range slices, so loading with the
// actual text only downloads the slices that contain those characters.

export const FONTS = {
  hanSans: { family: '"Noto Sans TC"', weight: 700 },
  hanSerif: { family: '"Noto Serif TC"', weight: 900 },
  ko: { family: '"Noto Sans KR"', weight: 700 },
  koFill: { family: '"Noto Sans KR"', weight: 900 },
};

export function fontString(spec, sizePx) {
  return `${spec.weight} ${sizePx}px ${spec.family}, sans-serif`;
}

const loaded = new Set();

/** Resolve once the font slices needed for `text` are ready (or after a timeout). */
export async function ensureFont(spec, text) {
  const key = spec.family + spec.weight + '|' + text;
  if (loaded.has(key) || !document.fonts) return;
  const load = document.fonts.load(fontString(spec, 100), text).catch(() => {});
  const timeout = new Promise((r) => setTimeout(r, 8000));
  await Promise.race([load, timeout]);
  loaded.add(key);
}
