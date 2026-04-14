import { useStore } from '../store'
import { api } from '../api'

export default function OutputConfig() {
  const {
    outputDir, setOutputDir, selectedElementSets, getRegions,
    selectedOutputs, instanceName, stepsMode, selectedSteps, scanResult,
    simulationMode, loadingStep, relaxationStep,
  } = useStore()

  const { regions, xLabels, yLabels, is2D } = getRegions()

  // Determine step names for sheet preview
  const allStepNames = scanResult?.steps?.map(s => s.name) || []
  const stepNames = simulationMode === 'single'
    ? [loadingStep, relaxationStep].filter(Boolean)
    : (stepsMode === 'ALL' ? allStepNames : selectedSteps)

  const handleBrowse = async () => {
    try {
      const { path } = await api.browseDir(outputDir)
      if (path) setOutputDir(path)
    } catch (e) { /* ignore */ }
  }

  // Excel file and sheet preview — one sheet per variable × stat × step
  const excelFiles = selectedElementSets.map(elset => {
    const setShort = elset.includes('.') ? elset.split('.').pop() : elset
    const sheets = []
    for (const o of selectedOutputs) {
      for (const stat of ['Max', 'Min']) {
        for (const step of stepNames) {
          const stepShort = step.replace(/\s+/g, '')
          let name = `${o.label}_${stat}_${stepShort}`
          if (name.length > 31) name = name.slice(0, 31)
          sheets.push(name)
        }
      }
    }
    return { name: `${setShort}_Results.xlsx`, sheets }
  })

  const sheetsPerFile = selectedOutputs.length * 2 * stepNames.length

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Output Configuration</h2>
          <p className="text-sm text-gray-400">Configure output directory and review Excel format</p>
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
            placeholder="Select output directory..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono"
          />
          <button onClick={handleBrowse} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm flex items-center gap-1.5 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
            Browse
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{selectedElementSets.length}</div>
          <div className="text-xs text-gray-400">Excel Files</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{sheetsPerFile}</div>
          <div className="text-xs text-gray-400">Sheets per File</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{stepNames.length}</div>
          <div className="text-xs text-gray-400">Steps</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{regions.length}</div>
          <div className="text-xs text-gray-400">Regions</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-300">{is2D ? '2D Grid' : '1D Sweep'}</div>
          <div className="text-xs text-gray-400">Layout Mode</div>
        </div>
      </div>

      {/* Excel Layout Preview */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Excel Layout Preview</h3>
        <div className="bg-gray-900/70 rounded-lg p-4 space-y-4 max-h-80 overflow-y-auto">
          {/* Layout description */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>One sheet per <span className="text-white">Variable</span> × <span className="text-white">Stat</span> × <span className="text-white">Step</span> (e.g. S22_Max_Step-1)</p>
            {is2D ? (
              <>
                <p className="font-mono text-blue-400">Columns = X positions: {xLabels.slice(0, 8).join(', ')}{xLabels.length > 8 ? '...' : ''}</p>
                <p className="font-mono text-purple-400">Rows = Y positions: {yLabels.slice(0, 8).join(', ')}{yLabels.length > 8 ? '...' : ''}</p>
              </>
            ) : (
              <>
                <p className="font-mono text-blue-400">
                  Rows = {xLabels.length > 1 ? 'X' : 'Y'} positions: {(xLabels.length > 1 ? xLabels : yLabels).slice(0, 8).join(', ')}{(xLabels.length > 1 ? xLabels : yLabels).length > 8 ? '...' : ''}
                </p>
              </>
            )}
          </div>

          {/* File list */}
          {excelFiles.map((file, fi) => (
            <div key={fi} className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-green-900/20 border-b border-gray-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-sm font-mono text-green-300">{file.name}</span>
              </div>
              <div className="px-3 py-2 flex flex-wrap gap-1.5">
                {file.sheets.slice(0, 12).map((sheet, si) => (
                  <span key={si} className={`px-2 py-0.5 rounded text-xs font-mono ${
                    sheet.endsWith('_Max') ? 'bg-blue-900/30 text-blue-300 border border-blue-800/40' :
                    'bg-purple-900/30 text-purple-300 border border-purple-800/40'
                  }`}>
                    {sheet}
                  </span>
                ))}
                {file.sheets.length > 12 && (
                  <span className="text-xs text-gray-500">...+{file.sheets.length - 12} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Also generates CSV note */}
      <p className="text-xs text-gray-500">
        A consolidated CSV file per element set is also generated alongside the Excel for archival purposes.
      </p>
    </div>
  )
}
