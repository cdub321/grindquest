/**
 * NPC utility functions
 * 
 * These utilities handle camp content_flags parsing for interaction detection.
 * NOTE: Non-enemy camps (Banker, Merchant, Tradeskill stations) will ALWAYS 
 * have only ONE NPC in that camp (camp_members).
 */

/**
 * Get interaction type from camp content_flags
 * @param {string|null} content_flags - Camp content_flags string
 * @returns {string|null} - 'banker' | 'merchant' | 'tradeskill' | null
 */
export function get_interaction_type_from_content_flags(content_flags) {
  if (!content_flags) return null
  
  const flags_lower = content_flags.toLowerCase()
  
  if (flags_lower.includes('banker')) {
    return 'banker'
  }
  
  if (flags_lower.includes('merchant_')) {
    return 'merchant'
  }
  
  // Check for tradeskill stations (Blacksmithing, Pottery, etc.)
  const tradeskills = ['blacksmithing', 'pottery', 'tailoring', 'fletching', 'jewelry', 'alchemy', 'brewing', 'baking']
  for (const skill of tradeskills) {
    if (flags_lower.includes(skill)) {
      return 'tradeskill'
    }
  }
  
  return null
}

/**
 * Extract merchant ID from content_flags
 * @param {string|null} content_flags - Camp content_flags string (e.g., "merchant_123")
 * @returns {string|null} - Merchant ID or null
 */
export function extract_merchant_id(content_flags) {
  if (!content_flags) return null
  
  const flags_lower = content_flags.toLowerCase()
  const match = flags_lower.match(/merchant_(\d+)/)
  return match ? match[1] : null
}

/**
 * Get tradeskill name from content_flags
 * @param {string|null} content_flags - Camp content_flags string
 * @returns {string|null} - Tradeskill name or null
 */
export function get_tradeskill_name(content_flags) {
  if (!content_flags) return null
  
  const flags_lower = content_flags.toLowerCase()
  const tradeskills = ['blacksmithing', 'pottery', 'tailoring', 'fletching', 'jewelry', 'alchemy', 'brewing', 'baking']
  for (const skill of tradeskills) {
    if (flags_lower.includes(skill)) {
      return skill
    }
  }
  
  return null
}
