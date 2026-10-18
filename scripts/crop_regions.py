import argparse
from pathlib import Path

from build_assets import ImageOps, load_golu_config, validate_meta_dict
from PIL import Image, ImageDraw


def generate_review_crops(input_dir: Path, output_dir: Path) -> int:
    loaded = load_golu_config(input_dir)
    if loaded is None:
        raise ValueError(f"No golu.yaml/json found in {input_dir}")
    config_path, config = loaded

    image_name = config.get("image")
    if not image_name:
        raise ValueError(f"{config_path}: missing 'image' field")
    image_path = input_dir / image_name
    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(image_path) as raw_im:
        im = ImageOps.exif_transpose(raw_im).convert("RGB")

    width, height = im.size
    overview = im.copy()
    odraw = ImageDraw.Draw(overview)

    dolls = config["dolls"]
    for idx, raw_doll in enumerate(dolls):
        doll = validate_meta_dict(raw_doll, f"{config_path}#dolls[{idx}]")
        region = doll.get("region")
        if not region:
            continue

        x1 = int(region["x"] * width)
        y1 = int(region["y"] * height)
        x2 = int((region["x"] + region["width"]) * width)
        y2 = int((region["y"] + region["height"]) * height)

        exact = im.crop((x1, y1, x2, y2))
        card = Image.new(
            "RGB", (max(450, exact.width + 20), exact.height + 60), (20, 20, 20)
        )
        card.paste(exact, (10, 50))
        cdraw = ImageDraw.Draw(card)
        name = doll.get("name") or doll.get("answer") or f"Doll {idx}"
        rx, ry, rw, rh = (
            region["x"],
            region["y"],
            region["width"],
            region["height"],
        )
        cdraw.text((10, 10), f"#{idx:02d}: {name}", fill=(255, 255, 0))
        cdraw.text(
            (10, 28),
            f"x={rx}, y={ry}, w={rw}, h={rh}",
            fill=(200, 200, 200),
        )
        card.save(output_dir / f"card_{idx:02d}.jpg", quality=95)

        pad_x = int((x2 - x1) * 0.15)
        pad_y = int((y2 - y1) * 0.15)
        px1 = max(0, x1 - pad_x)
        py1 = max(0, y1 - pad_y)
        px2 = min(width, x2 + pad_x)
        py2 = min(height, y2 + pad_y)
        padded = im.crop((px1, py1, px2, py2))
        pdraw = ImageDraw.Draw(padded)
        pdraw.rectangle(
            [x1 - px1, y1 - py1, x2 - px1, y2 - py1], outline="red", width=4
        )
        padded.save(output_dir / f"padded_{idx:02d}.jpg", quality=92)

        odraw.rectangle([x1, y1, x2, y2], outline="red", width=8)

    overview.thumbnail((2000, 2000))
    overview.save(output_dir / "overview.jpg", quality=90)
    return len(dolls)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Generate high-resolution crop cards and padded bounding-box "
            "images for fact-checking golu.yaml."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("raw_photos"),
        help="Directory with golu.yaml and source image (default: raw_photos)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/tmp/golu_review"),
        help="Directory for review crop images (default: /tmp/golu_review)",
    )
    args = parser.parse_args(argv)
    count = generate_review_crops(args.input, args.output)
    print(f"Wrote {count} crop cards and padded views to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
