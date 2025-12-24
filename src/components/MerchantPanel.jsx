import EqIcon from './EqIcon';

export default function MerchantPanel({
  npc,
  stock = [],
  items = {},
  merchantId,
  currency,
  playerInventory = [],
  getBuyPrice,
  getSellPrice,
  onBuy,
  onSell,
  onClose
}) {
  const formatPrice = (cp) => `${cp} cp`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-blue-200">Merchant</div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded bg-slate-800 border border-blue-900 text-gray-200 hover:border-blue-600"
        >
          Close
        </button>
      </div>
      <div className="text-xs text-gray-300">
        {npc?.name || 'Vendor'}
      </div>
      <div className="flex justify-between text-sm text-gray-200">
        <div>Plat: {currency.platinum}</div>
        <div>Gold: {currency.gold}</div>
        <div>Silver: {currency.silver}</div>
        <div>Copper: {currency.copper}</div>
      </div>
      <div className="bg-slate-900/70 border border-blue-900 rounded p-2 space-y-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">For Sale</div>
        <div className="max-h-52 overflow-y-auto space-y-2">
          {stock.length === 0 && <div className="text-xs text-gray-400">No items for sale.</div>}
          {stock.map((row) => {
            const base = items[row.item_id] || {};
            const price = getBuyPrice ? getBuyPrice(row.item_id, 1) : row.price || 0;
            const stockCount = row.stock ?? '∞';
            const soldOut = Number.isFinite(row.stock) && row.stock <= 0;
            return (
              <div key={`${row.item_id}-${row.price ?? 'p'}`} className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-blue-900 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <EqIcon index={base.iconIndex ?? 0} size={22} />
                  <div>
                    <div className="font-semibold">{base.name || row.item_id}</div>
                    <div className="text-xs text-gray-400">Price: {formatPrice(price)} · Stock: {stockCount}</div>
                  </div>
                </div>
                <button
                  onClick={() => onBuy?.(merchantId, row.item_id)}
                  disabled={soldOut}
                  className="text-xs px-2 py-1 rounded bg-blue-700 text-white border border-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Buy
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900/70 border border-blue-900 rounded p-2 space-y-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">Your Inventory (Sell)</div>
        <div className="max-h-52 overflow-y-auto space-y-2">
          {playerInventory.length === 0 && <div className="text-xs text-gray-400">Nothing to sell.</div>}
          {playerInventory.map((entry) => {
            const baseId = entry.item.baseItemId || entry.item.base_item_id || entry.item.id;
            const base = items[baseId] || {};
            const qty = entry.item.quantity || 1;
            const price = getSellPrice ? getSellPrice(baseId, qty) : 0;
            return (
              <div key={entry.key} className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-blue-900 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <EqIcon index={base.iconIndex ?? entry.item.iconIndex ?? 0} size={22} />
                  <div>
                    <div className="font-semibold">{base.name || entry.item.name || baseId}</div>
                    <div className="text-xs text-gray-400">Qty: {qty} · Value: {formatPrice(price)}</div>
                  </div>
                </div>
                <button
                  onClick={() => onSell?.(merchantId, entry)}
                  className="text-xs px-2 py-1 rounded bg-emerald-700 text-white border border-emerald-500 hover:bg-emerald-600"
                >
                  Sell
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
