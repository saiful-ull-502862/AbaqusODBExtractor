@echo off
title Abaqus ODB Extractor
echo ============================================
echo   Abaqus ODB Extractor - Starting...
echo ============================================
echo.

cd /d "%~dp0backend"

:: Try to find Python
set PYTHON_CMD=
where python >nul 2>&1 && set PYTHON_CMD=python && goto :found_python
where python3 >nul 2>&1 && set PYTHON_CMD=python3 && goto :found_python
where py >nul 2>&1 && set PYTHON_CMD=py && goto :found_python

:: Check common installation paths
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python38\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
    "C:\Python39\python.exe"
    "C:\Python38\python.exe"
    "%ProgramFiles%\Python313\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "%ProgramFiles%\Python311\python.exe"
    "%ProgramFiles%\Python310\python.exe"
) do (
    if exist %%P (
        set PYTHON_CMD=%%~P
        goto :found_python
    )
)

:: Python not found anywhere
echo.
echo [ERROR] Python not found!
echo.
echo To fix this, try ONE of the following:
echo.
echo   Option 1: Find Python on this PC
echo     1. Open PowerShell and run:
echo        Get-ChildItem -Path C:\ -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue ^| Select FullName
echo     2. Copy the full path and add it to your system PATH
echo.
echo   Option 2: Install Python
echo     1. Download from https://www.python.org/downloads/
echo     2. IMPORTANT: Check "Add Python to PATH" during installation
echo     3. Restart this script
echo.
pause
exit /b 1

:found_python
echo Found Python: %PYTHON_CMD%
%PYTHON_CMD% --version

:: Install dependencies if needed
echo Checking dependencies...
%PYTHON_CMD% -c "import flask, flask_cors, openpyxl" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    %PYTHON_CMD% -m pip install flask flask-cors openpyxl
)

:: Kill any existing Flask on port 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Starting server on http://localhost:5000
echo.
echo Opening browser in 2 seconds...
echo Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Start Flask (this blocks until Ctrl+C)
%PYTHON_CMD% app.py
