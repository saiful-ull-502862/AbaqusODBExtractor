export default function Stepper({ labels, current, onStep }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {labels.map((label, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => onStep(step)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap
                ${isActive ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/40' :
                  isDone ? 'text-green-400 hover:bg-gray-800' :
                  'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
            >
              <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0
                ${isActive ? 'bg-blue-600 text-white' :
                  isDone ? 'bg-green-600/30 text-green-400' :
                  'bg-gray-800 text-gray-500'}`}>
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                ) : step}
              </span>
              <span className="hidden lg:inline">{label}</span>
            </button>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-green-600/40' : 'bg-gray-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
