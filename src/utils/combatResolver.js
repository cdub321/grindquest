/**
 * Combat resolution utilities
 * Handles hit/miss, crit, resist checks and damage calculations
 * All functions use snake_case naming convention
 */

/**
 * Calculate hit chance based on attacker and defender levels
 * @param {number} attacker_level - Attacker's level
 * @param {number} defender_level - Defender's level
 * @returns {number} Hit chance (0.0 to 1.0)
 */
function compute_hit_chance(attacker_level, defender_level) {
  const base = 0.9;
  const diff = (defender_level || 0) - (attacker_level || 0);
  const penalty = diff > 0 ? diff * 0.03 : diff * 0.01; // harder when underlevel, small bonus when higher
  return Math.max(0.05, Math.min(0.98, base - penalty));
}

/**
 * Calculate dodge chance based on AGI
 * @param {number} agi - Agility stat value
 * @returns {number} Dodge chance (0.0 to 1.0)
 */
function compute_dodge_chance(agi) {
  // Base dodge from AGI: AGI / 1000, capped at 0.5 (50%)
  const base_dodge = (agi || 0) / 1000;
  return Math.max(0, Math.min(0.5, base_dodge));
}

/**
 * Adjust dodge chance based on level difference
 * @param {number} dodge_chance - Base dodge chance
 * @param {number} attacker_level - Attacker's level
 * @param {number} defender_level - Defender's level
 * @returns {number} Adjusted dodge chance (0.0 to 1.0)
 */
function adjust_dodge_for_level(dodge_chance, attacker_level, defender_level) {
  const diff = (attacker_level || 0) - (defender_level || 0);
  let adjusted = dodge_chance;
  if (diff > 0) {
    adjusted -= diff * 0.01; // better attacker reduces defender dodge
  } else if (diff < 0) {
    adjusted += Math.abs(diff) * 0.005; // weaker attacker = slightly more dodge
  }
  return Math.max(0, Math.min(0.5, adjusted));
}

/**
 * Calculate level-based damage multiplier
 * @param {number} attacker_level - Attacker's level
 * @param {number} defender_level - Defender's level
 * @returns {number} Damage multiplier (0.7 to 1.3)
 */
export function level_damage_multiplier(attacker_level, defender_level) {
  const diff = (attacker_level || 0) - (defender_level || 0);
  
  // If the attacker is lower level, give a modest penalty (up to -50% damage)
  if (diff <= 0) {
    const penalty = Math.max(-0.5, diff * 0.02); // -2% per level gap, capped at -50%
    return 1 + penalty;
  }
  
  // If the attacker is higher level, scale harder after a small soft cap:
  // - First 10 levels: +2% per level (light bonus)
  // - Levels beyond 10: +8% per level (steep curve so very high mobs smash low players)
  const early_levels = Math.min(diff, 10);
  const late_levels = Math.max(diff - 10, 0);
  const bonus = (early_levels * 0.02) + (late_levels * 0.08);
  
  // Cap multiplier to avoid infinite growth but keep it scary (max 5x damage)
  return Math.min(5, 1 + bonus);
}

/**
 * Resolve hit/miss check
 * @param {Object} params
 * @param {number} params.attacker_level - Attacker's level
 * @param {number} params.defender_level - Defender's level
 * @param {number} params.defender_agi - Defender's agility
 * @returns {Object} { hit, missed } - Hit resolution result
 */
export function resolve_hit({ attacker_level, defender_level, defender_agi }) {
  // Calculate hit chance
  const hit_chance = compute_hit_chance(attacker_level, defender_level);
  
  // Calculate dodge chance
  const dodge_base = compute_dodge_chance(defender_agi);
  const dodge_chance = adjust_dodge_for_level(dodge_base, attacker_level, defender_level);
  
  // Roll for hit
  const hit_roll = Math.random();
  if (hit_roll > hit_chance) {
    return { hit: false, missed: true, dodged: false };
  }
  
  // Roll for dodge
  const dodge_roll = Math.random();
  if (dodge_roll < dodge_chance) {
    return { hit: false, missed: false, dodged: true };
  }
  
  return { hit: true, missed: false, dodged: false };
}

/**
 * Calculate crit chance
 * @param {Object} params
 * @param {number} params.attacker_dex - Attacker's dexterity
 * @param {number} params.attacker_level - Attacker's level
 * @param {number} params.defender_level - Defender's level
 * @param {number} params.base_crit_chance - Base crit chance (default 0.05 = 5%)
 * @returns {number} Crit chance (0.0 to 1.0)
 */
export function calculate_crit_chance({ attacker_dex, attacker_level, defender_level, base_crit_chance = 0.05 }) {
  // DEX bonus: DEX / 1000 (no cap, scales linearly)
  const dex_bonus = (attacker_dex || 0) / 1000;
  
  // Level difference bonus/penalty
  const level_diff = (attacker_level || 0) - (defender_level || 0);
  const level_bonus = Math.max(-0.05, Math.min(0.05, level_diff * 0.01)); // +/-1% per level, capped at 5%
  
  const total_crit = base_crit_chance + dex_bonus + level_bonus;
  return Math.max(0, total_crit); // No cap - scales with DEX
}

/**
 * Check if crit occurs
 * @param {number} crit_chance - Crit chance (0.0 to 1.0)
 * @returns {boolean} Whether crit occurred
 */
export function check_crit(crit_chance) {
  return Math.random() < crit_chance;
}

/**
 * Resolve spell resist check
 * @param {Object} params
 * @param {number} params.caster_cha - Caster's charisma
 * @param {number} params.target_resist - Target's resist value (0-100)
 * @param {number} params.resist_type - Resist type (0=none, 1=magic, 2=fire, 3=cold, 4=poison, 5=disease)
 * @param {number} params.spell_resist_type - Spell's resist type
 * @returns {Object} { resisted, resist_amount } - Resist resolution result
 */
export function resolve_resist({ caster_cha, target_resist, resist_type, spell_resist_type }) {
  // If resist type is 0 (none), no resist check
  if (spell_resist_type === 0 || spell_resist_type === null || spell_resist_type === undefined) {
    return { resisted: false, resist_amount: 0 };
  }
  
  // If resist types don't match, no resist
  if (resist_type !== spell_resist_type) {
    return { resisted: false, resist_amount: 0 };
  }
  
  // CHA helps land spells (reduces target's effective resist)
  const cha_bonus = Math.min(20, (caster_cha || 0) / 5); // Up to 20% reduction
  const effective_resist = Math.max(0, target_resist - cha_bonus);
  
  // Resist chance: effective_resist / 100
  const resist_chance = effective_resist / 100;
  const resisted = Math.random() < resist_chance;
  
  return {
    resisted,
    resist_amount: resisted ? effective_resist : 0
  };
}

/**
 * Complete hit resolution (hit/miss, crit, resist)
 * @param {Object} params
 * @param {number} params.attacker_level - Attacker's level
 * @param {number} params.defender_level - Defender's level
 * @param {number} params.defender_agi - Defender's agility
 * @param {number} params.attacker_dex - Attacker's dexterity (for crit)
 * @param {boolean} params.is_spell - Whether this is a spell
 * @param {number} params.caster_cha - Caster's charisma (for spells)
 * @param {number} params.target_resist - Target's resist value (for spells)
 * @param {number} params.resist_type - Target's resist type (for spells)
 * @param {number} params.spell_resist_type - Spell's resist type (for spells)
 * @returns {Object} Complete resolution result
 */
export function resolve_attack({
  attacker_level,
  defender_level,
  defender_agi,
  attacker_dex = 0,
  is_spell = false,
  caster_cha = 0,
  target_resist = 0,
  resist_type = 0,
  spell_resist_type = 0
}) {
  // For spells, check resist first
  if (is_spell) {
    const resist_result = resolve_resist({
      caster_cha,
      target_resist,
      resist_type,
      spell_resist_type
    });
    
    if (resist_result.resisted) {
      return {
        hit: false,
        missed: false,
        dodged: false,
        resisted: true,
        crit: false
      };
    }
  }
  
  // Resolve hit/miss/dodge
  const hit_result = resolve_hit({
    attacker_level,
    defender_level,
    defender_agi
  });
  
  if (!hit_result.hit) {
    return {
      ...hit_result,
      resisted: false,
      crit: false
    };
  }
  
  // Check for crit (only if hit)
  const crit_chance = calculate_crit_chance({
    attacker_dex,
    attacker_level,
    defender_level
  });
  const is_crit = check_crit(crit_chance);
  
  return {
    hit: true,
    missed: false,
    dodged: false,
    resisted: false,
    crit: is_crit
  };
}

/**
 * Calculate base damage from stats and gear
 * @param {Object} params
 * @param {number} params.base_damage - Base damage from class
 * @param {number} params.str - Strength stat
 * @param {number} params.level - Character level
 * @param {Object} params.gear_bonuses - Gear bonuses object
 * @param {Object} params.effect_modifiers - Effect modifiers object
 * @returns {number} Base damage value
 */
export function calculate_base_damage({ base_damage = 1, str = 0, level = 1, gear_bonuses = {}, effect_modifiers = {} }) {
  // STR bonus: STR * 0.1 * level (rounded to tens)
  const str_bonus = Math.floor((str * 0.1 * level) / 10) * 10;
  
  // Gear damage bonus
  const gear_damage = gear_bonuses.damage || 0;
  
  // Effect damage modifier (percentage)
  const effect_damage_mod = effect_modifiers.damage || 0;
  
  // Base damage calculation
  const total_base = base_damage + str_bonus + gear_damage;
  
  // Apply effect modifier (percentage)
  const modified = total_base * (1 + effect_damage_mod / 100);
  
  return Math.floor(modified);
}

/**
 * Calculate damage range (min and max)
 * @param {Object} params
 * @param {number} params.min_damage - Minimum damage
 * @param {number} params.max_damage - Maximum damage
 * @returns {Object} { min, max } damage values
 */
export function calculate_damage_range({ min_damage = 1, max_damage = 1 }) {
  return {
    min: min_damage,
    max: max_damage
  };
}

/**
 * Roll random damage within range
 * @param {number} min_damage - Minimum damage
 * @param {number} max_damage - Maximum damage
 * @returns {number} Random damage value
 */
export function roll_damage(min_damage, max_damage) {
  if (min_damage >= max_damage) return min_damage;
  return Math.floor(min_damage + Math.random() * (max_damage - min_damage + 1));
}

/**
 * Apply AC reduction to physical damage
 * @param {number} damage - Base damage
 * @param {number} target_ac - Target's AC value
 * @returns {number} Damage after AC reduction
 */
export function apply_ac_reduction(damage, target_ac) {
  // AC reduces damage by AC/10, but damage can't go below 1
  const ac_reduction = Math.min(damage - 1, Math.floor(target_ac / 10));
  return Math.max(1, damage - ac_reduction);
}

/**
 * Apply resist reduction to spell damage
 * @param {number} damage - Base damage
 * @param {number} target_resist - Target's resist percentage (0-100)
 * @returns {number} Damage after resist reduction
 */
export function apply_resist_reduction(damage, target_resist) {
  // Resist reduces damage by percentage
  const resist_reduction = Math.floor(damage * (target_resist / 100));
  return Math.max(0, damage - resist_reduction);
}

/**
 * Calculate crit damage multiplier
 * @param {number} crit_chance - Crit chance (0.0 to 1.0)
 * @param {number} crit_multiplier - Crit damage multiplier (default 2.0)
 * @returns {number} Final damage multiplier if crit occurs
 */
export function calculate_crit_damage(crit_chance, crit_multiplier = 2.0) {
  // Check if crit occurs
  if (Math.random() < crit_chance) {
    return crit_multiplier;
  }
  return 1.0;
}

/**
 * Calculate final damage with all modifiers
 * @param {Object} params
 * @param {number} params.base_damage - Base damage value
 * @param {boolean} params.is_spell - Whether this is spell damage
 * @param {string} params.school - Damage school (physical, magic, fire, cold, poison, disease)
 * @param {number} params.target_ac - Target's AC (for physical damage)
 * @param {number} params.target_resist - Target's resist percentage (for spell damage)
 * @param {number} params.level_multiplier - Level-based damage multiplier
 * @param {number} params.crit_chance - Crit chance (0.0 to 1.0)
 * @param {number} params.crit_multiplier - Crit damage multiplier
 * @returns {Object} { damage, is_crit } - Final damage and crit flag
 */
export function calculate_final_damage({
  base_damage,
  is_spell = false,
  school = 'physical',
  target_ac = 0,
  target_resist = 0,
  level_multiplier = 1.0,
  crit_chance = 0.0,
  crit_multiplier = 2.0
}) {
  // Apply level multiplier
  let damage = Math.floor(base_damage * level_multiplier);
  
  // Check for crit
  const is_crit = Math.random() < crit_chance;
  if (is_crit) {
    damage = Math.floor(damage * crit_multiplier);
  }
  
  // Apply mitigation based on damage type
  if (!is_spell) {
    // Physical damage: AC reduction
    damage = apply_ac_reduction(damage, target_ac);
  } else {
    // Spell damage: Resist reduction
    damage = apply_resist_reduction(damage, target_resist);
  }
  
  return {
    damage: Math.max(0, damage),
    is_crit
  };
}

