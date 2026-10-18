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
META_KEYS = {
    "name",
    "answer",
    "prompt",
    "explanation",
    "distractors",
    "options",
    "region",
}
GOLU_CONFIG_KEYS = {"title", "pack", "image", "prompt", "dolls"}
REGION_KEYS = {"x", "y", "width", "height"}


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_region(value: object, context: str) -> dict[str, float]:
    if not isinstance(value, dict) or set(value) != REGION_KEYS:
        raise ValueError(
            f"{context}: region must be an object with keys {sorted(REGION_KEYS)}"
        )
    coords: dict[str, float] = {}
    for key in ("x", "y", "width", "height"):
        raw = value[key]
        if isinstance(raw, bool) or not isinstance(raw, int | float):
            raise ValueError(f"{context}: region.{key} must be a number in [0, 1]")
        coord = float(raw)
        if not 0.0 <= coord <= 1.0:
            raise ValueError(f"{context}: region.{key} must be between 0 and 1")
        coords[key] = coord
    if coords["width"] <= 0 or coords["height"] <= 0:
        raise ValueError(f"{context}: region width and height must be > 0")
    if coords["x"] + coords["width"] > 1.000001 or (
        coords["y"] + coords["height"] > 1.000001
    ):
        raise ValueError(
            f"{context}: region exceeds image bounds (x+width or y+height > 1)"
        )
    return coords


def validate_meta_dict(meta: object, context: str) -> dict:
    if not isinstance(meta, dict) or set(meta) - META_KEYS:
        raise ValueError(f"{context}: metadata must be an object with keys {META_KEYS}")
    validated = dict(meta)
    for key, value in meta.items():
        if key in {"options", "distractors"}:
            if not isinstance(value, list) or not all(
                isinstance(item, str) and item.strip() for item in value
            ):
                raise ValueError(f"{context}: {key} must contain non-empty strings")
        elif key == "region":
            validated["region"] = validate_region(value, context)
        elif not isinstance(value, str) or not value.strip():
            raise ValueError(f"{context}: {key} must be a non-empty string")
    return validated


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
    return validate_meta_dict(meta, str(path))


def load_golu_config(input_dir: Path) -> tuple[Path, dict] | None:
    paths = [input_dir / f"golu{extension}" for extension in (".json", ".yaml", ".yml")]
    existing = [path for path in paths if path.is_file()]
    if not existing:
        return None
    if len(existing) > 1:
        raise ValueError(f"Ambiguous Golu configs: {', '.join(map(str, existing))}")
    path = existing[0]
    try:
        content = path.read_text(encoding="utf-8")
        config = (
            json.loads(content) if path.suffix == ".json" else yaml.safe_load(content)
        )
    except (json.JSONDecodeError, yaml.YAMLError) as error:
        raise ValueError(f"Invalid Golu config in {path}: {error}") from error
    if not isinstance(config, dict) or set(config) - GOLU_CONFIG_KEYS:
        raise ValueError(
            f"{path}: Golu config must be an object with keys {GOLU_CONFIG_KEYS}"
        )
    for key in ("title", "pack", "image", "prompt"):
        if key in config and (
            not isinstance(config[key], str) or not config[key].strip()
        ):
            raise ValueError(f"{path}: {key} must be a non-empty string")
    dolls = config.get("dolls")
    if not isinstance(dolls, list) or not dolls:
        raise ValueError(f"{path}: dolls must be a non-empty list")
    return path, config


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


def build_from_golu_config(
    input_dir: Path,
    output_dir: Path,
    config_path: Path,
    config: dict,
    default_title: str,
    default_prompt: str,
    quality: int,
    force: bool,
) -> dict:
    title = config.get("title", default_title)
    pack_name = config.get("pack", "Our Golu Padi")
    config_prompt = config.get("prompt", default_prompt)
    if "image" in config:
        source = (input_dir / config["image"]).resolve()
        if (
            not source.is_relative_to(input_dir)
            or not source.is_file()
            or source.suffix.lower() not in SUPPORTED_EXTENSIONS
        ):
            raise ValueError(
                f"{config_path}: image not found or unsupported: {config['image']}"
            )
    else:
        images = [
            path
            for path in sorted(input_dir.iterdir())
            if path.is_file()
            and not path.name.startswith(".")
            and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        if len(images) != 1:
            raise ValueError(
                f"{config_path}: specify 'image' when {input_dir} "
                "does not have exactly one image"
            )
        source = images[0]

    try:
        master_image, date = process_image(
            source, output_dir / "assets", quality, force
        )
    except (ValueError, OSError) as error:
        raise ValueError(f"{source}: {error}") from error

    dolls = config["dolls"]
    validated_dolls: list[dict] = []
    candidates: list[str] = []
    for index, raw_doll in enumerate(dolls):
        context = f"{config_path}#dolls[{index}]"
        doll = validate_meta_dict(raw_doll, context)
        answer = doll.get("answer") or doll.get("name")
        if not answer:
            raise ValueError(f"{context}: each doll requires 'name' or 'answer'")
        doll["answer"] = answer
        doll["name"] = doll.get("name", answer)
        candidates.append(answer)
        validated_dolls.append(doll)

    questions = []
    seen_ids: set[str] = set()
    for index, doll in enumerate(validated_dolls):
        answer = doll["answer"]
        name = doll["name"]
        seed_input = f"{source.relative_to(input_dir).as_posix()}:{index}:{name}"
        question_id = "q_" + digest(seed_input.encode())
        if question_id in seen_ids:
            raise ValueError(f"{config_path}: duplicate doll entry {name!r}")
        seen_ids.add(question_id)
        try:
            options, correct_index = build_options(
                answer, candidates, question_id, doll
            )
        except ValueError as error:
            raise ValueError(f"{config_path}#dolls[{index}]: {error}") from error
        explanation = doll.get(
            "explanation",
            f"{name} - taken in {date}." if date else f"Correct answer: {answer}",
        )
        question: dict = {
            "id": question_id,
            "name": name,
            "image": master_image,
            "prompt": doll.get("prompt", config_prompt),
            "options": options,
            "correctIndex": correct_index,
            "explanation": explanation,
        }
        if "region" in doll:
            question["region"] = doll["region"]
        questions.append(question)

    pack_id = "pack_" + digest(pack_name.encode())
    return {
        "title": title,
        "image": master_image,
        "packs": [{"id": pack_id, "name": pack_name, "questions": questions}],
    }


def scan_and_build(
    input_dir: Path,
    output_dir: Path,
    title: str = "Photo Trivia",
    default_prompt: str = "Which doll is highlighted on the Golu?",
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
    golu_loaded = load_golu_config(input_dir)
    if golu_loaded is not None:
        config_path, config = golu_loaded
        payload = build_from_golu_config(
            input_dir,
            output_dir,
            config_path,
            config,
            title,
            default_prompt,
            quality,
            force,
        )
    else:
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
                    question: dict = {
                        "id": question_id,
                        "image": image,
                        "prompt": meta.get("prompt", default_prompt),
                        "options": options,
                        "correctIndex": correct_index,
                        "explanation": explanation,
                    }
                    if "name" in meta:
                        question["name"] = meta["name"]
                    if "region" in meta:
                        question["region"] = meta["region"]
                    questions.append(question)
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
                f"No supported photos or golu.yaml/json found under {input_dir}"
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
