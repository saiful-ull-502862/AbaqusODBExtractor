import { useState } from 'react'
import { useStore, ALL_OUTPUTS } from '../store'

function isOutputSelected(selectedOutputs, item) {
  return selectedOutputs.some(o =>
    o.fieldKey === item.fieldKey && o.compOrInv === item.compOrInv && o.label === item.label
  )
}

function OutputGroup({ groupKey, group, selectedOutputs, toggleOutput }) {
  const [open, setOpen] = useState(groupKey === 'stress')
  const selectedCount = group.items.filter(item => isOutputSelected(selectedOutputs, item)).length
  const allSelected = selectedCount === group.items.length

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all in group
      group.items.forEach(item => {
        if (isOutputSelected(selectedOutputs, item)) toggleOutput(item)
      })
    } else {
      // Select all in group
      group.items.forEach(item => {
        if (!isOutputSelected(selectedOutputs, item)) toggleOutput(item)
      })
    }
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 cursor-pointer hover:bg-gray-800/50 transition"
        onClick={() => setOpen(!open)}
      >
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
        <h3 className="text-sm font-medium text-gray-200 flex-1">{group.label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCount > 0 ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
          {selectedCount} selected
        </span>
        <label className="flex items-center" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={allSelected && group.items.length > 0}
            onChange={toggleAll}
            ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allSelected }}
            className="w-4 h-4 rounded"
          />
        </label>
      </div>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 p-2 bg-gray-950/50">
          {group.items.map(item => {
            const sel = isOutputSelected(selectedOutputs, item)
            return (
              <label
                key={item.label}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition text-sm
                  ${sel ? 'bg-blue-600/10 text-blue-300' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'}`}
              >
                <input
                  type="checkbox"
                  checked={sel}
                  onChange={() => toggleOutput(item)}
                  className="w-3.5 h-3.5 rounded"
                />
                <span className="font-mono font-medium text-xs">{item.label.replace('S_', '').replace('LE_', '')}</span>
                <span className="text-xs text-gray-500">{item.desc}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FieldOutputs() {
  const { selectedOutputs, toggleOutput, applyPreset, selectAllOutputs, clearAllOutputs } = useStore()

  return (
    <div className="glass-panel p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Field Outputs</h2>
          <p className="text-sm text-gray-400">Select which field output variables to extract</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={applyPreset}
          className="px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-600 to-violet-600 text-xs text-white font-medium hover:from-blue-500 hover:to-violet-500"
        >
          Standard Cartilage Set
        </button>
        <button onClick={selectAllOutputs} className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">
          Select All
        </button>
        <button onClick={clearAllOutputs} className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-300 hover:bg-gray-800">
          Deselect All
        </button>
        <span className="text-xs text-gray-500 flex items-center ml-2">
          {selectedOutputs.length} variable{selectedOutputs.length !== 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Output Groups */}
      <div className="space-y-2">
        {Object.entries(ALL_OUTPUTS).map(([key, group]) => (
          <OutputGroup
            key={key}
            groupKey={key}
            group={group}
            selectedOutputs={selectedOutputs}
            toggleOutput={toggleOutput}
          />
        ))}
      </div>
    </div>
  )
}
