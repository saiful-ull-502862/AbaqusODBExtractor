import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { api } from '../api'

function LogConsole({ logs, onClear }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLineClass = (line) => {
    if (line.startsWith('[ERROR]') || line.includes('*** ERROR')) return 'text-red-400'
    if (line.includes('WARNING') || line.includes('warning')) return 'text-yellow-400'
    if (line.startsWith('[SYSTEM]')) return 'text-blue-400'
    if (line.includes('>>') || line.includes('Wrote') || line.includes('COMPLETE')) return 'text-green-400'
    if (line.startsWith('===') || line.startsWith('  ===')) return 'text-gray-500'
    return 'text-gray-300'
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Console Output</h3>
        <div className="flex gap-2">
          <button onClick={onClear} className="px-2 py-1 rounded text-xs border border-gray-700 text-gray-400 hover:bg-gray-800">Clear</button>
          <button
            onClick={() => {
              const text = logs.join('\n')
              const blob = new Blob([text], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'extraction_log.txt'
              a.click(); URL.revokeObjectURL(url)
            }}
            className="px-2 py-1 rounded text-xs border border-gray-700 text-gray-400 hover:bg-gray-800"
          >Save Log</button>
        </div>
      </div>
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 h-56 overflow-y-auto font-mono text-xs leading-5">
        {logs.length === 0 ? (
          <span className="text-gray-600">Waiting for output...</span>
        ) : logs.map((line, i) => (
          <div key={i} className={getLineClass(line)}>{line}</div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

/** Parse log lines to extract structured progress info */
function useProgressInfo(logs) {
  return useMemo(() => {
    const info = {
      phase: 'initializing',  // initializing, scanning, extracting, writing, complete
      currentElset: '',
      totalElsets: 0,
      currentRegion: 0,
      totalRegions: 0,
      currentStep: '',
      elementsInRegion: 0,
      elementsInSet: 0,
      nodesIndexed: 0,
      filesWritten: 0,
      odbOpened: false,
      lastActivity: '',
    }

    for (const line of logs) {
      // ODB opened
      if (line.includes('Opening ODB:')) {
        info.phase = 'scanning'
        info.odbOpened = true
      }

      // Nodes indexed
      const nodesMatch = line.match(/Nodes indexed:\s*(\d+)/)
      if (nodesMatch) info.nodesIndexed = parseInt(nodesMatch[1])

      // Total regions/elsets from summary
      const regionsMatch = line.match(/Regions to process:\s*(\d+)/)
      if (regionsMatch) info.totalRegions = parseInt(regionsMatch[1])

      const elsetsMatch = line.match(/Element sets to process:\s*(\d+)/)
      if (elsetsMatch) info.totalElsets = parseInt(elsetsMatch[1])

      // Current element set
      const elsetMatch = line.match(/Processing Element Set:\s*(.+)/)
      if (elsetMatch) {
        info.currentElset = elsetMatch[1].trim()
        info.phase = 'extracting'
      }

      // Elements in set
      const setElemsMatch = line.match(/Total elements in set:\s*(\d+)/)
      if (setElemsMatch) info.elementsInSet = parseInt(setElemsMatch[1])

      // Region progress [N/M]
      const regionMatch = line.match(/\[(\d+)\/(\d+)\]\s*(\S+):/)
      if (regionMatch) {
        info.currentRegion = parseInt(regionMatch[1])
        info.totalRegions = parseInt(regionMatch[2])
      }

      // Elements in region
      const regionElemsMatch = line.match(/Elements in region:\s*(\d+)/)
      if (regionElemsMatch) info.elementsInRegion = parseInt(regionElemsMatch[1])

      // Current step
      const stepMatch = line.match(/Step:\s*(\S+)/)
      if (stepMatch) info.currentStep = stepMatch[1].trim()

      // Wrote CSV
      if (line.includes('Wrote consolidated CSV:')) {
        info.filesWritten++
        info.phase = 'writing'
      }

      // Complete
      if (line.includes('EXTRACTION COMPLETE')) {
        info.phase = 'complete'
      }

      // Track last meaningful activity
      if (!line.startsWith('[SYSTEM]') && !line.startsWith('===') && line.trim()) {
        info.lastActivity = line.trim()
      }
    }

    return info
  }, [logs])
}

function ProgressPanel({ logs, elapsed }) {
  const p = useProgressInfo(logs)

  const phaseLabel = {
    initializing: 'Starting Abaqus...',
    scanning: 'Scanning ODB & building coordinate maps...',
    extracting: 'Extracting field outputs...',
    writing: 'Writing output files...',
    complete: 'Extraction complete!',
  }

  const progressPct = p.totalRegions > 0
    ? Math.min(100, Math.round((p.currentRegion / p.totalRegions) * 100))
    : 0

  return (
    <div className="p-4 rounded-lg bg-gray-900/70 border border-blue-900/40 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          {phaseLabel[p.phase] || 'Running...'}
        </h3>
        <span className="text-sm font-mono text-gray-400">{elapsed.toFixed(1)}s</span>
      </div>

      {/* Progress bar */}
      {p.totalRegions > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Region {p.currentRegion} / {p.totalRegions}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Status grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {p.currentElset && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Element Set</div>
            <div className="text-xs font-mono text-blue-300 truncate">{p.currentElset.split('.').pop()}</div>
          </div>
        )}
        {p.currentStep && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Current Step</div>
            <div className="text-xs font-mono text-purple-300 truncate">{p.currentStep}</div>
          </div>
        )}
        {p.elementsInRegion > 0 && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Elements in Region</div>
            <div className="text-xs font-mono text-green-300">{p.elementsInRegion.toLocaleString()}</div>
          </div>
        )}
        {p.nodesIndexed > 0 && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Nodes Indexed</div>
            <div className="text-xs font-mono text-gray-300">{p.nodesIndexed.toLocaleString()}</div>
          </div>
        )}
        {p.filesWritten > 0 && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">CSV Files Written</div>
            <div className="text-xs font-mono text-green-300">{p.filesWritten}</div>
          </div>
        )}
        {p.elementsInSet > 0 && (
          <div className="bg-gray-800/50 rounded px-2.5 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Elements in Set</div>
            <div className="text-xs font-mono text-gray-300">{p.elementsInSet.toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Execution() {
  const s = useStore()
  const [showScript, setShowScript] = useState(false)
  const [generating, setGenerating] = useState(false)
  const eventSourceRef = useRef(null)

  const handleDetectAbaqus = async () => {
    try {
      const result = await api.detectAbaqus(s.abaqusPath === 'abaqus' ? '' : s.abaqusPath)
      if (result.found) {
        s.setAbaqusPath(result.path)
        s.setAbaqusVersion(result.version)
        s.setAbaqusDetected(true)
      } else {
        s.setAbaqusVersion(result.error || 'Not found')
        s.setAbaqusDetected(false)
      }
    } catch (e) {
      s.setAbaqusVersion(e.message)
      s.setAbaqusDetected(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const regionResult = s.getRegions()
      // For single step mode, pass the two selected steps as custom steps
      const effectiveStepsMode = s.simulationMode === 'single' ? 'CUSTOM' : s.stepsMode
      const effectiveCustomSteps = s.simulationMode === 'single'
        ? [s.loadingStep, s.relaxationStep].filter(Boolean)
        : s.selectedSteps

      const config = {
        odbPath: s.odbPath,
        outputDir: s.outputDir,
        instanceName: s.instanceName,
        modelWidth: s.modelWidth,
        modelHeight: s.modelHeight,
        elementSets: s.selectedElementSets,
        regions: regionResult.regions,
        xLabels: regionResult.xLabels,
        yLabels: regionResult.yLabels,
        is2D: regionResult.is2D,
        outputs: s.selectedOutputs.map(o => ({
          fieldKey: o.fieldKey,
          compOrInv: o.compOrInv,
          label: o.label,
        })),
        stepsMode: effectiveStepsMode,
        customSteps: effectiveCustomSteps,
        frameSelection: s.frameSelection,
      }
      const result = await api.generateScript(config)
      s.setScriptPath(result.scriptPath)
      s.setScriptContent(result.scriptContent)
    } catch (e) {
      s.addLog('[ERROR] Script generation failed: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleRun = async () => {
    if (!s.scriptPath) { s.addLog('[ERROR] Generate a script first.'); return }
    s.clearLogs()
    s.setRunStatus('running')

    try {
      await api.runScript({
        scriptPath: s.scriptPath,
        abaqusPath: s.abaqusPath,
        execMode: s.execMode,
        workingDir: s.outputDir,
      })

      // Start SSE
      const es = new EventSource('/api/run-status')
      eventSourceRef.current = es

      es.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'log') {
          s.addLog(data.message)
        } else if (data.type === 'heartbeat') {
          s.setElapsed(data.elapsed)
          if (data.status !== 'running') {
            s.setRunStatus(data.status)
          }
        } else if (data.type === 'done') {
          s.setElapsed(data.elapsed)
          es.close()
          eventSourceRef.current = null

          if (data.status === 'completed') {
            // Post-process: generate consolidated Excel
            s.addLog('[SYSTEM] Generating consolidated Excel file...')
            try {
              const excelResult = await api.postProcessExcel(s.outputDir)
              s.addLog('[SYSTEM] Excel files created: ' + excelResult.count)
              for (const fp of (excelResult.excelFiles || [])) {
                s.addLog('[SYSTEM]   >> ' + fp.split(/[/\\]/).pop())
              }
            } catch (e) {
              s.addLog('[WARNING] Excel post-processing failed: ' + e.message)
              s.addLog('[SYSTEM] CSV files are still available in the output directory.')
            }
          }
          s.setRunStatus(data.status)
        }
      }

      es.onerror = () => {
        s.setRunStatus('failed')
        s.addLog('[ERROR] Connection to server lost.')
        es.close()
        eventSourceRef.current = null
      }
    } catch (e) {
      s.addLog('[ERROR] ' + e.message)
      s.setRunStatus('failed')
    }
  }

  const handleStop = async () => {
    try {
      await api.stopRun()
    } catch (e) {
      // If Flask is unreachable, still update local state
      useStore.getState().addLog('[SYSTEM] Could not reach server to stop process.')
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    useStore.getState().setRunStatus('cancelled')
  }

  const handleOpenFolder = () => {
    if (s.outputDir) api.openFolder(s.outputDir).catch(() => {})
  }

  const isRunning = s.runStatus === 'running'
  const isDone = s.runStatus === 'completed'
  const isFailed = s.runStatus === 'failed'

  const regionResult = s.getRegions()
  const totalExcelFiles = s.selectedElementSets.length

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-rose-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Execute Extraction</h2>
          <p className="text-sm text-gray-400">Generate script, configure Abaqus, and run</p>
        </div>
      </div>

      {/* Abaqus Configuration */}
      <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-800 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Abaqus Configuration</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={s.abaqusPath}
            onChange={e => s.setAbaqusPath(e.target.value)}
            placeholder="abaqus"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <button onClick={handleDetectAbaqus} className="px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm shrink-0">
            Auto-detect
          </button>
        </div>
        {s.abaqusVersion && (
          <p className={`text-xs ${s.abaqusDetected ? 'text-green-400' : 'text-yellow-400'}`}>
            {s.abaqusDetected ? '  ' : '  '}{s.abaqusVersion}
          </p>
        )}
        {s.abaqusVersion && !s.abaqusDetected && (
          <div className="mt-3 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30 text-xs text-yellow-200/90 space-y-2">
            <h4 className="font-semibold text-yellow-300">Abaqus not found? Follow these steps:</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-yellow-200/70">
              <li>Open <span className="font-mono bg-yellow-900/40 px-1 rounded">PowerShell</span> on this PC</li>
              <li>Run this command to find the Abaqus path:
                <div className="mt-1 p-2 bg-gray-950 rounded font-mono text-[11px] text-gray-300 select-all">
                  Get-ChildItem -Path C:\ -Filter "abaqus.bat" -Recurse -ErrorAction SilentlyContinue | Select FullName
                </div>
              </li>
              <li>Copy the full path from the result (e.g. <span className="font-mono text-gray-300">C:\SIMULIA\Abaqus\Commands\abaqus.bat</span>)</li>
              <li>Paste it into the Abaqus Configuration field above</li>
              <li>Click <span className="font-semibold text-yellow-300">Auto-detect</span> to verify</li>
            </ol>
            <p className="text-yellow-200/50 mt-1">Common paths: <span className="font-mono">C:\SIMULIA\Abaqus\Commands\abaqus.bat</span>, <span className="font-mono">C:\SIMULIA\Commands\abaqus.bat</span></p>
          </div>
        )}
      </div>

      {/* Execution Mode */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Execution Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { val: 'noGUI', title: 'Abaqus noGUI (Recommended)', desc: 'abaqus cae noGUI=script.py - Fastest batch extraction' },
            { val: 'python', title: 'Abaqus Python', desc: 'abaqus python script.py - Lighter weight, no CAE kernel' },
            { val: 'cae', title: 'Abaqus/CAE GUI', desc: 'Opens CAE - you run the script manually inside it' },
            { val: 'generateOnly', title: 'Generate Script Only', desc: 'Save script file without running - for remote execution' },
          ].map(opt => (
            <label key={opt.val} className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
              ${s.execMode === opt.val ? 'border-blue-500/50 bg-blue-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
              <input type="radio" checked={s.execMode === opt.val} onChange={() => s.setExecMode(opt.val)} className="w-4 h-4 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-200">{opt.title}</div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || !s.odbPath || s.selectedOutputs.length === 0 || s.selectedElementSets.length === 0}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium hover:from-blue-500 hover:to-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {generating ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Generate Script
            </>
          )}
        </button>

        {s.scriptContent && (
          <button
            onClick={() => setShowScript(!showScript)}
            className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            {showScript ? 'Hide Script' : 'Preview Script'}
          </button>
        )}

        {s.execMode !== 'generateOnly' && s.scriptPath && (
          <button
            onClick={isRunning ? handleStop : handleRun}
            disabled={!s.scriptPath || (s.execMode === 'generateOnly')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition
              ${isRunning
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed'}`}
          >
            {isRunning ? (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>Stop</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>Run Extraction</>
            )}
          </button>
        )}

        {s.execMode === 'cae' && s.scriptPath && (
          <button
            onClick={handleRun}
            className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm flex items-center gap-2"
          >
            Open Abaqus/CAE
          </button>
        )}
      </div>

      {/* Script Path Info */}
      {s.scriptPath && (
        <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Script saved to:</span>
            <span className="font-mono text-gray-300">{s.scriptPath}</span>
            <button
              onClick={() => navigator.clipboard.writeText(s.scriptPath)}
              className="ml-auto px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:bg-gray-800"
            >Copy Path</button>
          </div>
          <div className="text-gray-500">
            Will generate {totalExcelFiles} Excel file{totalExcelFiles !== 1 ? 's' : ''} ({regionResult.regions.length} regions x {s.selectedElementSets.length} element sets) + consolidated CSV
          </div>
        </div>
      )}

      {/* CAE Instructions */}
      {s.execMode === 'cae' && s.scriptPath && (
        <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/30 text-sm text-blue-300 space-y-2">
          <h4 className="font-medium">Instructions for Abaqus/CAE:</h4>
          <ol className="list-decimal list-inside space-y-1 text-blue-200/80 text-xs">
            <li>Open Abaqus/CAE (click "Open Abaqus/CAE" above)</li>
            <li>Open your ODB: File &gt; Open &gt; {s.odbPath.split(/[/\\]/).pop()}</li>
            <li>Run the script: File &gt; Run Script &gt; select the generated .py file</li>
            <li>Monitor progress in the Abaqus message area (bottom of the window)</li>
          </ol>
        </div>
      )}

      {/* Script Preview */}
      {showScript && s.scriptContent && (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
            <span className="text-xs text-gray-400 font-mono">extract_region_sweep.py</span>
            <button
              onClick={() => navigator.clipboard.writeText(s.scriptContent)}
              className="px-2 py-1 rounded text-xs border border-gray-700 text-gray-400 hover:bg-gray-800"
            >Copy</button>
          </div>
          <pre className="p-4 bg-gray-950 text-xs font-mono text-gray-300 max-h-96 overflow-auto leading-5 whitespace-pre">
            {s.scriptContent}
          </pre>
        </div>
      )}

      {/* Live Progress Panel */}
      {isRunning && <ProgressPanel logs={s.logs} elapsed={s.elapsed} />}

      {/* Completion */}
      {isDone && (
        <div className="p-4 rounded-lg bg-green-900/20 border border-green-700/30 space-y-3">
          <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            Extraction Complete
          </h3>
          <p className="text-xs text-green-300/70">
            Completed in {s.elapsed.toFixed(1)} seconds. Output directory: {s.outputDir}
          </p>
          <button onClick={handleOpenFolder} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
            Open Output Folder
          </button>
        </div>
      )}

      {/* Failure */}
      {isFailed && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/30">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            Extraction Failed
          </h3>
          <p className="text-xs text-red-300/70 mt-1">Check the console output below for error details.</p>
        </div>
      )}

      {/* Console */}
      <LogConsole logs={s.logs} onClear={s.clearLogs} />
    </div>
  )
}
