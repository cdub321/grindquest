/**
 * Audio utility functions for zone music
 */

/**
 * Get list of audio file candidates to try for a biome
 * @param {string} biome - Biome type (forest, desert, etc.)
 * @returns {Array} Array of audio file paths to try
 */
export function get_biome_audio_candidates(biome) {
  if (!biome) {
    return ['/audio/biomes/default.mp3']
  }

  const biome_lower = biome.toLowerCase()

  // Try numbered variants (biome1...biome8)
  const candidates = Array.from({ length: 8 }, (_, idx) => `/audio/biomes/${biome_lower}${idx + 1}.mp3`)

  // Fallback to default
  candidates.push('/audio/biomes/default.mp3')

  return candidates
}

/**
 * Pick a random audio file from candidates
 * @param {string} biome - Biome type
 * @returns {string} Randomly selected audio file path
 */
export function pick_random_biome_audio(biome) {
  const candidates = get_biome_audio_candidates(biome)

  // Pick random from first 4 (exclude default fallback)
  const variant_count = Math.min(4, candidates.length - 1)
  if (variant_count <= 0) {
    return candidates[candidates.length - 1] // Return default
  }

  const random_index = Math.floor(Math.random() * variant_count)
  return candidates[random_index]
}
