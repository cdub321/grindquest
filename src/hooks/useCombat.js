import { useState, useEffect, useRef, useCallback } from 'react';
import { level_damage_multiplier } from '../utils/combatResolver';
import { resolve_hit, calculate_crit_chance, roll_damage, calculate_final_damage } from '../utils/combatResolver';
import { use_mob_ai } from './useMobAI';
import { use_mob_death } from './useMobDeath';
import { COMBAT_TIMEOUT_MS, MAX_COMBAT_LOG_MESSAGES, CRIT_CONSTANTS } from '../utils/gameConstants';

/**
 * Hook to manage combat state, mob interactions, and combat mechanics
 * 
 * @param {Object} params
 * @param {Object} params.character_data - Character data from useCharacterLoader
 * @param {number} params.level - Player level
 * @param {number} params.hp - Player current HP
 * @param {number} params.max_hp - Player max HP
 * @param {number} params.mana - Player current mana
 * @param {number} params.max_mana - Player max mana
 * @param {number} params.endurance - Player current endurance
 * @param {number} params.max_endurance - Player max endurance
 * @param {Function} params.set_hp - Function to set player HP
 * @param {Function} params.set_mana - Function to set player mana
 * @param {Function} params.set_endurance - Function to set player endurance
 * @param {Object} params.stat_totals - Total stats (base + gear + effects)
 * @param {Object} params.derived_stats - Derived stats (damage, attack delay, etc.)
 * @param {Object} params.total_bonuses - Total gear bonuses
 * @param {Function} params.get_stat_modifiers - Function from useEffects to get effect modifiers
 * @param {Function} params.add_log - Logging function
 * @param {Function} params.schedule_save - Save function from useCharacter
 * @param {Function} params.handle_death - Function from useCharacter to handle death
 * @param {Function} params.add_currency - Function to add currency (from useCharacter)
 * @param {Function} params.add_xp - Function to add XP (from useCharacter)
 * @param {Function} params.get_item_from_slot - Function from useInventory to get item from slot
 * @param {Function} params.set_item_in_slot - Function from useInventory to set item in slot
 * @param {Object|null} params.current_mob_from_zone - Current mob from useZone (or null)
 * @param {Function} params.set_current_mob_in_zone - Function to set current mob in useZone
 * @param {Object} params.current_mob_ref - Shared ref for current mob (from GameScreen, synced with state)
 * @param {number} params.mob_hp - Current mob HP (from parent state)
 * @param {number} params.mob_mana - Current mob mana (from parent state)
 * @param {number} params.mob_endurance - Current mob endurance (from parent state)
 * @param {number} params.mob_distance - Current mob distance (from parent state)
 * @param {Function} params.set_mob_hp - Function to set mob HP (from parent state)
 * @param {Function} params.set_mob_mana - Function to set mob mana (from parent state)
 * @param {Function} params.set_mob_endurance - Function to set mob endurance (from parent state)
 * @param {Function} params.set_mob_distance - Function to set mob distance (from parent state)
 * @param {number} params.tick_signal - Tick signal from useTickWorker (updates every second)
 * @returns {Object} Combat state and functions
 */
export function use_combat({
  character_data,
  level,
  hp,
  max_hp,
  mana,
  max_mana,
  endurance,
  max_endurance,
  set_hp,
  set_mana,
  set_endurance,
  stat_totals,
  derived_stats,
  total_bonuses,
  get_stat_modifiers,
  add_log,
  schedule_save,
  handle_death,
  add_currency,
  add_xp,
  add_item_to_inventory = null,
  get_item_from_slot = null,
  set_item_in_slot = null,
  current_mob_from_zone = null,
  set_current_mob_in_zone = null,
  current_mob_ref = null,
  mob_hp = 0,
  mob_mana = 0,
  mob_endurance = 0,
  mob_distance = 0,
  set_mob_hp,
  set_mob_mana,
  set_mob_endurance,
  set_mob_distance,
  tick_signal = null,
  is_stunned = null, // Function to check if target is stunned
  is_mezzed = null, // Function to check if target is mezzed
  break_mez = null, // Function to break mez on damage
  character_xp_mod, // Character XP modifier (race/class/deity combined)
  zone_xp_mod, // Zone XP modifier
  camp_xp_mod, // Camp XP modifier
  xp_bonus // Flat XP bonus from CHA stat
}) {
  // Combat state
  const [in_combat, set_in_combat] = useState(character_data?.in_combat || false);
  const [is_auto_attack, set_is_auto_attack] = useState(false);
  const [is_sitting, set_is_sitting] = useState(false);
  const [flee_exhausted, set_flee_exhausted] = useState(false);
  const [casting_state, set_casting_state] = useState(null);
  
  // Sync mob from useZone
  const current_mob = current_mob_from_zone;
  
  // Combat log
  const [combat_log, set_combat_log] = useState([]);
  
  // Refs for timers and state
  const combat_timer_ref = useRef(null);
  const auto_attack_timer_ref = useRef(null);
  const mob_attack_timer_ref = useRef(null);
  const last_player_attack_ref = useRef(0);
  const last_mob_attack_ref = useRef(0);
  // current_mob_ref is now passed in from GameScreen (shared ref)
  const mob_hp_ref = useRef(0);
  // Ref to store latest mob_attack_player callback (avoids useEffect re-runs)
  const mob_attack_player_ref = useRef(null);
  // Ref to store latest attack_mob callback (avoids useEffect re-runs)
  const attack_mob_ref = useRef(null);
  // Ref to track in_combat state (for interval callbacks)
  const in_combat_ref = useRef(in_combat);
  // Ref to track current mob ID (to detect when mob actually changes)
  const current_mob_id_ref = useRef(null);
  
  // Update mob_hp ref when state changes (current_mob_ref is synced in GameScreen)
  useEffect(() => {
    mob_hp_ref.current = mob_hp;
  }, [mob_hp]);
  
  // Update in_combat ref when state changes
  useEffect(() => {
    in_combat_ref.current = in_combat;
  }, [in_combat]);
  
  // Update current_mob_id ref when mob changes
  useEffect(() => {
    current_mob_id_ref.current = current_mob?.id || null;
  }, [current_mob?.id]);
  
  /**
   * Add message to combat log (max 200 messages)
   */
  const add_combat_log = useCallback((message, type = 'system') => {
    set_combat_log((prev) => {
      const new_log = [...prev, { id: Date.now() + Math.random(), message, type, timestamp: Date.now() }];
      // Keep only last MAX_COMBAT_LOG_MESSAGES
      return new_log.slice(-MAX_COMBAT_LOG_MESSAGES);
    });
    // Also call parent add_log if provided
    if (add_log) {
      add_log(message, type);
    }
  }, [add_log]);
  
  /**
   * Refresh combat timer (6 seconds of inactivity = exit combat)
   */
  const refresh_combat_timer = useCallback(() => {
    if (combat_timer_ref.current) {
      clearTimeout(combat_timer_ref.current);
    }
    combat_timer_ref.current = setTimeout(() => {
      set_in_combat(false);
    }, COMBAT_TIMEOUT_MS);
  }, []);
  
  // Mob death handler
  const mob_death_hook = use_mob_death({
    current_mob,
    current_mob_ref,
    add_combat_log,
    add_xp,
    add_currency,
    add_item_to_inventory,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    set_current_mob_in_zone,
    is_auto_attack,
    set_in_combat,
    schedule_save,
    player_level: level,
    character_xp_mod,
    zone_xp_mod,
    camp_xp_mod,
    xp_bonus
  });
  
  const handle_mob_death = mob_death_hook.handle_mob_death;
  
  // Reset combat state when mob is cleared
  useEffect(() => {
    if (!current_mob) {
      set_in_combat(false);
      // Save combat state immediately when exiting combat
      if (schedule_save) {
        schedule_save({
          character: {
            in_combat: false,
            last_combat_save: new Date().toISOString()
          }
        });
      }
    } else {
      // Reset death flag when a new mob spawns
      if (mob_death_hook.reset_mob_death_flag) {
        mob_death_hook.reset_mob_death_flag();
      }
    }
  }, [current_mob?.id, schedule_save, mob_death_hook]);
  
  // Mob AI: aggro checking and movement
  use_mob_ai({
    current_mob,
    current_mob_ref,
    mob_distance,
    set_mob_distance,
    in_combat,
    set_in_combat,
    add_log,
    tick_signal
  });
  
  
  /**
   * Player attacks mob
   */
  const attack_mob = useCallback(() => {
    if (!current_mob || mob_hp <= 0) return;
    
    // Check if player is casting
    if (casting_state) {
      add_combat_log('You cannot attack while casting!', 'error');
      return;
    }
    
    // Check if player is stunned
    if (is_stunned && is_stunned('player')) {
      add_combat_log('You are stunned and cannot attack!', 'error');
      return;
    }
    
    const mob = current_mob_ref.current || current_mob;
    const melee_range = mob.melee_range;
    
    if (!melee_range) {
      add_combat_log('Mob melee range not available.', 'error');
      return;
    }
    
    if (mob_distance > melee_range) {
      add_combat_log('You are too far away for melee.', 'error');
      return;
    }
    
    const now = Date.now();
    const attack_delay = derived_stats?.attack_delay;
    
    if (!attack_delay) {
      add_combat_log('Attack delay not available.', 'error');
      return;
    }
    
    // Check if enough time has passed since last attack
    if (now - last_player_attack_ref.current < attack_delay) {
      return; // Still on cooldown
    }
    
    // Enter combat if not already (even if non-KOS, player attacking triggers combat)
    if (!in_combat) {
      set_in_combat(true);
      // Save combat state immediately when entering combat
      if (schedule_save) {
        schedule_save({
          character: {
            in_combat: true,
            last_combat_save: new Date().toISOString()
          }
        });
      }
    }
    set_is_sitting(false);
    
    // Resolve hit/miss/dodge using utility
    const mob_agi = mob.stats?.agi || mob.agi || 0;
    const hit_result = resolve_hit({
      attacker_level: level || 1,
      defender_level: mob.level || 1,
      defender_agi: mob_agi
    });
    
    if (hit_result.missed) {
      add_combat_log(`You miss ${mob.name}.`, 'system');
      refresh_combat_timer();
      last_player_attack_ref.current = now;
      return;
    }
    
    if (hit_result.dodged) {
      set_in_combat(true);
      set_is_sitting(false);
      add_combat_log(`${mob.name} dodges your attack!`, 'system');
      refresh_combat_timer();
      last_player_attack_ref.current = now;
      return;
    }
    
    set_in_combat(true);
    set_is_sitting(false);
    refresh_combat_timer();
    last_player_attack_ref.current = now;
    
    // Calculate damage
    const player_mods = get_stat_modifiers ? get_stat_modifiers('player') || {} : {};
    const dmg_mult = 1 + (player_mods.damage || 0) / 100;
    const level_mult = level_damage_multiplier(level || 1, mob.level || 1);
    
    // Roll damage using utility
    const base_damage = roll_damage(
      derived_stats.min_damage || 1,
      derived_stats.max_damage || 1
    );
    const modified_damage = Math.floor(base_damage * dmg_mult);
    
    // Calculate crit chance using utility
    const crit_chance = calculate_crit_chance({
      attacker_dex: stat_totals?.dex || 0,
      attacker_level: level || 1,
      defender_level: mob.level || 1,
      base_crit_chance: CRIT_CONSTANTS.BASE_CRIT_CHANCE
    });
    
    const damage_result = calculate_final_damage({
      base_damage: modified_damage,
      is_spell: false,
      school: 'physical',
      target_ac: mob.ac || 0,
      target_resist: 0,
      level_multiplier: level_mult,
      crit_chance,
      crit_multiplier: CRIT_CONSTANTS.CRIT_DAMAGE_MULTIPLIER
    });
    const final_damage = damage_result.damage;
    
    // Break mez on damage (mez breaks when target takes damage)
    if (break_mez && is_mezzed && is_mezzed('mob')) {
      break_mez('mob');
      add_combat_log('The mesmerizing effect is broken!', 'system');
    }
    
    // Apply damage
    const new_mob_hp = Math.max(0, mob_hp - final_damage);
    set_mob_hp(new_mob_hp);
    const crit_msg = damage_result.is_crit ? ' (CRITICAL!)' : '';
    add_combat_log(`You hit ${mob.name} for ${final_damage} damage${crit_msg}!`, 'damage');
    
    // Check for mob death
    if (new_mob_hp <= 0) {
      handle_mob_death();
    }
  }, [
    current_mob,
    mob_hp,
    mob_distance,
    level,
    derived_stats,
    get_stat_modifiers,
    add_combat_log,
    refresh_combat_timer,
    handle_mob_death,
    stat_totals
  ]);
  
  /**
   * Player performs ranged attack on mob
   */
  const ranged_attack_mob = useCallback(() => {
    if (!current_mob || mob_hp <= 0) return;
    
    // Check for ranged weapon in slot 11 (RANGE)
    const ranged_weapon = get_item_from_slot ? get_item_from_slot(11) : null;
    if (!ranged_weapon) {
      if (add_combat_log) add_combat_log('No ranged weapon equipped.', 'error');
      return;
    }
    
    // Check weapon has ranged damage
    const ranged_damage = ranged_weapon.bonuses?.ranged_damage || ranged_weapon.bonuses?.damage || 0;
    if (ranged_damage <= 0) {
      if (add_combat_log) add_combat_log('Ranged weapon has no damage.', 'error');
      return;
    }
    
    // Check range
    const weapon_range = ranged_weapon.bonuses?.range || ranged_weapon.range;
    if (!weapon_range) {
      if (add_combat_log) add_combat_log('Ranged weapon range not available.', 'error');
      return;
    }
    if (mob_distance > weapon_range) {
      if (add_combat_log) add_combat_log('Target is out of range.', 'error');
      return;
    }
    
    // Check for ammo in slot 22 (AMMO) if weapon requires it
    const needs_ammo = ranged_weapon.bonuses?.ammo_consumption || ranged_weapon.ammo_consumption || false;
    if (needs_ammo) {
      const ammo = get_item_from_slot ? get_item_from_slot(22) : null;
      const ammo_type = ranged_weapon.bonuses?.ammo_type || ranged_weapon.ammo_type || null;
      
      if (!ammo) {
        if (add_combat_log) add_combat_log('No ammo equipped.', 'error');
        return;
      }
      
      // Check ammo compatibility
      const matches_ammo = !ammo_type || 
        ammo_type === ammo.base_item_id ||
        ammo_type === ammo.ammo_type ||
        ammo_type === ammo.bonuses?.ammo_type;
      
      if (!matches_ammo) {
        if (add_combat_log) add_combat_log('Incompatible ammo type.', 'error');
        return;
      }
      
      // Consume ammo
      if (set_item_in_slot && ammo.quantity) {
        if (ammo.quantity <= 1) {
          set_item_in_slot(22, null);
        } else {
          set_item_in_slot(22, { ...ammo, quantity: ammo.quantity - 1 });
        }
      }
    }
    
    const mob = current_mob_ref.current || current_mob;
    const now = Date.now();
    const attack_delay = ranged_weapon.bonuses?.ranged_delay || ranged_weapon.bonuses?.delay;
    
    if (!attack_delay) {
      if (add_combat_log) add_combat_log('Ranged weapon delay not available.', 'error');
      return;
    }
    
    // Check if enough time has passed since last attack
    if (now - last_player_attack_ref.current < attack_delay) {
      return; // Still on cooldown
    }
    
    // Resolve hit/miss/dodge using utility
    const mob_agi = mob.stats?.agi || mob.agi || 0;
    const hit_result = resolve_hit({
      attacker_level: level || 1,
      defender_level: mob.level || 1,
      defender_agi: mob_agi
    });
    
    if (hit_result.missed) {
      set_in_combat(true);
      set_is_sitting(false);
      add_combat_log(`You miss ${mob.name}.`, 'system');
      refresh_combat_timer();
      last_player_attack_ref.current = now;
      return;
    }
    
    if (hit_result.dodged) {
      set_in_combat(true);
      set_is_sitting(false);
      add_combat_log(`${mob.name} dodges your attack!`, 'system');
      refresh_combat_timer();
      last_player_attack_ref.current = now;
      return;
    }
    
    set_in_combat(true);
    set_is_sitting(false);
    refresh_combat_timer();
    last_player_attack_ref.current = now;
    
    // Calculate damage (ranged uses DEX bonus instead of STR)
    const player_mods = get_stat_modifiers ? get_stat_modifiers('player') || {} : {};
    const dmg_mult = 1 + (player_mods.damage || 0) / 100;
    const level_mult = level_damage_multiplier(level || 1, mob.level || 1);
    
    // DEX bonus for ranged (floor(DEX / 10))
    const dex_bonus = Math.floor((stat_totals?.dex || 0) / 10);
    
    // Base damage from weapon
    const base_damage = ranged_damage + dex_bonus;
    const modified_damage = Math.floor(base_damage * dmg_mult);
    
    // Calculate crit chance using utility
    const crit_chance = calculate_crit_chance({
      attacker_dex: stat_totals?.dex || 0,
      attacker_level: level || 1,
      defender_level: mob.level || 1,
      base_crit_chance: CRIT_CONSTANTS.BASE_CRIT_CHANCE
    });
    
    const damage_result = calculate_final_damage({
      base_damage: modified_damage,
      is_spell: false,
      school: 'physical',
      target_ac: mob.ac || 0,
      target_resist: 0,
      level_multiplier: level_mult,
      crit_chance,
      crit_multiplier: CRIT_CONSTANTS.CRIT_DAMAGE_MULTIPLIER
    });
    const final_damage = damage_result.damage;
    
    // Apply damage
    const new_mob_hp = Math.max(0, mob_hp - final_damage);
    set_mob_hp(new_mob_hp);
    const crit_msg = damage_result.is_crit ? ' (CRITICAL!)' : '';
    add_combat_log(`You hit ${mob.name} for ${final_damage} ranged damage${crit_msg}!`, 'damage');
    
    // Check for mob death
    if (new_mob_hp <= 0) {
      handle_mob_death();
    }
  }, [
    current_mob,
    mob_hp,
    mob_distance,
    level,
    stat_totals,
    get_stat_modifiers,
    add_combat_log,
    refresh_combat_timer,
    handle_mob_death,
    get_item_from_slot,
    set_item_in_slot
  ]);
  
  /**
   * Mob attacks player
   */
  const mob_attack_player = useCallback(() => {
    if (!current_mob || mob_hp <= 0) return;
    if (hp <= 0) return; // Player already dead
    
    const mob = current_mob_ref.current || current_mob;
    
    // Check if mob is stunned
    if (is_stunned && is_stunned('mob')) {
      return; // Mob is stunned, cannot attack
    }
    
    // Check if mob is in range
    const melee_range = mob.melee_range;
    if (!melee_range) {
      return; // Mob melee range not available
    }
    if (mob_distance > melee_range) {
      return; // Mob too far
    }
    
    // Update last attack time (timing is handled by setInterval in useEffect)
    last_mob_attack_ref.current = Date.now();
    set_in_combat(true);
    set_is_sitting(false);
    refresh_combat_timer();
    
    // Resolve hit/miss/dodge using utility
    const player_agi = stat_totals?.agi || 0;
    const hit_result = resolve_hit({
      attacker_level: mob.level || 1,
      defender_level: level || 1,
      defender_agi: player_agi
    });
    
    if (hit_result.missed) {
      add_combat_log(`${mob.name} misses you!`, 'system');
      return;
    }
    
    if (hit_result.dodged) {
      add_combat_log(`You dodge ${mob.name}'s attack!`, 'system');
      return;
    }
    
    // Calculate mob damage
    const mob_mods = get_stat_modifiers ? get_stat_modifiers('mob') || {} : {};
    const mob_dmg_mult = 1 + (mob_mods.damage || 0) / 100;
    const level_mult = level_damage_multiplier(mob.level || 1, level || 1);
    const base_mob_damage = (mob.damage || 1) * mob_dmg_mult;
    const modified_damage = Math.floor(base_mob_damage * level_mult);
    
    // Check if spell damage
    const is_spell = mob.damage_type === 'spell';
    const school = mob.damage_school || 'magic';
    const player_resist = is_spell ? (stat_totals?.[school === 'fire' ? 'fr' : school === 'cold' ? 'cr' : school === 'poison' ? 'pr' : school === 'disease' ? 'dr' : 'mr'] || 0) : 0;
    
    // Mob crit chance
    const mob_crit_chance = CRIT_CONSTANTS.MOB_CRIT_CHANCE;
    
    const damage_result = calculate_final_damage({
      base_damage: modified_damage,
      is_spell,
      school,
      target_ac: total_bonuses?.ac || 0,
      target_resist: player_resist,
      level_multiplier: level_mult,
      crit_chance: mob_crit_chance,
      crit_multiplier: CRIT_CONSTANTS.CRIT_DAMAGE_MULTIPLIER
    });
    const final_damage = damage_result.damage;
    
    // Apply damage
    const new_hp = Math.max(0, hp - final_damage);
    set_hp(new_hp);
    add_combat_log(`${mob.name} hits you for ${final_damage} ${is_spell ? school : 'physical'} damage!`, 'mobattack');
    
    // Check for player death
    if (new_hp <= 0) {
      handle_death(mob.name);
    }
  }, [
    current_mob,
    mob_hp,
    mob_distance,
    hp,
    level,
    stat_totals,
    total_bonuses,
    get_stat_modifiers,
    add_combat_log,
    refresh_combat_timer,
    handle_death,
    stat_totals,
    is_stunned,
    is_mezzed,
    break_mez
  ]);
  
  // Store latest mob_attack_player callback in ref (prevents useEffect re-runs)
  useEffect(() => {
    mob_attack_player_ref.current = mob_attack_player;
  }, [mob_attack_player]);
  
  // Store latest attack_mob callback in ref (prevents useEffect re-runs)
  useEffect(() => {
    attack_mob_ref.current = attack_mob;
  }, [attack_mob]);
  
  // Ref to track attack_delay (for interval callbacks)
  const attack_delay_ref = useRef(null);
  useEffect(() => {
    attack_delay_ref.current = derived_stats?.attack_delay || null;
  }, [derived_stats?.attack_delay]);
  
  /**
   * Auto-attack system
   * Uses setInterval for precise millisecond timing (same as mob attacks)
   * Restarts interval when attack_delay changes (e.g., haste/slow effects)
   */
  useEffect(() => {
    // Early exit conditions
    if (!is_auto_attack || !current_mob || mob_hp <= 0) {
      // Clear timer if conditions not met
      if (auto_attack_timer_ref.current) {
        clearInterval(auto_attack_timer_ref.current);
        auto_attack_timer_ref.current = null;
      }
      return;
    }
    
    const attack_delay = derived_stats?.attack_delay;
    if (!attack_delay) {
      // Clear timer if no attack delay
      if (auto_attack_timer_ref.current) {
        clearInterval(auto_attack_timer_ref.current);
        auto_attack_timer_ref.current = null;
      }
      return;
    }
    
    // Attack delay is stored in milliseconds (same as mob delay)
    // No conversion needed - use directly
    const delay_ms = attack_delay;
    
    // Cleanup function for the interval
    const cleanup = () => {
      if (auto_attack_timer_ref.current) {
        clearInterval(auto_attack_timer_ref.current);
        auto_attack_timer_ref.current = null;
      }
    };
    
    // Restart interval if: timer doesn't exist OR attack_delay changed
    // (We need to restart when delay changes to reflect haste/slow effects)
    const should_restart = !auto_attack_timer_ref.current || 
                          attack_delay_ref.current !== attack_delay;
    
    if (should_restart) {
      // Clear existing timer before creating new one
      cleanup();
      
      // Update ref
      attack_delay_ref.current = attack_delay;
      
      // Set up interval for attacks
      auto_attack_timer_ref.current = setInterval(() => {
        // Check conditions inside interval (they may have changed)
        if (!attack_mob_ref.current) return;
        
        // Use refs for all checks (avoid stale closures)
        const current_mob_check = current_mob_ref.current;
        if (!current_mob_check || mob_hp_ref.current <= 0) {
          cleanup();
          set_is_auto_attack(false);
          return;
        }
        
        // Call attack function (it handles its own delay check internally)
        attack_mob_ref.current();
      }, delay_ms);
      
      // First attack happens immediately when auto-attack is enabled or delay changes
      if (attack_mob_ref.current) {
        attack_mob_ref.current();
        last_player_attack_ref.current = Date.now();
      }
    }
    
    // Cleanup on unmount or when dependencies change
    return cleanup;
  }, [is_auto_attack, current_mob?.id, mob_hp, derived_stats?.attack_delay, set_is_auto_attack]);
  
  /**
   * Mob AI - mob attacks player on delay
   * Uses setInterval for precise timing (tick_signal is only for background persistence checks)
   */
  useEffect(() => {
    // Early exit conditions
    if (!current_mob || mob_hp <= 0 || hp <= 0) {
      // Clear timer if conditions not met
      if (mob_attack_timer_ref.current) {
        clearInterval(mob_attack_timer_ref.current);
        mob_attack_timer_ref.current = null;
      }
      last_mob_attack_ref.current = 0;
      return;
    }
    
    if (!in_combat) {
      // Clear timer if not in combat
      if (mob_attack_timer_ref.current) {
        clearInterval(mob_attack_timer_ref.current);
        mob_attack_timer_ref.current = null;
      }
      last_mob_attack_ref.current = 0;
      return; // Only attack when in combat
    }
    
    const mob = current_mob_ref.current || current_mob;
    if (!mob) return;
    
    const mob_delay = mob.delay;
    if (!mob_delay) return;
    
    // Mob delay is stored in milliseconds (same as player attack_speed)
    // No conversion needed - use directly
    const delay_ms = mob_delay;
    const current_mob_id = current_mob?.id;
    
    // Restart interval if:
    // 1. Timer doesn't exist (always start if in combat and no timer), OR
    // 2. Mob ID changed
    const should_restart = !mob_attack_timer_ref.current || 
                          current_mob_id_ref.current !== current_mob_id;
    
    if (should_restart) {
      // Clear existing timer before creating new one
      if (mob_attack_timer_ref.current) {
        clearInterval(mob_attack_timer_ref.current);
        mob_attack_timer_ref.current = null;
      }
      
      // Reset attack timer for new mob
      last_mob_attack_ref.current = 0;
      current_mob_id_ref.current = current_mob_id;
      
      // Set up interval for attacks
      mob_attack_timer_ref.current = setInterval(() => {
        // Check conditions inside interval (they may have changed)
        if (!mob_attack_player_ref.current) return;
        
        // Use refs for all checks (avoid stale closures)
        const current_mob_check = current_mob_ref.current;
        if (!current_mob_check || mob_hp_ref.current <= 0 || !in_combat_ref.current) {
          if (mob_attack_timer_ref.current) {
            clearInterval(mob_attack_timer_ref.current);
            mob_attack_timer_ref.current = null;
          }
          return;
        }
        
        // Call attack function
        mob_attack_player_ref.current();
        last_mob_attack_ref.current = Date.now();
      }, delay_ms);
      
      // First attack happens immediately on combat start (new mob or combat just started)
      if (mob_attack_player_ref.current) {
        mob_attack_player_ref.current();
        last_mob_attack_ref.current = Date.now();
      }
    }
    
    // Cleanup
    return () => {
      if (mob_attack_timer_ref.current) {
        clearInterval(mob_attack_timer_ref.current);
        mob_attack_timer_ref.current = null;
      }
    };
  }, [current_mob?.id, in_combat, current_mob_ref]);
  
  /**
   * Combat state save operations
   */
  useEffect(() => {
    if (!character_data?.id) return;
    
    const save_combat_state = () => {
      const mob_payload = current_mob ? {
        ...current_mob,
        hp: mob_hp,
        mana: mob_mana,
        endurance: mob_endurance,
        distance: mob_distance
      } : null;
      
      schedule_save({
        character: {
          current_mob: mob_payload,
          in_combat: in_combat,
          last_combat_save: new Date().toISOString(),
          current_hp: hp,
          current_mana: mana,
          current_endurance: endurance
        }
      });
    };
    
    // Save combat state every 2 seconds when in combat
    // Also save vitals periodically when not in combat (every 3 seconds)
    if (in_combat && current_mob) {
      const interval = setInterval(save_combat_state, 2000);
      return () => clearInterval(interval);
    } else {
      // Save vitals when not in combat
      const interval = setInterval(() => {
        schedule_save({
          character: {
            current_hp: hp,
            current_mana: mana,
            current_endurance: endurance
          }
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [character_data?.id, current_mob, mob_hp, mob_mana, mob_endurance, mob_distance, in_combat, hp, mana, endurance, schedule_save]);
  
  // Check if attack is on cooldown (for UI)
  const is_attack_on_cooldown = useCallback(() => {
    const now = Date.now();
    const attack_delay = derived_stats?.attack_delay;
    if (!attack_delay) return false;
    return (now - last_player_attack_ref.current) < attack_delay;
  }, [derived_stats?.attack_delay]);

  return {
    // State
    in_combat,
    is_auto_attack,
    is_sitting,
    flee_exhausted,
    casting_state,
    current_mob,
    mob_hp, // Read from props
    mob_mana, // Read from props
    mob_endurance, // Read from props
    mob_distance, // Read from props
    combat_log,
    
    // Functions
    set_in_combat,
    set_is_auto_attack,
    set_is_sitting,
    set_flee_exhausted,
    set_casting_state,
    is_attack_on_cooldown,
    // Note: set_mob_hp, set_mob_mana, set_mob_endurance, set_mob_distance are passed as props
    // and managed by parent, so we don't return them
    add_combat_log,
    refresh_combat_timer,
    attack_mob,
    ranged_attack_mob,
    mob_attack_player,
    handle_mob_death
  };
}

