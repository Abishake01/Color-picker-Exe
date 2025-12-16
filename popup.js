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
  // New template controls
  hue: null,
  sbWrap: null,
  sb: null,
  sbCursor: null,
  hexInput: null,
  rgbR: null,
  rgbG: null,
  rgbB: null,
  hslCode: null,
  currentChip: null,
  genMono: null,
  genComp: null,
  genSwatches: null,
};

let currentHex = null;
let currentH = 210, currentS = 70, currentL = 50; // HSL

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
  // New
  els.hue = document.getElementById('hue');
  els.sbWrap = document.getElementById('sb-wrap');
  els.sb = document.getElementById('sb');
  els.sbCursor = document.getElementById('sb-cursor');
  els.hexInput = document.getElementById('hex-input');
  els.rgbR = document.getElementById('rgb-r');
  els.rgbG = document.getElementById('rgb-g');
  els.rgbB = document.getElementById('rgb-b');
  els.hslCode = document.getElementById('hsl-code');
  els.currentChip = document.getElementById('current-chip');
  els.genMono = document.getElementById('btn-mono');
  els.genComp = document.getElementById('btn-comp');
  els.genSwatches = document.getElementById('gen-swatches');

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

  // Embedded picker events
  if (els.hue) els.hue.addEventListener('input', onHueChange);
  if (els.hexInput) els.hexInput.addEventListener('change', onHexInput);
  if (els.rgbR) [els.rgbR, els.rgbG, els.rgbB].forEach(el=> el.addEventListener('change', onRgbInput));
  if (els.sbWrap) setupSBDrag();
  if (els.genMono) els.genMono.addEventListener('click', ()=> renderGenerated(buildMonochromatic()));
  if (els.genComp) els.genComp.addEventListener('click', ()=> renderGenerated(buildComplementary()));

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
  // Initialize picker UI from last/current
  if (currentHex) {
    const { r,g,b } = hexToRgb(currentHex);
    const { h,s,l } = rgbToHsl(r,g,b);
    setHsl(h,s,l);
  } else {
    setHsl(currentH,currentS,currentL);
  }
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
  if (els.preview) els.preview.style.background = currentHex;
  if (els.hex) els.hex.textContent = currentHex;
  const { r, g, b } = hexToRgb(currentHex);
  if (els.rgb) els.rgb.textContent = `rgb(${r}, ${g}, ${b})`;
  const { h, s, l } = rgbToHsl(r, g, b);
  if (els.hsl) els.hsl.textContent = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  // Update embedded picker
  setHsl(h,s,l);
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

function hslToRgb(h, s, l){
  h/=360; s/=100; l/=100;
  if (s === 0){
    const v = Math.round(l*255); return {r:v,g:v,b:v};
  }
  const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3 - t)*6; return p; };
  const q = l < .5 ? l*(1+s) : l + s - l*s;
  const p = 2*l - q;
  const r = Math.round(hue2rgb(p,q,h+1/3)*255);
  const g = Math.round(hue2rgb(p,q,h)*255);
  const b = Math.round(hue2rgb(p,q,h-1/3)*255);
  return {r,g,b};
}

function rgbToHex(r,g,b){
  const h = (n)=> ('0'+n.toString(16)).slice(-2);
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function setHsl(h,s,l){
  currentH = clamp(h,0,360); currentS = clamp(s,0,100); currentL = clamp(l,0,100);
  // Update SB base color (hue only)
  if (els.sb) els.sb.style.background = `hsl(${currentH}, 100%, 50%)`;
  // Position cursor within SB
  const rect = els.sbWrap.getBoundingClientRect();
  const x = rect.left + (currentS/100)*rect.width;
  const y = rect.top + ((100-currentL)/100)*rect.height;
  if (els.sbCursor){ els.sbCursor.style.left = `${(currentS/100)*rect.width}px`; els.sbCursor.style.top = `${((100-currentL)/100)*rect.height}px`; }
  // Update hue slider
  if (els.hue) els.hue.value = String(Math.round(currentH));
  // Update values
  const {r,g,b} = hslToRgb(currentH,currentS,currentL);
  const hex = rgbToHex(r,g,b);
  currentHex = hex;
  if (els.hex) els.hex.textContent = hex;
  if (els.hexInput) els.hexInput.value = hex;
  if (els.rgb) els.rgb.textContent = `rgb(${r}, ${g}, ${b})`;
  if (els.rgbR){ els.rgbR.value = r; els.rgbG.value = g; els.rgbB.value = b; }
  if (els.hslCode) els.hslCode.textContent = `${Math.round(currentH)}°, ${Math.round(currentS)}%, ${Math.round(currentL)}%`;
  if (els.preview) els.preview.style.background = hex;
  if (els.currentChip){ els.currentChip.textContent = hex; els.currentChip.style.borderColor = hex; }
}

function onHueChange(){
  setHsl(parseFloat(els.hue.value), currentS, currentL);
}

function setupSBDrag(){
  const move = (clientX, clientY)=>{
    const rect = els.sbWrap.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    const s = (x/rect.width)*100;
    const l = 100 - (y/rect.height)*100;
    setHsl(currentH, s, l);
  };
  let dragging = false;
  const onDown = (e)=>{ dragging=true; const p=e.touches? e.touches[0]: e; move(p.clientX,p.clientY); e.preventDefault(); };
  const onMove = (e)=>{ if(!dragging) return; const p=e.touches? e.touches[0]: e; move(p.clientX,p.clientY); };
  const onUp = ()=> dragging=false;
  els.sbWrap.addEventListener('mousedown', onDown);
  els.sbWrap.addEventListener('touchstart', onDown, {passive:false});
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
}

function onHexInput(){
  const v = els.hexInput.value.trim();
  const m = /^#?[0-9a-fA-F]{6}$/.test(v) ? v.replace('#','') : null;
  if (!m) { els.hexInput.value = currentHex; return; }
  const hex = '#'+m.toUpperCase();
  const {r,g,b} = hexToRgb(hex);
  const {h,s,l} = rgbToHsl(r,g,b);
  setHsl(h,s,l);
}

function onRgbInput(){
  const r = clamp(parseInt(els.rgbR.value||'0',10),0,255);
  const g = clamp(parseInt(els.rgbG.value||'0',10),0,255);
  const b = clamp(parseInt(els.rgbB.value||'0',10),0,255);
  const {h,s,l} = rgbToHsl(r,g,b);
  setHsl(h,s,l);
}

function buildMonochromatic(){
  const steps = [-30,-15,0,15,30];
  return steps.map(dL=> { const {r,g,b}=hslToRgb(currentH, currentS, clamp(currentL+dL,0,100)); return rgbToHex(r,g,b); });
}

function buildComplementary(){
  const h2 = (currentH+180)%360;
  const variants = [
    {h:currentH,s:currentS,l:currentL-20},
    {h:currentH,s:currentS,l:currentL},
    {h:h2,s:currentS,l:currentL},
    {h:h2,s:currentS,l:currentL+15},
    {h:h2,s:currentS-15,l:currentL}
  ];
  return variants.map(v=> { const {r,g,b}=hslToRgb(v.h,clamp(v.s,0,100),clamp(v.l,0,100)); return rgbToHex(r,g,b); });
}

function renderGenerated(colors){
  els.genSwatches.innerHTML='';
  colors.forEach(hex=>{
    const s=document.createElement('button');
    s.className='swatch';
    s.style.background=hex; s.title=hex;
    s.addEventListener('click', ()=> applyHex(hex));
    els.genSwatches.appendChild(s);
  });
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
