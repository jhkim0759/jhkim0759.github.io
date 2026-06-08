@echo off
REM ==========================================================
REM  SceneConductor project page - local preview launcher
REM ==========================================================
REM
REM  Double-click this file (or run from the terminal) to:
REM    1. Open the page in your default browser at
REM       http://localhost:8000/
REM    2. Start a tiny Python static-file server in this window.
REM
REM  IMPORTANT: do NOT open index.html directly (file:///...) -
REM  the browser blocks .glb / .woff loads under file:// due to
REM  CORS. The page only works through http://.
REM
REM  To stop the server: press Ctrl+C in this window or close it.
REM ==========================================================

cd /d "%~dp0"

echo.
echo Opening http://localhost:8000/ in your default browser ...
start "" "http://localhost:8000/"

echo Starting local HTTP server on port 8000 (Ctrl+C to stop) ...
echo.
python -m http.server 8000

REM If python is not found, fall back to py launcher.
if errorlevel 9009 (
    echo.
    echo [warn] 'python' not found - trying 'py -3' ...
    py -3 -m http.server 8000
)

pause
