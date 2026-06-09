#!/usr/bin/env python3
"""Generate static/data/<source>/manifest.json from the scene sub-folders.

GitHub Pages does not serve directory listings, so the project page reads these
manifests to discover which scenes belong to the Results (pipeline) and
Qualitative Comparison sections. Run this after adding or removing a scene
folder, then commit the updated manifest.json files.

    python tasks/generate_manifest.py
"""
import json
import os

# tasks/ -> project root (one level up)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = ("pipeline", "comparison")


def scene_ids(data_dir):
    """Folder names (sorted) that contain an input.webp, i.e. real scenes."""
    if not os.path.isdir(data_dir):
        return []
    ids = []
    for name in os.listdir(data_dir):
        folder = os.path.join(data_dir, name)
        if os.path.isdir(folder) and os.path.isfile(os.path.join(folder, "input.webp")):
            ids.append(name)
    ids.sort(key=str.lower)
    return ids


def main():
    for source in SOURCES:
        data_dir = os.path.join(ROOT, "static", "data", source)
        ids = scene_ids(data_dir)
        out_path = os.path.join(data_dir, "manifest.json")
        os.makedirs(data_dir, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(ids, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{source}: {len(ids)} scenes -> {os.path.relpath(out_path, ROOT)}")


if __name__ == "__main__":
    main()
