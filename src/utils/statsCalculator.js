/**
 * Pure utility functions for calculating character stats and bonuses
 */

/**
 * Calculate total bonuses from equipped items
 * @param {Array} slots - All inventory slots
 * @param {number} CARRY_START - Index where carry slots begin
 * @returns {Object} Total bonuses from equipped gear
 */
export const calculateTotalBonuses = (slots, CARRY_START) => {
  const equipEnd = CARRY_START === -1 ? slots.length : CARRY_START;
  const equipIndices = new Set(Array.from({ length: equipEnd }, (_, idx) => idx));

  return slots.reduce(
    (acc, item, idx) => {
      if (!item || !equipIndices.has(idx)) return acc;
      return {
        damage: acc.damage + (item.bonuses?.damage || 0),
        delay: item.bonuses?.delay ? item.bonuses.delay : acc.delay,
        haste: acc.haste + (item.bonuses?.haste || 0),
        hp: acc.hp + (item.bonuses?.hp || 0),
        mana: acc.mana + (item.bonuses?.mana || 0),
        endurance: acc.endurance + (item.bonuses?.endurance || 0),
        xp: acc.xp + (item.bonuses?.xp || 0),
        totalResist: acc.totalResist + (item.bonuses?.totalResist || 0),
        str: acc.str + (item.bonuses?.str || 0),
        sta: acc.sta + (item.bonuses?.sta || 0),
        agi: acc.agi + (item.bonuses?.agi || 0),
        dex: acc.dex + (item.bonuses?.dex || 0),
        int: acc.int + (item.bonuses?.int || 0),
        wis: acc.wis + (item.bonuses?.wis || 0),
        cha: acc.cha + (item.bonuses?.cha || 0),
        mr: acc.mr + (item.bonuses?.mr || 0),
        dr: acc.dr + (item.bonuses?.dr || 0),
        fr: acc.fr + (item.bonuses?.fr || 0),
        cr: acc.cr + (item.bonuses?.cr || 0),
        pr: acc.pr + (item.bonuses?.pr || 0),
        ac: acc.ac + (item.bonuses?.ac || 0),
        hpRegen: acc.hpRegen + (item.bonuses?.hpRegen || 0),
        manaRegen: acc.manaRegen + (item.bonuses?.manaRegen || 0),
        enduranceRegen: acc.enduranceRegen + (item.bonuses?.enduranceRegen || 0)
      };
    },
    {
      damage: 0,
      delay: null,
      haste: 0,
      hp: 0,
      mana: 0,
      endurance: 0,
      xp: 0,
      totalResist: 0,
      str: 0,
      sta: 0,
      agi: 0,
      dex: 0,
      int: 0,
      wis: 0,
      cha: 0,
      mr: 0,
      dr: 0,
      fr: 0,
      cr: 0,
      pr: 0,
      ac: 0,
      hpRegen: 0,
      manaRegen: 0,
      enduranceRegen: 0
    }
  );
};

/**
 * Calculate total stats (base + bonuses)
 * @param {Object} baseStats - Base character stats
 * @param {Object} totalBonuses - Bonuses from gear
 * @returns {Object} Combined stat totals
 */
export const calculateStatTotals = (baseStats, totalBonuses) => ({
  str: (baseStats.str || 0) + (totalBonuses.str || 0),
  sta: (baseStats.sta || 0) + (totalBonuses.sta || 0),
  agi: (baseStats.agi || 0) + (totalBonuses.agi || 0),
  dex: (baseStats.dex || 0) + (totalBonuses.dex || 0),
  int: (baseStats.int || 0) + (totalBonuses.int || 0),
  wis: (baseStats.wis || 0) + (totalBonuses.wis || 0),
  cha: (baseStats.cha || 0) + (totalBonuses.cha || 0),
  mr: totalBonuses.mr || 0,
  dr: totalBonuses.dr || 0,
  fr: totalBonuses.fr || 0,
  cr: totalBonuses.cr || 0,
  pr: totalBonuses.pr || 0,
  hpRegen: totalBonuses.hpRegen || 0,
  manaRegen: totalBonuses.manaRegen || 0,
  enduranceRegen: totalBonuses.enduranceRegen || 0
});

/**
 * Calculate derived combat and character stats
 * @param {Object} params - Calculation parameters
 * @returns {Object} All derived stats
 */
export const calculateDerivedStats = ({ playerClass, level, totalBonuses, statTotals }) => {
  const strMod = Math.floor((statTotals.str || 0) / 10);
  const dexSpeedMod = Math.max(0.7, 1 - (statTotals.dex || 0) * 0.002);
  const hasteMod = Math.max(0.5, 1 - (totalBonuses.haste || 0) / 100);
  const baseDelay = totalBonuses.delay || playerClass.attackSpeed || 1000;
  const attackDelay = Math.max(300, Math.floor(baseDelay * dexSpeedMod * hasteMod));
  const minDamageBase = Math.floor(playerClass.baseDamage * (1 + level * 0.1));
  const minDamage = minDamageBase + strMod + (totalBonuses.damage || 0);
  const maxDamage = minDamage + 5;
  const hpFromSta = (statTotals.sta || 0) * 5;
  const manaFromStats = ((statTotals.int || 0) + (statTotals.wis || 0)) * 2;
  const enduranceFromSta = (statTotals.sta || 0) * 2;

  // CHA affects total resistance percentage
  const chaTotalResistMod = Math.floor((statTotals.cha || 0) / 10);
  const effectSpellDmgMod = statTotals.mod_spell_dmg_pct || 0;
  const effectHealMod = statTotals.mod_heal_pct || 0;

  return {
    minDamage,
    maxDamage,
    attackDelay,
    strMod,
    hpFromSta,
    manaFromStats,
    enduranceFromSta,
    // INT and WIS from total stats drive modifiers; CHA contributes to total resist %
    spellDmgMod: Math.floor((statTotals.int || 0) / 10) + effectSpellDmgMod,
    healMod: Math.floor((statTotals.wis || 0) / 10) + effectHealMod,
    xpBonus: totalBonuses.xp || 0,
    totalResist: (totalBonuses.totalResist || 0) + chaTotalResistMod,
    carryCap: statTotals.str || 0
  };
};

/**
 * Combine bonuses and stat totals for display
 * @param {Object} totalBonuses - Gear bonuses
 * @param {Object} statTotals - Total stats
 * @returns {Object} Combined display object
 */
export const calculateDisplayBonuses = (totalBonuses, statTotals) => ({
  ...totalBonuses,
  ...statTotals
});
