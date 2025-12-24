import { useEffect } from 'react';

/**
 * Handles level gains, applies class stat growth, persists new stats/level/xp.
 * Does not allow de-leveling; only processes upward XP thresholds.
 */
export function useLeveling({
  xp,
  level,
  XP_BASE,
  playerClass,
  baseStats,
  currency,
  addLog,
  setXp,
  setLevel,
  setBaseStats,
  baseVitals,
  setBaseVitals,
  characterXpMod = 1,
  scheduleSave,
  isProfileHydrated
}) {
  useEffect(() => {
    if (!isProfileHydrated) return;
    const { copper = 0, silver = 0, gold = 0, platinum = 0 } = currency || {};

    let nextXp = xp;
    let nextLevel = level;
    let levelUps = 0;

    while (nextXp >= XP_BASE * nextLevel) {
      nextXp -= XP_BASE * nextLevel;
      nextLevel += 1;
      levelUps += 1;
      addLog(`You have gained a level! You are now level ${nextLevel}!`, 'levelup');
    }

    if (levelUps === 0) return;

    const growth = playerClass?.statGrowth || {};
    const deltaStats = {
      str: (growth.str || 0) * levelUps,
      sta: (growth.sta || 0) * levelUps,
      agi: (growth.agi || 0) * levelUps,
      dex: (growth.dex || 0) * levelUps,
      int: (growth.int || 0) * levelUps,
      wis: (growth.wis || 0) * levelUps,
      cha: (growth.cha || 0) * levelUps
    };

    let updatedBaseStats = null;
    setBaseStats((prev) => {
      const next = {
        ...prev,
        str: prev.str + deltaStats.str,
        sta: prev.sta + deltaStats.sta,
        agi: prev.agi + deltaStats.agi,
        dex: prev.dex + deltaStats.dex,
        int: prev.int + deltaStats.int,
        wis: prev.wis + deltaStats.wis,
        cha: prev.cha + deltaStats.cha
      };
      updatedBaseStats = next;
      return next;
    });

    const vitalsDelta = {
      hp: (playerClass?.hpPerLevel || 0) * levelUps,
      mana: (playerClass?.manaPerLevel || 0) * levelUps,
      endurance: (playerClass?.endurancePerLevel || 0) * levelUps
    };

    let updatedBaseVitals = null;
    setBaseVitals((prev) => {
      const next = {
        hp: (prev?.hp || 0) + vitalsDelta.hp,
        mana: (prev?.mana || 0) + vitalsDelta.mana,
        endurance: (prev?.endurance || 0) + vitalsDelta.endurance
      };
      updatedBaseVitals = next;
      return next;
    });

    setLevel(nextLevel);
    setXp(nextXp);

    scheduleSave(
      {
        character: {
          level: nextLevel,
          xp: nextXp,
          str_base: updatedBaseStats?.str ?? baseStats.str,
          sta_base: updatedBaseStats?.sta ?? baseStats.sta,
          agi_base: updatedBaseStats?.agi ?? baseStats.agi,
          dex_base: updatedBaseStats?.dex ?? baseStats.dex,
          int_base: updatedBaseStats?.int ?? baseStats.int,
          wis_base: updatedBaseStats?.wis ?? baseStats.wis,
          cha_base: updatedBaseStats?.cha ?? baseStats.cha,
          base_hp: updatedBaseVitals?.hp ?? baseVitals?.hp ?? 0,
          base_mana: updatedBaseVitals?.mana ?? baseVitals?.mana ?? 0,
          base_endurance: updatedBaseVitals?.endurance ?? baseVitals?.endurance ?? 0,
          currency: { copper, silver, gold, platinum }
        },
        inventory: true
      },
      { immediate: true }
    );
  }, [
    xp,
    level,
    XP_BASE,
    playerClass?.statGrowth,
    playerClass?.hpPerLevel,
    playerClass?.manaPerLevel,
    playerClass?.endurancePerLevel,
    baseStats.agi,
    baseStats.cha,
    baseStats.dex,
    baseStats.int,
    baseStats.sta,
    baseStats.str,
    baseStats.wis,
    characterXpMod,
    baseVitals?.hp,
    baseVitals?.mana,
    baseVitals?.endurance,
    currency?.copper,
    currency?.silver,
    currency?.gold,
    currency?.platinum,
    addLog,
    setBaseStats,
    setBaseVitals,
    setLevel,
    setXp,
    scheduleSave,
    isProfileHydrated
  ]);
}
