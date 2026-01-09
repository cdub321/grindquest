import { useState, useEffect, useCallback, useRef } from 'react'
import { can_equip_item_in_slot, get_slot_id, get_slot_index, is_bag_slot, parse_bag_slot, add_item_to_inventory, CARRY_START } from '../services/inventoryManager'

/**
 * Hook to manage inventory state and item movement
 * @param {Array} initial_slots - Initial slots array from useCharacter
 * @param {Object} slots_ref - Ref to slots from useCharacter (for stat calculations)
 * @param {Function} schedule_save - Save function from useCharacter
 * @param {Function} add_log - Logging function (optional)
 * @returns {Object} Inventory state and functions
 */
export function use_inventory(initial_slots, slots_ref, schedule_save, add_log = null) {
  // Selected slot (array index for main slots, or slot ID for bag contents)
  const [selected_slot, set_selected_slot] = useState(null)
  
  // Current slots state for UI rendering
  const [current_slots, set_current_slots] = useState(() => [...(initial_slots || [])])
  
  // Get item from slot (handles both main slots and bag contents)
  const get_item_from_slot = useCallback((slot_index_or_id) => {
    // Check if this is a bag slot ID (100+)
    if (slot_index_or_id >= 100) {
      const parsed = parse_bag_slot(slot_index_or_id)
      if (!parsed) return null
      
      const { inventory_slot_id, position } = parsed
      
      // Find the bag in the inventory slot
      const slot_index = get_slot_index(inventory_slot_id)
      if (slot_index === null) return null
      
      const bag = slots_ref.current[slot_index]
      if (!bag || !bag.bag_slots || !bag.contents) return null
      
      if (position >= 0 && position < bag.contents.length) {
        return bag.contents[position] || null
      }
      return null
    } else {
      // Main slot: use array index
      if (slot_index_or_id < 0 || slot_index_or_id >= slots_ref.current.length) return null
      return slots_ref.current[slot_index_or_id] || null
    }
  }, [slots_ref])
  
  // Set item in slot (handles both main slots and bag contents)
  const set_item_in_slot = useCallback((slot_index_or_id, item) => {
    const next = [...slots_ref.current]
    
    // Check if this is a bag slot ID (100+)
    if (slot_index_or_id >= 100) {
      const parsed = parse_bag_slot(slot_index_or_id)
      if (!parsed) {
        slots_ref.current = next
        set_current_slots([...next])
        return next
      }
      
      const { inventory_slot_id, position } = parsed
      
      // Find the bag in the inventory slot
      const slot_index = get_slot_index(inventory_slot_id)
      if (slot_index === null) {
        slots_ref.current = next
        set_current_slots([...next])
        return next
      }
      
      const bag = next[slot_index]
      if (!bag || !bag.bag_slots) {
        slots_ref.current = next
        set_current_slots([...next])
        return next
      }
      
      // Ensure bag has contents array
      if (!bag.contents) {
        bag.contents = Array(bag.bag_slots).fill(null)
      }
      
      if (position >= 0 && position < bag.contents.length) {
        const new_contents = [...bag.contents]
        // Create a copy of the item to avoid reference issues
        new_contents[position] = item ? { ...item } : null
        next[slot_index] = { ...bag, contents: new_contents }
        slots_ref.current = next
        set_current_slots([...next])
        return next
      }
      
      slots_ref.current = next
      set_current_slots([...next])
      return next
    } else {
      // Main slot: use array index
      if (slot_index_or_id < 0 || slot_index_or_id >= next.length) {
        slots_ref.current = next
        set_current_slots([...next])
        return next
      }
      next[slot_index_or_id] = item ? { ...item } : null
      slots_ref.current = next
      set_current_slots([...next])
      return next
    }
  }, [slots_ref, set_current_slots])
  
  // Handle slot click (main slots or bag contents)
  const handle_slot_click = useCallback((slot_index_or_id) => {
    // If nothing is selected, select this slot
    if (selected_slot === null) {
      const item = get_item_from_slot(slot_index_or_id)
      if (item) {
        set_selected_slot(slot_index_or_id)
      }
      return
    }
    
    // If clicking the same slot, deselect
    if (selected_slot === slot_index_or_id) {
      set_selected_slot(null)
      return
    }
    
    // Otherwise, try to move/swap items
    const source_item = get_item_from_slot(selected_slot)
    const target_item = get_item_from_slot(slot_index_or_id)
    
    if (!source_item) {
      set_selected_slot(null)
      return
    }
    
    // Prevent putting a bag with items into any bag slot (empty bags are allowed)
    if (source_item.bag_slots > 0 && slot_index_or_id >= 100) {
      // Check if bag has any items in it
      const bag_contents = source_item.contents || []
      const has_items = Array.isArray(bag_contents) && bag_contents.some(item => item !== null)
      
      if (has_items) {
        // Source is a bag with items, target is a bag slot - prevent it
        if (add_log) {
          add_log('You cannot put a bag with items inside another bag.', 'error')
        }
        set_selected_slot(null)
        return
      }
      // Empty bags are allowed in bag slots
    }
    
    // BAG SLOTS CAN HOLD ANYTHING - SKIP ALL VALIDATION FOR BAG SLOTS
    if (slot_index_or_id >= 100) {
      // Bag slot - no validation needed, just proceed to move
    } else {
      // Regular slot - validate
      const target_slot_id = get_slot_id(slot_index_or_id)
      if (target_slot_id === null) {
        set_selected_slot(null)
        return
      }
      
      if (!can_equip_item_in_slot(source_item, target_slot_id)) {
        if (add_log) {
          add_log(`${source_item.name} cannot be equipped in that slot.`, 'error')
        }
        set_selected_slot(null)
        return
      }
    }
    
    // If swapping, check if target item can go in source slot
    if (target_item) {
      let source_slot_id
      if (selected_slot >= 100) {
        // Source is a bag slot - bag slots can hold anything, skip validation
        source_slot_id = selected_slot
      } else {
        source_slot_id = get_slot_id(selected_slot)
        if (source_slot_id === null) {
          set_selected_slot(null)
          return
        }
        
        // Only validate if source is NOT a bag slot (bag slots can hold anything)
        if (!can_equip_item_in_slot(target_item, source_slot_id)) {
          if (add_log) {
            add_log(`Cannot swap: ${target_item.name} cannot be equipped in that slot.`, 'error')
          }
          set_selected_slot(null)
          return
        }
      }
    }
    
    // Perform the move/swap - do both updates in a single state change
    const next = [...slots_ref.current]
    
    // Helper to set item in a slot (local function, doesn't update state)
    const set_item_local = (slot_idx_or_id, item_val) => {
      if (slot_idx_or_id >= 100) {
        // Bag slot
        const parsed = parse_bag_slot(slot_idx_or_id)
        if (!parsed) return
        
        const { inventory_slot_id, position } = parsed
        const slot_idx = get_slot_index(inventory_slot_id)
        if (slot_idx === null || slot_idx < 0 || slot_idx >= next.length) return
        
        const bag = next[slot_idx]
        if (!bag || !bag.bag_slots || bag.bag_slots <= 0) return
        
        // Ensure bag has contents array
        const bag_contents = bag.contents || Array(bag.bag_slots).fill(null)
        
        if (position >= 0 && position < bag_contents.length) {
          const new_contents = [...bag_contents]
          new_contents[position] = item_val ? { ...item_val } : null
          next[slot_idx] = { ...bag, contents: new_contents }
        }
      } else {
        // Main slot
        if (slot_idx_or_id >= 0 && slot_idx_or_id < next.length) {
          next[slot_idx_or_id] = item_val ? { ...item_val } : null
        }
      }
    }
    
    // If target is empty, just move
    if (!target_item) {
      set_item_local(slot_index_or_id, source_item)
      set_item_local(selected_slot, null)
    }
    // If both are the same stackable item, try to stack
    else if (
      source_item.stackable &&
      source_item.base_item_id === target_item.base_item_id
    ) {
      const max_stack = target_item.max_stack || source_item.max_stack || 1
      const current_qty = target_item.quantity || 1
      const source_qty = source_item.quantity || 1
      const can_add = Math.min(source_qty, max_stack - current_qty)
      
      if (can_add > 0) {
        // Stack them
        set_item_local(slot_index_or_id, { ...target_item, quantity: current_qty + can_add })
        
        const remaining = source_qty - can_add
        if (remaining > 0) {
          set_item_local(selected_slot, { ...source_item, quantity: remaining })
        } else {
          set_item_local(selected_slot, null)
        }
      } else {
        // Stack is full, swap them
        set_item_local(slot_index_or_id, source_item)
        set_item_local(selected_slot, target_item)
      }
    }
    // Otherwise, swap them
    else {
      set_item_local(slot_index_or_id, source_item)
      set_item_local(selected_slot, target_item)
    }
    
    // Update state once with all changes
    slots_ref.current = next
    set_current_slots([...next])
    
    // Save inventory immediately when items are moved (user-initiated action)
    schedule_save({ inventory: true }, { immediate: true })
    set_selected_slot(null)
  }, [selected_slot, get_item_from_slot, set_item_in_slot, schedule_save, add_log, slots_ref])
  
  // Split stack (right-click)
  const split_item = useCallback((slot_index_or_id) => {
    const item = get_item_from_slot(slot_index_or_id)
    if (!item || !item.stackable || (item.quantity || 1) <= 1) return
    
    // Split in half (rounded down)
    const split_qty = Math.floor((item.quantity || 1) / 2)
    const remaining_qty = (item.quantity || 1) - split_qty
    
    // Find an empty inventory slot for the split stack
    let empty_idx = -1
    for (let i = CARRY_START; i < slots_ref.current.length; i++) {
      if (!slots_ref.current[i]) {
        empty_idx = i
        break
      }
    }
    
    if (empty_idx === -1) {
      if (add_log) {
        add_log('No empty inventory slots to split stack!', 'error')
      }
      return
    }
    
    // Reduce the source stack
    set_item_in_slot(slot_index_or_id, { ...item, quantity: remaining_qty })
    
    // Create new stack in empty slot
    const next = [...slots_ref.current]
    next[empty_idx] = {
      ...item,
      quantity: split_qty,
      id: `${item.base_item_id}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
    slots_ref.current = next
    set_current_slots([...next])
    
    if (add_log) {
      add_log(`Split ${item.name} into stacks of ${remaining_qty} and ${split_qty}.`, 'system')
    }
    
    // Save inventory immediately when stack is split (user-initiated action)
    schedule_save({ inventory: true }, { immediate: true })
  }, [get_item_from_slot, set_item_in_slot, schedule_save, add_log, slots_ref])
  
  // Sync current_slots when initial_slots loads (only once when data first arrives)
  const has_synced_ref = useRef(false)
  useEffect(() => {
    if (!has_synced_ref.current && initial_slots && initial_slots.length > 0 && initial_slots.some(s => s !== null)) {
      has_synced_ref.current = true
      set_current_slots([...slots_ref.current])
    }
  }, [initial_slots?.length])
  
  const add_item = useCallback((item, qty = 1, options = {}) => {
    const { save_immediate = false } = options
    const updated_slots = add_item_to_inventory(
      slots_ref.current,
      item,
      qty,
      {
        add_log: add_log || (() => {}),
        schedule_save: schedule_save,
        save_immediate: save_immediate
      }
    )
    slots_ref.current = updated_slots
    set_current_slots([...updated_slots])
    return updated_slots
  }, [slots_ref, schedule_save, add_log])

  // Destroy item in a slot (equipment, inventory, or bag) and save immediately
  const destroy_item = useCallback((slot_index_or_id) => {
    if (slot_index_or_id === null || slot_index_or_id === undefined) return
    // Reuse setter to null out the slot
    const next = set_item_in_slot(slot_index_or_id, null)
    slots_ref.current = next
    set_current_slots([...next])
    // Unselect the slot if it was selected
    if (selected_slot === slot_index_or_id) {
      set_selected_slot(null)
    }
    if (add_log) add_log('Item destroyed.', 'system')
    schedule_save({ inventory: true }, { immediate: true })
    return next
  }, [set_item_in_slot, slots_ref, set_current_slots, schedule_save, add_log, selected_slot, set_selected_slot])
  
  // Remove item from inventory (for selling, banking, etc.)
  const remove_item_from_inventory = useCallback((item_entry) => {
    if (!item_entry) return
    
    const next = [...slots_ref.current]
    const slot_index = item_entry.slot_index
    const container_index = item_entry.container_index
    
    if (container_index === null || container_index === undefined) {
      // Main inventory slot
      if (slot_index >= 0 && slot_index < next.length) {
        next[slot_index] = null
      }
    } else {
      // Bag slot
      if (slot_index >= 0 && slot_index < next.length) {
        const bag_item = next[slot_index]
        if (bag_item && bag_item.contents && Array.isArray(bag_item.contents)) {
          const new_contents = [...bag_item.contents]
          if (container_index >= 0 && container_index < new_contents.length) {
            new_contents[container_index] = null
            next[slot_index] = { ...bag_item, contents: new_contents }
          }
        }
      }
    }
    
    slots_ref.current = next
    set_current_slots([...next])
    // Save inventory immediately when item is removed (user-initiated action)
    schedule_save({ inventory: true }, { immediate: true })
  }, [slots_ref, schedule_save])
  
  // Alias for split_item (for compatibility with components)
  const handle_right_click_stack = split_item
  
  return {
    selected_slot,
    handle_slot_click,
    split_item,
    handle_right_click_stack,
    add_item,
    get_item_from_slot,
    destroy_item,
    remove_item_from_inventory,
    current_slots
  }
}

