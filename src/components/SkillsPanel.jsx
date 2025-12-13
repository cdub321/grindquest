export default function SkillsPanel({ skills, onUse, cooldowns = {}, now = Date.now() }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Skills</h2>
      {(!skills || skills.length === 0) && (
        <div className="text-gray-400 text-sm">No skills available.</div>
      )}
      <div className="space-y-2">
        {skills.map((s) => {
          const until = cooldowns[s.id] || 0;
          const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
          return (
            <div key={s.id} className="bg-slate-700 rounded p-2 text-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-white font-semibold">{s.name}</div>
                  <div className="text-gray-300 capitalize text-xs">{s.type}</div>
                </div>
                <button
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs font-semibold px-2 py-1 rounded"
                  disabled={remaining > 0}
                  onClick={() => onUse(s)}
                >
                  {remaining > 0 ? `${remaining}s` : 'Use'}
                </button>
              </div>
              <div className="text-gray-300 text-xs mt-1">{s.description}</div>
              {s.tags?.length ? (
                <div className="text-gray-400 text-[10px] mt-1">Tags: {s.tags.join(', ')}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
