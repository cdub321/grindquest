export default function ZonePanel({ currentZone }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-2">Current Zone</h2>
      <p className="text-2xl font-bold text-white">{currentZone.name}</p>
    </div>
  );
}
