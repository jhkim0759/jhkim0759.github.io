#!/usr/bin/env bash
# Batch-compress all .glb assets in-place using gltf-transform.
#   - Geometry: Draco compression
#   - Textures: PNG -> WebP (max 2048px)
#   - Geometry fidelity preserved (--simplify false: no vertex reduction)
# Originals are recoverable via `git checkout` (all .glb are git-tracked).
#
# Usage:  bash compress_glb.sh
set -uo pipefail

cd "$(dirname "$0")"
ROOT="static/data"
CLI="npx --no-install @gltf-transform/cli"

total_before=0
total_after=0
fail=0

while IFS= read -r f; do
  before=$(stat -c%s "$f")
  tmp="${f%.glb}.opt.tmp.glb"

  if $CLI optimize "$f" "$tmp" \
        --compress draco --texture-compress webp --texture-size 2048 \
        --simplify false >/dev/null 2>&1 && [ -s "$tmp" ]; then
    mv -f "$tmp" "$f"
    after=$(stat -c%s "$f")
    total_before=$((total_before + before))
    total_after=$((total_after + after))
    printf '  OK  %-58s %8.2f MB -> %7.2f MB\n' "$f" \
      "$(echo "$before/1048576" | bc -l)" "$(echo "$after/1048576" | bc -l)"
  else
    rm -f "$tmp"
    fail=$((fail + 1))
    printf '  FAIL %-58s (left unchanged)\n' "$f"
  fi
done < <(find "$ROOT" -name "*.glb" ! -name "*.opt.tmp.glb" | sort)

echo "--------------------------------------------------------------------------"
printf 'TOTAL  %.1f MB -> %.1f MB   (failures: %d)\n' \
  "$(echo "$total_before/1048576" | bc -l)" \
  "$(echo "$total_after/1048576" | bc -l)" "$fail"
