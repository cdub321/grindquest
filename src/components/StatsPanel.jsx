export default function StatsPanel({
  playerClass,
  level,
  inCombat,
  isMeditating,
  hpRegenRate,
  manaRegenRate,
  fleeExhausted,
  damageRange,
  gearBonuses,
  inventoryLength,
  attackDelay,
  derivedStats
}) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Stats</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Damage:</span>
          <span className="text-white">
            {damageRange.min}-{damageRange.max}
            {gearBonuses.damage ? ` (+${gearBonuses.damage} gear)` : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Attack Speed:</span>
          <span className="text-white">{attackDelay}ms {gearBonuses.haste ? `(haste ${gearBonuses.haste}%)` : ''}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">HP Regen:</span>
          <span className="text-white">
            {hpRegenRate} / 2s {fleeExhausted ? '(exhausted)' : ''}
          </span>
        </div>
        {playerClass.isCaster && (
          <div className="flex justify-between">
          <span className="text-gray-400">Mana Regen:</span>
          <span className="text-white">
              {manaRegenRate} / 2s {fleeExhausted ? '(exhausted)' : ''}
          </span>
        </div>
      )}
        <div className="flex justify-between">
          <span className="text-gray-400">Gear Bonuses:</span>
          <span className="text-white">
            {gearBonuses.damage ? `+${gearBonuses.damage} dmg ` : ''}
            {gearBonuses.hp ? `+${gearBonuses.hp} HP ` : ''}
            {gearBonuses.mana ? `+${gearBonuses.mana} Mana ` : ''}
            {gearBonuses.ac ? `+${gearBonuses.ac} AC ` : ''}
            {gearBonuses.str ? `+${gearBonuses.str} STR ` : ''}
            {gearBonuses.sta ? `+${gearBonuses.sta} STA ` : ''}
            {gearBonuses.dex ? `+${gearBonuses.dex} DEX ` : ''}
            {gearBonuses.agi ? `+${gearBonuses.agi} AGI ` : ''}
            {gearBonuses.int ? `+${gearBonuses.int} INT ` : ''}
            {gearBonuses.wis ? `+${gearBonuses.wis} WIS ` : ''}
            {gearBonuses.cha ? `+${gearBonuses.cha} CHA ` : ''}
            {!gearBonuses.hp && !gearBonuses.mana && !gearBonuses.damage ? 'None' : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Resists:</span>
          <span className="text-white">
            MR {gearBonuses.mr || 0} / FR {gearBonuses.fr || 0} / CR {gearBonuses.cr || 0} / PR {gearBonuses.pr || 0} / DR {gearBonuses.dr || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">AC:</span>
          <span className="text-white">{gearBonuses.ac || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Carry Cap:</span>
          <span className="text-white">{derivedStats?.carryCap || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Spell/Heal Mods:</span>
          <span className="text-white">Spell +{derivedStats?.spellDmgMod || 0}% | Heal +{derivedStats?.healMod || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Items Found:</span>
          <span className="text-white">{inventoryLength}</span>
        </div>
      </div>
    </div>
  );
}
