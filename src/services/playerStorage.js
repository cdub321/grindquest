import { supabase } from '../lib/supabaseClient';

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function fetchCharacters(userId) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, class, class_id, race_id, deity_id, level, xp, zone_id, currency, created_at, mode, str_base, sta_base, agi_base, dex_base, int_base, wis_base, cha_base, killed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCharacter(userId, payload) {
  const { data, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      name: payload.name,
      class: payload.class || payload.class_id,
      class_id: payload.class_id || payload.class,
      race_id: payload.race_id || null,
      deity_id: payload.deity_id || null,
      level: 1,
      xp: 0,
      zone_id: payload.zone_id,
      currency: payload.currency,
      mode: payload.mode || 'normal',
      str_base: payload.str_base || 0,
      sta_base: payload.sta_base || 0,
      agi_base: payload.agi_base || 0,
      dex_base: payload.dex_base || 0,
      int_base: payload.int_base || 0,
      wis_base: payload.wis_base || 0,
      cha_base: payload.cha_base || 0
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCharacter(userId, characterId) {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', characterId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function loadCharacter(characterId) {
  const { data: character, error: charErr } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single();
  if (charErr) throw charErr;

  const { data: inventoryRows, error: invErr } = await supabase
    .from('inventory')
    .select('id, base_item_id, quantity, slot_id, item_data, container_id, created_at')
    .eq('character_id', characterId);
  if (invErr) throw invErr;

  const { data: spellRows, error: spellErr } = await supabase
    .from('character_spells')
    .select('skill_id, scribe_slot, ability_slot, spell_slot, learned_at')
    .eq('character_id', characterId);
  if (spellErr) throw spellErr;

  const inventory = (inventoryRows || []).map((row) => ({
    id: row.id,
    base_item_id: row.base_item_id,
    quantity: row.quantity || 1,
    slot_id: row.slot_id || null,
    container_id: row.container_id || null,
    item_data: row.item_data || null,
    created_at: row.created_at || null
  }));

  return { character, inventory, spells: spellRows || [] };
}

// Update equipped slots for abilities/spells. Pass arrays of
// { skill_id, ability_slot } and { skill_id, spell_slot } with 1-based slots.
export async function saveSpellSlots(characterId, { abilitySlots = [], spellSlots = [] }) {
  // Reset slots to 0 to avoid unique conflicts, then upsert the new assignments.
  const { error: clearErr } = await supabase
    .from('character_spells')
    .update({ ability_slot: 0, spell_slot: 0 })
    .eq('character_id', characterId);
  if (clearErr) throw clearErr;

  const rows = [];
  abilitySlots.forEach(({ skill_id, ability_slot }) => {
    if (!skill_id || !ability_slot) return;
    rows.push({
      character_id: characterId,
      skill_id,
      ability_slot
    });
  });
  spellSlots.forEach(({ skill_id, spell_slot }) => {
    if (!skill_id || !spell_slot) return;
    rows.push({
      character_id: characterId,
      skill_id,
      spell_slot
    });
  });

  if (!rows.length) return;

  const { error: upsertErr } = await supabase
    .from('character_spells')
    .upsert(rows, { onConflict: 'character_id,skill_id' });
  if (upsertErr) throw upsertErr;
}

export async function saveCharacter(characterId, patch) {
  const { error } = await supabase
    .from('characters')
    .update(patch)
    .eq('id', characterId);
  if (error) throw error;
}

// Public leaderboard pulls top characters by mode
export async function fetchLeaderboardCharacters(limit = 50) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, class, class_id, race_id, deity_id, level, xp, mode, killed_at')
    .order('level', { ascending: false })
    .order('xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function saveInventory(characterId, inventory) {
  const { error: delErr } = await supabase
    .from('inventory')
    .delete()
    .eq('character_id', characterId);
  if (delErr) throw delErr;

  if (!inventory.length) return;

  const payload = inventory.map((item) => ({
    character_id: characterId,
    slot_id: item.slot_id || item.slotId || null,
    base_item_id: item.baseItemId || item.base_item_id || item.id || item.name,
    quantity: item.quantity || 1,
    item_data: item.item_data || item.itemData || null,
    container_id: item.container_id || item.containerId || null
  }));

  const { error: insErr } = await supabase
    .from('inventory')
    .insert(payload);
  if (insErr) throw insErr;
}

export async function fetchUserRole(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role || null;
}
