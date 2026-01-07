import { apply_resist_reduction } from './combatResolver'

/**
 * Translate a damage school to its resist stat key.
 * @param {string} school
 * @returns {string} Resist stat key.
 */
export function get_resist_school_name(school) {
  const school_lower = (school || '').toLowerCase()
  switch (school_lower) {
    case 'fire':
      return 'fr'
    case 'cold':
      return 'cr'
    case 'poison':
      return 'pr'
    case 'disease':
      return 'dr'
    case 'magic':
    default:
      return 'mr'
  }
}

/**
 * Get the target's resist value for a spell.
 * @param {Object} spell
 * @param {Object|null} mob
 * @param {Object} player_stat_totals
 * @returns {number}
 */
export function get_target_resist(spell, mob = null, player_stat_totals = {}) {
  // Default damage school to magic until explicit data is available
  const school = 'magic'
  const resist_stat = get_resist_school_name(school)

  if (mob) {
    return mob.stats?.[resist_stat] || mob[resist_stat] || 0
  }
  return player_stat_totals[resist_stat] || 0
}

/**
 * Execute instant spell effects (buffduration = 0)
 * Applies damage, healing, mana, endurance changes immediately.
 * This is shared by useSkillSlots and any cast executor.
 */
export function execute_instant_effects({
  skill,
  target,
  target_stats = {},
  caster_cha = 0,
  caster_level = 1,
  apply_damage = null,
  apply_heal = null,
  apply_mana_change = null,
  apply_endurance_change = null
}) {
  if (!skill || !skill.effects || skill.effects.length === 0) {
    return
  }

  // Apply instant HP effects (damage or healing)
  skill.effects.forEach((effect) => {
    if (effect.effect_id === 0 && effect.base !== undefined && effect.base !== null) {
      const base_value = effect.base

      if (base_value < 0) {
        // Instant damage
        const base_damage = Math.abs(base_value)

        // Apply CHA modifier (CHA/10 = percentage bonus)
        const cha_mod = 1 + (caster_cha / 10 / 100)
        const modified_damage = Math.floor(base_damage * cha_mod)

        // Apply resist reduction
        const resist = target_stats.resist || 0
        const final_damage = apply_resist_reduction(modified_damage, resist)

        // Determine damage school (default to magic)
        const school = 'magic' // Could be enhanced to parse from spell data

        if (final_damage > 0 && apply_damage) {
          apply_damage(target, final_damage, school, base_damage, cha_mod, resist)
        }
      } else if (base_value > 0) {
        // Instant healing
        const base_heal = base_value

        // Apply CHA modifier
        const cha_mod = 1 + (caster_cha / 10 / 100)
        const final_heal = Math.floor(base_heal * cha_mod)

        if (final_heal > 0 && apply_heal) {
          apply_heal(target, final_heal)
        }
      }
    }
  })

  // Apply instant mana changes (effect_id 15)
  skill.effects.forEach((effect) => {
    if (effect.effect_id === 15 && effect.base !== undefined && effect.base !== null) {
      const mana_change = effect.base
      if (mana_change !== 0 && apply_mana_change) {
        apply_mana_change(target, mana_change)
      }
    }
  })

  // Apply instant endurance changes (effect_id 24)
  skill.effects.forEach((effect) => {
    if (effect.effect_id === 24 && effect.base !== undefined && effect.base !== null) {
      const endurance_change = effect.base
      if (endurance_change !== 0 && apply_endurance_change) {
        apply_endurance_change(target, endurance_change)
      }
    }
  })
}

/**
 * Accumulate effect contributions into a runtime accumulator.
 * Used by parse_spell_effects and future registry callers.
 */
export function accumulate_effect({
  effect,
  buffduration,
  caster_cha,
  acc
}) {
  if (!effect || (!effect.effect_id && effect.effect_id !== 0)) return
  if (effect.base === undefined || effect.base === null) return

  const effect_id = effect.effect_id
  const base_value = effect.base

  switch (effect_id) {
    case 0: { // HP (DoT/HoT when duration > 0)
      if (buffduration > 0) {
        const cha_mod = 1 + (caster_cha / 10 / 100)
        if (base_value < 0) {
          const base_dmg = Math.abs(base_value)
          acc.base_tick_damage += base_dmg
          acc.tick_damage += Math.floor(base_dmg * cha_mod)
        } else {
          acc.base_tick_heal += base_value
          acc.tick_heal += Math.floor(base_value * cha_mod)
        }
      }
      break
    }
    case 1:
      acc.stat_mods.ac = (acc.stat_mods.ac || 0) + base_value
      break
    case 2:
      acc.stat_mods.damage = (acc.stat_mods.damage || 0) + base_value
      break
    case 3:
      acc.stat_mods.mod_move = (acc.stat_mods.mod_move || 0) + base_value
      break
    case 4:
      acc.stat_mods.str = (acc.stat_mods.str || 0) + base_value
      break
    case 5:
      acc.stat_mods.dex = (acc.stat_mods.dex || 0) + base_value
      break
    case 6:
      acc.stat_mods.agi = (acc.stat_mods.agi || 0) + base_value
      break
    case 7:
      acc.stat_mods.sta = (acc.stat_mods.sta || 0) + base_value
      break
    case 8:
      acc.stat_mods.int = (acc.stat_mods.int || 0) + base_value
      break
    case 9:
      acc.stat_mods.wis = (acc.stat_mods.wis || 0) + base_value
      break
    case 10:
      acc.stat_mods.cha = (acc.stat_mods.cha || 0) + base_value
      break
    case 11:
      acc.stat_mods.delay = (acc.stat_mods.delay || 0) + base_value
      break
    case 15: {
      if (buffduration > 0) {
        const cha_mod = 1 + (caster_cha / 10 / 100)
        acc.tick_mana += Math.floor(base_value * cha_mod)
      }
      break
    }
    case 24: {
      if (buffduration > 0) {
        const cha_mod = 1 + (caster_cha / 10 / 100)
        acc.tick_endurance += Math.floor(base_value * cha_mod)
      }
      break
    }
    case 46:
      acc.stat_mods.fr = (acc.stat_mods.fr || 0) + base_value
      break
    case 47:
      acc.stat_mods.cr = (acc.stat_mods.cr || 0) + base_value
      break
    case 48:
      acc.stat_mods.pr = (acc.stat_mods.pr || 0) + base_value
      break
    case 49:
      acc.stat_mods.dr = (acc.stat_mods.dr || 0) + base_value
      break
    case 50:
      acc.stat_mods.mr = (acc.stat_mods.mr || 0) + base_value
      break
    case 55:
      acc.rune += base_value
      break
    case 59:
      acc.damage_shield += base_value
      break
    case 69:
      acc.stat_mods.mod_max_hp = (acc.stat_mods.mod_max_hp || 0) + base_value
      break
    case 97:
      acc.stat_mods.mod_max_mana = (acc.stat_mods.mod_max_mana || 0) + base_value
      break
    case 111: {
      const resist_value = base_value
      acc.stat_mods.mr = (acc.stat_mods.mr || 0) + resist_value
      acc.stat_mods.fr = (acc.stat_mods.fr || 0) + resist_value
      acc.stat_mods.cr = (acc.stat_mods.cr || 0) + resist_value
      acc.stat_mods.pr = (acc.stat_mods.pr || 0) + resist_value
      acc.stat_mods.dr = (acc.stat_mods.dr || 0) + resist_value
      break
    }
    case 119:
      acc.stat_mods.delay = (acc.stat_mods.delay || 0) + base_value
      break
    case 120:
      acc.stat_mods.mod_heal_pct = (acc.stat_mods.mod_heal_pct || 0) + base_value
      break
    case 124:
      acc.stat_mods.mod_spell_dmg_pct = (acc.stat_mods.mod_spell_dmg_pct || 0) + base_value
      break
    case 159:
      acc.stat_mods.str = (acc.stat_mods.str || 0) + base_value
      acc.stat_mods.sta = (acc.stat_mods.sta || 0) + base_value
      acc.stat_mods.agi = (acc.stat_mods.agi || 0) + base_value
      acc.stat_mods.dex = (acc.stat_mods.dex || 0) + base_value
      acc.stat_mods.int = (acc.stat_mods.int || 0) + base_value
      acc.stat_mods.wis = (acc.stat_mods.wis || 0) + base_value
      acc.stat_mods.cha = (acc.stat_mods.cha || 0) + base_value
      break
    case 21:
      if (base_value > 0) {
        acc.stun_duration = Math.max(acc.stun_duration, base_value)
      }
      break
    case 31:
      if (base_value > 0) {
        acc.mez_duration = Math.max(acc.mez_duration, base_value)
      }
      break
    default:
      // Unhandled effect IDs can be added here without touching consumers
      break
  }
}

/**
 * Parse spell effects array and convert to runtime format using the accumulator.
 */
export function parse_effects_array(effects_array, buffduration = 0, caster_cha = 0) {
  if (!Array.isArray(effects_array) || effects_array.length === 0) {
    return {
      stat_mods: null,
      tick_damage: 0,
      tick_heal: 0,
      tick_mana: 0,
      tick_endurance: 0,
      damage_shield: 0,
      rune: 0,
      base_tick_damage: 0,
      base_tick_heal: 0,
      stun_duration: 0,
      mez_duration: 0
    }
  }

  const acc = {
    stat_mods: {},
    tick_damage: 0,
    tick_heal: 0,
    tick_mana: 0,
    tick_endurance: 0,
    damage_shield: 0,
    rune: 0,
    base_tick_damage: 0,
    base_tick_heal: 0,
    stun_duration: 0,
    mez_duration: 0
  }

  effects_array.forEach((effect) =>
    accumulate_effect({
      effect,
      buffduration,
      caster_cha,
      acc
    })
  )

  return {
    stat_mods: Object.keys(acc.stat_mods).length > 0 ? acc.stat_mods : null,
    tick_damage: Math.round(acc.tick_damage * 100) / 100,
    tick_heal: Math.round(acc.tick_heal * 100) / 100,
    tick_mana: Math.round(acc.tick_mana * 100) / 100,
    tick_endurance: Math.round(acc.tick_endurance * 100) / 100,
    damage_shield: Math.round(acc.damage_shield * 100) / 100,
    rune: Math.round(acc.rune * 100) / 100,
    base_tick_damage: Math.round(acc.base_tick_damage * 100) / 100,
    base_tick_heal: Math.round(acc.base_tick_heal * 100) / 100,
    stun_duration: acc.stun_duration,
    mez_duration: acc.mez_duration
  }
}
