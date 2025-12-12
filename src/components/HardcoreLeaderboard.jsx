function formatTimestamp(ts) {
  const date = new Date(ts);
  return date.toLocaleString();
}

export default function HardcoreLeaderboard({ leaderboard }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Hardcore Leaderboard</h2>
      {leaderboard.length === 0 ? (
        <p className="text-sm text-gray-400">No fallen heroes yet.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {leaderboard.map((run, idx) => (
            <div key={`${run.timestamp}-${idx}`} className="flex justify-between bg-slate-700 px-2 py-1 rounded">
              <span className="text-white font-semibold">Level {run.levelReached}</span>
              <span className="text-gray-300">{formatTimestamp(run.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
