"""Restore tutorial files, including the calendar filename retained by older records."""

import argparse
import json
import shutil
from pathlib import Path


def restore(source: Path, target: Path):
    manifest = Path(__file__).resolve().parents[2] / "content" / "video-assets.json"
    assets = json.loads(manifest.read_text())
    files = {
        name: asset["source"]
        for asset in assets for name in [asset["filename"], *asset["aliases"]]
    }
    for filename in files.values():
        path = source / filename
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"Missing or empty tutorial source: {path}")
    target.mkdir(parents=True, exist_ok=True)
    for filename, original in files.items():
        shutil.copy2(source / original, target / filename)
    print(f"Restored {len(files)} tutorial paths in {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    args = parser.parse_args()
    restore(args.source, args.target)
