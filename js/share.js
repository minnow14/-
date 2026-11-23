// Save / share sheet. A provider renders the artwork for a ratio; the sheet adds the watermark.
import { FONTS } from './fonts.js';
import { toast, setSeg, bindSeg } from './ui.js';

const WATERMARK = 'PB03';
const SITE = 'TWO SCRIPTS, ONE CANVAS';

function cornerIsLight(ctx, W, H) {
  const w = Math.round(W * 0.2);
  const h = Math.round(H * 0.07);
  const d = ctx.getImageData(W - w, H - h, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 16) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 16) > 140;
}

export function composeFinal(src, watermark) {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  if (watermark) {
    const W = out.width;
    const H = out.height;
    const size = Math.round(W * 0.024);
    const margin = Math.round(W * 0.035);
    ctx.fillStyle = cornerIsLight(ctx, W, H) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${size}px ${FONTS.ko.family}, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(WATERMARK, W - margin, H - margin);
  }
  return out;
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

function safeName(s) {
  return (s || 'art').replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 20) || 'art';
}

export function initShare() {
  const dlg = document.getElementById('share-sheet');
  const preview = document.getElementById('share-preview');
  const wm = document.getElementById('share-wm');
  const nativeBtn = document.getElementById('share-native');
  const ratioSeg = dlg.querySelector('[data-control="share-ratio"]');
  let provider = null;
  let current = null;

  async function refresh() {
    if (!provider) return;
    const src = await provider.render();
    current = composeFinal(src, wm.checked);
    preview.width = current.width;
    preview.height = current.height;
    preview.getContext('2d').drawImage(current, 0, 0);
    setSeg(ratioSeg, provider.getRatio());
  }

  bindSeg(ratioSeg, async (v) => { await provider.setRatio(v); refresh(); });
  wm.addEventListener('change', refresh);
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  const fileName = () => `two-scripts-one-canvas_${safeName(provider.name())}_${provider.getRatio().replace(':', 'x')}.png`;

  document.getElementById('share-save').addEventListener('click', async () => {
    if (!current) return;
    const blob = await toBlob(current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('已儲存圖片', '이미지를 저장했어요');
  });

  nativeBtn.addEventListener('click', async () => {
    if (!current) return;
    const blob = await toBlob(current);
    const file = new File([blob], fileName(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: SITE });
    } catch (err) {
      if (err && err.name !== 'AbortError') toast('無法分享，請先儲存圖片', '공유할 수 없어요. 이미지를 저장해 주세요');
    }
  });

  document.getElementById('share-link').addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      toast('已複製連結', '링크를 복사했어요');
    } catch {
      window.prompt('URL', url);
    }
  });

  // Show the native share button only where file sharing is supported (mostly mobile).
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    nativeBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch {
    nativeBtn.hidden = true;
  }

  return {
    open(p) {
      provider = p;
      current = null;
      dlg.showModal();
      refresh();
    },
  };
}
