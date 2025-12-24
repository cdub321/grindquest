import { useEffect, useState, useMemo } from 'react';
import { fetchLeaderboardCharacters } from '../services/playerStorage';

const formatTimestamp = (ts) => {
  const date = new Date(ts);
  return date.toLocaleString();
};

export default function HardcoreLeaderboard({
  classNameMap = {},
  raceMap = {},
  deityMap = {}
}) {
  const [activeTab, setActiveTab] = useState('hardcore');
  const [classFilter, setClassFilter] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const classesList = useMemo(() => {
    return Object.entries(classNameMap).map(([id, name]) => ({ id, name }));
  }, [classNameMap]);

  const racesList = useMemo(() => {
    return Object.entries(raceMap).map(([id, race]) => ({ id, name: race.name }));
  }, [raceMap]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const data = await fetchLeaderboardCharacters({
          mode: activeTab,
          classId: classFilter || null,
          raceId: raceFilter || null,
          limit: 20
        });

        const enriched = (data || []).map((row) => {
          const raceName = raceMap[row.race_id]?.name || row.race || 'Unknown';
          const className = classNameMap[row.class_id] || row.class || row.class_id || 'Unknown';
          const deityName = row.deity_id ? deityMap[row.deity_id]?.name : row.deity || 'None';
          const levelVal = Number(row.level) || 0;
          const xpVal = Number(row.xp) || 0;
          const xpPerLevel = Math.max(1, levelVal * 100);
          const progress = xpVal / xpPerLevel;
          return {
            ...row,
            race: raceName,
            className,
            deity: deityName,
            level: levelVal,
            progress
          };
        });

        setRuns(enriched);
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeTab, classFilter, raceFilter, classNameMap, raceMap, deityMap]);

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

      <div className="flex flex-wrap gap-2 mb-2 text-sm">
        <div className="flex items-center gap-2">
          <label className="text-gray-400">Class:</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-slate-700 text-gray-200 border border-slate-600 rounded px-2 py-1"
          >
            <option value="">All</option>
            {classesList.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-400">Race:</label>
          <select
            value={raceFilter}
            onChange={(e) => setRaceFilter(e.target.value)}
            className="bg-slate-700 text-gray-200 border border-slate-600 rounded px-2 py-1"
          >
            <option value="">All</option>
            {racesList.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-2 text-sm text-gray-300">
        <span>{isLoading ? 'Loading…' : `${runs.length} characters`}</span>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-gray-400">
          {isLoading
            ? 'Fetching runs...'
            : activeTab === 'hardcore'
              ? 'No fallen heroes yet.'
              : 'No normal characters to show.'}
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          {runs.map((run, idx) => {
            const levelProgress = ((run.level || 0) + (run.progress || 0)).toFixed(2);
            const isDead = run.killed_at;
            const name = run.name || 'Unknown';
            return (
              <div key={`${run.id || name}-${idx}`} className="bg-slate-700 px-3 py-2 rounded border border-slate-600">
                <div className="flex justify-between text-gray-200">
                  <span className="font-semibold">{name}</span>
                  {activeTab === 'hardcore' && isDead && (
                    <span className="text-red-400 text-xs">{formatTimestamp(isDead)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-gray-200 mt-1">
                  <span className="font-semibold text-blue-200">Lvl: {levelProgress}</span>
                  <span>Race: {run.race || 'Unknown'}</span>
                  <span>Class: {run.className || 'Unknown'}</span>
                  <span>Deity: {run.deity || 'None'}</span>
                  {activeTab === 'hardcore' && isDead && <span className="text-red-300 font-semibold">Dead</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
