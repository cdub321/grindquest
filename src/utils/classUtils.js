/**
 * Helpers for normalizing class data with growth fields.
 */

const STAT_KEYS = ['str', 'sta', 'agi', 'dex', 'int', 'wis', 'cha'];
const VITAL_KEYS = ['hp', 'mana', 'endurance'];

const parseMods = (mods = {}) => {
  const source = typeof mods === 'string' ? (() => { try { return JSON.parse(mods); } catch { return {}; } })() : mods || {};
  const out = {};
  [...STAT_KEYS, ...VITAL_KEYS].forEach((key) => {
    const val = Number(source?.[key] ?? 0);
    out[key] = Number.isFinite(val) ? val : 0;
  });
  return out;
};

export const normalizeStatGrowth = (growth = {}) =>
  STAT_KEYS.reduce((obj, key) => {
    const val = Number(growth?.[key] ?? 0);
    obj[key] = Number.isFinite(val) ? val : 0;
    return obj;
  }, {});

/**
 * Build a keyed map of classes with normalized growth fields and defaults.
 */
export const buildClassMapWithGrowth = (classCatalog = []) =>
  classCatalog.reduce((acc, cls) => {
    const statGrowth = normalizeStatGrowth(cls.stat_growth ?? cls.statGrowth ?? {});
    const rawXp = Number(cls.class_xp_mod ?? cls.xp_mod ?? 100);
    const parsedXp = Number.isFinite(rawXp) ? (rawXp <= 10 ? rawXp : rawXp / 100) : 1;
    acc[cls.id] = {
      name: cls.name || cls.id || '',
      baseDamage: Number(cls.base_damage ?? cls.baseDamage ?? 0),
      baseHp: Number(cls.base_hp ?? cls.baseHp ?? 0),
      baseMana: Number(cls.base_mana ?? cls.baseMana ?? 0),
      baseEndurance: Number(cls.base_endurance ?? cls.baseEndurance ?? 0),
      attackSpeed: Number(cls.attack_speed ?? cls.attackSpeed ?? 0) || 0,
      isCaster: Boolean(cls.is_caster ?? cls.isCaster ?? false),
      regenModHp: Number(cls.regen_mod_hp ?? 1) || 1,
      regenModMana: Number(cls.regen_mod_mana ?? 1) || 1,
      regenModEndurance: Number(cls.regen_mod_endurance ?? 1) || 1,
      xpMod: parsedXp,
      xpModRaw: Number.isFinite(rawXp) ? rawXp : 100,
      hpPerLevel: Number(cls.hp_per_level ?? cls.hpPerLevel ?? 0) || 0,
      manaPerLevel: Number(cls.mana_per_level ?? cls.manaPerLevel ?? 0) || 0,
      endurancePerLevel: Number(cls.endurance_per_level ?? cls.endurancePerLevel ?? 0) || 0,
      statGrowth,
      baseMods: parseMods(cls.base_mods ?? cls.bonus_mods ?? {})
  };
  return acc;
}, {});
