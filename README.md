# Abaqus ODB Extractor

A web-based GUI for extracting field output data from Abaqus ODB files. Built with React (frontend) and Flask (backend).

## Prerequisites

- **Python 3.8+** with pip
- **Node.js 18+** with npm (for development only)
- **Abaqus** installed and accessible from PATH

## Quick Start (Windows)

1. Clone this repository:
   ```bash
   git clone https://github.com/saiful-ull-502862/AbaqusODBExtractor.git
   cd AbaqusODBExtractor
   ```

2. Install Python dependencies:
   ```bash
   pip install flask flask-cors openpyxl
   ```

3. Double-click `start.bat` or run:
   ```bash
   cd backend
   python app.py
   ```

4. Open your browser at **http://localhost:5000**

## Development Setup

If you want to modify the frontend:

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:5173 and proxies API calls to Flask at port 5000.

### Build Frontend

```bash
cd frontend
npm run build
```

This outputs the production build to `backend/static/`.

## Project Structure

```
AbaqusODBExtractor/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── static/             # Built frontend (served by Flask)
├── frontend/
│   ├── src/                # React source code
│   ├── package.json        # Node dependencies
│   └── vite.config.js      # Vite config with API proxy
├── start.bat               # One-click launcher (Windows)
└── README.md
```

## Troubleshooting: Abaqus Not Found

If you see the error `[ERROR] Abaqus command not found: abaqus`, it means the app can't locate your Abaqus installation. Follow these steps:

### Step 1: Find the Abaqus path

Open **PowerShell** and run:

```powershell
Get-ChildItem -Path C:\ -Filter "abaqus.bat" -Recurse -ErrorAction SilentlyContinue | Select FullName
```

This searches your entire C: drive (may take a minute). You'll get a result like:

```
C:\SIMULIA\Abaqus\Commands\abaqus.bat
```

### Step 2: Enter the path in the app

1. Go to **Step 7 (Execute)** in the app
2. Paste the full path into the **Abaqus Configuration** field
3. Click **Auto-detect** to verify it works

### Common Abaqus Paths

| Version | Typical Path |
|---------|-------------|
| Abaqus 6.14 | `C:\SIMULIA\Abaqus\Commands\abaqus.bat` |
| Abaqus 2020-2025 | `C:\SIMULIA\Commands\abaqus.bat` |
| Abaqus (alt) | `C:\SIMULIA\EstProducts\Commands\abaqus.bat` |
| Abaqus (Dassault) | `C:\Program Files\Dassault Systemes\SimulationServices\V6R20XX\win_b64\code\bin\ABQLauncher.exe` |

## Compatibility

Tested with:
- Abaqus 6.14
- Abaqus 2023
- Should work with any Abaqus version that supports `abaqus cae noGUI` or `abaqus python` commands

## Features

- Browse and select ODB files via native file dialog
- Scan ODB structure (steps, frames, field outputs)
- Configure extraction regions and outputs
- Generate and run Abaqus extraction scripts
- Export results to Excel
