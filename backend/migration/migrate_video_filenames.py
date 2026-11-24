"""Move existing tutorial references to canonical filenames; defaults to a read-only plan."""

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient


async def migrate(manifest: Path, apply: bool):
    assets = json.loads(manifest.read_text())
    aliases = {alias: asset["filename"] for asset in assets for alias in asset["aliases"]}
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    try:
        videos = client[os.environ.get("DB_NAME", "verasist_docs")].videos
        rows = await videos.find({"filename": {"$in": list(aliases)}}, {"_id": 0}).to_list(None)
        changes = [{"id": row["id"], "before": {"filename": row["filename"], "updated_at": row.get("updated_at")},
                    "filename": aliases[row["filename"]]} for row in rows]
        done = []
        if apply:
            try:
                for change in changes:
                    result = await videos.update_one(
                        {"id": change["id"], "filename": change["before"]["filename"]},
                        {"$set": {"filename": change["filename"], "updated_at": datetime.now(timezone.utc).isoformat()}},
                    )
                    if result.matched_count != 1:
                        raise RuntimeError("A video reference changed during migration")
                    done.append(change)
            except Exception:
                for change in done:
                    await videos.update_one({"id": change["id"], "filename": change["filename"]}, {"$set": change["before"]})
                raise
        print(json.dumps({"applied": apply, "changes": changes}, ensure_ascii=False))
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(migrate(args.manifest, args.apply))
