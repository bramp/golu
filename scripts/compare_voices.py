import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

SAMPLE_TEXT = (
    "Vanakkam and Namaste! Welcome to the Grand Navaratri Golu Quiz! "
    "Today we are looking at Meenakshi Amman of Madurai, and Ananthasayana Vishnu "
    "reclining on Adi Shesha. Shabash, spot on!"
)

PRESETS: list[dict[str, str]] = [
    {
        "id": "prabhat_default",
        "label": "Prabhat (en-IN Male · Default)",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "notes": "Baseline Indian-English male voice.",
    },
    {
        "id": "prabhat_upbeat",
        "label": "Prabhat Upbeat (+10% rate, +6Hz pitch)",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+10%",
        "pitch": "+6Hz",
        "notes": "Faster, brighter game-show pacing with Indian-English pronunciation.",
    },
    {
        "id": "prabhat_lively",
        "label": "Prabhat Lively (+16% rate, +10Hz pitch)",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+16%",
        "pitch": "+10Hz",
        "notes": "High-energy quizmaster feel.",
    },
    {
        "id": "prabhat_warm_baritone",
        "label": "Prabhat Baritone (+6% rate, -6Hz pitch)",
        "voice": "en-IN-PrabhatNeural",
        "rate": "+6%",
        "pitch": "-6Hz",
        "notes": "Slightly deeper, theatrical stage-host resonance.",
    },
    {
        "id": "valluvar_tamil_default",
        "label": "Valluvar (ta-IN Male · Default)",
        "voice": "ta-IN-ValluvarNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "notes": "Tamil male voice reading English; authentic South Indian cadence.",
    },
    {
        "id": "valluvar_tamil_upbeat",
        "label": "Valluvar Upbeat (+10% rate, +5Hz pitch)",
        "voice": "ta-IN-ValluvarNeural",
        "rate": "+10%",
        "pitch": "+5Hz",
        "notes": "Brisker Tamil-accented game-show cadence.",
    },
    {
        "id": "madhur_hindi_upbeat",
        "label": "Madhur (hi-IN Male · +8% rate, +4Hz pitch)",
        "voice": "hi-IN-MadhurNeural",
        "rate": "+8%",
        "pitch": "+4Hz",
        "notes": "Hindi male voice reading English.",
    },
    {
        "id": "gagan_kannada_upbeat",
        "label": "Gagan (kn-IN Male · +8% rate, +4Hz pitch)",
        "voice": "kn-IN-GaganNeural",
        "rate": "+8%",
        "pitch": "+4Hz",
        "notes": (
            "Kannada male voice reading English "
            "(great for Purandara Dasa / Carnatic terms)."
        ),
    },
    {
        "id": "neerja_expressive",
        "label": "Neerja Expressive (en-IN Female · +5% rate)",
        "voice": "en-IN-NeerjaExpressiveNeural",
        "rate": "+5%",
        "pitch": "+0Hz",
        "notes": "Expressive Indian-English female voice.",
    },
    {
        "id": "andrew_multilingual",
        "label": "Andrew Multilingual (en-US Male · +6% rate)",
        "voice": "en-US-AndrewMultilingualNeural",
        "rate": "+6%",
        "pitch": "+0Hz",
        "notes": "Warm, conversational US multilingual announcer voice.",
    },
    {
        "id": "brian_multilingual",
        "label": "Brian Multilingual (en-US Male · +8% rate)",
        "voice": "en-US-BrianMultilingualNeural",
        "rate": "+8%",
        "pitch": "+4Hz",
        "notes": "Upbeat, energetic quiz-show host delivery.",
    },
    {
        "id": "ryan_uk",
        "label": "Ryan (en-GB Male · +8% rate)",
        "voice": "en-GB-RyanNeural",
        "rate": "+8%",
        "pitch": "+2Hz",
        "notes": "Classic British quiz-show host tone.",
    },
]


async def build_samples(output_dir: Path, text: str, force: bool = False) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(4)

    async def synth(preset: dict[str, str]) -> dict[str, str]:
        filename = f"{preset['id']}.mp3"
        dest = output_dir / filename
        if not dest.exists() or force:
            async with semaphore:
                comm = edge_tts.Communicate(
                    text,
                    preset["voice"],
                    rate=preset["rate"],
                    pitch=preset["pitch"],
                )
                await comm.save(str(dest))
        return {
            **preset,
            "src": f"voice_samples/{filename}",
        }

    items = await asyncio.gather(*(synth(p) for p in PRESETS))
    manifest_path = output_dir / "samples.json"
    manifest_path.write_text(
        json.dumps({"text": text, "samples": items}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} voice comparison samples to {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate side-by-side edge-tts voice, rate, and pitch samples."
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("public/voice_samples"),
    )
    parser.add_argument("--text", default=SAMPLE_TEXT)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    asyncio.run(build_samples(args.output, args.text, args.force))


if __name__ == "__main__":
    main()
