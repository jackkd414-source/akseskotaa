#!/bin/bash
echo ""
echo "  AksesKota - Server produksi lokal"
echo "  ================================="
echo "  Buka browser: http://localhost:8080"
echo "  Tekan Ctrl+C untuk berhenti."
echo "  Butuh Node.js 18+"
echo ""

if ! command -v node &>/dev/null; then
    echo "  ERROR: Node.js tidak ditemukan. Install dari https://nodejs.org"
    exit 1
fi

(cd "$(dirname "$0")" && node server-local.js) &
PID=$!
sleep 1
xdg-open http://localhost:8080 2>/dev/null || open http://localhost:8080 2>/dev/null || true
wait $PID
