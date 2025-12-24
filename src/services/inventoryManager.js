// Inventory management utilities

// Slot order definition
export const slotOrder = [
  'head',
  'face',
  'ear1',
  'ear2',
  'neck',
  'shoulders',
  'arms',
  'wrist1',
  'wrist2',
  'hands',
  'chest',
  'back',
  'waist',
  'legs',
  'feet',
  'finger1',
  'finger2',
  'primary',
  'secondary',
  'range',
  'ammo',
  'charm',
  'inv1',
  'inv2',
  'inv3',
  'inv4',
  'inv5',
  'inv6',
  'inv7',
  'inv8'
];

export const CARRY_START = slotOrder.indexOf('inv1');

// Slot mapping for equipment validation
const slotMapping = {
  'head': ['head'],
  'face': ['face'],
  'ear1': ['ear', 'ears'],
  'ear2': ['ear', 'ears'],
  'neck': ['neck'],
  'shoulders': ['shoulders', 'shoulder'],
  'arms': ['arms', 'arm'],
  'wrist1': ['wrist', 'wrists'],
  'wrist2': ['wrist', 'wrists'],
  'hands': ['hands', 'hand', 'gloves'],
  'chest': ['chest', 'torso', 'robe'],
  'back': ['back', 'cloak'],
  'waist': ['waist', 'belt'],
  'legs': ['legs', 'leg'],
  'feet': ['feet', 'foot', 'boots'],
  'finger1': ['finger', 'ring'],
  'finger2': ['finger', 'ring'],
  'primary': ['primary', 'weapon', '1h', '2h'],
  'secondary': ['secondary', 'shield', 'weapon', '1h'],
  'range': ['range', 'ranged'],
  'ammo': ['ammo', 'ammunition'],
  'charm': ['charm']
};

/**
 * Check if an item can be equipped in a specific slot
 * @param {Object} item - The item to check
 * @param {number} slotIndex - The slot index to check
 * @returns {boolean} - Whether the item can be equipped in this slot
 */
export const canEquipItemInSlot = (item, slotIndex) => {
  // Inventory slots (inv1-inv8) can hold anything
  if (slotIndex >= CARRY_START) {
    return true;
  }

  // Get the slot name from the slotOrder array
  const slotName = slotOrder[slotIndex];
  if (!slotName) return false;

  // Get the item's allowed slot (from database)
  const itemSlot = (item.slot || 'misc').toLowerCase().trim();

  // 'misc' and 'container' items can only go in inventory slots
  if (itemSlot === 'misc' || itemSlot === 'container') {
    return false;
  }

  // Map database slot names to equipment slot names
  // Handle special cases where one item type can go in multiple slots
  const allowedSlots = slotMapping[slotName] || [slotName];
  return allowedSlots.some(allowed => itemSlot.includes(allowed) || allowed.includes(itemSlot));
};

/**
 * Add an item to inventory with automatic stacking and bag support
 * @param {Array} slots - Current inventory slots
 * @param {Object} item - Item to add
 * @param {number} qty - Quantity to add
 * @param {Object} context - Context object with items, CARRY_START, addLog, slotsRef, scheduleSave
 * @returns {Array} - Updated slots array
 */
export const addItemToInventory = (slots, item, qty = 1, context) => {
  const { items, addLog, slotsRef, scheduleSave } = context;
  const addQty = Math.max(1, qty || 1);
  const next = [...slots];

  // Try to stack in existing slots (respecting maxStack)
  if (item.stackable) {
    let remainingQty = addQty;

    for (let i = CARRY_START; i < next.length && remainingQty > 0; i += 1) {
      const slot = next[i];
      if (slot && slot.baseItemId === item.baseItemId) {
        const currentQty = slot.quantity || 1;
        const maxStack = slot.maxStack || item.maxStack || 1;
        const canAdd = Math.min(remainingQty, maxStack - currentQty);

        if (canAdd > 0) {
          next[i] = { ...slot, quantity: currentQty + canAdd };
          remainingQty -= canAdd;
        }
      }
    }

    // If we've added everything, we're done
    if (remainingQty === 0) {
      slotsRef.current = next;
      scheduleSave({ inventory: true });
      return next;
    }

    // Otherwise, create new stacks for remaining quantity
    while (remainingQty > 0) {
      const emptyIdx = next.findIndex((s, idx) => idx >= CARRY_START && !s);
      if (emptyIdx === -1) break; // No empty slots

      const base = items[item.baseItemId];
      const bagSlots = base?.bagslots || base?.bagSlots || 0;
      const maxStack = item.maxStack || 1;
      const stackQty = Math.min(remainingQty, maxStack);

      next[emptyIdx] = {
        ...item,
        quantity: stackQty,
        bagSlots,
        contents: bagSlots ? Array(bagSlots).fill(null) : null
      };
      remainingQty -= stackQty;
    }

    if (remainingQty > 0) {
      addLog('Inventory full!', 'error');
    }

    slotsRef.current = next;
    scheduleSave({ inventory: true });
    return next;
  }

  const emptyIdx = next.findIndex((s, idx) => idx >= CARRY_START && !s);
  if (emptyIdx !== -1) {
    const base = items[item.baseItemId];
    const bagSlots = base?.bagslots || base?.bagSlots || 0;
    next[emptyIdx] = { ...item, quantity: addQty, bagSlots, contents: bagSlots ? Array(bagSlots).fill(null) : null };
    slotsRef.current = next;
    scheduleSave({ inventory: true });
    return next;
  }

  // Try bags
  if (item.stackable) {
    let remainingQty = addQty;

    // First pass: try to stack in existing bag items
    for (let i = 0; i < next.length && remainingQty > 0; i += 1) {
      const bag = next[i];
      if (!bag || !bag.bagSlots || !bag.contents) continue;

      for (let j = 0; j < bag.contents.length && remainingQty > 0; j += 1) {
        const bagItem = bag.contents[j];
        if (bagItem && bagItem.baseItemId === item.baseItemId) {
          const currentQty = bagItem.quantity || 1;
          const maxStack = bagItem.maxStack || item.maxStack || 1;
          const canAdd = Math.min(remainingQty, maxStack - currentQty);

          if (canAdd > 0) {
            const updatedBag = { ...bag, contents: [...bag.contents] };
            updatedBag.contents[j] = {
              ...bagItem,
              quantity: currentQty + canAdd
            };
            next[i] = updatedBag;
            remainingQty -= canAdd;
          }
        }
      }
    }

    // Second pass: create new stacks in empty bag slots
    for (let i = 0; i < next.length && remainingQty > 0; i += 1) {
      const bag = next[i];
      if (!bag || !bag.bagSlots || !bag.contents) continue;

      const emptyBagIdx = bag.contents.findIndex((c) => !c);
      if (emptyBagIdx !== -1) {
        const maxStack = item.maxStack || 1;
        const stackQty = Math.min(remainingQty, maxStack);

        const updatedBag = { ...bag, contents: [...bag.contents] };
        updatedBag.contents[emptyBagIdx] = { ...item, quantity: stackQty };
        next[i] = updatedBag;
        remainingQty -= stackQty;
      }
    }

    if (remainingQty > 0) {
      addLog('Inventory full!', 'error');
    }

    slotsRef.current = next;
    scheduleSave({ inventory: true });
    return next;
  }

  // Non-stackable items - find first empty bag slot
  for (let i = 0; i < next.length; i += 1) {
    const bag = next[i];
    if (!bag || !bag.bagSlots || !bag.contents) continue;

    const emptyBagIdx = bag.contents.findIndex((c) => !c);
    if (emptyBagIdx !== -1) {
      const updatedBag = { ...bag, contents: [...bag.contents] };
      updatedBag.contents[emptyBagIdx] = { ...item, quantity: addQty };
      next[i] = updatedBag;
      slotsRef.current = next;
      scheduleSave({ inventory: true });
      return next;
    }
  }

  addLog('Inventory full!', 'error');
  return slots; // Return original slots if unable to add
};
