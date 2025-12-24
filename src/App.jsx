import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import CharacterPanel from './components/CharacterPanel';
import ZonePanel from './components/ZonePanel';
import AuthPanel from './components/AuthPanel';
import CombatConsole from './components/CombatConsole';
import HardcoreLeaderboard from './components/HardcoreLeaderboard';
import MerchantPanel from './components/MerchantPanel';
import BankPanel from './components/BankPanel';
import {
  signIn,
  signOut,
  signUp,
  onAuthStateChange,
  saveCharacter,
  saveInventory,
  getSession,
  fetchCharacters,
  createCharacter,
  deleteCharacter,
  updateMerchantStock
} from './services/playerStorage';
import {
  slotOrder,
  CARRY_START,
  canEquipItemInSlot,
  addItemToInventory as addItemToInventoryUtil
} from './services/inventoryManager';
import CharacterSelectPanel from './components/CharacterSelectPanel';
import CharacterCreatePanel from './components/CharacterCreatePanel';
import EqIcon from './components/EqIcon';
import InventoryModal from './components/InventoryModal';
import { useReferenceData } from './hooks/useReferenceData';
import { useCombat } from './hooks/useCombat';
import { useSkillSlots } from './hooks/useSkillSlots';
import { useCharacterLoader } from './hooks/useCharacterLoader';
import { useEncounter } from './hooks/useEncounter';
import { useInteractions } from './hooks/useInteractions';
import { useProgression } from './hooks/useProgression';
import { useMerchantTransactions } from './hooks/useMerchantTransactions';
import {
  calculateTotalBonuses,
  calculateStatTotals,
  calculateDerivedStats,
  calculateDisplayBonuses
} from './utils/statsCalculator';
import { buildClassMapWithGrowth } from './utils/classUtils';
import { useLeveling } from './hooks/useLeveling';
import { normalizePercentMod, buildCharacterXpMod, toHundredScale } from './utils/xpUtils';

export default function GrindQuest() {
  const extractBaseMods = useCallback((source) => {
    if (!source) return { str: 0, sta: 0, agi: 0, dex: 0, int: 0, wis: 0, cha: 0, hp: 0, mana: 0, endurance: 0 };
    const raw =
      source.base_stats ??
      source.baseStats ??
      source.base_mods ??
      source.baseMods ??
      source.bonus_mods ??
      source.bonusMods ??
      source;
    let obj = raw;
    if (typeof raw === 'string') {
      try {
        obj = JSON.parse(raw);
      } catch {
        obj = {};
      }
    }
    const keys = ['str', 'sta', 'agi', 'dex', 'int', 'wis', 'cha', 'hp', 'mana', 'endurance'];
    return keys.reduce((acc, key) => {
      const val = Number(obj?.[key] ?? 0);
      acc[key] = Number.isFinite(val) ? val : 0;
      return acc;
    }, {});
  }, []);
  const {
    classCatalog,
    races,
    deities,
    raceClassAllowed,
    deityClassAllowed,
    zones,
    items,
    skills,
    campsByZone,
    campMembers,
    lootTables,
    merchantStock: merchantStockData,
    currentCampId,
    setCurrentCampId
  } = useReferenceData();
  const [playerClassKey, setPlayerClassKey] = useState('warrior');
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [copper, setCopper] = useState(0);
  const [silver, setSilver] = useState(0);
  const [gold, setGold] = useState(0);
  const [platinum, setPlatinum] = useState(0);
  const [mode, setMode] = useState('normal');
  const [raceId, setRaceId] = useState(null);
  const [deityId, setDeityId] = useState(null);
  const [bindZoneId, setBindZoneId] = useState(null);
  const [user, setUser] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [characterName, setCharacterName] = useState('');
  const [killedAt, setKilledAt] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [baseStats, setBaseStats] = useState({
    str: 0,
    sta: 0,
    agi: 0,
    dex: 0,
    int: 0,
    wis: 0,
    cha: 0
  });
  const [baseVitals, setBaseVitals] = useState({
    hp: 0,
    mana: 0,
    endurance: 0
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [skillCooldowns, setSkillCooldowns] = useState({});
  const [cooldownTick, setCooldownTick] = useState(0);
  const [inspectedItem, setInspectedItem] = useState(null);
  const [knownSkills, setKnownSkills] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const getStartingZoneId = (raceId) => {
    const race = races.find((r) => r.id === raceId);
    return race?.home_zone_id || '';
  };

  const classes = useMemo(() => buildClassMapWithGrowth(classCatalog), [classCatalog]);

  const classNameMap = useMemo(() => {
    return Object.entries(classes).reduce((acc, [id, cls]) => {
      acc[id] = cls.name || id;
      return acc;
    }, {});
  }, [classes]);

  const raceMap = useMemo(() => {
    return races.reduce((acc, r) => {
      const rawXp = Number(r.race_xp_mod ?? r.xp_mod ?? 100);
      acc[r.id] = {
        ...r,
        xpMod: normalizePercentMod(rawXp),
        xpRaw: Number.isFinite(rawXp) ? rawXp : 100
      };
      return acc;
    }, {});
  }, [races]);

  const deityMap = useMemo(() => {
    return deities.reduce((acc, d) => {
      const rawXp = Number(d.deity_xp_mod ?? d.xp_mod ?? 100);
      acc[d.id] = {
        ...d,
        xpMod: normalizePercentMod(rawXp),
        xpRaw: Number.isFinite(rawXp) ? rawXp : 100
      };
      return acc;
    }, {});
  }, [deities]);

  const playerClass = classes[playerClassKey] || {};
  const raceName = raceId ? raceMap[raceId]?.name : '';
  const deityName = deityId ? deityMap[deityId]?.name : '';
  const baseMaxHp = Math.max(0, baseVitals.hp || 0);
  const baseMaxMana = Math.max(0, baseVitals.mana || 0);
  const baseMaxEndurance = Math.max(0, baseVitals.endurance || 0);
  const [hp, setHp] = useState(baseMaxHp);
  const [maxHp, setMaxHp] = useState(baseMaxHp);
  const [mana, setMana] = useState(baseMaxMana);
  const [maxMana, setMaxMana] = useState(baseMaxMana);
  const [endurance, setEndurance] = useState(baseMaxEndurance);
  const [maxEndurance, setMaxEndurance] = useState(baseMaxEndurance);

  const [currentZoneId, setCurrentZoneId] = useState(null);
  const currentZone = zones[currentZoneId] || { name: 'Unknown', mobs: [] };
  const currentZoneCamps = campsByZone[currentZoneId] || [];
  const currentCamp = currentZoneCamps.find((c) => `${c.id}` === `${currentCampId}`);
  const zoneXpMod = normalizePercentMod(currentZone?.xp_mod ?? 100);
  const campXpMod = normalizePercentMod(currentCamp?.camp_xp_mod ?? 100);
  const raceXpMod = raceId ? raceMap[raceId]?.xpMod ?? 1 : 1;
  const deityXpMod = deityId ? deityMap[deityId]?.xpMod ?? 1 : 1;
  const classXpMod = playerClass?.xpMod ?? 1;
  const SERVER_XP_RATE = 1;
  // slotOrder and CARRY_START imported from inventoryManager
  const [currentMob, setCurrentMob] = useState(null);
  const [mobHp, setMobHp] = useState(0);
  const [mobMana, setMobMana] = useState(0);
  const [mobEndurance, setMobEndurance] = useState(0);
  const [isAutoAttack, setIsAutoAttack] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [slots, setSlots] = useState(Array(slotOrder.length).fill(null));
  const [inCombat, setInCombat] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [fleeExhausted, setFleeExhausted] = useState(false);
  const [isTraveling, setIsTraveling] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [tickSignal, setTickSignal] = useState(Date.now());
  const [forceGameView, setForceGameView] = useState(false);

  const autoAttackInterval = useRef(null);
  const combatTimeout = useRef(null);
  const isDeadRef = useRef(false);
  const fleeExhaustTimeout = useRef(null);
  const lastLogRef = useRef(null);
  const logIdRef = useRef(0);
  const saveTimeout = useRef(null);
  const travelTimerRef = useRef(null);
  const travelTargetRef = useRef(null);
  const justLoadedRef = useRef(false);
  const prevMaxHpRef = useRef(0);
  const prevMaxManaRef = useRef(0);
  const prevMaxEnduranceRef = useRef(0);
  const xpSaveReadyRef = useRef(false);
  const profileHydratedRef = useRef(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const slotsRef = useRef(slots);
  const lastRegenTickRef = useRef(Date.now());
  const forceGameViewRef = useRef(false);

  const addLog = (message, type = 'normal') => {
    const id = `${Date.now()}-${(logIdRef.current += 1)}`;
    setCombatLog((prev) => {
      const entry = { message, type, id };
      lastLogRef.current = entry;
      return [...prev.slice(-199), entry];
    });
  };

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    profileHydratedRef.current = false;
    setProfileHydrated(false);
  }, [characterId]);

  useEffect(() => {
    forceGameViewRef.current = forceGameView;
  }, [forceGameView]);

  const inventoryPreview = slots;
  const itemsFoundCount = useMemo(() => slots.reduce((count, item) => {
    if (!item) return count;
    const childCount = item.contents ? item.contents.filter(Boolean).length : 0;
    return count + 1 + childCount;
  }, 0), [slots]);
  const flatInventory = useMemo(() => {
    const entries = [];
    slots.forEach((item, idx) => {
      if (idx < CARRY_START) return;
      if (!item) return;
      entries.push({
        key: `slot-${idx}`,
        slotIndex: idx,
        containerIndex: null,
        item
      });
      if (item.contents?.length) {
        item.contents.forEach((child, cIdx) => {
          if (!child) return;
          entries.push({
            key: `slot-${idx}-bag-${cIdx}`,
            slotIndex: idx,
            containerIndex: cIdx,
            item: child
          });
        });
      }
    });
    return entries;
  }, [slots]);

  const XP_BASE = 200;
  const xpNeeded = XP_BASE * level;
  const coinsToCp = useCallback((cur) => {
    return (cur.platinum || 0) * 1000 + (cur.gold || 0) * 100 + (cur.silver || 0) * 10 + (cur.copper || 0);
  }, []);
  const cpToCoins = useCallback((cp) => {
    let rem = Math.max(0, Math.floor(cp));
    const platinum = Math.floor(rem / 1000);
    rem -= platinum * 1000;
    const gold = Math.floor(rem / 100);
    rem -= gold * 100;
    const silver = Math.floor(rem / 10);
    rem -= silver * 10;
    const copper = rem;
    return { platinum, gold, silver, copper };
  }, []);

  const setCurrency = useCallback((coins) => {
    setCopper(coins.copper || 0);
    setSilver(coins.silver || 0);
    setGold(coins.gold || 0);
    setPlatinum(coins.platinum || 0);
  }, []);

  const createItemInstance = (itemId) => {
    const data = items[itemId];
    return {
      id: `${data.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: data.name,
      slot: data.slot || 'misc',
      bonuses: data.bonuses || {},
      iconIndex: data.iconIndex ?? null,
      baseItemId: data.id,
      quantity: 1,
      stackable: data.stackable ?? false,
      maxStack: data.maxStack || 1,
      bagSlots: data.bagslots || data.bagSlots || 0
    };
  };

  const totalBonuses = useMemo(() =>
    calculateTotalBonuses(slots, CARRY_START),
    [slots, CARRY_START]
  );

  // Calculate base stats (innate + gear bonuses)
  const baseStatTotals = useMemo(() =>
    calculateStatTotals(baseStats, totalBonuses),
    [baseStats, totalBonuses]
  );

  // Placeholder for getStatModifiers - will be set after useCombat initializes
  const [getStatModifiersFn, setGetStatModifiersFn] = useState(null);
  const [playerEffectsState, setPlayerEffectsState] = useState([]);
  const [mobEffectsState, setMobEffectsState] = useState([]);
  const interactions = useInteractions({ characterId, items, addLog });

  // Final stat totals including modifiers from effects
  // This will be recalculated after useCombat provides getStatModifiers
  const statTotals = useMemo(() => {
    if (!getStatModifiersFn) {
      return baseStatTotals;
    }
    const mods = getStatModifiersFn('player') || {};
    return {
      str: (baseStatTotals.str || 0) + (mods.str || 0),
      sta: (baseStatTotals.sta || 0) + (mods.sta || 0),
      agi: (baseStatTotals.agi || 0) + (mods.agi || 0),
      dex: (baseStatTotals.dex || 0) + (mods.dex || 0),
      int: (baseStatTotals.int || 0) + (mods.int || 0),
      wis: (baseStatTotals.wis || 0) + (mods.wis || 0),
      cha: (baseStatTotals.cha || 0) + (mods.cha || 0),
      mr: (baseStatTotals.mr || 0) + (mods.mr || 0),
      dr: (baseStatTotals.dr || 0) + (mods.dr || 0),
      fr: (baseStatTotals.fr || 0) + (mods.fr || 0),
      cr: (baseStatTotals.cr || 0) + (mods.cr || 0),
      pr: (baseStatTotals.pr || 0) + (mods.pr || 0),
      mod_spell_dmg_pct: mods.mod_spell_dmg_pct || 0,
      mod_heal_pct: mods.mod_heal_pct || 0,
      mod_max_hp: mods.mod_max_hp || 0,
      mod_max_mana: mods.mod_max_mana || 0,
      mod_max_endurance: mods.mod_max_endurance || 0,
      mod_move: mods.mod_move || 0,
      mod_damage: mods.mod_damage || 0,
      mod_delay: mods.mod_delay || 0,
      hpRegen: (baseStatTotals.hpRegen || 0) + (mods.mod_hp_regen || 0),
      manaRegen: (baseStatTotals.manaRegen || 0) + (mods.mod_mana_regen || 0),
      enduranceRegen: (baseStatTotals.enduranceRegen || 0) + (mods.mod_endurance_regen || 0)
    };
  }, [baseStatTotals, getStatModifiersFn, playerEffectsState]);


  const displayBonuses = useMemo(() =>
    calculateDisplayBonuses(totalBonuses, statTotals),
    [totalBonuses, statTotals]
  );

  const derivedStats = useMemo(() =>
    calculateDerivedStats({ playerClass, level, totalBonuses, statTotals }),
    [playerClass, level, totalBonuses, statTotals]
  );

  const getHpRegenRate = useCallback(() => {
    const base = (inCombat ? 1 : 3) * (playerClass.regenModHp || 1);
    const penalty = fleeExhausted ? 0.5 : 1;
    const sitBonus = isSitting && !inCombat ? 2 : 1;
    return Math.max(1, Math.floor(base * penalty * sitBonus));
  }, [inCombat, fleeExhausted, isSitting, playerClass.regenModHp]);

  const getManaRegenRate = useCallback(() => {
    if (baseMaxMana <= 0) return 0;
    const base = (isSitting ? 12 : inCombat ? 1 : 5) * (playerClass.regenModMana || 1);
    const penalty = fleeExhausted ? 0.5 : 1;
    return Math.max(1, Math.floor(base * penalty));
  }, [baseMaxMana, isSitting, inCombat, fleeExhausted, playerClass.regenModMana]);

  const getEnduranceRegenRate = useCallback(() => {
    if (baseMaxEndurance <= 0) return 0;
    const base = (isSitting ? 12 : inCombat ? 1 : 5) * (playerClass.regenModEndurance || 1);
    const penalty = fleeExhausted ? 0.5 : 1;
    return Math.max(1, Math.floor(base * penalty));
  }, [baseMaxEndurance, isSitting, inCombat, fleeExhausted, playerClass.regenModEndurance]);


  useEffect(() => {
    const t = setInterval(() => setCooldownTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!profileHydrated) return;
    const hpFromSta = (statTotals.sta || 0) * 5;
    const manaFromStats = ((statTotals.int || 0) + (statTotals.wis || 0)) * 2;
    const newMaxHp = baseMaxHp + totalBonuses.hp + hpFromSta;
    const newMaxMana = baseMaxMana + totalBonuses.mana + manaFromStats;
    const newMaxEndurance = playerClass.isCaster
      ? 0
      : baseMaxEndurance + totalBonuses.endurance + (derivedStats.enduranceFromSta || 0);
    setMaxHp(newMaxHp);
    if (justLoadedRef.current) {
      setHp(newMaxHp);
    } else {
      setHp(prev => {
        if (newMaxHp > prevMaxHpRef.current && prev >= prevMaxHpRef.current) {
          return newMaxHp;
        }
        return Math.min(newMaxHp, prev);
      });
    }
    setMaxMana(newMaxMana);
    if (justLoadedRef.current) {
      setMana(newMaxMana);
      setEndurance(newMaxEndurance);
      justLoadedRef.current = false;
    } else {
      setMana(prev => {
        if (newMaxMana > prevMaxManaRef.current && prev >= prevMaxManaRef.current) {
          return newMaxMana;
        }
        return Math.min(newMaxMana, prev);
      });
      setEndurance(prev => {
        if (newMaxEndurance > prevMaxEnduranceRef.current && prev >= prevMaxEnduranceRef.current) {
          return newMaxEndurance;
        }
        return Math.min(newMaxEndurance, prev);
      });
    }
    prevMaxHpRef.current = newMaxHp;
    prevMaxManaRef.current = newMaxMana;
    prevMaxEnduranceRef.current = newMaxEndurance;
  }, [
    baseMaxHp,
    baseMaxMana,
    baseMaxEndurance,
    totalBonuses.hp,
    totalBonuses.mana,
    totalBonuses.endurance,
    statTotals.sta,
    statTotals.int,
    statTotals.wis,
    playerClass.isCaster,
    derivedStats.enduranceFromSta,
    profileHydrated
  ]);

  const getNpcPortrait = useCallback((mob) => {
    if (!mob) return null;
    const race = mob.race_id ?? mob.raceId ?? 1;
    const gender = mob.gender ?? 0;
    const texture = mob.texture_id ?? mob.textureId ?? 1;
    return `/stone-ui/raceimages/${race}_${gender}_${texture}_0.jpg`;
  }, []);

  const getCampDistance = useCallback((zoneId) => {
    const camps = campsByZone[zoneId] || [];
    if (!camps.length) return 0;
    const totalCampArea = camps.reduce(
      (sum, camp) => sum + Number(camp.camp_area ?? camp.campArea ?? 0),
      0
    );
    const leftover = Math.max(0, Number(zones[zoneId]?.zone_area ?? 0) - totalCampArea);
    return Math.round(leftover / camps.length);
  }, [campsByZone, zones]);

  const availableZoneIds = useMemo(() => {
    const connections = currentZone.connections || [];
    const options = new Set([currentZoneId, ...connections]);
    return Array.from(options).filter(id => zones[id]);
  }, [currentZone, currentZoneId, zones]);

  const hasKeyItem = useCallback((keyVal) => {
    const normalized = (keyVal ?? '').toString().trim();
    if (!normalized || normalized === '0' || normalized.toLowerCase() === 'null') return true;
    const keyNum = Number(normalized);
    const matchesKey = (item) => {
      if (!item) return false;
      const base = item.baseItemId || item.base_item_id || item.id || '';
      if (!base) return false;
      if (base === normalized) return true;
      const baseNum = Number(base);
      return Number.isFinite(keyNum) && Number.isFinite(baseNum) && baseNum === keyNum;
    };
    const slotsToCheck = slotsRef.current || [];
    for (const slot of slotsToCheck) {
      if (matchesKey(slot)) return true;
      if (slot?.contents?.length) {
        for (const child of slot.contents) {
          if (matchesKey(child)) return true;
        }
      }
    }
    return false;
  }, [slotsRef]);

  const serializeSlots = (slotArr) => {
    const rows = [];
    (slotArr || []).forEach((item, idx) => {
      if (!item) return;
      const rowId = item.id || `${item.baseItemId || 'item'}-${idx}-${Date.now()}`;
      rows.push({
        id: rowId,
        base_item_id: item.baseItemId || item.base_item_id || item.id || item.name,
        slot_id: item.slot_id || item.slotId || slotOrder[idx],
        quantity: item.quantity || 1,
        item_data: item.item_data || item.itemData || (item.bagSlots ? { bagslots: item.bagSlots } : null),
        container_id: null
      });

      if (item.bagSlots && item.contents && item.contents.length) {
        item.contents.forEach((child, cIdx) => {
          if (!child) return;
          rows.push({
            id: child.id || `${child.baseItemId || 'item'}-${rowId}-c${cIdx}`,
            base_item_id: child.baseItemId || child.base_item_id || child.id || child.name,
            slot_id: child.slot_id || child.slotId || `slot${cIdx + 1}`,
            quantity: child.quantity || 1,
            item_data: child.item_data || child.itemData || null,
            container_id: rowId
          });
        });
      }
    });
    return rows;
  };

  const scheduleSave = (payload, opts = {}) => {
    const { immediate = false } = opts;
    if (!user || !characterId) return;
    const performSave = async () => {
      try {
        if (payload.character) {
          await saveCharacter(characterId, payload.character);
        }
        if (payload.inventory) {
          const combined = serializeSlots(slotsRef.current);
          await saveInventory(characterId, combined);
        }
      } catch (err) {
        console.error('Save failed', err);
        addLog('Save failed. Check connection.', 'error');
      }
    };

    if (immediate) {
      // For immediate saves, return the promise so caller can await if needed
      return performSave();
    }

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(performSave, 500);
  };

  useLeveling({
    xp,
    level,
    XP_BASE,
    playerClass,
    baseStats,
    baseVitals,
    setBaseVitals,
    characterXpMod: normalizePercentMod(characters.find((c) => c.id === characterId)?.xp_mod ?? 100),
    currency: { copper, silver, gold, platinum },
    addLog,
    setXp,
    setLevel,
    setBaseStats,
    scheduleSave,
    isProfileHydrated: profileHydrated
  });

  const addItemToInventory = (item, qty = 1) => {
    setSlots((prev) => {
      return addItemToInventoryUtil(prev, item, qty, {
        items,
        addLog,
        slotsRef,
        scheduleSave
      });
    });
  };

  const {
    merchantStockState,
    getBuyPrice,
    getSellPrice,
    handleBuyFromMerchant,
    handleSellToMerchant
  } = useMerchantTransactions({
    items,
    statTotals,
    merchantStockData,
    currency: { copper, silver, gold, platinum },
    setCurrency,
    coinsToCp,
    cpToCoins,
    addLog,
    addItemToInventory,
    createItemInstance,
    scheduleSave,
    setSlots,
    slotsRef,
    updateMerchantStock
  });

  // Persist XP/level changes immediately (character only) to avoid loss on refresh.
  useEffect(() => {
    if (!profileHydrated) return;
    if (!xpSaveReadyRef.current) {
      xpSaveReadyRef.current = true;
      return;
    }
    scheduleSave(
      { character: { level, xp, currency: { copper, silver, gold, platinum } } },
      { immediate: true }
    );
  }, [level, xp, copper, silver, gold, platinum, profileHydrated]);

  const handleWithdrawBank = useCallback(
    async (row) => {
      const withdrawn = await interactions.withdrawFromBank(row);
      if (!withdrawn) return;
      addItemToInventory(withdrawn, withdrawn.quantity || 1);
      scheduleSave({ inventory: true }, { immediate: true });
      addLog(`You withdraw ${withdrawn.name || withdrawn.base_item_id}.`, 'system');
    },
    [addItemToInventory, addLog, interactions, scheduleSave]
  );

  const handleDepositToBank = useCallback(
    async (entry) => {
      if (!entry?.item) return;
      const baseId = entry.item.baseItemId || entry.item.base_item_id || entry.item.id;
      if (!baseId) {
        addLog('Cannot bank an unknown item.', 'error');
        return;
      }
      const bankRow = {
        id: entry.item.id || `${baseId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        base_item_id: baseId,
        baseItemId: baseId,
        quantity: entry.item.quantity || 1,
        slot_id: null,
        item_data: entry.item.item_data || entry.item.itemData || null
      };
      try {
        await interactions.depositToBank([bankRow]);
      } catch (err) {
        console.error('Deposit failed', err);
        addLog('Deposit failed. Try again.', 'error');
        return;
      }

      setSlots((prev) => {
        const next = [...prev];
        const parent = next[entry.slotIndex];
        if (!parent) return prev;
        if (entry.containerIndex === null || entry.containerIndex === undefined) {
          next[entry.slotIndex] = null;
        } else if (parent.contents) {
          const contents = [...parent.contents];
          if (!contents[entry.containerIndex]) return prev;
          contents[entry.containerIndex] = null;
          next[entry.slotIndex] = { ...parent, contents };
        }
        slotsRef.current = next;
        return next;
      });
      scheduleSave({ inventory: true }, { immediate: true });
      addLog(`You deposit ${entry.item.name || baseId}.`, 'system');
    },
    [addLog, interactions, scheduleSave, setSlots]
  );

  const { spawnMob, handleMobKilled } = useEncounter({
    campMembers,
    currentCampId,
    currentCamp,
    setCurrentMob,
    setMobHp,
    setMobMana,
    setMobEndurance,
    addLog,
    lootTables,
    items,
    addItemToInventory,
    createItemInstance,
    xp,
    setXp,
    level,
    setLevel,
    derivedStats,
    currentZoneId,
    xpRate: SERVER_XP_RATE,
    characterXpMod: normalizePercentMod(characters.find((c) => c.id === characterId)?.xp_mod ?? 100),
    zoneXpMod,
    campXpMod,
    copper,
    silver,
    gold,
    platinum,
    scheduleSave,
    onInteraction: interactions.openInteraction
  });

  const { handlePlayerDeath } = useProgression({
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
    currency: { copper, silver, gold, platinum },
    mode,
    setKilledAt,
    onReturnToCharacterSelect: () => {
      setForceGameView(false);
      setIsSelectingCharacter(true);
      setIsCreatingCharacter(false);
    }
  });

  // Combat hook
  const {
    handleUseSkill,
    isSkillOnCooldown,
    blockIfHardcoreDead,
    playerEffects,
    mobEffects,
    getStatModifiers,
    setPlayerEffects,
    setMobEffects,
    setAutoAttackChain,
    castingState,
    mobDistance
  } = useCombat({
    // Combat state
    currentMob,
    setCurrentMob,
    mobHp,
    setMobHp,
    mobMana,
    setMobMana,
    mobEndurance,
    setMobEndurance,
    inCombat,
    setInCombat,
    isSitting,
    setIsSitting,
    isAutoAttack,
    setIsAutoAttack,
    fleeExhausted,
    setFleeExhausted,

    // Player state
    hp,
    setHp,
    mana,
    setMana,
    endurance,
    setEndurance,
    maxHp,
    maxMana,
    maxEndurance,
    level,
    xp,
    setXp,
    setLevel,

    // Character data
    playerClass,
    mode,
    killedAt,
    setKilledAt,
    bindZoneId,

    // Stats - pass current statTotals (will be updated with modifiers)
    derivedStats,
    statTotals,
    totalBonuses,

    // Zone/Camp
    currentZoneId,
    setCurrentZoneId,

    // Encounter
    spawnMob,
    onMobKilled: handleMobKilled,
    onPlayerDeath: handlePlayerDeath,

    // Currency

    // Cooldowns
    skillCooldowns,
    setSkillCooldowns,

    // Utils
    addLog,
    scheduleSave,
    XP_BASE,
    tickSignal,
    slots,
    setSlots,

    // Refs
    isDeadRef,
    combatTimeout,
    fleeExhaustTimeout
  });

  // Persist combat/encounter state frequently
  useEffect(() => {
    if (!characterId) return;
    const now = Date.now();
    const serializeEffects = (effects, target) =>
      (effects || [])
        .filter((e) => e.expiresAt && e.expiresAt > now)
        .map((e) => ({
          target,
          id: e.id,
          name: e.name,
          type: e.type,
          statMods: e.statMods || null,
          icon: e.icon || null,
          tickDamage: e.tickDamage || 0,
          tickInterval: e.tickInterval ? e.tickInterval / 1000 : 3,
          casterCha: e.casterCha || 0,
          endsAt: new Date(e.expiresAt).toISOString()
        }));
    const serializedEffects = [
      ...serializeEffects(playerEffectsState, 'player'),
      ...serializeEffects(mobEffectsState, 'mob')
    ];
    const serializedCooldowns = Object.fromEntries(
      Object.entries(skillCooldowns || {}).map(([k, v]) => [k, v ? new Date(v).toISOString() : null])
    );
    const fleeAvailableIso =
      skillCooldowns?.['builtin-flee'] && skillCooldowns['builtin-flee'] > now
        ? new Date(skillCooldowns['builtin-flee']).toISOString()
        : null;
    const mobPayload = currentMob
      ? {
          ...currentMob,
          hp: mobHp,
          mana: mobMana,
          endurance: mobEndurance,
          distance: mobDistance
        }
      : null;
    scheduleSave({
      character: {
        current_camp_id: currentCampId || null,
        current_mob: mobPayload,
        mob_respawn_at: null,
        active_effects: serializedEffects,
        cooldowns: serializedCooldowns,
        flee_available_at: fleeAvailableIso,
        in_combat: inCombat,
        last_combat_save: new Date().toISOString(),
        hp,
        mana,
        endurance
      }
    });
  }, [
    characterId,
    currentCampId,
    currentMob,
    mobHp,
    mobMana,
    mobEndurance,
    mobDistance,
    playerEffectsState,
    mobEffectsState,
    skillCooldowns,
    inCombat,
    scheduleSave,
    hp,
    mana,
    endurance
  ]);

  // Update getStatModifiers and playerEffects when useCombat provides them
  useEffect(() => {
    if (getStatModifiers) {
      setGetStatModifiersFn((prev) => (prev === getStatModifiers ? prev : getStatModifiers));
    }
  }, [getStatModifiers]);

  useEffect(() => {
    if (playerEffects) {
      setPlayerEffectsState(playerEffects);
    }
  }, [playerEffects]);

  useEffect(() => {
    if (mobEffects) {
      setMobEffectsState(mobEffects);
    }
  }, [mobEffects]);

  const handleCampChange = useCallback((campId, zoneIdOverride = null) => {
    if (blockIfHardcoreDead('change camps')) return;
    if (castingState) {
      addLog('You cannot change camps while casting!', 'error');
      return;
    }
    if (inCombat) {
      addLog('You cannot change camps while in combat!', 'error');
      return;
    }
    if (isTraveling) {
      // Cancel any in-flight travel so the new selection takes effect immediately
      setIsTraveling(false);
      travelTargetRef.current = null;
      if (travelTimerRef.current) {
        clearTimeout(travelTimerRef.current);
        travelTimerRef.current = null;
      }
    }
    const zoneKey = zoneIdOverride || currentZoneId;
    const zoneCamps = campsByZone[zoneKey] || [];
    const camp = zoneCamps.find((c) => `${c.id}` === `${campId}`);
    if (!camp) {
      setCurrentCampId(null);
      return;
    }
    const needsKey = camp.key_item;
    if (needsKey && !hasKeyItem(needsKey)) {
      addLog(`You need key item ${needsKey} to enter ${camp.name || 'this camp'}.`, 'error');
      return;
    }

    // Invis bypass: instant port, no ambush
    const isInvisible = playerEffectsState.some((e) => e.type === 'invis');
    if (isInvisible) {
      setCurrentCampId(camp.id);
      setCurrentMob(null);
      setMobHp(0);
      setMobMana(0);
      setMobEndurance(0);
      addLog(`You slip unseen to ${camp.name || 'camp'}.`, 'system');
      return;
    }

    const distance = getCampDistance(zoneKey);
    if (distance <= 0) {
      setCurrentCampId(camp.id);
      setCurrentMob(null);
      setMobHp(0);
      setMobMana(0);
      setMobEndurance(0);
      addLog(`You arrive at ${camp.name || 'camp'}.`, 'system');
      return;
    }

    // Begin travel
    setIsTraveling(true);
    travelTargetRef.current = camp.id;
    let remaining = distance;
    const tickDistance = 10;
    const tickMs = 3000;
    const hostilityTier = Number(zones[zoneKey]?.hostility_tier ?? 0);
    const ambushChance = Math.max(0, hostilityTier * 0.1);
    const playerMods = getStatModifiers ? getStatModifiers('player') || {} : {};
    const playerSpeed = Math.max(0.1, 1 * (1 + (playerMods.mod_move || 0) / 100));

    const campPool = [
      ...(campMembers[currentCampId] || []),
      ...(campMembers[camp.id] || [])
    ].filter(Boolean);

    const pickMob = () => {
      if (!campPool.length) return null;
      const weights = campPool.map((m) => Number(m.weight) > 0 ? Number(m.weight) : 1);
      const total = weights.reduce((s, w) => s + w, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < campPool.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) return campPool[i];
      }
      return campPool[0];
    };

    const normalizeMob = (mob) => {
      if (!mob) return null;
      const levelBase = Number(mob.level) || 1;
      const maxLevel = Number.isFinite(mob.max_level ?? mob.maxLevel) ? Number(mob.max_level ?? mob.maxLevel) : null;
      const rolledLevel = maxLevel && maxLevel > levelBase ? levelBase + Math.floor(Math.random() * (maxLevel - levelBase + 1)) : levelBase;
      return {
        ...mob,
        name: mob.name || 'Roamer',
        level: rolledLevel,
        hp: Number(mob.hp) || 1,
        mana: Number(mob.mana) || 0,
        endurance: Number(mob.endurance) || 0,
        damage: Number(mob.damage) || 1,
        xp: Number(mob.xp) || 0,
        ac: Number(mob.ac) || 0,
        delay: Number(mob.delay) || 2000,
        movespeed: Number(mob.movespeed) || 1,
        melee_range: Number(mob.melee_range) || 10,
        aggro_range: Number(mob.aggro_range) || 10,
        tags: mob.tags || [],
        race_id: mob.race_id ?? mob.raceId ?? null,
        gender: mob.gender ?? 0,
        texture_id: mob.texture_id ?? mob.textureId ?? 1
      };
    };

    const step = () => {
      if (!isTraveling) return;
      remaining -= tickDistance;

      if (ambushChance > 0 && Math.random() < ambushChance) {
        const mob = normalizeMob(pickMob());
        if (mob) {
          const mobSpeed = Math.max(0.1, mob.movespeed || 1);
          if (mobSpeed > playerSpeed) {
            setIsTraveling(false);
            travelTargetRef.current = null;
            setCurrentMob(mob);
            setMobHp(mob.hp);
            setMobMana(mob.mana);
            setMobEndurance(mob.endurance);
            setInCombat(true);
            setIsSitting(false);
            addLog(`You are ambushed by ${mob.name}!`, 'spawn');
            return;
          }
        }
      }

      if (remaining > 0) {
        travelTimerRef.current = setTimeout(step, tickMs);
        return;
      }

      // Arrive
      setIsTraveling(false);
      travelTargetRef.current = null;
      setCurrentCampId(camp.id);
      setCurrentMob(null);
      setMobHp(0);
      setMobMana(0);
      setMobEndurance(0);
      addLog(`You arrive at ${camp.name || 'camp'}.`, 'system');
    };

    travelTimerRef.current = setTimeout(step, tickMs);
  }, [blockIfHardcoreDead, campsByZone, currentZoneId, hasKeyItem, setCurrentCampId, setCurrentMob, setMobHp, setMobMana, setMobEndurance, addLog, isTraveling, playerEffectsState, getCampDistance, zones, getStatModifiers, campMembers, currentCampId, setInCombat, setIsSitting, setIsTraveling, travelTimerRef, travelTargetRef]);

  useEffect(() => {
    return () => {
      if (travelTimerRef.current) {
        clearTimeout(travelTimerRef.current);
      }
    };
  }, []);

  // canEquipItemInSlot imported from inventoryManager

  const handleRightClickStack = (slotIndex) => {
    if (blockIfHardcoreDead('split items')) return;

    const item = slots[slotIndex];
    if (!item || !item.stackable || item.quantity <= 1) return;

    // Split in half (rounded down)
    const splitQty = Math.floor(item.quantity / 2);
    const remainingQty = item.quantity - splitQty;

    setSlots((prev) => {
      const next = [...prev];

      // Find an empty inventory slot for the split stack
      const emptyIdx = next.findIndex((s, idx) => idx >= CARRY_START && !s);

      if (emptyIdx === -1) {
        addLog('No empty inventory slots to split stack!', 'error');
        return prev;
      }

      // Reduce the source stack
      next[slotIndex] = { ...item, quantity: remainingQty };

      // Create new stack in empty slot
      next[emptyIdx] = {
        ...item,
        quantity: splitQty,
        id: `${item.baseItemId}-${Date.now()}-${Math.random().toString(16).slice(2)}`
      };

      addLog(`Split ${item.name} into stacks of ${remainingQty} and ${splitQty}.`, 'system');

      slotsRef.current = next;
      scheduleSave({ inventory: true });
      return next;
    });
  };

  const handleSlotClick = (slotIndex) => {
    if (blockIfHardcoreDead('move items')) return;

    // If nothing is selected, select this slot
    if (selectedSlot === null) {
      const item = slots[slotIndex];
      if (item) {
        setSelectedSlot(slotIndex);
      }
      return;
    }

    // If clicking the same slot, deselect
    if (selectedSlot === slotIndex) {
      setSelectedSlot(null);
      return;
    }

    // Otherwise, try to move/swap items
    const sourceItem = slots[selectedSlot];
    const targetItem = slots[slotIndex];

    // Check if the source item can be equipped in the target slot
    if (!canEquipItemInSlot(sourceItem, slotIndex)) {
      addLog(`${sourceItem.name} cannot be equipped in that slot.`, 'error');
      setSelectedSlot(null);
      return;
    }

    // If swapping, check if target item can go in source slot
    if (targetItem && !canEquipItemInSlot(targetItem, selectedSlot)) {
      addLog(`Cannot swap: ${targetItem.name} cannot be equipped in that slot.`, 'error');
      setSelectedSlot(null);
      return;
    }

    setSlots((prev) => {
      const next = [...prev];

      // If target is empty, just move
      if (!targetItem) {
        next[slotIndex] = sourceItem;
        next[selectedSlot] = null;
      }
      // If both are the same stackable item, try to stack
      else if (
        sourceItem.stackable &&
        sourceItem.baseItemId === targetItem.baseItemId
      ) {
        const maxStack = targetItem.maxStack || 1;
        const currentQty = targetItem.quantity || 1;
        const sourceQty = sourceItem.quantity || 1;
        const canAdd = Math.min(sourceQty, maxStack - currentQty);

        if (canAdd > 0) {
          next[slotIndex] = { ...targetItem, quantity: currentQty + canAdd };
          const remaining = sourceQty - canAdd;
          if (remaining > 0) {
            next[selectedSlot] = { ...sourceItem, quantity: remaining };
          } else {
            next[selectedSlot] = null;
          }
        } else {
          // Stack is full, swap them
          next[slotIndex] = sourceItem;
          next[selectedSlot] = targetItem;
        }
      }
      // Otherwise, swap them
      else {
        next[slotIndex] = sourceItem;
        next[selectedSlot] = targetItem;
      }

      slotsRef.current = next;
      scheduleSave({ inventory: true });
      return next;
    });

    setSelectedSlot(null);
  };

  const changeZone = (zoneId) => {
    if (blockIfHardcoreDead('travel')) return;
    if (castingState) {
      addLog('You cannot travel while casting!', 'error');
      return;
    }
    if (inCombat) {
      addLog('You cannot travel while in combat!', 'error');
      return;
    }
    if (!availableZoneIds.includes(zoneId)) {
      addLog('You cannot travel there directly from this zone.', 'error');
      return;
    }
    setCurrentZoneId(zoneId);
    const zoneCamps = campsByZone[zoneId] || [];
    if (zoneCamps.length) {
      handleCampChange(zoneCamps[0].id, zoneId);
    } else {
      setCurrentCampId(null);
      setCurrentMob(null);
      setMobHp(0);
    }
    addLog(`You travel to ${zones[zoneId]?.name || zoneId}.`, 'system');
    setInCombat(false);
    setIsSitting(false);
    setIsAutoAttack(false);
    setCurrentMob(null);
    setMobHp(0);
    setFleeExhausted(false);
    scheduleSave({
      character: {
        level,
        xp,
        zone_id: zoneId,
        currency: { copper, silver, gold, platinum }
      }
    });

    if (autoAttackInterval.current) clearInterval(autoAttackInterval.current);
    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    if (fleeExhaustTimeout.current) clearTimeout(fleeExhaustTimeout.current);
  };

  const toggleAutoAttack = () => {
    if (blockIfHardcoreDead('toggle auto-attack')) return;
    setIsAutoAttack(!isAutoAttack);
    addLog(isAutoAttack ? 'Auto-attack disabled' : 'Auto-attack enabled', 'system');
  };

  // Ensure a camp is selected for the current zone before spawning
  useEffect(() => {
    if (!currentZoneId) return;
    const zoneCamps = campsByZone[currentZoneId] || [];
    if (!zoneCamps.length) return;
    if (!currentCampId) {
      handleCampChange(zoneCamps[0].id, currentZoneId);
    }
  }, [currentZoneId, currentCampId, campsByZone, handleCampChange]);

  useEffect(() => {
    const zoneCamps = campsByZone[currentZoneId] || [];
    if (!currentCampId || !zoneCamps.length) return;
    spawnMob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentZoneId, currentCampId, campsByZone]);

  // Regen driven by background tick to avoid hidden-tab throttling
  useEffect(() => {
    const now = tickSignal;
    const intervalMs = 3000;
    const last = lastRegenTickRef.current;
    const ticks = Math.floor((now - last) / intervalMs);
    if (ticks <= 0) return;
    lastRegenTickRef.current = last + ticks * intervalMs;

    const baseHp = inCombat ? 1 : 3;
    const hpPenalty = fleeExhausted ? 0.5 : 1;
    const sitBonus = isSitting && !inCombat ? 2 : 1;
    const hpGainPerTick = Math.max(1, Math.floor(baseHp * hpPenalty * sitBonus)) + (statTotals.hpRegen || 0);
    const hpGain = hpGainPerTick * ticks;
    setHp(prev => Math.min(maxHp, prev + hpGain));

    if (playerClass.isCaster) {
      const baseMana = isSitting ? 12 : inCombat ? 1 : 5;
      const manaPenalty = fleeExhausted ? 0.5 : 1;
      const manaGainPerTick = Math.max(1, Math.floor(baseMana * manaPenalty)) + (statTotals.manaRegen || 0);
      const manaGain = manaGainPerTick * ticks;
      setMana(prev => Math.min(maxMana, prev + manaGain));
    } else {
      const baseEnd = isSitting ? 12 : inCombat ? 1 : 5;
      const endPenalty = fleeExhausted ? 0.5 : 1;
      const endGainPerTick = Math.max(1, Math.floor(baseEnd * endPenalty)) + (statTotals.enduranceRegen || 0);
      const endGain = endGainPerTick * ticks;
      setEndurance(prev => Math.min(maxEndurance, prev + endGain));
    }
  }, [tickSignal, inCombat, isSitting, fleeExhausted, maxHp, maxMana, maxEndurance, playerClass.isCaster, statTotals.hpRegen, statTotals.manaRegen, statTotals.enduranceRegen]);

  useEffect(() => {
    (async () => {
      const { data } = await getSession();
      const next = data.session?.user || null;
      if (!next && forceGameViewRef.current) return;
      setUser(next);
    })();
    const { data: listener } = onAuthStateChange((_event, session) => {
      const next = session?.user || null;
      if (!next && forceGameViewRef.current) return;
      setUser(next);
    });
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Background tick worker to keep timers running when tab is hidden
  useEffect(() => {
    if (!user || !characterId) return;
    const workerCode = `
      let timer = null;
      const start = () => {
        if (timer) return;
        timer = setInterval(() => postMessage(Date.now()), 3000);
      };
      const stop = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
      self.onmessage = (e) => {
        if (e.data === 'start') start();
        if (e.data === 'stop') stop();
      };
      start();
    `;

    let workerUrl;
    let worker;
    let fallbackInterval;

    try {
      workerUrl = URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' }));
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => {
        if (typeof e.data === 'number') {
          setTickSignal(e.data);
        }
      };
      worker.postMessage('start');
    } catch (err) {
      console.error('Worker init failed, falling back to interval', err);
      fallbackInterval = setInterval(() => setTickSignal(Date.now()), 3000);
    }

    return () => {
      if (worker) {
        worker.postMessage('stop');
        worker.terminate();
      }
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [user, characterId]);

  useEffect(() => {
    if (!user) {
      if (forceGameViewRef.current) return;
      setCharacterId(null);
      setCharacters([]);
      setIsSelectingCharacter(false);
      setIsCreatingCharacter(false);
      setLoadError('');
      setKilledAt(null);
      return;
    }

    const loadCharacters = async () => {
      setIsProfileLoading(true);
      try {
        const list = await fetchCharacters(user.id);
        setCharacters(list);
        if (list.length === 1) {
          setCharacterId(list[0].id);
          setIsSelectingCharacter(false);
          setIsCreatingCharacter(false);
          setForceGameView(true);
        } else if (list.length === 0) {
          setIsSelectingCharacter(false);
          setIsCreatingCharacter(true);
        } else {
          if (!forceGameViewRef.current) {
            setIsSelectingCharacter(true);
            setIsCreatingCharacter(false);
          }
        }
        setLoadError('');
      } catch (err) {
        console.error(err);
        addLog('Failed to load characters.', 'error');
        setLoadError('Failed to load characters.');
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadCharacters();
  }, [user]);

  // Character loader hook
  useCharacterLoader({
    characterId,
    user,
    items,
    skills,
    classes,
    scheduleSave,
    setCharacterName,
    setPlayerClassKey,
    setMode,
    setKilledAt,
    setRaceId,
    setDeityId,
    setLevel,
    setXp,
    setCurrentCampId,
    setCurrentMob,
    setMobHp,
    setMobMana,
    setMobEndurance,
    setInCombat,
    setIsSitting,
    setIsAutoAttack,
    setFleeExhausted,
    setSkillCooldowns,
    setPlayerEffects,
    setMobEffects,
    setCurrentZoneId,
    setBindZoneId,
    setCopper,
    setSilver,
    setGold,
    setPlatinum,
    setKnownSkills,
    setBaseStats,
    setBaseVitals,
    setSlots,
    slotsRef,
    justLoadedRef,
    setMaxHp,
    setHp,
    setMaxMana,
    setMana,
    setMaxEndurance,
    setEndurance,
    setIsSelectingCharacter,
    setIsCreatingCharacter,
    setLoadError,
    setIsProfileLoading,
    addLog,
    setProfileHydrated,
    profileHydratedRef
  });

  const displayMinDamage = derivedStats.minDamage;
  const displayMaxDamage = derivedStats.maxDamage;

  // Skill slots hook
  const {
    abilitySlots: mergedAbilitySlots,
    spellSlots,
    abilityOptions,
    assignAbilityToSlot,
    assignSpellToSlot,
    clearAbilitySlot,
    clearSpellSlot
  } = useSkillSlots({
    isSitting,
    characterId,
    knownSkills,
    setKnownSkills,
    isAutoAttack,
    currentMob,
    mobHp,
    isSkillOnCooldown,
    handleUseSkill,
    autoAttackInterval,
    setAutoAttackChain
  });

  const pendingAutoBuffsRef = useRef(new Set());

  // Auto-apply long buffs slotted on spell bar; remove when unslotted
  useEffect(() => {
    if (!handleUseSkill || !setPlayerEffectsState) return;
    if (!Array.isArray(spellSlots)) return;

    // Cast any missing buffs
    spellSlots
      .filter((s) => s && s.effect_type === 'buff' && (s.duration_seconds || 0) > 20)
      .forEach((s) => {
        const already = playerEffectsState.some((e) => e.name === s.name);
        const pending = pendingAutoBuffsRef.current.has(s.name);
        if (!already && !pending) {
          pendingAutoBuffsRef.current.add(s.name);
          handleUseSkill(s);
        }
      });
  }, [spellSlots, handleUseSkill, setPlayerEffectsState, playerEffectsState]);

  useEffect(() => {
    const activeNames = new Set(playerEffectsState.map((e) => e.name));
    pendingAutoBuffsRef.current.forEach((name) => {
      if (activeNames.has(name)) {
        pendingAutoBuffsRef.current.delete(name);
      }
    });
  }, [playerEffectsState]);


  const handleAuthSubmit = async ({ email, password, isLogin, onStatus }) => {
    try {
      onStatus('Working...');
      const fn = isLogin ? signIn : signUp;
      const { error } = await fn(email, password);
      if (error) {
        onStatus(error.message);
      } else {
        onStatus('Success! Check your email if using signup.');
      }
    } catch (err) {
      onStatus(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setForceGameView(false);
    setUser(null);
    window.location.reload();
  };

  const handleSelectCharacter = (id) => {
    setCharacterId(id);
    const found = characters.find((c) => c.id === id);
    if (found?.name) setCharacterName(found.name);
    setIsSelectingCharacter(false);
    setIsCreatingCharacter(false);
    setForceGameView(true);
  };

  const handleDeleteCharacter = async (id) => {
    try {
      await deleteCharacter(user.id, id);
      const updated = characters.filter(c => c.id !== id);
      setCharacters(updated);
      if (characterId === id) {
        setCharacterId(null);
        setIsSelectingCharacter(true);
      }
    } catch (err) {
      console.error(err);
      addLog('Failed to delete character.', 'error');
    }
  };

  const handleCreateCharacter = async ({ name, classKey, raceId: newRaceId, deityId: newDeityId, mode: newMode, stats = {} }) => {
    if (!user) return;
    if (characters.length >= 6) {
      addLog('All 6 character slots are used.', 'error');
      return;
    }
    const startingZone = getStartingZoneId(newRaceId);
    if (!startingZone) {
      addLog('Race has no home zone configured.', 'error');
      return;
    }
    const playerClassDef = classes[classKey] || {};
    const raceDef = raceMap[newRaceId] || {};
    const deityDef = deityMap[newDeityId] || {};

    const classMods = playerClassDef.baseMods || {};
    const raceMods = extractBaseMods(raceDef);
    const deityMods = extractBaseMods(deityDef);

    const finalStats = {
      str: (stats.str || 0) + (classMods.str || 0) + (raceMods.str || 0) + (deityMods.str || 0),
      sta: (stats.sta || 0) + (classMods.sta || 0) + (raceMods.sta || 0) + (deityMods.sta || 0),
      agi: (stats.agi || 0) + (classMods.agi || 0) + (raceMods.agi || 0) + (deityMods.agi || 0),
      dex: (stats.dex || 0) + (classMods.dex || 0) + (raceMods.dex || 0) + (deityMods.dex || 0),
      int: (stats.int || 0) + (classMods.int || 0) + (raceMods.int || 0) + (deityMods.int || 0),
      wis: (stats.wis || 0) + (classMods.wis || 0) + (raceMods.wis || 0) + (deityMods.wis || 0),
      cha: (stats.cha || 0) + (classMods.cha || 0) + (raceMods.cha || 0) + (deityMods.cha || 0)
    };

    const baseHpVal =
      (playerClassDef.baseHp || 0) + (classMods.hp || 0) + (raceMods.hp || 0) + (deityMods.hp || 0);
    const baseManaVal =
      (playerClassDef.baseMana || 0) + (classMods.mana || 0) + (raceMods.mana || 0) + (deityMods.mana || 0);
    const baseEndVal =
      (playerClassDef.baseEndurance || 0) +
      (classMods.endurance || 0) +
      (raceMods.endurance || 0) +
      (deityMods.endurance || 0);
    const combinedXpMult = buildCharacterXpMod({
      classMod: playerClassDef.xpModRaw ?? playerClassDef.class_xp_mod,
      raceMod: raceMap[newRaceId]?.xpRaw ?? 100,
      deityMod: deityMap[newDeityId]?.xpRaw ?? 100
    });
    const combinedXpModInt = toHundredScale(combinedXpMult * 100, 100);
    try {
      const newChar = await createCharacter(user.id, {
        name,
        class: classKey,
      class_id: classKey,
      race_id: newRaceId,
      deity_id: newDeityId,
      zone_id: startingZone,
      bind_zone_id: startingZone,
      currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
        mode: newMode || mode,
        str_base: finalStats.str || 0,
        sta_base: finalStats.sta || 0,
        agi_base: finalStats.agi || 0,
        dex_base: finalStats.dex || 0,
        int_base: finalStats.int || 0,
        wis_base: finalStats.wis || 0,
        cha_base: finalStats.cha || 0,
        base_hp: baseHpVal,
        base_mana: baseManaVal,
        base_endurance: baseEndVal,
        xp_mod: combinedXpModInt
      });
      const updated = [...characters, newChar];
      setCharacters(updated);
      setCharacterId(newChar.id);
      setCharacterName(newChar.name || '');
      setBaseStats({
        str: finalStats.str || 0,
        sta: finalStats.sta || 0,
        agi: finalStats.agi || 0,
        dex: finalStats.dex || 0,
        int: finalStats.int || 0,
        wis: finalStats.wis || 0,
        cha: finalStats.cha || 0
      });
      setBaseVitals({
        hp: baseHpVal,
        mana: baseManaVal,
        endurance: baseEndVal
      });
    } catch (err) {
      console.error(err);
      addLog('Failed to create character.', 'error');
    }
  };

  const showGame = Boolean(forceGameView && characterId);

  return (
    <div className="shell">
      <div className="wrap">
        {interactions.interaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="relative bg-slate-900 border-2 border-blue-900 rounded-lg p-4 w-full max-w-4xl">
              <button
                onClick={interactions.closeInteraction}
                className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-slate-800 border border-blue-900 text-gray-200 hover:border-blue-600"
              >
                Close
              </button>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-1 bg-slate-800/60 border border-blue-900 rounded p-3 flex flex-col items-center">
                  <div className="text-sm text-gray-300 mb-2">{interactions.interaction.npc?.name || 'NPC'}</div>
                  <div className="w-full h-48 bg-slate-900 rounded flex items-center justify-center overflow-hidden">
                    <img
                      src={getNpcPortrait(interactions.interaction.npc)}
                      alt={interactions.interaction.npc?.name || 'NPC'}
                      onError={(e) => { e.target.src = '/stone-ui/raceimages/0_0_1_0.jpg'; }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 bg-slate-800/60 border border-blue-900 rounded p-3">
                  {interactions.interaction.type === 'merchant' ? (
                    <MerchantPanel
                      npc={interactions.interaction.npc}
                      merchantId={interactions.interaction.merchantId}
                      stock={merchantStockState[interactions.interaction.merchantId] || []}
                      items={items}
                      currency={{ copper, silver, gold, platinum }}
                      playerInventory={flatInventory}
                      getBuyPrice={getBuyPrice}
                      getSellPrice={getSellPrice}
                      onBuy={handleBuyFromMerchant}
                      onSell={handleSellToMerchant}
                      onClose={interactions.closeInteraction}
                    />
                  ) : (
                    <BankPanel
                      npc={interactions.interaction.npc}
                      bankSlots={interactions.bankSlots}
                      items={items}
                      playerInventory={flatInventory}
                      onWithdraw={handleWithdrawBank}
                      onDeposit={handleDepositToBank}
                      onClose={interactions.closeInteraction}
                      isLoading={interactions.isBankLoading}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="head">
          <div className="head-left">
            <h1>GrindQuest</h1>
            <p>An EverQuest Idle Adventure</p>
          </div>
          {user && (
            <div className="head-actions">
              <button
                onClick={() => {
                  setForceGameView(false);
                  setIsSelectingCharacter(true);
                  setIsCreatingCharacter(false);
                }}
                className="btn"
              >
                Character Select
              </button>
              <button
                onClick={() => {
                  setIsSelectingCharacter(false);
                  setIsCreatingCharacter(false);
                }}
                className="btn"
              >
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="btn"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {!user && (
          <AuthPanel onSignIn={handleAuthSubmit} />
        )}

        {user && isProfileLoading && (
          <div className="text-center text-gray-300">Loading your character...</div>
        )}

        {loadError && (
          <div className="text-center text-red-300 mb-4 text-sm">{loadError}</div>
        )}

        {user && !isProfileLoading && !showGame && isSelectingCharacter && (
          <CharacterSelectPanel
            characters={characters}
            onSelect={handleSelectCharacter}
            onCreateClick={() => setIsCreatingCharacter(true)}
            onDelete={handleDeleteCharacter}
            classNameMap={classNameMap}
            raceMap={raceMap}
            deityMap={deityMap}
          />
        )}

        {user && !isProfileLoading && !showGame && isCreatingCharacter && (
          <div className="space-y-4">
            <CharacterCreatePanel
              classesData={classes}
              races={races}
              deities={deities}
              raceClassAllowed={raceClassAllowed}
              deityClassAllowed={deityClassAllowed}
              onCreate={handleCreateCharacter}
            />
            <div className="text-center">
              <button
                onClick={() => setIsCreatingCharacter(false)}
                className="btn"
              >
                Back to selection
              </button>
            </div>
          </div>
        )}

        {showGame && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <CharacterPanel
              characterName={characterName}
              playerClass={playerClass}
              level={level}
              hp={hp}
              maxHp={maxHp}
              mana={mana}
              maxMana={maxMana}
              endurance={endurance}
              maxEndurance={maxEndurance}
              xp={xp}
              xpNeeded={xpNeeded}
              inCombat={inCombat}
              isMeditating={isSitting}
              hpRegenRate={getHpRegenRate()}
              manaRegenRate={getManaRegenRate()}
              enduranceRegenRate={getEnduranceRegenRate()}
              fleeExhausted={fleeExhausted}
              damageRange={{ min: displayMinDamage, max: displayMaxDamage }}
              gearBonuses={displayBonuses}
              inventoryLength={itemsFoundCount}
              attackDelay={derivedStats.attackDelay}
              derivedStats={derivedStats}
              raceName={raceName}
              deityName={deityName}
              currency={{ copper, silver, gold, platinum }}
              inventoryPreview={inventoryPreview}
              onInspectItem={setInspectedItem}
              onSlotClick={handleSlotClick}
              onSlotRightClick={handleRightClickStack}
              onInventoryOpen={() => setIsInventoryModalOpen(true)}
              selectedSlot={selectedSlot}
              effects={playerEffects}
            />
          </div>

          <div className="space-y-6">
            <CombatConsole
              currentMob={currentMob}
              mobHp={mobHp}
              level={level}
              hp={hp}
              maxHp={maxHp}
              mana={mana}
              maxMana={maxMana}
              endurance={endurance}
              maxEndurance={maxEndurance}
              inCombat={inCombat}
              playerClass={playerClass}
              characterName={characterName}
              toggleAutoAttack={toggleAutoAttack}
              isAutoAttack={isAutoAttack}
              isSitting={isSitting}
              abilitySlots={mergedAbilitySlots}
              spellSlots={spellSlots}
              knownAbilities={abilityOptions}
              knownSpells={knownSkills.filter((s) => s.type === 'spell')}
              onAssignAbility={assignAbilityToSlot}
              onAssignSpell={assignSpellToSlot}
              onClearAbility={clearAbilitySlot}
              onClearSpell={clearSpellSlot}
              onUseSkill={handleUseSkill}
              cooldowns={skillCooldowns}
              now={cooldownTick}
              combatLog={combatLog}
              castingState={castingState}
              effects={playerEffects}
              mobEffects={mobEffects}
            />
          </div>

          <div className="space-y-6">
            <ZonePanel
              zones={zones}
              currentZoneId={currentZoneId}
              onZoneChange={changeZone}
              availableZoneIds={availableZoneIds}
              camps={currentZoneCamps}
              currentCampId={currentCampId}
              onCampChange={handleCampChange}
              mobDistance={mobDistance}
              campArea={currentCamp?.camp_area ?? 0}
              zoneArea={zones[currentZoneId]?.zone_area ?? 0}
              characterName={characterName}
              userId={user?.id}
            />
            <HardcoreLeaderboard
              classNameMap={classNameMap}
              raceMap={raceMap}
              deityMap={deityMap}
            />
          </div>
        </div>
        )}
      </div>
      {inspectedItem && (
        <div className="stone-inspect-overlay" onClick={() => setInspectedItem(null)}>
          <div className="stone-inspect-card" onClick={(e) => e.stopPropagation()}>
            <div className="stone-inspect-title">
              {typeof inspectedItem.iconIndex === 'number' && (
                <EqIcon index={inspectedItem.iconIndex} size={24} cols={6} sheet="/stone-ui/itemicons/items1.png" />
              )}
              <span>{inspectedItem.name}</span>
              {inspectedItem.quantity > 1 && <span className="stone-slot__qty">x{inspectedItem.quantity}</span>}
            </div>
            <div className="stone-inspect-stats">
              {inspectedItem.slot && <div>Slot: {inspectedItem.slot}</div>}
              {inspectedItem.bonuses && (
                <div>
                  {Object.entries(inspectedItem.bonuses)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>{`${k.toUpperCase()}: ${v}`}</div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isInventoryModalOpen && (
        <InventoryModal
          slots={slots}
          onSlotClick={handleSlotClick}
          onSlotRightClick={handleRightClickStack}
          onInspectItem={setInspectedItem}
          onClose={() => setIsInventoryModalOpen(false)}
          selectedSlot={selectedSlot}
        />
      )}
    </div>
  );
}
