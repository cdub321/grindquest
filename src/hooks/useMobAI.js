import { useEffect, useRef, useCallback } from 'react';
import { UNIVERSAL_TICK_INTERVAL_MS } from '../utils/gameConstants';

/**
 * Hook to manage mob AI behavior: aggro checking and movement
 * 
 * @param {Object} params
 * @param {Object|null} params.current_mob - Current mob from useZone (or null)
 * @param {Object} params.current_mob_ref - Shared ref for current mob (from GameScreen, synced with state)
 * @param {number} params.mob_distance - Current mob distance (from parent state)
 * @param {Function} params.set_mob_distance - Function to set mob distance (from parent state)
 * @param {boolean} params.in_combat - Current combat state
 * @param {Function} params.set_in_combat - Function to set combat state
 * @param {Function} params.add_log - Logging function
 * @param {number} params.tick_signal - Tick signal from useTickWorker (updates every second)
 * @returns {Object} Mob AI functions and state
 */
export function use_mob_ai({
  current_mob = null,
  current_mob_ref = null,
  mob_distance = 0,
  set_mob_distance,
  in_combat = false,
  set_in_combat,
  add_log = null,
  tick_signal = null
}) {
  const mob_movement_timer_ref = useRef(null);
  const last_mob_movement_tick_ref = useRef(0);
  const last_mob_id_ref = useRef(null);

  /**
   * Check if mob should aggro on spawn
   */
  const check_aggro = useCallback((mob, spawn_distance) => {
    if (!mob) return false;
    const aggro_range = Number(mob.aggro_range) || 0;
    return spawn_distance <= aggro_range;
  }, []);

  /**
   * Check aggro when mob spawns (triggered by new mob ID)
   */
  useEffect(() => {
    if (!current_mob || mob_distance === 0) {
      last_mob_id_ref.current = null;
      return;
    }
    
    // Only check aggro once when a new mob spawns (mob ID changes)
    if (current_mob.id === last_mob_id_ref.current) return;
    last_mob_id_ref.current = current_mob.id;
    
    // Don't check aggro if already in combat (from previous mob or player action)
    if (in_combat) return;
    
    const should_aggro = check_aggro(current_mob, mob_distance);
    if (should_aggro && current_mob.is_kos !== false) {
      set_in_combat(true);
      if (add_log) {
        add_log(`${current_mob.name} aggroes!`, 'combat');
      }
    }
  }, [current_mob?.id, mob_distance, check_aggro, in_combat, set_in_combat, add_log]);

  /**
   * Mob movement toward player (uses tick_signal to keep running when tab is hidden)
   */
  useEffect(() => {
    if (!tick_signal) {
      // Fallback to setInterval if tick_signal not available
      if (!current_mob_ref?.current) return;
      
      const mob = current_mob_ref.current;
      const melee_range = Number(mob.melee_range);
      if (!melee_range) return;
      const current_distance = mob.distance || 0;
      
      if (current_distance <= melee_range) return;
      
      mob_movement_timer_ref.current = setInterval(() => {
        const mob_current = current_mob_ref.current;
        if (!mob_current) {
          if (mob_movement_timer_ref.current) {
            clearInterval(mob_movement_timer_ref.current);
            mob_movement_timer_ref.current = null;
          }
          return;
        }
        
        const distance = mob_current.distance || 0;
        const melee = Number(mob_current.melee_range);
        if (!melee) {
          if (mob_movement_timer_ref.current) {
            clearInterval(mob_movement_timer_ref.current);
            mob_movement_timer_ref.current = null;
          }
          return;
        }
        const movespeed = Math.max(0.1, Number(mob_current.movespeed) || 1);
        
        const movement_per_tick = movespeed * (UNIVERSAL_TICK_INTERVAL_MS / 1000);
        const new_distance = Math.max(melee, distance - movement_per_tick);
        
        mob_current.distance = new_distance;
        if (set_mob_distance) {
          set_mob_distance(new_distance);
        }
        
        if (new_distance <= melee && mob_current.is_kos !== false) {
          if (!in_combat) {
            set_in_combat(true);
            if (add_log) {
              add_log(`${mob_current.name} reaches melee range!`, 'combat');
            }
          }
        }
        
        if (new_distance <= melee) {
          if (mob_movement_timer_ref.current) {
            clearInterval(mob_movement_timer_ref.current);
            mob_movement_timer_ref.current = null;
          }
        }
      }, UNIVERSAL_TICK_INTERVAL_MS);
      
      return () => {
        if (mob_movement_timer_ref.current) {
          clearInterval(mob_movement_timer_ref.current);
          mob_movement_timer_ref.current = null;
        }
      };
    }
    
    // Use tick_signal for mob movement (keeps running when tab is hidden)
    if (!current_mob_ref?.current) return;
    
    const mob = current_mob_ref.current;
    const melee_range = Number(mob.melee_range);
    if (!melee_range) {
      last_mob_movement_tick_ref.current = 0;
      return;
    }
    const current_distance = mob.distance || 0;
    
    if (current_distance <= melee_range) {
      last_mob_movement_tick_ref.current = 0;
      return;
    }
    
    const now = tick_signal;
    const elapsed = now - last_mob_movement_tick_ref.current;
    
    if (elapsed >= UNIVERSAL_TICK_INTERVAL_MS || last_mob_movement_tick_ref.current === 0) {
      const mob_current = current_mob_ref.current;
      if (!mob_current) return;
      
      const distance = mob_current.distance || 0;
      const melee = Number(mob_current.melee_range);
      if (!melee) return;
      const movespeed = Math.max(0.1, Number(mob_current.movespeed) || 1);
      
      const movement_per_tick = movespeed * (UNIVERSAL_TICK_INTERVAL_MS / 1000);
      const new_distance = Math.max(melee, distance - movement_per_tick);
      
      mob_current.distance = new_distance;
      if (set_mob_distance) {
        set_mob_distance(new_distance);
      }
      
      if (new_distance <= melee && mob_current.is_kos !== false) {
        if (!in_combat) {
          set_in_combat(true);
          if (add_log) {
            add_log(`${mob_current.name} reaches melee range!`, 'combat');
          }
        }
      }
      
      last_mob_movement_tick_ref.current = now;
    }
  }, [tick_signal, current_mob_ref, set_mob_distance, in_combat, set_in_combat, add_log]);

  return {
    check_aggro
  };
}
