import { useMemo, useState, useEffect } from 'react';

export function CharacterSelectPanel({
  characters,
  onSelect,
  onCreateClick,
  onDelete,
  classCache = {},
  raceCache = {},
  deityCache = {}
}) {

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 border-2 border-slate-700 rounded-lg p-6 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1"></div>
        <h2 className="text-2xl font-bold text-blue-300 flex-1 text-center">Select Your Character</h2>
        <div className="flex-1 flex justify-end">
          <button
            onClick={onCreateClick}
            className="btn success"
            disabled={characters.length >= 6}
          >
            {characters.length >= 6 ? 'All 6 slots used' : 'Create New'}
          </button>
        </div>
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
                    {(classCache[c.class_id]?.name || classCache[c.class]?.name || c.class || 'Unknown')} — Level {c.level} — {c.mode || 'normal'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Zone: {c.zone_id} | Race: {raceCache[c.race_id]?.name || '—'} | Deity: {deityCache[c.deity_id]?.name || '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelect(c.id)}
                    disabled={isDead}
                    className="btn primary"
                    title={isDead ? 'This character is dead and cannot be played' : ''}
                  >
                    Play
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="btn danger"
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

export function CharacterCreatePanel({
  classes = {},
  races = [],
  deities = [],
  race_class_allowed = [],
  deity_class_allowed = [],
  race_deity_allowed = [],
  onCreate
}) {
  
  const [selectedRace, setSelectedRace] = useState('');
  const [selectedDeity, setSelectedDeity] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  
  useEffect(() => {
    if (races.length && !selectedRace) setSelectedRace(races[0]?.r_id || '');
    if (deities.length && !selectedDeity) setSelectedDeity(deities[0]?.d_id || '');
    if (Object.keys(classes).length && !selectedClass) setSelectedClass(Object.keys(classes)[0] || '');
  }, [races, deities, classes]);
  const TOTAL_POINTS = 25;
  const [statPoints, setStatPoints] = useState(TOTAL_POINTS);
  const [stats, setStats] = useState({
    str: 0,
    sta: 0,
    dex: 0,
    agi: 0,
    int: 0,
    wis: 0,
    cha: 0
  });

  // Filter deities based on selected race
  const allowed_deities = useMemo(() => {
    if (!selectedRace || !race_deity_allowed.length) {
      return deities;
    }
    const allowed_deity_ids = race_deity_allowed
      .filter(rd => rd.r_id === Number(selectedRace))
      .map(rd => rd.d_id);
    return deities.filter(d => allowed_deity_ids.includes(d.d_id));
  }, [deities, selectedRace, race_deity_allowed]);

  const allowed_class_ids = useMemo(() => {
    const by_race = selectedRace
      ? race_class_allowed.filter(r => r.r_id === Number(selectedRace)).map(r => r.c_id)
      : [];
    const by_deity = selectedDeity
      ? deity_class_allowed.filter(d => d.d_id === Number(selectedDeity)).map(d => d.c_id)
      : [];

    return Object.entries(classes).filter(([id]) => {
      const class_id = Number(id);
      const race_ok = by_race.length ? by_race.includes(class_id) : true;
      const deity_ok = by_deity.length ? by_deity.includes(class_id) : true;
      return race_ok && deity_ok;
    });
  }, [classes, selectedRace, selectedDeity, race_class_allowed, deity_class_allowed]);

  // Reset deity selection if current deity is not allowed for selected race
  useEffect(() => {
    if (selectedRace && race_deity_allowed.length) {
      const allowed_deity_ids = race_deity_allowed
        .filter(rd => rd.r_id === Number(selectedRace))
        .map(rd => rd.d_id);
      if (selectedDeity && !allowed_deity_ids.includes(Number(selectedDeity))) {
        setSelectedDeity(allowed_deity_ids[0]?.toString() || '');
      }
    }
  }, [selectedRace, race_deity_allowed, selectedDeity]);

  useEffect(() => {
    if (allowed_class_ids.length && !allowed_class_ids.find(([id]) => id === selectedClass)) {
      setSelectedClass(allowed_class_ids[0][0]);
    }
  }, [allowed_class_ids, selectedClass]);

  const adjustStat = (key, delta) => {
    const next = { ...stats, [key]: Math.max(0, (stats[key] || 0) + delta) };
    const used = Object.values(next).reduce((a, b) => a + b, 0);
    if (used > TOTAL_POINTS) return;
    setStats(next);
    setStatPoints(TOTAL_POINTS - used);
  };

  const statOrder = ['str', 'sta', 'dex', 'agi', 'int', 'wis', 'cha'];
  const statLabels = {
    str: 'STR',
    sta: 'STA',
    dex: 'DEX',
    agi: 'AGI',
    int: 'INT',
    wis: 'WIS',
    cha: 'CHA'
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-800 border-2 border-slate-700 rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold text-blue-300 mb-4 text-center">Create Character</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const name = form.get('name');
          const classKey = form.get('classKey');
          const raceId = form.get('raceId');
          const deityId = form.get('deityId');
          const mode = form.get('mode');
          onCreate({ name, classKey, raceId, deityId, mode, stats });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-300 mb-1">Name</label>
          <input
            name="name"
            required
            maxLength={20}
            className="w-full bg-slate-700 border border-slate-700 rounded px-3 py-2 text-white"
            placeholder="Enter a name"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Class</label>
            <select
              name="classKey"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white capitalize"
            >
              {allowed_class_ids.map(([key, cls]) => (
                <option key={key} value={key}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Race</label>
            <select
              name="raceId"
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white capitalize"
            >
              {races.map((r) => (
                <option key={r.r_id} value={r.r_id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Deity</label>
            <select
              name="deityId"
              value={selectedDeity}
              onChange={(e) => setSelectedDeity(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white capitalize"
            >
              {allowed_deities.map((d) => (
                <option key={d.d_id} value={d.d_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Mode</label>
            <select
              name="mode"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white capitalize"
            >
              <option value="normal">Normal</option>
              <option value="hardcore">Hardcore (death resets run)</option>
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-gray-300">Allocate Stats (points left: {statPoints})</label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {statOrder.map((key) => (
              <div key={key} className="flex items-center justify-between bg-slate-700 border border-slate-700 rounded px-2 py-1">
                <span className="text-sm text-gray-100">{statLabels[key]}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStat(key, -1)}
                    disabled={stats[key] <= 0}
                    className="bg-slate-800 border border-slate-700 rounded px-2 text-white disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-white font-semibold w-6 text-center">{stats[key]}</span>
                  <button
                    type="button"
                    onClick={() => adjustStat(key, 1)}
                    disabled={statPoints <= 0}
                    className="bg-slate-800 border border-slate-700 rounded px-2 text-white disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            className="btn success"
            disabled={statPoints !== 0}
          >
            {statPoints === 0 ? 'Create' : 'Spend all points to create'}
          </button>
        </div>
      </form>
    </div>
  );
}

