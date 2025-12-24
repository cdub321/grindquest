import EqIcon from './EqIcon';

export default function BankPanel({
  npc,
  bankSlots = [],
  items = {},
  onWithdraw,
  playerInventory = [],
  onDeposit,
  onClose,
  isLoading
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-blue-200">Bank</div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded bg-slate-800 border border-blue-900 text-gray-200 hover:border-blue-600"
        >
          Close
        </button>
      </div>
      <div className="text-xs text-gray-300">
        {npc?.name || 'Banker'}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-slate-900/70 border border-blue-900 rounded p-2 max-h-64 overflow-y-auto space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Bank</div>
          {isLoading && <div className="text-xs text-gray-400">Loading bank...</div>}
          {!isLoading && bankSlots.length === 0 && <div className="text-xs text-gray-400">Bank is empty.</div>}
          {!isLoading && bankSlots.map((row) => {
            const base = items[row.baseItemId || row.base_item_id] || {};
            return (
              <div key={row.id} className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-blue-900 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <EqIcon index={base.iconIndex ?? 0} size={22} />
                  <div>
                    <div className="font-semibold">{base.name || row.base_item_id}</div>
                    <div className="text-xs text-gray-400">Qty: {row.quantity || 1}</div>
                  </div>
                </div>
                <button
                  onClick={() => onWithdraw(row)}
                  className="text-xs px-2 py-1 rounded bg-blue-700 text-white border border-blue-500 hover:bg-blue-600"
                >
                  Withdraw
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900/70 border border-blue-900 rounded p-2 max-h-64 overflow-y-auto space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Your Inventory</div>
          {playerInventory.length === 0 && <div className="text-xs text-gray-400">Nothing to deposit.</div>}
          {playerInventory.map((entry) => {
            const baseId = entry.item.baseItemId || entry.item.base_item_id || entry.item.id;
            const base = items[baseId] || {};
            return (
              <div key={entry.key} className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-blue-900 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <EqIcon index={base.iconIndex ?? entry.item.iconIndex ?? 0} size={22} />
                  <div>
                    <div className="font-semibold">{base.name || entry.item.name || baseId}</div>
                    <div className="text-xs text-gray-400">Qty: {entry.item.quantity || 1}</div>
                  </div>
                </div>
                <button
                  onClick={() => onDeposit?.(entry)}
                  className="text-xs px-2 py-1 rounded bg-emerald-700 text-white border border-emerald-500 hover:bg-emerald-600"
                >
                  Deposit
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
