#!/usr/bin/env python3
"""
Generates natural German speech for the app with Piper (open-source neural TTS).

  python3 scripts/generate_audio.py MANIFEST OUT_DIR MODEL.onnx [--shard I --shards N]

MANIFEST is the JSON written by scripts/audio-manifest.mjs ([{id, text}]).
Clips that already exist in OUT_DIR are skipped, so runs are incremental.
Each clip is written as OUT_DIR/<id>.mp3 (mono, 22 kHz, 40 kbit/s) – plays everywhere incl. iOS.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import wave

from piper import PiperVoice
from piper.config import SynthesisConfig


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("out_dir")
    ap.add_argument("model")
    ap.add_argument("--shard", type=int, default=0)
    ap.add_argument("--shards", type=int, default=1)
    ap.add_argument("--length-scale", type=float, default=1.0, help=">1 speaks slower")
    args = ap.parse_args()

    with open(args.manifest, encoding="utf-8") as f:
        items = json.load(f)
    os.makedirs(args.out_dir, exist_ok=True)
    mine = [x for i, x in enumerate(items) if i % args.shards == args.shard]
    todo = [x for x in mine if not os.path.exists(os.path.join(args.out_dir, x["id"] + ".mp3"))]
    print(f"shard {args.shard}/{args.shards}: {len(mine)} clips, {len(todo)} to generate", flush=True)
    if not todo:
        return 0

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:  # e.g. on CI runners: a bundled static binary
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    voice = PiperVoice.load(args.model)
    cfg = SynthesisConfig(length_scale=args.length_scale)
    started = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, "clip.wav")
        for n, x in enumerate(todo, 1):
            with wave.open(wav_path, "wb") as wav:
                voice.synthesize_wav(x["text"], wav, syn_config=cfg)
            out = os.path.join(args.out_dir, x["id"] + ".mp3")
            subprocess.run(
                [ffmpeg, "-loglevel", "error", "-y", "-i", wav_path,
                 # a short fade avoids clicks; a little silence at the end sounds more natural
                 "-af", "afade=t=in:d=0.01,apad=pad_dur=0.12",
                 "-ac", "1", "-ar", "22050", "-codec:a", "libmp3lame", "-b:a", "40k", out],
                check=True,
            )
            if n % 100 == 0 or n == len(todo):
                rate = n / (time.time() - started)
                print(f"  {n}/{len(todo)} ({rate:.1f} clips/s)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
