/**
 * Combat display utility functions
 * 
 * These utilities are for UI display purposes only.
 * Actual combat calculations should be in the combat engine.
 */

/**
 * Get con (consider) color for mob based on level difference
 * @param {number} mob_level - Mob's level
 * @param {number} player_level - Player's level
 * @returns {Object|null} - Object with label and color, or null if invalid
 */
export function get_con_color(mob_level, player_level) {
  if (!Number.isFinite(mob_level) || !Number.isFinite(player_level)) {
    return null
  }
  
  const diff = mob_level - player_level
  
  if (diff >= 8) return { label: 'Maroon', color: '#4a041b' }
  if (diff >= 4) return { label: 'Red', color: '#b91c1c' }
  if (diff >= 1) return { label: 'Yellow', color: '#f59e0b' }
  if (diff === 0) return { label: 'White', color: '#e5e7eb' }
  if (diff >= -3) return { label: 'Blue', color: '#3b82f6' }
  if (diff >= -5) return { label: 'L. Blue', color: '#60a5fa' }
  if (diff >= -8) return { label: 'Green', color: '#10b981' }
  return { label: 'Dark Gray', color: '#6b7280' }
}

/**
 * Calculate segment size for HP bar overlays
 * Determines appropriate segment size based on max value
 * @param {number} max_value - Maximum value (HP, mana, etc.)
 * @returns {number} - Segment size, or 0 if invalid
 */
export function get_segment_size(max_value) {
  if (!max_value || max_value <= 0) return 0
  if (max_value <= 100) return 10
  if (max_value <= 250) return 25
  if (max_value <= 500) return 50
  if (max_value <= 2000) return 100
  if (max_value <= 5000) return 200
  if (max_value <= 10000) return 500
  return 1000
}

/**
 * Format combat log message
 * @param {string} message - Message text
 * @param {string} type - Message type (damage, kill, xp, loot, etc.)
 * @returns {string} - Formatted message (currently just returns message, but can add formatting)
 */
export function format_combat_message(message, type = 'normal') {
  // For now, just return the message
  // Can add formatting logic here if needed (timestamps, prefixes, etc.)
  return message
}
