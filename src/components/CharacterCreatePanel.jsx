import { useMemo, useState, useEffect } from 'react';

export default function CharacterCreatePanel({
  classesData,
  races = [],
  deities = [],
  raceClassAllowed = [],
  deityClassAllowed = [],
  onCreate
}) {
  const [selectedRace, setSelectedRace] = useState(races[0]?.id || '');
  const [selectedDeity, setSelectedDeity] = useState(deities[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState(Object.keys(classesData)[0] || '');

  const allowedClassIds = useMemo(() => {
    const byRace = selectedRace
      ? raceClassAllowed.filter(r => r.race_id === selectedRace).map(r => r.class_id)
      : [];
    const byDeity = selectedDeity
      ? deityClassAllowed.filter(d => d.deity_id === selectedDeity).map(d => d.class_id)
      : [];

    return Object.entries(classesData).filter(([id]) => {
      const raceOk = byRace.length ? byRace.includes(id) : true;
      const deityOk = byDeity.length ? byDeity.includes(id) : true;
      return raceOk && deityOk;
    });
  }, [classesData, selectedRace, selectedDeity, raceClassAllowed, deityClassAllowed]);

  useEffect(() => {
    if (allowedClassIds.length && !allowedClassIds.find(([id]) => id === selectedClass)) {
      setSelectedClass(allowedClassIds[0][0]);
    }
  }, [allowedClassIds, selectedClass]);

  return (
    <div className="max-w-3xl mx-auto bg-slate-800 border-2 border-blue-900 rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold text-blue-300 mb-4">Create Character</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const name = form.get('name');
          const classKey = form.get('classKey');
          const raceId = form.get('raceId');
          const deityId = form.get('deityId');
          const mode = form.get('mode');
          onCreate({ name, classKey, raceId, deityId, mode });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-300 mb-1">Name</label>
          <input
            name="name"
            required
            maxLength={20}
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white"
            placeholder="Enter a name"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Class</label>
          <select
            name="classKey"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
          >
            {allowedClassIds.map(([key, cls]) => (
              <option key={key} value={key}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Race</label>
            <select
              name="raceId"
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
              className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Deity</label>
            <select
              name="deityId"
              value={selectedDeity}
              onChange={(e) => setSelectedDeity(e.target.value)}
              className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
            >
              {deities.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Mode</label>
          <select
            name="mode"
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
          >
            <option value="normal">Normal</option>
            <option value="hardcore">Hardcore (death resets run)</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
        >
          Create
        </button>
      </form>
    </div>
  );
}
