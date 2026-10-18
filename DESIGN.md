> Bootstrap status: the runnable Vite/TypeScript app and Python asset pipeline are
> implemented. See [README.md](README.md) for setup and limitations. The Kodi
> launcher, CEC bridge, countdown, and service worker below remain design proposals.
> In particular, `window.close()` is not a reliable kiosk-exit mechanism; a real
> launcher must provide and verify its own exit path. A client-side passcode is
> not access control for private photos; enforce authentication at the host.

This simplifies the entire architecture down to a **100% static, serverless web application** built around a **single high-resolution photo of the full Golu display**.

Without synchronized multiplayer state or a live database, you don't need a game server at all. An Offline Asset Pipeline pre-computes the full Golu panorama and doll regions into a static bundle, and a single Vanilla JS / TypeScript web app runs identically inside a fullscreen browser on your Kodi HTPC (driven by your TV remote via HDMI-CEC) and on any remote browser via mouse or touch.

---

# System Design Document: Static Web Party Game

## 1. System Overview & Goals

* **Single Full-Golu Panorama with Doll Zoom:** The entire experience centers on a single high-resolution photograph (or illustration) of the full Golu steps (*Kolu Padi*). Both the idle kiosk explainer and active trivia questions smoothly pan and zoom into specific dolls (`region: { x, y, width, height }`) on that master image.
* **Always-On TV Kiosk Explainer Mode:** There is no static title menu. When no one is actively playing, the TV continuously runs an engaging kiosk explainer—panning and zooming randomly from doll to doll across the Golu while displaying each doll's story/explanation and keeping a single prominent **"Start Game"** action ready at all times. After a period of inactivity during or after a game, the app automatically returns to kiosk mode.
* **Cartoon Game Show Host (Raja Bommai):** An animated SVG + GSAP clay-doll host (*Raja Bommai*, `src/raja-bommai.ts`) accompanies the display on screen—waving and narrating doll lore in kiosk mode, raising his microphone to ask trivia questions, looking around in suspense while waiting, and celebrating or commiserating on answer reveals.
* **Zero Backend / No Database:** All game logic, scoring, kiosk cycling, and round progression execute client-side in the browser. Content is pre-generated via a local CLI build script and served as static JSON and optimized media assets.
* **Single Codebase (Web-First):** Built with standard web technologies (HTML5, CSS Grid/Flexbox, SVG, GSAP, TypeScript) and bundled into a static `dist/` folder.
* **Dual Input Parity (CEC + Pointer):** Every UI element is navigable via 5-way directional keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Backspace`) for HDMI-CEC TV remotes, while supporting standard mouse/touch clicks for online players.
* **Frictionless Kodi Integration:** Launched directly from the Kodi home screen via a lightweight Python wrapper that spawns a kiosk-mode browser, hands over audio locks, and returns cleanly to Kodi upon exit.

---

## 2. High-Level Architecture

The system is split into two completely decoupled phases: **Build-Time Content Generation** (run locally on your dev machine) and **Runtime Static Serving** (hosted on a CDN like Cloudflare Pages/R2).

```
[1. BUILD-TIME PIPELINE (Local Dev Machine)]
  Full Golu Photo + Doll Regions/Metadata ──> Python CLI Script (`scripts/build_assets.py`)
                                                ├── Strips EXIF / Resizes master Golu photo to high-res WebP
                                                ├── Validates doll bounding boxes (`x, y, width, height`)
                                                ├── Generates distractors & question prompts
                                                ├── Synthesizes host TTS audio (`edge-tts` `en-IN-PrabhatNeural`)
                                                └── Outputs static `questions.json` + `/assets/*.{webp,mp3}`

[2. DEPLOYMENT (Static Hosting / CDN)]
  `dist/` (HTML/CSS/JS + questions.json + WebP/MP3 assets) ──> Cloudflare Pages / R2

[3. RUNTIME EXECUTION (Zero Server State)]
  ├── Online Users ──> Open URL in Browser ──> Kiosk Explainer or Click/Tap "Start Game"
  └── Kodi HTPC    ──> Add-on launches Chromium `--kiosk` ──> TV Remote (HDMI-CEC)
```

---

## 3. Offline Content Pipeline (Build-Time CLI)

Instead of an admin panel or runtime database, a local script ingests the full Golu photo and a single `golu.yaml` / `golu.json` configuration (or fallback folder/sidecar metadata), processes them deterministically, and emits a static asset bundle.

### Pipeline Responsibilities

1. **Image Optimization:** Reads the source Golu photo, applies EXIF orientation (`ImageOps.exif_transpose`), strips privacy/EXIF/GPS metadata, and encodes a high-resolution `.webp` master image for smooth pan-and-zoom inspection.
2. **Doll Region & Question Synthesis:** Maps each doll in `golu.yaml` to normalized coordinates (`x`, `y`, `width`, `height` in `0..1`), pairs each doll's name/answer with 3 plausible distractors (sampled from other dolls on the Golu when not explicitly specified), and assigns deterministic IDs.
3. **Host Voiceover Synthesis (`edge-tts`):** Synthesizes spoken `.mp3` clips for Raja Bommai using `edge-tts` (`en-IN-PrabhatNeural`) for doll spotlight narrations, question prompts, answer reveals, and reusable host catchphrases, using content-addressed filenames (`assets/audio_<sha256>.mp3`) so unchanged lines are cached across builds.
4. **Manifest Emission:** Outputs `questions.json` alongside the `assets/` directory.

### Input Authoring (`raw_photos/golu.yaml`)

```yaml
title: Navaratri Golu Trivia
pack: Our Golu Padi
image: golu.jpg
dolls:
  - name: Marapachi Dolls
    region: { x: 0.42, y: 0.18, width: 0.16, height: 0.22 }
    prompt: Which traditional wooden pair stands on the top step?
    explanation: Carved from red sandalwood, Marapachi bride and groom dolls are a traditional wedding gift displayed on the Golu.
```

### Data Schema (`questions.json`)

```json
{
  "version": "2026.10.18",
  "title": "Navaratri Golu Trivia",
  "image": "assets/img_8f92a1.webp",
  "hostAudio": {
    "welcome": ["assets/audio_welcome_01.mp3"],
    "correct": ["assets/audio_shabash_01.mp3", "assets/audio_correct_02.mp3"],
    "wrong": ["assets/audio_ayyo_01.mp3", "assets/audio_wrong_02.mp3"]
  },
  "packs": [
    {
      "id": "pack_golu",
      "name": "Our Golu Padi",
      "questions": [
        {
          "id": "q_marapachi",
          "name": "Marapachi Dolls",
          "image": "assets/img_8f92a1.webp",
          "region": { "x": 0.42, "y": 0.18, "width": 0.16, "height": 0.22 },
          "prompt": "Which traditional wooden pair stands on the top step?",
          "options": [
            "Marapachi Dolls",
            "Thanjavur Thalaiyatti Bommai",
            "Chettiar Couple",
            "Krishnagiri Clay Pair"
          ],
          "correctIndex": 0,
          "explanation": "Carved from red sandalwood, Marapachi bride and groom dolls are a traditional wedding gift displayed on the Golu.",
          "audio": {
            "spotlight": "assets/audio_c19a02.mp3",
            "question": "assets/audio_7b4e11.mp3",
            "reveal": "assets/audio_93d8f0.mp3"
          }
        }
      ]
    }
  ]
}
```

---

## 4. Client Application Architecture (Web Stack)

To keep the bundle fast and self-contained, the frontend uses **Vite + TypeScript + Vanilla DOM / CSS + GSAP** (powering the **Raja Bommai** SVG host rig and smooth camera pan/zoom).

### 4.1 State Machine

Rather than a static title menu, the client runs an always-engaging state machine:

* **`KIOSK_MODE` (Default / Attract Loop):**
  * Continuously pans between the full Golu overview and zoomed-in doll regions in random order.
  * Displays a kiosk explainer card with the doll's name and `explanation` story.
  * **Raja Bommai** alternates between `wave`, `asking` (narrating with lip-sync), and `idle`.
  * A single prominent **"Start Game"** button is focused so pressing `Enter` on the TV remote immediately starts a trivia round (plus an optional **"Spotlight Next Doll"** button and **"Quit to Kodi"** when launched with `?kodi=1`).
* **`QUESTION_ACTIVE`:**
  * Zooms smoothly into the current question's doll `region` on the full Golu image (with a toggle/hint to peek at the full Golu context).
  * **Raja Bommai** enters `asking` (raising his mic and speaking the prompt) and transitions to `thinking` (suspenseful eye shifts).
  * Displays the prompt and a 2x2 grid of multiple-choice buttons.
* **`ANSWER_REVEAL`:**
  * Highlights the correct option, shows the doll's `explanation` caption, updates the score tally, and focuses the **"Next Question"** button.
  * **Raja Bommai** reacts with `excited` (starry eyes, golden burst, joyful pedestal jump) on a correct guess or `sad` (sympathetic droop and head shake) on a miss.
* **`GAME_OVER`:**
  * Zooms back out to the full Golu panorama, displays the final score summary, and offers **"Play Again"** or **"Back to Kiosk"**.
  * An inactivity timer automatically returns `QUESTION_ACTIVE`, `ANSWER_REVEAL`, or `GAME_OVER` back to `KIOSK_MODE` if the remote is set down.

### 4.2 Raja Bommai Character Rig (`src/raja-bommai.ts`)

The cartoon game show host is a pure SVG + GSAP 3 character controller with zero external runtime assets (no Rive/Lottie binaries):

* **Reusable Controller:** `new RajaBommaiHost(container, options)` mounts the layered vector rig and exposes `.setState('idle' | 'wave' | 'asking' | 'thinking' | 'excited' | 'sad')`, `.setTalking(boolean)`, `.speakFor(ms)`, `.triggerBlink()`, and `.destroy()`.
* **Additive Micro-Animations:** Independent GSAP timelines handle lip-sync mouth swapping + mustache bounce (`talkTimeline`) and randomized natural eye blinks without interrupting the active body state timeline.
* **Interactive Testbed:** `studio.html` imports `src/studio.ts` (which wraps `src/raja-bommai.ts`) so character poses, pivot points, and GSAP snippets can be previewed and tuned in isolation.

### 4.3 Host Voiceover & Lip-Sync Architecture

Because the app is 100% static and content changes only when `make assets` runs, **pre-generating audio at build time with `edge-tts`** gives Raja Bommai a warm, expressive Indian-English game-show voice (including natural pronunciation of Sanskrit/Tamil names like *Ananthasayana Vishnu*, *Meenakshi Amman*, *Ashta Lakshmi*, and *Marapachi*) with zero runtime API keys, latency, or server dependencies.

#### 1. What Raja Bommai Reads (Script Synthesis)

For each doll in `golu.yaml`, `scripts/build_assets.py` synthesizes three distinct voice clips per doll plus a small shared bank of reaction stingers:

* **Kiosk Spotlight Clip (`audio.spotlight`):** Reads the doll's title and `explanation` story while the camera pans/zooms in `KIOSK_MODE`. Once the `<audio>` element loads/plays, the kiosk spotlight stays on screen until `ended` (+ a ~2s pause) so the host never gets cut off mid-sentence, falling back to `kioskSpotlightDurationMs` when muted or when audio is absent.
* **Question Prompt Clip (`audio.question`):** Reads the `prompt` followed by the four shuffled options (`"Option A: ..., Option B: ..."`). Because `build_assets.py` deterministically seeds option order per doll, the full question + options clip is pre-rendered as a single `.mp3` file. While this clip plays, Raja Bommai stays in `asking` with his mic raised, then transitions to `thinking` as soon as the audio `ended` event fires.
* **Answer Reveal Clip (`audio.reveal`):** Preceded by a quick reaction stinger from `hostAudio.correct` (*"Shabash! Spot on!"*) or `hostAudio.wrong` (*"Ayyo! Close, my friend..."*), followed by `audio.reveal` confirming the doll's name and reading its `explanation`.
* **Pronunciation Hints in `golu.yaml`:** Optional `tts_name` / `tts_explanation` overrides can be specified per doll in `golu.yaml` if any Sanskrit/Tamil proper noun needs a phonetic respelling for TTS without altering the on-screen display text.

#### 2. Build-Time TTS Pipeline (`edge-tts` in `scripts/build_assets.py`)

* **Voice & Engine:** Uses the `edge-tts` Python package with Microsoft's neural Indian-English voice **`en-IN-PrabhatNeural`** (configurable via `--voice`, e.g., `en-IN-NeerjaExpressiveNeural` or `en-IN-PrabhatNeural`).
* **Content-Addressed Caching:** Each clip filename is derived from `sha256(f"edge-tts:v1:{voice}:{rate}:{pitch}:{text}")` and written to `public/assets/audio_<hash>.mp3`. Re-running `make assets` skips synthesis for any clip whose `.mp3` already exists on disk, keeping incremental builds instant and offline-friendly once generated.
* **Audio Footprint:** `edge-tts` outputs mono **24 kHz, 48 kbps `.mp3`** natively. Across 18 dolls × 3 phases (~54 clips, ~7 minutes total speech), the entire voiceover bundle weighs only **~2 MB**—smaller than a single raw photo.

#### 3. Lip-Sync: Real-Time Web Audio Amplitude Follower (`AnalyserNode`)

To synchronize Raja Bommai's mouth and mustache to the playing `.mp3` without any extra build-time lip-sync dependencies, the client uses **Option 1: Web Audio API `AnalyserNode`**:

* **How it works:**
  * Route the active `HTMLAudioElement` through a shared `AudioContext` + `MediaElementAudioSourceNode` + `AnalyserNode` (`fftSize = 256`).
  * While audio is playing, sample time-domain waveform bytes (`getByteTimeDomainData`) on `gsap.ticker`, compute smoothed RMS volume (`0..1`), and pass the level into `host.setMouthLevel(level)`:
    * **Silence / Pauses (`level < 0.04`):** Show `#mouth-talk-closed` (or close mouth), settle `#mustache` at `y: 0, rotation: 0`.
    * **Normal Speech (`0.04 <= level < 0.35`):** Show `#mouth-open-smile` with `scaleY` mapped continuously between `0.45` and `1.05` (`svgOrigin: "300 255"`), and bounce `#mustache` (`y: -1` to `-3.5`) and `#head-group` (`y: -1` to `-3`).
    * **Loud Emphasis / Exclamations (`level >= 0.35`, e.g., *"SHABASH!"*):** Drive `#mouth-open-smile` `scaleY` up to `1.3`, lift `#mustache` (`y: -5`), and subtly raise `#brow-left` / `#brow-right`.
* **Fallback:** When running in environments without Web Audio `AnalyserNode` (such as unit tests or muted/blocked autoplay), `RajaBommaiHost` transparently falls back to its existing procedural `talkTimeline` (`host.speakFor(...)`).

#### 4. Browser Autoplay, Kodi HTPC, and Mute Controls

* **Kodi HTPC (`?kodi=1`):** The Kodi launcher already passes `--autoplay-policy=no-user-gesture-required` to Chromium and calls `xbmc.audioSuspend()` before launch, so Raja Bommai can narrate immediately in `KIOSK_MODE` on the TV without waiting for a button press.
* **Desktop / Mobile Web Browsers:** Standard browsers block unmuted audio in `KIOSK_MODE` until the user's first click/tap or key press. The audio controller attempts `audio.play()`, and if rejected with `NotAllowedError`:
  * Falls back cleanly to the procedural GSAP lip-sync (`host.speakFor(...)`) so the visual animation still runs silently.
  * Unlocks `AudioContext` and starts voiceover automatically on the first `keydown` or `pointerdown` event.
* **HUD Mute Toggle & Transition Cancellation:** A keyboard/remote-focusable **Mute / Unmute** toggle (and `M` shortcut) in the HUD lets players silence the host at any time, and any playing `<audio>` clip is immediately stopped whenever the player answers early, skips to the next doll, or exits to kiosk mode.

#### 5. Future Work: Pre-Computed Envelopes & Viseme Mouth Shapes (Options 2 & 3)

If we later want deterministic lip-sync across cross-origin CDNs without Web Audio graph setup or want full Saturday-morning cartoon vowel/consonant articulation, we can upgrade the pipeline with either (or both) of these extensions:

* **Future Option 2 — Pre-Computed Amplitude Envelope in `questions.json`:**
  * During `build_assets.py`, decode each generated `.mp3` and compute a compact 20 Hz RMS amplitude array (1 integer per 50ms of audio—~150 numbers per clip) stored in `questions.json` (`envelope: [0, 18, 64, 82, ...]`).
  * At runtime, read `envelope[Math.floor(audioEl.currentTime * 20)]` to drive `host.setMouthLevel(level)` without needing an `AudioContext` or `MediaElementAudioSourceNode` (avoiding CORS taint issues if audio is hosted on a separate R2 domain).
* **Future Option 3 — Phoneme / Viseme Mouth Shapes (`rhubarb-lip-sync` or `edge-tts` Word Boundaries):**
  * Add 3–4 additional SVG `<g>` mouth shapes to `src/raja-bommai.ts` matching Preston Blair / Rhubarb visemes:
    * **`X` (Rest/Closed):** `#mouth-talk-closed` (lips together)
    * **`A` / `B` (Consonants `M/B/P` & narrow teeth):** Small horizontal aperture
    * **`C` / `D` (Wide vowels `AA/AE/EH`):** `#mouth-open-smile` (wide open smile with tongue)
    * **`E` / `F` (Rounded vowels `OO/OH/W`):** `#mouth-oo` (round `<ellipse>` mouth for *"Oho!"*, *"Golu"*, *"Vishnu"*)
  * Run `rhubarb-lip-sync` (or map `edge-tts` `WordBoundary` events) during `make assets` to emit compact viseme cues (`[{ "t": 0.12, "v": "D" }, { "t": 0.28, "v": "F" }]`) and swap the active SVG mouth group as `audioEl.currentTime` crosses each cue.

### 4.4 Unified Input Controller (HDMI-CEC + Mouse/Touch)

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

### 4.5 TV-Safe UI Styling (10-Foot UI)

* **High-Visibility Focus Rings:** Since TV remote users don't have a cursor, CSS `:focus-visible` applies a high-contrast `4px solid #FFD700` border and subtle `scale(1.04)` transform so it is unmistakable which option is highlighted across the living room.
* **Smooth Pan-and-Zoom Stage:** Because all dolls live on a single high-resolution Golu photograph, zooming into a doll (`region: { x, y, width, height }`) uses hardware-accelerated CSS `transform: translate(...) scale(...)` on the master image layer—giving instant transitions with zero network wait between dolls or questions.

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
