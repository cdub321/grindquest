export default function StatsPanel({ playerClass, level, inCombat, isMeditating, inventoryLength }) {
  const baseDamage = Math.floor(playerClass.baseDamage * (1 + level * 0.1));

  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Stats</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Damage:</span>
          <span className="text-white">{baseDamage}-{baseDamage + 5}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Attack Speed:</span>
          <span className="text-white">{playerClass.attackSpeed}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">HP Regen:</span>
          <span className="text-white">{inCombat ? '1' : '3'} / 2s</span>
        </div>
        {playerClass.isCaster && (
          <div className="flex justify-between">
            <span className="text-gray-400">Mana Regen:</span>
            <span className="text-white">{isMeditating ? '15' : inCombat ? '1' : '5'} / 2s</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Items Found:</span>
          <span className="text-white">{inventoryLength}</span>
        </div>
      </div>
    </div>
  );
}
