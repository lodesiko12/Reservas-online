#!/usr/bin/env bash
# Genera un wav por frase con la voz clonada (Voice Studio, API local). Salta las que ya existen.
cd "$(dirname "$0")"
PERFIL=$(python -I -c "import json;print(json.load(open('guion.json',encoding='utf-8'))['voz']['perfil'])")
SEED=$(python -I -c "import json;print(json.load(open('guion.json',encoding='utf-8'))['voz']['seed'])")
python -I -c "
import json
for f in json.load(open('guion.json',encoding='utf-8'))['frases']: print(f['id']+'\t'+f['texto'])
" | while IFS=$'\t' read -r id texto; do
  [ -s "audio/$id.wav" ] && { echo "$id ya existe"; continue; }
  curl -sS -m 1800 -D "audio/$id.hdr" -o "audio/$id.tmp" -w "$id HTTP %{http_code}\n" http://127.0.0.1:3900/generate \
    -F "text=$texto" -F "language=es" -F "profile_id=$PERFIL" -F "seed=$SEED" \
    && mv "audio/$id.tmp" "audio/$id.wav"; grep -i x-gen-time "audio/$id.hdr"; rm -f "audio/$id.hdr"
done
echo FIN
