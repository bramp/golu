# Golu

A static, single-image Navaratri Golu party trivia game and always-on TV kiosk
explainer. Play with a mouse, touch screen, or directional TV remote. No backend,
accounts, or runtime database.

by Andrew Brampton ([bramp.net](https://bramp.net)) (c) 2026

## Quick start

Install Node.js 24, [uv](https://docs.astral.sh/uv/), and
[pre-commit](https://pre-commit.com/), then:

```sh
make setup
make dev
```

Open the local URL printed by Vite. A bundled, original illustration pack lets you
explore kiosk mode and play immediately without providing or publishing personal photos.

## Project layout

```text
src/                     Vanilla TypeScript app, kiosk/trivia state machine, Raja Bommai rig, tests
public/demo/             Fallback demo manifest and illustration with region coordinates
public/questions.json    Generated question manifest
public/assets/           Generated WebP master Golu image (EXIF/GPS stripped)
raw_photos/              Input Golu config (`golu.yaml`) and local source photos (`*.jpg` gitignored)
scripts/build_assets.py  Offline Python CLI
tests/                   Asset pipeline tests
.github/                 CI and dependency update configuration
```

The architecture is described in [DESIGN.md](DESIGN.md). That document contains
sketches; the runnable CLI is in `scripts/build_assets.py`, with its supported
contract documented below.

## Build your Golu manifest

Place your full-Golu photo and a `golu.yaml` (or `golu.json` / `golu.yml`) manifest in
`raw_photos/`:

```text
raw_photos/
  golu.jpg
  golu.yaml
```

Example `raw_photos/golu.yaml`:

```yaml
title: Navaratri Golu Trivia
pack: Our Golu Padi
image: golu.jpg
dolls:
  - name: Marapachi Dolls
    region: { x: 0.42, y: 0.18, width: 0.16, height: 0.22 }
    prompt: Which traditional wooden pair stands on the top step?
    explanation: Carved from red sandalwood, Marapachi bride and groom dolls are a traditional wedding gift.
  - name: Thanjavur Thalaiyatti Bommai
    region: { x: 0.18, y: 0.44, width: 0.2, height: 0.24 }
    prompt: Which bobblehead dancer sways on the middle step?
    explanation: Handcrafted in Thanjavur with a weighted clay base so it dances gently when tapped.
  - name: Dashavatara Set
    region: { x: 0.48, y: 0.5, width: 0.36, height: 0.2 }
    explanation: The ten avatars of Lord Vishnu arranged in chronological order.
  - name: Chettiar Couple
    region: { x: 0.12, y: 0.72, width: 0.22, height: 0.22 }
    explanation: Traditional merchant couple surrounded by miniature groceries, grains, and spices.
```

Run the offline asset pipeline:

```sh
make assets
# Or customize the build:
uv run python scripts/build_assets.py \
  --input raw_photos --output public --title "Navaratri Golu Trivia"
```

Supported inputs: JPEG, PNG, WebP, HEIC, HEIF. The master Golu image is oriented,
kept at full resolution by default (or optionally capped with `--max-dimension`), and
saved as a high-quality pixel-only WebP file (`--quality 92` by default, or lossless at
`--quality 100`). EXIF, GPS, XMP, and ICC metadata are not copied. A capture month/year
can appear in default explanations; override `explanation` if you don't want to reveal
it. Visible faces, locations, answers, and captions are **not** anonymized.

Authoring details:

- Each entry in `dolls` supports `name`, `answer` (defaults to `name`), `region`
  (`{ x, y, width, height }` normalized to `0..1`), `prompt`, `explanation`, and either
  `distractors` (3 wrong choices) or `options` (4 ordered choices including `answer`).
- When `distractors` and `options` are omitted, other doll names in `dolls` are sampled
  deterministically as wrong choices.
- Folder-based packs (`raw_photos/<pack>/<answer>/<photo>`) and per-photo/folder
  `meta.json`/`meta.yaml` sidecars remain supported for backward compatibility.
- Malformed metadata or out-of-bounds `region` coordinates (`x + width > 1` or
  `y + height > 1`) fail the build rather than silently using defaults.
- Image cache keys include source bytes, encoder versions, and quality. Unchanged
  inputs produce a byte-identical manifest. `--force` re-encodes cached images.
- Builds replace `questions.json` only on success. Old unreferenced images are retained;
  use a fresh output directory when preparing a privacy-sensitive release.

The app requests `questions.json` first. A **404 only** selects the demo pack; invalid
JSON, server failures, and wrong content types show an error rather than pretending
your pack loaded. If your host rewrites missing files to HTML, configure a real 404
for `questions.json` or publish a generated manifest.

## Development commands

| Command        | Purpose                                   |
| -------------- | ----------------------------------------- |
| `make setup`   | Install locked dependencies and Git hook  |
| `make dev`     | Start Vite development server             |
| `make assets`  | Build private Golu photo into `public/`   |
| `make format`  | Format web/Python files and fix Ruff lint |
| `make analyze` | Lint, type-check, and check formatting    |
| `make test`    | Run frontend and pipeline tests           |
| `make build`   | Type-check and build static `dist/`       |
| `make preview` | Serve the production build locally        |
| `make test-ci` | Run the same checks as GitHub Actions     |

Pre-commit runs hygiene checks, formatting checks, language-specific analysis, and
tests. Run `pre-commit run --all-files` after staging new files to check everything.
Dependency lockfiles are committed; `npm ci` and `uv sync --locked` reproduce them.
The original design documents are excluded from Prettier to preserve their sketches.

## Kiosk mode, gameplay, and remote controls

There is no static title menu. When idle, the app runs an always-on **kiosk explainer**
on the TV—zooming into different dolls across the single full-Golu image, showing each
doll's name and story (`explanation`), and keeping **"Start game"** focused so a single
`Enter` press launches a trivia round immediately.

During a trivia round, each question zooms into that doll's `region` on the full Golu
image and presents four choices in a 2x2 grid. Answers reveal immediately with the
doll's story; scoring happens once per question. Finishing a round zooms back out to
the full Golu overview with **"Play again"** and **"Back to kiosk"**.

Arrow keys move focus, Enter/Space activate native buttons, and Backspace/Escape
return to the kiosk explainer. Pointer/touch use the same controls. The answer grid
stays two columns on mobile so its up/down navigation matches the screen.

## Build and hosting

The game is hosted on GitHub Pages at <https://golu.bramp.net/>.
GitHub Actions runs `make test-ci` on pull requests and pushes to `main`.
Only successful pushes to `main` deploy the tested `dist/` artifact; pull requests
never deploy. The workflow can also be run manually on `main` from the Actions tab.

Repository and domain setup:

1. In **Settings > Pages**, select **GitHub Actions** as the build source.
2. Set the custom domain to `golu.bramp.net`. `public/CNAME` is also copied into
   `dist/CNAME` by Vite.
3. At the DNS provider, add a CNAME record for `golu` pointing to
   `bramp.github.io` (not the repository URL).
4. Once DNS is verified and GitHub has issued the certificate, enable
   **Enforce HTTPS** in the Pages settings.

To validate or preview the production build locally:

```sh
make test-ci
make preview
```

Vite uses a relative base, so deployment under a subdirectory works. The runtime
resolves generated image URLs relative to that base. Serve over HTTP(S), not `file://`.
CI tests, builds, and deploys the checked-in `public/questions.json` and
`public/assets/` bundle (generated via `make assets`, which strips EXIF/GPS metadata
from the raw camera photo).

**Gitignored does not mean unpublished:** Vite copies generated content in `public/`
into `dist/`. Inspect the output before deployment and use real host-level access
control (for example Cloudflare Access) for private packs. `noindex` and a JavaScript
passcode are not authentication.

## Kodi status and next steps

`?kodi=1` exposes a "Quit to Kodi" guidance screen. It deliberately does **not** claim
to close Chromium: `window.close()` is not dependable for a window opened by an OS
launcher. A real launcher needs an explicit, local exit mechanism and must restore
Kodi audio in a `finally` block.

The Python launcher, device-specific CEC-to-keyboard bridge, optional countdown,
question randomization, and service-worker/offline caching are not implemented in
this bootstrap. Validate CEC input and audio hand-off on the target Linux HTPC
before shipping them. Browser caching alone does not guarantee offline play.
