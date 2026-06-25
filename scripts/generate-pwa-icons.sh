#!/usr/bin/env bash
# Regenerate PWA / home-screen icons from the participant mascot asset.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${ROOT}/public/images/adimagendo-mascot-transparent.png"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing source image: $SOURCE" >&2
  exit 1
fi

sips -z 180 180 "$SOURCE" --out "${ROOT}/public/apple-touch-icon.png" >/dev/null
sips -z 192 192 "$SOURCE" --out "${ROOT}/public/icon-192x192.png" >/dev/null
sips -z 512 512 "$SOURCE" --out "${ROOT}/public/icon-512x512.png" >/dev/null
sips -z 32 32 "$SOURCE" --out "${ROOT}/public/favicon.png" >/dev/null
sips -z 192 192 "$SOURCE" --out "${ROOT}/public/icons/icon-192x192.png" >/dev/null
sips -z 512 512 "$SOURCE" --out "${ROOT}/public/icons/icon-512x512.png" >/dev/null
cp "${ROOT}/public/favicon.png" "${ROOT}/src/app/icon.png"
cp "${ROOT}/public/apple-touch-icon.png" "${ROOT}/src/app/apple-icon.png"
if [[ -f "${ROOT}/src/app/favicon.ico" ]]; then
  rm "${ROOT}/src/app/favicon.ico"
fi

echo "Generated PWA icons from adimagendo-mascot-transparent.png"
