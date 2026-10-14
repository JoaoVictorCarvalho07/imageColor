#!/usr/bin/env bash
set -euo pipefail

RAIZ="${RAIZ:-$HOME/apps/galeria}"
REPO="${REPO:-https://github.com/JoaoVictorCarvalho07/imageColor.git}"
REF="${1:-master}"
PORTA="${PORTA:-8083}"
NOME="${NOME:-galeria}"
PNPM="pnpm@10.32.1"

test -f "$RAIZ/.env" || { echo "falta $RAIZ/.env"; exit 1; }
mkdir -p "$RAIZ/versoes"

if [ ! -d "$RAIZ/src/.git" ]; then
  git clone --quiet "$REPO" "$RAIZ/src"
fi
git -C "$RAIZ/src" fetch --quiet --prune origin
git -C "$RAIZ/src" checkout --quiet --force "origin/$REF" 2>/dev/null || git -C "$RAIZ/src" checkout --quiet --force "$REF"
git -C "$RAIZ/src" clean -fdxq -e node_modules
COMMIT="$(git -C "$RAIZ/src" rev-parse --short HEAD)"
echo "build de $REF ($COMMIT)"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e COREPACK_HOME=/tmp/corepack -e NEXT_TELEMETRY_DISABLED=1 \
  --env-file "$RAIZ/.env" \
  -v "$RAIZ/src:/src" -w /src \
  node:22 bash -c "corepack $PNPM install --frozen-lockfile && corepack $PNPM build"

DESTINO="$RAIZ/versoes/$(date -u +%Y%m%d-%H%M%S)-$COMMIT"
mkdir -p "$DESTINO/.next"
cp -a "$RAIZ/src/.next/standalone/." "$DESTINO/"
cp -a "$RAIZ/src/.next/static" "$DESTINO/.next/static"
if [ -d "$RAIZ/src/public" ]; then cp -a "$RAIZ/src/public" "$DESTINO/public"; fi
test -f "$DESTINO/server.js"

ANTERIOR="$(docker inspect "$NOME" --format '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"

rodar() {
  docker rm -f "$NOME" >/dev/null 2>&1 || true
  docker run -d --name "$NOME" --restart unless-stopped --memory 3g \
    --user "$(id -u):$(id -g)" \
    -p "127.0.0.1:$PORTA:3000" \
    --env-file "$RAIZ/.env" \
    -e NODE_ENV=production -e HOSTNAME=0.0.0.0 -e PORT=3000 \
    -v "$1:/app" -w /app \
    node:22-slim node server.js >/dev/null
}

no_ar() {
  for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORTA/" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

rodar "$DESTINO"
if no_ar; then
  ls -1dt "$RAIZ"/versoes/* | tail -n +4 | xargs -r rm -rf
  echo "no ar: $(basename "$DESTINO")"
  exit 0
fi

docker logs --tail 60 "$NOME" || true
if [ -n "$ANTERIOR" ] && [ -d "$ANTERIOR" ]; then
  echo "falhou; voltando para $(basename "$ANTERIOR")"
  rodar "$ANTERIOR"
  no_ar && echo "versão anterior de volta no ar"
fi
exit 1
