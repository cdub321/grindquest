import { supabase } from '../lib/supabaseClient'

/**
 * Reference data service - handles queries for game reference data
 * All functions use snake_case naming and return snake_case field names matching schema
 * 
 * Module-level caches to prevent duplicate fetches across components
 */
const item_cache = {};
const class_cache = {};
const race_cache = {};
const deity_cache = {};
const zone_cache = {};
const camp_cache = {};
const mob_template_cache = {};
const spell_cache = {};
const camps_by_zone_cache = {};
const camp_members_cache = {};
const loot_table_cache = {};
const loot_table_entries_cache = {}; // Cache by loot_table_id
const lootdrop_entries_cache = {}; // Cache by lootdrop_id
const zone_connections_cache = {}; // Cache by from_zone

// Catalog caches (for "fetch all" functions)
let classes_catalog_cache = null; // Will be set when fetched
let races_catalog_cache = null;
let deities_catalog_cache = null;
let zones_catalog_cache = null;

/**
 * Get item from cache synchronously (returns null if not cached)
 * @param {number} item_id - Item ID
 * @returns {object|null} Cached item object or null
 */
export function get_item_from_cache(item_id) {
  return item_cache[item_id] ?? null
}

/**
 * Fetch an item by ID (cached)
 * @param {number} item_id - Item ID
 * @returns {Promise<object>} Item object with snake_case fields
 */
export async function fetch_item(item_id) {
  // Check cache first
  if (item_cache[item_id]) {
    return item_cache[item_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', item_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    item_cache[item_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_item:', error)
    throw error
  }
}

/**
 * Fetch a class by ID (uses c_id field, cached)
 * @param {number} class_id - Class ID (c_id)
 * @returns {Promise<object>} Class object with snake_case fields
 */
export async function fetch_class(class_id) {
  // Check cache first
  if (class_cache[class_id]) {
    return class_cache[class_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('c_id', class_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    class_cache[class_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_class:', error)
    throw error
  }
}

/**
 * Fetch all classes (cached)
 * @returns {Promise<Array>} Array of class objects with snake_case fields
 */
export async function fetch_classes_catalog() {
  // Check cache first
  if (classes_catalog_cache !== null) {
    return classes_catalog_cache
  }
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!data) throw new Error('No data returned from classes query')
    
    // Cache the result (note: using let to allow reassignment)
    classes_catalog_cache = data
    return data
  } catch (error) {
    console.error('Error in fetch_classes_catalog:', error)
    throw error
  }
}

/**
 * Fetch a race by ID (uses r_id field, cached)
 * @param {number} race_id - Race ID (r_id)
 * @returns {Promise<object>} Race object with snake_case fields
 */
export async function fetch_race(race_id) {
  // Check cache first
  if (race_cache[race_id]) {
    return race_cache[race_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .eq('r_id', race_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    race_cache[race_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_race:', error)
    throw error
  }
}

/**
 * Fetch all races (cached)
 * @returns {Promise<Array>} Array of race objects with snake_case fields
 */
export async function fetch_races() {
  // Check cache first
  if (races_catalog_cache !== null) {
    return races_catalog_cache
  }
  
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!data) throw new Error('No data returned from races query')
    
    // Cache the result
    races_catalog_cache = data
    return data
  } catch (error) {
    console.error('Error in fetch_races:', error)
    throw error
  }
}

/**
 * Fetch a deity by ID (uses d_id field, cached)
 * @param {number} deity_id - Deity ID (d_id)
 * @returns {Promise<object>} Deity object with snake_case fields
 */
export async function fetch_deity(deity_id) {
  // Check cache first
  if (deity_cache[deity_id]) {
    return deity_cache[deity_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('deities')
      .select('*')
      .eq('d_id', deity_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    deity_cache[deity_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_deity:', error)
    throw error
  }
}

/**
 * Fetch all deities (cached)
 * @returns {Promise<Array>} Array of deity objects with snake_case fields
 */
export async function fetch_deities() {
  // Check cache first
  if (deities_catalog_cache !== null) {
    return deities_catalog_cache
  }
  
  try {
    const { data, error } = await supabase
      .from('deities')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!data) throw new Error('No data returned from deities query')
    
    // Cache the result
    deities_catalog_cache = data
    return data
  } catch (error) {
    console.error('Error in fetch_deities:', error)
    throw error
  }
}

/**
 * Fetch all race/class allowed combinations
 * @returns {Promise<Array>} Array of objects with r_id and c_id fields
 */
export async function fetch_race_class_allowed() {
  try {
    const { data, error } = await supabase
      .from('race_class_allowed')
      .select('*')
    
    if (error) throw error
    if (!data) throw new Error('No data returned from race_class_allowed query')
    return data
  } catch (error) {
    console.error('Error in fetch_race_class_allowed:', error)
    throw error
  }
}

/**
 * Fetch all deity/class allowed combinations
 * @returns {Promise<Array>} Array of objects with d_id and c_id fields
 */
export async function fetch_deity_class_allowed() {
  try {
    const { data, error } = await supabase
      .from('deity_class_allowed')
      .select('*')
    
    if (error) throw error
    if (!data) throw new Error('No data returned from race_class_allowed query')
    return data
  } catch (error) {
    console.error('Error in fetch_deity_class_allowed:', error)
    throw error
  }
}

/**
 * Fetch all race/deity allowed combinations
 * @returns {Promise<Array>} Array of objects with r_id and d_id fields
 */
export async function fetch_race_deity_allowed() {
  try {
    const { data, error } = await supabase
      .from('race_deity_allowed')
      .select('*')
    
    if (error) throw error
    if (!data) throw new Error('No data returned from race_class_allowed query')
    return data
  } catch (error) {
    console.error('Error in fetch_race_deity_allowed:', error)
    throw error
  }
}

/**
 * Fetch a zone by ID (cached)
 * @param {string} zone_id - Zone ID
 * @returns {Promise<object>} Zone object with snake_case fields
 */
export async function fetch_zone(zone_id) {
  // Check cache first
  if (zone_cache[zone_id]) {
    return zone_cache[zone_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .eq('id', zone_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    zone_cache[zone_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_zone:', error)
    throw error
  }
}

/**
 * Fetch all zones (cached)
 * @returns {Promise<Array>} Array of zone objects with snake_case fields
 */
export async function fetch_zones() {
  // Check cache first
  if (zones_catalog_cache !== null) {
    return zones_catalog_cache
  }
  
  try {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!data) throw new Error('No data returned from zones query')
    
    // Cache the result
    zones_catalog_cache = data
    return data
  } catch (error) {
    console.error('Error in fetch_zones:', error)
    throw error
  }
}

/**
 * Fetch a camp by ID (cached)
 * @param {number} camp_id - Camp ID
 * @returns {Promise<object>} Camp object with snake_case fields
 */
export async function fetch_camp(camp_id) {
  // Check cache first
  if (camp_cache[camp_id]) {
    return camp_cache[camp_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('camps')
      .select('*')
      .eq('id', camp_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    camp_cache[camp_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_camp:', error)
    throw error
  }
}

/**
 * Fetch all camps in a zone (cached)
 * @param {string} zone_id - Zone ID
 * @returns {Promise<Array>} Array of camp objects with snake_case fields
 */
export async function fetch_camps_by_zone(zone_id) {
  // Check cache first
  if (camps_by_zone_cache[zone_id]) {
    return camps_by_zone_cache[zone_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('camps')
      .select('*')
      .eq('zone_id', zone_id)
      .order('name', { ascending: true })
    
    if (error) throw error
    if (!data) throw new Error(`No data returned from camps query for zone ${zone_id}`)
    
    // Cache the result
    camps_by_zone_cache[zone_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_camps_by_zone:', error)
    throw error
  }
}

/**
 * Fetch camp members (mobs that spawn in a camp, cached)
 * @param {number} camp_id - Camp ID
 * @returns {Promise<Array>} Array of camp member objects with snake_case fields
 */
export async function fetch_camp_members(camp_id) {
  // Check cache first
  if (camp_members_cache[camp_id]) {
    return camp_members_cache[camp_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('camp_members')
      .select('camp_id, mob_id, weight, camp_name')
      .eq('camp_id', camp_id)
    
    if (error) throw error
    if (!data) throw new Error(`No data returned from camp_members query for camp ${camp_id}`)
    
    // Cache the result
    camp_members_cache[camp_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_camp_members:', error)
    throw error
  }
}

/**
 * Fetch merchant stock from merchant_items table
 * @param {number|string} merchant_id - Merchant ID (merch_id in merchant_items table)
 * @returns {Promise<Array>} Array of merchant stock items with snake_case fields
 */
export async function fetch_merchant_stock(merchant_id) {
  try {
    const { data, error } = await supabase
      .from('merchant_items')
      .select('item_id, price, stock, weight, merch_id')
      .eq('merch_id', merchant_id)
    
    if (error) throw error
    if (!data) throw new Error(`No data returned from merchant_items query for merchant ${merchant_id}`)
    
    return data || []
  } catch (error) {
    console.error('Error in fetch_merchant_stock:', error)
    throw error
  }
}

/**
 * Fetch a mob template by ID (cached)
 * @param {number} mob_id - Mob template ID
 * @returns {Promise<object>} Mob template object with snake_case fields
 */
export async function fetch_mob_template(mob_id) {
  // Check cache first
  if (mob_template_cache[mob_id]) {
    return mob_template_cache[mob_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('mob_templates')
      .select('*')
      .eq('id', mob_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    mob_template_cache[mob_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_mob_template:', error)
    throw error
  }
}

/**
 * Fetch a spell/ability by ID from spells_import table (cached)
 * @param {number} spell_id - Spell ID
 * @returns {Promise<object>} Spell object with snake_case fields
 */
export async function fetch_spell(spell_id) {
  // Check cache first
  if (spell_cache[spell_id]) {
    return spell_cache[spell_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('spells_import')
      .select('*')
      .eq('id', spell_id)
      .single()
    
    if (error) throw error
    
    // Cache the result
    spell_cache[spell_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_spell:', error)
    throw error
  }
}

/**
 * Fetch spells learnable at a specific level for a class
 * @param {number} class_id - Class ID (c_id)
 * @param {number} level - Level to check
 * @returns {Promise<Array>} Array of spell objects that can be learned at this level
 */
export async function fetch_spells_learnable_at_level(class_id, level) {
  try {
    const { data, error } = await supabase
      .from('spells_import')
      .select('*')
    
    if (error) throw error
    
    // Filter spells where classes JSONB contains class_id with value matching level
    // classes format: {"5": 61, "11": 49} - class ID (string) maps to learn level
    const class_id_str = String(class_id)
    const learnable = (data || []).filter((spell) => {
      let classes = spell.classes || {}
      if (typeof classes === 'string') {
        try {
          classes = JSON.parse(classes)
        } catch {
          classes = {}
        }
      }
      const learn_level = classes[class_id_str]
      return learn_level !== undefined && Number(learn_level) === level
    })
    
    // Cache all fetched spells
    learnable.forEach((spell) => {
      spell_cache[spell.id] = spell
    })
    
    return learnable
  } catch (error) {
    console.error('Error in fetch_spells_learnable_at_level:', error)
    throw error
  }
}

/**
 * Fetch a loot table by ID (cached)
 * @param {number} loot_table_id - Loot table ID
 * @returns {Promise<object>} Loot table object with snake_case fields
 */
export async function fetch_loot_table(loot_table_id) {
  // Check cache first
  if (loot_table_cache[loot_table_id]) {
    return loot_table_cache[loot_table_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('loot_tables')
      .select('*')
      .eq('id', loot_table_id)
      .single()
    
    if (error) throw error
    if (!data) throw new Error(`No loot table found with id ${loot_table_id}`)
    
    // Cache the result
    loot_table_cache[loot_table_id] = data
    return data
  } catch (error) {
    console.error('Error in fetch_loot_table:', error)
    throw error
  }
}

/**
 * Fetch loot table entries for a loot table (cached)
 * @param {number} loot_table_id - Loot table ID
 * @returns {Promise<Array>} Array of loot_table_entries with snake_case fields
 */
export async function fetch_loot_table_entries(loot_table_id) {
  // Check cache first
  if (loot_table_entries_cache[loot_table_id]) {
    return loot_table_entries_cache[loot_table_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('loot_table_entries')
      .select('*')
      .eq('loot_table_id', loot_table_id)
    
    if (error) throw error
    
    // Cache the result (empty array is valid)
    loot_table_entries_cache[loot_table_id] = data || []
    return data || []
  } catch (error) {
    console.error('Error in fetch_loot_table_entries:', error)
    throw error
  }
}

/**
 * Fetch lootdrop entries for a lootdrop (cached)
 * @param {number} lootdrop_id - Lootdrop ID
 * @returns {Promise<Array>} Array of lootdrop_entries with snake_case fields
 */
export async function fetch_lootdrop_entries(lootdrop_id) {
  // Check cache first
  if (lootdrop_entries_cache[lootdrop_id]) {
    return lootdrop_entries_cache[lootdrop_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('lootdrop_entries')
      .select('*')
      .eq('lootdrop_id', lootdrop_id)
    
    if (error) throw error
    
    // Cache the result (empty array is valid)
    lootdrop_entries_cache[lootdrop_id] = data || []
    return data || []
  } catch (error) {
    console.error('Error in fetch_lootdrop_entries:', error)
    throw error
  }
}

/**
 * Fetch zone connections for a zone (cached)
 * @param {string} from_zone_id - Zone ID to get connections from
 * @returns {Promise<Array>} Array of zone connection objects with from_zone and to_zone
 */
export async function fetch_zone_connections(from_zone_id) {
  // Check cache first (check if key exists, not just truthy value, since empty array is truthy)
  if (from_zone_id in zone_connections_cache) {
    return zone_connections_cache[from_zone_id]
  }
  
  try {
    const { data, error } = await supabase
      .from('zone_connections')
      .select('from_zone, to_zone')
      .eq('from_zone', from_zone_id)
    
    if (error) {
      console.error('Failed to fetch zone connections:', error)
      throw error
    }
    
    // Cache the result (empty array is valid)
    zone_connections_cache[from_zone_id] = data || []
    return data || []
  } catch (error) {
    console.error('Error fetching zone connections:', error)
    // Don't throw, return empty array instead to prevent breaking the app
    zone_connections_cache[from_zone_id] = []
    return []
  }
}


