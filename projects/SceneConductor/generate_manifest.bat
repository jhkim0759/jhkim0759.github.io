@echo off
REM ==========================================================
REM  Scan static/data/pipeline/ and static/data/comparison/ ,
REM  emit a manifest.json in each.
REM
REM  Run this BEFORE pushing to GitHub Pages (Pages doesn't
REM  serve directory listings).
REM
REM  Locally the page still auto-detects via directory listing,
REM  so you don't need to run this for `open.bat`.
REM ==========================================================
cd /d "%~dp0"
python tasks\generate_manifest.py
echo.
echo Done. Commit & push the new manifest.json files.
pause
