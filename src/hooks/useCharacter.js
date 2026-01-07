import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { save_character, save_inventory, learn_spell } from '../services/playerStorage'
import { serialize_inventory_to_db } from '../services/inventoryManager'
import { calculate_total_bonuses, calculate_stat_totals, calculate_derived_stats, calculate_display_bonuses } from '../utils/statsCalculator'
import { fetch_spells_learnable_at_level } from '../services/referenceData'
import { CARRY_START } from '../services/inventoryManager'
import { XP_BASE } from '../utils/gameConstants'
import { currency_to_silver, silver_to_currency } from '../utils/currencyUtils'

/**
 * Hook to manage character state, stats, vitals, and progression
 * @param {Object} character_data - Initial character data from useCharacterLoader
 * @param {Object} player_class - Class data from referenceData.fetch_class (optional, can be loaded separately)
 * @param {Function} get_stat_modifiers - Function from useEffects to get effect modifiers (optional)
 * @param {Function} add_log - Logging function (optional)
 * @param {Function} on_return_to_character_select - Callback for hardcore death (optional)
 * @param {Function} on_spells_learned - Callback when new spells are learned (spells) => void (optional)
 * @returns {Object} Character state and functions
 */
export function use_character(character_data, player_class = null, get_stat_modifiers = null, add_log = null, on_return_to_character_select = null, on_spells_learned = null) {
  // State management
  const [hp, set_hp] = useState(character_data?.current_hp || 0)
  const [mana, set_mana] = useState(character_data?.current_mana || 0)
  const [endurance, set_endurance] = useState(character_data?.current_endurance || 0)
  const [level, set_level] = useState(character_data?.level || 1)
  const [xp, set_xp] = useState(character_data?.xp || 0)
  const [currency, set_currency] = useState(character_data?.currency || { platinum: 0, gold: 0, silver: 0 })
  
  // Base stats (from character_data, can be updated on level up)
  const [str_base, set_str_base] = useState(character_data?.str_base || 0)
  const [sta_base, set_sta_base] = useState(character_data?.sta_base || 0)
  const [agi_base, set_agi_base] = useState(character_data?.agi_base || 0)
  const [dex_base, set_dex_base] = useState(character_data?.dex_base || 0)
  const [int_base, set_int_base] = useState(character_data?.int_base || 0)
  const [wis_base, set_wis_base] = useState(character_data?.wis_base || 0)
  const [cha_base, set_cha_base] = useState(character_data?.cha_base || 0)
  
  // Base vitals (from character_data, can be updated on level up)
  const [base_hp, set_base_hp] = useState(character_data?.base_hp || 0)
  const [base_mana, set_base_mana] = useState(character_data?.base_mana || 0)
  const [base_endurance, set_base_endurance] = useState(character_data?.base_endurance || 0)
  
  // Base regen rates (from character_data)
  const base_hp_regen = character_data?.base_hp_regen || 0
  const base_mana_regen = character_data?.base_mana_regen || 0
  const base_end_regen = character_data?.base_end_regen || 0
  
  // Refs for save debouncing
  const save_timeout_ref = useRef(null)
  const slots_ref = useRef(character_data?.slots || [])
  const just_loaded_ref = useRef(true)
  
  // Update slots ref when character_data changes
  useEffect(() => {
    if (character_data?.slots) {
      slots_ref.current = character_data.slots
    }
  }, [character_data?.slots])
  
  // Initialize state from character_data when it loads
  useEffect(() => {
    if (!character_data) return
    
    if (just_loaded_ref.current) {
      set_hp(character_data.current_hp || character_data.base_hp || 0)
      set_mana(character_data.current_mana || character_data.base_mana || 0)
      set_endurance(character_data.current_endurance || character_data.base_endurance || 0)
      set_level(character_data.level || 1)
      set_xp(character_data.xp || 0)
      set_currency(character_data.currency || { platinum: 0, gold: 0, silver: 0 })
      set_str_base(character_data.str_base || 0)
      set_sta_base(character_data.sta_base || 0)
      set_agi_base(character_data.agi_base || 0)
      set_dex_base(character_data.dex_base || 0)
      set_int_base(character_data.int_base || 0)
      set_wis_base(character_data.wis_base || 0)
      set_cha_base(character_data.cha_base || 0)
      set_base_hp(character_data.base_hp || 0)
      set_base_mana(character_data.base_mana || 0)
      set_base_endurance(character_data.base_endurance || 0)
      just_loaded_ref.current = false
    }
  }, [character_data])
  
  // Calculate gear bonuses from equipped items
  const total_bonuses = useMemo(() => {
    return calculate_total_bonuses(slots_ref.current, CARRY_START)
  }, [slots_ref.current])
  
  // Calculate base stat totals (base stats + gear bonuses)
  const base_stat_totals = useMemo(() => {
    return calculate_stat_totals({
      str_base,
      sta_base,
      agi_base,
      dex_base,
      int_base,
      wis_base,
      cha_base
    }, total_bonuses)
  }, [str_base, sta_base, agi_base, dex_base, int_base, wis_base, cha_base, total_bonuses])
  
  // Calculate final stat totals (base + gear + effects)
  const stat_totals = useMemo(() => {
    if (!get_stat_modifiers) {
      return base_stat_totals
    }
    const mods = get_stat_modifiers('player') || {}
    return {
      str: (base_stat_totals.str || 0) + (mods.str || 0),
      sta: (base_stat_totals.sta || 0) + (mods.sta || 0),
      agi: (base_stat_totals.agi || 0) + (mods.agi || 0),
      dex: (base_stat_totals.dex || 0) + (mods.dex || 0),
      int: (base_stat_totals.int || 0) + (mods.int || 0),
      wis: (base_stat_totals.wis || 0) + (mods.wis || 0),
      cha: (base_stat_totals.cha || 0) + (mods.cha || 0),
      ac: (base_stat_totals.ac || 0) + (mods.ac || 0),
      hp: (base_stat_totals.hp || 0),
      mana: (base_stat_totals.mana || 0),
      endurance: (base_stat_totals.endurance || 0),
      mr: (base_stat_totals.mr || 0) + (mods.mr || 0),
      dr: (base_stat_totals.dr || 0) + (mods.dr || 0),
      fr: (base_stat_totals.fr || 0) + (mods.fr || 0),
      cr: (base_stat_totals.cr || 0) + (mods.cr || 0),
      pr: (base_stat_totals.pr || 0) + (mods.pr || 0),
      damage: (base_stat_totals.damage || 0),
      mod_max_hp: (mods.mod_max_hp || 0),
      mod_max_mana: (mods.mod_max_mana || 0),
      mod_max_endurance: (mods.mod_max_endurance || 0),
      hp_regen: (base_stat_totals.hp_regen || 0) + (mods.mod_hp_regen || 0),
      mana_regen: (base_stat_totals.mana_regen || 0) + (mods.mod_mana_regen || 0),
      endurance_regen: (base_stat_totals.endurance_regen || 0) + (mods.mod_endurance_regen || 0)
    }
  }, [base_stat_totals, get_stat_modifiers])
  
  // Calculate derived stats
  const derived_stats = useMemo(() => {
    if (!player_class) {
      return {
        min_damage: 0,
        max_damage: 0,
        attack_delay: 0,
        carry_cap: 0,
        spell_dmg_mod: 0,
        heal_mod: 0,
        xp_bonus: 0
      }
    }
    return calculate_derived_stats({
      player_class,
      level,
      total_bonuses,
      stat_totals
    })
  }, [player_class, level, total_bonuses, stat_totals])
  
  // Calculate max vitals
  const max_hp = useMemo(() => {
    const str_bonus = Math.round((stat_totals.str * 0.1 * level) / 10) * 10
    return base_hp + str_bonus + (stat_totals.mod_max_hp || 0)
  }, [base_hp, stat_totals, level])
  
  const max_mana = useMemo(() => {
    const int_bonus = Math.round((stat_totals.int * 0.1 * level) / 10) * 10
    const wis_bonus = Math.round((stat_totals.wis * 0.1 * level) / 10) * 10
    return base_mana + int_bonus + wis_bonus + (stat_totals.mod_max_mana || 0)
  }, [base_mana, stat_totals, level])
  
  const max_endurance = useMemo(() => {
    const sta_bonus = Math.round((stat_totals.sta * 0.1 * level) / 10) * 10
    return base_endurance + sta_bonus + (stat_totals.mod_max_endurance || 0)
  }, [base_endurance, stat_totals, level])
  
  // Schedule save with debouncing
  const schedule_save = useCallback((payload, opts = {}) => {
    const { immediate = false } = opts
    if (!character_data?.id) return
    
    const perform_save = async () => {
      try {
        if (payload.character) {
          await save_character(character_data.id, payload.character)
        }
        if (payload.inventory) {
          const inventory_rows = serialize_inventory_to_db(slots_ref.current, character_data.id)
          await save_inventory(character_data.id, inventory_rows)
        }
      } catch (err) {
        console.error('Save failed:', err)
        if (add_log) {
          add_log('Save failed. Check connection.', 'error')
        }
      }
    }
    
    if (immediate) {
      return perform_save()
    }
    
    if (save_timeout_ref.current) {
      clearTimeout(save_timeout_ref.current)
    }
    save_timeout_ref.current = setTimeout(perform_save, 500)
  }, [character_data?.id, add_log])
  
  // Save vitals immediately when they change (prevents refresh exploit)
  const vitals_save_timeout_ref = useRef(null)
  useEffect(() => {
    if (!character_data?.id) return
    if (just_loaded_ref.current) return // Don't save on initial load
    
    // Clear any pending save
    if (vitals_save_timeout_ref.current) {
      clearTimeout(vitals_save_timeout_ref.current)
    }
    
    // Save immediately (with tiny debounce to batch rapid changes)
    vitals_save_timeout_ref.current = setTimeout(() => {
      schedule_save({
        character: {
          current_hp: hp,
          current_mana: mana,
          current_endurance: endurance
        }
      }, { immediate: true })
    }, 100) // 100ms debounce to batch rapid changes
    
    return () => {
      if (vitals_save_timeout_ref.current) {
        clearTimeout(vitals_save_timeout_ref.current)
      }
    }
  }, [hp, mana, endurance, character_data?.id, schedule_save])
  
  // Handle level up
  const handle_level_up = useCallback(async () => {
    if (!player_class || !character_data?.id || !character_data?.class_id) return
    
    let next_xp = xp
    let next_level = level
    let level_ups = 0
    const levels_gained = []
    
    // Process all level ups
    while (next_xp >= XP_BASE * next_level) {
      next_xp -= XP_BASE * next_level
      next_level += 1
      level_ups += 1
      levels_gained.push(next_level)
      if (add_log) {
        add_log(`You have gained a level! You are now level ${next_level}!`, 'levelup')
      }
    }
    
    if (level_ups === 0) return
    
    // Apply stat growth
    const growth = player_class.stat_growth || {}
    const delta_stats = {
      str: (growth.str || 0) * level_ups,
      sta: (growth.sta || 0) * level_ups,
      agi: (growth.agi || 0) * level_ups,
      dex: (growth.dex || 0) * level_ups,
      int: (growth.int || 0) * level_ups,
      wis: (growth.wis || 0) * level_ups,
      cha: (growth.cha || 0) * level_ups
    }
    
    set_str_base(prev => prev + delta_stats.str)
    set_sta_base(prev => prev + delta_stats.sta)
    set_agi_base(prev => prev + delta_stats.agi)
    set_dex_base(prev => prev + delta_stats.dex)
    set_int_base(prev => prev + delta_stats.int)
    set_wis_base(prev => prev + delta_stats.wis)
    set_cha_base(prev => prev + delta_stats.cha)
    
    // Apply vitals growth
    const vitals_delta = {
      hp: (player_class.hp_per_level || 0) * level_ups,
      mana: (player_class.mana_per_level || 0) * level_ups,
      endurance: (player_class.endurance_per_level || 0) * level_ups
    }
    
    set_base_hp(prev => prev + vitals_delta.hp)
    set_base_mana(prev => prev + vitals_delta.mana)
    set_base_endurance(prev => prev + vitals_delta.endurance)
    
    // Update level and XP
    set_level(next_level)
    set_xp(next_xp)
    
    // Learn new spells for each level gained
    const learned_spells = []
    try {
      for (const gained_level of levels_gained) {
        const learnable_spells = await fetch_spells_learnable_at_level(character_data.class_id, gained_level)
        
        for (const spell of learnable_spells) {
          try {
            await learn_spell(character_data.id, spell.id)
            learned_spells.push(spell)
            if (add_log) {
              add_log(`You have learned: ${spell.name || `Spell ${spell.id}`}!`, 'spell')
            }
          } catch (err) {
            // Spell already learned, skip
            if (err.code !== '23505') {
              console.error(`Failed to learn spell ${spell.id}:`, err)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error learning spells on level up:', err)
      if (add_log) {
        add_log('Failed to learn new spells.', 'error')
      }
    }
    
    // Notify parent of learned spells
    if (learned_spells.length > 0 && on_spells_learned) {
      on_spells_learned(learned_spells)
    }
    
    // Save immediately
    schedule_save({
      character: {
        level: next_level,
        xp: next_xp,
        str_base: str_base + delta_stats.str,
        sta_base: sta_base + delta_stats.sta,
        agi_base: agi_base + delta_stats.agi,
        dex_base: dex_base + delta_stats.dex,
        int_base: int_base + delta_stats.int,
        wis_base: wis_base + delta_stats.wis,
        cha_base: cha_base + delta_stats.cha,
        base_hp: base_hp + vitals_delta.hp,
        base_mana: base_mana + vitals_delta.mana,
        base_endurance: base_endurance + vitals_delta.endurance,
        currency
      }
    }, { immediate: true })
  }, [xp, level, player_class, character_data, str_base, sta_base, agi_base, dex_base, int_base, wis_base, cha_base, base_hp, base_mana, base_endurance, currency, schedule_save, add_log, on_spells_learned])
  
  // Check for level up when XP changes
  useEffect(() => {
    if (xp >= XP_BASE * level) {
      handle_level_up()
    }
  }, [xp, level, handle_level_up])
  
  // Handle death
  const handle_death = useCallback((killer_name = 'an enemy') => {
    const is_hardcore = character_data?.mode === true // mode is boolean, true = hardcore
    
    if (is_hardcore) {
      // Hardcore: set killed_at, save, return to character select
      const killed_at_timestamp = new Date().toISOString()
      
      schedule_save({
        character: {
          killed_at: killed_at_timestamp
        },
        inventory: true
      }, { immediate: true })
      
      if (on_return_to_character_select) {
        setTimeout(() => {
          on_return_to_character_select()
        }, 2000)
      }
      
      return {
        should_respawn: false,
        is_hardcore_dead: true,
        killed_at: killed_at_timestamp,
        killer_name
      }
    }
    
    // Normal mode: apply XP loss and respawn
    if (!character_data?.bind_zone_id) {
      throw new Error('bind_zone_id missing for death handling.')
    }
    if (!character_data?.bind_camp_id) {
      throw new Error('bind_camp_id missing for death handling.')
    }
    
    const loss_pct = Math.min(1, level / 100)
    const xp_loss = Math.ceil((XP_BASE * level) * loss_pct)
    const new_xp = Math.max(0, xp - xp_loss)
    
    set_xp(new_xp)
    set_hp(max_hp)
    set_mana(max_mana)
    set_endurance(max_endurance)
    
    schedule_save({
      character: {
        level,
        xp: new_xp,
        zone_id: character_data.bind_zone_id,
        current_hp: max_hp,
        current_mana: max_mana,
        current_endurance: max_endurance,
        currency
      },
      inventory: true
    }, { immediate: true })
    
    return {
      should_respawn: true,
      return_zone: character_data.bind_zone_id,
      return_camp: character_data.bind_camp_id,
      xp_loss,
      killer_name
    }
  }, [character_data?.mode, character_data?.bind_zone_id, character_data?.bind_camp_id, level, xp, max_hp, max_mana, max_endurance, currency, schedule_save, on_return_to_character_select])
  
  /**
   * Add XP and save immediately to database
   */
  const add_xp = useCallback((xp_gain) => {
    if (!xp_gain || xp_gain <= 0) return;
    
    // Calculate new XP value
    const new_xp = xp + xp_gain;
    
    // Update state
    set_xp(new_xp);
    
    // Save immediately to database
    schedule_save({
      character: {
        xp: new_xp
      }
    }, { immediate: true });
  }, [xp, schedule_save]);
  
  /**
   * Add currency (platinum/gold/silver) and save immediately
   */
  const add_currency = useCallback((currency_delta) => {
    if (!currency_delta) return;
    const delta_silver = currency_to_silver(currency_delta);
    if (!delta_silver) return;
    
    const total_silver = currency_to_silver(currency) + delta_silver;
    const new_currency = silver_to_currency(total_silver);
    
    set_currency(new_currency);
    
    schedule_save({
      character: {
        currency: new_currency
      }
    }, { immediate: true });
  }, [currency, schedule_save]);

  const get_hp_regen_rate = useCallback((in_combat, is_sitting, is_flee_exhausted) => {
    let rate = base_hp_regen + (in_combat ? 1 : 3)
    if (is_flee_exhausted) rate *= 0.5
    if (is_sitting && !in_combat) rate *= 2
    rate += stat_totals.hp_regen || 0
    return Math.max(0, rate)
  }, [base_hp_regen, stat_totals.hp_regen])
  
  const get_mana_regen_rate = useCallback((in_combat, is_sitting, is_flee_exhausted) => {
    let rate = base_mana_regen + (in_combat ? 1 : 3)
    if (is_flee_exhausted) rate *= 0.5
    if (is_sitting && !in_combat) rate *= 2
    rate += stat_totals.mana_regen || 0
    return Math.max(0, rate)
  }, [base_mana_regen, stat_totals.mana_regen])
  
  const get_endurance_regen_rate = useCallback((in_combat, is_sitting, is_flee_exhausted) => {
    let rate = base_end_regen + (in_combat ? 1 : 3)
    if (is_flee_exhausted) rate *= 0.5
    if (is_sitting && !in_combat) rate *= 2
    rate += stat_totals.endurance_regen || 0
    return Math.max(0, rate)
  }, [base_end_regen, stat_totals.endurance_regen])
  
  // Display bonuses for UI
  const gear_bonuses = useMemo(() => {
    return calculate_display_bonuses(total_bonuses, stat_totals)
  }, [total_bonuses, stat_totals])
  
  return {
    // State values
    hp,
    set_hp,
    mana,
    set_mana,
    endurance,
    set_endurance,
    level,
    set_level,
    xp,
    currency,
    set_currency,
    
    // Calculated values
    max_hp,
    max_mana,
    max_endurance,
    stat_totals,
    derived_stats,
    gear_bonuses,
    
    // Regen rate getters
    get_hp_regen_rate,
    get_mana_regen_rate,
    get_endurance_regen_rate,
    
    // Functions
    handle_level_up,
    handle_death,
    schedule_save,
    add_xp,
    add_currency,
    
    // Refs (for external use)
    slots_ref
  }
}
