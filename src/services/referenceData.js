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
