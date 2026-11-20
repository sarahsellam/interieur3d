#!/usr/bin/env bash
# Convertit un modèle glTF Poly Haven en dossier public/models/<id>/ (model.json + textures .webp)
# Usage : scripts/convertir-modele.sh chemin/vers/modele.gltf <id>
set -euo pipefail
src=$1; id=$2; out=public/models/$id; tmp=$(mktemp -d)
npx gltf-transform optimize "$src" "$tmp/m.glb" --texture-compress webp --texture-size 1024 --compress quantize --simplify false >/dev/null
mkdir -p "$out" && npx gltf-transform copy "$tmp/m.glb" "$out/$id.gltf" >/dev/null
python3 - "$out" "$id" <<'PY'
import json,base64,os,sys
out,id=sys.argv[1],sys.argv[2]
g=json.load(open(f'{out}/{id}.gltf'))
for b in g['buffers']:
    p=f"{out}/{b['uri']}"; b['uri']='data:application/octet-stream;base64,'+base64.b64encode(open(p,'rb').read()).decode(); os.remove(p)
json.dump(g,open(f'{out}/model.json','w'),separators=(',',':')); os.remove(f'{out}/{id}.gltf')
PY
rm -rf "$tmp"; ls "$out"
