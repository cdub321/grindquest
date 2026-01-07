/**
 * Currency conversion utilities
 *
 * Smallest unit is SILVER. 10 silver = 1 gold, 10 gold = 1 platinum.
 */

/**
 * Convert currency object to total silver
 * @param {Object} currency - { platinum, gold, silver }
 * @returns {number} total silver
 */
export function currency_to_silver(currency) {
  if (!currency) return 0
  const platinum = Number(currency.platinum || 0)
  const gold = Number(currency.gold || 0)
  const silver = Number(currency.silver || 0)
  return platinum * 100 + gold * 10 + silver
}

/**
 * Convert total silver to currency object
 * @param {number} silver_total - total silver
 * @returns {Object} currency { platinum, gold, silver }
 */
export function silver_to_currency(silver_total) {
  const total = Math.max(0, Math.floor(silver_total))
  const platinum = Math.floor(total / 100)
  const remaining = total % 100
  const gold = Math.floor(remaining / 10)
  const silver = remaining % 10
  return { platinum, gold, silver }
}

