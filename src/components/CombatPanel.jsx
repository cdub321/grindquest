export default function CombatPanel({
  currentMob,
  mobHp,
  attackMob,
  toggleAutoAttack,
  isAutoAttack,
  fleeCombat,
  toggleMeditate,
  playerClass,
  inCombat,
  isMeditating
}) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Combat</h2>

      {currentMob && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className={`text-lg font-semibold ${currentMob.isNamed ? 'text-yellow-400' : 'text-white'}`}>
              {currentMob.name}
            </span>
            {currentMob.isNamed && (
              <span className="text-xs bg-yellow-600 px-2 py-1 rounded">NAMED</span>
            )}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-400">HP</span>
              <span className="text-white">{mobHp} / {currentMob.hp}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-red-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${(mobHp / currentMob.hp) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={attackMob}
          disabled={!currentMob || mobHp === 0}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition-colors"
        >
          Attack
        </button>
        <button
          onClick={toggleAutoAttack}
          className={`${isAutoAttack ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 px-4 rounded transition-colors`}
        >
          {isAutoAttack ? 'Auto: ON' : 'Auto: OFF'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={fleeCombat}
          disabled={!currentMob}
          className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors text-sm"
        >
          Flee
        </button>
        <button
          onClick={toggleMeditate}
          disabled={inCombat}
          className={`${isMeditating ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors text-sm`}
        >
          {isMeditating ? 'Stand' : 'Sit'}
        </button>
      </div>
    </div>
  );
}
