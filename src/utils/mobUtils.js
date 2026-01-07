/**
 * Mob/NPC utility functions
 * 
 * These utilities expect normalized data (snake_case from database).
 * No fallback patterns - data should be normalized before reaching these functions.
 */

/**
 * Generate portrait path from mob data
 * @param {Object} mob - Mob object with race_id, gender, texture_id (snake_case)
 * @returns {string|null} - Portrait image path or null if mob is invalid
 */
export function get_mob_portrait(mob) {
  if (!mob) return null
  
  // Expect snake_case from database
  const race = mob.race_id || 1
  const gender = mob.gender || 0
  const texture = mob.texture_id || 1
  
  return `/stone-ui/raceimages/${race}_${gender}_${texture}_0.jpg`
}

/**
 * Generate portrait path from NPC data (alias for get_mob_portrait)
 * @param {Object} npc - NPC object with race_id, gender, texture_id (snake_case)
 * @returns {string|null} - Portrait image path or null if npc is invalid
 */
export function get_npc_portrait(npc) {
  // NPCs use the same portrait system as mobs
  return get_mob_portrait(npc)
}

/**
 * Normalize mob data from database format
 * Ensures all fields are in snake_case and have proper defaults
 * @param {Object} mob - Raw mob data from database
 * @returns {Object} - Normalized mob object with snake_case fields
 */
export function normalize_mob(mob) {
  if (!mob) return null
  
  return {
    id: mob.id,
    name: mob.name || 'Unknown',
    level: Number(mob.level) || 1,
    max_level: Number(mob.max_level) || 0,
    hp: Number(mob.hp) || 1,
    mana: Number(mob.mana) || 0,
    endurance: Number(mob.endurance) || 0,
    damage: Number(mob.damage) || 1,
    xp: Number(mob.xp) || 0,
    ac: Number(mob.ac) || 0,
    delay: Number(mob.delay),
    movespeed: Number(mob.movespeed) || 1,
    melee_range: Number(mob.melee_range),
    aggro_range: Number(mob.aggro_range),
    race_id: Number(mob.race_id) || 1,
    gender: Number(mob.gender) || 0,
    texture_id: Number(mob.texture_id) || 1,
    is_named: Boolean(mob.is_named),
    is_kos: mob.is_kos !== undefined ? Boolean(mob.is_kos) : true,
    tags: mob.tags || [],
    loot_table_id: mob.loot_table_id || null,
    class_id: mob.class_id || null,
    stats: mob.stats || null,
    npc_spells: mob.npc_spells || null,
    damage_type: mob.damage_type || null,
    see_invis: Boolean(mob.see_invis),
    see_invis_undead: Boolean(mob.see_invis_undead),
    hp_regen_rate: Number(mob.hp_regen_rate) || 0,
    mana_regen_rate: Number(mob.mana_regen_rate) || 0,
    endurance_regen_rate: Number(mob.endurance_regen_rate) || 0,
    spellscale: Number(mob.spellscale) || 1.0,
    healscale: Number(mob.healscale) || 1.0,
    emote: mob.emote || null,
    avoidance: Number(mob.avoidance) || 0
  }
}
