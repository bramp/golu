import argparse
import asyncio
import datetime
import hashlib
import json
import random
import sys
from collections.abc import Callable
from pathlib import Path

import edge_tts
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
    "tts_name",
    "tts_explanation",
}
DEFAULT_QUALITY = 92
DEFAULT_TTS_VOICE = "en-IN-PrabhatNeural"
DEFAULT_TTS_RATE = "+16%"
DEFAULT_TTS_PITCH = "+10Hz"
GOLU_CONFIG_KEYS = {
    "title",
    "pack",
    "image",
    "prompt",
    "voice",
    "rate",
    "pitch",
    "dolls",
}
REGION_KEYS = {"x", "y", "width", "height"}
HOST_STINGERS: dict[str, list[str]] = {
    "welcome": [
        "Vanakkam and Namaste! Welcome to the Grand Navaratri Golu Quiz!",
        "Step right up to the Kolu Padi, friends! Let's play!",
    ],
    "correct": [
        "Shabash! Spot on! That wins you the Golden Kalash bonus!",
        "Brilliant answer! You know your Golu traditions inside and out!",
    ],
    "wrong": [
        "Ayyo! So close, my friend! Let's take a closer look at this doll.",
        "Ooh, not quite that one! Here is the story behind this doll.",
    ],
}
OPTION_LABELS = ("Option A", "Option B", "Option C", "Option D")
TTS_CONCURRENCY = 4
TtsSynthesizer = Callable[[str, str, Path], None]


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
    for key in ("title", "pack", "image", "prompt", "voice", "rate", "pitch"):
        if key in config and (
            not isinstance(config[key], str) or not config[key].strip()
        ):
            raise ValueError(f"{path}: {key} must be a non-empty string")
    dolls = config.get("dolls")
    if not isinstance(dolls, list) or not dolls:
        raise ValueError(f"{path}: dolls must be a non-empty list")
    return path, config


def normalize_tts_text(value: str) -> str:
    cleaned = " ".join(value.replace(" / ", " or ").split())
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned


def build_question_tts_scripts(
    name: str,
    prompt: str,
    options: list[str],
    explanation: str,
    tts_name: str | None = None,
    tts_explanation: str | None = None,
) -> dict[str, str]:
    spoken_name = normalize_tts_text(tts_name or name)
    spoken_explanation = normalize_tts_text(tts_explanation or explanation)
    spoken_prompt = normalize_tts_text(prompt)
    option_parts = [
        f"{label}: {normalize_tts_text(option)}"
        for label, option in zip(OPTION_LABELS, options, strict=True)
    ]
    return {
        "question": f"{spoken_prompt} {' '.join(option_parts)}",
        "reveal": f"That is {spoken_name} {spoken_explanation}",
    }


def _tts_recipe_key(text: str, voice: str, rate: str, pitch: str) -> str:
    prosody = "" if (rate == "+0%" and pitch == "+0Hz") else f":{rate}:{pitch}"
    return f"golu-tts-v1:{voice}{prosody}:{text}"


def edge_tts_synthesize(
    text: str,
    voice: str,
    destination: Path,
    rate: str = DEFAULT_TTS_RATE,
    pitch: str = DEFAULT_TTS_PITCH,
) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    communicate.save_sync(str(destination))


def process_audio_clip(
    text: str,
    assets: Path,
    voice: str = DEFAULT_TTS_VOICE,
    rate: str = DEFAULT_TTS_RATE,
    pitch: str = DEFAULT_TTS_PITCH,
    force: bool = False,
    synthesizer: TtsSynthesizer | None = None,
) -> str:
    normalized = " ".join(text.split())
    key = digest(_tts_recipe_key(normalized, voice, rate, pitch).encode())
    filename = f"audio_{key}.mp3"
    destination = assets / filename
    if not destination.exists() or force:
        assets.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".tmp")
        try:
            if synthesizer is not None:
                synthesizer(normalized, voice, temporary)
            else:
                edge_tts_synthesize(
                    normalized, voice, temporary, rate=rate, pitch=pitch
                )
            if not temporary.exists() or temporary.stat().st_size == 0:
                raise OSError(f"TTS synthesizer produced an empty file for {text!r}")
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
    return f"assets/{filename}"


async def _synthesize_pending_async(
    pending: list[tuple[str, str, str, str, Path]],
) -> None:
    semaphore = asyncio.Semaphore(TTS_CONCURRENCY)

    async def worker(
        text: str, voice: str, rate: str, pitch: str, destination: Path
    ) -> None:
        async with semaphore:
            temporary = destination.with_suffix(".tmp")
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
                await communicate.save(str(temporary))
                if not temporary.exists() or temporary.stat().st_size == 0:
                    raise OSError(f"edge-tts produced an empty audio file for {text!r}")
                temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)

    await asyncio.gather(*(worker(t, v, r, p, d) for t, v, r, p, d in pending))


def synthesize_audio_batch(
    texts: list[str],
    assets: Path,
    voice: str = DEFAULT_TTS_VOICE,
    rate: str = DEFAULT_TTS_RATE,
    pitch: str = DEFAULT_TTS_PITCH,
    force: bool = False,
    synthesizer: TtsSynthesizer | None = None,
) -> dict[str, str]:
    results: dict[str, str] = {}
    pending: list[tuple[str, str, str, str, Path]] = []
    seen_destinations: set[Path] = set()
    assets.mkdir(parents=True, exist_ok=True)

    for text in texts:
        normalized = " ".join(text.split())
        key = digest(_tts_recipe_key(normalized, voice, rate, pitch).encode())
        filename = f"audio_{key}.mp3"
        destination = assets / filename
        results[text] = f"assets/{filename}"
        if (not destination.exists() or force) and destination not in seen_destinations:
            seen_destinations.add(destination)
            pending.append((normalized, voice, rate, pitch, destination))

    if not pending:
        return results

    if synthesizer is not None:
        for normalized, clip_voice, _, _, destination in pending:
            temporary = destination.with_suffix(".tmp")
            try:
                synthesizer(normalized, clip_voice, temporary)
                if not temporary.exists() or temporary.stat().st_size == 0:
                    raise OSError(
                        f"TTS synthesizer produced an empty file for {normalized!r}"
                    )
                temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)
    else:
        asyncio.run(_synthesize_pending_async(pending))

    return results


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
    quality: int = DEFAULT_QUALITY,
    force: bool = False,
    max_dimension: int | None = None,
) -> tuple[str, str | None]:
    size_tag = f"{max_dimension}x{max_dimension}" if max_dimension else "full"
    recipe = f"golu-v2:{size_tag}:{quality}:{PIL.__version__}:{pillow_heif.__version__}"
    key = digest(source.read_bytes() + recipe.encode())
    filename = f"img_{key}.webp"
    destination = assets / filename
    with Image.open(source) as original:
        date = extract_exif_date(original)
        if not destination.exists() or force:
            image = ImageOps.exif_transpose(original)
            if max_dimension is not None:
                image.thumbnail(
                    (max_dimension, max_dimension), Image.Resampling.LANCZOS
                )
            mode = "RGBA" if image.has_transparency_data else "RGB"
            # A fresh pixel-only image also drops ICC profiles, XMP, and EXIF.
            clean = Image.new(mode, image.size)
            clean.paste(image.convert(mode))
            assets.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(".tmp")
            try:
                clean.save(
                    temporary,
                    format="WEBP",
                    quality=quality,
                    lossless=quality == 100,
                    method=6,
                )
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


def attach_voiceover_audio(
    payload: dict,
    assets: Path,
    voice: str,
    rate: str = DEFAULT_TTS_RATE,
    pitch: str = DEFAULT_TTS_PITCH,
    force: bool = False,
    synthesizer: TtsSynthesizer | None = None,
    tts_overrides: dict[str, tuple[str | None, str | None]] | None = None,
) -> None:
    if not voice.strip():
        raise ValueError("voice must not be empty")
    scripts_by_question: dict[str, dict[str, str]] = {}
    all_texts: list[str] = []

    for category_lines in HOST_STINGERS.values():
        all_texts.extend(category_lines)

    for pack in payload["packs"]:
        for question in pack["questions"]:
            qid = question["id"]
            name = question.get("name") or question["options"][question["correctIndex"]]
            tts_name, tts_explanation = (
                tts_overrides.get(qid, (None, None)) if tts_overrides else (None, None)
            )
            q_scripts = build_question_tts_scripts(
                name=name,
                prompt=question["prompt"],
                options=question["options"],
                explanation=question["explanation"],
                tts_name=tts_name,
                tts_explanation=tts_explanation,
            )
            scripts_by_question[qid] = q_scripts
            all_texts.extend(q_scripts.values())

    synthesized = synthesize_audio_batch(
        all_texts,
        assets,
        voice=voice,
        rate=rate,
        pitch=pitch,
        force=force,
        synthesizer=synthesizer,
    )

    payload["hostAudio"] = {
        category: [synthesized[line] for line in lines]
        for category, lines in HOST_STINGERS.items()
    }
    for pack in payload["packs"]:
        for question in pack["questions"]:
            q_scripts = scripts_by_question[question["id"]]
            question["audio"] = {
                phase: synthesized[text] for phase, text in q_scripts.items()
            }


def build_from_golu_config(
    input_dir: Path,
    output_dir: Path,
    config_path: Path,
    config: dict,
    default_title: str,
    default_prompt: str,
    quality: int,
    force: bool,
    max_dimension: int | None = None,
) -> tuple[dict, dict[str, tuple[str | None, str | None]]]:
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
            source, output_dir / "assets", quality, force, max_dimension
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
    tts_overrides: dict[str, tuple[str | None, str | None]] = {}
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
        tts_overrides[question_id] = (
            doll.get("tts_name"),
            doll.get("tts_explanation"),
        )
        questions.append(question)

    pack_id = "pack_" + digest(pack_name.encode())
    return (
        {
            "title": title,
            "image": master_image,
            "packs": [{"id": pack_id, "name": pack_name, "questions": questions}],
        },
        tts_overrides,
    )


def scan_and_build(
    input_dir: Path,
    output_dir: Path,
    title: str = "Photo Trivia",
    default_prompt: str = "Which doll is highlighted on the Golu?",
    quality: int = DEFAULT_QUALITY,
    force: bool = False,
    max_dimension: int | None = None,
    tts: bool = False,
    voice: str = DEFAULT_TTS_VOICE,
    rate: str = DEFAULT_TTS_RATE,
    pitch: str = DEFAULT_TTS_PITCH,
    tts_synthesizer: TtsSynthesizer | None = None,
) -> dict:
    input_dir, output_dir = input_dir.resolve(), output_dir.resolve()
    if not input_dir.is_dir():
        raise ValueError(f"Input directory does not exist: {input_dir}")
    if input_dir.is_relative_to(output_dir) or output_dir.is_relative_to(input_dir):
        raise ValueError("Input and output directories must not overlap")
    if not 1 <= quality <= 100:
        raise ValueError("quality must be between 1 and 100")
    if max_dimension is not None and max_dimension <= 0:
        raise ValueError("max_dimension must be greater than 0")
    if not title.strip() or not default_prompt.strip():
        raise ValueError("title and prompt must not be empty")
    golu_loaded = load_golu_config(input_dir)
    tts_overrides: dict[str, tuple[str | None, str | None]] = {}
    selected_voice = voice
    selected_rate = rate
    selected_pitch = pitch
    if golu_loaded is not None:
        config_path, config = golu_loaded
        if "voice" in config and voice == DEFAULT_TTS_VOICE:
            selected_voice = config["voice"]
        if "rate" in config and rate == DEFAULT_TTS_RATE:
            selected_rate = config["rate"]
        if "pitch" in config and pitch == DEFAULT_TTS_PITCH:
            selected_pitch = config["pitch"]
        payload, tts_overrides = build_from_golu_config(
            input_dir,
            output_dir,
            config_path,
            config,
            title,
            default_prompt,
            quality,
            force,
            max_dimension,
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
                            source,
                            output_dir / "assets",
                            quality,
                            force,
                            max_dimension,
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
                    tts_overrides[question_id] = (
                        meta.get("tts_name"),
                        meta.get("tts_explanation"),
                    )
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
    if tts or tts_synthesizer is not None:
        attach_voiceover_audio(
            payload,
            output_dir / "assets",
            voice=selected_voice,
            rate=selected_rate,
            pitch=selected_pitch,
            force=force,
            synthesizer=tts_synthesizer,
            tts_overrides=tts_overrides,
        )
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
        description=(
            "Build photos into static trivia packs and high-resolution WebP images."
        )
    )
    parser.add_argument("-i", "--input", type=Path, default=Path("raw_photos"))
    parser.add_argument("-o", "--output", type=Path, default=Path("public"))
    parser.add_argument("--title", default="Photo Trivia")
    parser.add_argument("--prompt", default="Where was this photo taken?")
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY)
    parser.add_argument(
        "--max-dimension",
        type=int,
        default=None,
        help="Optional max width/height in pixels (preserves full size by default).",
    )
    parser.add_argument(
        "--voice",
        default=DEFAULT_TTS_VOICE,
        help=f"edge-tts voice for host narration (default: {DEFAULT_TTS_VOICE}).",
    )
    parser.add_argument(
        "--rate",
        default=DEFAULT_TTS_RATE,
        help=(
            f"edge-tts speaking rate offset (default: {DEFAULT_TTS_RATE}, "
            "e.g. '+10%%')."
        ),
    )
    parser.add_argument(
        "--pitch",
        default=DEFAULT_TTS_PITCH,
        help=f"edge-tts pitch offset (default: {DEFAULT_TTS_PITCH}, e.g. '+6Hz').",
    )
    parser.add_argument(
        "--no-tts",
        action="store_true",
        help="Skip synthesizing host voiceover MP3 clips.",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        manifest = scan_and_build(
            args.input,
            args.output,
            args.title,
            args.prompt,
            args.quality,
            args.force,
            args.max_dimension,
            tts=not args.no_tts,
            voice=args.voice,
            rate=args.rate,
            pitch=args.pitch,
        )
    except (ValueError, OSError) as error:
        parser.exit(1, f"Error: {error}\n")
    total = sum(len(pack["questions"]) for pack in manifest["packs"])
    print(f"Wrote {total} questions to {args.output / 'questions.json'}")


if __name__ == "__main__":
    main()
