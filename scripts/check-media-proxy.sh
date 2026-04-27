#!/usr/bin/env bash
set -euo pipefail

MEDIA_HOST="${MEDIA_HOST:-}"
MEDIA_PROXY_KEY="${MEDIA_PROXY_KEY:-}"

if [[ -z "$MEDIA_HOST" ]]; then
  echo "ERROR: MEDIA_HOST no está definido"
  exit 1
fi

if [[ -z "$MEDIA_PROXY_KEY" ]]; then
  echo "ERROR: MEDIA_PROXY_KEY no está definido"
  exit 1
fi

echo "Probando media-url en ${MEDIA_HOST} ..."
media_url_status="$(curl -s -o /tmp/watchparty_media_url_test.json -w '%{http_code}' \
  "${MEDIA_HOST%/}/api/media-url?path=test.mp4&public=true" \
  -H "x-media-key: ${MEDIA_PROXY_KEY}")"

echo "Status media-url: ${media_url_status}"
cat /tmp/watchparty_media_url_test.json
echo

echo "Probando media-upload en ${MEDIA_HOST} ..."
media_upload_status="$(curl -s -o /tmp/watchparty_media_upload_test.json -w '%{http_code}' \
  -X POST "${MEDIA_HOST%/}/api/media-upload" \
  -H "Content-Type: application/json" \
  -H "x-media-key: ${MEDIA_PROXY_KEY}" \
  -d '{"action":"presign-upload","fileName":"test.mp4","contentType":"video/mp4","isPublic":true}')"

echo "Status media-upload: ${media_upload_status}"
cat /tmp/watchparty_media_upload_test.json
echo

if [[ "${media_url_status}" == "200" || "${media_url_status}" == "500" || "${media_url_status}" == "404" ]]; then
  echo "media-url respondió con autenticación válida."
else
  echo "media-url no respondió como se esperaba."
fi

if [[ "${media_upload_status}" == "200" ]]; then
  echo "media-upload respondió correctamente."
else
  echo "media-upload no respondió correctamente."
fi
