#!/bin/bash
echo ""
echo "  AksesKota — Starting local server..."
echo "  This terminal must stay open."
echo ""
echo "  Open browser: http://localhost:8080"
echo "  Press Ctrl+C to stop."
echo ""

# Try Python first
if command -v python3 &>/dev/null; then
    open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null &
    python3 -m http.server 8080
elif command -v python &>/dev/null; then
    open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null &
    python -m http.server 8080
elif command -v node &>/dev/null; then
    open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null &
    npx http-server . -p 8080 -c-1
else
    echo ""
    echo "  ERROR: Python or Node.js not found!"
    echo "  Install one of them:"
    echo "    - Python: https://www.python.org/downloads/"
    echo "    - Node.js: https://nodejs.org/"
    echo ""
    exit 1
fi
