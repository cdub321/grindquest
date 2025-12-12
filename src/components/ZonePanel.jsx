export default function ZonePanel({ zones, currentZoneId, onZoneChange, availableZoneIds }) {
  const currentZone = zones[currentZoneId];
  const zoneEntries = availableZoneIds.map(id => [id, zones[id]]).filter(([, zone]) => zone);
  const connectedNames = (currentZone.connections || [])
    .map(id => zones[id]?.name)
    .filter(Boolean);

  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-2">Current Zone</h2>
      <p className="text-2xl font-bold text-white">{currentZone.name}</p>
      {currentZone.levelRange && (
        <p className="text-sm text-gray-300 mb-3">Levels {currentZone.levelRange}</p>
      )}
      <div className="text-xs text-gray-400 mb-3">
        Connected: {connectedNames.length ? connectedNames.join(', ') : 'None'}
      </div>
      <div className="space-y-2">
        <label className="text-sm text-gray-300 block">Travel to:</label>
        <select
          className="w-full bg-slate-700 text-white rounded p-2 border border-blue-900"
          value={currentZoneId}
          onChange={(e) => onZoneChange(e.target.value)}
        >
          {zoneEntries.map(([id, zone]) => (
            <option key={id} value={id}>
              {zone.name} ({zone.levelRange || 'Unknown'})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
