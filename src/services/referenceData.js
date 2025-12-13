import { supabase } from '../lib/supabaseClient';

export async function fetchClassesCatalog() {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRaces() {
  const { data, error } = await supabase
    .from('races')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchDeities() {
  const { data, error } = await supabase
    .from('deities')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRaceClassAllowed() {
  const { data, error } = await supabase
    .from('race_class_allowed')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function fetchDeityClassAllowed() {
  const { data, error } = await supabase
    .from('deity_class_allowed')
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function fetchZonesAndConnections() {
  const [{ data: zones, error: zErr }, { data: connections, error: cErr }] = await Promise.all([
    supabase.from('zones').select('*'),
    supabase.from('zone_connections').select('*')
  ]);
  if (zErr) throw zErr;
  if (cErr) throw cErr;
  return { zones: zones || [], connections: connections || [] };
}

export async function fetchItemsCatalog() {
  const { data, error } = await supabase.from('items').select('*');
  if (error) throw error;
  return data || [];
}

export async function fetchSkillsCatalog() {
  const { data, error } = await supabase.from('skills').select('*');
  if (error) throw error;
  return data || [];
}

export async function fetchZoneMobs() {
  // Expects view zone_mobs_view with: zone_id, mob_id, name, hp, damage, xp, is_named, tags, ac, mr, fr, cr, pr, dr, loot_table
  const { data, error } = await supabase.from('zone_mobs_view').select('*');
  if (error) throw error;
  return data || [];
}

export async function fetchCamps() {
  const { data, error } = await supabase.from('camps').select('*');
  if (error) throw error;
  return data || [];
}
