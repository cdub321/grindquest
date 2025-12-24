import { applyHit } from '../utils/hitResolver';

/**
 * Wraps hit resolution (resists, rune, damage shields) for player and mob.
 */
export function createDamageResolver({
  addLog,
  mitigateSpellDamagePlayer,
  mitigateSpellDamageMob,
  consumeRune,
  sumDefenses,
  getCurrentMob,
  getPlayerHp,
  setPlayerHp,
  getMobHp,
  setMobHp,
  handleDeath,
  handleMobDeath
}) {
  const applyHitToTarget = ({
    rawDamage,
    isSpell = false,
    school = 'magic',
    mitigation = 0,
    target = 'player',
    attackerName
  }) => {
    const defenses = sumDefenses(target);
    const currentHp = target === 'player' ? getPlayerHp() : getMobHp();
    const mitigateFn = target === 'player' ? mitigateSpellDamagePlayer : mitigateSpellDamageMob;

    const { resisted, finalDamage, newHp, damageShieldReflected } = applyHit({
      rawDamage,
      isSpell,
      school,
      mitigation,
      currentHp,
      damageShield: defenses.damageShield,
      consumeRune: (amt) => consumeRune(target, amt),
      mitigateSpellDamage: mitigateFn,
      onDeath: target === 'player' ? () => handleDeath(attackerName) : undefined
    });

    const targetName = target === 'player' ? 'YOU' : (getCurrentMob()?.name || 'the target');

    if (resisted) {
      addLog(
        target === 'player'
          ? `You resist ${attackerName}'s ${school} spell!`
          : `${targetName} resists your ${school} spell!`,
        'system'
      );
      return { resisted: true };
    }

    if (target === 'player') {
      setPlayerHp(newHp);
      addLog(`${attackerName} hits YOU for ${finalDamage} ${isSpell ? `${school} ` : ''}damage!`, 'mobattack');
      if (damageShieldReflected > 0) {
        setMobHp((h) => Math.max(0, h - damageShieldReflected));
        addLog(`Your damage shield hits ${attackerName} for ${damageShieldReflected}.`, 'damage');
      }
    } else {
      setMobHp(newHp);
      addLog(`You hit ${targetName} for ${finalDamage} ${isSpell ? `${school} ` : ''}damage!`, 'damage');
      if (damageShieldReflected > 0) {
        setPlayerHp((h) => Math.max(0, h - damageShieldReflected));
        addLog(`${targetName}'s damage shield hits you for ${damageShieldReflected}.`, 'damage');
        if ((getPlayerHp() - damageShieldReflected) <= 0) setTimeout(() => handleDeath(getCurrentMob()?.name || 'an enemy'), 0);
      }
    }

    if (target === 'mob' && newHp <= 0 && typeof handleMobDeath === 'function') {
      handleMobDeath();
    }

    return { resisted: false, newHp, killed: target === 'mob' && newHp <= 0 };
  };

  return { applyHitToTarget };
}
