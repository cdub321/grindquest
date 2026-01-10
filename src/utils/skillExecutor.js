import { execute_instant_effects, get_target_resist, parse_effects_array } from './effectRegistry'

/**
 * Centralized skill executor that applies instant effects and dispatches duration effects
 * using the shared registry helpers. Keeps logging and resource deltas consistent between
 * cast-time and tick-time paths.
 *
 * @param {Object} params
 * @param {Object} params.skill - Spell/ability data
 * @param {'player'|'mob'} params.target - Target type
 * @param {Object} params.state - Aggregated state/setters for applying outcomes
 * @param {Object} params.state.stat_totals - Caster stat totals (for CHA)
 * @param {Object|null} params.state.current_mob - Current mob (for resist/HP)
 * @param {number} params.state.level - Caster level
 * @param {Function} params.state.set_hp - Setter for player HP
 * @param {Function} params.state.set_mana - Setter for player mana
 * @param {Function} params.state.set_endurance - Setter for player endurance
 * @param {Function} params.state.set_mob_hp - Setter for mob HP
 * @param {Function} params.state.set_mob_mana - Setter for mob mana
 * @param {Function} params.state.set_mob_endurance - Setter for mob endurance
 * @param {Function} params.state.add_combat_log - Logging function
 * @param {Function} params.state.add_effect - Function to add duration effects
 * @param {Function} params.state.handle_mob_death - Mob death handler
 * @param {Function} params.state.break_mez - Function to break mez on damage
 */
export function execute_skill({
  skill,
  target,
  state
}) {
  if (!skill) return

  const {
    stat_totals,
    current_mob,
    level,
    set_hp,
    set_mana,
    set_endurance,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    add_combat_log,
    add_effect,
    handle_mob_death,
    break_mez
  } = state || {}

  const buffduration = skill.buffduration || 0
  const effects = skill.effects || []
  const caster_cha = stat_totals?.cha || 0

  // Duration effects -> delegate to useEffects via add_effect
  if (buffduration > 0 && effects.length > 0 && add_effect) {
    const target_resist_val = target === 'mob'
      ? get_target_resist(skill, current_mob, stat_totals)
      : 0
    const spell_resist_type = skill.resist_type || 0
    add_effect(target, skill, caster_cha, target_resist_val, spell_resist_type)
    return
  }

  // Instant effects -> apply directly
  if (effects.length > 0) {
    execute_instant_effects({
      skill,
      target,
      target_stats: target === 'mob' ? {
        level: current_mob?.level || 1,
        agi: current_mob?.stats?.agi || current_mob?.agi || 0,
        resist: get_target_resist(skill, current_mob, stat_totals)
      } : {
        level,
        agi: stat_totals?.agi || 0,
        resist: 0
      },
      caster_cha,
      caster_level: level,
      apply_damage: (target_type, amount, school, base_damage, cha_mod, resist) => {
        if (target_type === 'mob' && set_mob_hp && current_mob) {
          // Break mez on damage (mez breaks when target takes damage)
          if (break_mez) {
            break_mez('mob')
          }

          if (add_combat_log) {
            add_combat_log(`${skill.name} hits ${current_mob.name} for ${amount} ${school} damage!`, 'damage')
          }

          set_mob_hp((prev) => {
            const new_hp = Math.max(0, prev - amount)
            if (new_hp <= 0 && handle_mob_death) {
              handle_mob_death()
            }
            return new_hp
          })
        } else if (target_type === 'player' && set_hp) {
          set_hp((prev) => Math.max(0, prev - amount))
          if (add_combat_log) {
            add_combat_log(`You take ${amount} ${school} damage from ${skill.name}!`, 'damage')
          }
        }
      },
      apply_heal: (target_type, amount) => {
        if (target_type === 'player' && set_hp) {
          set_hp((prev) => Math.min(prev + amount, prev))
          if (add_combat_log) {
            add_combat_log(`You heal for ${amount} from ${skill.name}!`, 'heal')
          }
        } else if (target_type === 'mob' && set_mob_hp && current_mob) {
          set_mob_hp((prev) => Math.min(prev + amount, (current_mob.hp || prev)))
          if (add_combat_log) {
            add_combat_log(`${current_mob.name} heals for ${amount} from ${skill.name}!`, 'heal')
          }
        }
      },
      apply_mana_change: (target_type, amount) => {
        if (target_type === 'player' && set_mana) {
          set_mana((prev) => Math.max(0, Math.min(prev + amount, prev)))
        } else if (target_type === 'mob' && set_mob_mana) {
          set_mob_mana((prev) => Math.max(0, prev + amount))
        }
      },
      apply_endurance_change: (target_type, amount) => {
        if (target_type === 'player' && set_endurance) {
          set_endurance((prev) => Math.max(0, Math.min(prev + amount, prev)))
        } else if (target_type === 'mob' && set_mob_endurance) {
          set_mob_endurance((prev) => Math.max(0, prev + amount))
        }
      }
    })
  }
}
