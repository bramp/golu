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
  - [x] Place the high-resolution photo of the full Golu display in `raw_photos/` alongside `golu.yaml` (generated from `raw_photos/facts.json`).
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
  - [x] Implement `KIOSK_MODE` state (no title menu): Continuously pan and zoom across dolls on the full Golu image in a kiosk explainer loop, showing each doll's name and `explanation` with a prominent **"Start game"** button ready at all times.
  - [x] Implement `QUESTION_ACTIVE` state: Zoom into the current doll's `region` with a spotlight highlight frame and full-Golu peek toggle, track current question index, and lock out duplicate submissions.
  - [x] Implement `ANSWER_REVEAL` state: Highlight selected vs. correct button, display the `explanation` caption, increment score, and focus the **"Next question"** button.
  - [x] Implement `GAME_OVER` state: Zoom back out to the full Golu display, show final score, and offer **"Play again"** / **"Back to kiosk"** actions.
- [x] **Background Image Preloader (`src/app.ts`)**
  - [x] When rendering question $N$, instantiate `new Image().src = questions[N + 1].image` in the background so the next photo is already decoded in browser memory before the user advances.

---

## Phase 4: 10-Foot TV UI & Unified Input Navigation

- [x] **TV-Safe Layout & Styling (`src/style.css`)**
  - [x] Build a responsive viewport layout using CSS Grid.
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
- [ ] **Cartoon Game Show Host Integration (`src/raja-bommai.ts`)**
  - [x] Build reusable SVG + GSAP `RajaBommaiHost` controller and animation studio (`studio.html`, `src/studio.ts`).
  - [ ] Mount `RajaBommaiHost` inside the main game view (`src/app.ts`) to react across `KIOSK_MODE`, `QUESTION_ACTIVE`, and `ANSWER_REVEAL`.
- [ ] **Audio Effects (Optional)**
  - [ ] Add lightweight Web Audio API synthesized tones (or small `.mp3`/`.ogg` sprites) for D-pad navigation ticks, correct chimes, and wrong buzzers.

---

## Phase 5: Deployment & Online Hosting

- [ ] **Production Build & Offline Caching**
  - [ ] Add a minimal Service Worker (`public/sw.js`) or `vite-plugin-pwa` to cache the app shell and visited WebP assets locally for instant reloads on the Kodi HTPC.
  - [ ] Run `npm run build` and test the production output locally using `npx vite preview`.
- [ ] **Static Hosting Setup**
  - [ ] Deploy the `dist/` directory to Cloudflare Pages (or GitHub Pages).
  - [ ] _(Optional)_ If the photo set grows large, upload `public/assets/*.webp` to a Cloudflare R2 bucket and set `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **Privacy / Access Control**
  - [ ] Configure a Cloudflare Access policy or add a lightweight client-side passcode gate if the family/travel photos shouldn't be publicly indexed.
  - [ ] Add `<meta name="robots" content="noindex, nofollow">` to `index.html`.

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
