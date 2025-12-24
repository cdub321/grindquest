/**
 * Utilities for resolving resists and mitigation for player and mob.
 * Callers supply lightweight getters so values stay fresh without re-render churn.
 */
export function createResistUtils({ getStatTotals, getDerivedStats, getCurrentMob, getPlayerLevel }) {
  const RESIST_PER_LEVEL = 1; // further softened so small gaps don’t hard-resist
  const clampAdj = (val, min, max) => Math.max(min, Math.min(max, val));

  const applyResist = (baseAmount, resistVal = 0, totalPct = 0) => {
    const afterFlat = Math.max(0, baseAmount - resistVal);
    const afterPct = Math.max(0, Math.floor(afterFlat * (1 - totalPct / 100)));
    return {
      final: afterPct,
      resistReduced: baseAmount - afterFlat,
      totalReduced: afterFlat - afterPct
    };
  };

  const getResistValue = (school = 'magic') => {
    const stats = getStatTotals();
    const map = {
      poison: stats.pr || 0,
      disease: stats.dr || 0,
      fire: stats.fr || 0,
      cold: stats.cr || 0,
      magic: stats.mr || 0
    };
    return map[school] || 0;
  };

  const getMobResistValue = (school = 'magic') => {
    const mob = getCurrentMob();
    if (!mob) return 0;
    const map = {
      poison: mob.pr || mob.poison_resist || mob.poisonResist || 0,
      disease: mob.dr || mob.disease_resist || mob.diseaseResist || 0,
      fire: mob.fr || mob.fire_resist || mob.fireResist || 0,
      cold: mob.cr || mob.cold_resist || mob.coldResist || 0,
      magic: mob.mr || mob.magic_resist || mob.magicResist || 0
    };
    return map[school] || 0;
  };

  const getMobTotalResist = () => {
    const mob = getCurrentMob();
    if (!mob) return 0;
    const chaMod = Math.floor((mob.cha || mob.charisma || 0) / 10);
    return (mob.total_resist || mob.totalResist || 0) + chaMod;
  };

  const getMobSpellDmgMod = () => {
    const mob = getCurrentMob();
    if (!mob) return 0;
    return Math.floor((mob.int || mob.intelligence || 0) / 10);
  };

  const getMobHealMod = () => {
    const mob = getCurrentMob();
    if (!mob) return 0;
    return Math.floor((mob.wis || mob.wisdom || 0) / 10);
  };

  const mitigateSpellDamage = (baseAmount, school = 'magic') => {
    const derived = getDerivedStats();
    const resistVal = getResistValue(school);
    const totalPct = derived?.totalResist || 0;
    const mobLevel = getCurrentMob?.()?.level || 0;
    const playerLevel = getPlayerLevel ? getPlayerLevel() : 0;
    const levelDiff = mobLevel - playerLevel;
    const levelAdj = clampAdj(levelDiff * RESIST_PER_LEVEL, -10, 10);
    const effResist = Math.max(0, resistVal + levelAdj);
    return applyResist(baseAmount, effResist, totalPct);
  };

  const mitigateSpellDamageVsMob = (baseAmount, school = 'magic') => {
    const resistVal = getMobResistValue(school);
    const totalPct = getMobTotalResist();
    const mobLevel = getCurrentMob?.()?.level || 0;
    const playerLevel = getPlayerLevel ? getPlayerLevel() : 0;
    const levelDiff = playerLevel - mobLevel;
    const levelAdj = clampAdj(levelDiff * RESIST_PER_LEVEL, -10, 10);
    const effResist = Math.max(0, resistVal - levelAdj);
    return applyResist(baseAmount, effResist, totalPct);
  };

  return {
    applyResist,
    getResistValue,
    getMobResistValue,
    getMobTotalResist,
    getMobSpellDmgMod,
    getMobHealMod,
    mitigateSpellDamage,
    mitigateSpellDamageVsMob
  };
}
