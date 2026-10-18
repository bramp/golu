import json
import subprocess
import sys
from pathlib import Path

import pytest
from build_assets import build_options, load_meta, process_image, scan_and_build
from PIL import Image


@pytest.fixture
def photos(tmp_path: Path) -> Path:
    root = tmp_path / "raw"
    for answer in ["Munich", "Vienna", "Moab", "Paris"]:
        path = root / "Travel" / answer / "photo.jpg"
        path.parent.mkdir(parents=True)
        Image.new("RGB", (2400, 1600), "#aaccee").save(path)
    return root


def test_build_is_deterministic_and_cached(photos: Path, tmp_path: Path) -> None:
    output = tmp_path / "public"
    first = scan_and_build(photos, output)
    original = (output / "questions.json").read_bytes()
    assets = list((output / "assets").glob("*.webp"))
    assert len(assets) == 1
    mtime = assets[0].stat().st_mtime_ns
    assert scan_and_build(photos, output) == first
    assert (output / "questions.json").read_bytes() == original
    assert assets[0].stat().st_mtime_ns == mtime
    questions = first["packs"][0]["questions"]
    assert len({question["id"] for question in questions}) == 4
    for question in questions:
        assert len(set(question["options"])) == 4
        assert question["image"].startswith("assets/")
    with Image.open(assets[0]) as image:
        assert image.size == (1620, 1080)
        assert not image.getexif()


def test_ids_survive_other_pack_additions(photos: Path, tmp_path: Path) -> None:
    first = scan_and_build(photos, tmp_path / "public")
    extra = photos / "Another Pack" / "Rome"
    extra.mkdir(parents=True)
    Image.new("RGB", (32, 32)).save(extra / "new.jpg")
    second = scan_and_build(photos, tmp_path / "public")
    assert second["packs"][1] == first["packs"][0]


def test_cache_key_includes_quality(photos: Path, tmp_path: Path) -> None:
    source = next(photos.rglob("*.jpg"))
    first, _ = process_image(source, tmp_path / "assets", quality=60)
    second, _ = process_image(source, tmp_path / "assets", quality=90)
    assert first != second


def test_orientation_and_private_metadata_are_removed(tmp_path: Path) -> None:
    source = tmp_path / "portrait.jpg"
    exif = Image.Exif()
    exif[274] = 6
    exif[306] = "2026:01:12 12:00:00"
    exif[315] = "Private photographer"
    Image.new("RGB", (2400, 1600)).save(source, exif=exif)
    relative, date = process_image(source, tmp_path)
    assert date == "January 2026"
    with Image.open(tmp_path / Path(relative).name) as image:
        assert image.size == (720, 1080)
        assert not image.getexif()
        assert "exif" not in image.info
        assert "xmp" not in image.info
        assert "icc_profile" not in image.info


def test_folder_and_photo_sidecars_merge(photos: Path, tmp_path: Path) -> None:
    (photos / "Travel" / "meta.yaml").write_text("prompt: Which city?\n")
    photo = photos / "Travel" / "Moab" / "photo.jpg"
    photo.with_suffix(".json").write_text(
        json.dumps(
            {
                "answer": "Arches",
                "options": ["Zion", "Arches", "Bryce", "Yosemite"],
                "explanation": "A family trip.",
            }
        )
    )
    manifest = scan_and_build(photos, tmp_path / "public")
    question = manifest["packs"][0]["questions"][0]
    assert question["prompt"] == "Which city?"
    assert question["options"] == ["Zion", "Arches", "Bryce", "Yosemite"]
    assert question["correctIndex"] == 1
    assert question["explanation"] == "A family trip."


@pytest.mark.parametrize(
    "content",
    ["not json", "[]", '{"prompt": 1}', '{"unknown": true}', '{"distractors": [1]}'],
)
def test_bad_sidecars_fail_instead_of_using_defaults(
    content: str, tmp_path: Path
) -> None:
    (tmp_path / "photo.json").write_text(content)
    with pytest.raises(ValueError):
        load_meta(tmp_path / "photo")


def test_ambiguous_sidecars_fail(tmp_path: Path) -> None:
    (tmp_path / "meta.json").write_text("{}")
    (tmp_path / "meta.yaml").write_text("{}")
    with pytest.raises(ValueError, match="Ambiguous"):
        load_meta(tmp_path / "meta")


@pytest.mark.parametrize(
    "meta",
    [
        {"distractors": ["Paris", "paris", "Vienna"]},
        {"distractors": ["Munich", "Moab", "Vienna"]},
        {"distractors": ["Paris"]},
        {"options": ["Paris", "Rome", "Tokyo", "Vienna"]},
        {"options": ["Munich", "Paris", "Rome", "Tokyo"], "distractors": []},
    ],
)
def test_invalid_options_fail(meta: dict) -> None:
    with pytest.raises(ValueError):
        build_options("Munich", [], "seed", meta)


def test_sibling_answers_are_preferred() -> None:
    options, index = build_options(
        "Munich", ["Munich", "Vienna", "Moab", "Paris"], "seed", {}
    )
    assert set(options) == {"Munich", "Vienna", "Moab", "Paris"}
    assert options[index] == "Munich"
    options, index = build_options("Paris", ["paris"], "seed", {})
    assert len({option.casefold() for option in options}) == 4
    assert options[index] == "Paris"


def test_failed_build_preserves_existing_manifest(photos: Path, tmp_path: Path) -> None:
    output = tmp_path / "public"
    scan_and_build(photos, output)
    previous = (output / "questions.json").read_bytes()
    (photos / "Travel" / "Moab" / "photo.json").write_text("{broken")
    with pytest.raises(ValueError):
        scan_and_build(photos, output)
    assert (output / "questions.json").read_bytes() == previous


def test_invalid_input_and_quality(photos: Path, tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="does not exist"):
        scan_and_build(tmp_path / "missing", tmp_path / "out")
    (tmp_path / "empty").mkdir()
    with pytest.raises(ValueError, match="No supported photos"):
        scan_and_build(tmp_path / "empty", tmp_path / "out")
    with pytest.raises(ValueError, match="overlap"):
        scan_and_build(photos, photos / "public")
    with pytest.raises(ValueError, match="quality"):
        scan_and_build(photos, tmp_path / "public", quality=101)


def test_heic_and_transparent_png_inputs(tmp_path: Path) -> None:
    heic = tmp_path / "iphone.heic"
    png = tmp_path / "transparent.png"
    Image.new("RGB", (64, 96), "orange").save(heic, format="HEIF")
    Image.new("RGBA", (80, 60), (12, 34, 56, 0)).save(png)
    for source in (heic, png):
        relative, _ = process_image(source, tmp_path / "assets")
        with Image.open(tmp_path / relative) as image:
            assert image.size == ((64, 96) if source == heic else (80, 60))
            if source == png:
                assert image.mode == "RGBA"
                assert image.getpixel((0, 0))[3] == 0


def test_single_photo_golu_config_builds_regions_and_questions(
    tmp_path: Path,
) -> None:
    raw = tmp_path / "raw_golu"
    raw.mkdir()
    Image.new("RGB", (2400, 1600), "#cceeff").save(raw / "golu.jpg")
    (raw / "golu.yaml").write_text(
        """
title: Navaratri Golu Trivia
pack: Our Golu Padi
image: golu.jpg
dolls:
  - name: Marapachi Dolls
    region: { x: 0.42, y: 0.18, width: 0.16, height: 0.22 }
    prompt: Which wooden pair stands on the top step?
    explanation: Carved from red sandalwood.
  - name: Thanjavur Bommai
    region: { x: 0.15, y: 0.45, width: 0.2, height: 0.25 }
    explanation: Traditional bobblehead dancer.
  - name: Dashavatara Set
    region: { x: 0.5, y: 0.5, width: 0.35, height: 0.2 }
    explanation: Ten avatars of Vishnu.
  - name: Chettiar Couple
    region: { x: 0.1, y: 0.75, width: 0.22, height: 0.2 }
    explanation: Merchant couple with spice bowls.
""".strip()
    )
    output = tmp_path / "public"
    manifest = scan_and_build(raw, output)
    assert manifest["title"] == "Navaratri Golu Trivia"
    assert manifest["image"].startswith("assets/img_")
    questions = manifest["packs"][0]["questions"]
    assert len(questions) == 4
    assert questions[0]["name"] == "Marapachi Dolls"
    assert questions[0]["region"] == {
        "x": 0.42,
        "y": 0.18,
        "width": 0.16,
        "height": 0.22,
    }
    assert set(questions[0]["options"]) == {
        "Marapachi Dolls",
        "Thanjavur Bommai",
        "Dashavatara Set",
        "Chettiar Couple",
    }
    assert questions[0]["options"][questions[0]["correctIndex"]] == "Marapachi Dolls"


def test_invalid_region_in_golu_config_fails(tmp_path: Path) -> None:
    raw = tmp_path / "raw_golu"
    raw.mkdir()
    Image.new("RGB", (200, 200)).save(raw / "golu.jpg")
    (raw / "golu.json").write_text(
        json.dumps(
            {
                "dolls": [
                    {
                        "name": "Out of Bounds Doll",
                        "region": {"x": 0.8, "y": 0.2, "width": 0.5, "height": 0.2},
                    }
                ]
            }
        )
    )
    with pytest.raises(ValueError, match="exceeds image bounds"):
        scan_and_build(raw, tmp_path / "public")


def test_cli_writes_manifest_and_reports_invalid_input(
    photos: Path, tmp_path: Path
) -> None:
    script = Path(__file__).parents[1] / "scripts" / "build_assets.py"
    output = tmp_path / "output"
    command = [
        sys.executable,
        str(script),
        "--input",
        str(photos),
        "--output",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "Wrote 4 questions" in result.stdout
    manifest = json.loads((output / "questions.json").read_text())
    assert len(manifest["packs"][0]["questions"]) == 4
    result = subprocess.run(
        [*command, "--quality", "0"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "quality must be between 1 and 100" in result.stderr
