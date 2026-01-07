import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { save_spell_slots } from '../services/playerStorage';
import { execute_skill } from '../utils/skillExecutor';

const ABILITY_SLOT_COUNT = 6;
const SPELL_SLOT_COUNT = 6;

const mechanic_auto_attack = {
  id: 'mechanic-auto-attack',
  name: 'Auto Attack',
  iconIndex: 1,
  gemIconIndex: 1,
  icon_index: 1,
  gem_icon_index: 1
};
const mechanic_auto_cast = {
  id: 'mechanic-auto-cast',
  name: 'Auto Cast',
  iconIndex: 1,
  gemIconIndex: 1,
  icon_index: 1,
  gem_icon_index: 1
};

export function use_skill_slots({
  character_id,
  known_spells = [],
  set_known_spells = () => {},
  player_class = null,
  resource_type = 'melee',
  mana = 0,
  endurance = 0,
  set_mana = () => {},
  set_endurance = () => {},
  cooldowns = {},
  set_cooldowns = () => {},
  add_effect = null,
  remove_effect = null, // Unused for now (kept for API compatibility)
  remove_effect_by_spell_id = null, // Unused for now (kept for API compatibility)
  is_sitting = false,
  set_is_sitting = () => {},
  attack_mob = null,
  ranged_attack_mob = null,
  set_is_auto_attack = () => {},
  is_auto_attack = false,
  in_combat = false,
  casting_state = null,
  set_casting_state = () => {},
  add_log = null,
  schedule_save = null,
  current_mob = null,
  mob_distance = 0,
  level = 1,
  stat_totals = {},
  auto_cast_slot = null,
  auto_attack_slot = null,
  set_hp = null,
  set_mob_hp = null,
  set_mob_mana = null,
  set_mob_endurance = null,
  add_combat_log = null,
  handle_mob_death = null,
  is_stunned = null,
  break_mez = null,
  teleport_to_bind = null,
  bind_zone_id = null,
  bind_camp_id = null,
  teleport_to_portal = null,
  set_in_combat = null
}) {
  const [auto_cast_slot_state, set_auto_cast_slot_state] = useState(auto_cast_slot || null);
  const [auto_attack_slot_state, set_auto_attack_slot_state] = useState(auto_attack_slot || null);
  const [is_auto_cast_enabled, set_is_auto_cast_enabled] = useState(false);
  const cast_timer_ref = useRef(null);
  const ability_auto_timer_ref = useRef(null);
  const spell_auto_timer_ref = useRef(null);

  useEffect(() => {
    set_auto_cast_slot_state(auto_cast_slot ?? null);
  }, [auto_cast_slot]);

  useEffect(() => {
    set_auto_attack_slot_state(auto_attack_slot ?? null);
  }, [auto_attack_slot]);

  useEffect(() => {
    return () => {
      if (cast_timer_ref.current) {
        clearTimeout(cast_timer_ref.current);
      }
      if (ability_auto_timer_ref.current) {
        clearInterval(ability_auto_timer_ref.current);
      }
      if (spell_auto_timer_ref.current) {
        clearInterval(spell_auto_timer_ref.current);
      }
    };
  }, []);

  const ability_slots = useMemo(() => {
    const slots = Array(ABILITY_SLOT_COUNT).fill(null);
    (known_spells || [])
      .filter((s) => s.skill_type === 'ability')
      .forEach((s) => {
        const idx = (s.ability_slot || 0) - 1;
        if (idx >= 0 && idx < ABILITY_SLOT_COUNT) {
          slots[idx] = s;
        }
      });
    if (auto_attack_slot_state && auto_attack_slot_state >= 1 && auto_attack_slot_state <= ABILITY_SLOT_COUNT) {
      slots[auto_attack_slot_state - 1] = mechanic_auto_attack;
    }
    return slots;
  }, [known_spells, auto_attack_slot_state]);

  const spell_slots = useMemo(() => {
    const slots = Array(SPELL_SLOT_COUNT).fill(null);
    (known_spells || [])
      .filter((s) => s.skill_type !== 'ability')
      .forEach((s) => {
        const idx = (s.spell_slot || 0) - 1;
        if (idx >= 0 && idx < SPELL_SLOT_COUNT) {
          slots[idx] = s;
        }
      });
    if (auto_cast_slot_state && auto_cast_slot_state >= 1 && auto_cast_slot_state <= SPELL_SLOT_COUNT) {
      slots[auto_cast_slot_state - 1] = mechanic_auto_cast;
    }
    return slots;
  }, [known_spells, auto_cast_slot_state]);

  const persist_slots = useCallback(async (next_known = [], auto_attack_slot_state_val = auto_attack_slot_state, auto_cast_slot_state_val = auto_cast_slot_state) => {
    if (!character_id) return;
    const ability_payload = [];
    const spell_payload = [];

    next_known.forEach((spell) => {
      const spell_id = spell.spell_id || spell.id;
      if (!spell_id) return;

      if (spell.skill_type === 'ability') {
        // Persist ability slot even when null (clears)
        ability_payload.push({ spell_id, ability_slot: spell.ability_slot || null });
      }
      if (spell.skill_type !== 'ability') {
        // Persist spell slot even when null (clears)
        spell_payload.push({ spell_id, spell_slot: spell.spell_slot || null });
      }
    });

    try {
      await save_spell_slots(character_id, {
        ability_slots: ability_payload,
        spell_slots: spell_payload,
        auto_attack_slot: auto_attack_slot_state_val || null,
        auto_cast_slot: auto_cast_slot_state_val || null
      });
    } catch (err) {
      console.error('Failed to save spell slots', err);
    }
  }, [character_id, auto_attack_slot_state, auto_cast_slot_state]);

  const apply_cooldown = useCallback((skill_id, recast_time = 0) => {
    if (!skill_id || !set_cooldowns) return;
    const duration = Number.isFinite(recast_time) && recast_time > 0 ? recast_time : 1000;
    const until = Date.now() + duration;
    const next = { ...(cooldowns || {}), [skill_id]: until };
    set_cooldowns(next);
  }, [cooldowns, set_cooldowns]);

  const clear_casting_state = useCallback(() => {
    if (cast_timer_ref.current) {
      clearTimeout(cast_timer_ref.current);
      cast_timer_ref.current = null;
    }
    if (set_casting_state) {
      set_casting_state(null);
    }
  }, [set_casting_state]);

  const assign_ability_to_slot = useCallback((slot_idx, spell_id_or_mechanic) => {
    if (slot_idx < 1 || slot_idx > ABILITY_SLOT_COUNT) return;

    if (spell_id_or_mechanic === mechanic_auto_attack.id) {
      set_auto_attack_slot_state(slot_idx);
      if (schedule_save) {
        schedule_save({ character: { auto_attack_slot: slot_idx } });
      }
      // Persist slots including auto slots
      persist_slots(known_spells, slot_idx, auto_cast_slot_state);
      return;
    }

    set_auto_attack_slot_state((prev) => {
      if (prev === slot_idx) {
        if (schedule_save) schedule_save({ character: { auto_attack_slot: null } });
        return null;
      }
      return prev;
    });

    const resolved_id = spell_id_or_mechanic === null || spell_id_or_mechanic === undefined
      ? null
      : (isNaN(Number(spell_id_or_mechanic)) ? spell_id_or_mechanic : Number(spell_id_or_mechanic));
    if (!resolved_id) return;

    const current = Array.isArray(known_spells) ? known_spells : [];
    const next = current.map((s) => ({ ...s }));

    next.forEach((s) => {
      if (s.ability_slot === slot_idx) s.ability_slot = null;
    });

    const target = next.find((s) => {
      const id = s.spell_id || s.id;
      return id === resolved_id || String(id) === String(resolved_id);
    });

    if (target) {
      target.ability_slot = slot_idx;
      target.spell_slot = null;
    }

    set_known_spells(next);
    persist_slots(next, auto_attack_slot_state, auto_cast_slot_state);
  }, [known_spells, persist_slots, schedule_save, set_known_spells]);

  const clear_ability_slot = useCallback((slot_idx) => {
    if (slot_idx < 1 || slot_idx > ABILITY_SLOT_COUNT) return;

    if (auto_attack_slot_state === slot_idx) {
      set_auto_attack_slot_state(null);
      if (schedule_save) schedule_save({ character: { auto_attack_slot: null } });
    }

    const current = Array.isArray(known_spells) ? known_spells : [];
    const next = current.map((s) => ({ ...s }));
    next.forEach((s) => {
      if (s.ability_slot === slot_idx) s.ability_slot = null;
    });
    set_known_spells(next);
    persist_slots(next, auto_attack_slot_state, auto_cast_slot_state);
  }, [auto_attack_slot_state, known_spells, persist_slots, schedule_save, set_known_spells]);

  const assign_spell_to_slot = useCallback((slot_idx, spell_id_or_mechanic) => {
    if (slot_idx < 1 || slot_idx > SPELL_SLOT_COUNT) return;

    if (spell_id_or_mechanic === mechanic_auto_cast.id) {
      set_auto_cast_slot_state(slot_idx);
      if (schedule_save) {
        schedule_save({ character: { auto_cast_slot: slot_idx } });
      }
      persist_slots(known_spells, auto_attack_slot_state, slot_idx);
      return;
    }

    set_auto_cast_slot_state((prev) => {
      if (prev === slot_idx) {
        if (schedule_save) schedule_save({ character: { auto_cast_slot: null } });
        return null;
      }
      return prev;
    });

    const resolved_id = spell_id_or_mechanic === null || spell_id_or_mechanic === undefined
      ? null
      : (isNaN(Number(spell_id_or_mechanic)) ? spell_id_or_mechanic : Number(spell_id_or_mechanic));
    if (!resolved_id) return;

    const current = Array.isArray(known_spells) ? known_spells : [];
    const next = current.map((s) => ({ ...s }));

    next.forEach((s) => {
      if (s.spell_slot === slot_idx && s.skill_type !== 'ability') s.spell_slot = null;
    });

    const target = next.find((s) => {
      const id = s.spell_id || s.id;
      return id === resolved_id || String(id) === String(resolved_id);
    });

    if (target) {
      target.spell_slot = slot_idx;
      target.ability_slot = null;
    }

    set_known_spells(next);
    persist_slots(next, auto_attack_slot_state, auto_cast_slot_state);
  }, [known_spells, persist_slots, schedule_save, set_known_spells]);

  const clear_spell_slot = useCallback((slot_idx) => {
    if (slot_idx < 1 || slot_idx > SPELL_SLOT_COUNT) return;

    if (auto_cast_slot_state === slot_idx) {
      set_auto_cast_slot_state(null);
      if (schedule_save) schedule_save({ character: { auto_cast_slot: null } });
    }

    const current = Array.isArray(known_spells) ? known_spells : [];
    const next = current.map((s) => ({ ...s }));
    next.forEach((s) => {
      if (s.spell_slot === slot_idx && s.skill_type !== 'ability') s.spell_slot = null;
    });
    set_known_spells(next);
    persist_slots(next, auto_attack_slot_state, auto_cast_slot_state);
  }, [auto_cast_slot_state, known_spells, persist_slots, schedule_save, set_known_spells]);

  const handle_builtin = useCallback((skill_id) => {
    switch (skill_id) {
      case 'builtin-attack':
        if (attack_mob) attack_mob();
        return true;
      case 'builtin-ranged':
        if (ranged_attack_mob) ranged_attack_mob();
        return true;
      case 'builtin-sit':
        if (set_is_sitting) set_is_sitting(!is_sitting);
        return true;
      case 'builtin-meditate':
        if (in_combat) {
          if (add_log) add_log('You cannot meditate while in combat.', 'error');
          return true;
        }
        if (set_is_sitting) set_is_sitting(true);
        return true;
      default:
        return false;
    }
  }, [add_log, attack_mob, in_combat, is_sitting, ranged_attack_mob, set_is_sitting]);

  const use_skill = useCallback((skill) => {
    if (!skill) return;

    const skill_id = skill.id || skill.spell_id || skill;
    const is_gate_spell = skill.teleport_or_pet === 'bind';
    const portal_zone_id = (!is_gate_spell && typeof skill.teleport_or_pet === 'string')
      ? skill.teleport_or_pet
      : null;

    if (skill_id === mechanic_auto_attack.id) {
      set_is_auto_attack((prev) => !prev);
      return;
    }
    if (skill_id === mechanic_auto_cast.id) {
      set_is_auto_cast_enabled((prev) => !prev);
      return;
    }
    if (skill_id === 'builtin-flee') {
      // Long cooldown, free "panic gate" to bind
      const now = Date.now();
      const until = cooldowns?.[skill_id] || 0;
      if (until && until > now) {
        if (add_log) add_log('Flee is not ready yet.', 'error');
        return;
      }

      // Apply cooldown
      const FLEE_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
      apply_cooldown(skill_id, FLEE_COOLDOWN_MS);
      if (schedule_save) {
        schedule_save({ character: { flee_available_at: new Date(now + FLEE_COOLDOWN_MS).toISOString() } }, { immediate: true });
      }

      // Drop combat/auto-attack and port to bind
      if (set_is_auto_attack) set_is_auto_attack(false);
      if (set_in_combat) set_in_combat(false);
      clear_casting_state();
      if (teleport_to_bind) {
        teleport_to_bind(bind_zone_id, bind_camp_id);
      }
      if (add_log) add_log('You flee to your bind point.', 'system');

      // Drain resources instead of debuff
      if (typeof set_mana === 'function') {
        set_mana(0);
      }
      if (typeof set_endurance === 'function') {
        set_endurance(0);
      }
      if (set_is_sitting) set_is_sitting(false);

      return;
    }

    if (handle_builtin(skill_id)) return;

    if (is_stunned && is_stunned('player')) {
      if (add_log) add_log('You are stunned and cannot act.', 'error');
      return;
    }

    const now = Date.now();
    const until = cooldowns?.[skill_id] || 0;
    if (until && until > now) {
      if (add_log) add_log('That skill is not ready yet.', 'error');
      return;
    }

    const mana_cost = skill.mana || 0;
    const end_cost = skill.endurance || 0;

    if (mana_cost > 0 && mana < mana_cost) {
      if (add_log) add_log('Not enough mana.', 'error');
      return;
    }
    if (end_cost > 0 && endurance < end_cost) {
      if (add_log) add_log('Not enough endurance.', 'error');
      return;
    }

    if (mana_cost > 0) set_mana((prev) => Math.max(0, prev - mana_cost));
    if (end_cost > 0) set_endurance((prev) => Math.max(0, prev - end_cost));

    const execute_cast = async () => {
      // Gate handling: succeeds unless the 5% failure roll triggers
      if (is_gate_spell && teleport_to_bind) {
        const gate_fails = Math.random() < 0.05;
        if (gate_fails) {
          if (add_log) add_log('Your gate collapses and fails.', 'error');
          apply_cooldown(skill_id, skill.recast_time || skill.cooldown_ms || 0);
          return;
        }
        // Drop combat/auto-attack and port
        if (set_is_auto_attack) set_is_auto_attack(false);
        if (set_in_combat) set_in_combat(false);
        clear_casting_state();
        teleport_to_bind(bind_zone_id, bind_camp_id);
        if (add_log) add_log('You gate to your bind point.', 'system');
        apply_cooldown(skill_id, skill.recast_time || skill.cooldown_ms || 0);
        return;
      }

      // Portal handling: teleport to specific zone portal camp
      if (portal_zone_id) {
        if (!teleport_to_portal) {
          throw new Error('Portal teleport handler missing.');
        }
        if (set_is_auto_attack) set_is_auto_attack(false);
        if (set_in_combat) set_in_combat(false);
        clear_casting_state();
        await teleport_to_portal(portal_zone_id);
        if (add_log) add_log(`You portal to ${portal_zone_id}.`, 'system');
        apply_cooldown(skill_id, skill.recast_time || skill.cooldown_ms || 0);
        return;
      }

      const target = skill.good_effect ? 'player' : 'mob';
      execute_skill({
        skill,
        target,
        state: {
          stat_totals,
          current_mob,
          level,
          set_hp,
          set_mana,
          set_endurance,
          set_mob_hp,
          set_mob_mana,
          set_mob_endurance,
          add_combat_log: add_combat_log || add_log,
          add_effect,
          handle_mob_death,
          break_mez
        }
      });
      apply_cooldown(skill_id, skill.recast_time || skill.cooldown_ms || 0);
    };

    const cast_time_ms = skill.cast_time || 0;
    if (cast_time_ms > 0) {
      const ends_at = now + cast_time_ms;
      if (set_casting_state) {
        set_casting_state({
          skillId: skill_id,
          endsAt: ends_at,
          durationMs: cast_time_ms
        });
      }
      cast_timer_ref.current = setTimeout(() => {
        execute_cast();
        clear_casting_state();
      }, cast_time_ms);
    } else {
      execute_cast();
    }
  }, [
    add_combat_log,
    add_effect,
    add_log,
    apply_cooldown,
    break_mez,
    clear_casting_state,
    cooldowns,
    current_mob,
    endurance,
    handle_mob_death,
    handle_builtin,
    is_stunned,
    level,
    mana,
    set_casting_state,
    set_endurance,
    set_hp,
    set_is_auto_attack,
    set_mana,
    set_mob_endurance,
    set_mob_hp,
    set_mob_mana,
    stat_totals,
    teleport_to_bind,
    teleport_to_portal,
    bind_zone_id,
    bind_camp_id,
    set_in_combat
  ]);

  // Auto-attack loop: fire abilities above the marker, then the base attack
  useEffect(() => {
    if (ability_auto_timer_ref.current) {
      clearInterval(ability_auto_timer_ref.current);
      ability_auto_timer_ref.current = null;
    }

    if (!is_auto_attack || !auto_attack_slot_state || !current_mob) return;

    const marker_idx = auto_attack_slot_state - 1;
    if (marker_idx < 0 || marker_idx >= ability_slots.length) return;

    const queued_abilities = ability_slots
      .slice(0, marker_idx)
      .filter((s) => s && s.id !== mechanic_auto_attack.id);

    ability_auto_timer_ref.current = setInterval(() => {
      const now = Date.now();
      if (!current_mob) return;
      if (casting_state && casting_state.endsAt && casting_state.endsAt > now) return;

      queued_abilities.forEach((skill) => {
        const id = skill.id || skill.spell_id;
        if (!id) return;
        const until = cooldowns?.[id] || 0;
        if (until && until > now) return;
        use_skill(skill);
      });

      // Base melee attack
      use_skill('builtin-attack');
    }, 500);

    return () => {
      if (ability_auto_timer_ref.current) {
        clearInterval(ability_auto_timer_ref.current);
        ability_auto_timer_ref.current = null;
      }
    };
  }, [ability_slots, auto_attack_slot_state, casting_state, cooldowns, current_mob, is_auto_attack, use_skill]);

  // Auto-cast loop: fire spells above the marker (non-ability spells only)
  useEffect(() => {
    if (spell_auto_timer_ref.current) {
      clearInterval(spell_auto_timer_ref.current);
      spell_auto_timer_ref.current = null;
    }

    if (!is_auto_cast_enabled || !auto_cast_slot_state || !current_mob) return;

    const marker_idx = auto_cast_slot_state - 1;
    if (marker_idx < 0 || marker_idx >= spell_slots.length) return;

    const queued_spells = spell_slots
      .slice(0, marker_idx)
      .filter((s) => s && s.id !== mechanic_auto_cast.id && s.skill_type !== 'ability');

    spell_auto_timer_ref.current = setInterval(() => {
      const now = Date.now();
      if (!current_mob) return;
      if (casting_state && casting_state.endsAt && casting_state.endsAt > now) return;

      queued_spells.forEach((spell) => {
        const id = spell.id || spell.spell_id;
        if (!id) return;
        const until = cooldowns?.[id] || 0;
        if (until && until > now) return;
        use_skill(spell);
      });
    }, 750);

    return () => {
      if (spell_auto_timer_ref.current) {
        clearInterval(spell_auto_timer_ref.current);
        spell_auto_timer_ref.current = null;
      }
    };
  }, [auto_cast_slot_state, casting_state, cooldowns, current_mob, is_auto_cast_enabled, spell_slots, use_skill]);

  return {
    ability_slots,
    spell_slots,
    assign_ability_to_slot,
    assign_spell_to_slot,
    clear_ability_slot,
    clear_spell_slot,
    use_skill
  };
}
