export default function CharacterSelectPanel({
  characters,
  onSelect,
  onCreateClick,
  onDelete,
  classNameMap = {},
  raceMap = {},
  deityMap = {}
}) {
  return (
    <div className="max-w-4xl mx-auto bg-slate-800 border-2 border-blue-900 rounded-lg p-6 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-blue-300">Select Your Character</h2>
        <button
          onClick={onCreateClick}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
          disabled={characters.length >= 6}
        >
          {characters.length >= 6 ? 'All 6 slots used' : 'Create New'}
        </button>
      </div>
      {characters.length === 0 ? (
        <p className="text-gray-300">No characters yet. Create one to begin.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {characters.map((c) => {
            const isDead = c.mode === 'hardcore' && Boolean(c.killed_at);
            return (
              <div key={c.id} className={`bg-slate-700 rounded p-3 flex justify-between items-center ${isDead ? 'opacity-75' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`font-semibold ${isDead ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {c.name}
                    </div>
                    {isDead && (
                      <span className="bg-red-900 text-red-200 text-xs font-semibold px-2 py-0.5 rounded border border-red-700">
                        DEAD
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-300 capitalize">
                    {(classNameMap[c.class_id] || classNameMap[c.class] || c.class || 'Unknown')} — Level {c.level} — {c.mode || 'normal'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Zone: {c.zone_id} | Race: {raceMap[c.race_id]?.name || '—'} | Deity: {deityMap[c.deity_id]?.name || '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelect(c.id)}
                    disabled={isDead}
                    className={`text-sm font-semibold px-3 py-1 rounded ${
                      isDead
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title={isDead ? 'This character is dead and cannot be played' : ''}
                  >
                    Play
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-1 rounded"
                    disabled={characters.length <= 1}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
