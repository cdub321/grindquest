import Icon from './Icon';
import { get_item_from_cache } from '../services/referenceData';
import { useState } from 'react';

/**
 * Unified Trade Panel component for Bank, Merchant, and Tradeskill interactions
 * 
 * @param {Object} props
 * @param {string} props.mode - 'bank' | 'merchant' | 'tradeskill'
 * @param {Object} props.npc - NPC object
 * @param {Array} props.source_items - Bank slots (bank mode) or stock (merchant mode)
 * @param {Array} props.player_inventory - Player inventory items
 * @param {Function} props.get_item - Function to get item data (defaults to get_item_from_cache)
 * @param {Object} props.item_cache - Item cache object (for merchant mode)
 * @param {string} props.merchant_id - Merchant ID (for merchant mode)
 * @param {string} props.tradeskill_name - Tradeskill name (for tradeskill mode)
 * @param {Object} props.currency - Currency object { platinum, gold, silver } (merchant mode only)
 * @param {Function} props.get_buy_price - Function to get buy price (merchant mode)
 * @param {Function} props.get_sell_price - Function to get sell price (merchant mode)
 * @param {Function} props.on_source_action - on_withdraw (bank) or on_buy (merchant)
 * @param {Function} props.on_player_action - on_deposit (bank) or on_sell (merchant)
 * @param {Function} props.on_close - Close handler
 * @param {boolean} props.is_loading - Loading state (bank mode only)
 */
export default function TradePanel({
  mode = 'bank',
  npc,
  source_items = [],
  player_inventory = [],
  get_item = get_item_from_cache,
  item_cache = {},
  merchant_id,
  tradeskill_name,
  camp = null,
  currency = { platinum: 0, gold: 0, silver: 0 },
  get_buy_price,
  get_sell_price,
  on_source_action,
  on_player_action,
  on_close,
  is_loading = false
}) {
  const [sellQtyByKey, setSellQtyByKey] = useState({});
  const format_price = (cp) => `${cp} silver`;
  const camp_name = camp?.name || '';
  const merchant_name = npc?.name || 'Merchant';
  const portrait_url = (() => {
    if (npc?.portrait_url) return npc.portrait_url;
    const race = npc?.race_id ?? npc?.raceId ?? 0;
    const gender = npc?.gender ?? 0;
    const texture = npc?.texture_id ?? npc?.textureId ?? 1;
    return `/stone-ui/raceimages/${race}_${gender}_${texture}_0.jpg`;
  })();

  const is_bank = mode === 'bank';
  const is_merchant = mode === 'merchant';
  const is_tradeskill = mode === 'tradeskill';
  
  // Tradeskill mode - show "Not Implemented Yet"
  if (is_tradeskill) {
    const title = tradeskill_name ? tradeskill_name.charAt(0).toUpperCase() + tradeskill_name.slice(1) : 'Tradeskill';
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-blue-200">{title}</div>
          <button
            onClick={on_close}
            className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-gray-200 hover:border-blue-600"
          >
            Close
          </button>
        </div>
        <div className="text-xs text-gray-300">
          {npc?.name || 'Tradeskill Station'}
        </div>
        <div className="bg-slate-900/70 border border-slate-700 rounded p-4 text-center">
          <div className="text-gray-300">Not Implemented Yet</div>
        </div>
      </div>
    );
  }

  // Get item data helper - handles both bank and merchant modes
  const get_item_data = (item_id) => {
    if (is_bank) {
      return get_item(item_id);
    } else {
      // For merchant mode, try item_cache first, then fall back to get_item
      return (item_cache && typeof item_cache === 'object' ? item_cache[item_id] : null) || get_item(item_id) || {};
    }
  };

  // Render source item (bank slot or merchant stock)
  const render_source_item = (row) => {
    const item_id = is_bank ? row.base_item_id : row.item_id;
    const base = get_item_data(item_id);
    
    if (!base && is_bank) return null; // Bank requires valid item
    
    const item_name = row.item_name || base?.name || `Item ${row.item_id}` || 'Unknown Item';
    const icon_index = base?.icon_index || 0;
    const quantity = is_bank ? (row.quantity || 1) : null;
    
    // Merchant-specific data
    let price = 0;
    let stock_count = null;
    let sold_out = false;
    
    if (is_merchant) {
      price = get_buy_price && merchant_id ? get_buy_price(merchant_id, row.item_id, 1) : row.price || 0;
      stock_count = Number.isFinite(row.stock) ? row.stock : '∞';
      sold_out = Number.isFinite(row.stock) && row.stock <= 0;
    }

    return (
      <div 
        key={is_bank ? row.id : `${row.item_id}-${row.price || 'p'}`} 
        className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-slate-700 rounded px-2 py-1"
      >
        <div className="flex items-center gap-2">
          <Icon index={icon_index} size={22} />
          <div>
            <div className="font-semibold">{item_name}</div>
            <div className="text-xs text-gray-400">
              {is_bank ? `Qty: ${quantity}` : `Price: ${format_price(price)} · Stock: ${stock_count}`}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (is_bank) {
              on_source_action?.(row)
            } else {
              on_source_action?.(merchant_id, row.item_id)
            }
          }}
          disabled={is_merchant && sold_out}
          className={`text-xs px-2 py-1 rounded text-white border ${
            is_bank 
              ? 'bg-blue-700 border-blue-500 hover:bg-blue-600' 
              : 'bg-blue-700 border-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {is_bank ? 'Withdraw' : 'Buy'}
        </button>
      </div>
    );
  };

  // Render player inventory item
  const render_player_item = (entry) => {
    const base_id = entry.item.base_item_id;
    const base = get_item_data(base_id);
    
    if (!base && is_bank) return null; // Bank requires valid item
    
    const item_name = base?.name || entry.item.name || `Item ${base_id}` || 'Unknown Item';
    const icon_index = base?.icon_index || entry.item.icon_index || 0;
    const qty = entry.item.quantity || 1;
    
    // Merchant-specific data
    let price = 0;
    if (is_merchant) {
      price = get_sell_price && merchant_id ? get_sell_price(merchant_id, base_id, qty) : 0;
    }
    const current_qty = sellQtyByKey[entry.key] ?? qty;
    const clamped_qty = Math.max(1, Math.min(current_qty, qty));

    return (
      <div key={entry.key} className="flex items-center justify-between text-sm text-gray-100 bg-slate-800/80 border border-slate-700 rounded px-2 py-1">
        <div className="flex items-center gap-2">
          <Icon index={icon_index} size={22} />
          <div>
            <div className="font-semibold">{item_name}</div>
            <div className="text-xs text-gray-400">
              {is_bank ? `Qty: ${qty}` : `Qty: ${qty} · Value: ${format_price(price)}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {is_merchant && (
            <input
              type="number"
              min={1}
              max={qty}
              value={clamped_qty}
              onChange={(e) => {
                const val = Number(e.target.value) || 1;
                setSellQtyByKey((prev) => ({ ...prev, [entry.key]: val }));
              }}
              className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-gray-100"
            />
          )}
          <button
            onClick={() => {
              if (is_bank) {
                on_player_action?.(entry);
              } else {
                on_player_action?.(merchant_id, entry, clamped_qty);
              }
            }}
            className="text-xs px-2 py-1 rounded bg-emerald-700 text-white border border-emerald-500 hover:bg-emerald-600"
          >
            {is_bank ? 'Deposit' : 'Sell'}
          </button>
        </div>
      </div>
    );
  };

  const title = camp_name || (is_bank ? 'Bank' : 'Merchant');
  const source_label = is_bank ? 'Bank' : 'For Sale';
  const player_label = is_bank ? 'Your Inventory' : 'Your Inventory (Sell)';
  const source_empty_msg = is_bank 
    ? (is_loading ? 'Loading bank...' : 'Bank is empty.') 
    : 'No items for sale.';
  const player_empty_msg = is_bank ? 'Nothing to deposit.' : 'Nothing to sell.';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center w-32 min-h-[250px]">
          <div
            className="w-28 h-28 rounded overflow-hidden border border-blue-700 bg-slate-800"
            style={{ boxShadow: '0 6px 14px rgba(0,0,0,0.4)', minHeight: 250 }}
          >
            <img
              src={portrait_url}
              alt={merchant_name}
              className="object-cover w-full h-full"
              onError={(e) => { e.target.src = '/stone-ui/raceimages/0_0_1_0.jpg'; }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-200 text-center font-semibold">{merchant_name}</div>
          <button
            onClick={on_close}
            className="mt-3 text-xs px-3 py-1 rounded bg-slate-800 border border-blue-700 text-gray-200 hover:border-blue-400"
          >
            Close
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-blue-200">{title}</div>
              
            </div>
            {is_merchant && (
              <div className="stone-money">
                <div className="stone-row">
                  <span className="stone-label">Plat</span>
                  <span className="stone-value plat">{currency.platinum || 0}</span>

                  <span className="stone-label gold">Gold</span>
                  <span className="stone-value gold">{currency.gold || 0}</span>

                  <span className="stone-label silver">Silver</span>
                  <span className="stone-value silver">{currency.silver || 0}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {/* Source items (Bank or Merchant Stock) */}
            <div className="bg-slate-900/70 border border-slate-700 rounded p-3 max-h-72 overflow-y-auto space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{source_label}</div>
              {is_bank && is_loading && <div className="text-xs text-gray-400">Loading bank...</div>}
              {!is_loading && source_items.length === 0 && <div className="text-xs text-gray-400">{source_empty_msg}</div>}
              {!is_loading && source_items.map(render_source_item)}
            </div>

            {/* Player inventory */}
            <div className="bg-slate-900/70 border border-slate-700 rounded p-3 max-h-72 overflow-y-auto space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{player_label}</div>
              {player_inventory.length === 0 && <div className="text-xs text-gray-400">{player_empty_msg}</div>}
              {player_inventory.map(render_player_item)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
