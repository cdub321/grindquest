/**
 * Utility functions for parsing spell effects from spells_import.effects JSONB
 */

/**
 * Parse spell effects array and convert to runtime format
 * @param {Array} effects_array - Effects array from spells_import.effects JSONB
 * @param {number} buffduration - Spell duration in seconds
 * @param {number} caster_cha - Caster CHA for effect calculations
 * @returns {Object} Parsed effect data with stat_mods, tick values, etc.
 */
export function parse_spell_effects(effects_array, buffduration = 0, caster_cha = 0) {
  return parse_effects_array(effects_array, buffduration, caster_cha)
}

import { parse_effects_array } from './effectRegistry'
