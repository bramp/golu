# Golu

A static, photo-powered party trivia game. Play with a mouse, touch screen, or
directional remote. No backend, accounts, or runtime database.

by Andrew Brampton ([bramp.net](https://bramp.net)) (c) 2026

## Quick start

Install Node.js 24, [uv](https://docs.astral.sh/uv/), and
[pre-commit](https://pre-commit.com/), then:

```sh
make setup
make dev
```

Open the local URL printed by Vite. A bundled, original illustration pack lets you
play immediately without providing or publishing personal photos.

## Project layout

```text
src/                     Vanilla TypeScript app, state machine, input controller, tests
public/demo/             Public-safe demo manifest and illustration
public/questions.json    Generated personal question manifest (gitignored)
public/assets/           Generated WebP photos (gitignored)
raw_photos/              Private input photos and sidecars (gitignored)
scripts/build_assets.py  Offline Python CLI
tests/                   Asset pipeline tests
.github/                 CI and dependency update configuration
```

The architecture is described in [DESIGN.md](DESIGN.md). That document contains
sketches; the runnable CLI is in `scripts/build_assets.py`, with its supported
contract documented below.

## Build your own packs

Arrange photos as `<pack>/<correct answer>/<photo>`:

```text
raw_photos/
  Holiday & Travel/
    Munich/
      palace.jpg
      palace.json
    Vienna/
      gardens.heic
    Moab/
      hike.png
```

```sh
make assets
# Or customize the build:
uv run python scripts/build_assets.py \
  --input raw_photos --output public --title "Family & Friends Trivia"
```

Supported inputs: JPEG, PNG, WebP, HEIC, HEIF. Images are oriented, scaled to fit
1920x1080 without upscaling, and saved as pixel-only WebP files. EXIF, GPS, XMP, and
ICC metadata are not copied. A capture month/year can appear in the explanation;
override `explanation` if you don't want to reveal it. Visible faces, locations,
folder-derived answers, and captions are **not** anonymized.

Add optional JSON or YAML sidecars:

```json
{
  "prompt": "Which palace did we visit?",
  "answer": "Nymphenburg Palace",
  "distractors": ["Schonbrunn Palace", "Belvedere Palace", "Sanssouci Palace"],
  "explanation": "A freezing walk through Munich!"
}
```

- Per-photo: `palace.json`, `palace.yaml`, or `palace.yml`.
- Folder defaults: `meta.json`, `meta.yaml`, or `meta.yml` at input root, pack,
  or answer folder. More specific keys override parent keys.
- `options` can specify exactly four ordered choices including `answer`, instead
  of `distractors`. All choices must be distinct, ignoring case and whitespace.
- Only one sidecar format is allowed per photo/folder. Malformed or ambiguous
  metadata fails the build rather than silently using defaults.
- Fallback distractors are city names. Use explicit choices for non-location packs,
  and override `prompt` for year/person/event packs.
- IDs depend on relative paths, so unrelated pack additions don't renumber them.
  Renaming/moving a photo intentionally changes its question ID.
- Image cache keys include source bytes, encoder versions, and quality. Unchanged
  inputs produce a byte-identical manifest. `--force` re-encodes cached images.
- Builds replace the manifest only on success. Old unreferenced images are retained;
  use a fresh output directory when preparing a privacy-sensitive release.
- Avoid photos named `meta.*`: that stem is reserved for folder defaults.

The app requests `questions.json` first. A **404 only** selects the demo pack; invalid
JSON, server failures, and wrong content types show an error rather than pretending
your pack loaded. If your host rewrites missing files to HTML, configure a real 404
for `questions.json` or publish a generated manifest.

## Development commands

| Command        | Purpose                                   |
| -------------- | ----------------------------------------- |
| `make setup`   | Install locked dependencies and Git hook  |
| `make dev`     | Start Vite development server             |
| `make assets`  | Build private photos into `public/`       |
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

## Gameplay and remote controls

Choose a round length (5, 10, or 20), then a pack. Small packs use all their questions.
This starter takes questions in manifest order. Answers reveal immediately; scoring
happens once per question. Replay starts a fresh round.

Arrow keys move focus, Enter/Space activate native buttons, and Backspace/Escape
return to the menu. Pointer/touch use the same controls. The answer grid stays two
columns on mobile so its up/down navigation matches the screen.

## Build and hosting

```sh
make test-ci
# Upload the contents of dist/ to a static host.
```

Vite uses a relative base, so deployment under a subdirectory works. The runtime
resolves generated image URLs relative to that base. Serve over HTTP(S), not `file://`.
CI tests and builds demo content only. No deployment workflow is enabled yet: choose
a host and access policy before uploading family media.

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
