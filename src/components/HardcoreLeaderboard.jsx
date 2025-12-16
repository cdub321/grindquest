import { useMemo, useState } from 'react';

const formatTimestamp = (ts) => {
  const date = new Date(ts);
  return date.toLocaleString();
};

const sortRuns = (runs, sortBy) => {
  const clone = [...runs];
  if (sortBy === 'class') {
    return clone.sort((a, b) => {
      const nameA = (a.className || a.classId || '').toLowerCase();
      const nameB = (b.className || b.classId || '').toLowerCase();
      if (nameA === nameB) {
        const progA = a.level + (a.progress || 0);
        const progB = b.level + (b.progress || 0);
        return progB - progA;
      }
      return nameA.localeCompare(nameB);
    });
  }
  return clone.sort((a, b) => {
    const progA = a.level + (a.progress || 0);
    const progB = b.level + (b.progress || 0);
    return progB - progA;
  });
};

export default function HardcoreLeaderboard({
  hardcoreRuns = [],
  normalRuns = []
}) {
  const [activeTab, setActiveTab] = useState('hardcore');
  const [sortBy, setSortBy] = useState('level');

  const runs = activeTab === 'hardcore' ? hardcoreRuns : normalRuns;
  const sortedRuns = useMemo(() => sortRuns(runs, sortBy), [runs, sortBy]);

  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-blue-300">Leaderboards</h2>
        <div className="flex gap-2">
          <button
            className={`btn ${activeTab === 'hardcore' ? 'pressed' : ''}`}
            onClick={() => setActiveTab('hardcore')}
          >
            Hardcore
          </button>
          <button
            className={`btn ${activeTab === 'normal' ? 'pressed' : ''}`}
            onClick={() => setActiveTab('normal')}
          >
            Normal
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2 text-sm text-gray-300">
        <span>{sortedRuns.length} runs</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Sort:</span>
          <button
            className={`btn ${sortBy === 'level' ? 'pressed' : ''}`}
            onClick={() => setSortBy('level')}
          >
            Level
          </button>
          <button
            className={`btn ${sortBy === 'class' ? 'pressed' : ''}`}
            onClick={() => setSortBy('class')}
          >
            Class
          </button>
        </div>
      </div>

      {sortedRuns.length === 0 ? (
        <p className="text-sm text-gray-400">
          {activeTab === 'hardcore' ? 'No fallen heroes yet.' : 'No normal runs recorded yet.'}
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          {sortedRuns.map((run, idx) => {
            const levelProgress = (run.level + (run.progress || 0)).toFixed(2);
            return (
              <div key={`${run.timestamp}-${idx}`} className="bg-slate-700 px-3 py-2 rounded border border-slate-600">
                <div className="flex justify-between text-gray-200">
                  <span className="font-semibold">{run.name}</span>
                  <span className="text-gray-400">{formatTimestamp(run.timestamp)}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-gray-200 mt-1">
                  <span className="font-semibold text-blue-200">Lvl: {levelProgress}</span>
                  <span>Race: {run.race || 'Unknown'}</span>
                  <span>Class: {run.className || run.classId || 'Unknown'}</span>
                  <span>Deity: {run.deity || 'None'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
