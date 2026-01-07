import { useState, useCallback } from 'react'
import { fetch_bank } from '../services/playerStorage'
import { fetch_merchant_stock, fetch_item } from '../services/referenceData'
import { get_interaction_type_from_content_flags, extract_merchant_id, get_tradeskill_name } from '../utils/npcUtils'

/**
 * Hook to manage camp interactions (banker/merchant/tradeskill)
 * 
 * NOTE: Non-enemy camps (Banker, Merchant, Tradeskill stations) will ALWAYS 
 * have only ONE NPC in that camp (camp_members).
 * 
 * @param {Object} params
 * @param {string} params.character_id - Character UUID
 * @param {Function} params.add_log - Logging function
 * @returns {Object} Interaction state and functions
 */
export function use_interactions({ character_id, add_log = null }) {
  const [interaction, set_interaction] = useState(null)
  const [bank_slots, set_bank_slots] = useState([])
  const [is_bank_loading, set_is_bank_loading] = useState(false)
  const [merchant_stock, set_merchant_stock] = useState({})
  const [merchant_data, set_merchant_data] = useState({})
  const [is_merchant_loading, set_is_merchant_loading] = useState(false)
  
  /**
   * Open interaction with a camp
   * @param {Object} camp - Camp object with content_flags
   * @param {Object} mob - Mob object from camp_members (single NPC for non-enemy camps)
   */
  const open_interaction = useCallback(async (camp, mob = null) => {
    if (!camp) return
    
    const interaction_type = get_interaction_type_from_content_flags(camp.content_flags)
    if (!interaction_type) return
    
    // Get mob data for display (name, portrait, charisma)
    // For non-enemy camps, mob is the single NPC in camp_members
    const mob_data = mob || null
    
    if (interaction_type === 'banker') {
      set_is_bank_loading(true)
      try {
        const rows = await fetch_bank(character_id)
        // Normalize bank rows for display and attach base item data
        const normalized = await Promise.all(rows.map(async (row) => {
          let item_data = null
          try {
            item_data = await fetch_item(row.base_item_id)
          } catch (err) {
            console.error(`Failed to fetch item ${row.base_item_id} for bank:`, err)
          }
          return {
            id: row.id,
            base_item_id: row.base_item_id,
            quantity: row.quantity || 1,
            slot_id: row.slot_id || null,
            item_name: item_data?.name || null,
            icon_index: item_data?.icon_index || null
          }
        }))
        set_bank_slots(normalized)
        set_interaction({ 
          type: 'banker', 
          camp, 
          mob: mob_data,
          bank_slots: normalized 
        })
      } catch (err) {
        console.error('Bank load failed:', err)
        if (add_log) {
          add_log('Failed to load bank.', 'error')
        }
      } finally {
        set_is_bank_loading(false)
      }
    } else if (interaction_type === 'merchant') {
      const merchant_id = extract_merchant_id(camp.content_flags)
      if (!merchant_id) {
        if (add_log) {
          add_log('Invalid merchant camp.', 'error')
        }
        return
      }
      
      set_is_merchant_loading(true)
      try {
        // Store merchant CHA from mob (merchant is an NPC from mob_templates)
        // Every mob has charisma, no fallback needed
        if (mob_data) {
          set_merchant_data(prev => ({
            ...prev,
            [merchant_id]: { cha: mob_data.cha || 0 }
          }))
        }
        
        // Load merchant stock
        const stock = await fetch_merchant_stock(merchant_id)
        set_merchant_stock(prev => ({
          ...prev,
          [merchant_id]: stock || []
        }))
        
        set_interaction({
          type: 'merchant',
          camp,
          mob: mob_data,
          merchant_id,
          stock: stock || []
        })
      } catch (err) {
        console.error('Merchant load failed:', err)
        if (add_log) {
          add_log('Failed to load merchant.', 'error')
        }
      } finally {
        set_is_merchant_loading(false)
      }
    } else if (interaction_type === 'tradeskill') {
      const tradeskill_name = get_tradeskill_name(camp.content_flags)
      set_interaction({
        type: 'tradeskill',
        camp,
        mob: mob_data,
        tradeskill_name
      })
    }
  }, [character_id, add_log])
  
  /**
   * Close current interaction
   */
  const close_interaction = useCallback(() => {
    set_interaction(null)
  }, [])
  
  /**
   * Update bank slots (for withdraw/deposit)
   */
  const update_bank_slots = useCallback((new_slots) => {
    set_bank_slots(new_slots)
  }, [])
  
  return {
    interaction,
    bank_slots,
    is_bank_loading,
    merchant_stock,
    merchant_data,
    is_merchant_loading,
    open_interaction,
    close_interaction,
    update_bank_slots
  }
}
