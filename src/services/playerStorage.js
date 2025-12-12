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
    .select('id, name, class, level, xp, zone_id, currency, created_at, mode')
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
      class: payload.class,
      level: 1,
      xp: 0,
      zone_id: payload.zone_id,
      currency: payload.currency,
      mode: payload.mode || 'normal'
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
    .from('inventory_items')
    .select('*')
    .eq('character_id', characterId);
  if (invErr) throw invErr;

  const { data: equipRows, error: eqErr } = await supabase
    .from('equipment_slots')
    .select('*')
    .eq('character_id', characterId);
  if (eqErr) throw eqErr;

  const inventory = (inventoryRows || []).map((row) => ({
    id: row.id,
    name: row.item_name,
    slot: row.item_data?.slot,
    bonuses: row.item_data?.bonuses || {},
    quantity: row.quantity || 1
  }));

  const equipment = {};
  (equipRows || []).forEach((row) => {
    equipment[row.slot] = {
      id: row.id,
      name: row.item_name,
      slot: row.slot,
      bonuses: row.item_data?.bonuses || {},
      quantity: 1
    };
  });

  return { character, inventory, equipment };
}

export async function saveCharacter(characterId, patch) {
  const { error } = await supabase
    .from('characters')
    .update(patch)
    .eq('id', characterId);
  if (error) throw error;
}

export async function saveInventory(characterId, inventory) {
  const { error: delErr } = await supabase
    .from('inventory_items')
    .delete()
    .eq('character_id', characterId);
  if (delErr) throw delErr;

  if (!inventory.length) return;

  const payload = inventory.map((item) => ({
    character_id: characterId,
    item_name: item.name,
    item_data: { slot: item.slot, bonuses: item.bonuses },
    quantity: item.quantity || 1
  }));

  const { error: insErr } = await supabase
    .from('inventory_items')
    .insert(payload);
  if (insErr) throw insErr;
}

export async function saveEquipment(characterId, equipment) {
  const { error: delErr } = await supabase
    .from('equipment_slots')
    .delete()
    .eq('character_id', characterId);
  if (delErr) throw delErr;

  const rows = Object.entries(equipment)
    .filter(([, item]) => item)
    .map(([slot, item]) => ({
      character_id: characterId,
      slot,
      item_name: item.name,
      item_data: { slot: item.slot, bonuses: item.bonuses }
    }));

  if (!rows.length) return;

  const { error: insErr } = await supabase
    .from('equipment_slots')
    .insert(rows);
  if (insErr) throw insErr;
}
