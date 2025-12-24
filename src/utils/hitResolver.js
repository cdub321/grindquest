/**
 * Apply a hit to a target with mitigation, resist, rune absorption, and damage shield reflection.
 * Returns new HP, final damage dealt, damage shield reflected, and resist status.
 */
export function applyHit({
  rawDamage,
  isSpell = false,
  school = 'magic',
  mitigation = 0,
  currentHp,
  damageShield = 0,
  consumeRune,
  mitigateSpellDamage,
  onDeath
}) {
  if (!Number.isFinite(rawDamage)) {
    throw new Error('applyHit requires finite rawDamage');
  }
  if (!Number.isFinite(currentHp)) {
    throw new Error('applyHit requires currentHp');
  }
  if (typeof consumeRune !== 'function' || typeof mitigateSpellDamage !== 'function') {
    throw new Error('applyHit requires consumeRune and mitigateSpellDamage functions');
  }

  let mitigated = isSpell ? mitigateSpellDamage(rawDamage, school).final : Math.max(1, rawDamage - mitigation);

  if (!Number.isFinite(mitigated)) {
    throw new Error('applyHit produced non-finite mitigated damage');
  }

  if (isSpell && mitigated <= 0) {
    return {
      resisted: true,
      finalDamage: 0,
      newHp: currentHp,
      damageShieldReflected: 0
    };
  }

  const absorbed = consumeRune(mitigated);
  const finalDamage = Math.max(0, mitigated - absorbed);
  const newHp = Math.max(0, currentHp - finalDamage);

  if (newHp === 0 && typeof onDeath === 'function') {
    onDeath();
  }

  return {
    resisted: false,
    finalDamage,
    newHp,
    damageShieldReflected: !isSpell ? Math.max(0, damageShield) : 0
  };
}
