import { useStore } from '../store'

const ELSET_COLORS = {
  ECM: 'blue', CELL: 'green', PCM: 'orange',
  FIBER: 'red', FIBER_DZ: 'red', FIBER_MZ_D: 'red', FIBER_MZ_H: 'red', FIBER_MZ_V: 'red',
  FIBER_PCM: 'rose', FIBER_PCM_DZ: 'rose', FIBER_PCM_MZ: 'rose', FIBER_PCM_SZ: 'rose', FIBER_SZ: 'red',
}

const COLOR_CLASSES = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Default element sets if no scan result
const DEFAULT_SETS = [
  'ECM', 'CELL', 'PCM', 'FIBER', 'FIBER_DZ',
  'FIBER_MZ_D', 'FIBER_MZ_H', 'FIBER_MZ_V',
  'FIBER_PCM', 'FIBER_PCM_DZ', 'FIBER_PCM_MZ', 'FIBER_PCM_SZ',
]

function getShortName(fullName) {
  return fullName.includes('.') ? fullName.split('.').pop() : fullName
}

export default function ElementSets() {
  const { selectedElementSets, toggleElementSet, setSelectedElementSets, scanResult, instanceName } = useStore()

  // Determine available sets
  let availableSets = DEFAULT_SETS.map(name => ({
    name,
    fullName: `${instanceName}.${name}`,
    elementCount: null,
  }))

  if (scanResult?.elementSets) {
    availableSets = scanResult.elementSets.map(s => ({
      name: getShortName(s.name),
      fullName: s.name,
      elementCount: s.elementCount,
    }))
  }

  const selectAll = () => setSelectedElementSets(availableSets.map(s => s.name))
  const deselectAll = () => setSelectedElementSets([])

  return (
    <div className="glass-panel p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Element Sets</h2>
          <p className="text-sm text-gray-400">Select element sets to extract data from</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={selectAll} className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">Select All</button>
        <button onClick={deselectAll} className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">Deselect All</button>
      </div>

      <div className="grid gap-2">
        {availableSets.map(set => {
          const isSelected = selectedElementSets.includes(set.name)
          const color = ELSET_COLORS[set.name] || 'gray'
          const colorCls = COLOR_CLASSES[color]

          return (
            <label
              key={set.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all
                ${isSelected
                  ? `${colorCls} border-opacity-60`
                  : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleElementSet(set.name)}
                className="w-4 h-4 rounded"
              />
              <span className="font-mono text-sm flex-1">{set.fullName}</span>
              {set.elementCount !== null && (
                <span className="text-xs text-gray-500">{set.elementCount.toLocaleString()} elements</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${colorCls}`}>
                {set.name.replace(/_/g, ' ')}
              </span>
            </label>
          )
        })}
      </div>

      <p className="text-xs text-gray-500">
        {selectedElementSets.length} of {availableSets.length} sets selected.
        Each selected set produces a separate CSV per region.
      </p>
    </div>
  )
}
