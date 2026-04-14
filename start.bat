@echo off
title Abaqus ODB Extractor
echo ============================================
echo   Abaqus ODB Extractor - Starting...
echo ============================================
echo.

cd /d "%~dp0backend"

:: Check Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found in PATH!
    echo Please install Python 3 or add it to your PATH.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "venv" (
    echo Installing dependencies...
    pip install flask flask-cors openpyxl >nul 2>&1
)

:: Kill any existing Flask on port 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting server on http://localhost:5000
echo.
echo Opening browser in 2 seconds...
echo Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Start Flask (this blocks until Ctrl+C)
python app.py
