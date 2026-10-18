> Bootstrap status: the runnable Vite/TypeScript app and Python asset pipeline are
> implemented. See [README.md](README.md) for setup and limitations. The Kodi
> launcher, CEC bridge, countdown, and service worker below remain design proposals.
> In particular, `window.close()` is not a reliable kiosk-exit mechanism; a real
> launcher must provide and verify its own exit path. A client-side passcode is
> not access control for private photos; enforce authentication at the host.

This simplifies the entire architecture down to a **100% static, serverless web application**.

Without synchronized multiplayer state or a live database, you don't need a game server at all. An Offline Asset Pipeline pre-computes the photos and trivia into a static bundle, and a single Vanilla JS / TypeScript web app runs identically inside a fullscreen browser on your Kodi HTPC (driven by your TV remote via HDMI-CEC) and on any remote browser via mouse or touch.

---

# System Design Document: Static Web Party Game

## 1. System Overview & Goals

* **Zero Backend / No Database:** All game logic, scoring, and round progression execute client-side in the browser. Content is pre-generated via a local CLI build script and served as static JSON and optimized media assets.
* **Single Codebase (Web-First):** Built with standard web technologies (HTML5, CSS Grid/Flexbox, TypeScript/Vanilla JS) and bundled into a static `dist/` folder.
* **Dual Input Parity (CEC + Pointer):** Every UI element is navigable via 5-way directional keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Backspace`) for HDMI-CEC TV remotes, while supporting standard mouse/touch clicks for online players.
* **Frictionless Kodi Integration:** Launched directly from the Kodi home screen via a lightweight Python wrapper that spawns a kiosk-mode browser, hands over audio locks, and returns cleanly to Kodi upon exit.

---

## 2. High-Level Architecture

The system is split into two completely decoupled phases: **Build-Time Content Generation** (run locally on your dev machine) and **Runtime Static Serving** (hosted on a CDN like Cloudflare Pages/R2).

```
[1. BUILD-TIME PIPELINE (Local Dev Machine)]
  Raw Photos + Prompts ──> Python / Go CLI Script
                                ├── Strips EXIF / Resizes to 1080p WebP
                                ├── Generates distractors & question prompts
                                └── Outputs static `manifest.json` + `/assets/*.webp`

[2. DEPLOYMENT (Static Hosting / CDN)]
  `dist/` (HTML/CSS/JS + manifest.json + WebP images) ──> Cloudflare Pages / R2

[3. RUNTIME EXECUTION (Zero Server State)]
  ├── Online Users ──> Open URL in Browser ──> Click/Tap to Play
  └── Kodi HTPC    ──> Add-on launches Chromium `--kiosk` ──> TV Remote (HDMI-CEC)

```

---

## 3. Offline Content Pipeline (Build-Time CLI)

Instead of an admin panel or runtime database, a local script ingests a directory of raw photos and metadata, processes them deterministically, and emits a static asset bundle.

### Pipeline Responsibilities

1. **Image Optimization:** Reads source photos, extracts needed EXIF metadata (date, GPS coordinates, or folder tags) before stripping privacy data, and converts images to 1080p `.webp` files for instant browser decoding.
2. **Question Synthesis:** Crafts question structures, pairs the correct answer with plausible distractors, and assigns deterministic IDs.
3. **Manifest Emission:** Outputs a single `questions.json` file alongside the media directory.

### Data Schema (`questions.json`)

```json
{
  "version": "2026.10.18",
  "title": "Family & Friends Trivia",
  "packs": [
    {
      "id": "pack_01",
      "name": "Holiday & Travel Memories",
      "questions": [
        {
          "id": "q_001",
          "image": "/assets/img_8f92a1.webp",
          "prompt": "Where was this photo taken?",
          "options": ["Vienna", "Munich", "Prague", "Zurich"],
          "correctIndex": 0,
          "explanation": "Taken outside the palace gardens in January 2026."
        }
      ]
    }
  ]
}

```

---

## 4. Client Application Architecture (Web Stack)

To keep the bundle tiny and maintenance-free, the frontend uses **Vite + TypeScript + Vanilla DOM / CSS** (or Preact if component ergonomics are preferred).

### 4.1 State Machine

The client runs a local in-memory state machine:

* **`TITLE_SCREEN`:** Select a question pack, configure round length (e.g., 10 questions), or click/press **"Quit to Kodi"** (only visible when launched with `?kodi=1`).
* **`QUESTION_ACTIVE`:** Displays the photo, prompt, and a 2x2 grid of multiple-choice buttons. Optional countdown timer bar.
* **`ANSWER_REVEAL`:** Highlights the correct option, shows the `explanation` caption, updates the score tally, and focuses the **"Next Question"** button.
* **`GAME_OVER`:** Displays final score, summary of rounds, and **"Play Again"** / **"Main Menu"** buttons.

### 4.2 Unified Input Controller (HDMI-CEC + Mouse/Touch)

When Kodi is minimized, the Linux kernel (`libcec` / `cec-client` or kernel RC subsystem) translates TV remote presses into standard X11/Wayland keyboard events—or, if Kodi stays running in the background, a tiny bridge maps CEC to keys. By relying on native DOM `<button>` elements and a roving `tabindex`, both remote and mouse users share the exact same interaction model.

```typescript
// spatial-nav.ts: Maps a 2x2 answer grid to Arrow keys & Enter
const GRID_COLS = 2;

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nav="true"]'));
  if (!buttons.length) return;

  const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex = currentIndex === -1 ? 0 : currentIndex;

  switch (e.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % buttons.length;
      break;
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      break;
    case 'ArrowDown':
      nextIndex = Math.min(currentIndex + GRID_COLS, buttons.length - 1);
      break;
    case 'ArrowUp':
      nextIndex = Math.max(currentIndex - GRID_COLS, 0);
      break;
    case 'Backspace':
    case 'Escape':
      // If running on Kodi HTPC, allow Back button on remote to exit or return to menu
      handleBackAction();
      return;
    default:
      return; // Let Enter/Space trigger native <button> click automatically
  }

  e.preventDefault();
  buttons[nextIndex]?.focus();
});

```

### 4.3 TV-Safe UI Styling (10-Foot UI)

* **High-Visibility Focus Rings:** Since TV remote users don't have a cursor, CSS `:focus-visible` applies a high-contrast `4px solid #FFD700` border and subtle `scale(1.04)` transform so it is unmistakable which option is highlighted across the living room.
* **Image Preloading:** While the group is viewing question $N$, the browser preloads the `.webp` image for question $N+1$ in the background (`new Image().src = nextUrl`) so transitions are instantaneous even on slower connections.

---

## 5. Kodi HTPC Integration

### 5.1 How HDMI-CEC Reaches the Browser

By default, Kodi captures HDMI-CEC directly via `libcec` and does not forward remote presses to external Linux apps. You have two clean ways to let your TV remote control the web browser:

1. **Option A: Kodi JSON-RPC / EventClient Bridge (Zero Hardware Config):** Keep Kodi's CEC connection alive, or release it right before launch and run `cec-client` piped to `ydotool` / `xdotool` inside the launcher script so remote D-pad presses become real OS keystrokes (`Up`, `Down`, `Left`, `Right`, `Return`).
2. **Option B: Linux Kernel CEC (`cec-ctl`):** If your HDMI adapter exposes `/dev/cec0` to the Linux input subsystem, the OS automatically treats the TV remote as a standard Linux keyboard across all windows.

### 5.2 The Kodi Add-on Launcher (`default.py`)

Installed at `~/.kodi/addons/script.party.game/default.py`, this script suspends Kodi's audio, opens Chromium in kiosk mode pointed at your hosted web app (passing `?kodi=1`), and cleans up when you exit.

```python
import subprocess
import xbmc

GAME_URL = "https://game.yourdomain.com/?kodi=1"

if xbmc.Player().isPlaying():
    xbmc.Player().stop()

xbmc.audioSuspend()

try:
    # Launch Chromium in kiosk mode.
    # When the user clicks "Exit to TV" in the web app, window.close() terminates Chromium.
    subprocess.run(
        [
            "chromium",
            "--kiosk",
            "--noerrdialogs",
            "--disable-infobars",
            "--autoplay-policy=no-user-gesture-required",
            f"--app={GAME_URL}",
        ],
        check=False,
    )
finally:
    xbmc.audioResume()
```

* **Clean Exit Back to Kodi:** Because Chromium is launched with `--app=...`, calling `window.close()` from JavaScript when the user clicks the on-screen **"Exit to Kodi"** button immediately closes the browser window, returning control and audio to Kodi.
* **Offline Fallback (Optional):** Chromium automatically caches the static assets via a standard Service Worker (`sw.js`), meaning even if your home internet blips during a party, the Kodi PC will still load the full game and photos from local disk cache.

---

## 6. Deployment & Hosting

* **Static Host:** Deploy the Vite build output (`index.html`, `app.js`, `style.css`, `questions.json`) to **Cloudflare Pages** or **GitHub Pages**.
* **Media Storage:** If the photo library grows large (hundreds of high-res WebPs), place the `/assets/` folder in a **Cloudflare R2** bucket mapped to a custom subdomain with aggressive `Cache-Control: public, max-age=31536000, immutable` headers.
* **Access Control (Optional):** If the photos are personal and you don't want crawlers or strangers stumbling onto them, you can either put a simple shared passcode screen in the web app (where the passcode hashes to unlock the R2 asset path) or place a Cloudflare Access policy in front of the domain.
