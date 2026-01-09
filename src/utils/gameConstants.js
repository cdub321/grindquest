/**
 * Game-wide constants
 */

/**
 * Universal tick interval for game mechanics (4 seconds)
 * Used for effect ticks, mob movement, regeneration, etc.
 */
export const UNIVERSAL_TICK_INTERVAL_MS = 4000;

/**
 * Tick worker interval (1 second)
 * Background worker posts timestamps every second to avoid tab throttling
 * Used for precision timing checks (different from UNIVERSAL_TICK_INTERVAL_MS)
 */
export const TICK_WORKER_INTERVAL_MS = 1000;

/**
 * XP base value for level calculations
 * XP needed for level N = XP_BASE * N
 */
export const XP_BASE = 200;

/**
 * Combat timeout (milliseconds)
 * Time of inactivity before automatically exiting combat
 */
export const COMBAT_TIMEOUT_MS = 6000;

/**
 * Combat log maximum messages
 * Maximum number of messages to keep in combat log
 */
export const MAX_COMBAT_LOG_MESSAGES = 200;

/**
 * Critical hit constants
 */
export const CRIT_CONSTANTS = {
  BASE_CRIT_CHANCE: 0.05,      // 5% base crit chance
  MOB_CRIT_CHANCE: 0.05,       // 5% base crit for mobs
  CRIT_DAMAGE_MULTIPLIER: 2.0  // 2x damage on crit
};

/**
 * Currency conversion constants
 * Used for converting between currency denominations
 */
export const CURRENCY_CONVERSION = {
  SILVER_PER_GOLD: 10,
  GOLD_PER_PLATINUM: 10
};
