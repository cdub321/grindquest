export default function InventoryPanel({ inventory, onEquip, equipSlots }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Inventory</h2>
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {inventory.length === 0 ? (
          <p className="text-gray-500 text-sm">No items</p>
        ) : (
          inventory.map((item) => (
            <div key={item.id} className="text-sm text-gray-300 bg-slate-700 px-2 py-2 rounded flex justify-between items-center">
              <div>
                <div className="font-semibold text-white">{item.name}</div>
                <div className="text-xs text-gray-400 capitalize">Slot: {item.slot}</div>
                <div className="text-xs text-gray-400">
                  {item.bonuses.damage ? `+${item.bonuses.damage} dmg ` : ''}
                  {item.bonuses.hp ? `+${item.bonuses.hp} hp ` : ''}
                  {item.bonuses.mana ? `+${item.bonuses.mana} mana ` : ''}
                </div>
              </div>
              {equipSlots.includes(item.slot) ? (
                <button
                  onClick={() => onEquip(item.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded transition-colors"
                >
                  Equip
                </button>
              ) : (
                <span className="text-xs text-gray-400">Non-gear</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
