/**
 * Pure combat rule helpers. No defaults; callers must supply required inputs.
 */

export const FLEE_BASE_ENGAGED = 0.65;
export const FLEE_MIN = 0.2;
export const FLEE_MAX = 0.95;
export const FLEE_SPEED_DELTA_SCALE = 0.1;
export const FLEE_SPEED_DELTA_CLAMP = 0.3;

export const DODGE_AGI_SCALE = 0.002;
export const DODGE_MAX = 0.3;

export function computeFleeSuccessChance({
  engaged,
  playerSpeed,
  mobSpeed
}) {
  if (!Number.isFinite(playerSpeed) || !Number.isFinite(mobSpeed)) {
    throw new Error('computeFleeSuccessChance requires numeric playerSpeed and mobSpeed.');
  }
  let successChance = engaged ? FLEE_BASE_ENGAGED : 1;
  const speedDelta = playerSpeed - mobSpeed;
  const deltaAdj = Math.max(-FLEE_SPEED_DELTA_CLAMP, Math.min(FLEE_SPEED_DELTA_CLAMP, speedDelta * FLEE_SPEED_DELTA_SCALE));
  successChance += deltaAdj;
  return Math.min(FLEE_MAX, Math.max(FLEE_MIN, successChance));
}

export function computeDodgeChance(agi) {
  if (!Number.isFinite(agi)) {
    throw new Error('computeDodgeChance requires numeric agility.');
  }
  return Math.min(DODGE_MAX, agi * DODGE_AGI_SCALE);
}
