/**
 * Stat calculation utilities
 * All functions use snake_case naming convention
 */

/**
 * Sum bonuses from equipped items (slots 0-22 excluding slot 21, before carry_start index)
 * @param {Array} slots - Array of items (null for empty slots)
 * @param {number} carry_start - Index where inventory slots begin
 * @returns {Object} Sum of all bonuses from equipped items
 */
export function calculate_total_bonuses(slots, carry_start) {
  const bonuses = {
    str: 0,
    sta: 0,
    agi: 0,
    dex: 0,
    int: 0,
    wis: 0,
    cha: 0,
    ac: 0,
    hp: 0,
    mana: 0,
    endurance: 0,
    mr: 0,
    dr: 0,
    fr: 0,
    cr: 0,
    pr: 0,
    damage: 0,
    hp_regen: 0,
    mana_regen: 0,
    endurance_regen: 0
  }

  // Only sum bonuses from equipped items (slots 0-22 excluding slot 21, indices 0 to carry_start-1)
  for (let i = 0; i < carry_start; i++) {
    const item = slots[i]
    if (!item || !item.bonuses) continue

    const item_bonuses = item.bonuses
    if (item_bonuses.str) bonuses.str += item_bonuses.str
    if (item_bonuses.sta) bonuses.sta += item_bonuses.sta
    if (item_bonuses.agi) bonuses.agi += item_bonuses.agi
    if (item_bonuses.dex) bonuses.dex += item_bonuses.dex
    if (item_bonuses.int) bonuses.int += item_bonuses.int
    if (item_bonuses.wis) bonuses.wis += item_bonuses.wis
    if (item_bonuses.cha) bonuses.cha += item_bonuses.cha
    if (item_bonuses.ac) bonuses.ac += item_bonuses.ac
    if (item_bonuses.hp) bonuses.hp += item_bonuses.hp
    if (item_bonuses.mana) bonuses.mana += item_bonuses.mana
    if (item_bonuses.endurance) bonuses.endurance += item_bonuses.endurance
    if (item_bonuses.mr) bonuses.mr += item_bonuses.mr
    if (item_bonuses.dr) bonuses.dr += item_bonuses.dr
    if (item_bonuses.fr) bonuses.fr += item_bonuses.fr
    if (item_bonuses.cr) bonuses.cr += item_bonuses.cr
    if (item_bonuses.pr) bonuses.pr += item_bonuses.pr
    if (item_bonuses.damage) bonuses.damage += item_bonuses.damage
    if (item_bonuses.hp_regen) bonuses.hp_regen += item_bonuses.hp_regen
    if (item_bonuses.mana_regen) bonuses.mana_regen += item_bonuses.mana_regen
    if (item_bonuses.endurance_regen) bonuses.endurance_regen += item_bonuses.endurance_regen
  }

  return bonuses
}

/**
 * Calculate stat totals (base stats + gear bonuses)
 * @param {Object} base_stats - Base character stats (str_base, sta_base, etc.)
 * @param {Object} total_bonuses - Sum of gear bonuses from calculate_total_bonuses
 * @returns {Object} Total stats including gear bonuses
 */
export function calculate_stat_totals(base_stats, total_bonuses) {
  return {
    str: (base_stats.str_base || 0) + (total_bonuses.str || 0),
    sta: (base_stats.sta_base || 0) + (total_bonuses.sta || 0),
    agi: (base_stats.agi_base || 0) + (total_bonuses.agi || 0),
    dex: (base_stats.dex_base || 0) + (total_bonuses.dex || 0),
    int: (base_stats.int_base || 0) + (total_bonuses.int || 0),
    wis: (base_stats.wis_base || 0) + (total_bonuses.wis || 0),
    cha: (base_stats.cha_base || 0) + (total_bonuses.cha || 0),
    ac: (total_bonuses.ac || 0),
    hp: (total_bonuses.hp || 0),
    mana: (total_bonuses.mana || 0),
    endurance: (total_bonuses.endurance || 0),
    mr: (total_bonuses.mr || 0),
    dr: (total_bonuses.dr || 0),
    fr: (total_bonuses.fr || 0),
    cr: (total_bonuses.cr || 0),
    pr: (total_bonuses.pr || 0),
    damage: (total_bonuses.damage || 0),
    hp_regen: (total_bonuses.hp_regen || 0),
    mana_regen: (total_bonuses.mana_regen || 0),
    endurance_regen: (total_bonuses.endurance_regen || 0)
  }
}

/**
 * Calculate derived stats (damage, attack delay, etc.)
 * @param {Object} params - Parameters object
 * @param {Object} params.player_class - Class data (base_damage, attack_speed, resource_type)
 * @param {number} params.level - Character level
 * @param {Object} params.total_bonuses - Gear bonuses
 * @param {Object} params.stat_totals - Total stats (base + gear + effects)
 * @returns {Object} Derived stats
 */
export function calculate_derived_stats({ player_class, level, total_bonuses, stat_totals }) {
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

  // Base damage from class + gear + STR scaling + level scaling
  const base_damage = (player_class.base_damage || 0) + (total_bonuses.damage || 0)
  // Use a softer curve for level scaling (square root) to tame early-level growth
  const effective_level = 1 + Math.sqrt(Math.max(0, level - 1))
  const str_bonus = Math.floor(((stat_totals.str || 0) * 0.05 * effective_level) / 10) * 10 // STR * 0.05 * effective level, rounded to tens
  const level_mult = 1 + (effective_level - 1) * 0.01 // 1% per effective level
  const base_with_str = base_damage + str_bonus
  const min_damage = Math.floor(base_with_str * level_mult)
  const max_damage = Math.floor(base_with_str * 1.2 * level_mult) // tighten spread to 1.2x

  // Attack delay from class (lower is faster)
  const base_delay = player_class.attack_speed
  if (!base_delay) {
    throw new Error('Player class attack_speed is required')
  }
  const agi_mod = Math.max(0.5, 1 - ((stat_totals.agi || 0) / 200)) // AGI reduces delay
  const attack_delay = Math.floor(base_delay * agi_mod)

  // Carry capacity: base 10 + STR bonus
  const carry_cap = 10 + Math.floor((stat_totals.str || 0) / 10)

  // Spell damage modifier: INT/10
  const spell_dmg_mod = Math.floor((stat_totals.int || 0) / 10)

  // Heal modifier: WIS/10
  const heal_mod = Math.floor((stat_totals.wis || 0) / 10)

  // XP bonus: CHA/10
  const xp_bonus = Math.floor((stat_totals.cha || 0) / 10)

  return {
    min_damage,
    max_damage,
    attack_delay,
    carry_cap,
    spell_dmg_mod,
    heal_mod,
    xp_bonus
  }
}

/**
 * Calculate display bonuses for UI (gear bonuses formatted for display)
 * @param {Object} total_bonuses - Sum of gear bonuses
 * @param {Object} stat_totals - Total stats (for reference)
 * @returns {Object} Formatted bonuses for display
 */
export function calculate_display_bonuses(total_bonuses, stat_totals) {
  return {
    str: total_bonuses.str || 0,
    sta: total_bonuses.sta || 0,
    agi: total_bonuses.agi || 0,
    dex: total_bonuses.dex || 0,
    int: total_bonuses.int || 0,
    wis: total_bonuses.wis || 0,
    cha: total_bonuses.cha || 0,
    ac: total_bonuses.ac || 0,
    hp: total_bonuses.hp || 0,
    mana: total_bonuses.mana || 0,
    endurance: total_bonuses.endurance || 0,
    mr: total_bonuses.mr || 0,
    dr: total_bonuses.dr || 0,
    fr: total_bonuses.fr || 0,
    cr: total_bonuses.cr || 0,
    pr: total_bonuses.pr || 0,
    damage: total_bonuses.damage || 0,
    hp_regen: total_bonuses.hp_regen || 0,
    mana_regen: total_bonuses.mana_regen || 0,
    endurance_regen: total_bonuses.endurance_regen || 0
  }
}

