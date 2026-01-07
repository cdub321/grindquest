import { useCallback } from 'react'
import { fetch_bank } from '../services/playerStorage'
import { save_bank } from '../services/playerStorage'
import { create_item_instance } from '../utils/itemInstance'

/**
 * Hook to manage bank transactions (deposit/withdraw)
 * 
 * @param {Object} params
 * @param {string} params.character_id - Character UUID
 * @param {Array} params.bank_slots - Current bank slots (from useInteractions)
 * @param {Function} params.update_bank_slots - Function to update bank slots
 * @param {Function} params.add_item_to_inventory - Function to add item to inventory
 * @param {Function} params.remove_item_from_inventory - Function to remove item from inventory
 * @param {Function} params.schedule_save - Save function
 * @param {Function} params.add_log - Logging function
 * @returns {Object} Bank transaction functions
 */
export function use_bank_transactions({
  character_id,
  bank_slots = [],
  update_bank_slots,
  add_item_to_inventory,
  remove_item_from_inventory,
  schedule_save,
  get_item_from_cache = () => null,
  fetch_item = null,
  add_log = null
}) {
  /**
   * Save bank to database
   */
  const save_bank_to_db = useCallback(async (slots) => {
    try {
      await save_bank(character_id, slots)
    } catch (err) {
      console.error('Bank save failed:', err)
      if (add_log) {
        add_log('Failed to save bank.', 'error')
      }
      throw err
    }
  }, [character_id, add_log])
  
  /**
   * Withdraw item from bank
   */
  const withdraw_from_bank = useCallback(async (bank_row) => {
    if (!bank_row) return false
    
    // Remove from bank slots
    const remaining = bank_slots.filter((r) => r.id !== bank_row.id)
    update_bank_slots(remaining)
    
    // Save bank
    try {
      await save_bank_to_db(remaining)
    } catch (err) {
      // Revert on error
      update_bank_slots(bank_slots)
      return false
    }
    
    // Create item instance from bank row (with base item data)
    let item_data = get_item_from_cache(bank_row.base_item_id)
    if (!item_data && fetch_item) {
      try {
        item_data = await fetch_item(bank_row.base_item_id)
      } catch (err) {
        console.error('Failed to fetch item for bank withdrawal:', err)
      }
    }
    const item_instance = create_item_instance(bank_row.base_item_id, item_data)
    item_instance.quantity = bank_row.quantity || 1
    
    // Add to inventory
    add_item_to_inventory(item_instance, item_instance.quantity)
    
    // Save inventory
    schedule_save({ inventory: true }, { immediate: true })
    
    if (add_log) {
      add_log(`You withdraw item from bank.`, 'system')
    }
    
    return true
  }, [
    bank_slots,
    update_bank_slots,
    save_bank_to_db,
    add_item_to_inventory,
    schedule_save,
    get_item_from_cache,
    fetch_item,
    add_log
  ])
  
  /**
   * Deposit item to bank
   */
  const deposit_to_bank = useCallback(async (item_entry) => {
    if (!item_entry?.item) return false
    
    const base_item_id = item_entry.item.base_item_id
    if (!base_item_id) {
      if (add_log) {
        add_log('Cannot bank an unknown item.', 'error')
      }
      return false
    }
    
    // Create bank row
    const bank_row = {
      id: `${base_item_id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      base_item_id: base_item_id,
      quantity: item_entry.item.quantity || 1,
      slot_id: null
    }
    
    // Add to bank slots
    const next = [...bank_slots, bank_row]
    update_bank_slots(next)
    
    // Save bank
    try {
      await save_bank_to_db(next)
    } catch (err) {
      // Revert on error
      update_bank_slots(bank_slots)
      return false
    }
    
    // Remove from inventory
    remove_item_from_inventory(item_entry)
    
    // Save inventory
    schedule_save({ inventory: true }, { immediate: true })
    
    if (add_log) {
      add_log(`You deposit item to bank.`, 'system')
    }
    
    return true
  }, [
    bank_slots,
    update_bank_slots,
    save_bank_to_db,
    remove_item_from_inventory,
    schedule_save,
    add_log
  ])
  
  return {
    withdraw_from_bank,
    deposit_to_bank
  }
}

