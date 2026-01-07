import { useState, useCallback } from 'react'
import { fetch_merchant_stock, fetch_item } from '../services/referenceData'
import { update_merchant_stock } from '../services/playerStorage'
import { currency_to_silver, silver_to_currency } from '../utils/currencyUtils'
import { create_item_instance } from '../utils/itemInstance'

/**
 * Hook to manage merchant transactions (buy/sell)
 * 
 * @param {Object} params
 * @param {Object} params.stat_totals - Player stat totals (for CHA price mod)
 * @param {Object} params.currency - Currency object { platinum, gold, silver }
 * @param {Function} params.set_currency - Function to update currency
 * @param {Function} params.add_item_to_inventory - Function to add item to inventory
 * @param {Function} params.remove_item_from_inventory - Function to remove item from inventory
 * @param {Function} params.schedule_save - Save function
 * @param {Function} params.add_log - Logging function
 * @param {Object} params.item_cache - Item cache object (base_item_id -> item_data)
 * @param {Function} params.fetch_item - Function to fetch item by ID
 * @returns {Object} Merchant transaction state and functions
 */
export function use_merchant_transactions({
  stat_totals = {},
  currency = { platinum: 0, gold: 0, silver: 0 },
  set_currency,
  add_item_to_inventory,
  remove_item_from_inventory,
  schedule_save,
  add_log = null,
  item_cache = {},
  fetch_item = null
}) {
  const [merchant_stock, set_merchant_stock] = useState({})
  const [merchant_data, set_merchant_data] = useState({}) // merchant_id -> merchant object with CHA
  
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val))

  /**
   * Get item data from cache (supports object map or getter function)
   */
  const get_item_from_cache = useCallback((item_id) => {
    if (!item_id) return null
    if (typeof item_cache === 'function') {
      return item_cache(item_id) || null
    }
    if (item_cache && typeof item_cache === 'object') {
      return item_cache[item_id] || null
    }
    return null
  }, [item_cache])
  
  /**
   * Set merchant CHA from mob data
   * Merchant is an NPC from mob_templates - every mob has charisma
   */
  const set_merchant_cha = useCallback((merchant_id, mob) => {
    if (!merchant_id || !mob) return
    set_merchant_data(prev => ({
      ...prev,
      [merchant_id]: { cha: mob.cha || 0 }
    }))
  }, [])
  
  /**
   * Load merchant stock
   */
  const load_merchant_stock = useCallback(async (merchant_id) => {
    if (!merchant_id) return
    try {
      // Load merchant stock
      const stock = await fetch_merchant_stock(merchant_id)
      set_merchant_stock(prev => ({
        ...prev,
        [merchant_id]: stock || []
      }))
    } catch (err) {
      console.error('Failed to load merchant stock:', err)
      if (add_log) {
        add_log('Failed to load merchant stock.', 'error')
      }
    }
  }, [add_log])
  
  /**
   * Get base price for an item.
   * prefer_merchant: when true, use merchant stock price first (buy path); when false, use item price (sell path).
   */
  const get_base_price = useCallback((merchant_id, item_id, { prefer_merchant = true } = {}) => {
    if (!merchant_id || !item_id) return 0
    
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${item_id}`)
    const merchant_price = stock_row && Number(stock_row.price)
    
    if (prefer_merchant && merchant_price) {
      return merchant_price
    }
    
    const item = get_item_from_cache(item_id)
    if (item?.price) {
      return Number(item.price) || 0
    }
    
    // As a last resort, if merchant price exists and prefer_merchant is false but cache missing, use merchant price
    return merchant_price || 0
  }, [merchant_stock, get_item_from_cache])
  
  /**
   * Calculate CHA difference modifier
   * Modifier = (player_CHA - merchant_CHA) / 100
   * Example: Player CHA 137, Merchant CHA 100 = 0.37 modifier
   */
  const get_cha_modifier = useCallback((merchant_id) => {
    if (!merchant_id) return 0
    
    const player_cha = stat_totals.cha || 0
    const merchant = merchant_data[merchant_id]
    const merchant_cha = merchant?.cha || 0
    
    const diff = player_cha - merchant_cha
    return diff / 100 // 0.37 for 37 CHA difference
  }, [stat_totals, merchant_data])
  
  /**
   * Calculate dynamic price modifier based on weight (demand scale)
   * Weight represents how much over/under merchant has paid based on CHA differences
   * Higher weight = higher demand = higher price
   * Lower weight = lower demand = lower price
   */
  const get_weight_modifier = useCallback((merchant_id, item_id) => {
    if (!merchant_id || !item_id) return 0
    
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${item_id}`)
    if (!stock_row) return 0
    
    const weight = Number(stock_row.weight) || 0
    const stock = Number.isFinite(stock_row.stock) ? Number(stock_row.stock) : 0
    
    // Demand markup: normalized by (stock + 1), clamped to avoid runaway
    const raw = weight / Math.max(1, stock + 1)
    return clamp(raw, -0.5, 0.5)
  }, [merchant_stock])
  
  /**
   * Get buy price for an item (player buying from merchant)
   * Base price (merchant_items.price) * (1 - CHA_modifier) * (1 + weight_modifier + scarcity)
   */
  const get_buy_price = useCallback((merchant_id, item_id, qty = 1) => {
    if (!merchant_id || !item_id) return 0
    
    const base = get_base_price(merchant_id, item_id, { prefer_merchant: true })
    if (!base) return 0
    
    const cha_mod = get_cha_modifier(merchant_id)
    const weight_mod = get_weight_modifier(merchant_id, item_id)
    
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${item_id}`)
    const stock = Number.isFinite(stock_row?.stock) ? Number(stock_row.stock) : null
    // Scarcity surcharge when stock is low (0-2 items => up to +20%)
    const scarcity = stock !== null ? Math.max(0, (2 - stock) * 0.1) : 0
    
    const price = base * qty * (1 - cha_mod) * (1 + weight_mod + scarcity)
    return Math.max(1, Math.round(price))
  }, [get_base_price, get_cha_modifier, get_weight_modifier, merchant_stock])
  
  /**
   * Get sell price for an item (player selling to merchant)
   * Base items.price * 0.5 * (1 + CHA_modifier) * stock_factor (2% off per existing stock)
   */
  const get_sell_price = useCallback((merchant_id, item_id, qty = 1) => {
    if (!merchant_id || !item_id) return 0
    
    const base = get_base_price(merchant_id, item_id, { prefer_merchant: false })
    if (!base) return 0
    
    const cha_mod = get_cha_modifier(merchant_id)
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${item_id}`)
    const current_stock = Number.isFinite(stock_row?.stock) ? Number(stock_row.stock) : 0
    const stock_factor = Math.max(0, 1 - 0.02 * current_stock)
    
    const price = base * qty * 0.5 * (1 + cha_mod) * stock_factor
    return Math.max(1, Math.round(price))
  }, [get_base_price, get_cha_modifier, merchant_stock])
  
  /**
   * Buy item from merchant
   */
  const buy_from_merchant = useCallback(async (merchant_id, item_id) => {
    if (!merchant_id || !item_id) {
      if (add_log) {
        add_log('Invalid merchant or item.', 'error')
      }
      return false
    }
    
    // Get price
    const price_cp = get_buy_price(merchant_id, item_id, 1)
    if (!price_cp) {
      if (add_log) {
        add_log('This item has no price set.', 'error')
      }
      return false
    }
    
    // Check currency
    const total_silver = currency_to_silver(currency)
    if (price_cp > total_silver) {
      if (add_log) {
        add_log('You do not have enough coin.', 'error')
      }
      return false
    }
    
    // Check stock
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${item_id}`)
    const current_stock = Number.isFinite(stock_row?.stock) ? Number(stock_row.stock) : null
    if (current_stock !== null && current_stock <= 0) {
      if (add_log) {
        add_log('That item is sold out.', 'error')
      }
      return false
    }
    
    // Deduct currency
    const new_silver = total_silver - price_cp
    const new_currency = silver_to_currency(new_silver)
    set_currency(new_currency)
    
    // Get item data (fetch if not cached)
    let item_data = get_item_from_cache(item_id)
    if (!item_data && fetch_item) {
      try {
        item_data = await fetch_item(item_id)
      } catch (err) {
        console.error('Failed to fetch item:', err)
      }
    }
    
    // Create item instance and add to inventory
    const item_instance = create_item_instance(item_id, item_data)
    add_item_to_inventory(item_instance, 1)
    
    // Save immediately
    schedule_save({
      character: { currency: new_currency },
      inventory: true
    }, { immediate: true })
    
    // Demand bump for player purchase
    const base_price = get_base_price(merchant_id, item_id, { prefer_merchant: true })
    const weight_change = 1
    
    // Update merchant stock locally
    set_merchant_stock(prev => {
      const existing = prev[merchant_id] || []
      const next = [...existing]
      const idx = next.findIndex((r) => `${r.item_id}` === `${item_id}`)
      if (idx !== -1) {
        const current = Number.isFinite(next[idx].stock) ? Number(next[idx].stock) : null
        const current_weight = Number(next[idx].weight) || 0
        if (current !== null) {
          const updated = current - 1
          const updated_weight = current_weight + weight_change
          if (updated <= 0) {
            next.splice(idx, 1)
          } else {
            next[idx] = {
              ...next[idx],
              stock: updated,
              weight: updated_weight
            }
          }
        }
      }
      return { ...prev, [merchant_id]: next }
    })
    
    // Update merchant stock in database
    try {
      const base_price = get_base_price(merchant_id, item_id, { prefer_merchant: true })
      await update_merchant_stock(merchant_id, item_id, -1, weight_change, base_price)
    } catch (err) {
      console.error('Failed to update merchant stock:', err)
      if (add_log) {
        add_log('Purchase saved, but merchant stock update failed.', 'error')
      }
    }
    
    if (add_log) {
      const item_name = item_data?.name || item_id
      add_log(`You buy ${item_name} for ${price_cp} silver.`, 'system')
    }
    
    return true
  }, [
    currency,
    merchant_stock,
    get_buy_price,
    get_base_price,
    set_currency,
    add_item_to_inventory,
    schedule_save,
    get_item_from_cache,
    fetch_item,
    add_log
  ])
  
  /**
   * Sell item to merchant
   */
  const sell_to_merchant = useCallback(async (merchant_id, item_entry, requested_qty = null) => {
    if (!merchant_id || !item_entry?.item) {
      if (add_log) {
        add_log('Invalid merchant or item.', 'error')
      }
      return false
    }
    
    const base_item_id = item_entry.item.base_item_id
    if (!base_item_id) {
      if (add_log) {
        add_log('Cannot sell an unknown item.', 'error')
      }
      return false
    }
    
    const base_price = get_base_price(merchant_id, base_item_id, { prefer_merchant: false })
    if (!base_price) {
      if (add_log) {
        add_log('This item has no price set.', 'error')
      }
      return false
    }
    
    const original_qty = item_entry.item.quantity || 1
    const qty = Math.max(1, Math.min(requested_qty || original_qty, original_qty))
    const sell_price_cp = get_sell_price(merchant_id, base_item_id, qty)
    
    const stock_list = merchant_stock[merchant_id] || []
    const stock_row = stock_list.find((r) => `${r.item_id}` === `${base_item_id}`)
    const current_stock = Number.isFinite(stock_row?.stock) ? Number(stock_row.stock) : 0
    const current_price = Number(stock_row?.price) || null
    const unit_sell_price = Math.max(1, Math.round(sell_price_cp / qty))
    
    // Add currency
    const total_silver = currency_to_silver(currency) + sell_price_cp
    const new_currency = silver_to_currency(total_silver)
    set_currency(new_currency)
    
    // Remove item from inventory (supports partial by re-adding remainder)
    remove_item_from_inventory(item_entry)
    const remaining_qty = Math.max(0, original_qty - qty)
    if (remaining_qty > 0) {
      add_item_to_inventory(item_entry.item, remaining_qty)
    }
    
    // Save immediately
    schedule_save({
      character: { currency: new_currency },
      inventory: true
    }, { immediate: true })
    
    // Update merchant stock locally
    set_merchant_stock(prev => {
      const existing = prev[merchant_id] || []
      const next = [...existing]
      const idx = next.findIndex((r) => `${r.item_id}` === `${base_item_id}`)
      
      if (idx !== -1) {
        const current_stock = Number.isFinite(next[idx].stock) ? Number(next[idx].stock) : 0
        const current_weight = Number(next[idx].weight) || 0
        const current_price_local = Number(next[idx].price) || current_price || unit_sell_price
        
        // Update stock and weight
        const updated_stock = current_stock + qty
        const updated_weight = current_weight // no weight change on sell-to-merchant
        
        next[idx] = {
          ...next[idx],
          stock: updated_stock,
          weight: updated_weight,
          price: current_price_local
        }
      } else {
        // New item in merchant stock
        next.push({
          item_id: base_item_id,
          stock: qty,
          price: unit_sell_price, // set to amount paid on first acquisition
          weight: 0
        })
      }
      
      return { ...prev, [merchant_id]: next }
    })
    
    // Update merchant stock in database
    try {
      const price_to_store = current_price || unit_sell_price
      await update_merchant_stock(merchant_id, base_item_id, qty, 0, price_to_store)
    } catch (err) {
      console.error('Failed to update merchant stock:', err)
      if (add_log) {
        add_log('Purchase saved, but merchant stock update failed.', 'error')
      }
    }
    
    if (add_log) {
      const item_name = item_entry.item.name || base_item_id
      add_log(`You sell ${item_name} for ${sell_price_cp} silver.`, 'system')
    }
    
    return true
  }, [
    add_item_to_inventory,
    currency,
    merchant_stock,
    get_base_price,
    get_sell_price,
    set_currency,
    remove_item_from_inventory,
    schedule_save,
    add_log
  ])
  
  return {
    merchant_stock,
    load_merchant_stock,
    set_merchant_cha,
    get_buy_price,
    get_sell_price,
    buy_from_merchant,
    sell_to_merchant
  }
}
