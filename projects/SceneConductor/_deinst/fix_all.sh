#!/usr/bin/env bash
# Remove EXT_mesh_gpu_instancing from every compressed .glb (it triggers
# "Mesh is missing primitive index association" in three.js and fails in some
# external viewers). Pipeline per file:
#   A) API uninstance  -> bakes instances to nodes, keeps WebP, drops Draco
#   B) CLI optimize     -> re-applies Draco, leaves textures untouched
# Geometry/visuals unchanged; output size ~identical.
set -uo pipefail
cd "$(dirname "$0")/.."          # -> projects/SceneConductor
CLI="npx --no-install @gltf-transform/cli"
fail=0; n=0

while IFS= read -r f; do
  tmpA="${f%.glb}.A.tmp.glb"
  tmpB="${f%.glb}.B.tmp.glb"
  if node _deinst/deinst.js "$f" "$tmpA" >/dev/null 2>&1 \
     && $CLI optimize "$tmpA" "$tmpB" --compress draco --texture-compress false \
            --simplify false --instance false --join false --flatten false >/dev/null 2>&1 \
     && [ -s "$tmpB" ]; then
    mv -f "$tmpB" "$f"; rm -f "$tmpA"
    ext=$($CLI inspect "$f" 2>/dev/null | grep -i 'extensionsUsed' | grep -ci 'gpu_instancing')
    n=$((n+1))
    printf '  OK  %-58s instancing_left=%s\n' "$f" "$ext"
  else
    rm -f "$tmpA" "$tmpB"; fail=$((fail+1))
    printf '  FAIL %-58s (unchanged)\n' "$f"
  fi
done < <(find static/data -name "*.glb" ! -name "*.tmp.glb" | sort)

echo "-------------------------------------------------------------"
echo "done: $n ok, $fail failed"
