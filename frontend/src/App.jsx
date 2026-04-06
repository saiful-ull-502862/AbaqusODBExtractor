import { useStore } from './store'
import Stepper from './components/Stepper'
import FileSetup from './components/FileSetup'
import ElementSets from './components/ElementSets'
import FieldOutputs from './components/FieldOutputs'
import RegionConfig from './components/RegionConfig'
import StepFrames from './components/StepFrames'
import OutputConfig from './components/OutputConfig'
import Execution from './components/Execution'

const PANELS = [FileSetup, ElementSets, FieldOutputs, RegionConfig, StepFrames, OutputConfig, Execution]
const LABELS = ['File Setup', 'Element Sets', 'Field Outputs', 'Region Config', 'Steps & Frames', 'Output', 'Execute']

export default function App() {
  const currentStep = useStore(s => s.currentStep)
  const setStep = useStore(s => s.setStep)
  const Panel = PANELS[currentStep - 1]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="14" height="14" rx="2" opacity="0.7" />
                <rect x="22" y="4" width="14" height="14" rx="2" opacity="0.5" />
                <rect x="4" y="22" width="14" height="14" rx="2" opacity="0.5" />
                <rect x="22" y="22" width="14" height="14" rx="2" opacity="0.3" />
                <circle cx="20" cy="20" r="6" fill="currentColor" opacity="0.8" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Abaqus ODB Extractor</h1>
              <p className="text-xs text-gray-400">Field Output Region Extraction Tool</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        <Stepper labels={LABELS} current={currentStep} onStep={setStep} />

        <div className="mt-6">
          <Panel />
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pb-8">
          <button
            className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={currentStep === 1}
            onClick={() => setStep(currentStep - 1)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Previous
          </button>
          <button
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={currentStep === PANELS.length}
            onClick={() => setStep(currentStep + 1)}
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </main>
    </div>
  )
}
