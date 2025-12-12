export default function InventoryPanel({ inventory }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Inventory</h2>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {inventory.length === 0 ? (
          <p className="text-gray-500 text-sm">No items</p>
        ) : (
          inventory.slice(-8).map((item, idx) => (
            <div key={`${item}-${idx}`} className="text-sm text-gray-300 bg-slate-700 px-2 py-1 rounded">
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
