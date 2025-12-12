export default function ModePanel({
  mode,
  onModeChange,
  boundLevel,
  onBind,
  currentLevel,
  inCombat
}) {
  const buttonBase = "flex-1 text-center font-semibold py-2 px-3 rounded transition-colors";

  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4 space-y-3">
      <h2 className="text-xl font-bold text-blue-300 mb-1">Mode</h2>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onModeChange('normal')}
          className={`${buttonBase} ${mode === 'normal' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-gray-200'}`}
        >
          Normal
        </button>
        <button
          onClick={() => onModeChange('hardcore')}
          className={`${buttonBase} ${mode === 'hardcore' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-gray-200'}`}
        >
          Hardcore
        </button>
      </div>
      <div className="text-sm text-gray-300 space-y-1">
        <p>{mode === 'hardcore' ? 'Death resets you completely and records your run.' : 'Death returns you to your last bound level.'}</p>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Bound Level:</span>
          <span className="text-white font-semibold">{boundLevel}</span>
        </div>
        <button
          onClick={onBind}
          disabled={mode === 'hardcore' || inCombat}
          className={`w-full ${mode === 'hardcore' || inCombat ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'} font-semibold py-2 px-3 rounded transition-colors`}
          title={mode === 'hardcore' ? 'Binding is disabled in hardcore mode' : inCombat ? 'Cannot bind during combat' : 'Set your bind point to your current level'}
        >
          Bind at Level {currentLevel}
        </button>
      </div>
    </div>
  );
}
