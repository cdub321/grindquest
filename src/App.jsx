import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import CharacterPanel from './components/CharacterPanel';
import ZonePanel from './components/ZonePanel';
import AuthPanel from './components/AuthPanel';
import CombatConsole from './components/CombatConsole';
import HardcoreLeaderboard from './components/HardcoreLeaderboard';
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
  deleteCharacter
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
import {
  calculateTotalBonuses,
  calculateStatTotals,
  calculateDerivedStats,
  calculateDisplayBonuses
} from './utils/statsCalculator';

export default function GrindQuest() {
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
    currentCampId,
    setCurrentCampId,
    initialZoneId
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
  const [boundLevel, setBoundLevel] = useState(1);
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

  const classes = useMemo(() => {
    return classCatalog.reduce((acc, cls) => {
      acc[cls.id] = {
        name: cls.name || cls.id || '',
        baseDamage: Number(cls.base_damage ?? cls.baseDamage ?? 0),
        baseHp: Number(cls.base_hp ?? cls.baseHp ?? 0),
        baseMana: Number(cls.base_mana ?? cls.baseMana ?? 0),
        attackSpeed: Number(cls.attack_speed ?? cls.attackSpeed ?? 0) || 0,
        isCaster: Boolean(cls.is_caster ?? cls.isCaster ?? false),
        runSpeed: Number(cls.run_speed ?? cls.runSpeed ?? 1) || 1
      };
      return acc;
    }, {});
  }, [classCatalog]);

  const classNameMap = useMemo(() => {
    return Object.entries(classes).reduce((acc, [id, cls]) => {
      acc[id] = cls.name || id;
      return acc;
    }, {});
  }, [classes]);

  const raceMap = useMemo(() => {
    return races.reduce((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});
  }, [races]);

  const deityMap = useMemo(() => {
    return deities.reduce((acc, d) => {
      acc[d.id] = d;
      return acc;
    }, {});
  }, [deities]);

  const playerClass = classes[playerClassKey] || {};
  const raceName = raceId ? raceMap[raceId]?.name : '';
  const deityName = deityId ? deityMap[deityId]?.name : '';
  const baseMaxHp = playerClass.baseHp || 0;
  const baseMaxMana = playerClass.baseMana || 0;
  const baseMaxEndurance = playerClass.isCaster ? 0 : playerClass.baseMana || 100;
  const [hp, setHp] = useState(baseMaxHp);
  const [maxHp, setMaxHp] = useState(baseMaxHp);
  const [mana, setMana] = useState(baseMaxMana);
  const [maxMana, setMaxMana] = useState(baseMaxMana);
  const [endurance, setEndurance] = useState(baseMaxEndurance);
  const [maxEndurance, setMaxEndurance] = useState(baseMaxEndurance);

  const [currentZoneId, setCurrentZoneId] = useState(initialZoneId);
  const currentZone = zones[currentZoneId] || { name: 'Unknown', mobs: [] };
  const currentZoneCamps = campsByZone[currentZoneId] || [];
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
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  const autoAttackInterval = useRef(null);
  const regenInterval = useRef(null);
  const combatTimeout = useRef(null);
  const isDeadRef = useRef(false);
  const fleeExhaustTimeout = useRef(null);
  const lastLogRef = useRef(null);
  const saveTimeout = useRef(null);
  const justLoadedRef = useRef(false);
  const prevMaxHpRef = useRef(0);
  const prevMaxManaRef = useRef(0);
  const prevMaxEnduranceRef = useRef(0);
  const slotsRef = useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const inventoryPreview = slots;
  const itemsFoundCount = useMemo(() => slots.reduce((count, item) => {
    if (!item) return count;
    const childCount = item.contents ? item.contents.filter(Boolean).length : 0;
    return count + 1 + childCount;
  }, 0), [slots]);

  const xpNeeded = level * 100;


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
      pr: (baseStatTotals.pr || 0) + (mods.pr || 0)
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

  const getHpRegenRate = () => {
    const base = inCombat ? 1 : 3;
    const penalty = fleeExhausted ? 0.5 : 1;
    const sitBonus = isSitting && !inCombat ? 2 : 1;
    return Math.max(1, Math.floor(base * penalty * sitBonus));
  };

  const getManaRegenRate = () => {
    if (!playerClass.isCaster) return 0;
    const base = isSitting ? 12 : inCombat ? 1 : 5;
    const penalty = fleeExhausted ? 0.5 : 1;
    return Math.max(1, Math.floor(base * penalty));
  };

  const getEnduranceRegenRate = () => {
    if (playerClass.isCaster) return 0;
    const base = isSitting ? 12 : inCombat ? 1 : 5;
    const penalty = fleeExhausted ? 0.5 : 1;
    return Math.max(1, Math.floor(base * penalty));
  };


  useEffect(() => {
    const t = setInterval(() => setCooldownTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const hpFromSta = (totalBonuses.sta || 0) * 5;
    const manaFromStats = ((totalBonuses.int || 0) + (totalBonuses.wis || 0)) * 2;
    const newMaxHp = baseMaxHp + totalBonuses.hp + hpFromSta;
    const newMaxMana = baseMaxMana + totalBonuses.mana + manaFromStats;
    const newMaxEndurance = playerClass.isCaster ? 0 : (baseMaxEndurance + totalBonuses.endurance + (derivedStats.enduranceFromSta || 0));
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
  }, [baseMaxHp, baseMaxMana, baseMaxEndurance, totalBonuses.hp, totalBonuses.mana, totalBonuses.endurance, totalBonuses.sta, totalBonuses.int, totalBonuses.wis, playerClass.isCaster, derivedStats.enduranceFromSta]);

  const addLog = (message, type = 'normal') => {
    setCombatLog(prev => {
      const entry = { message, type, id: Date.now() };
      lastLogRef.current = entry;
      return [...prev.slice(-5), entry];
    });
  };

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

  const scheduleSave = (payload) => {
    if (!user || !characterId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
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
    }, 500);
  };

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

  // Combat hook
  const {
    spawnMob,
    attackMob,
    handleMobDeath,
    handleDeath,
    fleeCombat,
    toggleSit: combatToggleSit,
    handleUseSkill,
    isSkillOnCooldown,
    getResistValue,
    mitigateSpellDamage,
    blockIfHardcoreDead,
    playerEffects,
    mobEffects,
    getStatModifiers,
    setAutoAttackChain
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
    boundLevel,

    // Stats - pass current statTotals (will be updated with modifiers)
    derivedStats,
    statTotals,
    totalBonuses,

    // Zone/Camp
    currentZoneId,
    setCurrentZoneId,
    initialZoneId,
    currentCampId,
    campMembers,

    // Loot/Items
    items,
    lootTables,
    addItemToInventory,
    createItemInstance,

    // Currency
    copper,
    silver,
    gold,
    platinum,

    // Cooldowns
    skillCooldowns,
    setSkillCooldowns,

    // Utils
    addLog,
    scheduleSave,
    xpNeeded,

    // Refs
    isDeadRef,
    combatTimeout,
    fleeExhaustTimeout
  });

  // Update getStatModifiers and playerEffects when useCombat provides them
  useEffect(() => {
    if (getStatModifiers) {
      setGetStatModifiersFn(() => getStatModifiers);
    }
  }, [getStatModifiers]);

  useEffect(() => {
    if (playerEffects) {
      setPlayerEffectsState(playerEffects);
    }
  }, [playerEffects]);

  const handleCampChange = useCallback((campId, zoneIdOverride = null) => {
    if (blockIfHardcoreDead('change camps')) return;
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
    setCurrentCampId(camp.id);
    setCurrentMob(null);
    setMobHp(0);
  }, [blockIfHardcoreDead, campsByZone, currentZoneId, hasKeyItem, setCurrentCampId, setCurrentMob, setMobHp, addLog]);

  useEffect(() => {
    if (!currentZoneId && initialZoneId) {
      setCurrentZoneId(initialZoneId);
      const zoneCamps = campsByZone[initialZoneId] || [];
      if (zoneCamps.length) {
        handleCampChange(zoneCamps[0].id, initialZoneId);
      }
    }
  }, [currentZoneId, initialZoneId, campsByZone, handleCampChange, setCurrentZoneId]);

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

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    addLog(
      nextMode === 'hardcore'
        ? 'Hardcore mode enabled: death will reset your run!'
        : 'Normal mode enabled: death returns you to your bind.',
      'system'
    );
  };


  const toggleAutoAttack = () => {
    if (blockIfHardcoreDead('toggle auto-attack')) return;
    setIsAutoAttack(!isAutoAttack);
    addLog(isAutoAttack ? 'Auto-attack disabled' : 'Auto-attack enabled', 'system');
  };

  useEffect(() => {
    spawnMob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentZoneId, currentCampId]);

  useEffect(() => {
    regenInterval.current = setInterval(() => {
      setHp(prev => {
        const hpGain = getHpRegenRate();
        return Math.min(maxHp, prev + hpGain);
      });

      if (playerClass.isCaster) {
        setMana(prev => {
          const manaGain = getManaRegenRate();
          return Math.min(maxMana, prev + manaGain);
        });
      } else {
        setEndurance(prev => {
          const endGain = getEnduranceRegenRate();
          return Math.min(maxEndurance, prev + endGain);
        });
      }
    }, 2000);

    return () => {
      if (regenInterval.current) {
        clearInterval(regenInterval.current);
      }
    };
  }, [inCombat, isSitting, maxHp, maxMana, maxEndurance, playerClass.isCaster, fleeExhausted]);

  useEffect(() => {
    (async () => {
      const { data } = await getSession();
      setUser(data.session?.user || null);
    })();
    const { data: listener } = onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
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
        } else if (list.length === 0) {
          setIsSelectingCharacter(false);
          setIsCreatingCharacter(true);
        } else {
          setIsSelectingCharacter(true);
          setIsCreatingCharacter(false);
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
    initialZoneId,
    setCharacterName,
    setPlayerClassKey,
    setMode,
    setKilledAt,
    setRaceId,
    setDeityId,
    setLevel,
    setXp,
    setCurrentZoneId,
    setCopper,
    setSilver,
    setGold,
    setPlatinum,
    setKnownSkills,
    setBaseStats,
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
    addLog
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
    setUser(null);
    window.location.reload();
  };

  const handleSelectCharacter = (id) => {
    setCharacterId(id);
    const found = characters.find((c) => c.id === id);
    if (found?.name) setCharacterName(found.name);
    setIsSelectingCharacter(false);
    setIsCreatingCharacter(false);
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
    try {
      const newChar = await createCharacter(user.id, {
        name,
        class: classKey,
        class_id: classKey,
        race_id: newRaceId,
        deity_id: newDeityId,
        zone_id: startingZone,
        currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
        mode: newMode || mode,
        str_base: stats.str || 0,
        sta_base: stats.sta || 0,
        agi_base: stats.agi || 0,
        dex_base: stats.dex || 0,
        int_base: stats.int || 0,
        wis_base: stats.wis || 0,
        cha_base: stats.cha || 0
      });
      const updated = [...characters, newChar];
      setCharacters(updated);
      setCharacterId(newChar.id);
      setCharacterName(newChar.name || '');
      setBaseStats({
        str: stats.str || 0,
        sta: stats.sta || 0,
        agi: stats.agi || 0,
        dex: stats.dex || 0,
        int: stats.int || 0,
        wis: stats.wis || 0,
        cha: stats.cha || 0
      });
    } catch (err) {
      console.error(err);
      addLog('Failed to create character.', 'error');
    }
  };

  return (
    <div className="shell">
      <div className="wrap">
        <div className="head">
          <div className="head-left">
            <h1>GrindQuest</h1>
            <p>An EverQuest Idle Adventure</p>
          </div>
          {user && (
            <div className="head-actions">
              <button
                onClick={() => {
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

        {user && !isProfileLoading && isSelectingCharacter && (
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

        {user && !isProfileLoading && isCreatingCharacter && (
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

        {user && !isProfileLoading && characterId && !isSelectingCharacter && !isCreatingCharacter && (
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
