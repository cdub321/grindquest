import { useRef, useCallback } from 'react';
import { silver_to_currency } from '../utils/currencyUtils';
import { fetch_loot_table, fetch_loot_table_entries, fetch_lootdrop_entries, fetch_item } from '../services/referenceData';
import { create_item_instance } from '../utils/itemInstance';

/**
 * Hook to handle mob death - awards XP, currency, and clears mob
 * 
 * @param {Object} params
 * @param {Object|null} params.current_mob - Current mob from useZone (or null)
 * @param {Object} params.current_mob_ref - Shared ref for current mob (from GameScreen, synced with state)
 * @param {Function} params.add_combat_log - Function to add combat log messages
 * @param {Function} params.add_xp - Function to add XP (from useCharacter)
 * @param {Function} params.add_currency - Function to add currency (from useCharacter)
 * @param {Function} params.add_item_to_inventory - Function to add items to inventory
 * @param {Function} params.set_mob_hp - Function to set mob HP (from parent state)
 * @param {Function} params.set_mob_mana - Function to set mob mana (from parent state)
 * @param {Function} params.set_mob_endurance - Function to set mob endurance (from parent state)
 * @param {Function} params.set_current_mob_in_zone - Function to set current mob in useZone
 * @param {boolean} params.is_auto_attack - Auto-attack state
 * @param {Function} params.set_in_combat - Function to set combat state
 * @param {Function} params.schedule_save - Save function from useCharacter
 * @param {number} params.player_level - Current player level (for level-based XP)
 * @param {number} params.character_xp_mod - Character XP modifier (race/class/deity combined)
 * @param {number} params.zone_xp_mod - Zone XP modifier
 * @param {number} params.camp_xp_mod - Camp XP modifier
 * @param {number} params.xp_bonus - Flat XP bonus from CHA stat
 * @returns {Function} handle_mob_death function
 */
export function use_mob_death({
  current_mob = null,
  current_mob_ref = null,
  add_combat_log,
  add_xp,
  add_currency,
  add_item_to_inventory = null,
  set_mob_hp,
  set_mob_mana,
  set_mob_endurance,
  set_current_mob_in_zone = null,
  is_auto_attack = false,
  set_in_combat,
  schedule_save,
  player_level,
  character_xp_mod,
  zone_xp_mod,
  camp_xp_mod,
  xp_bonus
}) {
  const is_mob_dead_ref = useRef(false);

  /**
   * Handle mob death - award XP, loot, currency
   */
  const handle_mob_death = useCallback(async () => {
    if (is_mob_dead_ref.current) return;
    is_mob_dead_ref.current = true;
    
    const mob = current_mob_ref.current || current_mob;
    if (!mob) return;
    
    add_combat_log(`${mob.name} has been slain!`, 'kill');
    
    // Award XP with all modifiers applied
    const base_xp = mob.xp || 0;
    if (base_xp > 0 && add_xp) {
      // Apply XP modifiers:
      // - Level difference modifier (+/-5% XP per level, no caps/floors)
      // - Character XP mod (race/class/deity combined, stored as 100 = 1.0)
      // - Zone XP mod (stored as 100 = 1.0)
      // - Camp XP mod (stored as 100 = 1.0)
      // - XP bonus (flat bonus from CHA/10)
      const level_diff = (mob.level || 0) - (player_level || 0);
      const level_mod = 1 + (level_diff * 0.05); // +/-5% per level difference
      const character_mod = (character_xp_mod ?? 100) / 100;
      const zone_mod = (zone_xp_mod ?? 100) / 100;
      const camp_mod = (camp_xp_mod ?? 100) / 100;
      const modified_xp = base_xp * level_mod * character_mod * zone_mod * camp_mod;
      const final_xp = Math.floor(modified_xp + xp_bonus);
      
      if (final_xp > 0) {
        add_xp(final_xp);
        add_combat_log(`You gain ${final_xp} experience!`, 'xp');
      }
    }
    
    // Award currency from loot table avgcoin
    const loot_table_id = mob.loot_table_id;
    if (loot_table_id && add_currency) {
      try {
        const loot_table = await fetch_loot_table(loot_table_id);
        const avg_coin = loot_table.avgcoin;
        
        if (avg_coin && avg_coin > 0) {
          // avgcoin is already in silver
          const currency_delta = silver_to_currency(avg_coin);
          const { platinum = 0, gold = 0, silver = 0 } = currency_delta;
          
          if (platinum > 0 || gold > 0 || silver > 0) {
            add_currency(currency_delta);
            
            const parts = [];
            if (platinum > 0) parts.push(`${platinum} platinum`);
            if (gold > 0) parts.push(`${gold} gold`);
            if (silver > 0) parts.push(`${silver} silver`);
            add_combat_log(`You receive ${parts.join(', ')}.`, 'loot');
          }
        }
      } catch (error) {
        console.error('Error fetching loot table for currency:', error);
        // Don't block mob death if loot table fetch fails
      }
    }
    
    // Roll loot from loot table
    if (loot_table_id && add_item_to_inventory) {
      try {
        // Get all loot table entries for this loot table
        const loot_table_entries = await fetch_loot_table_entries(loot_table_id);
        
        // Track dropped items for logging
        const dropped_items = [];
        
        // Process each loot table entry
        for (const entry of loot_table_entries) {
          // Roll based on probability (0-100 scale)
          // If probability is 100, it always drops. If 0, never drops.
          const roll = Math.random() * 100;
          if (roll >= entry.probability) {
            continue; // Didn't drop (roll was >= probability threshold)
          }
          
          // Get lootdrop entries for this lootdrop
          const lootdrop_entries = await fetch_lootdrop_entries(entry.lootdrop_id);
          if (!lootdrop_entries || lootdrop_entries.length === 0) {
            continue; // No items in this lootdrop
          }
          
          // Determine how many times to roll this lootdrop
          // multiplier is how many times to roll the lootdrop
          const roll_count = entry.multiplier;
          
          // Track items dropped from this lootdrop
          const lootdrop_items = [];
          
          // Roll the lootdrop multiple times
          for (let roll_idx = 0; roll_idx < roll_count; roll_idx++) {
            for (const lootdrop_entry of lootdrop_entries) {
              // Normalize chance: if stored as percent (e.g., 35), convert to 0.35
              let entry_chance = lootdrop_entry.chance || 0;
              if (entry_chance > 1) entry_chance = entry_chance / 100;
              entry_chance = Math.max(0, Math.min(1, entry_chance));

              const item_roll = Math.random();
              if (item_roll <= entry_chance) {
                // Item dropped! Track it
                lootdrop_items.push({
                  item_id: lootdrop_entry.item_id,
                  quantity: lootdrop_entry.multiplier,
                  name: lootdrop_entry.name
                });
              }
            }
          }
          
          // Apply mindrop: ensure at least mindrop items drop (random picks to avoid order bias)
          const droplimit = entry.droplimit && entry.droplimit > 0 ? entry.droplimit : 1; // default to 1 to prevent full-table floods
          const mindrop = Math.min(entry.mindrop || 0, droplimit);
          if (mindrop && mindrop > 0 && lootdrop_entries.length > 0 && lootdrop_items.length < mindrop) {
            const needed = mindrop - lootdrop_items.length;
            for (let i = 0; i < needed; i++) {
              const rand_idx = Math.floor(Math.random() * lootdrop_entries.length);
              const entry_to_add = lootdrop_entries[rand_idx];
              lootdrop_items.push({
                item_id: entry_to_add.item_id,
                quantity: entry_to_add.multiplier,
                name: entry_to_add.name
              });
            }
          }
          
          // Shuffle to avoid front-loading early entries
          for (let i = lootdrop_items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lootdrop_items[i], lootdrop_items[j]] = [lootdrop_items[j], lootdrop_items[i]];
          }
          
          // Apply droplimit: treat 0/negative as unlimited
          const final_items = lootdrop_items.slice(0, droplimit);
          
          // Add all items to inventory
          for (const item_drop of final_items) {
            try {
              const item_data = await fetch_item(item_drop.item_id);
              const item_instance = create_item_instance(item_drop.item_id, item_data);
              
              // Add to inventory
              add_item_to_inventory(item_instance, item_drop.quantity);
              
              // Track for logging
              const name_with_qty = item_drop.quantity > 1 ? `${item_data.name} x${item_drop.quantity}` : item_data.name;
              dropped_items.push({ name: item_data.name, quantity: item_drop.quantity });
            } catch (item_error) {
              console.error(`Error fetching item ${item_drop.item_id} for loot:`, item_error);
              // Continue with other items
            }
          }
        }
        
        // Log dropped items
        if (dropped_items.length > 0) {
          const item_messages = dropped_items.map(item => 
            item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name
          );
          add_combat_log(`You receive: ${item_messages.join(', ')}.`, 'loot');
        }
      } catch (error) {
        console.error('Error rolling loot from loot table:', error);
        // Don't block mob death if loot rolling fails
      }
    }
    
    // Clear mob
    set_mob_hp(0);
    set_mob_mana(0);
    set_mob_endurance(0);
    if (set_current_mob_in_zone) {
      set_current_mob_in_zone(null);
    }
    
    // Exit combat if not auto-attacking
    if (!is_auto_attack) {
      set_in_combat(false);
    }
    
    // Save combat state and inventory immediately (loot must be saved right away)
    schedule_save({
      character: {
        current_mob: null,
        in_combat: is_auto_attack // Stay in combat if auto-attacking
      },
      inventory: true
    }, { immediate: true });
  }, [
    current_mob,
    current_mob_ref,
    add_combat_log,
    add_currency,
    add_xp,
    add_item_to_inventory,
    set_mob_hp,
    set_mob_mana,
    set_mob_endurance,
    set_current_mob_in_zone,
    is_auto_attack,
    set_in_combat,
    schedule_save,
    character_xp_mod,
    zone_xp_mod,
    camp_xp_mod,
    xp_bonus
  ]);

  return {
    handle_mob_death,
    reset_mob_death_flag: () => {
      is_mob_dead_ref.current = false;
    }
  };
}
