import { useState, useEffect } from 'react'
import { fetch_character, fetch_inventory, fetch_bank, fetch_character_spells } from '../services/playerStorage'
import { fetch_spell, fetch_zone, fetch_camp, fetch_item } from '../services/referenceData'
import { deserialize_inventory_from_db } from '../services/inventoryManager'

/**
 * Hook to load a character and all associated data from the database
 * @param {string} character_id - Character UUID
 * @returns {object} { loading, error, character_data }
 */
export function use_character_loader(character_id) {
  const [loading, set_loading] = useState(true)
  const [error, set_error] = useState(null)
  const [character_data, set_character_data] = useState(null)

  useEffect(() => {
    if (!character_id) {
      set_loading(false)
      set_character_data(null)
      return
    }

    let is_cancelled = false

    const load_character = async () => {
      try {
        set_loading(true)
        set_error(null)

        // Load character data
        const character = await fetch_character(character_id)
        if (is_cancelled) return

        // Load inventory
        const inventory_rows = await fetch_inventory(character_id)
        if (is_cancelled) return

        // Deserialize inventory to slots array
        const slots = deserialize_inventory_from_db(inventory_rows)
        
        // Enrich items with base item data (name, icon_index, etc.)
        const enriched_slots = await Promise.all(
          slots.map(async (slot) => {
            if (!slot || !slot.base_item_id) return slot
            
            try {
              const base_item = await fetch_item(slot.base_item_id)
              return {
                ...slot,
                name: base_item.name,
                icon_index: base_item.icon_index,
                stackable: base_item.stackable,
                max_stack: base_item.max_stack,
                slots: base_item.slots,
                bag_slots: base_item.bag_slots,
                bonuses: base_item.bonuses,
                contents: base_item.bag_slots > 0 
                  ? (slot.contents && Array.isArray(slot.contents) && slot.contents.length > 0
                      ? await Promise.all(
                          slot.contents.map(async (bag_item) => {
                            if (!bag_item || !bag_item.base_item_id) return bag_item
                            try {
                              const bag_base_item = await fetch_item(bag_item.base_item_id)
                              return {
                                ...bag_item,
                                name: bag_base_item.name,
                                icon_index: bag_base_item.icon_index,
                                stackable: bag_base_item.stackable,
                                max_stack: bag_base_item.max_stack,
                                slots: bag_base_item.slots,
                                bonuses: bag_base_item.bonuses
                              }
                            } catch (err) {
                              console.error(`Failed to fetch bag item ${bag_item.base_item_id}:`, err)
                              return bag_item
                            }
                          })
                        )
                      : Array(base_item.bag_slots).fill(null))
                  : null
              }
            } catch (err) {
              console.error(`Failed to fetch item ${slot.base_item_id}:`, err)
              return slot
            }
          })
        )
        
        // Load bank
        const bank_rows = await fetch_bank(character_id)
        if (is_cancelled) return

        // Load character spells
        const spell_rows = await fetch_character_spells(character_id)
        if (is_cancelled) return

        // Load full spell data for each learned spell
        const known_spells = await Promise.all(
          spell_rows.map(async (row) => {
            try {
              const spell_data = await fetch_spell(row.spell_id)
              // Normalize spell data - ensure consistent field names
              return {
                spell_id: row.spell_id,
                ability_slot: row.ability_slot,
                spell_slot: row.spell_slot,
                rank: row.rank,
                learned_at: row.learned_at,
                ...spell_data,
                // Normalize icon field - use new_icon from DB as icon_index
                icon_index: spell_data.new_icon || null,
                // Add skill_type if not present (defaults to 'spell' in DB)
                skill_type: spell_data.skill_type || 'spell'
              }
            } catch (err) {
              console.error(`Failed to fetch spell ${row.spell_id}:`, err)
              return null
            }
          })
        )
        const valid_spells = known_spells.filter(Boolean)

        // Parse active effects from JSONB
        const active_effects = character.active_effects || []
        const now_ms = Date.now()
        const restored_effects = active_effects
          .filter((effect) => {
            // Filter out expired effects
            if (!effect.expires_at) return false
            const expires_ms = new Date(effect.expires_at).getTime()
            return expires_ms > now_ms
          })
          .map((effect) => {
            // Convert ISO timestamp to milliseconds for runtime
            const expires_ms = new Date(effect.expires_at).getTime()
            const remaining_ms = expires_ms - now_ms
            return {
              ...effect,
              expires_at_ms: expires_ms,
              remaining_ms: remaining_ms
            }
          })

        // Parse cooldowns from JSONB
        const cooldowns = character.cooldowns || {}
        const cooldowns_ms = Object.fromEntries(
          Object.entries(cooldowns).map(([spell_id, iso_timestamp]) => {
            if (!iso_timestamp) return [spell_id, null]
            return [spell_id, new Date(iso_timestamp).getTime()]
          })
        )

        // Parse currency from JSONB
        const currency = character.currency || { platinum: 0, gold: 0, silver: 0 }

        // Current mob - cleared on load (combat state reset)
        const current_mob = null

        // Load zone and camp data
        let current_zone = null
        let current_camp = null
        if (character.zone_id) {
          try {
            current_zone = await fetch_zone(character.zone_id)
          } catch (err) {
            console.error(`Failed to fetch zone ${character.zone_id}:`, err)
          }
        }
        if (character.current_camp_id) {
          try {
            current_camp = await fetch_camp(character.current_camp_id)
          } catch (err) {
            console.error(`Failed to fetch camp ${character.current_camp_id}:`, err)
          }
        }

        // Normalize character data
        const normalized = {
          // Character basic info
          id: character.id,
          user_id: character.user_id,
          name: character.name,
          class_id: character.class_id,
          race_id: character.race_id,
          deity_id: character.deity_id,
          level: character.level,
          xp: character.xp,
          xp_mod: character.xp_mod || 100,
          zone_id: character.zone_id,
          bind_zone_id: character.bind_zone_id,
          bind_camp_id: character.bind_camp_id,
          current_camp_id: character.current_camp_id,
          mode: character.mode,
          killed_at: character.killed_at,

          // Base stats
          str_base: character.str_base || 0,
          sta_base: character.sta_base || 0,
          agi_base: character.agi_base || 0,
          dex_base: character.dex_base || 0,
          int_base: character.int_base || 0,
          wis_base: character.wis_base || 0,
          cha_base: character.cha_base || 0,

          // Base vitals
          base_hp: character.base_hp || 0,
          base_mana: character.base_mana || 0,
          base_endurance: character.base_endurance || 0,

          // Base regen rates
          base_hp_regen: character.base_hp_regen || 0,
          base_mana_regen: character.base_mana_regen || 0,
          base_end_regen: character.base_end_regen || 0,

          // Resource type
          resource_type: character.resource_type || 'melee',

          // Current vitals
          current_hp: character.current_hp || character.base_hp || 0,
          current_mana: character.current_mana || character.base_mana || 0,
          current_endurance: character.current_endurance || character.base_endurance || 0,

          // Inventory
          slots: enriched_slots,
          bank_rows: bank_rows,

          // Spells
          known_spells: valid_spells,

          // Effects and cooldowns
          active_effects: restored_effects,
          cooldowns: cooldowns_ms,

          // Currency
          currency: currency,

          // Combat state (cleared on load)
          current_mob: current_mob,
          in_combat: false,

          // Zone and camp data
          current_zone: current_zone,
          current_camp: current_camp,
          
          // Mechanics slots
          auto_cast_slot: character.auto_cast_slot || null,
          auto_attack_slot: character.auto_attack_slot || null
        }

        if (!is_cancelled) {
          set_character_data(normalized)
          set_loading(false)
        }
      } catch (err) {
        console.error('Error loading character:', err)
        if (!is_cancelled) {
          set_error(err)
          set_loading(false)
        }
      }
    }

    load_character()

    return () => {
      is_cancelled = true
    }
  }, [character_id])

  return { loading, error, character_data }
}

