/**
 * Zone and camp utility functions
 * 
 * These utilities expect normalized data (snake_case from database).
 * No fallback patterns - data should be normalized before reaching these functions.
 */

/**
 * Calculate travel distance to camp
 * Distance is the leftover zone area divided by number of camps
 * @param {string} zone_id - Zone ID
 * @param {Array} camps - Array of camp objects in the zone (snake_case fields)
 * @param {number} zone_area - Total area of the zone
 * @returns {number} - Travel distance in units
 */
export function get_camp_distance(zone_id, camps, zone_area) {
  if (!camps || camps.length === 0) return 0
  
  // Sum all camp areas (expect snake_case: camp_area)
  const total_camp_area = camps.reduce(
    (sum, camp) => sum + Number(camp.camp_area || 0),
    0
  )
  
  // Leftover area divided by number of camps
  const leftover = Math.max(0, Number(zone_area || 0) - total_camp_area)
  return Math.round(leftover / camps.length)
}

/**
 * Get zone connections for a specific camp
 * @param {Object} camp - Camp object (snake_case fields)
 * @param {Array} all_zone_connections - All zone connections for the camp's zone (from zone_connections table)
 * @returns {Array} - Array of zone connection objects {from_zone, to_zone} that this camp can access
 */
export function get_camp_zone_connections(camp, all_zone_connections = []) {
  if (!camp) return []
  
  const content_flags = (camp.content_flags || '').toLowerCase()
  const is_zone_line_camp = content_flags.includes('zoneline')
  
  // Only zoneline camps have zone connections
  if (!is_zone_line_camp) return []
  
  // If camp has target_zone_id, return only that specific connection
  if (camp.target_zone_id) {
    const specific_connection = all_zone_connections.find(
      conn => conn.to_zone === camp.target_zone_id
    )
    return specific_connection ? [specific_connection] : []
  }
  
  // No target_zone_id means no connections (strict, no fallbacks)
  return []
}

/**
 * Calculate hub nodes for camp visualization
 * Creates nodes for connected camps and zone lines
 * @param {Array} camps - All camps in current zone (snake_case fields)
 * @param {Object} current_camp - Currently selected camp (snake_case fields)
 * @param {Array} all_zone_connections - All zone connections for current zone (from zone_connections table)
 * @param {Object} zones_map - Map of zone_id -> zone object for looking up zone names
 * @returns {Array} - Array of node objects with position and metadata
 */
export function calculate_hub_nodes(camps, current_camp, all_zone_connections = [], zones_map = {}) {
  if (!camps || camps.length === 0) return []
  
  const raw_connections = (current_camp?.connected || []).map(id => Number(id))
  
  // Determine which camps to show
  const other_camps = !current_camp
    ? camps
    : raw_connections.length === 0
    ? camps.filter((c) => Number(c.id) !== Number(current_camp.id))
    : camps.filter(
        (c) => Number(c.id) !== Number(current_camp.id) && raw_connections.includes(Number(c.id))
      )
  
  // Get zone connections for current camp
  const camp_zone_connections = get_camp_zone_connections(current_camp, all_zone_connections)
  
  // Zone line nodes (if current camp is a zone line camp and has connections)
  const zone_line_nodes = camp_zone_connections.map((conn) => {
    const zone = zones_map[conn.to_zone] || {}
    return {
      id: `zone-${conn.to_zone}`,
      label: zone.name || conn.to_zone,
      type: 'zone',
      zone_id: conn.to_zone
    }
  })
  
  const spoke_count = other_camps.length + zone_line_nodes.length
  const radius = 110
  const nodes = []
  let idx = 0
  
  // Add camp nodes
  other_camps.forEach((camp) => {
    const angle = (2 * Math.PI * idx) / Math.max(1, spoke_count)
    nodes.push({
      id: `camp-${camp.id}`,
      label: camp.name || camp.id,
      type: 'camp',
      camp_id: camp.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      data: camp
    })
    idx += 1
  })
  
  // Add zone line nodes
  zone_line_nodes.forEach((node) => {
    const angle = (2 * Math.PI * idx) / Math.max(1, spoke_count)
    nodes.push({
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    })
    idx += 1
  })
  
  return nodes
}

/**
 * Get zone background image URL with fallbacks
 * Tries zoneId, zoneId1, zoneId2, etc., then falls back to stock variants
 * @param {string} zone_id - Zone ID
 * @returns {string} - Background image URL (first candidate)
 */
export function get_zone_background_url(zone_id) {
  const zone = zone_id || 'stock'
  const zone_candidates = [zone, `${zone}1`, `${zone}2`, `${zone}3`, `${zone}4`]
  
  // Return first candidate (actual loading/fallback logic should be in component/hook)
  // This just returns the pattern to try
  return `/stone-ui/zonepanelbacks/${zone_candidates[0]}.png`
}

/**
 * Get all zone background candidates to try (for image loading with fallbacks)
 * @param {string} zone_id - Zone ID
 * @returns {Array} - Array of candidate URLs to try in order
 */
export function get_zone_background_candidates(zone_id) {
  const zone = zone_id || 'stock'
  const zone_candidates = [zone, `${zone}1`, `${zone}2`, `${zone}3`, `${zone}4`]
  const stock_candidates = ['stock', 'stock1', 'stock2', 'stock3', 'stock4']
  
  return [...zone_candidates, ...stock_candidates].map(
    candidate => `/stone-ui/zonepanelbacks/${candidate}.png`
  )
}
