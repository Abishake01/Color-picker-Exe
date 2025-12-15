const STORAGE_KEYS = {
  last: 'cp_last',
  history: 'cp_history',
  palette: 'cp_palette'
};

const els = {
  pickBtn: null,
  status: null,
  currentSection: null,
  preview: null,
  hex: null,
  rgb: null,
  hsl: null,
  copyBtns: null,
  saveToPalette: null,
  history: null,
  palette: null,
  clearHistory: null,
  clearPalette: null,
  about: null,
};

let currentHex = null;

init();

function init() {
  els.pickBtn = document.getElementById('pick-btn');
  els.status = document.getElementById('status');
  els.currentSection = document.getElementById('current-section');
  els.preview = document.getElementById('preview');
  els.hex = document.getElementById('hex-code');
  els.rgb = document.getElementById('rgb-code');
  els.hsl = document.getElementById('hsl-code');
  els.saveToPalette = document.getElementById('save-to-palette');
  els.history = document.getElementById('history');
  els.palette = document.getElementById('palette');
  els.clearHistory = document.getElementById('btn-clear-history');
  els.clearPalette = document.getElementById('clear-palette');
  els.about = document.getElementById('btn-open-options');

  els.pickBtn.addEventListener('click', onPick);
  els.saveToPalette.addEventListener('click', onSaveToPalette);
  els.clearHistory.addEventListener('click', clearHistory);
  els.clearPalette.addEventListener('click', clearPalette);
  els.about.addEventListener('click', () => {
    alert('Color Pick – Instant Eyedropper\n\nPick a color from any page. Copy HEX/RGB/HSL, track recent colors, and save a quick palette.');
  });

  document.querySelectorAll('.copy').forEach(btn => btn.addEventListener('click', onCopy));

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'COLOR_PICKED') {
      applyHex(msg.hex);
      refreshHistory();
    }
  });

  // Initial load
  bootstrap();
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      const cb = (resp) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(resp);
      };
      if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage(chrome.runtime.id, message, cb);
      } else {
        // Fallback: attempt without ID (works in extension pages)
        chrome.runtime.sendMessage(message, cb);
      }
    } catch (e) {
      reject(e);
    }
  });
}

async function bootstrap() {
  const st = await chrome.storage.local.get([STORAGE_KEYS.last, STORAGE_KEYS.history, STORAGE_KEYS.palette]);
  const last = st[STORAGE_KEYS.last];
  if (last && last.hex) {
    applyHex(last.hex);
  }
  renderSwatches(els.history, Array.isArray(st[STORAGE_KEYS.history]) ? st[STORAGE_KEYS.history] : [], false);
  renderSwatches(els.palette, Array.isArray(st[STORAGE_KEYS.palette]) ? st[STORAGE_KEYS.palette] : [], true);
}

async function onPick() {
  els.status.textContent = 'Picking… click anywhere on the page';
  try {
    const resp = await sendMessage({ type: 'PICK_COLOR' });
    if (!resp || !resp.ok) {
      if (resp && resp.error === 'AbortError') {
        els.status.textContent = 'Cancelled';
      } else {
        els.status.textContent = resp && resp.error ? String(resp.error) : 'Unable to pick color';
      }
      return;
    }
    // If popup is still open, update immediately. Background also broadcasts.
    applyHex(resp.hex);
    await refreshHistory();
    els.status.textContent = '';
  } catch (e) {
    els.status.textContent = 'Error: ' + (e && e.message || 'Unknown');
  }
}

function applyHex(hex) {
  if (!hex) return;
  currentHex = hex.toUpperCase();
  els.currentSection.hidden = false;
  els.preview.style.background = currentHex;
  els.hex.textContent = currentHex;
  const { r, g, b } = hexToRgb(currentHex);
  els.rgb.textContent = `rgb(${r}, ${g}, ${b})`;
  const { h, s, l } = rgbToHsl(r, g, b);
  els.hsl.textContent = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

async function onCopy(e) {
  const target = e.currentTarget.getAttribute('data-target');
  let text = '';
  if (target === 'hex') text = els.hex.textContent;
  if (target === 'rgb') text = els.rgb.textContent;
  if (target === 'hsl') text = els.hsl.textContent;
  try {
    await navigator.clipboard.writeText(text);
    flash(e.currentTarget, 'Copied!');
  } catch {
    flash(e.currentTarget, 'Failed');
  }
}

async function onSaveToPalette() {
  if (!currentHex) return;
  const st = await chrome.storage.local.get([STORAGE_KEYS.palette]);
  let palette = Array.isArray(st[STORAGE_KEYS.palette]) ? st[STORAGE_KEYS.palette] : [];
  palette = [currentHex, ...palette.filter(h => h !== currentHex)];
  await chrome.storage.local.set({ [STORAGE_KEYS.palette]: palette });
  renderSwatches(els.palette, palette, true);
}

async function refreshHistory() {
  const st = await chrome.storage.local.get([STORAGE_KEYS.history]);
  const history = Array.isArray(st[STORAGE_KEYS.history]) ? st[STORAGE_KEYS.history] : [];
  renderSwatches(els.history, history, false);
}

function renderSwatches(container, colors, isPalette) {
  container.innerHTML = '';
  colors.forEach(hex => {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = hex;
    sw.title = hex;
    sw.addEventListener('click', () => applyHex(hex));
    if (isPalette) {
      const rm = document.createElement('button');
      rm.className = 'remove';
      rm.title = 'Remove';
      rm.textContent = '×';
      rm.addEventListener('click', async (e) => {
        e.stopPropagation();
        const st = await chrome.storage.local.get([STORAGE_KEYS.palette]);
        const palette = (st[STORAGE_KEYS.palette] || []).filter(h => h !== hex);
        await chrome.storage.local.set({ [STORAGE_KEYS.palette]: palette });
        renderSwatches(container, palette, true);
      });
      sw.appendChild(rm);
    }
    container.appendChild(sw);
  });
}

async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.history]: [] });
  renderSwatches(els.history, [], false);
}

async function clearPalette() {
  await chrome.storage.local.set({ [STORAGE_KEYS.palette]: [] });
  renderSwatches(els.palette, [], true);
}

function flash(el, text) {
  const original = el.textContent;
  el.textContent = text;
  el.disabled = true;
  setTimeout(() => { el.textContent = original; el.disabled = false; }, 800);
}

function hexToRgb(hex) {
  const v = hex.replace('#','');
  const r = parseInt(v.slice(0,2), 16);
  const g = parseInt(v.slice(2,4), 16);
  const b = parseInt(v.slice(4,6), 16);
  return { r, g, b };
}

function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h*360, s: s*100, l: l*100 };
}
