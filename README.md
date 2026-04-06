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

## Features

- Browse and select ODB files via native file dialog
- Scan ODB structure (steps, frames, field outputs)
- Configure extraction regions and outputs
- Generate and run Abaqus extraction scripts
- Export results to Excel
