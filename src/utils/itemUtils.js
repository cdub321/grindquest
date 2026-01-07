/**
 * Item-related utility functions
 * 
 * These utilities expect normalized data (snake_case from database).
 * No fallback patterns - data should be normalized before reaching these functions.
 */

// Slot ID to human-readable name mapping (for display only)
const slot_id_to_name = {
  0: 'Charm',
  1: 'Ear1',
  2: 'Head',
  3: 'Face',
  4: 'Ear2',
  5: 'Neck',
  6: 'Shoulders',
  7: 'Arms',
  8: 'Back',
  9: 'Wrist1',
  10: 'Wrist2',
  11: 'Range',
  12: 'Hands',
  13: 'Primary',
  14: 'Secondary',
  15: 'Finger1',
  16: 'Finger2',
  17: 'Chest',
  18: 'Legs',
  19: 'Feet',
  20: 'Waist',
  22: 'Ammo',
  23: 'Misc',
  30: 'INV1',
  31: 'INV2',
  32: 'INV3',
  33: 'INV4',
  34: 'INV5',
  35: 'INV6',
  36: 'INV7',
  37: 'INV8'
}

/**
 * Get human-readable slot name from slot ID
 * @param {number} slot_id - Slot ID
 * @returns {string} - Human-readable slot name
 */
function get_slot_name(slot_id) {
  return slot_id_to_name[slot_id] || `Slot ${slot_id}`
}

/**
 * Format slot IDs array to human-readable string
 * @param {Array<number>} slot_ids - Array of slot IDs
 * @returns {string} - Formatted slot names (e.g., "Finger1, Finger2")
 */
function format_slot_ids(slot_ids) {
  if (!slot_ids || !Array.isArray(slot_ids) || slot_ids.length === 0) {
    return 'Misc'
  }
  return slot_ids.map(id => get_slot_name(id)).join(', ')
}

/**
 * Format bonus value for display
 * @param {string} key - Bonus key (e.g., "str", "ac")
 * @param {number} value - Bonus value
 * @returns {string} - Formatted bonus string
 */
function format_bonus(key, value) {
  if (value === 0 || value === null) return null
  
  // Map bonus keys to display names
  const bonus_names = {
    'ac': 'AC',
    'cr': 'CR',
    'dr': 'DR',
    'fr': 'FR',
    'hp': 'HP',
    'mr': 'MR',
    'pr': 'PR',
    'agi': 'AGI',
    'cha': 'CHA',
    'dex': 'DEX',
    'int': 'INT',
    'sta': 'STA',
    'str': 'STR',
    'wis': 'WIS',
    'mana': 'Mana',
    'delay': 'Delay',
    'range': 'Range',
    'damage': 'Damage'
  }
  
  const display_name = bonus_names[key.toLowerCase()] || key.toUpperCase()
  return `${display_name}: ${value > 0 ? '+' : ''}${value}`
}

/**
 * Generate tooltip text for an item
 * @param {Object} item - Item object with snake_case fields (name, slots, quantity, bonuses)
 * @returns {string} - Formatted tooltip text
 */
export function build_item_tooltip(item) {
  if (!item) return ''
  
  const lines = []
  
  // Item name
  if (item.name) {
    lines.push(item.name)
  }
  
  // Slots (array of slot IDs)
  if (item.slots && Array.isArray(item.slots) && item.slots.length > 0) {
    const slot_names = format_slot_ids(item.slots)
    lines.push(`Slot: ${slot_names}`)
  }
  
  // Quantity (for stackable items)
  if (item.quantity && item.quantity > 1) {
    lines.push(`Qty: ${item.quantity}`)
  }
  
  // Bonuses
  if (item.bonuses && typeof item.bonuses === 'object') {
    const bonus_parts = Object.entries(item.bonuses)
      .map(([key, value]) => format_bonus(key, value))
      .filter(part => part !== null)
    
    if (bonus_parts.length > 0) {
      lines.push(bonus_parts.join('  '))
    }
  }
  
  return lines.join('\n')
}

/**
 * Format item name for display
 * @param {Object} item - Item object with snake_case fields
 * @returns {string} - Formatted item name
 */
export function format_item_name(item) {
  if (!item) return 'Unknown Item'
  return item.name || `Item ${item.id || 'Unknown'}`
}

/**
 * Get icon index for item display
 * @param {Object} item - Item object with snake_case fields
 * @returns {number|null} - Icon index or null if not available
 */
export function get_item_icon_index(item) {
  if (!item) return null
  
  // Icon index from database (icon_index field)
  if (typeof item.icon_index === 'number') {
    return item.icon_index
  }
  
  return null
}
