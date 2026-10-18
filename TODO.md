```markdown
# Photo Trivia Party Game — `TODO.md`

## Phase 1: Repository & Tooling Setup

- [x] **Initialize Project Structure**
  - [x] Create root project directory with `raw_photos/`, `public/`, and `src/`.
  - [x] Initialize Git repository and configure `.gitignore` (ignore `node_modules/`, `dist/`, `raw_photos/`, and `.DS_Store`).
- [x] **Frontend Build Scaffolding**
  - [x] Initialize a lightweight Vite + TypeScript project (`npm create vite@latest . -- --template vanilla-ts`).
  - [x] Configure `vite.config.ts` to ensure static assets in `public/assets/` and `public/questions.json` copy cleanly into `dist/`.
- [x] **Asset Pipeline Setup**
  - [x] Save `scripts/build_assets.py` and configure `Makefile` targets (`make assets`, `make dev`, `make test-ci`).

---

## Phase 2: Offline Content Pipeline & Curation

- [x] **Author Single-Photo Golu Config (`raw_photos/golu.yaml`)**
  - [x] Place the high-resolution photo of the full Golu display in `raw_photos/` alongside `golu.yaml`.
  - [x] Define each doll's `name`, normalized `region` (`{ x, y, width, height }` in `0..1`), custom `prompt`, and `explanation` story.
  - [x] Verify at least 4 distinct dolls (18 dolls/sets configured) exist so the 2x2 grid always has 4 unique choices.
- [x] **Generate & Verify Static Bundle**
  - [x] Run `make assets` (`scripts/build_assets.py`) and verify the master Golu photo converts to a properly oriented `.webp` file in `public/assets/`.
  - [x] Inspect `public/questions.json` to confirm valid JSON schema, stripped EXIF data, normalized `region` bounding boxes, and accurate `correctIndex` mappings.

---

## Phase 3: Core Web Application (State & Logic)

- [x] **Data Loader & Types (`src/manifest.ts`)**
  - [x] Define TypeScript interfaces for `Manifest`, `Pack`, `Question`, and `Region` (`{ x, y, width, height }`).
  - [x] Fetch `/questions.json` on startup (falling back to `/demo/questions.json` on 404) and validate region coordinates.
  - [x] Detect URL query parameters (`?kodi=1`) to toggle HTPC-specific UI controls (such as the **"Quit to Kodi"** button).
- [x] **Game State Machine (`src/game.ts`, `src/app.ts`)**
  - [x] Implement `KIOSK_MODE` state (no title menu): Continuously pan and zoom across dolls on the full Golu image in a kiosk explainer loop, showing each doll's name and `explanation` (with word-count-paced reading time) and a prominent **"Start game"** button ready at all times.
  - [x] Implement `QUESTION_ACTIVE` state: Zoom into the current doll's `region` with a spotlight highlight frame and full-Golu peek toggle, track current question index, and lock out duplicate submissions.
  - [x] Implement `ANSWER_REVEAL` state: Highlight selected vs. correct button, display the `explanation` caption, increment score, and focus the **"Next question"** button.
  - [x] Implement `GAME_OVER` state: Zoom back out to the full Golu display, show final score, and offer **"Play again"** / **"Back to kiosk"** actions.
  - [x] Automatically return from `QUESTION_ACTIVE`, `ANSWER_REVEAL`, or `GAME_OVER` back to `KIOSK_MODE` after a period of inactivity.
- [x] **Background Image Preloader (`src/app.ts`)**
  - [x] When rendering question $N$, instantiate `new Image().src = questions[N + 1].image` in the background so the next photo is already decoded in browser memory before the user advances.

---

## Phase 4: 10-Foot TV UI & Unified Input Navigation

- [x] **TV-Safe Layout & Styling (`src/style.css`, `src/app.ts`)**
  - [x] Lock the app to a strict fullscreen viewport (`100vw` × `100dvh`, `overflow: hidden`) so the page never scrolls on a TV or browser.
  - [x] Make the Golu display image fill/cover the screen as a full-bleed stage (with a blurred ambient backdrop fill), rather than sitting in a small side box.
  - [x] Overlay all text, prompts, doll spotlight cards, and answer buttons in translucent HUD panels on top of the fullscreen Golu image while keeping the highlighted doll region unobstructed.
  - [x] Style the photo stage with accurate region spotlight overlays and smooth pan/zoom transitions.
  - [x] Design the 2x2 answer button grid with large typography legible from across the living room.
  - [x] Add high-contrast `:focus-visible` styles (`4px solid #ffd700`) so TV remote users always see the active selection clearly.
- [x] **Spatial Keyboard / CEC Controller (`src/spatial-nav.ts`)**
  - [x] Implement 2D grid navigation mapping `ArrowUp`, `ArrowDown`, `ArrowLeft`, and `ArrowRight` across `[data-nav="true"]` buttons.
  - [x] Auto-focus the first interactive element whenever the game transitions between states (`KIOSK_MODE` $\rightarrow$ `QUESTION_ACTIVE` $\rightarrow$ `ANSWER_REVEAL`).
  - [x] Map `Enter` / `Space` to select the focused button (or advance to the next question on the reveal screen).
  - [x] Map `Backspace` / `Escape` (TV remote "Back" button) to return to `KIOSK_MODE`.
- [x] **Pointer / Touch Parity**
  - [x] Ensure standard mouse `click` and mobile `touchstart` events trigger the exact same selection handler and update focus state cleanly without ghost highlights on touch devices.
  - [x] Require landscape orientation on mobile (`@media (orientation: portrait) and (max-width: 600px)`) with a full-screen "Rotate your phone to landscape" prompt and compact mobile-landscape HUD sizing.
- [x] **Cartoon Game Show Host Integration (`src/raja-bommai.ts`)**
  - [x] Build reusable SVG + GSAP `RajaBommaiHost` controller and animation studio (`studio.html`, `src/studio.ts`).
  - [x] Mount `RajaBommaiHost` inside the main game view (`src/app.ts`) to react across `KIOSK_MODE`, `QUESTION_ACTIVE`, and `ANSWER_REVEAL`.
- [ ] **Host Voiceover (`edge-tts`) & Lip-Sync (Option 1 — Web Audio `AnalyserNode`)**
  - [ ] Add `edge-tts` to `pyproject.toml` and synthesize content-addressed `.mp3` clips (`en-IN-PrabhatNeural`) in `scripts/build_assets.py` for each doll (`spotlight`, `question`, `reveal`) and shared host reactions (`welcome`, `correct`, `wrong`).
  - [ ] Extend `Manifest` and `Question` types in `src/manifest.ts` to validate optional `hostAudio` and per-question `audio` paths.
  - [ ] Add `setMouthLevel(level: number)` to `RajaBommaiHost` (`src/raja-bommai.ts`) and build a Web Audio `AnalyserNode` voice player that drives real-time RMS amplitude lip-sync (`#mouth-open-smile` `scaleY`, `#mouth-talk-closed`, `#mustache`, and head/brow emphasis).
  - [ ] Wire voiceover playback into `src/app.ts` across `KIOSK_MODE` (advancing after narration finishes), `QUESTION_ACTIVE` (switching from `asking` to `thinking` when prompt audio ends), and `ANSWER_REVEAL` (stinger + explanation), with graceful autoplay fallback.
- [ ] **Future Work: Lip-Sync Options 2 & 3**
  - [ ] **Option 2 (Pre-computed Amplitude Envelopes):** Emit 20 Hz RMS amplitude arrays in `questions.json` during `make assets` so lip-sync works without Web Audio `AudioContext` / CORS constraints.
  - [ ] **Option 3 (Phoneme / Viseme Mouth Shapes):** Add rounded (`#mouth-oo`) and consonant SVG mouth groups to `src/raja-bommai.ts` and drive them from `edge-tts` `WordBoundary` cues or `rhubarb-lip-sync`.
- [ ] **Audio Effects (Optional)**
  - [x] Add lightweight Web Audio API synthesized tones (`src/sfx.ts`) for D-pad navigation ticks, round start fanfare, correct chimes, and wrong buzzers.
  - [ ] Replace basic oscillator tones with traditional Indian instrument-inspired SFX (e.g., temple ghanta / manjira bell chime on correct answers, Carnatic raga / veena pluck or mridangam thaapu on round start, subtle woodblock / tala tick on D-pad navigation, and gentle tanpura/tabla drop on wrong answers).

---

## Phase 5: Deployment & Online Hosting

- [x] **Production Build & Offline Caching**
  - [x] Add a minimal Service Worker (`public/sw.js`, `src/sw-register.ts`) to cache the app shell and visited WebP assets locally for instant reloads on the Kodi HTPC.
  - [x] Run `npm run build` and test the production output locally using `npx vite preview`.
- [x] **Static Hosting Setup**
  - [x] Deploy the `dist/` directory to GitHub Pages (`golu.bramp.net` via `.github/workflows/test.yml`).
  - [ ] _(Optional)_ If the photo set grows large, upload `public/assets/*.webp` to a Cloudflare R2 bucket and set `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **Privacy / Access Control**
  - [ ] Configure a Cloudflare Access policy or add a lightweight client-side passcode gate if the family/travel photos shouldn't be publicly indexed.
  - [x] Add `<meta name="robots" content="noindex, nofollow">` to `index.html`.

---

## Phase 6: Kodi HTPC Integration (Linux)

- [ ] **Verify Browser Kiosk Mode on the Linux PC**
  - [ ] SSH into or open a terminal on the Kodi PC and verify Chromium launches cleanly in fullscreen:
        `chromium --kiosk --app=https://your-game-url.com/?kodi=1`
  - [ ] Confirm calling `window.close()` from the web app cleanly terminates the Chromium process.
- [ ] **Configure HDMI-CEC Remote Input for Chromium**
  - [ ] Test whether TV remote arrow keys already pass through to Chromium via the Linux kernel input layer.
  - [ ] If Kodi holds exclusive `libcec` control, choose and configure the CEC bridge:
    - **Option A (Kodi Keymap / Event Bridge):** Use a background wrapper script that listens to `cec-client` (or Kodi JSON-RPC) and emits keystrokes via `ydotool` (Wayland) or `xdotool` (X11).
    - **Option B (Window Manager Focus):** Ensure the Linux session runs a lightweight window manager (`openbox` on X11 or `cage` on Wayland) so Chromium receives keyboard focus immediately on launch.
- [ ] **Install the Kodi Launcher Add-on**
  - [ ] Create `~/.kodi/addons/script.party.game/addon.xml` and `default.py`.
  - [ ] Implement `xbmc.Player().stop()` and `xbmc.audioSuspend()` before `subprocess.run(...)`, and `xbmc.audioResume()` in the `finally:` block.
  - [ ] Enable the add-on inside Kodi (_Settings $\rightarrow$ Add-ons $\rightarrow$ My add-ons_) and add it to the Kodi Home Screen / Favorites menu.

---

## Phase 7: End-to-End Playtesting

- [ ] **Remote Browser Test:** Open the public URL on a laptop and phone; play through a full pack using mouse clicks and touch taps.
- [ ] **Living Room CEC Test:** Launch the game from the Kodi home screen using only the TV remote; verify audio plays through the TV/receiver, D-pad navigation feels snappy, and clicking **"Quit to Kodi"** restores Kodi with working audio.
```
