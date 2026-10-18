import argparse
import datetime
import hashlib
import json
import random
import sys
from pathlib import Path

import PIL
import pillow_heif
import yaml
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
FALLBACK_DISTRACTORS = [
    "London",
    "Paris",
    "Tokyo",
    "New York",
    "Sydney",
    "Rome",
    "Barcelona",
    "Amsterdam",
    "Reykjavik",
    "Vancouver",
    "Berlin",
]
META_KEYS = {"answer", "prompt", "explanation", "distractors", "options"}


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def load_meta(stem: Path) -> dict:
    paths = [
        stem.with_name(stem.name + extension)
        for extension in (".json", ".yaml", ".yml")
    ]
    existing = [path for path in paths if path.is_file()]
    if not existing:
        return {}
    if len(existing) > 1:
        raise ValueError(f"Ambiguous sidecars: {', '.join(map(str, existing))}")
    path = existing[0]
    try:
        content = path.read_text(encoding="utf-8")
        meta = (
            json.loads(content) if path.suffix == ".json" else yaml.safe_load(content)
        )
    except (json.JSONDecodeError, yaml.YAMLError) as error:
        raise ValueError(f"Invalid metadata in {path}: {error}") from error
    if not isinstance(meta, dict) or set(meta) - META_KEYS:
        raise ValueError(f"{path}: metadata must be an object with keys {META_KEYS}")
    for key, value in meta.items():
        if key in {"options", "distractors"}:
            if not isinstance(value, list) or not all(
                isinstance(item, str) and item.strip() for item in value
            ):
                raise ValueError(f"{path}: {key} must contain non-empty strings")
        elif not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}: {key} must be a non-empty string")
    return meta


def extract_exif_date(image: Image.Image) -> str | None:
    exif = image.getexif()
    date = exif.get(36867) or exif.get_ifd(0x8769).get(36867) or exif.get(306)
    if date is None:
        return None
    try:
        return datetime.datetime.strptime(str(date)[:10], "%Y:%m:%d").strftime("%B %Y")
    except ValueError:
        print(f"Warning: ignoring invalid EXIF date {date!r}", file=sys.stderr)
        return None


def process_image(
    source: Path,
    assets: Path,
    quality: int = 82,
    force: bool = False,
) -> tuple[str, str | None]:
    recipe = f"golu-v1:1920x1080:{quality}:{PIL.__version__}:{pillow_heif.__version__}"
    key = digest(source.read_bytes() + recipe.encode())
    filename = f"img_{key}.webp"
    destination = assets / filename
    with Image.open(source) as original:
        date = extract_exif_date(original)
        if not destination.exists() or force:
            image = ImageOps.exif_transpose(original)
            image.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
            mode = "RGBA" if image.has_transparency_data else "RGB"
            # A fresh pixel-only image also drops ICC profiles, XMP, and EXIF.
            clean = Image.new(mode, image.size)
            clean.paste(image.convert(mode))
            assets.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(".tmp")
            try:
                clean.save(temporary, format="WEBP", quality=quality, method=6)
                temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)
    return f"assets/{filename}", date


def build_options(
    answer: str, candidates: list[str], seed: str, meta: dict
) -> tuple[list[str], int]:
    def normalized(values: list[str]) -> list[str]:
        return [value.strip().casefold() for value in values]

    if "options" in meta and "distractors" in meta:
        raise ValueError("Specify either options or distractors, not both")
    if "options" in meta:
        options = meta["options"]
        if len(options) != 4 or answer not in options:
            raise ValueError("options must contain four choices, including the answer")
    else:
        rng = random.Random(seed)
        if "distractors" in meta:
            wrong = meta["distractors"]
            if len(wrong) != 3:
                raise ValueError("distractors must contain exactly three choices")
        else:
            pool: dict[str, str] = {}
            for candidate in candidates:
                if candidate.strip().casefold() != answer.strip().casefold():
                    pool.setdefault(candidate.strip().casefold(), candidate)
            if len(pool) < 3:
                for candidate in FALLBACK_DISTRACTORS:
                    if candidate.strip().casefold() != answer.strip().casefold():
                        pool.setdefault(candidate.strip().casefold(), candidate)
            wrong = rng.sample(list(pool.values()), 3)
        options = [answer, *wrong]
        rng.shuffle(options)
    if len(set(normalized(options))) != 4:
        raise ValueError(
            "Answers must be unique (ignoring case and surrounding spaces)"
        )
    return options, options.index(answer)


def scan_and_build(
    input_dir: Path,
    output_dir: Path,
    title: str = "Photo Trivia",
    default_prompt: str = "Where was this photo taken?",
    quality: int = 82,
    force: bool = False,
) -> dict:
    input_dir, output_dir = input_dir.resolve(), output_dir.resolve()
    if not input_dir.is_dir():
        raise ValueError(f"Input directory does not exist: {input_dir}")
    if input_dir.is_relative_to(output_dir) or output_dir.is_relative_to(input_dir):
        raise ValueError("Input and output directories must not overlap")
    if not 1 <= quality <= 100:
        raise ValueError("quality must be between 1 and 100")
    if not title.strip() or not default_prompt.strip():
        raise ValueError("title and prompt must not be empty")
    root_meta = load_meta(input_dir / "meta")
    packs = []
    for pack_dir in sorted(input_dir.iterdir()):
        if not pack_dir.is_dir() or pack_dir.name.startswith("."):
            continue
        pack_meta = root_meta | load_meta(pack_dir / "meta")
        answer_dirs = [
            path
            for path in sorted(pack_dir.iterdir())
            if path.is_dir() and not path.name.startswith(".")
        ]
        candidates = [path.name for path in answer_dirs]
        questions = []
        for answer_dir in answer_dirs:
            folder_meta = pack_meta | load_meta(answer_dir / "meta")
            for source in sorted(answer_dir.iterdir()):
                if (
                    not source.is_file()
                    or source.name.startswith(".")
                    or source.suffix.lower() not in SUPPORTED_EXTENSIONS
                ):
                    continue
                meta = folder_meta | load_meta(source.with_suffix(""))
                question_id = "q_" + digest(
                    source.relative_to(input_dir).as_posix().encode()
                )
                answer = meta.get("answer", answer_dir.name)
                try:
                    options, correct_index = build_options(
                        answer, candidates, question_id, meta
                    )
                    image, date = process_image(
                        source, output_dir / "assets", quality, force
                    )
                except (ValueError, OSError) as error:
                    raise ValueError(f"{source}: {error}") from error
                explanation = meta.get(
                    "explanation",
                    f"{answer} - taken in {date}."
                    if date
                    else f"Correct answer: {answer}",
                )
                questions.append(
                    {
                        "id": question_id,
                        "image": image,
                        "prompt": meta.get("prompt", default_prompt),
                        "options": options,
                        "correctIndex": correct_index,
                        "explanation": explanation,
                    }
                )
        if questions:
            packs.append(
                {
                    "id": "pack_" + digest(pack_dir.name.encode()),
                    "name": pack_dir.name,
                    "questions": questions,
                }
            )
    if not packs:
        raise ValueError(
            f"No supported photos found under {input_dir}/<pack>/<answer>/"
        )
    payload = {"title": title, "packs": packs}
    manifest = {
        "version": digest(json.dumps(payload, sort_keys=True).encode()),
        **payload,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    temporary = output_dir / "questions.json.tmp"
    try:
        temporary.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        temporary.replace(output_dir / "questions.json")
    finally:
        temporary.unlink(missing_ok=True)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build photos into static trivia packs and 1080p WebP images."
    )
    parser.add_argument("-i", "--input", type=Path, default=Path("raw_photos"))
    parser.add_argument("-o", "--output", type=Path, default=Path("public"))
    parser.add_argument("--title", default="Photo Trivia")
    parser.add_argument("--prompt", default="Where was this photo taken?")
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        manifest = scan_and_build(
            args.input, args.output, args.title, args.prompt, args.quality, args.force
        )
    except (ValueError, OSError) as error:
        parser.exit(1, f"Error: {error}\n")
    total = sum(len(pack["questions"]) for pack in manifest["packs"])
    print(f"Wrote {total} questions to {args.output / 'questions.json'}")


if __name__ == "__main__":
    main()
