import { useState, useEffect, useRef, useCallback } from 'react';
import { parse_spell_effects } from '../utils/spellEffectParser';
import { UNIVERSAL_TICK_INTERVAL_MS } from '../utils/gameConstants';
import { apply_resist_reduction, resolve_resist } from '../utils/combatResolver';

/**
 * Custom hook for managing active spell effects (DoT, HoT, Buffs, Debuffs)
 * Handles periodic ticking and effect expiration
 * Also handles regeneration on the universal 4-second tick
 * 
 * @param {Object} params
 * @param {Function} params.set_hp - Function to set player HP
 * @param {number} params.max_hp - Player max HP
 * @param {Function} params.set_mana - Function to set player mana
 * @param {number} params.max_mana - Player max mana
 * @param {Function} params.set_endurance - Function to set player endurance
 * @param {number} params.max_endurance - Player max endurance
 * @param {Function} params.set_mob_hp - Function to set mob HP
 * @param {Function} params.set_mob_mana - Function to set mob mana
 * @param {Function} params.set_mob_endurance - Function to set mob endurance
 * @param {Object|null} params.current_mob - Current mob object
 * @param {Function} params.add_log - Function to add log messages
 * @param {Function} params.handle_mob_death - Callback when mob dies
 * @param {Array} params.initial_player_effects - Initial player effects from character load
 * @param {Function} params.schedule_save - Function to schedule character save
 * @param {Function} params.get_hp_regen_rate - Function to get HP regen rate (in_combat, is_sitting)
 * @param {Function} params.get_mana_regen_rate - Function to get mana regen rate (in_combat, is_sitting)
 * @param {Function} params.get_endurance_regen_rate - Function to get endurance regen rate (in_combat, is_sitting)
 * @param {boolean} params.in_combat - Whether player is in combat
 * @param {boolean} params.is_sitting - Whether player is sitting
 * @param {number} params.tick_signal - Tick signal from useTickWorker (updates every second)
 * @returns {Object} Effects management functions and state
 */
export function use_effects({
  set_hp,
  max_hp,
  set_mana,
  max_mana,
  set_endurance,
  max_endurance,
  set_mob_hp,
  set_mob_mana,
  set_mob_endurance,
  current_mob,
  add_log,
  handle_mob_death,
  initial_player_effects = [],
  schedule_save,
  get_hp_regen_rate = null,
  get_mana_regen_rate = null,
  get_endurance_regen_rate = null,
  in_combat = false,
  is_sitting = false,
  tick_signal = null
}) {
  const [player_effects, set_player_effects] = useState(initial_player_effects);
  const [mob_effects, set_mob_effects] = useState([]);
  
  const last_tick_ref = useRef(Date.now());
  const logged_expires_this_tick_ref = useRef(new Set());
  const processed_effects_this_tick_ref = useRef(new Set());
  
  // Refs for regen state (updated via useEffect when props change)
  const regen_state_ref = useRef({
    get_hp_regen_rate,
    get_mana_regen_rate,
    get_endurance_regen_rate,
    in_combat,
    is_sitting,
  });
  
  // Update regen state ref when props change
  useEffect(() => {
    regen_state_ref.current = {
      get_hp_regen_rate,
      get_mana_regen_rate,
      get_endurance_regen_rate,
      in_combat,
      is_sitting,
    };
  }, [get_hp_regen_rate, get_mana_regen_rate, get_endurance_regen_rate, in_combat, is_sitting]);
  
  // Function to update regen state (called from GameScreen after combat_hook initializes)
  const update_regen_state = useCallback((new_state) => {
    regen_state_ref.current = {
      ...regen_state_ref.current,
      ...new_state
    };
  }, []);

  /**
   * Process ticking effects for a target (player or mob).
   * Returns updated effects plus accumulated resource deltas.
   */
  const process_effects_for_target = useCallback(({
    effects,
    target,
    now,
    current_mob_param = null
  }) => {
    const updated = [];
    let hp_change = 0;
    let mana_change = 0;
    let endurance_change = 0;

    effects.forEach((effect) => {
      const is_expiring = effect.expires_at_ms && effect.expires_at_ms <= now;

      // Process DoT/HoT ticks (including final tick on expiration)
      if (effect.tick_damage || effect.tick_heal) {
        const effect_key = `${target}-dot-${effect.id || effect.spell_id || effect.name}-${now}`;
        if (!processed_effects_this_tick_ref.current.has(effect_key)) {
          processed_effects_this_tick_ref.current.add(effect_key);

          if (target === 'mob') {
            // Get mob resist (default to 0 if not available)
            const mob_resist = current_mob_param?.resist || current_mob_param?.stats?.resist || 0;
            const base_damage_before_resist = effect.tick_damage || 0;
            let final_tick_damage = base_damage_before_resist;
            let final_tick_heal = effect.tick_heal || 0;

            if (final_tick_damage > 0) {
              // Apply resist reduction to DoT damage
              const damage_before_resist = final_tick_damage;
              final_tick_damage = apply_resist_reduction(damage_before_resist, mob_resist);

              const base_damage = effect.base_tick_damage || 0;
              const cha_mod = effect.caster_cha ? (1 + (effect.caster_cha / 10 / 100)) : 1;
              const resist_reduction = damage_before_resist - final_tick_damage;

              const tick_value = -final_tick_damage;
              hp_change += tick_value;

              // Detailed damage formula logging
              if (add_log && current_mob_param) {
                add_log(
                  `${current_mob_param.name} takes ${Math.floor(final_tick_damage)} damage from ${effect.name}. ` +
                  `[Base: ${Math.floor(base_damage)} + CHA+${Math.floor((cha_mod - 1) * 100)}%: ${Math.floor(damage_before_resist)} + Resist-${mob_resist}%: -${Math.floor(resist_reduction)} = ${Math.floor(final_tick_damage)}]`,
                  'damage'
                );
              }
            } else if (final_tick_heal > 0) {
              const tick_value = final_tick_heal;
              hp_change += tick_value;

              if (add_log && current_mob_param) {
                add_log(`${current_mob_param.name} heals for ${Math.floor(final_tick_heal)} from ${effect.name}.`, 'heal');
              }
            }
          } else {
            // Player
            let final_tick_damage = effect.tick_damage || 0;
            let final_tick_heal = effect.tick_heal || 0;

            if (final_tick_damage > 0) {
              const tick_value = -final_tick_damage;
              hp_change += tick_value;

              if (add_log) {
                const base_damage = effect.base_tick_damage || 0;
                const cha_mod = effect.caster_cha ? (1 + (effect.caster_cha / 10 / 100)) : 1;
                add_log(
                  `You take ${Math.floor(final_tick_damage)} damage from ${effect.name}. ` +
                  `[Base: ${Math.floor(base_damage)} + CHA+${Math.floor((cha_mod - 1) * 100)}%: ${Math.floor(base_damage * cha_mod)} + Resist-0%: -0 = ${Math.floor(final_tick_damage)}]`,
                  'damage'
                );
              }
            } else if (final_tick_heal > 0) {
              const tick_value = final_tick_heal;
              hp_change += tick_value;

              if (add_log) {
                add_log(`You heal for ${Math.floor(final_tick_heal)} from ${effect.name}.`, 'heal');
              }
            }
          }
        }
      }

      // Check if expired (after processing final tick)
      if (is_expiring) {
        if (effect.on_expire) {
          // Use effect ID to prevent duplicate logs
          const expire_key = `${target}-${effect.id || effect.spell_id || effect.name}`;
          if (!logged_expires_this_tick_ref.current.has(expire_key)) {
            logged_expires_this_tick_ref.current.add(expire_key);
            add_log(effect.on_expire, 'system');
          }
        }
        return; // Skip expired effects (don't add to updated)
      }

      // Accumulate resource ticks
      if (effect.tick_mana) {
        mana_change += effect.tick_mana;
      }
      if (effect.tick_endurance) {
        endurance_change += effect.tick_endurance;
      }

      // Not expired, keep it
      updated.push(effect);
    });

    return { updated, hp_change, mana_change, endurance_change };
  }, [add_log]);

  /**
   * Serialize effects to database format (active_effects JSONB)
   * Helper function that takes effects as parameters (for use in callbacks)
   * @param {Array} player_effs - Player effects array
   * @param {Array} mob_effs - Mob effects array
   * @returns {Array} Serialized effects array
   */
  const serialize_effects_to_db_for_save = useCallback((player_effs) => {
    const now = Date.now();
    
    // Only serialize player effects - mob effects are temporary and shouldn't be persisted
    return player_effs
      .filter((e) => {
        // Only include non-expired duration effects
        return e.expires_at_ms && e.expires_at_ms > now;
      })
      .map((e) => ({
        spell_id: e.spell_id || null,
        name: e.name || 'Effect',
        target: 'player', // Always player for saved effects
        effects: e.effects || [], // Store raw effects array from spell
        buffduration: e.buffduration || 0,
        expires_at: new Date(e.expires_at_ms).toISOString(),
        icon: e.icon || null,
        caster_cha: e.caster_cha || 0
      }));
  }, []);

  // Clear mob effects when mob changes or mob dies
  useEffect(() => {
    if (!current_mob || (current_mob.hp !== undefined && current_mob.hp <= 0)) {
      set_mob_effects([]);
    }
  }, [current_mob?.id, current_mob?.hp]);

    // Universal 4-second tick system for DoTs/HoTs
  // Uses tick_signal from useTickWorker to keep running when tab is hidden
  useEffect(() => {
    if (!tick_signal) return;
    
    const now = tick_signal;
    const elapsed = now - last_tick_ref.current;
    
    // Only process if at least 4 seconds have passed
    if (elapsed < UNIVERSAL_TICK_INTERVAL_MS) return;
    
    last_tick_ref.current = now;

    // Reset logged expires set and processed effects set for this tick
    logged_expires_this_tick_ref.current.clear();
    processed_effects_this_tick_ref.current.clear();

    // Process player effects
    set_player_effects((prev_effects) => {
      const { updated, hp_change, mana_change, endurance_change } = process_effects_for_target({
        effects: prev_effects,
        target: 'player',
        now
      });

      if (hp_change !== 0) {
        set_hp((prev) => Math.max(0, Math.min(max_hp, prev + hp_change)));
      }

      if (mana_change !== 0) {
        set_mana((prev) => Math.max(0, Math.min(max_mana, prev + mana_change)));
      }

      if (endurance_change !== 0) {
        set_endurance((prev) => Math.max(0, Math.min(max_endurance, prev + endurance_change)));
      }

      return updated;
    });

    // Apply regeneration (on same 4-second tick)
    const regen_state = regen_state_ref.current;
    if (regen_state.get_hp_regen_rate && regen_state.get_mana_regen_rate && regen_state.get_endurance_regen_rate) {
      const hp_regen = regen_state.get_hp_regen_rate(regen_state.in_combat, regen_state.is_sitting);
      const mana_regen = regen_state.get_mana_regen_rate(regen_state.in_combat, regen_state.is_sitting);
      const endurance_regen = regen_state.get_endurance_regen_rate(regen_state.in_combat, regen_state.is_sitting);

      if (hp_regen > 0) {
        set_hp((prev) => Math.min(max_hp, prev + hp_regen));
      }
      if (mana_regen > 0) {
        set_mana((prev) => Math.min(max_mana, prev + mana_regen));
      }
      if (endurance_regen > 0) {
        set_endurance((prev) => Math.min(max_endurance, prev + endurance_regen));
      }
    }

    // Process mob effects
    set_mob_effects((prev_effects) => {
      const { updated, hp_change, mana_change, endurance_change } = process_effects_for_target({
        effects: prev_effects,
        target: 'mob',
        now,
        current_mob_param: current_mob
      });

      if (hp_change !== 0 && current_mob && set_mob_hp) {
        set_mob_hp((prev) => {
          const new_hp = Math.max(0, prev + hp_change);
          if (new_hp <= 0 && handle_mob_death) {
            handle_mob_death();
          }
          return new_hp;
        });
      }

      if (mana_change !== 0) {
        set_mob_mana((prev) => Math.max(0, prev + mana_change));
      }

      if (endurance_change !== 0) {
        set_mob_endurance((prev) => Math.max(0, prev + endurance_change));
      }

      return updated;
    });
  }, [tick_signal, current_mob, add_log, set_hp, max_hp, set_mana, max_mana, set_endurance, max_endurance, set_mob_hp, set_mob_mana, set_mob_endurance, handle_mob_death, process_effects_for_target]);
  /**
   * Add an effect to a target (player or mob)
   * @param {string} target - 'player' or 'mob'
   * @param {Object} spell_data - Spell data from spells_import table
   * @param {number} spell_data.id - Spell ID
   * @param {string} spell_data.name - Spell name
   * @param {number} spell_data.buffduration - Duration in seconds (0 = instant, not stored)
   * @param {Array} spell_data.effects - Effects JSONB array from spells_import.effects
   * @param {number} spell_data.new_icon - Icon index
   * @param {number} caster_cha - Caster CHA for effect calculations
   */
  const add_effect = useCallback((target, spell_data, caster_cha = 0, target_resist = 0, spell_resist_type = 0) => {
    // Parse effects array to get stat_mods and tick values
    const parsed = parse_spell_effects(
      spell_data.effects || [],
      spell_data.buffduration,
      caster_cha
    );
    
    // Check if stun/mez is resisted (stun/mez can be fully resisted, not just reduced)
    const has_stun_or_mez = (parsed.stun_duration > 0 || parsed.mez_duration > 0);
    if (has_stun_or_mez && spell_resist_type > 0) {
      // Check if stun/mez is resisted
      const resist_result = resolve_resist({
        caster_cha,
        target_resist,
        resist_type: spell_resist_type, // Spell's resist type
        spell_resist_type: spell_resist_type
      });
      
      if (resist_result.resisted) {
        // Stun/mez was resisted, don't apply the effect
        return;
      }
    }
    
    const now = Date.now();
    
    // For stun/mez, use the base value as duration (in seconds), not spell's buffduration
    // If stun or mez is present, create effect with that duration
    const stun_dur = parsed.stun_duration || 0;
    const mez_dur = parsed.mez_duration || 0;
    
    // Only store duration effects (buffduration > 0, or stun/mez which uses base value as duration)
    if ((!spell_data.buffduration || spell_data.buffduration <= 0) && stun_dur === 0 && mez_dur === 0) {
      return;
    }
    const effect_duration = stun_dur > 0 ? stun_dur : (mez_dur > 0 ? mez_dur : spell_data.buffduration);
    const duration_ms = effect_duration * 1000;
    const expires_at_ms = now + duration_ms;

    const new_effect = {
      id: `${spell_data.id || 'effect'}-${now}-${Math.random().toString(16).slice(2)}`,
      spell_id: spell_data.id || null,
      name: spell_data.name || 'Effect',
      buffduration: effect_duration, // Use stun/mez duration if present, otherwise spell buffduration
      expires_at_ms: expires_at_ms,
      effects: spell_data.effects || [], // Store raw effects array for DB
      stat_mods: parsed.stat_mods,
      tick_damage: parsed.tick_damage,
      tick_heal: parsed.tick_heal,
      tick_mana: parsed.tick_mana,
      tick_endurance: parsed.tick_endurance,
      damage_shield: parsed.damage_shield,
      rune: parsed.rune,
      rune_remaining: parsed.rune,
      base_tick_damage: parsed.base_tick_damage || 0,
      base_tick_heal: parsed.base_tick_heal || 0,
      stun_duration: stun_dur,
      mez_duration: mez_dur,
      icon: spell_data.new_icon || null,
      on_expire: `${spell_data.name || 'Effect'} fades.`,
      caster_cha: caster_cha
    };

    // Deduplicate by spell_id (new effect replaces old one)
    const dedupe_by_spell_id = (list) => 
      list.filter((e) => e.spell_id !== new_effect.spell_id);

    // Apply first tick immediately for DoT/HoT effects
    if (new_effect.tick_damage > 0 || new_effect.tick_heal > 0) {
      const first_tick_value = (new_effect.tick_heal || 0) - (new_effect.tick_damage || 0);
      
      if (target === 'player') {
        if (first_tick_value !== 0) {
          set_hp((prev) => {
            const new_hp = Math.max(0, Math.min(max_hp, prev + first_tick_value));
            return new_hp;
          });
        }
        if (new_effect.tick_damage > 0 && add_log) {
          add_log(`You take ${Math.floor(new_effect.tick_damage)} damage from ${new_effect.name}.`, 'damage');
        } else if (new_effect.tick_heal > 0 && add_log) {
          add_log(`You heal for ${Math.floor(new_effect.tick_heal)} from ${new_effect.name}.`, 'heal');
        }
      } else if (target === 'mob' && current_mob && set_mob_hp) {
        if (first_tick_value !== 0) {
          set_mob_hp((prev) => {
            const new_hp = Math.max(0, prev + first_tick_value);
            if (new_hp <= 0 && handle_mob_death) {
              handle_mob_death();
            }
            return new_hp;
          });
        }
        if (new_effect.tick_damage > 0 && add_log && current_mob) {
          add_log(`${current_mob.name} takes ${Math.floor(new_effect.tick_damage)} damage from ${new_effect.name}.`, 'damage');
        } else if (new_effect.tick_heal > 0 && add_log && current_mob) {
          add_log(`${current_mob.name} heals for ${Math.floor(new_effect.tick_heal)} from ${new_effect.name}.`, 'heal');
        }
      }
    }

    if (target === 'player') {
      set_player_effects((prev) => {
        const updated = [...dedupe_by_spell_id(prev), new_effect];
        // Save active_effects to database (only player effects)
        if (schedule_save) {
          const serialized = serialize_effects_to_db_for_save(updated);
          schedule_save({ character: { active_effects: serialized } });
        }
        return updated;
      });
    } else if (target === 'mob') {
      set_mob_effects((prev) => {
        const updated = [...dedupe_by_spell_id(prev), new_effect];
        // Don't save mob effects to database - they're temporary and tied to the current mob
        // Mob effects will be cleared when mob dies or changes
        return updated;
      });
    }
  }, [schedule_save, player_effects, mob_effects, serialize_effects_to_db_for_save, set_hp, max_hp, set_mob_hp, add_log, current_mob, handle_mob_death]);

  /**
   * Remove a specific effect by ID
   * @param {string} target - 'player' or 'mob'
   * @param {string} effect_id - Effect ID to remove
   */
  const remove_effect = useCallback((target, effect_id) => {
    if (target === 'player') {
      set_player_effects((prev) => {
        const updated = prev.filter((e) => e.id !== effect_id);
        // Save active_effects to database (only player effects)
        if (schedule_save) {
          const serialized = serialize_effects_to_db_for_save(updated);
          schedule_save({ character: { active_effects: serialized } });
        }
        return updated;
      });
    } else if (target === 'mob') {
      set_mob_effects((prev) => {
        const updated = prev.filter((e) => e.id !== effect_id);
        // Don't save mob effects to database - they're temporary and tied to the current mob
        // Mob effects will be cleared when mob dies or changes
        return updated;
      });
    }
  }, [schedule_save, player_effects, mob_effects, serialize_effects_to_db_for_save]);
  
  /**
   * Remove effect by spell_id (for auto-buff removal when unassigning from slot)
   * @param {string} target - 'player' or 'mob'
   * @param {number} spell_id - Spell ID to remove
   */
  const remove_effect_by_spell_id = useCallback((target, spell_id) => {
    if (target === 'player') {
      set_player_effects((prev) => {
        const updated = prev.filter((e) => e.spell_id !== spell_id);
        // Save active_effects to database (only player effects)
        if (schedule_save) {
          const serialized = serialize_effects_to_db_for_save(updated);
          schedule_save({ character: { active_effects: serialized } });
        }
        return updated;
      });
    } else if (target === 'mob') {
      set_mob_effects((prev) => {
        const updated = prev.filter((e) => e.spell_id !== spell_id);
        // Don't save mob effects to database - they're temporary and tied to the current mob
        // Mob effects will be cleared when mob dies or changes
        return updated;
      });
    }
  }, [schedule_save, player_effects, mob_effects, serialize_effects_to_db_for_save]);

  /**
   * Clear all effects from a target
   * @param {string} target - 'player' or 'mob'
   */
  const clear_effects = useCallback((target) => {
    if (target === 'player') {
      set_player_effects([]);
    } else if (target === 'mob') {
      set_mob_effects([]);
    }
  }, []);

  /**
   * Get total stat modifications from active buffs/debuffs
   * @param {string} target - 'player' or 'mob'
   * @returns {Object} Stat modifications object
   */
  const get_stat_modifiers = useCallback((target) => {
    const effects = target === 'player' ? player_effects : mob_effects;
    const now = Date.now();
    const mods = {};

    effects.forEach((effect) => {
      // Skip expired effects
      if (effect.expires_at_ms && effect.expires_at_ms <= now) {
        return;
      }

      if (effect.stat_mods) {
        Object.entries(effect.stat_mods).forEach(([stat, value]) => {
          mods[stat] = (mods[stat] || 0) + value;
        });
      }
    });

    return mods;
  }, [player_effects, mob_effects]);

  /**
   * Check if target is stunned (effect_id 21)
   * @param {string} target - 'player' or 'mob'
   * @returns {boolean} True if stunned
   */
  const is_stunned = useCallback((target) => {
    const effects = target === 'player' ? player_effects : mob_effects;
    const now = Date.now();

    return effects.some((effect) => {
      // Check if effect has stun and is not expired
      if (effect.stun_duration > 0 && effect.expires_at_ms && effect.expires_at_ms > now) {
        return true;
      }
      return false;
    });
  }, [player_effects, mob_effects]);

  /**
   * Check if target is mezzed (effect_id 31)
   * @param {string} target - 'player' or 'mob'
   * @returns {boolean} True if mezzed
   */
  const is_mezzed = useCallback((target) => {
    const effects = target === 'player' ? player_effects : mob_effects;
    const now = Date.now();

    return effects.some((effect) => {
      // Check if effect has mez and is not expired
      if (effect.mez_duration > 0 && effect.expires_at_ms && effect.expires_at_ms > now) {
        return true;
      }
      return false;
    });
  }, [player_effects, mob_effects]);

  /**
   * Remove mez effects from target (breaks on damage)
   * @param {string} target - 'player' or 'mob'
   */
  const break_mez = useCallback((target) => {
    if (target === 'player') {
      set_player_effects((prev) => {
        const updated = prev.filter((e) => !(e.mez_duration > 0));
        if (schedule_save) {
          const serialized = serialize_effects_to_db_for_save(updated);
          schedule_save({ character: { active_effects: serialized } });
        }
        return updated;
      });
    } else if (target === 'mob') {
      set_mob_effects((prev) => {
        const updated = prev.filter((e) => !(e.mez_duration > 0));
        // Don't save mob effects to database - they're temporary
        return updated;
      });
    }
  }, [schedule_save, player_effects, mob_effects, serialize_effects_to_db_for_save]);

  /**
   * Serialize effects to database format (active_effects JSONB)
   * @returns {Array} Serialized effects array
   */
  const serialize_effects_to_db = useCallback(() => {
    return serialize_effects_to_db_for_save(player_effects);
  }, [player_effects, serialize_effects_to_db_for_save]);

  /**
   * Initialize effects from database format (active_effects JSONB)
   * @param {Array} db_effects - Effects from database
   */
  const initialize_effects_from_db = useCallback((db_effects) => {
    const now = Date.now();
    
    const player_restored = [];
    const mob_restored = [];

    (db_effects || []).forEach((e) => {
      if (!e.expires_at) return;
      
      const expires_ms = new Date(e.expires_at).getTime();
      const remaining_ms = expires_ms - now;
      
      if (remaining_ms <= 0) return; // Skip expired

      // Parse effects array to get stat_mods and tick values
      const parsed = parse_spell_effects(
        e.effects || [],
        e.buffduration || 0,
        e.caster_cha || 0
      );

      const restored_effect = {
        id: `${e.spell_id || 'effect'}-${expires_ms}-${Math.random().toString(16).slice(2)}`,
        spell_id: e.spell_id || null,
        name: e.name || 'Effect',
        buffduration: e.buffduration || 0,
        expires_at_ms: expires_ms,
        effects: e.effects || [], // Store raw effects array
        stat_mods: parsed.stat_mods,
        tick_damage: parsed.tick_damage,
        tick_heal: parsed.tick_heal,
        tick_mana: parsed.tick_mana,
        tick_endurance: parsed.tick_endurance,
        damage_shield: parsed.damage_shield,
        rune: parsed.rune,
        rune_remaining: parsed.rune,
        stun_duration: parsed.stun_duration || 0,
        mez_duration: parsed.mez_duration || 0,
        icon: e.icon || null,
        on_expire: `${e.name || 'Effect'} fades.`,
        caster_cha: e.caster_cha || 0
      };

      if (e.target === 'mob') {
        mob_restored.push(restored_effect);
      } else {
        player_restored.push(restored_effect);
      }
    });

    set_player_effects(player_restored);
    set_mob_effects(mob_restored);
  }, []);

  // Update initial effects when they change externally
  useEffect(() => {
    if (initial_player_effects && initial_player_effects.length > 0) {
      set_player_effects(initial_player_effects);
    }
  }, [initial_player_effects]);

  return {
    player_effects,
    mob_effects,
    add_effect,
    remove_effect,
    remove_effect_by_spell_id,
    clear_effects,
    get_stat_modifiers,
    serialize_effects_to_db,
    initialize_effects_from_db,
    set_player_effects,
    set_mob_effects,
    update_regen_state
  };
}











