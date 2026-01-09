import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../App.css'
import { use_character_loader } from '../hooks/useCharacterLoader'
import { use_character } from '../hooks/useCharacter'
import { use_inventory } from '../hooks/useInventory'
import { use_zone } from '../hooks/useZone'
import { use_effects } from '../hooks/useEffects'
import { use_combat } from '../hooks/useCombat'
import { use_skill_slots } from '../hooks/useSkillSlots'
import { use_zone_utils } from '../hooks/useZoneUtils'
import { use_interactions } from '../hooks/useInteractions'
import { use_bank_transactions } from '../hooks/useBankTransactions'
import { use_merchant_transactions } from '../hooks/useMerchantTransactions'
import { use_tick_worker } from '../hooks/useTickWorker'
import { fetch_class, fetch_race, fetch_deity, fetch_camps_by_zone, fetch_camp_members, fetch_mob_template, fetch_item, fetch_spell, get_item_from_cache, fetch_classes_catalog, fetch_races, fetch_deities, fetch_zone, fetch_zone_connections } from '../services/referenceData'
import { XP_BASE } from '../utils/gameConstants'
import { fetch_character_spells } from '../services/playerStorage'
import { normalize_mob } from '../utils/mobUtils'
import { get_interaction_type_from_content_flags } from '../utils/npcUtils'
import { flatten_inventory } from '../utils/inventoryFlatten'
import { CARRY_START } from '../services/inventoryManager'
import CharacterPanel from '../components/CharacterPanel'
import CombatConsole from '../components/CombatConsole'
import ZonePanel from '../components/ZonePanel'
import InventoryModal from '../components/InventoryModal'
import TradePanel from '../components/TradePanel'
import HardcoreLeaderboard from '../components/HardcoreLeaderboard'

function GameScreen({ onSignOut }) {
  const { characterId } = useParams()
  const navigate = useNavigate()
  
  // Initialize tick worker (keeps timers running when tab is hidden)
  const tick_signal = use_tick_worker()
  
  // Character loading
  const { loading, error, character_data } = use_character_loader(characterId)
  
  // Local state for zone/camp (optimistic updates)
  const [local_zone_id, set_local_zone_id] = useState(character_data?.zone_id ?? null)
  const [local_current_camp_id, set_local_current_camp_id] = useState(character_data?.current_camp_id ?? null)

  // Sync local state with character_data when it changes
  useEffect(() => {
    if (character_data?.zone_id !== undefined) {
      set_local_zone_id(character_data.zone_id)
    }
  }, [character_data?.zone_id])
  useEffect(() => {
    if (character_data?.current_camp_id !== undefined) {
      set_local_current_camp_id(character_data.current_camp_id)
    }
  }, [character_data?.current_camp_id])
  
  // Local known_spells state (can be updated when spells are learned)
  const [known_spells_state, set_known_spells_state] = useState([])
  // Local cooldown state (keeps UI in sync immediately)
  const [cooldowns_state, set_cooldowns_state] = useState(character_data?.cooldowns ?? {})
  
  // Update known_spells_state when character_data loads
  useEffect(() => {
    if (character_data?.known_spells) {
      set_known_spells_state(character_data.known_spells)
    }
  }, [character_data?.known_spells])
  // Sync cooldowns when character_data changes (e.g., on reload)
  useEffect(() => {
    set_cooldowns_state(character_data?.cooldowns ?? {})
  }, [character_data?.cooldowns])
  
  // Reference data state
  const [player_class, set_player_class] = useState(null)
  const [race_data, set_race_data] = useState(null)
  const [deity_data, set_deity_data] = useState(null)
  const [zones, set_zones] = useState({})
  const [camps_by_zone, set_camps_by_zone] = useState([])
  const [camp_members_map, set_camp_members_map] = useState({}) // { camp_id: [merged mob objects] }
  const [zone_connections, set_zone_connections] = useState({}) // { zone_id: [{from_zone, to_zone}] }
  
  // Leaderboard caches
  const [class_cache, set_class_cache] = useState({})
  const [race_cache, set_race_cache] = useState({})
  const [deity_cache, set_deity_cache] = useState({})
  
  // Modal state
  const [show_inventory_modal, set_show_inventory_modal] = useState(false)
  
  // Combat log state (shared between combat and UI)
  const [combat_log, set_combat_log] = useState([])
  
  // Navigation blocker state
  const [block_navigation, set_block_navigation] = useState(false)
  
  // Load leaderboard reference data (all classes, races, deities)
  useEffect(() => {
    const load_leaderboard_data = async () => {
      try {
        const [classes_data, races_data, deities_data] = await Promise.all([
          fetch_classes_catalog().catch(() => []),
          fetch_races().catch(() => []),
          fetch_deities().catch(() => [])
        ])
        
        // Build class cache (using c_id as key)
        const class_map = {}
        classes_data.forEach(c => {
          class_map[c.c_id] = c
        })
        set_class_cache(class_map)
        
        // Build race cache (using r_id as key)
        const race_map = {}
        races_data.forEach(r => {
          race_map[r.r_id] = r
        })
        set_race_cache(race_map)
        
        // Build deity cache (using d_id as key)
        const deity_map = {}
        deities_data.forEach(d => {
          deity_map[d.d_id] = d
        })
        set_deity_cache(deity_map)
      } catch (error) {
        console.error('Error loading leaderboard reference data:', error)
      }
    }
    
    load_leaderboard_data()
  }, [])
  
  // Load reference data when character loads or zone changes
  useEffect(() => {
    if (!character_data || !character_data.zone_id) return
    
    const zone_id = character_data.zone_id
    const load_reference_data = async () => {
      try {
        // Load class, race, deity
        const [class_data, race_data_result, deity_data_result] = await Promise.all([
          character_data.class_id ? fetch_class(character_data.class_id).catch(() => null) : Promise.resolve(null),
          character_data.race_id ? fetch_race(character_data.race_id).catch(() => null) : Promise.resolve(null),
          character_data.deity_id ? fetch_deity(character_data.deity_id).catch(() => null) : Promise.resolve(null)
        ])
        
        set_player_class(class_data)
        set_race_data(race_data_result)
        set_deity_data(deity_data_result)
        
        // Load zones (we'll need to fetch all zones or at least connected ones)
        // For now, just set current zone
        if (character_data.current_zone) {
          set_zones(prev => ({
            ...prev,
            [character_data.zone_id]: character_data.current_zone
          }))
        }
        
        // Load camps for current zone
        if (zone_id) {
          const camps = await fetch_camps_by_zone(zone_id)
          set_camps_by_zone(camps)
          
          // Load zone connections for current zone
          const zone_connections = await fetch_zone_connections(zone_id).catch((err) => {
            console.error('Failed to fetch zone connections:', err)
            return []
          })
          set_zone_connections(prev => ({
            ...prev,
            [zone_id]: zone_connections
          }))
          
          // Load connected zones (to get their names for display)
          const connected_zone_ids = zone_connections.map(conn => conn.to_zone)
          const connected_zones = await Promise.all(
            connected_zone_ids.map(async (connected_zone_id) => {
              try {
                const zone = await fetch_zone(connected_zone_id)
                return [connected_zone_id, zone]
              } catch (err) {
                console.error(`Failed to fetch connected zone ${connected_zone_id}:`, err)
                return null
              }
            })
          )
          const valid_connected_zones = connected_zones.filter(Boolean)
          set_zones(prev => {
            const updated = { ...prev }
            valid_connected_zones.forEach(([connected_zone_id, zone]) => {
              updated[connected_zone_id] = zone
            })
            return updated
          })
          
          // Load camp members for all camps in zone
          const members_map = {}
          for (const camp of camps) {
            const members = await fetch_camp_members(camp.id)
            // Merge with mob_templates
            const merged_mobs = await Promise.all(
              members.map(async (member) => {
                try {
                  const mob_template = await fetch_mob_template(member.mob_id)
                  return normalize_mob({
                    ...mob_template,
                    ...member
                  })
                } catch (err) {
                  console.error(`Failed to fetch mob template ${member.mob_id}:`, err)
                  return null
                }
              })
            )
            members_map[camp.id] = merged_mobs.filter(Boolean)
          }
          set_camp_members_map(members_map)
        }
      } catch (error) {
        console.error('Error loading reference data:', error)
      }
    }
    
    load_reference_data()
  }, [character_data?.zone_id]) // Only reload when zone changes, not on every character_data change
  
  // Redirect if invalid character
  useEffect(() => {
    if (!loading && error) {
      navigate('/character-select')
    }
  }, [loading, error, navigate])
  
  // Add log function (shared)
  const add_log = useCallback((message, type = 'system') => {
    set_combat_log(prev => [...prev.slice(-199), { id: Date.now() + Math.random(), message, type }])
  }, [])
  const [show_leaderboard_modal, set_show_leaderboard_modal] = useState(false)
  
  // Handle spells learned callback - reload known spells
  const handle_spells_learned = useCallback(async (learned_spells) => {
    if (!character_data?.id || learned_spells.length === 0) return
    
    try {
      // Reload character spells from database
      const spell_rows = await fetch_character_spells(character_data.id)
      
      // Load full spell data for each learned spell
      const updated_known_spells = await Promise.all(
        spell_rows.map(async (row) => {
          try {
            const spell_data = await fetch_spell(row.spell_id)
            return {
              spell_id: row.spell_id,
              ability_slot: row.ability_slot,
              spell_slot: row.spell_slot,
              rank: row.rank,
              learned_at: row.learned_at,
              ...spell_data,
              icon_index: spell_data.new_icon,
              skill_type: spell_data.skill_type
            }
          } catch (err) {
            console.error(`Failed to fetch spell ${row.spell_id}:`, err)
            return null
          }
        })
      )
      const valid_spells = updated_known_spells.filter(Boolean)
      
      // Update local known_spells state
      set_known_spells_state(valid_spells)
    } catch (err) {
      console.error('Error reloading spells after learning:', err)
    }
  }, [character_data?.id])
  
  // Initialize useCharacter hook (needs character_data and player_class)
  const character_hook = use_character(
    character_data,
    player_class,
    null, // get_stat_modifiers - will be set after useEffects
    add_log,
    () => navigate('/character-select'), // on_return_to_character_select
    handle_spells_learned // on_spells_learned
  )
  
  // Initialize useInventory hook (needs slots_ref from useCharacter)
  const inventory_hook = use_inventory(
    character_data?.slots ?? [],
    character_hook.slots_ref,
    character_hook.schedule_save,
    add_log
  )
  
  // Get current mob from zone (will be set by useZone)
  const [current_mob_from_zone, set_current_mob_from_zone] = useState(null)
  
  // Shared ref for current mob (synced from state, used by hooks for callbacks/timers)
  const current_mob_ref = useRef(null)
  
  // Sync ref with state (single source of truth)
  useEffect(() => {
    current_mob_ref.current = current_mob_from_zone
  }, [current_mob_from_zone])
  
  // Mob vitals state (lifted to parent to break circular dependency)
  const [mob_hp, set_mob_hp] = useState(0)
  const [mob_mana, set_mob_mana] = useState(0)
  const [mob_endurance, set_mob_endurance] = useState(0)
  const [mob_distance, set_mob_distance] = useState(0)
  
  // Initialize mob vitals when mob changes
  useEffect(() => {
    if (current_mob_from_zone) {
      set_mob_hp(current_mob_from_zone.hp)
      set_mob_mana(current_mob_from_zone.mana)
      set_mob_endurance(current_mob_from_zone.endurance)
      set_mob_distance(current_mob_from_zone.distance)
    } else {
      set_mob_hp(0)
      set_mob_mana(0)
      set_mob_endurance(0)
      set_mob_distance(0)
    }
  }, [current_mob_from_zone?.id])
  
  // Create a ref to hold handle_mob_death (will be set after useCombat initializes)
  const handle_mob_death_ref = useRef(() => {})
  const get_stat_modifiers_ref = useRef(() => {})
  
  // Create a ref to hold change_zone function (will be set after useZone initializes)
  const change_zone_ref = useRef(() => {})
  
  // Pass a wrapper function for handle_mob_death that uses the ref
  const effects_hook = use_effects({
    set_hp: character_hook.set_hp,
    max_hp: character_hook.max_hp,
    set_mana: character_hook.set_mana,
    max_mana: character_hook.max_mana,
    set_endurance: character_hook.set_endurance,
    max_endurance: character_hook.max_endurance,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    current_mob: current_mob_from_zone,
    add_log,
    handle_mob_death: async () => {
      if (handle_mob_death_ref.current) {
        await handle_mob_death_ref.current()
        // Spawn timer will start automatically via useEffect in useZone
        // when current_mob becomes null
      }
    },
    initial_player_effects: character_data?.active_effects ?? [],
    schedule_save: character_hook.schedule_save,
    get_hp_regen_rate: character_hook.get_hp_regen_rate,
    get_mana_regen_rate: character_hook.get_mana_regen_rate,
    get_endurance_regen_rate: character_hook.get_endurance_regen_rate,
    tick_signal
  })
  
  // Get current camp from camps_by_zone (use local state for immediate updates)
  const current_camp = camps_by_zone.find(c => c.id === local_current_camp_id)
  
  // Initialize useCombat hook (receives mob state as props, not managing it)
  const combat_hook = use_combat({
    tick_signal,
    character_data,
    player_class,
    level: character_hook.level,
    hp: character_hook.hp,
    max_hp: character_hook.max_hp,
    mana: character_hook.mana,
    max_mana: character_hook.max_mana,
    endurance: character_hook.endurance,
    max_endurance: character_hook.max_endurance,
    set_hp: character_hook.set_hp,
    set_mana: character_hook.set_mana,
    set_endurance: character_hook.set_endurance,
    stat_totals: character_hook.stat_totals,
    derived_stats: character_hook.derived_stats,
    total_bonuses: character_hook.gear_bonuses,
    get_stat_modifiers: effects_hook.get_stat_modifiers,
    add_effect: effects_hook.add_effect,
    mob_hp,
    mob_mana,
    mob_endurance,
    mob_distance,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    set_mob_distance,
    add_log,
    schedule_save: character_hook.schedule_save,
    handle_level_up: character_hook.handle_level_up,
    handle_death: async (killer_name) => {
      const result = character_hook.handle_death(killer_name)
      if (result?.is_hardcore_dead) {
        navigate('/character-select')
        return
      }
      
      if (result?.should_respawn) {
        // Clear current mob
        set_current_mob_from_zone(null)
        
        // Exit combat
        combat_hook.set_in_combat(false)
        
        // Add death messages
        add_log(`You have been slain by ${result.killer_name}!`, 'death')
        if (result.xp_loss > 0) {
          add_log(`You have lost ${result.xp_loss} experience.`, 'death')
        }
        
        // Pause for transition (1.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Change zone to bind zone and camp to bind camp (bypass connection check for death respawn)
        if (change_zone_ref.current) {
          await change_zone_ref.current(result.return_zone, result.return_camp, true)
        }
        
        add_log('You have been resurrected at your bind point.', 'system')
      }
    },
    add_item_to_inventory: inventory_hook.add_item,
    add_currency: character_hook.add_currency,
    add_xp: character_hook.add_xp,
    get_item_from_slot: inventory_hook.get_item_from_slot,
    set_item_in_slot: inventory_hook.set_item_in_slot,
    current_mob_from_zone,
    set_current_mob_in_zone: set_current_mob_from_zone,
    current_mob_ref, // current_mob_ref (shared ref)
    character_xp_mod: character_data?.xp_mod,
    zone_xp_mod: character_data?.current_zone?.zone_xp_mod,
    camp_xp_mod: current_camp?.camp_xp_mod,
    xp_bonus: character_hook.derived_stats?.xp_bonus
  })
  
  // Update effects hook with combat state for regen
  useEffect(() => {
    if (effects_hook.update_regen_state) {
      effects_hook.update_regen_state({
        in_combat: combat_hook.in_combat,
        is_sitting: combat_hook.is_sitting,
        flee_exhausted: combat_hook.flee_exhausted
      });
    }
  }, [combat_hook.in_combat, combat_hook.is_sitting, combat_hook.flee_exhausted, effects_hook.update_regen_state])
  
  // Update the ref with the real handle_mob_death once useCombat is ready
  useEffect(() => {
    if (combat_hook.handle_mob_death) {
      handle_mob_death_ref.current = combat_hook.handle_mob_death
    }
  }, [combat_hook.handle_mob_death])

  // Keep stat modifiers getter in a ref for useZone
  useEffect(() => {
    if (effects_hook.get_stat_modifiers) {
      get_stat_modifiers_ref.current = effects_hook.get_stat_modifiers
    }
  }, [effects_hook.get_stat_modifiers])
  
  // Initialize useZone hook (needs zone/camp data)
  const zone_hook = use_zone(
    local_zone_id ?? null,
    local_current_camp_id ?? null,
    zones[local_zone_id] ?? character_data?.current_zone ?? null,
    current_camp ?? null,
    camps_by_zone,
    camp_members_map,
    async (zone_id) => {
      // CRITICAL: Save inventory before zone change to prevent data loss
      character_hook.schedule_save({ inventory: true }, { immediate: true })
      
      // set_zone_id - update character_data zone_id (save immediately for zone changes)
      character_hook.schedule_save({ character: { zone_id } }, { immediate: true })
      set_local_zone_id(zone_id)
      
      // Immediately load camps for the new zone
      try {
        const new_zone_data = await fetch_zone(zone_id).catch(() => null)
        if (new_zone_data) {
          set_zones(prev => ({
            ...prev,
            [zone_id]: new_zone_data
          }))
        }
        const new_camps = await fetch_camps_by_zone(zone_id)
        set_camps_by_zone(new_camps)
        
        // Load zone connections for new zone
        const new_zone_connections = await fetch_zone_connections(zone_id).catch((err) => {
          console.error('Failed to fetch zone connections:', err)
          return []
        })
        set_zone_connections(prev => ({
          ...prev,
          [zone_id]: new_zone_connections
        }))
        
        // Load connected zones (to get their names for display)
        const connected_zone_ids = new_zone_connections.map(conn => conn.to_zone)
        const connected_zones = await Promise.all(
          connected_zone_ids.map(async (connected_zone_id) => {
            try {
              const zone = await fetch_zone(connected_zone_id)
              return [connected_zone_id, zone]
            } catch (err) {
              console.error(`Failed to fetch connected zone ${connected_zone_id}:`, err)
              return null
            }
          })
        )
        const valid_connected_zones = connected_zones.filter(Boolean)
        set_zones(prev => {
          const updated = { ...prev }
          valid_connected_zones.forEach(([connected_zone_id, zone]) => {
            updated[connected_zone_id] = zone
          })
          return updated
        })
        
        // Load camp members for new zone
        const members_map = {}
        for (const camp of new_camps) {
          const members = await fetch_camp_members(camp.id)
          const merged_mobs = await Promise.all(
            members.map(async (member) => {
              try {
                const mob_template = await fetch_mob_template(member.mob_id)
                return normalize_mob({
                  ...mob_template,
                  ...member
                })
              } catch (err) {
                console.error(`Failed to fetch mob template ${member.mob_id}:`, err)
                return null
              }
            })
          )
          members_map[camp.id] = merged_mobs.filter(Boolean)
        }
        set_camp_members_map(members_map)
      } catch (error) {
        console.error('Error loading camps for new zone:', error)
      }
    },
    async (camp_id) => {
      // set_camp_id - update character_data current_camp_id
      // Only save if camp_id is not null (database constraint: NOT NULL)
      if (camp_id !== null && camp_id !== undefined) {
        // Update local state immediately (optimistic update)
        set_local_current_camp_id(camp_id)
        // Save immediately for camp changes
        character_hook.schedule_save({ character: { current_camp_id: camp_id } }, { immediate: true })
        
        // Ensure zone connections are loaded for current zone (in case they weren't loaded yet)
        const current_zone_id = local_zone_id || character_data?.zone_id
        if (current_zone_id && !(current_zone_id in zone_connections)) {
          try {
            const zone_conns = await fetch_zone_connections(current_zone_id).catch((err) => {
              console.error('Failed to fetch zone connections:', err)
              return []
            })
            set_zone_connections(prev => ({
              ...prev,
              [current_zone_id]: zone_conns
            }))
          } catch (error) {
            console.error('Error loading zone connections:', error)
          }
        }
        
        // Check if camp has interaction (banker/merchant/tradeskill)
        // NOTE: Non-enemy camps will ALWAYS have only ONE NPC in camp_members
        const camp = camps_by_zone.find(c => c.id === camp_id)
        if (camp) {
          const interaction_type = get_interaction_type_from_content_flags(camp.content_flags)
          if (interaction_type) {
            // Get the single mob from camp_members for non-enemy camps
            const camp_members = camp_members_map[camp_id] || []
            const mob = camp_members[0] || null
            interactions_hook.open_interaction(camp, mob)
          }
        }
      }
    },
    character_hook.schedule_save,
    () => false, // has_key_item - TODO
    () => false, // is_invisible - TODO
    (type) => get_stat_modifiers_ref.current(type),
    (mob) => {
      // on_ambush - set mob in zone and combat
      set_current_mob_from_zone(mob)
      combat_hook.set_in_combat(true)
    },
    add_log,
    () => combat_hook.casting_state !== null, // is_casting
    () => combat_hook.in_combat, // in_combat (for travel validation)
    set_current_mob_from_zone, // set_current_mob
    current_mob_ref, // current_mob_ref (shared ref)
    current_mob_from_zone, // current_mob (state for useEffect dependencies)
    set_mob_hp, // set_mob_hp
    set_mob_mana, // set_mob_mana
    set_mob_endurance, // set_mob_endurance
    set_mob_distance, // set_mob_distance
    null, // on_merchant_banker_spawn - no longer used (interactions triggered on camp change)
    zone_connections[local_zone_id || character_data?.zone_id] || [] // zone_connections for current zone
  )
  
  // Update the ref with change_zone once useZone is ready
  useEffect(() => {
    if (zone_hook?.change_zone) {
      change_zone_ref.current = zone_hook.change_zone
    }
  }, [zone_hook?.change_zone])
  
  // Spawn timer is now handled automatically by useEffect in useZone
  // No need for manual wrapper ref
  
  // Initialize useSkillSlots hook
  const skill_slots_hook = use_skill_slots({
    character_id: character_data?.id,
    known_spells: known_spells_state.length > 0 ? known_spells_state : (character_data?.known_spells ?? []),
    set_known_spells: (spells) => {
      set_known_spells_state(spells);
    },
    player_class,
    resource_type: character_data?.resource_type || 'melee',
    mana: character_hook.mana,
    endurance: character_hook.endurance,
    set_mana: character_hook.set_mana,
    set_endurance: character_hook.set_endurance,
    cooldowns: cooldowns_state,
    set_cooldowns: (cooldowns) => {
      // Update cooldowns locally for immediate UI + persist
      set_cooldowns_state(cooldowns)
      character_hook.schedule_save({ character: { cooldowns } }, { immediate: true })
    },
    add_effect: effects_hook.add_effect,
    remove_effect: effects_hook.remove_effect,
    remove_effect_by_spell_id: effects_hook.remove_effect_by_spell_id,
    is_sitting: combat_hook.is_sitting,
    set_is_sitting: combat_hook.set_is_sitting,
    attack_mob: combat_hook.attack_mob,
    ranged_attack_mob: combat_hook.ranged_attack_mob,
    set_is_auto_attack: combat_hook.set_is_auto_attack,
    is_auto_attack: combat_hook.is_auto_attack,
    in_combat: combat_hook.in_combat,
    casting_state: combat_hook.casting_state,
    set_casting_state: combat_hook.set_casting_state,
    add_log,
    schedule_save: character_hook.schedule_save,
    current_mob: current_mob_from_zone,
    mob_distance: mob_distance,
    level: character_hook.level,
    stat_totals: character_hook.stat_totals,
    auto_cast_slot: character_data?.auto_cast_slot ?? null,
    auto_attack_slot: character_data?.auto_attack_slot ?? null,
    set_hp: character_hook.set_hp,
    set_mob_hp: set_mob_hp,
    set_mob_mana: set_mob_mana,
    set_mob_endurance: set_mob_endurance,
    add_combat_log: add_log,
    handle_mob_death: combat_hook.handle_mob_death,
    is_stunned: effects_hook.is_stunned,
    break_mez: effects_hook.break_mez,
    // Gate/teleport support
    teleport_to_bind: (zone_id, camp_id) => {
      if (!zone_id || !change_zone_ref.current) return;
      const target_camp = camp_id || character_data?.bind_camp_id || null;
      change_zone_ref.current(zone_id, target_camp, true, true);
    },
    teleport_to_portal: async (zone_id) => {
      if (!zone_id) throw new Error('Portal zone_id missing');
      if (!change_zone_ref.current) throw new Error('Portal change_zone handler missing');
      const camps = await fetch_camps_by_zone(zone_id);
      const portal_camp = (camps || []).find((c) =>
        typeof c.content_flags === 'string' && c.content_flags.toLowerCase().includes('portal')
      );
      if (!portal_camp) {
        throw new Error(`Portal camp not found in zone ${zone_id}`);
      }
      await change_zone_ref.current(zone_id, portal_camp.id, true, true);
    },
    bind_zone_id: character_data?.bind_zone_id ?? null,
    bind_camp_id: character_data?.bind_camp_id ?? null,
    set_in_combat: combat_hook.set_in_combat
  })
  
  // Initialize useZoneUtils hook
  const zone_utils_hook = use_zone_utils({
    zone_id: local_zone_id ?? character_data?.zone_id ?? null,
    biome: zones[local_zone_id || character_data?.zone_id]?.biome ?? character_data?.current_zone?.biome ?? null,
    character_name: character_data?.name,
    user_id: character_data?.user_id ?? null
  })
  
  // Initialize interactions hook
  const interactions_hook = use_interactions({
    character_id: character_data?.id ?? null,
    add_log
  })
  
  // Initialize bank transactions hook
  const bank_hook = use_bank_transactions({
    character_id: character_data?.id ?? null,
    bank_slots: interactions_hook.bank_slots,
    update_bank_slots: interactions_hook.update_bank_slots,
    add_item_to_inventory: (item, qty) => {
      inventory_hook.add_item(item, qty)
    },
    remove_item_from_inventory: (item_entry) => {
      inventory_hook.remove_item_from_inventory(item_entry)
    },
    schedule_save: character_hook.schedule_save,
    get_item_from_cache,
    fetch_item: fetch_item,
    add_log
  })
  
  // Initialize merchant transactions hook
  const merchant_hook = use_merchant_transactions({
    stat_totals: character_hook.stat_totals,
    currency: character_hook.currency,
    set_currency: character_hook.set_currency,
    add_item_to_inventory: (item, qty) => {
      inventory_hook.add_item(item, qty)
    },
    remove_item_from_inventory: (item_entry) => {
      inventory_hook.remove_item_from_inventory(item_entry)
    },
    schedule_save: character_hook.schedule_save,
    add_log,
    item_cache: get_item_from_cache,
    fetch_item: fetch_item
  })

  const { set_merchant_cha } = merchant_hook || {}

  // Sync merchant CHA when a merchant interaction opens (avoid setState in render)
  useEffect(() => {
    const interaction = interactions_hook.interaction
    if (interaction?.type === 'merchant' && interaction.merchant_id && interaction.mob) {
      set_merchant_cha?.(interaction.merchant_id, interaction.mob)
    }
  }, [interactions_hook.interaction, set_merchant_cha])
  
  // Flatten inventory for bank panels
  const flat_inventory = useMemo(() => {
    return flatten_inventory(inventory_hook.current_slots || [])
  }, [inventory_hook.current_slots])
  
  // Navigation blocker for combat (using beforeunload for page navigation)
  useEffect(() => {
    const handle_before_unload = (e) => {
      if (combat_hook.in_combat && block_navigation) {
        e.preventDefault()
        e.returnValue = '' // Required for Chrome
        return ''
      }
    }
    
    window.addEventListener('beforeunload', handle_before_unload)
    return () => {
      window.removeEventListener('beforeunload', handle_before_unload)
    }
  }, [combat_hook.in_combat, block_navigation])
  
  // Intercept programmatic navigation (like navigate() calls)
  // Note: Direct navigate() calls won't be blocked, but beforeunload handles browser navigation
  // If you need to block programmatic navigation, wrap navigate calls with a guard
  
  // Update block_navigation based on combat state
  useEffect(() => {
    set_block_navigation(combat_hook.in_combat)
  }, [combat_hook.in_combat])
  
  // Loading state
  if (loading || !character_data || !player_class) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading character...</div>
      </div>
    )
  }
  
  // Calculate regen rates
  const hp_regen_rate = character_hook.get_hp_regen_rate(combat_hook.in_combat, combat_hook.is_sitting, combat_hook.flee_exhausted)
  const mana_regen_rate = character_hook.get_mana_regen_rate(combat_hook.in_combat, combat_hook.is_sitting, combat_hook.flee_exhausted)
  const endurance_regen_rate = character_hook.get_endurance_regen_rate(combat_hook.in_combat, combat_hook.is_sitting, combat_hook.flee_exhausted)
  
  // Calculate XP needed
  const xp_needed = XP_BASE * character_hook.level
  
  // Damage range
  const damage_range = {
    min: character_hook.derived_stats.min_damage ?? 0,
    max: character_hook.derived_stats.max_damage ?? 0
  }
  
  // Get inventory preview (equipment slots 0-21 + inventory slots 22-29, excluding slot ID 21)
  // CARRY_START = 22 (where inventory slots begin), so we need 22 equipment + 8 inventory = 30 slots
  const inventory_preview = (inventory_hook.current_slots || []).slice(0, CARRY_START + 8)
  
  // Split known spells into spells and abilities
  const current_known_spells = known_spells_state.length > 0 ? known_spells_state : (character_data?.known_spells ?? [])
  const known_spells = current_known_spells.filter(s => s.skill_type === 'spell' || !s.skill_type)
  const known_abilities = current_known_spells.filter(s => s.skill_type === 'ability')
  
  return (
    <div className="min-h-screen">
      {/* Game Header */}
      <div className="head" style={{ padding: '16px' }}>
        <div className="head-left">
          <h1>GrindQuest</h1>
          <p>An EverQuest Idle Adventure</p>
        </div>
        <div className="head-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
          <button
            onClick={() => navigate('/character-select')}
            className="btn"
            style={{ width: '100%' }}
          >
            Character Select
          </button>
          <button
            onClick={() => set_show_leaderboard_modal(true)}
            className="btn"
            style={{ width: '100%' }}
          >
            Leaderboard
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                // TODO: Implement Profile functionality
                console.log('Profile clicked')
              }}
              className="btn"
              style={{ flex: 1 }}
            >
              Profile
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="btn"
                style={{ flex: 1 }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Three-Panel Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
        {/* Combat Panel (1) */}
        <div className="col-span-1">
          <CombatConsole
            current_mob={current_mob_from_zone}
            mob_hp={mob_hp}
            mob_effects={effects_hook.mob_effects}
            toggle_auto_attack={combat_hook.toggle_auto_attack}
            is_auto_attack={combat_hook.is_auto_attack}
            ability_slots={skill_slots_hook.ability_slots}
            spell_slots={skill_slots_hook.spell_slots}
            known_abilities={known_abilities}
            known_spells={known_spells}
            level={character_hook.level}
            character_name={character_data.name}
            hp={character_hook.hp}
            max_hp={character_hook.max_hp}
            mana={character_hook.mana}
            max_mana={character_hook.max_mana}
            endurance={character_hook.endurance}
            max_endurance={character_hook.max_endurance}
            player_class={player_class}
            resource_type={character_data.resource_type || 'melee'}
            on_assign_ability={skill_slots_hook.assign_ability_to_slot}
            on_assign_spell={skill_slots_hook.assign_spell_to_slot}
            on_clear_ability={skill_slots_hook.clear_ability_slot}
            on_clear_spell={skill_slots_hook.clear_spell_slot}
            on_use_skill={skill_slots_hook.use_skill}
            cooldowns={cooldowns_state}
            now={Date.now()}
            combat_log={combat_log}
            in_combat={combat_hook.in_combat}
            casting_state={combat_hook.casting_state}
            effects={effects_hook.player_effects}
            is_sitting={combat_hook.is_sitting}
            is_stunned={effects_hook.is_stunned}
            is_attack_on_cooldown={combat_hook.is_attack_on_cooldown}
          />
        </div>

        {/* Character Panel (2) */}
        <div className="col-span-1">
          <CharacterPanel
            player_class={player_class}
            level={character_hook.level}
            character_name={character_data.name}
            hp={character_hook.hp}
            max_hp={character_hook.max_hp}
            mana={character_hook.mana}
            max_mana={character_hook.max_mana}
            endurance={character_hook.endurance}
            max_endurance={character_hook.max_endurance}
            xp={character_hook.xp}
            xp_needed={xp_needed}
            in_combat={combat_hook.in_combat}
            is_meditating={combat_hook.is_sitting}
            hp_regen_rate={hp_regen_rate}
            mana_regen_rate={mana_regen_rate}
            endurance_regen_rate={endurance_regen_rate}
            flee_exhausted={combat_hook.flee_exhausted}
            damage_range={damage_range}
            gear_bonuses={character_hook.gear_bonuses}
            inventory_length={inventory_preview.length}
            attack_delay={character_hook.derived_stats.attack_delay ?? 0}
            derived_stats={character_hook.derived_stats}
            stat_totals={character_hook.stat_totals}
            inventory_preview={inventory_preview}
            on_inspect_item={(item) => {
              // TODO: Show item inspection modal
              console.log('Inspect item:', item)
            }}
            on_slot_click={inventory_hook.handle_slot_click}
            on_slot_right_click={inventory_hook.handle_right_click_stack}
            on_inventory_open={() => set_show_inventory_modal(true)}
            selected_slot={inventory_hook.selected_slot}
            race_name={race_data?.name}
            deity_name={deity_data?.name}
            currency={character_hook.currency}
            effects={effects_hook.player_effects}
            resource_type={character_data.resource_type || 'melee'}
          />
        </div>

        {/* Zone Panel (3) */}
        <div className="col-span-1">
          <ZonePanel
            zones={zones}
            current_zone_id={local_zone_id || character_data.zone_id}
            on_zone_change={zone_hook.change_zone}
            available_zone_ids={zone_hook.available_zone_ids}
            camps={camps_by_zone}
            current_camp_id={local_current_camp_id}
            on_camp_change={zone_hook.change_camp}
            mob_distance={mob_distance}
            camp_area={current_camp?.camp_area ?? 0}
            zone_area={zones[local_zone_id || character_data.zone_id]?.zone_area ?? character_data.current_zone?.zone_area ?? 0}
            character_name={character_data.name}
            user_id={character_data.user_id}
            chat_input={zone_utils_hook.chat_input}
            messages={zone_utils_hook.messages}
            zone_users={zone_utils_hook.zone_users}
            chat_ref={zone_utils_hook.chat_ref}
            set_chat_input={zone_utils_hook.set_chat_input}
            send_chat={zone_utils_hook.send_chat}
            handle_chat_submit={zone_utils_hook.handle_chat_submit}
            bg_url={zone_utils_hook.bg_url}
            is_loading_bg={zone_utils_hook.is_loading_bg}
            zone_connections={zone_connections[local_zone_id || character_data?.zone_id] || []}
            is_traveling={zone_hook.is_traveling}
            travel_remaining={zone_hook.travel_remaining}
            travel_initial_distance={zone_hook.travel_initial_distance}
            travel_target_camp_name={zone_hook.travel_target_camp_name}
            on_nudge_camp={zone_hook.nudge_spawn_timer}
          />
          {current_camp && !interactions_hook.interaction && get_interaction_type_from_content_flags(current_camp.content_flags) && (
            <div className="mt-2 flex">
              <button
                className="btn primary"
                onClick={() => {
                  const camp_members = camp_members_map[current_camp.id] || [];
                  const mob = camp_members[0] || null;
                  interactions_hook.open_interaction(current_camp, mob);
                }}
              >
                {(() => {
                  const type = get_interaction_type_from_content_flags(current_camp.content_flags);
                  if (type === 'merchant') return 'Open Merchant';
                  if (type === 'banker') return 'Open Banker';
                  if (type === 'tradeskill') return 'Open Tradeskill';
                  return 'Open Interaction';
                })()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Modal */}
      {show_leaderboard_modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="stone-modal console" style={{ maxWidth: 600, width: '90%' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-bold text-blue-200">Hardcore Leaderboard</div>
              <button className="btn" onClick={() => set_show_leaderboard_modal(false)}>Close</button>
            </div>
            <HardcoreLeaderboard
              classCache={class_cache}
              raceCache={race_cache}
              deityCache={deity_cache}
            />
          </div>
        </div>
      )}
      
      {/* Modals */}
      {show_inventory_modal && (
        <InventoryModal
          slots={inventory_hook.current_slots || []}
          onSlotClick={inventory_hook.handle_slot_click}
          onSlotRightClick={inventory_hook.handle_right_click_stack}
          onDestroySlot={(slotIdx) => {
            inventory_hook.destroy_item(slotIdx)
          }}
          onInspectItem={(item) => {
            console.log('Inspect item:', item)
          }}
          onClose={() => set_show_inventory_modal(false)}
          selectedSlot={inventory_hook.selected_slot}
          getItemFromSlot={inventory_hook.get_item_from_slot}
        />
      )}
      
      
      {/* Interaction Modals (Banker/Merchant/Tradeskill) */}
      {interactions_hook.interaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {interactions_hook.interaction.type === 'banker' && (
              <TradePanel
                mode="bank"
                npc={interactions_hook.interaction.mob}
                source_items={interactions_hook.bank_slots}
                camp={interactions_hook.interaction.camp}
                get_item={get_item_from_cache}
                on_source_action={bank_hook.withdraw_from_bank}
                player_inventory={flat_inventory}
                on_player_action={bank_hook.deposit_to_bank}
                on_close={interactions_hook.close_interaction}
                is_loading={interactions_hook.is_bank_loading}
              />
            )}
            {interactions_hook.interaction.type === 'merchant' && (
              <TradePanel
                mode="merchant"
                npc={interactions_hook.interaction.mob}
                source_items={merchant_hook?.merchant_stock?.[interactions_hook.interaction.merchant_id] || interactions_hook.interaction.stock || []}
                camp={interactions_hook.interaction.camp}
                get_item={get_item_from_cache}
                merchant_id={interactions_hook.interaction.merchant_id}
                currency={character_hook.currency}
                get_buy_price={merchant_hook?.get_buy_price}
                get_sell_price={merchant_hook?.get_sell_price}
                on_source_action={(merchant_id, item_id) => merchant_hook?.buy_from_merchant(merchant_id, item_id)}
                player_inventory={flat_inventory}
                on_player_action={(merchant_id, entry, qty) => merchant_hook?.sell_to_merchant(merchant_id, entry, qty)}
                on_close={interactions_hook.close_interaction}
                is_loading={interactions_hook.is_merchant_loading}
              />
            )}
            {interactions_hook.interaction.type === 'tradeskill' && (
              <TradePanel
                mode="tradeskill"
                npc={interactions_hook.interaction.mob}
                camp={interactions_hook.interaction.camp}
                tradeskill_name={interactions_hook.interaction.tradeskill_name}
                on_close={interactions_hook.close_interaction}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GameScreen
