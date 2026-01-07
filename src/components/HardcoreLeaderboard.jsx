import { useEffect, useState, useMemo } from 'react';
import { fetchLeaderboardCharacters } from '../services/playerStorage';

const formatTimestamp = (ts) => {
  const date = new Date(ts);
  return date.toLocaleString();
};

export default function HardcoreLeaderboard({
  classCache = {},
  raceCache = {},
  deityCache = {},
  fetchClass,
  fetchRace,
  fetchDeity
}) {
  const [activeTab, setActiveTab] = useState('hardcore');
  const [classFilter, setClassFilter] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [deityFilter, setDeityFilter] = useState('');
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const classesList = useMemo(() => {
    return Object.entries(classCache).map(([id, cls]) => ({ id, name: cls.name || id }));
  }, [classCache]);

  const racesList = useMemo(() => {
    return Object.entries(raceCache).map(([id, race]) => ({ id, name: race.name || id }));
  }, [raceCache]);

  const deitiesList = useMemo(() => {
    return Object.entries(deityCache).map(([id, deity]) => ({ id, name: deity.name || id }));
  }, [deityCache]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        console.log('Loading leaderboard with mode:', activeTab, 'filters:', { classId: classFilter, raceId: raceFilter, deityId: deityFilter });
        const data = await fetchLeaderboardCharacters({
          mode: activeTab,
          classId: classFilter || null,
          raceId: raceFilter || null,
          deityId: deityFilter || null,
          limit: 20
        });
        console.log('Leaderboard data received:', data);

        const enriched = (data || []).map((row) => {
          const raceName = raceCache[row.race_id]?.name || row.race || 'Unknown';
          const className = classCache[row.class_id]?.name || row.class || row.class_id || 'Unknown';
          const deityName = row.deity_id ? (deityCache[row.deity_id]?.name || row.deity) : (row.deity || 'None');
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

        console.log('Enriched leaderboard data:', enriched);
        setRuns(enriched);
      } catch (err) {
        console.error('Failed to load leaderboard', err);
        console.error('Error details:', err.message, err.stack);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeTab, classFilter, raceFilter, deityFilter, classCache, raceCache, deityCache]);

  return (
    <>
      <style>{`
        .leaderboard-select option {
          background: #3c322a !important;
          color: #fdc75b !important;
        }
      `}</style>
      <div className="stone-card" style={{ maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
      <div className="flex justify-center items-center mb-3">
        <div className="flex gap-2">
          <button
            className={`btn ${activeTab === 'hardcore' ? 'pressed' : ''}`}
            onClick={() => setActiveTab('hardcore')}
            style={activeTab === 'hardcore' ? { borderColor: '#7a1717' } : {}}
          >
            Hardcore
          </button>
          <button
            className={`btn ${activeTab === 'normal' ? 'pressed' : ''}`}
            onClick={() => setActiveTab('normal')}
            style={activeTab === 'normal' ? { borderColor: '#1f5a2a' } : {}}
          >
            Normal
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2 text-sm">
        <div className="flex items-center gap-2">
          <label style={{ color: 'var(--c-text-muted)' }}>Class:</label>
          <select
            className="leaderboard-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              fontSize: '0.875rem',
              background: '#3c322a',
              backgroundImage: 'var(--bg-stone-tex)',
              backgroundSize: 'cover',
              color: '#fdc75b',
              border: '1px solid #6c5742',
              borderRadius: 'var(--radius-md)'
            }}
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
          <label style={{ color: 'var(--c-text-muted)' }}>Race:</label>
          <select
            className="leaderboard-select"
            value={raceFilter}
            onChange={(e) => setRaceFilter(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              fontSize: '0.875rem',
              background: '#3c322a',
              backgroundImage: 'var(--bg-stone-tex)',
              backgroundSize: 'cover',
              color: '#fdc75b',
              border: '1px solid #6c5742',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <option value="">All</option>
            {racesList.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label style={{ color: 'var(--c-text-muted)' }}>Deity:</label>
          <select
            className="leaderboard-select"
            value={deityFilter}
            onChange={(e) => setDeityFilter(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              fontSize: '0.875rem',
              background: '#3c322a',
              backgroundImage: 'var(--bg-stone-tex)',
              backgroundSize: 'cover',
              color: '#fdc75b',
              border: '1px solid #6c5742',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <option value="">All</option>
            {deitiesList.map((deity) => (
              <option key={deity.id} value={deity.id}>
                {deity.name}
              </option>
            ))}
          </select>
        </div>
      </div>


      <div style={{ overflowY: 'auto', flex: 1 }}>
        {runs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
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
                <div 
                key={`${run.id || name}-${idx}`} 
                style={{
                  background: '#3c322a',
                  backgroundImage: 'var(--bg-stone-tex)',
                  backgroundSize: 'cover',
                  border: '1px solid #6c5742',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px'
                }}
              >
                <div style={{ color: '#fdc75b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{name}</span>
                    {activeTab === 'hardcore' && isDead && (
                      <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{formatTimestamp(isDead)}</span>
                    )}
                  </div>
                  <div>Level: {levelProgress}</div>
                  <div>Race: {run.race || 'Unknown'}</div>
                  <div>Class: {run.className || 'Unknown'}</div>
                  <div>Deity: {run.deity || 'None'}</div>
                  {activeTab === 'hardcore' && isDead && <div style={{ color: '#ef4444', fontWeight: '600' }}>Dead</div>}
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
