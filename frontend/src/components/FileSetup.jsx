import { useStore } from '../store'
import { api } from '../api'

export default function FileSetup() {
  const {
    odbPath, setOdbPath, outputDir, setOutputDir,
    instanceName, setInstanceName, scanning, setScanning,
    scanError, setScanError, setScanResult, scanResult,
    abaqusPath, setModelWidth, setModelHeight,
  } = useStore()

  const handleBrowseOdb = async () => {
    try {
      const { path } = await api.browseFile()
      if (path) {
        setOdbPath(path)
        // Auto-set output dir
        if (!outputDir) {
          const dir = path.replace(/[/\\][^/\\]+$/, '') + '/Results'
          setOutputDir(dir)
        }
      }
    } catch (e) {
      setScanError(e.message)
    }
  }

  const handleBrowseOutput = async () => {
    try {
      const { path } = await api.browseDir(outputDir)
      if (path) setOutputDir(path)
    } catch (e) {
      setScanError(e.message)
    }
  }

  const handleScan = async () => {
    if (!odbPath) { setScanError('Please select an ODB file first.'); return }
    setScanning(true)
    setScanError('')
    try {
      const result = await api.scanOdb(odbPath, abaqusPath)
      setScanResult(result)
      // Auto-set model dimensions from bounding box
      if (result.boundingBox) {
        const bb = result.boundingBox
        setModelWidth(Math.round((bb.xMax - bb.xMin) * 10000) / 10000)
        setModelHeight(Math.round((bb.yMax - bb.yMin) * 10000) / 10000)
      }
    } catch (e) {
      setScanError(e.message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">File Setup</h2>
          <p className="text-sm text-gray-400">Select your ODB file and configure paths</p>
        </div>
      </div>

      {/* ODB File */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">ODB File Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={odbPath}
            onChange={e => setOdbPath(e.target.value)}
            placeholder="e.g., F:\Simulations\model.odb"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
          />
          <button onClick={handleBrowseOdb} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm flex items-center gap-1.5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
            Browse
          </button>
        </div>
      </div>

      {/* Output Directory */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Output Directory</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            placeholder="e.g., F:\Simulations\Results"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
          />
          <button onClick={handleBrowseOutput} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm flex items-center gap-1.5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
            Browse
          </button>
        </div>
      </div>

      {/* Instance Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Instance Name</label>
        <input
          type="text"
          value={instanceName}
          onChange={e => setInstanceName(e.target.value)}
          className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">Name of the part instance in the assembly</p>
      </div>

      {/* Scan ODB Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleScan}
          disabled={scanning || !odbPath}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium hover:from-blue-500 hover:to-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {scanning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Scanning ODB...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              Scan ODB
            </>
          )}
        </button>
        {scanning && <span className="text-sm text-gray-400">This may take a minute for large models...</span>}
      </div>

      {/* Error */}
      {scanError && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
          {scanError}
        </div>
      )}

      {/* Scan Results Summary */}
      {scanResult && (
        <div className="p-4 rounded-lg bg-green-900/20 border border-green-700/30 space-y-2">
          <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            ODB Scanned Successfully
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{scanResult.instances?.length || 0}</div>
              <div className="text-xs text-gray-400">Instances</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{scanResult.elementSets?.length || 0}</div>
              <div className="text-xs text-gray-400">Element Sets</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{scanResult.steps?.length || 0}</div>
              <div className="text-xs text-gray-400">Steps</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{scanResult.fieldOutputs?.length || 0}</div>
              <div className="text-xs text-gray-400">Field Outputs</div>
            </div>
          </div>
          {scanResult.boundingBox && (
            <p className="text-xs text-gray-400 mt-2">
              Bounding Box: X [{scanResult.boundingBox.xMin.toFixed(4)}, {scanResult.boundingBox.xMax.toFixed(4)}] mm,
              Y [{scanResult.boundingBox.yMin.toFixed(4)}, {scanResult.boundingBox.yMax.toFixed(4)}] mm
            </p>
          )}
        </div>
      )}
    </div>
  )
}
