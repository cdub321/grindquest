const SLOT_LABELS = {
  weapon: 'Weapon',
  chest: 'Chest',
  feet: 'Feet',
  waist: 'Waist',
  jewelry: 'Jewelry',
  hands: 'Hands',
  back: 'Back',
  trinket: 'Trinket'
};

export default function EquipmentPanel({ equipment, onUnequip }) {
  return (
    <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
      <h2 className="text-xl font-bold text-blue-300 mb-3">Equipment</h2>
      <div className="space-y-2 text-sm">
        {Object.entries(SLOT_LABELS).map(([slot, label]) => {
          const item = equipment[slot];
          return (
            <div key={slot} className="flex justify-between items-center bg-slate-700 px-2 py-2 rounded">
              <div>
                <div className="text-gray-400">{label}</div>
                <div className="text-white font-semibold">
                  {item ? item.name : 'Empty'}
                </div>
                {item && (
                  <div className="text-xs text-gray-300">
                    {item.bonuses.damage ? `+${item.bonuses.damage} dmg ` : ''}
                    {item.bonuses.hp ? `+${item.bonuses.hp} hp ` : ''}
                    {item.bonuses.mana ? `+${item.bonuses.mana} mana ` : ''}
                  </div>
                )}
              </div>
              <button
                onClick={() => onUnequip(slot)}
                disabled={!item}
                className="text-xs font-semibold px-3 py-1 rounded transition-colors disabled:bg-gray-600 disabled:text-gray-300 bg-slate-600 hover:bg-slate-500 text-white"
              >
                Unequip
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
