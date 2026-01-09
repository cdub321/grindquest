import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { get_camp_distance, get_camp_zone_connections } from '../utils/zoneUtils'
import { normalize_mob } from '../utils/mobUtils'
import { get_interaction_type_from_content_flags } from '../utils/npcUtils'
import { fetch_camps_by_zone, fetch_zone } from '../services/referenceData'

/**
 * Hook to manage zone and camp navigation
 * @param {string} current_zone_id - Current zone ID from useCharacter
 * @param {number} current_camp_id - Current camp ID from useCharacter
 * @param {Object} current_zone - Zone data object (from useCharacterLoader)
 * @param {Object} current_camp - Camp data object (from useCharacterLoader)
 * @param {Array} camps_by_zone - Array of camps in current zone
 * @param {Object} camp_members - Map of camp_id -> Array of mob objects (parent must merge camp_members with mob_templates before passing)
 * @param {Function} set_zone_id - Function to update zone_id (from useCharacter or parent)
 * @param {Function} set_camp_id - Function to update current_camp_id (from useCharacter or parent)
 * @param {Function} schedule_save - Save function from useCharacter
 * @param {Function} has_key_item - Function to check if player has key item (from useInventory)
 * @param {Function} is_invisible - Function to check if player is invisible (from useEffects)
 * @param {Function} get_stat_modifiers - Function to get stat modifiers (from useEffects)
 * @param {Function} on_ambush - Callback when ambushed (mob) => void
 * @param {Function} add_log - Logging function (optional)
 * @param {Function} is_casting - Function to check if casting (optional)
 * @param {Function} in_combat - Function to check if in combat (optional, for travel validation)
 * @param {Function} set_current_mob - Function to set current mob (from GameScreen)
 * @param {Object} current_mob_ref - Shared ref for current mob (from GameScreen, synced with state)
 * @param {Object|null} current_mob - Current mob state (from GameScreen, for useEffect dependencies)
 * @param {Function} set_mob_hp - Function to set mob HP (from GameScreen)
 * @param {Function} set_mob_mana - Function to set mob mana (from GameScreen)
 * @param {Function} set_mob_endurance - Function to set mob endurance (from GameScreen)
 * @param {Function} set_mob_distance - Function to set mob distance (from GameScreen)
 * @param {Function} on_merchant_banker_spawn - Callback when merchant/banker spawns (mob) => void
 * @returns {Object} Zone state and functions
 */
export function use_zone(
  current_zone_id,
  current_camp_id,
  current_zone,
  current_camp,
  camps_by_zone = [],
  camp_members = {},
  set_zone_id,
  set_camp_id,
  schedule_save,
  has_key_item = () => false,
  is_invisible = () => false,
  get_stat_modifiers = null,
  on_ambush = null,
  add_log = null,
  is_casting = () => false,
  in_combat = () => false,
  set_current_mob = null,
  current_mob_ref = null,
  current_mob = null,
  set_mob_hp = null,
  set_mob_mana = null,
  set_mob_endurance = null,
  set_mob_distance = null,
  on_merchant_banker_spawn = null,
  zone_connections = [] // Array of {from_zone, to_zone} for current zone
) {
  // Travel state (transient UI state)
  const [is_traveling, set_is_traveling] = useState(false)
  const [travel_remaining, set_travel_remaining] = useState(0)
  const [travel_initial_distance, set_travel_initial_distance] = useState(0)
  const [travel_target_camp_name, set_travel_target_camp_name] = useState(null)
  const travel_timer_ref = useRef(null)
  const travel_target_ref = useRef(null)
  const travel_remaining_ref = useRef(0)
  const is_traveling_ref = useRef(false)
  
  // Mob spawning state
  const spawn_timer_ref = useRef(null)
  // current_mob_ref is now passed in from GameScreen (shared ref)
  
  // Keep ref in sync with state
  useEffect(() => {
    is_traveling_ref.current = is_traveling
  }, [is_traveling])
  
  // Calculate available zones (current + connections from zone_connections table, filtered by camp)
  const available_zone_ids = useMemo(() => {
    if (!current_zone_id) return []
    
    // Get camp-specific zone connections
    const camp_zone_connections = get_camp_zone_connections(current_camp, zone_connections)
    const connected_zone_ids = camp_zone_connections.map(conn => conn.to_zone)
    
    // Available zones: current zone + zones this camp can connect to
    return [current_zone_id, ...connected_zone_ids].filter(Boolean)
  }, [current_zone_id, current_camp, zone_connections])
  
  // Calculate travel distance to camp
  const get_travel_distance = useCallback((camp, zone_data) => {
    if (!zone_data || !camps_by_zone || camps_by_zone.length === 0) return 0
    return get_camp_distance(current_zone_id, camps_by_zone, zone_data.zone_area || 0)
  }, [current_zone_id, camps_by_zone])
  
  // Helper function to clear mob state
  const clear_mob_state = useCallback(() => {
    if (set_current_mob) set_current_mob(null)
    if (set_mob_hp) set_mob_hp(0)
    if (set_mob_mana) set_mob_mana(0)
    if (set_mob_endurance) set_mob_endurance(0)
    if (set_mob_distance) set_mob_distance(0)
  }, [set_current_mob, set_mob_hp, set_mob_mana, set_mob_endurance, set_mob_distance])
  
  // Helper function to clear spawn timer
  const clear_spawn_timer = useCallback(() => {
    if (spawn_timer_ref.current) {
      clearTimeout(spawn_timer_ref.current)
      spawn_timer_ref.current = null
    }
  }, [])
  
  // Change camp
  const change_camp = useCallback((camp_id, zone_id_override = null, camps_override = null, zone_override = null, bypass_checks = false) => {
    if (!bypass_checks) {
      if (is_casting()) {
        if (add_log) {
          add_log('You cannot change camps while casting!', 'error')
        }
        return
      }
      if (in_combat()) {
        if (add_log) {
          add_log('You cannot change camps while in combat!', 'error')
        }
        return
      }
    }
    
    // Clear mob state when leaving camp
    clear_mob_state()
    
    // Clear any pending spawn timer from previous camp
    clear_spawn_timer()
    
    // Cancel any in-flight travel
    if (is_traveling_ref.current) {
      set_is_traveling(false)
      is_traveling_ref.current = false
      travel_target_ref.current = null
      set_travel_remaining(0)
      set_travel_initial_distance(0)
      set_travel_target_camp_name(null)
      if (travel_timer_ref.current) {
        clearTimeout(travel_timer_ref.current)
        travel_timer_ref.current = null
      }
    }
    
    const zone_key = zone_id_override || current_zone_id
    // Use camps_override if provided (for zone changes), otherwise use camps_by_zone
    const zone_camps = camps_override || camps_by_zone || []
    
    const camp = zone_camps.find((c) => `${c.id}` === `${camp_id}`)
    
    if (!camp) {
      console.error('[change_camp] Camp not found:', {
        camp_id,
        zone_key,
        available_camp_ids: zone_camps.map(c => c.id),
        available_camp_names: zone_camps.map(c => c.name)
      })
      if (add_log) {
        add_log(`Camp ${camp_id} not found in zone ${zone_key}. Available camps: ${zone_camps.map(c => `${c.name} (${c.id})`).join(', ')}`, 'error')
      }
      return
    }
    
    // Check for key item requirement
    const needs_key = camp.key_item
    if (needs_key && !has_key_item(needs_key)) {
      if (add_log) {
        add_log(`You need key item ${needs_key} to enter ${camp.name || 'this camp'}.`, 'error')
      }
      return
    }
    
    // Invisibility bypass: instant port, no ambush
    if (is_invisible()) {
      const new_camp_id = Number(camp.id)
      set_camp_id(new_camp_id)
      schedule_save({ character: { current_camp_id: new_camp_id } }, { immediate: true })
      if (add_log) {
        add_log(`You slip unseen to ${camp.name || 'camp'}.`, 'system')
      }
      return
    }
    
    // Calculate distance
    // If zone_id_override is provided (zone change), distance is 0 (instant teleport)
    // Otherwise, calculate distance normally
    const distance = zone_id_override ? 0 : get_travel_distance(camp, current_zone)
    
    if (distance <= 0) {
      // Instant arrival
      const new_camp_id = Number(camp.id)
      set_camp_id(new_camp_id)
      schedule_save({ character: { current_camp_id: new_camp_id } }, { immediate: true })
      if (add_log) {
        add_log(`You arrive at ${camp.name || 'camp'}.`, 'system')
      }
      return
    }
    
    // Begin travel
    set_is_traveling(true)
    travel_target_ref.current = camp.id
    travel_remaining_ref.current = distance
    set_travel_remaining(distance)
    set_travel_initial_distance(distance)
    set_travel_target_camp_name(camp.name || 'camp')
    
    const tick_distance = 10
    const tick_ms = 3000
    const hostility_tier = Number(current_zone?.hostility_tier ?? 0)
    const ambush_chance = Math.max(0, hostility_tier * 0.1)
    
    // Get player speed from stat modifiers
    const player_mods = get_stat_modifiers ? get_stat_modifiers('player') || {} : {}
    const player_speed = Math.max(0.1, 1 * (1 + (player_mods.mod_move || 0) / 100))
    
    // Get camp pool for ambushes (mobs from current and target camp)
    const camp_pool = [
      ...(camp_members[current_camp_id] || []),
      ...(camp_members[camp.id] || [])
    ].filter(Boolean)
    
    // Pick random mob from camp pool
    const pick_mob = () => {
      if (!camp_pool.length) return null
      const weights = camp_pool.map((m) => Number(m.weight) > 0 ? Number(m.weight) : 1)
      const total = weights.reduce((s, w) => s + w, 0)
      let roll = Math.random() * total
      for (let i = 0; i < camp_pool.length; i += 1) {
        roll -= weights[i]
        if (roll <= 0) return camp_pool[i]
      }
      return camp_pool[0]
    }
    
    // Roll mob level if it has max_level range
    // camp_members should already have full mob template data merged in (by parent)
    const prepare_mob = (mob) => {
      if (!mob) return null
      
      // Roll level if mob has max_level
      const level_base = Number(mob.level) || 1
      const max_level = Number(mob.max_level) || 0
      if (max_level > 0 && max_level > level_base) {
        return {
          ...mob,
          level: level_base + Math.floor(Math.random() * (max_level - level_base + 1))
        }
      }
      
      return mob
    }
    
    // Travel step function
    const step = () => {
      if (!is_traveling_ref.current) return
      
      travel_remaining_ref.current -= tick_distance
      set_travel_remaining(Math.max(0, travel_remaining_ref.current))
      
      // Check for ambush
      if (ambush_chance > 0 && Math.random() < ambush_chance) {
        const mob = prepare_mob(pick_mob())
        if (mob) {
          const mob_speed = Math.max(0.1, mob.movespeed || 1)
          if (mob_speed > player_speed) {
            // Ambushed!
            set_is_traveling(false)
            travel_target_ref.current = null
            set_travel_remaining(0)
            set_travel_initial_distance(0)
            set_travel_target_camp_name(null)
            if (travel_timer_ref.current) {
              clearTimeout(travel_timer_ref.current)
              travel_timer_ref.current = null
            }
            if (on_ambush) {
              on_ambush(mob)
            }
            return
          }
        }
      }
      
      // Continue traveling
      if (travel_remaining_ref.current > 0) {
        travel_timer_ref.current = setTimeout(step, tick_ms)
        return
      }
      
      // Arrive at destination
      set_is_traveling(false)
      travel_target_ref.current = null
      set_travel_remaining(0)
      set_travel_initial_distance(0)
      set_travel_target_camp_name(null)
      const new_camp_id = Number(camp.id)
      set_camp_id(new_camp_id)
      schedule_save({ character: { current_camp_id: new_camp_id } }, { immediate: true })
      if (add_log) {
        add_log(`You arrive at ${camp.name || 'camp'}.`, 'system')
      }
      
    }
    
    // Start travel
    travel_timer_ref.current = setTimeout(step, tick_ms)
  }, [
    clear_mob_state,
    current_zone_id,
    current_camp_id,
    current_zone,
    camps_by_zone,
    camp_members,
    set_camp_id,
    schedule_save,
    has_key_item,
    is_invisible,
    get_stat_modifiers,
    on_ambush,
    add_log,
    is_casting,
    in_combat,
    get_travel_distance
  ])
  
  // Change zone
  const change_zone = useCallback(async (zone_id, target_camp_id = null, bypass_connection_check = false, bypass_camp_checks = false) => {
    if (is_casting() && !bypass_connection_check) {
      if (add_log) {
        add_log('You cannot travel while casting!', 'error')
      }
      return
    }
    if (in_combat() && !bypass_connection_check) {
      if (add_log) {
        add_log('You cannot travel while in combat!', 'error')
      }
      return
    }

    if (!bypass_connection_check && !available_zone_ids.includes(zone_id)) {
      if (add_log) {
        add_log('You cannot travel there directly from this zone.', 'error')
      }
      return
    }

    // Clear all timers and state BEFORE any async operations
    // This prevents race conditions where old zone's spawn timer could fire during zone change
    clear_spawn_timer()
    clear_mob_state()

    // Cancel any in-flight travel
    if (is_traveling_ref.current) {
      set_is_traveling(false)
      is_traveling_ref.current = false
      travel_target_ref.current = null
      set_travel_remaining(0)
      set_travel_initial_distance(0)
      set_travel_target_camp_name(null)
      if (travel_timer_ref.current) {
        clearTimeout(travel_timer_ref.current)
        travel_timer_ref.current = null
      }
    }

    // Fetch zone data and camps for the new zone
    try {
      const [new_zone_data, new_zone_camps] = await Promise.all([
        fetch_zone(zone_id).catch(() => null),
        fetch_camps_by_zone(zone_id)
      ])
      
      // Set zone_id
      set_zone_id(zone_id)
      
      // Find the target camp in the new zone
      let target_camp = null
      if (new_zone_camps && new_zone_camps.length > 0) {
        // If target_camp_id is provided (e.g., for death respawn), use that
        if (target_camp_id) {
          target_camp = new_zone_camps.find(camp => camp.id === target_camp_id)
          if (!target_camp) {
            if (add_log) {
              add_log(`Target camp ${target_camp_id} not found in zone ${zone_id}.`, 'error')
            }
            return
          }
        } else {
          // Otherwise, find the zoneline camp that connects back to the current zone
          target_camp = new_zone_camps.find(camp => {
            const content_flags = (camp.content_flags || '').toLowerCase()
            const is_zoneline = content_flags.includes('zoneline')
            return is_zoneline && camp.target_zone_id === current_zone_id
          })

          // If no matching zoneline camp found, just use first camp
          if (!target_camp) {
            console.warn(`No zoneline camp in ${zone_id} points back to ${current_zone_id}. Using first camp: ${new_zone_camps[0]?.name || new_zone_camps[0]?.id}`)
            target_camp = new_zone_camps[0]
          }
        }
        
        // Pass the new zone's camps array and zone data so change_camp can find the camp and calculate distance
        change_camp(target_camp.id, zone_id, new_zone_camps, new_zone_data, bypass_camp_checks)
      } else {
        // If no camps in new zone, keep current camp_id (can't set to null - NOT NULL constraint)
        // This shouldn't happen in normal gameplay, but we need to handle it
        if (add_log) {
          add_log(`Warning: No camps found in zone ${zone_id}. Keeping current camp.`, 'error')
        }
      }
      
      if (add_log) {
        const zone_name = new_zone_data?.name || zone_id
        add_log(`You travel to ${zone_name}.`, 'system')
      }
    } catch (error) {
      console.error('Error fetching zone data or camps for new zone:', error)
      if (add_log) {
        add_log(`Error loading zone ${zone_id}.`, 'error')
      }
    }
    
    schedule_save({
      character: {
        zone_id: zone_id
      }
    })
  }, [
    available_zone_ids,
    camps_by_zone,
    set_zone_id,
    set_camp_id,
    schedule_save,
    add_log,
    is_casting,
    in_combat,
    change_camp,
    current_zone,
    zone_connections,
    current_zone_id,
    clear_spawn_timer,
    clear_mob_state
  ])
  
  // Pick random mob from camp pool (weighted)
  const pick_mob_from_camp = useCallback((camp_id) => {
    const pool = camp_members[camp_id] || []
    if (!pool.length) return null
    
    const weights = pool.map((m) => Number(m.weight) > 0 ? Number(m.weight) : 1)
    const total = weights.reduce((s, w) => s + w, 0)
    let roll = Math.random() * total
    for (let i = 0; i < pool.length; i += 1) {
      roll -= weights[i]
      if (roll <= 0) return pool[i]
    }
    return pool[0]
  }, [camp_members])
  
  // Prepare mob (roll level, normalize)
  const prepare_mob_for_spawn = useCallback((mob) => {
    if (!mob) return null
    
    // Normalize mob first
    const normalized = normalize_mob(mob)
    
    // Roll level if mob has max_level
    const level_base = Number(normalized.level) || 1
    const max_level = Number(normalized.max_level) || 0
    if (max_level > 0 && max_level > level_base) {
      normalized.level = level_base + Math.floor(Math.random() * (max_level - level_base + 1))
    }
    
    return normalized
  }, [])
  
  // Spawn mob from camp
  const spawn_mob = useCallback(() => {
    if (!current_camp_id || !current_camp) return null
    
    // Pick mob from camp
    const selected_mob = pick_mob_from_camp(current_camp_id)
    if (!selected_mob) return null
    
    // Prepare mob (roll level, normalize)
    const mob = prepare_mob_for_spawn(selected_mob)
    if (!mob) return null
    
    // Set spawn distance (random 0 to camp_area)
    const camp_area = Number(current_camp.camp_area) || 0
    const spawn_distance = Math.max(0, Math.random() * camp_area)
    mob.distance = spawn_distance
    
    // NOTE: Non-enemy camps (Banker, Merchant, Tradeskill stations) will ALWAYS 
    // have only ONE NPC in that camp (camp_members). These camps don't spawn 
    // combat mobs - interactions are triggered on camp change via content_flags.
    
    // Set mob vitals
    if (set_mob_hp) set_mob_hp(mob.hp || 0)
    if (set_mob_mana) set_mob_mana(mob.mana || 0)
    if (set_mob_endurance) set_mob_endurance(mob.endurance || 0)
    if (set_mob_distance) set_mob_distance(spawn_distance)
    if (set_current_mob) set_current_mob(mob)
    // Note: current_mob_ref is automatically synced from state in GameScreen
    
    if (add_log) {
      add_log(`${mob.name} spawns!`, 'spawn')
    }
    
    // Save current_mob to database immediately
    if (schedule_save) {
      const mob_payload = {
        ...mob,
        hp: mob.hp || 0,
        mana: mob.mana || 0,
        endurance: mob.endurance || 0,
        distance: spawn_distance
      };
      schedule_save({
        character: {
          current_mob: mob_payload
        }
      });
    }
    
    return mob
  }, [
    current_camp_id,
    current_camp,
    pick_mob_from_camp,
    prepare_mob_for_spawn,
    set_current_mob,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    set_mob_distance,
    on_merchant_banker_spawn,
    add_log
  ])
  
  // Start spawn timer (called when mob dies)
  // Uses refs to store the latest callback so nested timeouts always use current version
  const start_spawn_timer = useCallback(() => {
    // Clear any existing timer
    if (spawn_timer_ref.current) {
      clearTimeout(spawn_timer_ref.current)
      spawn_timer_ref.current = null
    }
    
    if (!current_camp || !current_camp.spawn_time) {
      if (add_log) {
        add_log('Camp spawn time is not configured.', 'error')
      }
      return
    }
    
    const spawn_time_seconds = Number(current_camp.spawn_time)
    if (!Number.isFinite(spawn_time_seconds) || spawn_time_seconds <= 0) {
      if (add_log) {
        add_log('Camp spawn time is invalid.', 'error')
      }
      return
    }
    
    // Start timer
    spawn_timer_ref.current = setTimeout(() => {
      spawn_timer_ref.current = null
      const spawned = spawn_mob()
      // If spawn failed, restart the timer
      if (!spawned && current_camp_id && current_camp) {
        const interaction_type = get_interaction_type_from_content_flags(current_camp.content_flags)
        if (!interaction_type) {
          start_spawn_timer()
        }
      }
    }, spawn_time_seconds * 1000)
  }, [current_camp, spawn_mob, add_log])
  
  // Note: current_mob_ref is synced from state in GameScreen
  // We don't need to sync it here - it's automatically updated when set_current_mob is called
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (travel_timer_ref.current) {
        clearTimeout(travel_timer_ref.current)
      }
      if (spawn_timer_ref.current) {
        clearTimeout(spawn_timer_ref.current)
      }
    }
  }, [])
  
  // Initialize spawn timer when arriving at a camp (if no current mob)
  // This handles the case when character loads into a camp or arrives at a new camp
  // Also handles when mob dies (current_mob becomes null)
  // Also restarts if spawn_mob changes (e.g., when camp_members loads)
  useEffect(() => {
    // Only start timer if:
    // 1. We have a camp
    // 2. We have a camp_id
    // 3. No current mob exists
    // 4. No spawn timer already running
    // 5. Camp is an enemy camp (not merchant/banker/tradeskill)
    // 6. Camp has members loaded (for spawning)
    if (!current_camp_id || !current_camp) return
    if (current_mob) return // Already have a mob
    if (spawn_timer_ref.current) return // Timer already running
    
    const interaction_type = get_interaction_type_from_content_flags(current_camp.content_flags)
    if (interaction_type) return // Non-enemy camp, don't spawn
    
    // Check if camp_members are loaded for this camp
    const members = camp_members[current_camp_id] || []
    if (members.length === 0) return // Camp members not loaded yet, wait
    
    // Start spawn timer
    if (start_spawn_timer) {
      start_spawn_timer()
    }
  }, [current_camp_id, current_camp, start_spawn_timer, current_mob, camps_by_zone, camp_members])

  // Nudge spawn timer - force restart it (clears existing timer if running)
  const nudge_spawn_timer = useCallback(() => {
    if (!current_camp_id || !current_camp) {
      if (add_log) add_log('No camp selected.', 'error')
      return false
    }
    if (current_mob) {
      if (add_log) add_log('A mob is already spawned.', 'error')
      return false // Already have a mob
    }
    
    const interaction_type = get_interaction_type_from_content_flags(current_camp.content_flags)
    if (interaction_type) {
      if (add_log) add_log('This camp does not spawn mobs.', 'error')
      return false // Non-enemy camp, can't spawn
    }
    
    // Check if camp_members are loaded
    const members = camp_members[current_camp_id] || []
    if (members.length === 0) {
      if (add_log) add_log('Camp members not loaded yet.', 'error')
      return false
    }
    
    // Clear any existing timer
    if (spawn_timer_ref.current) {
      clearTimeout(spawn_timer_ref.current)
      spawn_timer_ref.current = null
    }
    
    // Start spawn timer
    if (start_spawn_timer) {
      start_spawn_timer()
      if (add_log) add_log('Spawn timer restarted.', 'system')
      return true
    }
    return false
  }, [current_camp_id, current_camp, current_mob, start_spawn_timer, camp_members, add_log])

  return {
    // State
    is_traveling,
    travel_remaining,
    travel_initial_distance,
    travel_target_camp_name,
    available_zone_ids,
    
    // Functions
    change_zone,
    change_camp,
    get_travel_distance,
    start_spawn_timer,
    spawn_mob,
    nudge_spawn_timer
  }
}

