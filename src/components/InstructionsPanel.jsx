export default function InstructionsPanel({ isCaster }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">How to Play</h2>
      <div className="space-y-2 text-sm text-gray-300">
        <p>🗡️ Click <strong>Attack</strong> to fight mobs manually</p>
        <p>⚙️ Enable <strong>Auto-Attack</strong> to fight automatically</p>
        <p>🏃 Click <strong>Flee</strong> to run from dangerous mobs</p>
        <p className="text-yellow-300">⚠️ Fleeing after you engage can fail and slows regen briefly</p>
        <p>🧥 Equip loot to gain bonuses and boost your power</p>
        {isCaster && <p>🧘 <strong>Meditate</strong> for faster mana regen</p>}
        <p>📈 Gain XP to level up and deal more damage</p>
        <p>💰 Collect loot and gold from defeated enemies</p>
        <p>⭐ Named mobs (yellow) have better loot!</p>
        <p>❤️ HP regenerates faster out of combat</p>
      </div>
    </div>
  );
}
