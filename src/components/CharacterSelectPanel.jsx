export default function CharacterSelectPanel({
  characters,
  onSelect,
  onCreateClick,
  onDelete
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
          {characters.map((c) => (
            <div key={c.id} className="bg-slate-700 rounded p-3 flex justify-between items-center">
              <div>
                <div className="text-white font-semibold">{c.name}</div>
                <div className="text-sm text-gray-300 capitalize">
                  {c.class} — Level {c.level}
                </div>
                <div className="text-xs text-gray-400">Zone: {c.zone_id}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onSelect(c.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1 rounded"
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
          ))}
        </div>
      )}
    </div>
  );
}
