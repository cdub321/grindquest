export default function CombatLog({ combatLog }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Combat Log</h2>
      <div className="space-y-1 h-40 overflow-y-auto font-mono text-sm">
        {combatLog.map((log) => (
          <div
            key={log.id}
            className={`
              ${log.type === 'damage' ? 'text-orange-400' : ''}
              ${log.type === 'kill' ? 'text-green-400' : ''}
              ${log.type === 'xp' ? 'text-blue-400' : ''}
              ${log.type === 'loot' ? 'text-yellow-400' : ''}
              ${log.type === 'levelup' ? 'text-purple-400 font-bold' : ''}
              ${log.type === 'mobattack' ? 'text-red-400' : ''}
              ${log.type === 'spawn' ? 'text-gray-400' : ''}
              ${log.type === 'system' ? 'text-cyan-400' : ''}
              ${log.type === 'flee' ? 'text-yellow-300' : ''}
              ${log.type === 'error' ? 'text-red-300' : ''}
              ${log.type === 'normal' ? 'text-gray-300' : ''}
            `}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
