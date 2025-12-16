// Background service worker for MV3
// Handles invoking EyeDropper in the active tab and syncing storage

const STORAGE_KEYS = {
  last: 'cp_last',
  history: 'cp_history',
  palette: 'cp_palette'
};
const MAX_HISTORY = 15;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PICK_COLOR') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || !tab.id) {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }

        // Inject a function to run EyeDropper in the page context
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            if (!('EyeDropper' in window)) {
              return { ok: false, error: 'EyeDropper API not supported' };
            }
            try {
              const eye = new EyeDropper();
              const out = await eye.open();
              return { ok: true, hex: out.sRGBHex };
            } catch (e) {
              // e.name could be 'AbortError' if user cancels
              return { ok: false, error: e && (e.name || e.message) || 'Cancelled' };
            }
          }
        });

        const result = results && results[0] && results[0].result;
        if (!result || !result.ok) {
          sendResponse({ ok: false, error: result ? result.error : 'Unknown error' });
          return;
        }

        const hex = (result.hex || '').toUpperCase();
        await persistSelection(hex);

        // Notify any extension pages (popup) listening
        chrome.runtime.sendMessage({ type: 'COLOR_PICKED', hex });
        sendResponse({ ok: true, hex });
      } catch (err) {
        sendResponse({ ok: false, error: err && err.message || 'Unexpected error' });
      }
    })();
    return true; // keep message channel open for async sendResponse
  }
});

async function persistSelection(hex) {
  const now = Date.now();
  const st = await chrome.storage.local.get([STORAGE_KEYS.history, STORAGE_KEYS.last]);
  let history = Array.isArray(st[STORAGE_KEYS.history]) ? st[STORAGE_KEYS.history] : [];

  // de-duplicate with most-recent-first rule
  history = [hex, ...history.filter(h => h !== hex)].slice(0, MAX_HISTORY);

  await chrome.storage.local.set({
    [STORAGE_KEYS.last]: { hex, at: now },
    [STORAGE_KEYS.history]: history
  });
}
