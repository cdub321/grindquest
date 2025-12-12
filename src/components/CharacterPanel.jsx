export default function CharacterPanel({
  playerClass,
  level,
  hp,
  maxHp,
  mana,
  maxMana,
  xp,
  xpNeeded,
  inCombat,
  isMeditating,
  currency
}) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Character</h2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Class:</span>
          <span className="text-white font-semibold">{playerClass.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Level:</span>
          <span className="text-white font-semibold">{level}</span>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-red-400">HP {inCombat && '⚔️'}</span>
            <span className="text-white">{hp} / {maxHp}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-red-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${(hp / maxHp) * 100}%` }}
            />
          </div>
        </div>

        {playerClass.isCaster && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-400">Mana {isMeditating && '🧘'}</span>
              <span className="text-white">{mana} / {maxMana}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${(mana / maxMana) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-blue-400">XP</span>
            <span className="text-white">{xp} / {xpNeeded}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${(xp / xpNeeded) * 100}%` }}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Platinum:</span>
            <span className="text-gray-200 font-semibold">{currency.platinum}pp</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-400">Gold:</span>
            <span className="text-yellow-300 font-semibold">{currency.gold}gp</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300">Silver:</span>
            <span className="text-gray-100 font-semibold">{currency.silver}sp</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-400">Copper:</span>
            <span className="text-orange-300 font-semibold">{currency.copper}cp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
