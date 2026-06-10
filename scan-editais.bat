@echo off
echo Running Edital Scanner...
cd /d "%~dp0"
python scraper/check_editais.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Scan complete! Status saved to src/assets/data/program-status.json
    echo.
    echo To see results in the app, run: npm run dev
) else (
    echo.
    echo Scan encountered errors. See output above.
)
pause
