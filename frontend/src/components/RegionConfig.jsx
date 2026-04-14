import { useRef, useEffect } from 'react'
import { useStore, computeRegions2D } from '../store'

function NumberInput({ label, value, onChange, unit, hint, min = 0, step = 1, disabled }) {
  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="flex items-center gap-0">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step}
          disabled={disabled}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-l-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-24"
        />
        <span className="px-3 py-2 bg-gray-800 border border-l-0 border-gray-700 rounded-r-lg text-xs text-gray-400">{unit}</span>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function RegionCanvas({ regions, modelW, modelH, is2D }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const pad = { top: 20, right: 20, bottom: 40, left: 50 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    const scaleX = plotW / modelW
    const scaleY = plotH / modelH

    // Model rectangle
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)'
    ctx.fillRect(pad.left, pad.top, plotW, plotH)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(pad.left, pad.top, plotW, plotH)

    // Regions
    const colors = [
      'rgba(59, 130, 246, 0.35)', 'rgba(139, 92, 246, 0.35)',
      'rgba(236, 72, 153, 0.35)', 'rgba(34, 197, 94, 0.35)',
    ]
    const borders = ['#3b82f6', '#8b5cf6', '#ec4899', '#22c55e']

    regions.forEach((r, i) => {
      const rx = pad.left + r.xMin * scaleX
      const ry = pad.top + (modelH - r.yMax) * scaleY
      const rw = (r.xMax - r.xMin) * scaleX
      const rh = (r.yMax - r.yMin) * scaleY

      const ci = is2D ? (r.yi * 7 + r.xi) % colors.length : i % colors.length
      ctx.fillStyle = colors[ci]
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = borders[ci]
      ctx.lineWidth = 1
      ctx.strokeRect(rx, ry, rw, rh)

      if (rw > 14 && rh > 10 && regions.length <= 100) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '600 7px Inter, sans-serif'
        ctx.textAlign = 'center'
        if (is2D) {
          ctx.fillText(`${r.xi},${r.yi}`, rx + rw / 2, ry + rh / 2 + 3)
        } else {
          ctx.fillText(`R${i + 1}`, rx + rw / 2, ry + rh / 2 + 3)
        }
      }
    })

    // Axes
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`X: 0 → ${modelW} mm`, pad.left + plotW / 2, h - 8)

    ctx.save()
    ctx.translate(12, pad.top + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(`Y: 0 → ${modelH} mm`, 0, 0)
    ctx.restore()

    // Origin marker
    ctx.fillStyle = '#8b5cf6'
    ctx.beginPath()
    ctx.arc(pad.left, pad.top + plotH, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 9px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('(0,0)', pad.left + 6, pad.top + plotH - 4)
  }, [regions, modelW, modelH, is2D])

  return (
    <div className="canvas-container p-2">
      <canvas ref={canvasRef} className="w-full" style={{ height: 300 }} />
    </div>
  )
}

export default function RegionConfig() {
  const s = useStore()
  const result = s.getRegions()
  const { regions, xLabels, yLabels, is2D } = result

  return (
    <div className="glass-panel p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="1" y="5" width="22" height="14" rx="2" /><path d="M1 10h22" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Region Configuration</h2>
          <p className="text-sm text-gray-400">Define sweep paths, region size, and offsets</p>
        </div>
      </div>

      {/* Model Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <NumberInput label="Model Width (X)" value={s.modelWidth} onChange={s.setModelWidth} unit="mm" step={0.01} />
        <NumberInput label="Model Height (Y)" value={s.modelHeight} onChange={s.setModelHeight} unit="mm" step={0.01} />
      </div>

      {/* Region Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <NumberInput label="Region Width" value={s.regionWidth} onChange={s.setRegionWidth} unit="um" />
        <NumberInput label="Region Height" value={s.regionHeight} onChange={s.setRegionHeight} unit="um" />
      </div>

      {/* Sweep Axis Toggles */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Sweep Axes</label>
        <div className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
            ${s.sweepX ? 'border-blue-500/50 bg-blue-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
            <input
              type="checkbox"
              checked={s.sweepX}
              onChange={e => s.setSweepX(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-200">Along X-axis</div>
              <div className="text-xs text-gray-500">Regions sweep left to right</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition
            ${s.sweepY ? 'border-purple-500/50 bg-purple-600/10' : 'border-gray-800 hover:border-gray-700'}`}>
            <input
              type="checkbox"
              checked={s.sweepY}
              onChange={e => s.setSweepY(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-200">Along Y-axis</div>
              <div className="text-xs text-gray-500">Regions sweep bottom to top</div>
            </div>
          </label>
        </div>
        {s.sweepX && s.sweepY && (
          <p className="text-xs text-purple-400 mt-2">2D grid mode: regions at every X,Y combination</p>
        )}
        {!s.sweepX && !s.sweepY && (
          <p className="text-xs text-yellow-400 mt-2">Enable at least one sweep axis</p>
        )}
      </div>

      {/* X Sweep Parameters */}
      {s.sweepX && (
        <div className="border border-blue-900/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-blue-300">X-axis Sweep</h3>
          <div className="grid grid-cols-3 gap-4">
            <NumberInput label="X Start" value={s.xStart} onChange={s.setXStart} unit="um" />
            <NumberInput label="X End" value={s.xEnd} onChange={s.setXEnd} unit="um" />
            <NumberInput label="X Offset" value={s.xOffset} onChange={s.setXOffset} unit="um" hint="Step between regions" />
          </div>
          {!s.sweepY && (
            <NumberInput label="Edge from Top" value={s.edgeFromTop} onChange={s.setEdgeFromTop} unit="um" hint="Y position fixed from model top" />
          )}
        </div>
      )}

      {/* Y Sweep Parameters */}
      {s.sweepY && (
        <div className="border border-purple-900/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-purple-300">Y-axis Sweep</h3>
          <div className="grid grid-cols-3 gap-4">
            <NumberInput label="Y Start" value={s.yStart} onChange={s.setYStart} unit="um" />
            <NumberInput label="Y End" value={s.yEnd} onChange={s.setYEnd} unit="um" />
            <NumberInput label="Y Offset" value={s.yOffset} onChange={s.setYOffset} unit="um" hint="Step between regions" />
          </div>
          {!s.sweepX && (
            <NumberInput label="Edge from Left" value={s.edgeFromLeft} onChange={s.setEdgeFromLeft} unit="um" hint="X position fixed from model left" />
          )}
        </div>
      )}

      {/* Canvas Preview */}
      <RegionCanvas regions={regions} modelW={s.modelWidth} modelH={s.modelHeight} is2D={is2D} />

      {/* Region Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{regions.length}</div>
          <div className="text-xs text-gray-400">Total Regions</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{s.regionWidth} x {s.regionHeight}</div>
          <div className="text-xs text-gray-400">Region Size (um)</div>
        </div>
        {s.sweepX && (
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-300">{xLabels.length}</div>
            <div className="text-xs text-gray-400">X Positions</div>
          </div>
        )}
        {s.sweepY && (
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-purple-300">{yLabels.length}</div>
            <div className="text-xs text-gray-400">Y Positions</div>
          </div>
        )}
      </div>

      {/* Label Preview */}
      {(xLabels.length > 0 || yLabels.length > 0) && (
        <div className="space-y-2">
          {xLabels.length > 0 && (
            <div>
              <span className="text-xs font-medium text-blue-400">X columns: </span>
              <span className="text-xs text-gray-400 font-mono">{xLabels.slice(0, 15).join(', ')}{xLabels.length > 15 ? ` ...+${xLabels.length - 15}` : ''}</span>
            </div>
          )}
          {yLabels.length > 0 && (
            <div>
              <span className="text-xs font-medium text-purple-400">Y rows: </span>
              <span className="text-xs text-gray-400 font-mono">{yLabels.slice(0, 15).join(', ')}{yLabels.length > 15 ? ` ...+${yLabels.length - 15}` : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Region Table */}
      {regions.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-400">
                <th className="text-left py-1.5 px-2">#</th>
                {is2D && <th className="text-left py-1.5 px-2">Xi</th>}
                {is2D && <th className="text-left py-1.5 px-2">Yi</th>}
                <th className="text-left py-1.5 px-2">X Min</th>
                <th className="text-left py-1.5 px-2">X Max</th>
                <th className="text-left py-1.5 px-2">Y Min</th>
                <th className="text-left py-1.5 px-2">Y Max</th>
              </tr>
            </thead>
            <tbody className="font-mono text-gray-300">
              {regions.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t border-gray-800/50">
                  <td className="py-1 px-2 text-gray-500">{i + 1}</td>
                  {is2D && <td className="py-1 px-2 text-blue-400">{r.xi}</td>}
                  {is2D && <td className="py-1 px-2 text-purple-400">{r.yi}</td>}
                  <td className="py-1 px-2">{r.xMin.toFixed(4)}</td>
                  <td className="py-1 px-2">{r.xMax.toFixed(4)}</td>
                  <td className="py-1 px-2">{r.yMin.toFixed(4)}</td>
                  <td className="py-1 px-2">{r.yMax.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {regions.length > 50 && (
            <p className="text-xs text-gray-500 text-center py-2">...and {regions.length - 50} more regions</p>
          )}
        </div>
      )}
    </div>
  )
}
