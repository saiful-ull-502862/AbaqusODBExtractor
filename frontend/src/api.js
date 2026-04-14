const BASE = '/api'

async function post(url, data = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export const api = {
  browseFile: () => post('/browse-file'),
  browseDir: (initialDir = '') => post('/browse-dir', { initialDir }),
  scanOdb: (odbPath, abaqusPath) => post('/scan-odb', { odbPath, abaqusPath }),
  detectAbaqus: (customPath = '') => post('/detect-abaqus', { customPath }),
  generateScript: (config) => post('/generate-script', config),
  runScript: (params) => post('/run-script', params),
  stopRun: () => post('/stop-run'),
  openFolder: (path) => post('/open-folder', { path }),
  postProcessExcel: (outputDir) => post('/post-process-excel', { outputDir }),

  streamLogs() {
    return new EventSource(`${BASE}/run-status`)
  },
}
