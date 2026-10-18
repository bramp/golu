# Golu Manifest Generation & Fact-Checking Workflow

This directory holds the source Golu photo (gitignored) and [`golu.yaml`](./golu.yaml), the source-of-truth manifest used by `make assets` (`scripts/build_assets.py`) to build `public/questions.json`.

Below is a repeatable two-stage workflow for:
1. **Generating** an initial `raw_photos/golu.yaml` manifest from a high-resolution photo of a Navaratri Golu display.
2. **Fact-checking** `raw_photos/golu.yaml` against high-resolution zoomed crops of each region so that AI hallucinations (invented animals, wrong poses, swapped iconography, or loose bounding boxes) are caught and corrected before publishing.

---

## Why a Two-Pass Workflow?

When a vision model inspects a full 4000×3000 photo of an entire Golu display in a single pass, each individual doll is only 150–300 pixels tall. At that scale, models frequently **infer** conventional iconography rather than reporting what is literally visible in the photo—for example:
- Assuming a small figure at Radha and Krishna's feet is a **cow/calf** when it is actually a **reclining baby/child**.
- Assuming Gaja Lakshmi's elephants hold **golden water pots** when they actually hold **pink lotuses**.
- Calling a standing idol **seated** (or vice versa).
- Mistaking a checkered floor platform for a **chessboard**.

Cropping each bounding box at native resolution (`make review-crops`) and running a second, skeptical verification pass eliminates these errors.

---

## Stage 1: Generate Initial `raw_photos/golu.yaml`

Place your full-resolution Golu photo in `raw_photos/` (for example `raw_photos/golu.jpg`) and give the following prompt to a vision-capable agent or LLM:

````markdown
Inspect the full Golu photo at `raw_photos/<PHOTO_FILENAME>` and generate `raw_photos/golu.yaml`.

### Schema Requirements
The YAML file must follow this exact structure understood by `scripts/build_assets.py`:

```yaml
title: Navaratri Golu Trivia
pack: Our Golu Padi
image: <PHOTO_FILENAME>
prompt: Which doll or set is highlighted on the Golu?
dolls:
  - name: <Concise, recognizable name of the doll or set>
    region:
      x: <0.0 to 1.0, left edge>
      y: <0.0 to 1.0, top edge>
      width: <0.0 to 1.0>
      height: <0.0 to 1.0>
    explanation: <2-3 sentences: 1 sentence describing what is visually depicted, followed by 1-2 sentences of cultural/mythological context or fun facts.>
```

### Authoring Rules
1. **Scan shelf by shelf (top tier to bottom tier, left to right):**
   - Identify both individual standout dolls and cohesive multi-doll sets (e.g., Rama Darbar, Ashta Lakshmi, Dashavatara, Bhakti Saints, village scenes).
   - You may include both a wide bounding box for a full row/set (e.g., Ashta Lakshmi) and tight bounding boxes for 1–2 standout dolls within that row (e.g., Gaja Lakshmi, Santana Lakshmi).
2. **Normalized coordinates (`region`):**
   - Remember to apply EXIF orientation (`ImageOps.exif_transpose`) before measuring coordinates.
   - `x`, `y`, `width`, `height` must be floats rounded to 3 decimal places in `[0, 1]`, with `x + width <= 1.0` and `y + height <= 1.0`.
   - Frame the doll(s) tightly from crown/halo to base without clipping heads or including unrelated neighboring dolls.
3. **Describe only what is visually present:**
   - Do NOT assume standard iconography (such as a parrot, cow, water pot, brick, or specific instrument) unless you can actually see it on the doll.
   - Distinguish clearly between **visual description** ("depicted here with...") and **cultural context** ("traditionally associated with...").
````

---

## Stage 2: Visual Crop Fact-Check Workflow

Never trust a single-pass full-image generation without inspecting native-resolution crops of every bounding box.

### Step 2a: Generate Labeled High-Resolution Crops

Run `make review-crops` (or `uv run python scripts/crop_regions.py`) to extract every doll's exact `region` (`card_XX.jpg`), a 15%-padded context crop with the red bounding box drawn (`padded_XX.jpg`), and a full annotated `overview.jpg` into `/tmp/golu_review`:

```sh
make review-crops
```

### Step 2b: Run the Fact-Checking Prompt

Give the following prompt to your vision-capable agent to audit every crop in `/tmp/golu_review`:

```markdown
Fact-check `raw_photos/golu.yaml` by running `make review-crops` and viewing the high-resolution crop files in `/tmp/golu_review/` (`overview.jpg`, `card_00.jpg` .. `card_NN.jpg`, and `padded_00.jpg` .. `padded_NN.jpg`).

For EVERY entry in `raw_photos/golu.yaml`, check the high-resolution crop and verify:

1. **Zero Visual Hallucinations:**
   - Does the crop actually contain every figure, animal, instrument, or prop claimed in `name` and `explanation`?
   - Are figures standing or seated as described?
   - What are the figures actually holding in their hands or at their feet? (Watch out for classic iconography traps: e.g., assuming a baby/child is a calf, assuming lotuses held by elephants are water pots, assuming a tiled base is a chessboard, or assuming unseen parrots/weapons are visible.)
2. **Accurate Identity & Count:**
   - For multi-doll sets, count the figures from left to right and verify the sequence described in `explanation` matches the actual dolls in the crop.
   - When specific saint or deity names cannot be proven visually from the doll's features alone, phrase them appropriately or keep the focus on verifiable details and cultural tradition.
3. **Bounding Box Precision (`padded_XX.jpg`):**
   - Does the red rectangle tightly enclose the target doll(s) without slicing off crowns, weapons, or outermost figures of a set?
   - Does it accidentally include half of an unrelated neighboring doll or foreground lamp?

Produce a table of findings (`#`, `Name`, `Status`, `Visual Reality vs. Claim`, `Recommended Fix`), update `raw_photos/golu.yaml`, and run `make assets && make test` to rebuild `public/questions.json`.
```
