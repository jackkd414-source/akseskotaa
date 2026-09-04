@echo off
echo.
echo   AksesKota — Starting local server...
echo   This window must stay open.
echo.
echo   Open browser: http://localhost:8080
echo   Press Ctrl+C to stop.
echo.

:: Try Python first
where python >nul 2>&1 && (
    start "" http://localhost:8080
    python -m http.server 8080
    goto :end
)

:: Try python3
where python3 >nul 2>&1 && (
    start "" http://localhost:8080
    python3 -m http.server 8080
    goto :end
)

:: Try Node.js
where node >nul 2>&1 && (
    start "" http://localhost:8080
    npx http-server . -p 8080 -c-1
    goto :end
)

echo.
echo   ERROR: Python or Node.js not found!
echo   Install one of them:
echo     - Python: https://www.python.org/downloads/
echo     - Node.js: https://nodejs.org/
echo.

:end
