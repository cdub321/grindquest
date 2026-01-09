import { supabase } from '../lib/supabaseClient'

/**
 * Player storage service - handles authentication and character data
 * All functions use snake_case naming and return snake_case field names matching schema
 */

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{data: object, error: object}>} Supabase auth response
 */
export async function sign_up(email, password) {
  try {
    return await supabase.auth.signUp({ email, password })
  } catch (error) {
    console.error('Error in sign_up:', error)
    throw error
  }
}

/**
 * Sign in an existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{data: object, error: object}>} Supabase auth response
 */
export async function sign_in(email, password) {
  try {
    return await supabase.auth.signInWithPassword({ email, password })
  } catch (error) {
    console.error('Error in sign_in:', error)
    throw error
  }
}

/**
 * Sign out the current user
 * @returns {Promise<{error: object}>} Supabase auth response
 */
export async function sign_out() {
  try {
    return await supabase.auth.signOut()
  } catch (error) {
    console.error('Error in sign_out:', error)
    throw error
  }
}

/**
 * Get the current session
 * @returns {Promise<{data: {session: object}, error: object}>} Supabase auth response
 */
export async function get_session() {
  try {
    return await supabase.auth.getSession()
  } catch (error) {
    console.error('Error in get_session:', error)
    throw error
  }
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Callback function (event, session) => void
 * @returns {object} Subscription object with unsubscribe method
 */
export function on_auth_state_change(callback) {
  try {
    return supabase.auth.onAuthStateChange(callback)
  } catch (error) {
    console.error('Error in on_auth_state_change:', error)
    throw error
  }
}

/**
 * Fetch all characters for a user
 * @param {string} user_id - User UUID
 * @returns {Promise<Array>} Array of character objects with snake_case fields
 */
export async function fetch_characters(user_id) {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('id, name, class_id, race_id, deity_id, level, xp, xp_mod, zone_id, bind_zone_id, bind_camp_id, created_at, mode, str_base, sta_base, agi_base, dex_base, int_base, wis_base, cha_base, base_hp, base_mana, base_endurance, killed_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in fetch_characters:', error)
    throw error
  }
}

/**
 * Fetch a single character by ID
 * @param {string} character_id - Character UUID
 * @returns {Promise<object>} Character object with snake_case fields
 */
export async function fetch_character(character_id) {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', character_id)
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in fetch_character:', error)
    throw error
  }
}

/**
 * Fetch inventory rows for a character
 * @param {string} character_id - Character UUID
 * @returns {Promise<Array>} Array of inventory row objects with snake_case fields
 */
export async function fetch_inventory(character_id) {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, slot_id, base_item_id, quantity, item_data, created_at')
      .eq('character_id', character_id)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in fetch_inventory:', error)
    throw error
  }
}

/**
 * Fetch character spells for a character
 * @param {string} character_id - Character UUID
 * @returns {Promise<Array>} Array of character spell objects with snake_case fields
 */
export async function fetch_character_spells(character_id) {
  try {
    const { data, error } = await supabase
      .from('character_spells')
      .select('spell_id, ability_slot, spell_slot, rank, learned_at')
      .eq('character_id', character_id)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in fetch_character_spells:', error)
    throw error
  }
}

/**
 * Create a new character
 * @param {string} user_id - User UUID
 * @param {object} payload - Character data (all snake_case fields)
 * @returns {Promise<object>} Created character object with snake_case fields
 */
export async function create_character(user_id, payload) {
  try {
    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: user_id,
        name: payload.name,
        class_id: payload.class_id,
        race_id: payload.race_id,
        deity_id: payload.deity_id,
        level: 1,
        xp: 0,
        xp_mod: payload.xp_mod ?? 100,
        zone_id: payload.zone_id,
        bind_zone_id: payload.bind_zone_id || payload.zone_id,
        bind_camp_id: payload.bind_camp_id,
        current_camp_id: payload.current_camp_id || null,
        mode: payload.mode || false,
        str_base: payload.str_base || 0,
        sta_base: payload.sta_base || 0,
        agi_base: payload.agi_base || 0,
        dex_base: payload.dex_base || 0,
        int_base: payload.int_base || 0,
        wis_base: payload.wis_base || 0,
        cha_base: payload.cha_base || 0,
        base_hp: payload.base_hp || 0,
        base_mana: payload.base_mana || 0,
        base_endurance: payload.base_endurance || 0,
        resource_type: payload.resource_type || 'melee',
        current_hp: payload.current_hp || payload.base_hp || 0,
        current_mana: payload.current_mana || payload.base_mana || 0,
        current_endurance: payload.current_endurance || payload.base_endurance || 0
      })
      .select('*')
      .single()
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in create_character:', error)
    throw error
  }
}

/**
 * Delete a character
 * @param {string} user_id - User UUID
 * @param {string} character_id - Character UUID
 * @returns {Promise<void>}
 */
export async function delete_character(user_id, character_id) {
  try {
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', character_id)
      .eq('user_id', user_id)
    
    if (error) throw error
  } catch (error) {
    console.error('Error in delete_character:', error)
    throw error
  }
}

/**
 * Save character data
 * @param {string} character_id - Character UUID
 * @param {object} payload - Character data to update (all snake_case fields)
 * @returns {Promise<void>}
 */
export async function save_character(character_id, payload) {
  try {
    const { error } = await supabase
      .from('characters')
      .update(payload)
      .eq('id', character_id)
    
    if (error) throw error
  } catch (error) {
    console.error('Error in save_character:', error)
    throw error
  }
}

/**
 * Save inventory to database
 * @param {string} character_id - Character UUID
 * @param {Array} inventory_rows - Array of inventory row objects with snake_case fields
 * @returns {Promise<void>}
 */
export async function save_inventory(character_id, inventory_rows) {
  try {
    // Use RPC function instead of direct database access
    const payload = (inventory_rows || []).map((row) => ({
      slot_id: row.slot_id || null,
      base_item_id: row.base_item_id || 0,
      quantity: row.quantity || 1,
      item_data: row.item_data || null
    }))

    const { error } = await supabase.rpc('rpc_save_inventory', {
      p_character_id: character_id,
      p_inventory_rows: payload
    })

    if (error) throw error
  } catch (error) {
    console.error('Error in save_inventory:', error)
    throw error
  }
}

/**
 * Fetch bank inventory for a character
 * @param {string} character_id - Character UUID
 * @returns {Promise<Array>} Array of bank inventory rows with snake_case fields
 */
export async function fetch_bank(character_id) {
  try {
    const { data, error } = await supabase
      .from('bank_inventory')
      .select('id, base_item_id, quantity, slot_id, updated_at')
      .eq('character_id', character_id)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in fetch_bank:', error)
    throw error
  }
}

/**
 * Save bank inventory for a character
 * @param {string} character_id - Character UUID
 * @param {Array} bank_rows - Array of bank row objects { id?, base_item_id, quantity, slot_id? }
 * @returns {Promise<void>}
 */
export async function save_bank(character_id, bank_rows) {
  try {
    // Use RPC function instead of direct database access
    const payload = (bank_rows || []).map((row) => ({
      base_item_id: row.base_item_id,
      quantity: row.quantity || 1,
      slot_id: row.slot_id || null
    }))

    const { error } = await supabase.rpc('rpc_save_bank', {
      p_character_id: character_id,
      p_bank_rows: payload
    })

    if (error) throw error
  } catch (error) {
    console.error('Error in save_bank:', error)
    throw error
  }
}

/**
 * Update merchant stock in merchant_items table
 * @param {number|string} merchant_id - Merchant ID (merch_id)
 * @param {number} item_id - Item ID
 * @param {number} stock_change - Change in stock quantity (positive for increase, negative for decrease)
 * @param {number} weight_change - Change in weight
 * @param {number} base_price - Base price to update
 * @returns {Promise<void>}
 */
export async function update_merchant_stock(merchant_id, item_id, stock_change, weight_change, base_price) {
  try {
    const { error } = await supabase.rpc('rpc_update_merchant_stock', {
      p_merch_id: merchant_id,
      p_item_id: item_id,
      p_stock_change: stock_change,
      p_weight_change: weight_change,
      p_price: base_price
    })
    if (error) throw error
  } catch (error) {
    console.error('Error in update_merchant_stock:', error)
    throw error
  }
}

/**
 * Learn a new spell (insert into character_spells table)
 * @param {string} character_id - Character UUID
 * @param {number} spell_id - Spell ID from spells_import
 * @returns {Promise<object>} Inserted character_spell row
 */
export async function learn_spell(character_id, spell_id) {
  try {
    // Use RPC function with server-side validation
    const { data, error } = await supabase.rpc('rpc_learn_spell', {
      p_character_id: character_id,
      p_spell_id: spell_id
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in learn_spell:', error)
    throw error
  }
}

/**
 * Save spell/ability slot assignments to character_spells table
 * @param {string} character_id - Character UUID
 * @param {Array} ability_slots - Array of { spell_id, ability_slot } (1-based slots, null to clear)
 * @param {Array} spell_slots - Array of { spell_id, spell_slot } (1-based slots, null to clear)
 * @returns {Promise<void>}
 */
export async function save_spell_slots(character_id, { ability_slots = [], spell_slots = [], auto_attack_slot = null, auto_cast_slot = null }) {
  try {
    // Upsert ability slots (including clears)
    const ability_payload = (ability_slots || []).filter(
      ({ spell_id, ability_slot }) => spell_id !== undefined && spell_id !== null && (ability_slot === null || (ability_slot >= 0 && ability_slot <= 6))
    ).map(({ spell_id, ability_slot }) => ({
      character_id,
      spell_id,
      ability_slot: ability_slot || null,
      spell_slot: null
    }))

    // Update ability slots (spells should already be learned, so rows exist)
    if (ability_payload.length > 0) {
      for (const payload of ability_payload) {
        const { error } = await supabase
          .from('character_spells')
          .update({
            ability_slot: payload.ability_slot,
            spell_slot: payload.spell_slot
          })
          .eq('character_id', payload.character_id)
          .eq('spell_id', payload.spell_id)
        if (error) throw error
      }
    }

    // Update spell slots (spells should already be learned, so rows exist)
    const spell_payload = (spell_slots || []).filter(
      ({ spell_id, spell_slot }) => spell_id !== undefined && spell_id !== null && (spell_slot === null || (spell_slot >= 0 && spell_slot <= 6))
    ).map(({ spell_id, spell_slot }) => ({
      character_id,
      spell_id,
      ability_slot: null,
      spell_slot: spell_slot || null
    }))

    if (spell_payload.length > 0) {
      for (const payload of spell_payload) {
        const { error } = await supabase
          .from('character_spells')
          .update({
            ability_slot: payload.ability_slot,
            spell_slot: payload.spell_slot
          })
          .eq('character_id', payload.character_id)
          .eq('spell_id', payload.spell_id)
        if (error) throw error
      }
    }

    // Persist auto slots on character
    if (auto_attack_slot !== null || auto_cast_slot !== null) {
      const character_update = {}
      if (auto_attack_slot !== null) character_update.auto_attack_slot = auto_attack_slot
      if (auto_cast_slot !== null) character_update.auto_cast_slot = auto_cast_slot
      const { error } = await supabase
        .from('characters')
        .update(character_update)
        .eq('id', character_id)
      if (error) throw error
    }
  } catch (error) {
    console.error('Error in save_spell_slots:', error)
    throw error
  }
}

/**
 * Fetch leaderboard characters with optional filters
 * @param {object} options - Filter options
 * @param {string} options.mode - 'hardcore' or 'normal' (or null for all)
 * @param {number} options.classId - Optional class filter
 * @param {number} options.raceId - Optional race filter
 * @param {number} options.deityId - Optional deity filter
 * @param {number} options.limit - Maximum number of results (default: 20)
 * @returns {Promise<Array>} Array of character objects sorted by level/XP
 */
export async function fetchLeaderboardCharacters({ mode = null, classId = null, raceId = null, deityId = null, limit = 20 }) {
  try {
    let query = supabase
      .from('characters')
      .select('id, name, class_id, race_id, deity_id, level, xp, killed_at, created_at')
    
    // Filter by mode (hardcore = true, normal = false)
    if (mode === 'hardcore') {
      query = query.eq('mode', true)
    } else if (mode === 'normal') {
      query = query.eq('mode', false)
    }
    
    // Filter by class
    if (classId) {
      query = query.eq('class_id', classId)
    }
    
    // Filter by race
    if (raceId) {
      query = query.eq('race_id', raceId)
    }
    
    // Filter by deity
    if (deityId) {
      query = query.eq('deity_id', deityId)
    }
    
    // Sort by level (desc), then XP (desc), then created_at (asc for tiebreaker)
    const { data, error } = await query
      .order('level', { ascending: false })
      .order('xp', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error in fetchLeaderboardCharacters:', error)
    throw error
  }
}
