/**
 * Inventory flattening utility
 * 
 * Converts slots array to flat list format for merchant/bank panels
 */

import { CARRY_START } from '../services/inventoryManager'

/**
 * Flatten inventory slots to a list format for merchant/bank panels
 * Includes inventory slots (CARRY_START+) and bag contents
 * 
 * @param {Array} slots - Inventory slots array
 * @returns {Array} - Flat array of inventory entries { key, slot_index, container_index, item }
 */
export function flatten_inventory(slots) {
  const entries = []
  
  // Iterate through inventory slots (CARRY_START+)
  for (let idx = CARRY_START; idx < slots.length; idx += 1) {
    const item = slots[idx]
    if (!item) continue
    
    // Add main inventory item
    entries.push({
      key: `slot-${idx}`,
      slot_index: idx,
      container_index: null,
      item
    })
    
    // Add bag contents if present
    if (item.contents && Array.isArray(item.contents)) {
      for (let c_idx = 0; c_idx < item.contents.length; c_idx += 1) {
        const child = item.contents[c_idx]
        if (!child) continue
        
        entries.push({
          key: `slot-${idx}-bag-${c_idx}`,
          slot_index: idx,
          container_index: c_idx,
          item: child
        })
      }
    }
  }
  
  return entries
}

