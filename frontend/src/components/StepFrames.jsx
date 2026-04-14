import { useStore } from '../store'

const DEFAULT_STEPS = [
  'Initial', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
  'Sixth', 'Seventh', 'Eighth', 'Nineth', 'Tenth',
]

export default function StepFrames() {
  const {
    simulationMode, setSimulationMode,
    stepsMode, setStepsMode, selectedSteps, setSelectedSteps, toggleStep,
    frameSelection, setFrameSelection, customFrames, setCustomFrames,
    loadingStep, setLoadingStep, relaxationStep, setRelaxationStep,
    scanResult,
  } = useStore()

  const hasScanned = !!(scanResult?.steps && scanResult.steps.length > 0)

  const availableSteps = hasScanned
    ? scanResult.steps.map(s => ({ name: s.name, frames: s.frameCount, totalTime: s.totalTime }))
    : DEFAULT_STEPS.map(n => ({ name: n, frames: null, totalTime: null }))

  const selectAllSteps = () => setSelectedSteps(availableSteps.map(s => s.name))
  const deselectAllSteps = () => setSelectedSteps([])

  // Format step time for display
  const formatTime = (t) => {
    if (t === null || t === undefined) return ''
    return t >= 1 ? `${t.toFixed(1)}s` : `${(t * 1000).toFixed(1)}ms`
  }

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Steps & Frames</h2>
          <p className="text-sm text-gray-400">Choose which analysis steps and frames to extract</p>
        </div>
      </div>

      {/* Simulation Mode Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Simulation Type</label>
        <div className="flex gap-3">
          {[
            { val: 'multi', label: 'Multi-Step', desc: 'Multiple loading/relaxation cycles' },
            { val: 'single', label: 'Single Step', desc: 'One loading + one relaxation step' },
          ].map(opt => (
            <label key={opt.val} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition flex-1
              ${simulationMode === opt.val ? 'border-cyan-500/50 bg-cyan-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
              <input type="radio" checked={simulationMode === opt.val} onChange={() => setSimulationMode(opt.val)} className="w-4 h-4" />
              <div>
                <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ============ SINGLE STEP MODE ============ */}
      {simulationMode === 'single' && (
        <>
          {/* ODB scan status */}
          {hasScanned ? (
            <div className="p-3 rounded-lg bg-green-900/20 border border-green-800/40 text-xs text-green-300 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              ODB scanned — {availableSteps.length} steps detected. Select from the dropdowns below.
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-800/40 text-xs text-yellow-300 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              No ODB scanned yet. Type the exact step names manually, or go back to Step 1 and scan your ODB file first.
            </div>
          )}

          {/* Loading Step */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Loading Step</label>
            {hasScanned ? (
              // Dropdown with scanned steps
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {availableSteps.map(step => (
                    <label
                      key={step.name}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
                        ${loadingStep === step.name ? 'border-blue-500/50 bg-blue-600/10' : 'border-gray-800 hover:border-gray-700'}
                        ${step.name === relaxationStep ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="loadingStep"
                        checked={loadingStep === step.name}
                        disabled={step.name === relaxationStep}
                        onChange={() => setLoadingStep(step.name)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-mono text-gray-200">{step.name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {step.frames !== null && <span>{step.frames} frames</span>}
                          {step.totalTime !== null && <span>t = {formatTime(step.totalTime)}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              // Manual text input
              <input
                type="text"
                value={loadingStep}
                onChange={e => setLoadingStep(e.target.value)}
                placeholder="e.g., Loading, First, Step-1..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">The step where load is applied to the model</p>
          </div>

          {/* Relaxation Step */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Relaxation Step</label>
            {hasScanned ? (
              // Dropdown with scanned steps
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {availableSteps.map(step => (
                    <label
                      key={step.name}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
                        ${relaxationStep === step.name ? 'border-purple-500/50 bg-purple-600/10' : 'border-gray-800 hover:border-gray-700'}
                        ${step.name === loadingStep ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="relaxationStep"
                        checked={relaxationStep === step.name}
                        disabled={step.name === loadingStep}
                        onChange={() => setRelaxationStep(step.name)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-mono text-gray-200">{step.name}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {step.frames !== null && <span>{step.frames} frames</span>}
                          {step.totalTime !== null && <span>t = {formatTime(step.totalTime)}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              // Manual text input
              <input
                type="text"
                value={relaxationStep}
                onChange={e => setRelaxationStep(e.target.value)}
                placeholder="e.g., Relaxation, Second, Step-2..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">The step where the model relaxes after loading</p>
          </div>

          {/* Frame Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Frame Selection</label>
            <div className="flex flex-wrap gap-3">
              {[
                { val: 'LAST', label: 'Last Frame Only', desc: 'Equilibrium state (most common)' },
                { val: 'ALL', label: 'All Frames', desc: 'Full time history' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
                  ${frameSelection === opt.val ? 'border-blue-500/50 bg-blue-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
                  <input type="radio" checked={frameSelection === opt.val} onChange={() => setFrameSelection(opt.val)} className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800 text-xs text-gray-400 flex gap-2">
            <svg className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              {loadingStep && relaxationStep
                ? <>Loading step "<span className="text-cyan-300">{loadingStep}</span>" and relaxation step "<span className="text-cyan-300">{relaxationStep}</span>" will be processed, extracting the {frameSelection === 'LAST' ? 'last frame' : 'all frames'} from each step.</>
                : 'Please select both a loading step and a relaxation step.'
              }
            </span>
          </div>
        </>
      )}

      {/* ============ MULTI-STEP MODE ============ */}
      {simulationMode === 'multi' && (
        <>
          {/* Step Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Step Selection Mode</label>
            <div className="flex gap-3">
              {[
                { val: 'ALL', label: 'All Steps' },
                { val: 'CUSTOM', label: 'Custom Selection' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm transition
                  ${stepsMode === opt.val ? 'border-blue-500/50 bg-blue-600/10 text-blue-300' : 'border-gray-800 text-gray-400 hover:border-gray-700'}`}>
                  <input type="radio" checked={stepsMode === opt.val} onChange={() => setStepsMode(opt.val)} className="w-4 h-4" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Step Selection (when custom) */}
          {stepsMode === 'CUSTOM' && (
            <div>
              <div className="flex gap-2 mb-3">
                <button onClick={selectAllSteps} className="px-3 py-1 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">Select All</button>
                <button onClick={deselectAllSteps} className="px-3 py-1 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">Deselect All</button>
                <span className="text-xs text-gray-500 flex items-center ml-2">{selectedSteps.length} selected</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSteps.map(step => {
                  const sel = selectedSteps.includes(step.name)
                  return (
                    <label
                      key={step.name}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition
                        ${sel ? 'border-cyan-500/40 bg-cyan-600/10 text-cyan-300' : 'border-gray-800 text-gray-400 hover:border-gray-700'}`}
                    >
                      <input type="checkbox" checked={sel} onChange={() => toggleStep(step.name)} className="w-3.5 h-3.5" />
                      <span className="font-mono">{step.name}</span>
                      {step.frames !== null && (
                        <span className="text-xs text-gray-500 ml-auto">{step.frames} frames</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Frame Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Frame Selection</label>
            <div className="flex flex-wrap gap-3">
              {[
                { val: 'LAST', label: 'Last Frame Only', desc: 'Equilibrium state (most common)' },
                { val: 'ALL', label: 'All Frames', desc: 'Full time history' },
              ].map(opt => (
                <label key={opt.val} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
                  ${frameSelection === opt.val ? 'border-blue-500/50 bg-blue-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
                  <input type="radio" checked={frameSelection === opt.val} onChange={() => setFrameSelection(opt.val)} className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium text-gray-200">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800 text-xs text-gray-400 flex gap-2">
            <svg className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              {stepsMode === 'ALL' ? `All ${availableSteps.length} steps` : `${selectedSteps.length} steps`} will be processed,
              extracting the {frameSelection === 'LAST' ? 'last frame' : 'all frames'} from each step.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
