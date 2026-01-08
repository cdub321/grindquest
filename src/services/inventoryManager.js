/**
 * Inventory management utilities
 * 
 * Slot ID System:
 * - Equipment slots: 0-22 (Charm through Ammo, excluding PowerSource slot 21)
 * - Misc items: 23 (un-equippable items)
 * - Inventory slots: 30-37 (INV1 through INV8)
 * - Bag slots: 100-199 (Bag 1), 200-299 (Bag 2), 300-399 (Bag 3), etc.
 *   Formula: bag_index * 100 + slot_position (e.g., bag 5 slot 2 = 502)
 * 
 * Core constants preserved:
 * - slotOrder: Array mapping array indices to slot IDs
 * - CARRY_START: Index where inventory slots begin (30)
 */

import { get_item_from_cache, fetch_item } from './referenceData'

// Slot order definition - maps array indices to slot IDs
// Equipment slots: 0-22 (excluding PowerSource slot 21)
export const slotOrder = [
  0,   // Charm
  1,   // Ear1
  2,   // Head
  3,   // Face
  4,   // Ear2
  5,   // Neck
  6,   // Shoulders
  7,   // Arms
  8,   // Back
  9,   // Wrist1
  10,  // Wrist2
  11,  // Range
  12,  // Hands
  13,  // Primary
  14,  // Secondary
  15,  // Finger1
  16,  // Finger2
  17,  // Chest
  18,  // Legs
  19,  // Feet
  20,  // Waist
  22,  // Ammo
  30,  // INV1
  31,  // INV2
  32,  // INV3
  33,  // INV4
  34,  // INV5
  35,  // INV6
  36,  // INV7
  37   // INV8
]

// Index where inventory slots begin (INV1 starts at index 22, slot ID 30)
export const CARRY_START = 22

// Slot ID constants for easy reference
export const SLOT_IDS = {
  CHARM: 0,
  EAR1: 1,
  HEAD: 2,
  FACE: 3,
  EAR2: 4,
  NECK: 5,
  SHOULDERS: 6,
  ARMS: 7,
  BACK: 8,
  WRIST1: 9,
  WRIST2: 10,
  RANGE: 11,
  HANDS: 12,
  PRIMARY: 13,
  SECONDARY: 14,
  FINGER1: 15,
  FINGER2: 16,
  CHEST: 17,
  LEGS: 18,
  FEET: 19,
  WAIST: 20,
  AMMO: 22,
  MISC: 23,
  INV_START: 30,
  INV_END: 37,
  BAG_START: 100
}

/**
 * Get slot ID from array index
 * @param {number} index - Array index
 * @returns {number|null} Slot ID or null if invalid
 */
export function get_slot_id(index) {
  if (index < 0 || index >= slotOrder.length) return null
  return slotOrder[index]
}

/**
 * Get array index from slot ID (for equipment/inventory slots only, not bag slots)
 * @param {number} slot_id - Slot ID
 * @returns {number|null} Array index or null if not found
 */
export function get_slot_index(slot_id) {
  const index = slotOrder.indexOf(slot_id)
  return index !== -1 ? index : null
}

/**
 * Check if a slot ID is an equipment slot (0-22, excluding 21)
 * @param {number} slot_id - Slot ID
 * @returns {boolean}
 */
export function is_equipment_slot(slot_id) {
  return slot_id >= 0 && slot_id <= 22 && slot_id !== 21
}

/**
 * Check if a slot ID is an inventory slot (30-37)
 * @param {number} slot_id - Slot ID
 * @returns {boolean}
 */
export function is_inventory_slot(slot_id) {
  return slot_id >= SLOT_IDS.INV_START && slot_id <= SLOT_IDS.INV_END
}

/**
 * Check if a slot ID is a bag slot (100+)
 * @param {number} slot_id - Slot ID
 * @returns {boolean}
 */
export function is_bag_slot(slot_id) {
  return slot_id >= SLOT_IDS.BAG_START
}

/**
 * Get inventory slot ID and position from bag slot ID
 * @param {number} slot_id - Bag slot ID (e.g., 105 = bag in slot 30, position 5)
 * @returns {{inventory_slot_id: number, position: number}|null}
 */
export function parse_bag_slot(slot_id) {
  if (!is_bag_slot(slot_id)) return null
  const bag_index = Math.floor(slot_id / 100)
  const inventory_slot_id = (bag_index - 1) + 30
  const position = slot_id % 100
  return { inventory_slot_id, position }
}

/**
 * Calculate bag slot ID from inventory slot ID and position within bag
 * @param {number} inventory_slot_id - Inventory slot ID (30-37 for INV1-8)
 * @param {number} position - Position within bag (0-based)
 * @returns {number} Bag slot ID
 */
export function calculate_bag_slot_id(inventory_slot_id, position) {
  return (inventory_slot_id - 30 + 1) * 100 + position
}

/**
 * Check if an item can be equipped in a specific slot
 * @param {object} item - The item to check (with snake_case fields, items.slots is INT2[])
 * @param {number} slot_id - The slot ID to check
 * @returns {boolean} - Whether the item can be equipped in this slot
 */
export function can_equip_item_in_slot(item, slot_id) {
  try {
    // Inventory slots (30-37) can hold anything
    if (is_inventory_slot(slot_id)) {
      return true
    }

    // Bag slots can hold anything
    if (is_bag_slot(slot_id)) {
      return true
    }

    // Equipment slots (0-22) - check if item.slots array contains this slot_id
    if (is_equipment_slot(slot_id)) {
      // If item has no slots array or it's empty, it's a misc item (not equippable)
      if (!item.slots || !Array.isArray(item.slots) || item.slots.length === 0) {
        return false
      }

      // Check if item.slots array contains this slot_id
      return item.slots.includes(slot_id)
    }

    return false
  } catch (error) {
    console.error('Error in can_equip_item_in_slot:', error)
    return false
  }
}

/**
 * Add an item to inventory with automatic stacking and bag support
 * @param {Array} slots - Current inventory slots array
 * @param {object} item - Item to add (with snake_case fields)
 * @param {number} qty - Quantity to add
 * @param {object} context - Context object with helper functions
 * @returns {Array} - Updated slots array
 */
export function add_item_to_inventory(slots, item, qty = 1, context = {}) {
  try {
    const { add_log = () => {}, schedule_save = () => {}, save_immediate = false } = context
    const add_qty = Math.max(1, qty ?? 1)
    const next = [...slots]

    // Get base item data from cache (for bag_slots)
    const base_item = get_item_from_cache(item.base_item_id)

    // Try to stack in existing inventory slots (30-37) first
    if (item.stackable) {
      let remaining_qty = add_qty

      // Check inventory slots (30-37)
      for (let i = CARRY_START; i < slotOrder.length && remaining_qty > 0; i += 1) {
        const slot = next[i]
        if (slot && slot.base_item_id === item.base_item_id) {
        const current_qty = slot.quantity ?? 1
        const max_stack = slot.max_stack ?? item.max_stack ?? 1
          const can_add = Math.min(remaining_qty, max_stack - current_qty)

          if (can_add > 0) {
            next[i] = { ...slot, quantity: current_qty + can_add }
            remaining_qty -= can_add
          }
        }
      }

      // If we've added everything, we're done
      if (remaining_qty === 0) {
        schedule_save({ inventory: true }, save_immediate ? { immediate: true } : {})
        return next
      }

      // Otherwise, create new stacks in empty inventory slots
      while (remaining_qty > 0) {
        const empty_idx = next.findIndex((s, idx) => idx >= CARRY_START && idx < slotOrder.length && !s)
        if (empty_idx === -1) break // No empty slots

        const bag_slots = base_item?.bag_slots ?? 0
        const max_stack = item.max_stack ?? 1
        const stack_qty = Math.min(remaining_qty, max_stack)

        next[empty_idx] = {
          ...item,
          quantity: stack_qty,
          bag_slots,
          contents: bag_slots ? Array(bag_slots).fill(null) : null
        }
        remaining_qty -= stack_qty
      }

      if (remaining_qty > 0) {
        // Try to create stacks inside bags
        for (let i = CARRY_START; i < slotOrder.length && remaining_qty > 0; i += 1) {
          const bag = next[i]
          if (!bag || !bag.bag_slots) continue

          // Ensure contents array exists
          const contents = Array.isArray(bag.contents) && bag.contents.length === bag.bag_slots
            ? bag.contents
            : Array(bag.bag_slots).fill(null)

          const empty_bag_idx = contents.findIndex((c) => !c)
          if (empty_bag_idx !== -1) {
            const max_stack = item.max_stack ?? 1
            const stack_qty = Math.min(remaining_qty, max_stack)
            const updated_contents = [...contents]
            updated_contents[empty_bag_idx] = { ...item, quantity: stack_qty }
            next[i] = { ...bag, contents: updated_contents }
            remaining_qty -= stack_qty
          }
        }

        if (remaining_qty > 0) {
          add_log('Inventory full!', 'error')
        }
      }

      schedule_save({ inventory: true }, save_immediate ? { immediate: true } : {})
      return next
    }

    // Non-stackable item - find first empty inventory slot (30-37)
    const empty_idx = next.findIndex((s, idx) => idx >= CARRY_START && idx < slotOrder.length && !s)
    if (empty_idx !== -1) {
      const bag_slots = base_item?.bag_slots ?? 0
      next[empty_idx] = {
        ...item,
        quantity: add_qty,
        bag_slots,
        contents: bag_slots ? Array(bag_slots).fill(null) : null
      }
      schedule_save({ inventory: true }, save_immediate ? { immediate: true } : {})
      return next
    }

    // Try bags in inventory slots
    for (let i = CARRY_START; i < slotOrder.length; i += 1) {
      const bag = next[i]
      if (!bag || !bag.bag_slots) continue

      const contents = Array.isArray(bag.contents) && bag.contents.length === bag.bag_slots
        ? bag.contents
        : Array(bag.bag_slots).fill(null)

      const empty_bag_idx = contents.findIndex((c) => !c)
      if (empty_bag_idx !== -1) {
        const updated_bag = { ...bag, contents: [...contents] }
        updated_bag.contents[empty_bag_idx] = { ...item, quantity: add_qty }
        next[i] = updated_bag
        schedule_save({ inventory: true }, save_immediate ? { immediate: true } : {})
        return next
      }
    }

    add_log('Inventory full!', 'error')
    return slots // Return original slots if unable to add
  } catch (error) {
    console.error('Error in add_item_to_inventory:', error)
    return slots
  }
}

/**
 * Serialize inventory slots array to database format
 * @param {Array} slots - Inventory slots array
 * @param {string} character_id - Character UUID
 * @returns {Array} - Array of inventory row objects ready for database
 */
export function serialize_inventory_to_db(slots, character_id) {
  try {
    const rows = []
    const bag_items_map = {} // Map inventory_slot_id -> array of items in that bag
    
    // First pass: serialize equipment and inventory slots (0-37), collect bag items
    for (let i = 0; i < slotOrder.length; i += 1) {
      const slot = slots[i]
      if (!slot) continue

      const slot_id = slotOrder[i]
      
      // Create row for the slot itself (equipment or inventory item)
      rows.push({
        character_id: character_id,
        slot_id: slot_id,
        base_item_id: slot.base_item_id,
        quantity: slot.quantity ?? 1,
        item_data: slot.item_data
      })

      // If this slot is a bag with contents, collect items for second pass
      if (slot.bag_slots > 0 && slot.contents && Array.isArray(slot.contents)) {
        if (!bag_items_map[slot_id]) {
          bag_items_map[slot_id] = []
        }
        
        for (let bag_pos = 0; bag_pos < slot.contents.length; bag_pos += 1) {
          const bag_item = slot.contents[bag_pos]
          if (!bag_item) continue

          bag_items_map[slot_id].push({
            position: bag_pos,
            item: bag_item
          })
        }
      }
    }

    // Second pass: serialize bag items using simple slot ID calculation
    for (const [inventory_slot_id_str, bag_items] of Object.entries(bag_items_map)) {
      const inventory_slot_id = parseInt(inventory_slot_id_str, 10)
      
      for (const { position, item } of bag_items) {
        const bag_slot_id = calculate_bag_slot_id(inventory_slot_id, position)
        rows.push({
          character_id: character_id,
          slot_id: bag_slot_id,
          base_item_id: item.base_item_id,
          quantity: item.quantity ?? 1,
          item_data: item.item_data
        })
      }
    }

    return rows
  } catch (error) {
    console.error('Error in serialize_inventory_to_db:', error)
    return []
  }
}

/**
 * Deserialize inventory rows from database to slots array
 * @param {Array} inventory_rows - Array of inventory row objects from database
 * @returns {Array} - Inventory slots array
 */
export function deserialize_inventory_from_db(inventory_rows) {
  try {
    const slots = Array(slotOrder.length).fill(null)
    const bag_items_by_slot = {} // Map inventory_slot_id -> array of bag items

    if (!inventory_rows) throw new Error('inventory_rows is required')
    
    // First pass: populate equipment and inventory slots (0-37), collect bag items
    for (const row of inventory_rows) {
      const slot_id = row.slot_id

      // If this is a bag slot (100+), collect it for second pass
      if (is_bag_slot(slot_id)) {
        const parsed = parse_bag_slot(slot_id)
        if (!parsed) continue
        
        const { inventory_slot_id } = parsed
        if (!bag_items_by_slot[inventory_slot_id]) {
          bag_items_by_slot[inventory_slot_id] = []
        }
        bag_items_by_slot[inventory_slot_id].push(row)
        continue
      }

      // Find array index for this slot_id (equipment/inventory slots 0-37)
      const slot_index = get_slot_index(slot_id)
      if (slot_index === null) continue

      const slot = {
        id: row.id,
        base_item_id: row.base_item_id,
        quantity: row.quantity ?? 1,
        item_data: row.item_data
      }

      // Initialize bag contents as empty - we'll populate in second pass if it's a bag
      slot.contents = null
      slot.bag_slots = 0

      slots[slot_index] = slot
    }

    // Second pass: populate bag contents from bag_items (or initialize empty bags)
    // NOTE: This must be synchronous, so we can't fetch items here
    // Instead, we populate bag contents based on what we have in bag_items_by_slot
    // The enrichment step in useCharacterLoader will fetch item data later
    for (let i = 0; i < slotOrder.length; i += 1) {
      const slot = slots[i]
      if (!slot) continue

      const slot_id = slotOrder[i]
      const bag_items = bag_items_by_slot[slot_id]
      
      // If there are bag items for this slot, it's a bag - populate it
      // We'll determine bag size from the items themselves or fetch it during enrichment
      if (bag_items && bag_items.length > 0) {
        // Find max position to determine bag size
        let max_position = -1
        for (const bag_item of bag_items) {
          const parsed = parse_bag_slot(bag_item.slot_id)
          if (!parsed) continue
          max_position = Math.max(max_position, parsed.position)
        }
        
        // Initialize bag contents array (size will be corrected during enrichment)
        // Use max_position + 1 as minimum size
        const estimated_size = max_position + 1
        slot.contents = Array(estimated_size).fill(null)
        
        // Populate bag contents
        for (const bag_item of bag_items) {
          const parsed = parse_bag_slot(bag_item.slot_id)
          if (!parsed) continue

          const { position } = parsed
          if (position >= 0 && position < slot.contents.length) {
            slot.contents[position] = {
              id: bag_item.id,
              base_item_id: bag_item.base_item_id,
              quantity: bag_item.quantity ?? 1,
              item_data: bag_item.item_data
            }
          }
        }
      } else {
        // Check if this is a bag by looking it up in items cache (for empty bags)
        // If not in cache, we'll handle it during enrichment
        const base_item = get_item_from_cache(slot.base_item_id)
        if (base_item && base_item.bag_slots && base_item.bag_slots > 0) {
          slot.contents = Array(base_item.bag_slots).fill(null)
          slot.bag_slots = base_item.bag_slots
        }
      }
    }

    return slots
  } catch (error) {
    console.error('Error in deserialize_inventory_from_db:', error)
    return Array(slotOrder.length).fill(null)
  }
}
