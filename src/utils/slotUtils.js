/**
 * Slot formatting utilities
 * 
 * These utilities work with slot IDs (0-22 for equipment excluding slot 21, 30-37 for inventory).
 * All functions use slot IDs, not slot names.
 */

import { slotOrder, CARRY_START, SLOT_IDS } from '../services/inventoryManager'

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
 * Format a slot ID for display
 * Examples: 0 → 'Charm', 30 → 'INV1', 15 → 'Finger1'
 * @param {number} slot_id - Slot ID
 * @returns {string} - Formatted slot name
 */
export function format_slot_id(slot_id) {
  if (typeof slot_id !== 'number') return ''
  
  return slot_id_to_name[slot_id] || `Slot ${slot_id}`
}

/**
 * Get array of formatted slot labels from slotOrder
 * @returns {string[]} - Array of formatted slot labels
 */
export function get_slot_labels() {
  return slotOrder.map(slot_id => format_slot_id(slot_id))
}

/**
 * Get array index from slot ID (for equipment/inventory slots only, not bag slots)
 * @param {number} slot_id - Slot ID
 * @returns {number} - Array index, or -1 if not found
 */
export function get_slot_index(slot_id) {
  return slotOrder.indexOf(slot_id)
}

/**
 * Check if a slot ID is an equipment slot (0-22, excluding 21)
 * @param {number} slot_id - Slot ID
 * @returns {boolean} - True if equipment slot, false otherwise
 */
export function is_equipment_slot(slot_id) {
  return slot_id >= 0 && slot_id <= 22 && slot_id !== 21
}

/**
 * Check if a slot ID is an inventory slot (30-37)
 * @param {number} slot_id - Slot ID
 * @returns {boolean} - True if inventory slot, false otherwise
 */
export function is_inventory_slot(slot_id) {
  return slot_id >= SLOT_IDS.INV_START && slot_id <= SLOT_IDS.INV_END
}
