/**
 * Handles progression events (death) outside of combat.
 * Requires all needed values to come from the database/state; no fallbacks.
 */
export function useProgression({
  bindZoneId,
  level,
  xp,
  setLevel,
  setXp,
  setCurrentZoneId,
  setHp,
  setMana,
  setEndurance,
  maxHp,
  maxMana,
  maxEndurance,
  XP_BASE,
  scheduleSave,
  currency,
  mode,
  setKilledAt,
  onReturnToCharacterSelect
}) {
  const handlePlayerDeath = (killerName = 'an enemy') => {
    // Hardcore mode: set killedAt, save, return to character select
    if (mode === 'hardcore') {
      const killedAtTimestamp = new Date().toISOString();
      setKilledAt(killedAtTimestamp);
      
      scheduleSave(
        {
          character: {
            killed_at: killedAtTimestamp
          },
          inventory: true
        },
        { immediate: true }
      );

      // Return to character select after a brief delay
      setTimeout(() => {
        if (typeof onReturnToCharacterSelect === 'function') {
          onReturnToCharacterSelect();
        }
      }, 2000);

      return { 
        shouldRespawn: false, 
        isHardcoreDead: true, 
        killedAt: killedAtTimestamp,
        killerName 
      };
    }

    // Normal mode: apply XP loss and respawn
    if (!bindZoneId) {
      throw new Error('bindZoneId missing for death handling.');
    }

    const lossPct = Math.min(1, (level || 0) / 100);
    const xpLoss = Math.ceil((XP_BASE * level) * lossPct);
    const newXp = Math.max(0, xp - xpLoss);

    setXp(newXp);
    setLevel(level);
    setHp(maxHp);
    setMana(maxMana || 0);
    setEndurance(maxEndurance || 0);
    setCurrentZoneId(bindZoneId);

    scheduleSave(
      {
        character: {
          level,
          xp: newXp,
          zone_id: bindZoneId,
          currency
        },
        inventory: true
      },
      { immediate: true }
    );

    return { shouldRespawn: true, returnZone: bindZoneId, xpLoss, killerName };
  };

  return { handlePlayerDeath };
}
