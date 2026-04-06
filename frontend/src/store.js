import { create } from 'zustand'

// Standard cartilage preset outputs
const CARTILAGE_PRESET = [
  { fieldKey: 'S', compOrInv: 'S22', label: 'S22' },
  { fieldKey: 'S', compOrInv: 'S11', label: 'S11' },
  { fieldKey: 'S', compOrInv: 'S12', label: 'S12' },
  { fieldKey: 'S', compOrInv: 'Mises', label: 'S_Mises' },
  { fieldKey: 'S', compOrInv: 'Max. In-Plane Principal', label: 'S_MaxInPlanePrinc' },
  { fieldKey: 'S', compOrInv: 'Min. In-Plane Principal', label: 'S_MinInPlanePrinc' },
  { fieldKey: 'LE', compOrInv: 'LE22', label: 'LE22' },
  { fieldKey: 'LE', compOrInv: 'LE11', label: 'LE11' },
  { fieldKey: 'LE', compOrInv: 'LE12', label: 'LE12' },
  { fieldKey: 'POR', compOrInv: null, label: 'POR' },
  { fieldKey: 'FLVEL', compOrInv: 'FLVEL1', label: 'FLVEL1' },
  { fieldKey: 'FLVEL', compOrInv: 'FLVEL2', label: 'FLVEL2' },
  { fieldKey: 'FLVEL', compOrInv: 'Magnitude', label: 'FLVEL_Mag' },
]

// All predefined outputs with metadata
export const ALL_OUTPUTS = {
  stress: {
    label: 'Stress (S)',
    items: [
      { fieldKey: 'S', compOrInv: 'S11', label: 'S11', desc: 'Normal stress, X' },
      { fieldKey: 'S', compOrInv: 'S22', label: 'S22', desc: 'Normal stress, Y' },
      { fieldKey: 'S', compOrInv: 'S33', label: 'S33', desc: 'Normal stress, Z' },
      { fieldKey: 'S', compOrInv: 'S12', label: 'S12', desc: 'Shear stress, XY' },
      { fieldKey: 'S', compOrInv: 'S13', label: 'S13', desc: 'Shear stress, XZ' },
      { fieldKey: 'S', compOrInv: 'S23', label: 'S23', desc: 'Shear stress, YZ' },
      { fieldKey: 'S', compOrInv: 'Mises', label: 'S_Mises', desc: 'Von Mises equivalent' },
      { fieldKey: 'S', compOrInv: 'Tresca', label: 'S_Tresca', desc: 'Max shear stress' },
      { fieldKey: 'S', compOrInv: 'Press', label: 'S_Pressure', desc: 'Hydrostatic pressure' },
      { fieldKey: 'S', compOrInv: 'Max. Principal', label: 'S_MaxPrincipal', desc: 'Max principal' },
      { fieldKey: 'S', compOrInv: 'Mid. Principal', label: 'S_MidPrincipal', desc: 'Mid principal' },
      { fieldKey: 'S', compOrInv: 'Min. Principal', label: 'S_MinPrincipal', desc: 'Min principal' },
      { fieldKey: 'S', compOrInv: 'Max. In-Plane Principal', label: 'S_MaxInPlanePrinc', desc: 'Max in-plane principal' },
      { fieldKey: 'S', compOrInv: 'Min. In-Plane Principal', label: 'S_MinInPlanePrinc', desc: 'Min in-plane principal' },
    ],
  },
  strain: {
    label: 'Logarithmic Strain (LE)',
    items: [
      { fieldKey: 'LE', compOrInv: 'LE11', label: 'LE11', desc: 'Log strain, X' },
      { fieldKey: 'LE', compOrInv: 'LE22', label: 'LE22', desc: 'Log strain, Y' },
      { fieldKey: 'LE', compOrInv: 'LE33', label: 'LE33', desc: 'Log strain, Z' },
      { fieldKey: 'LE', compOrInv: 'LE12', label: 'LE12', desc: 'Shear strain, XY' },
      { fieldKey: 'LE', compOrInv: 'Mises', label: 'LE_Mises', desc: 'Von Mises equivalent' },
      { fieldKey: 'LE', compOrInv: 'Max. Principal', label: 'LE_MaxPrincipal', desc: 'Max principal' },
      { fieldKey: 'LE', compOrInv: 'Min. Principal', label: 'LE_MinPrincipal', desc: 'Min principal' },
      { fieldKey: 'LE', compOrInv: 'Max. In-Plane Principal', label: 'LE_MaxInPlanePrinc', desc: 'Max in-plane principal' },
      { fieldKey: 'LE', compOrInv: 'Min. In-Plane Principal', label: 'LE_MinInPlanePrinc', desc: 'Min in-plane principal' },
    ],
  },
  pore: {
    label: 'Pore Pressure',
    items: [
      { fieldKey: 'POR', compOrInv: null, label: 'POR', desc: 'Pore pressure (nodal)' },
    ],
  },
  fluid: {
    label: 'Fluid Velocity (FLVEL)',
    items: [
      { fieldKey: 'FLVEL', compOrInv: 'FLVEL1', label: 'FLVEL1', desc: 'Fluid velocity, X' },
      { fieldKey: 'FLVEL', compOrInv: 'FLVEL2', label: 'FLVEL2', desc: 'Fluid velocity, Y' },
      { fieldKey: 'FLVEL', compOrInv: 'FLVEL3', label: 'FLVEL3', desc: 'Fluid velocity, Z' },
      { fieldKey: 'FLVEL', compOrInv: 'Magnitude', label: 'FLVEL_Mag', desc: 'Fluid velocity, Resultant (magnitude)' },
    ],
  },
  other: {
    label: 'Other Outputs',
    items: [
      { fieldKey: 'VOIDR', compOrInv: null, label: 'VOIDR', desc: 'Void ratio' },
    ],
  },
}

/**
 * Compute regions for sweep configuration.
 * Supports single-axis (X or Y) or dual-axis (both X and Y) sweeps.
 * For dual sweep, creates a 2D grid of regions.
 * Each region has: xMin, xMax, yMin, yMax, xi (x-index), yi (y-index), xCenter, yCenter
 */
export function computeRegions2D(cfg) {
  const {
    modelW, modelH, regionW, regionH,
    sweepX = false, xStart = 0, xEnd = 0, xOffset = 0,
    sweepY = false, yStart = 0, yEnd = 0, yOffset = 0,
    edgeFromTop = 0, edgeFromLeft = 0,
  } = cfg

  // Compute X positions
  const xPositions = []
  if (sweepX && xOffset > 0) {
    for (let x = xStart; x + regionW <= xEnd + 0.0001; x += xOffset) {
      xPositions.push(x)
    }
  }

  // Compute Y positions
  const yPositions = []
  if (sweepY && yOffset > 0) {
    for (let y = yStart; y + regionH <= yEnd + 0.0001; y += yOffset) {
      yPositions.push(y)
    }
  }

  // If only X sweep, fix Y from top/bottom edge
  if (sweepX && !sweepY) {
    const yMin = modelH - edgeFromTop - regionH
    const yMax = modelH - edgeFromTop
    return {
      regions: xPositions.map((x, xi) => ({
        xMin: x, xMax: x + regionW,
        yMin, yMax,
        xi, yi: 0,
        xCenter: x + regionW / 2,
        yCenter: (yMin + yMax) / 2,
      })),
      xLabels: xPositions.map(x => +(x + regionW).toFixed(4)),
      yLabels: [+(modelH - edgeFromTop).toFixed(4)],
      is2D: false,
    }
  }

  // If only Y sweep, fix X from left/right edge
  if (sweepY && !sweepX) {
    const xMin = edgeFromLeft
    const xMax = edgeFromLeft + regionW
    return {
      regions: yPositions.map((y, yi) => ({
        xMin, xMax,
        yMin: y, yMax: y + regionH,
        xi: 0, yi,
        xCenter: (xMin + xMax) / 2,
        yCenter: y + regionH / 2,
      })),
      xLabels: [+(edgeFromLeft + regionW).toFixed(4)],
      yLabels: yPositions.map(y => +(y + regionH).toFixed(4)),
      is2D: false,
    }
  }

  // Dual sweep: 2D grid
  if (sweepX && sweepY) {
    const regions = []
    for (let yi = 0; yi < yPositions.length; yi++) {
      for (let xi = 0; xi < xPositions.length; xi++) {
        const x = xPositions[xi]
        const y = yPositions[yi]
        regions.push({
          xMin: x, xMax: x + regionW,
          yMin: y, yMax: y + regionH,
          xi, yi,
          xCenter: x + regionW / 2,
          yCenter: y + regionH / 2,
        })
      }
    }
    return {
      regions,
      xLabels: xPositions.map(x => +(x + regionW).toFixed(4)),
      yLabels: yPositions.map(y => +(y + regionH).toFixed(4)),
      is2D: true,
    }
  }

  return { regions: [], xLabels: [], yLabels: [], is2D: false }
}

// Legacy single-axis wrapper (kept for compatibility)
export function computeRegions(modelW, modelH, regionW, regionH, offset, sweepStart, sweepEnd, sweepDir, startEdge, edgeDistance = 0) {
  const cfg = {
    modelW, modelH, regionW, regionH,
    sweepX: sweepDir === 'X',
    sweepY: sweepDir === 'Y',
    xStart: sweepDir === 'X' ? sweepStart : 0,
    xEnd: sweepDir === 'X' ? sweepEnd : modelW,
    xOffset: sweepDir === 'X' ? offset : regionW,
    yStart: sweepDir === 'Y' ? sweepStart : 0,
    yEnd: sweepDir === 'Y' ? sweepEnd : modelH,
    yOffset: sweepDir === 'Y' ? offset : regionH,
    edgeFromTop: (sweepDir === 'X' && startEdge === 'top') ? edgeDistance : (modelH - regionH),
    edgeFromLeft: (sweepDir === 'Y' && startEdge === 'left') ? edgeDistance : 0,
  }
  return computeRegions2D(cfg).regions
}

export const useStore = create((set, get) => ({
  // Navigation
  currentStep: 1,
  setStep: (step) => set({ currentStep: step }),

  // Panel 1: File Setup
  odbPath: '',
  outputDir: '',
  instanceName: 'CARTILAGESAMPLE-1',
  scanning: false,
  scanError: '',

  // Scan results
  scanResult: null, // { instances, elementSets, steps, fieldOutputs, boundingBox }

  setOdbPath: (p) => set({ odbPath: p }),
  setOutputDir: (p) => set({ outputDir: p }),
  setInstanceName: (n) => set({ instanceName: n }),
  setScanning: (v) => set({ scanning: v }),
  setScanError: (e) => set({ scanError: e }),
  setScanResult: (r) => set({ scanResult: r }),

  // Panel 2: Element Sets
  selectedElementSets: ['ECM'],
  toggleElementSet: (name) => set(s => {
    const sel = new Set(s.selectedElementSets)
    if (sel.has(name)) sel.delete(name); else sel.add(name)
    return { selectedElementSets: [...sel] }
  }),
  setSelectedElementSets: (sets) => set({ selectedElementSets: sets }),

  // Panel 3: Field Outputs
  selectedOutputs: [], // Array of { fieldKey, compOrInv, label }
  toggleOutput: (output) => set(s => {
    const key = `${output.fieldKey}|${output.compOrInv}|${output.label}`
    const exists = s.selectedOutputs.find(o =>
      `${o.fieldKey}|${o.compOrInv}|${o.label}` === key
    )
    if (exists) {
      return { selectedOutputs: s.selectedOutputs.filter(o =>
        `${o.fieldKey}|${o.compOrInv}|${o.label}` !== key
      )}
    }
    return { selectedOutputs: [...s.selectedOutputs, output] }
  }),
  setSelectedOutputs: (outputs) => set({ selectedOutputs: outputs }),
  applyPreset: () => set({ selectedOutputs: [...CARTILAGE_PRESET] }),
  selectAllOutputs: () => {
    const all = Object.values(ALL_OUTPUTS).flatMap(g =>
      g.items.map(({ fieldKey, compOrInv, label }) => ({ fieldKey, compOrInv, label }))
    )
    set({ selectedOutputs: all })
  },
  clearAllOutputs: () => set({ selectedOutputs: [] }),

  // Panel 4: Region Config
  modelWidth: 1.44,
  modelHeight: 1.22,
  regionWidth: 40,   // um
  regionHeight: 20,   // um

  // Dual sweep toggles
  sweepX: true,
  sweepY: false,

  // X sweep parameters (um)
  xStart: 0,
  xEnd: 1440,
  xOffset: 40,

  // Y sweep parameters (um)
  yStart: 0,
  yEnd: 1220,
  yOffset: 20,

  // Edge offsets (um) – used when one axis is not swept
  edgeFromTop: 0,
  edgeFromLeft: 0,

  customRegions: [],

  setModelWidth: (v) => set({ modelWidth: v }),
  setModelHeight: (v) => set({ modelHeight: v }),
  setRegionWidth: (v) => set({ regionWidth: v }),
  setRegionHeight: (v) => set({ regionHeight: v }),
  setSweepX: (v) => set({ sweepX: v }),
  setSweepY: (v) => set({ sweepY: v }),
  setXStart: (v) => set({ xStart: v }),
  setXEnd: (v) => set({ xEnd: v }),
  setXOffset: (v) => set({ xOffset: v }),
  setYStart: (v) => set({ yStart: v }),
  setYEnd: (v) => set({ yEnd: v }),
  setYOffset: (v) => set({ yOffset: v }),
  setEdgeFromTop: (v) => set({ edgeFromTop: v }),
  setEdgeFromLeft: (v) => set({ edgeFromLeft: v }),
  addCustomRegion: (r) => set(s => ({ customRegions: [...s.customRegions, r] })),
  removeCustomRegion: (i) => set(s => ({
    customRegions: s.customRegions.filter((_, idx) => idx !== i)
  })),

  getRegions: () => {
    const s = get()
    const result = computeRegions2D({
      modelW: s.modelWidth,
      modelH: s.modelHeight,
      regionW: s.regionWidth / 1000,
      regionH: s.regionHeight / 1000,
      sweepX: s.sweepX,
      xStart: s.xStart / 1000,
      xEnd: s.xEnd / 1000,
      xOffset: s.xOffset / 1000,
      sweepY: s.sweepY,
      yStart: s.yStart / 1000,
      yEnd: s.yEnd / 1000,
      yOffset: s.yOffset / 1000,
      edgeFromTop: s.edgeFromTop / 1000,
      edgeFromLeft: s.edgeFromLeft / 1000,
    })
    return {
      ...result,
      regions: [...result.regions, ...s.customRegions],
    }
  },

  // Panel 5: Steps & Frames
  simulationMode: 'multi', // 'multi' or 'single'
  stepsMode: 'ALL',
  selectedSteps: [],
  frameSelection: 'LAST',
  customFrames: '',

  // Single step simulation
  loadingStep: '',
  relaxationStep: '',

  setSimulationMode: (v) => set({ simulationMode: v }),
  setStepsMode: (v) => set({ stepsMode: v }),
  setSelectedSteps: (v) => set({ selectedSteps: v }),
  toggleStep: (name) => set(s => {
    const sel = new Set(s.selectedSteps)
    if (sel.has(name)) sel.delete(name); else sel.add(name)
    return { selectedSteps: [...sel] }
  }),
  setFrameSelection: (v) => set({ frameSelection: v }),
  setCustomFrames: (v) => set({ customFrames: v }),
  setLoadingStep: (v) => set({ loadingStep: v }),
  setRelaxationStep: (v) => set({ relaxationStep: v }),

  // Panel 7: Execution
  abaqusPath: 'abaqus',
  abaqusVersion: '',
  abaqusDetected: false,
  execMode: 'noGUI', // noGUI, python, cae, generateOnly
  scriptPath: '',
  scriptContent: '',
  runStatus: 'idle', // idle, running, completed, failed, cancelled
  logs: [],
  elapsed: 0,

  setAbaqusPath: (v) => set({ abaqusPath: v }),
  setAbaqusVersion: (v) => set({ abaqusVersion: v }),
  setAbaqusDetected: (v) => set({ abaqusDetected: v }),
  setExecMode: (v) => set({ execMode: v }),
  setScriptPath: (v) => set({ scriptPath: v }),
  setScriptContent: (v) => set({ scriptContent: v }),
  setRunStatus: (v) => set({ runStatus: v }),
  addLog: (msg) => set(s => ({ logs: [...s.logs, msg] })),
  clearLogs: () => set({ logs: [] }),
  setElapsed: (v) => set({ elapsed: v }),
}))
