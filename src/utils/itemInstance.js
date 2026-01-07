/**
 * Item instance creation utility
 * 
 * Creates item instances from base item IDs for adding to inventory
 */

/**
 * Create an item instance from a base item ID
 * @param {number} base_item_id - Base item ID from items table
 * @param {Object} item_data - Base item data (from fetch_item or cache)
 * @returns {Object} - Item instance ready for inventory
 */
export function create_item_instance(base_item_id, item_data = {}) {
  return {
    id: `${base_item_id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    base_item_id: base_item_id,
    name: item_data.name || `Item ${base_item_id}`,
    quantity: 1,
    stackable: item_data.stackable || false,
    max_stack: item_data.max_stack || 1,
    icon_index: item_data.icon_index || null,
    slots: item_data.slots || [],
    bag_slots: item_data.bag_slots || 0,
    contents: item_data.bag_slots > 0 ? Array(item_data.bag_slots).fill(null) : null,
    bonuses: item_data.bonuses || null,
    item_data: null
  }
}

