# Color Pick – Instant Eyedropper (Chrome MV3)

A modern, lightweight color picker extension that uses the native EyeDropper API to capture colors from any webpage. Instantly shows HEX, RGB, and HSL with one‑click copy, keeps a recent history, and lets you save a simple palette.

- Zero external dependencies
- Minimal permissions (activeTab, storage, scripting)
- MV3 service worker background
- Clean popup UI with micro-animations

## Features
- Pick any on-screen color via EyeDropper
- Auto-display HEX, RGB, HSL (copy buttons)
- Recent colors history (de-duplicated, most recent first)
- Save to palette; remove saved colors; clear actions
- Fast, responsive UI with modern aesthetic

## Install (Developer Mode)
1. In Chrome, open `chrome://extensions`.
2. Enable "Developer mode" (top-right).
3. Click "Load unpacked" and select this folder.
4. The extension appears in the toolbar. Pin it for quick access.

## Usage
- Click the toolbar icon to open the popup.
- Press "Pick Color" — your cursor becomes an eyedropper.
- Click anywhere on the page to select a color.
- The popup displays the color preview and HEX/RGB/HSL. Use Copy buttons.
- Click ⭐ Save to Palette to store a favorite.
- Use Recent to reuse selections or copy values again.

Note: Chrome closes the popup when you click on the page to pick a color. The background worker stores the result. Reopen the popup and the latest color and history will be there (if it wasn’t still open to receive the live update).

## Permissions Rationale
- `activeTab`: temporary script injection only for the user-activated tab to call EyeDropper.
- `scripting`: inject a small function to run EyeDropper in the page context.
- `storage`: save recent colors and palette locally.

## Files
- `manifest.json` – MV3 manifest
- `background.js` – service worker; invokes EyeDropper in active tab; stores history
- `popup.html` – popup UI
- `popup.css` – styles
- `popup.js` – UI logic, copy, palette, conversions

## Extend
- Contrast checker for current color vs. text/background
- Tailwind color suggestion mapping
- Gradient generator from history/palette
- Color naming via heuristic or local dataset

## Support
This project is dependency-free and portable. Replace icons by adding PNGs and updating the `icons` section in `manifest.json` if you plan to publish on the Chrome Web Store.