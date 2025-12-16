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
  deleteCharacter,
  loadCharacter,
  saveSpellSlots
} from './services/playerStorage';
import CharacterSelectPanel from './components/CharacterSelectPanel';
import CharacterCreatePanel from './components/CharacterCreatePanel';
import EqIcon from './components/EqIcon';
import { useReferenceData } from './hooks/useReferenceData';

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
  const [hardcoreLeaderboard, setHardcoreLeaderboard] = useState([]);
  const [normalLeaderboard, setNormalLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [characterName, setCharacterName] = useState('');
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
  const slotOrder = [
    'head',
    'face',
    'ear1',
    'ear2',
    'neck',
    'shoulders',
    'arms',
    'wrist1',
    'wrist2',
    'hands',
    'chest',
    'back',
    'waist',
    'legs',
    'feet',
    'finger1',
    'finger2',
    'primary',
    'secondary',
    'range',
    'ammo',
    'charm',
    'inv1',
    'inv2',
    'inv3',
    'inv4',
    'inv5',
    'inv6',
    'inv7',
    'inv8'
  ];
  const CARRY_START = slotOrder.indexOf('inv1');
  const [currentMob, setCurrentMob] = useState(null);
  const [mobHp, setMobHp] = useState(0);
  const [isAutoAttack, setIsAutoAttack] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [slots, setSlots] = useState(Array(slotOrder.length).fill(null));
  const [inCombat, setInCombat] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [fleeExhausted, setFleeExhausted] = useState(false);

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
  const currentRunEntry = useMemo(() => {
    const progress = xpNeeded > 0 ? xp / xpNeeded : 0;
    return {
      name: characterName || 'Unknown',
      level,
      xp,
      xpNeeded,
      progress,
      race: raceName || 'Unknown',
      classId: playerClassKey,
      className: classNameMap[playerClassKey] || playerClassKey,
      deity: deityName || 'None',
      mode,
      timestamp: Date.now()
    };
  }, [characterName, classNameMap, deityName, level, mode, playerClassKey, raceName, xp, xpNeeded]);
  const displayedNormalRuns = useMemo(() => {
    return mode === 'normal' ? [currentRunEntry, ...normalLeaderboard] : normalLeaderboard;
  }, [currentRunEntry, mode, normalLeaderboard]);
  const displayedHardcoreRuns = useMemo(() => {
    return mode === 'hardcore' ? [currentRunEntry, ...hardcoreLeaderboard] : hardcoreLeaderboard;
  }, [currentRunEntry, hardcoreLeaderboard, mode]);

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
      bagSlots: data.bagslots || data.bagSlots || 0
    };
  };

  const totalBonuses = useMemo(() => {
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
        ac: acc.ac + (item.bonuses?.ac || 0)
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
      ac: 0
    }
  );
}, [slots, CARRY_START]);

  const statTotals = useMemo(() => ({
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
    pr: totalBonuses.pr || 0
  }), [baseStats, totalBonuses]);

  const displayBonuses = useMemo(() => ({
    ...totalBonuses,
    ...statTotals
  }), [totalBonuses, statTotals]);

  const derivedStats = useMemo(() => {
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
    return {
      minDamage,
      maxDamage,
      attackDelay,
      strMod,
      hpFromSta,
      manaFromStats,
      enduranceFromSta,
      spellDmgMod: Math.floor((totalBonuses.int || 0) / 10),
      healMod: Math.floor((statTotals.wis || 0) / 10),
      xpBonus: totalBonuses.xp || 0,
      totalResist: totalBonuses.totalResist || 0,
      carryCap: statTotals.str || 0
    };
  }, [playerClass.attackSpeed, playerClass.baseDamage, totalBonuses, statTotals, level]);

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

  const getResistValue = (school = 'magic') => {
    const map = {
      poison: statTotals.pr || 0,
      disease: statTotals.dr || 0,
      fire: statTotals.fr || 0,
      cold: statTotals.cr || 0,
      magic: statTotals.mr || 0
    };
    return map[school] || 0;
  };

  const mitigateSpellDamage = (baseAmount, school = 'magic') => {
    const resistVal = getResistValue(school);
    const afterResist = Math.max(0, baseAmount - resistVal);
    const totalPct = derivedStats.totalResist || 0;
    const afterTotal = Math.max(0, Math.floor(afterResist * (1 - totalPct / 100)));
    return {
      final: afterTotal,
      resistReduced: baseAmount - afterResist,
      totalReduced: afterResist - afterTotal
    };
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
        const last = prev[prev.length - 1];
        if (last && last.message === message && last.type === type) {
          return prev;
      }
      const entry = { message, type, id: Date.now() };
      lastLogRef.current = entry;
      return [...prev.slice(-5), entry];
    });
  };

  const spawnMob = (campId = currentCampId) => {
    const mobList = campMembers[campId] || [];
    if (!mobList.length) {
      addLog('No mobs available in this zone.', 'error');
      return;
    }
    const mob = mobList[Math.floor(Math.random() * mobList.length)] || {};
    const normalizedMob = {
      ...mob,
      name: mob.name || 'Unknown',
      hp: Number(mob.hp) || 1,
      mana: Number(mob.mana) || 0,
      endurance: Number(mob.endurance) || Number(mob.end) || 0,
      damage: Number(mob.damage) || 1,
      xp: Number(mob.xp) || 0,
      ac: Number(mob.ac) || 0
    };
    setCurrentMob(normalizedMob);
    setMobHp(normalizedMob.hp);
    addLog(`${normalizedMob.name} spawns!`, 'spawn');
  };

  const handleMobDeath = () => {
    if (!currentMob) return;
    addLog(`${currentMob.name} has been slain!`, 'kill');
    const baseXp = currentMob.xp;
    const xpBonusPct = derivedStats.xpBonus || 0;
    const bonusMultiplier = 1 + xpBonusPct / 100;
    const xpGain = Math.floor(baseXp * bonusMultiplier);
    const bonusPart = xpGain - baseXp;
    const newXp = xp + xpGain;
    setXp(newXp);
    if (bonusPart > 0) {
      addLog(`You gain ${xpGain} experience! (+${bonusPart} bonus)`, 'xp');
    } else {
      addLog(`You gain ${xpGain} experience!`, 'xp');
    }
    scheduleSave({
      character: {
        level,
        xp: newXp,
        zone_id: currentZoneId,
        currency: { copper, silver, gold, platinum }
      },
      inventory: true
    });

    if (newXp >= xpNeeded) {
      setLevel(level + 1);
      setXp(newXp - xpNeeded);
      addLog(`You have gained a level! You are now level ${level + 1}!`, 'levelup');
      scheduleSave({
        character: {
          level: level + 1,
          xp: newXp - xpNeeded,
          zone_id: currentZoneId,
          currency: { copper, silver, gold, platinum }
        },
        inventory: true
      });
    }

    const lootTable = lootTables[currentMob.lootTableId] || [];
    lootTable.forEach((entry) => {
      if (entry.drop_chance == null) return;
      const def = items[entry.item_id];
      if (Math.random() <= entry.drop_chance) {
        const qtyMin = entry.min_qty || 1;
        const qtyMax = entry.max_qty || qtyMin;
        const qty = Math.max(qtyMin, Math.ceil(Math.random() * qtyMax));
        const item = createItemInstance(def.id);
        addItemToInventory(item, qty);
        addLog(`You receive: ${def.name}${qty > 1 ? ` x${qty}` : ''}`, 'loot');
      }
    });

    setTimeout(() => spawnMob(), 1000);
    setInCombat(false);
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

  const handleCampChange = useCallback((campId, zoneIdOverride = null) => {
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
  }, [campsByZone, currentZoneId, hasKeyItem]);

  useEffect(() => {
    if (!currentZoneId && initialZoneId) {
      setCurrentZoneId(initialZoneId);
      const zoneCamps = campsByZone[initialZoneId] || [];
      if (zoneCamps.length) {
        handleCampChange(zoneCamps[0].id, initialZoneId);
      }
    }
  }, [currentZoneId, initialZoneId, campsByZone, handleCampChange]);

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
    const addQty = Math.max(1, qty || 1);
    setSlots((prev) => {
      const next = [...prev];

      for (let i = CARRY_START; i < next.length; i += 1) {
        const slot = next[i];
        if (slot && slot.baseItemId === item.baseItemId) {
          next[i] = { ...slot, quantity: (slot.quantity || 1) + addQty };
          slotsRef.current = next;
          scheduleSave({ inventory: true });
          return next;
        }
      }

      const emptyIdx = next.findIndex((s, idx) => idx >= CARRY_START && !s);
      if (emptyIdx !== -1) {
        const base = items[item.baseItemId];
        const bagSlots = base?.bagslots || base?.bagSlots || 0;
        next[emptyIdx] = { ...item, quantity: addQty, bagSlots, contents: bagSlots ? Array(bagSlots).fill(null) : null };
        slotsRef.current = next;
        scheduleSave({ inventory: true });
        return next;
      }

      // Try bags
      for (let i = 0; i < next.length; i += 1) {
        const bag = next[i];
        if (!bag || !bag.bagSlots || !bag.contents) continue;
        // stack inside bag
        const stackIdx = bag.contents.findIndex((c) => c && c.baseItemId === item.baseItemId);
        if (stackIdx !== -1) {
          const updatedBag = { ...bag, contents: [...bag.contents] };
          updatedBag.contents[stackIdx] = {
            ...updatedBag.contents[stackIdx],
            quantity: (updatedBag.contents[stackIdx].quantity || 1) + addQty
          };
          next[i] = updatedBag;
          slotsRef.current = next;
          scheduleSave({ inventory: true });
          return next;
        }
        const emptyBagIdx = bag.contents.findIndex((c) => !c);
        if (emptyBagIdx !== -1) {
          const updatedBag = { ...bag, contents: [...bag.contents] };
          updatedBag.contents[emptyBagIdx] = { ...item, quantity: addQty };
          next[i] = updatedBag;
          slotsRef.current = next;
          scheduleSave({ inventory: true });
          return next;
        }
      }

      addLog('Inventory full!', 'error');
      return prev;
    });
  };

  const changeZone = (zoneId) => {
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

  const handleDeath = (killerName = 'an enemy') => {
    if (isDeadRef.current) return;
    isDeadRef.current = true;

    const progress = xpNeeded > 0 ? xp / xpNeeded : 0;
    const runEntry = {
      name: characterName || 'Unknown',
      level,
      xp,
      xpNeeded,
      progress,
      race: raceName || 'Unknown',
      classId: playerClassKey,
      className: classNameMap[playerClassKey] || playerClassKey,
      deity: deityName || 'None',
      mode,
      timestamp: Date.now()
    };

    addLog(`You have been slain by ${killerName}!`, 'error');
    setInCombat(false);
    setIsSitting(false);
    setIsAutoAttack(false);
    setFleeExhausted(false);

    if (autoAttackInterval.current) clearInterval(autoAttackInterval.current);
    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    if (fleeExhaustTimeout.current) clearTimeout(fleeExhaustTimeout.current);

    setCurrentMob(null);
    setMobHp(0);

    if (mode === 'hardcore') {
      setHardcoreLeaderboard(prev => {
        const updated = [runEntry, ...prev];
        return updated
          .sort((a, b) => {
            const aProg = a.level + (a.progress || 0);
            const bProg = b.level + (b.progress || 0);
            return bProg - aProg;
          })
          .slice(0, 10);
      });
      setLevel(1);
      setXp(0);
      setHp(playerClass.baseHp);
      setMana(playerClass.baseMana);
      setCopper(0);
      setSilver(0);
      setGold(0);
      setPlatinum(0);
      const emptied = Array(slotOrder.length).fill(null);
      setSlots(emptied);
      slotsRef.current = emptied;
      scheduleSave({
        character: {
          level: 1,
          xp: 0,
          zone_id: initialZoneId,
          currency: { copper: 0, silver: 0, gold: 0, platinum: 0 }
        },
        inventory: true
      });
      setBoundLevel(1);
      addLog('Hardcore death! Reset to level 1.', 'system');
      addLog('Your run was added to the leaderboard.', 'system');
    } else {
      setNormalLeaderboard(prev => {
        const updated = [runEntry, ...prev];
        return updated
          .sort((a, b) => {
            const aProg = a.level + (a.progress || 0);
            const bProg = b.level + (b.progress || 0);
            return bProg - aProg;
          })
          .slice(0, 10);
      });
      setLevel(boundLevel);
      setXp(0);
      setHp(maxHp);
      setMana(maxMana);
      addLog(`You return to your bind at level ${boundLevel}.`, 'system');
      scheduleSave({
        character: {
          level: boundLevel,
          xp: 0,
          zone_id: currentZoneId,
          currency: { copper, silver, gold, platinum }
        },
        inventory: true
      });
    }

    setTimeout(() => {
      isDeadRef.current = false;
      spawnMob();
    }, 1000);
  };

  const attackMob = () => {
    if (!currentMob || mobHp <= 0) return;

    setInCombat(true);
    setIsSitting(false);

    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    combatTimeout.current = setTimeout(() => setInCombat(false), 6000);

    const base = Math.floor(derivedStats.minDamage + Math.random() * (derivedStats.maxDamage - derivedStats.minDamage + 1));
    const mitigation = Math.min(base - 1, Math.floor((currentMob.ac || 0) / 10));
    const damage = Math.max(1, base - mitigation);
    const newHp = Math.max(0, mobHp - damage);
    setMobHp(newHp);
    addLog(`You hit ${currentMob.name} for ${damage} damage!`, 'damage');

    if (newHp === 0) {
      handleMobDeath();
    } else {
      setTimeout(() => {
        if (newHp > 0) {
          const mobDamage = currentMob.damage;
          const dodgeChance = Math.min(0.3, (statTotals.agi || 0) * 0.002);
          if (Math.random() < dodgeChance) {
            addLog(`You dodge ${currentMob.name}'s attack!`, 'system');
            return;
          }
          const isSpell = currentMob.damage_type === 'spell' || currentMob.damageType === 'spell';
          const school = currentMob.damage_school || currentMob.damageSchool || 'magic';
          let finalMobDmg;
          if (isSpell) {
            const { final } = mitigateSpellDamage(mobDamage, school);
            finalMobDmg = Math.max(0, final);
          } else {
            const mitigation = Math.min(mobDamage - 1, Math.floor((totalBonuses.ac || 0) / 10));
            finalMobDmg = Math.max(1, mobDamage - mitigation);
          }
          setHp(prev => {
            const updatedHp = Math.max(0, prev - finalMobDmg);
            if (updatedHp === 0) {
              setTimeout(() => handleDeath(currentMob.name), 0);
            }
            return updatedHp;
          });
          addLog(`${currentMob.name} hits YOU for ${finalMobDmg} ${isSpell ? `${school} ` : ''}damage!`, 'mobattack');
        }
      }, 500);
    }
  };

  const toggleAutoAttack = () => {
    setIsAutoAttack(!isAutoAttack);
    addLog(isAutoAttack ? 'Auto-attack disabled' : 'Auto-attack enabled', 'system');
  };

  const fleeCombat = () => {
    if (!currentMob) return;

    const applyFleeDebuff = () => {
      setFleeExhausted(true);
      if (fleeExhaustTimeout.current) clearTimeout(fleeExhaustTimeout.current);
      fleeExhaustTimeout.current = setTimeout(() => setFleeExhausted(false), 10000);
      addLog('You feel exhausted from fleeing. Regen slowed briefly.', 'system');
    };

    const engaged = inCombat || mobHp < currentMob.hp;
    const runSpeed = playerClass.runSpeed ?? 1;
    let successChance = engaged ? 0.65 : 1;
    successChance = Math.min(0.95, Math.max(0.2, successChance + (runSpeed - 1) * 0.05));

    if (engaged && Math.random() > successChance) {
      addLog(`You fail to escape ${currentMob.name}!`, 'error');
      applyFleeDebuff();

      if (engaged) {
        const mobDamage = currentMob.damage;
        setHp(prev => {
          const updatedHp = Math.max(0, prev - mobDamage);
          if (updatedHp === 0) {
            setTimeout(() => handleDeath(currentMob.name), 0);
          }
          return updatedHp;
        });
        addLog(`${currentMob.name} strikes you as you flee for ${mobDamage} damage!`, 'mobattack');
      }
      return;
    }

    addLog(`You flee from ${currentMob.name}!`, 'flee');
    setInCombat(false);
    setIsSitting(false);
    if (autoAttackInterval.current) {
      clearInterval(autoAttackInterval.current);
      setIsAutoAttack(false);
    }

    applyFleeDebuff();

    spawnMob();
  };

  const toggleSit = () => {
    if (inCombat) {
      addLog('You cannot sit while in combat!', 'error');
      return;
    }
    setIsSitting(!isSitting);
    addLog(isSitting ? 'You stand up.' : 'You sit down to rest.', 'system');
  };

  useEffect(() => {
    spawnMob();
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

  useEffect(() => {
    if (!characterId || !user) return;
    if (!items || !Object.keys(items || {}).length) return;
    if (!skills || skills.length === 0) return;
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const { character, inventory: inv, spells: learnedRows } = await loadCharacter(characterId);
        const classKey = character.class_id || character.class || '';
        const loadedClass = classes[classKey] || {};
        setCharacterName(character.name || '');
        setPlayerClassKey(classKey);
        setMode(character.mode || 'normal');
        setRaceId(character.race_id || null);
        setDeityId(character.deity_id || null);
        setLevel(character.level);
        setXp(character.xp);
        setCurrentZoneId(character.zone_id || initialZoneId);
        setCopper(character.currency?.copper || 0);
        setSilver(character.currency?.silver || 0);
        setGold(character.currency?.gold || 0);
        setPlatinum(character.currency?.platinum || 0);
        const learned = (learnedRows || []).reduce((arr, row) => {
          const data = skills.find((s) => s.id === row.skill_id);
          if (!data) return arr;
          arr.push({
            ...data,
            ability_slot: row.ability_slot || 0,
            spell_slot: row.spell_slot || 0,
            scribe_slot: row.scribe_slot || 0,
            rank: row.rank || data.rank || 1,
            learned_at: row.learned_at
          });
          return arr;
        }, []);
        setKnownSkills(learned);
        setBaseStats({
          str: character.str_base || 0,
          sta: character.sta_base || 0,
          agi: character.agi_base || 0,
          dex: character.dex_base || 0,
          int: character.int_base || 0,
          wis: character.wis_base || 0,
          cha: character.cha_base || 0
        });
        const normalizedInv = (inv || []).map((row) => {
          const baseKey = row.base_item_id || row.baseItemId;
          const base = items[baseKey] || {};
          const bagSlots = base.bagslots || base.bagSlots || row.item_data?.bagslots || row.item_data?.bagSlots || 0;
          return {
            id: row.id || `${baseKey}-${Math.random().toString(16).slice(2)}`,
            baseItemId: base.id || baseKey,
            name: base.name || row.name || baseKey,
            slot: base.slot || row.slot || 'misc',
            bonuses: base.bonuses || {},
            iconIndex: base.iconIndex ?? null,
            quantity: row.quantity || 1,
            slot_id: row.slot_id || null,
            container_id: row.container_id || null,
            bagSlots,
            contents: bagSlots ? Array(bagSlots).fill(null) : null
          };
        });

        const nextSlots = Array(slotOrder.length).fill(null);
        const bagLookup = {};

        // place top-level items
        normalizedInv
          .filter((i) => !i.container_id)
          .forEach((item) => {
            const idx = item.slot_id ? slotOrder.indexOf(item.slot_id) : -1;
            const targetIdx = idx !== -1 ? idx : nextSlots.findIndex((s, i) => i >= CARRY_START && !s);
            if (targetIdx !== -1) {
              nextSlots[targetIdx] = item;
              bagLookup[item.id] = item;
            }
          });

        // place bag children
        normalizedInv
          .filter((i) => i.container_id)
          .forEach((child) => {
            const parent = bagLookup[child.container_id];
            if (!parent || !parent.contents) return;
            const slotNum = child.slot_id ? parseInt(String(child.slot_id).replace(/\D/g, ''), 10) : NaN;
            const pos =
              Number.isFinite(slotNum) && slotNum > 0 && slotNum <= parent.contents.length
                ? slotNum - 1
                : parent.contents.findIndex((c) => !c);
            if (pos === -1) return;
            parent.contents[pos] = child;
          });

        setSlots(nextSlots);
        slotsRef.current = nextSlots;
        justLoadedRef.current = true;
        setMaxHp(loadedClass.baseHp || 0);
        setHp(loadedClass.baseHp || 0);
        setMaxMana(loadedClass.baseMana || 0);
        setMana(loadedClass.baseMana || 0);
        const loadedEnd = loadedClass.isCaster ? 0 : (loadedClass.baseMana || 100);
        setMaxEndurance(loadedEnd);
        setEndurance(loadedEnd);
        setIsSelectingCharacter(false);
        setIsCreatingCharacter(false);
        setLoadError('');
        addLog('Profile loaded.', 'system');
      } catch (err) {
        console.error(err);
        addLog('Failed to load profile.', 'error');
        setLoadError('Failed to load profile. Please re-select a character.');
        setIsSelectingCharacter(true);
        setCharacterId(null);
      } finally {
        setIsProfileLoading(false);
      }
    };
    loadProfile();
  }, [characterId, user, initialZoneId]);

  const displayMinDamage = derivedStats.minDamage;
  const displayMaxDamage = derivedStats.maxDamage;

  const abilitySlotCount = 9;
  const spellSlotCount = 9;

  const builtInAbilities = useMemo(() => ([
    { id: 'builtin-attack', name: 'Attack', iconIndex: 0, type: 'builtin' },
    { id: 'builtin-auto', name: 'Auto', iconIndex: 1, type: 'builtin' },
    { id: 'builtin-sit', name: isSitting ? 'Stand' : 'Sit', iconIndex: 22, type: 'builtin' },
    { id: 'builtin-flee', name: 'Flee', iconIndex: 48, type: 'builtin' }
  ]), [isSitting]);

  const builtInAbilityMap = useMemo(
    () => builtInAbilities.reduce((acc, ability) => {
      acc[ability.id] = ability;
      return acc;
    }, {}),
    [builtInAbilities]
  );

  const [builtinAbilitySlots, setBuiltinAbilitySlots] = useState(() => {
    const base = Array(abilitySlotCount).fill(null);
    const defaults = ['builtin-attack', 'builtin-auto', 'builtin-sit', 'builtin-flee'];
    defaults.forEach((id, idx) => {
      if (idx < base.length) base[idx] = id;
    });
    return base;
  });

  const abilitySlots = useMemo(() => {
    const slots = Array(abilitySlotCount).fill(null);
    knownSkills
      .filter((s) => s.type !== 'spell')
      .forEach((s) => {
        const idx = (s.ability_slot || 0) - 1;
        if (idx >= 0 && idx < slots.length) {
          slots[idx] = s;
        }
      });
    return slots;
  }, [knownSkills, abilitySlotCount]);

  const mergedAbilitySlots = useMemo(() => {
    const combined = Array(abilitySlotCount).fill(null);
    abilitySlots.forEach((slot, idx) => { combined[idx] = slot; });
    builtinAbilitySlots.forEach((slotId, idx) => {
      if (slotId && builtInAbilityMap[slotId]) combined[idx] = builtInAbilityMap[slotId];
    });
    return combined;
  }, [abilitySlots, builtinAbilitySlots, abilitySlotCount, builtInAbilityMap]);

  const abilityOptions = useMemo(() => ([
    ...builtInAbilities,
    ...knownSkills.filter((s) => s.type !== 'spell')
  ]), [builtInAbilities, knownSkills]);

  useEffect(() => {
    const runAutoAbilities = () => {
      if (!currentMob || mobHp <= 0) return;
      const autoIdx = mergedAbilitySlots.findIndex((s) => s?.id === 'builtin-auto');
      if (autoIdx === -1) return;
      const autoChain = mergedAbilitySlots.slice(0, autoIdx);
      autoChain.forEach((skill) => {
        if (!skill) return;
        if (isSkillOnCooldown(skill)) return;
        handleUseSkill(skill);
      });
    };

    if (isAutoAttack && currentMob && mobHp > 0) {
      runAutoAbilities();
      autoAttackInterval.current = setInterval(() => {
        runAutoAbilities();
      }, 250);
    } else {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    }

    return () => {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    };
  }, [isAutoAttack, currentMob, mobHp, mergedAbilitySlots, derivedStats.attackDelay]);

  const spellSlots = useMemo(() => {
    const slots = Array(spellSlotCount).fill(null);
    knownSkills
      .filter((s) => s.type === 'spell')
      .forEach((s) => {
        const idx = (s.spell_slot || 0) - 1;
        if (idx >= 0 && idx < slots.length) {
          slots[idx] = s;
        }
      });
    return slots;
  }, [knownSkills, spellSlotCount]);

  const persistSlots = async (nextKnown) => {
    setKnownSkills(nextKnown);
    const abilityPayload = Array.from({ length: abilitySlotCount }).map((_, idx) => {
      const skill = nextKnown.find((s) => (s.type !== 'spell') && s.ability_slot === idx + 1);
      return skill ? { skill_id: skill.id, ability_slot: idx + 1 } : null;
    }).filter(Boolean);
    const spellPayload = Array.from({ length: spellSlotCount }).map((_, idx) => {
      const skill = nextKnown.find((s) => s.type === 'spell' && s.spell_slot === idx + 1);
      return skill ? { skill_id: skill.id, spell_slot: idx + 1 } : null;
    }).filter(Boolean);
    try {
      await saveSpellSlots(characterId, { abilitySlots: abilityPayload, spellSlots: spellPayload });
    } catch (err) {
      console.error('Failed to save spell slots', err);
    }
  };

  const assignAbilityToSlot = (slotIdx, skillId) => {
    if (builtInAbilityMap[skillId]) {
      setBuiltinAbilitySlots((prev) => {
        const next = [...prev];
        next.forEach((slotId, idx) => {
          if (slotId === skillId) next[idx] = null;
        });
        next[slotIdx - 1] = skillId;
        return next;
      });
      setKnownSkills((prev) => {
        const next = prev.map((s) => ({ ...s }));
        next.forEach((s) => {
          if (s.type !== 'spell' && s.ability_slot === slotIdx) s.ability_slot = 0;
        });
        persistSlots(next);
        return next;
      });
      return;
    }

    setBuiltinAbilitySlots((prev) => {
      const next = [...prev];
      next[slotIdx - 1] = null;
      return next;
    });

    setKnownSkills((prev) => {
      const next = prev.map((s) => ({ ...s }));
      // clear any skill currently in this slot
      next.forEach((s) => {
        if (s.type !== 'spell' && s.ability_slot === slotIdx) s.ability_slot = 0;
      });
      // clear existing slot of the chosen skill
      const skill = next.find((s) => s.id === skillId);
      if (skill) {
        if (skill.ability_slot) skill.ability_slot = 0;
        skill.ability_slot = slotIdx;
      }
      persistSlots(next);
      return next;
    });
  };

  const clearAbilitySlot = (slotIdx) => {
    setBuiltinAbilitySlots((prev) => {
      const next = [...prev];
      next[slotIdx - 1] = null;
      return next;
    });

    setKnownSkills((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next.forEach((s) => {
        if (s.type !== 'spell' && s.ability_slot === slotIdx) s.ability_slot = 0;
      });
      persistSlots(next);
      return next;
    });
  };

  const assignSpellToSlot = (slotIdx, skillId) => {
    setKnownSkills((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next.forEach((s) => {
        if (s.type === 'spell' && s.spell_slot === slotIdx) s.spell_slot = 0;
      });
      const skill = next.find((s) => s.id === skillId);
      if (skill) {
        if (skill.spell_slot) skill.spell_slot = 0;
        skill.spell_slot = slotIdx;
      }
      persistSlots(next);
      return next;
    });
  };

  const clearSpellSlot = (slotIdx) => {
    setKnownSkills((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next.forEach((s) => {
        if (s.type === 'spell' && s.spell_slot === slotIdx) s.spell_slot = 0;
      });
      persistSlots(next);
      return next;
    });
  };

  const builtInAbilityHandlers = {
    'builtin-attack': attackMob,
    'builtin-auto': () => setIsAutoAttack((prev) => !prev),
    'builtin-sit': toggleSit,
    'builtin-flee': fleeCombat
  };

  const isSkillOnCooldown = (skill) => {
    const until = skillCooldowns[skill.id];
    return until && until > Date.now();
  };

  const handleUseSkill = (skill) => {
    if (!skill) return;

    if (builtInAbilityHandlers[skill.id]) {
      builtInAbilityHandlers[skill.id]();
      if (skill.id === 'builtin-attack') {
        setSkillCooldowns((prev) => ({
          ...prev,
          [skill.id]: Date.now() + derivedStats.attackDelay
        }));
      }
      return;
    }

    if (isSkillOnCooldown(skill)) {
      addLog(`${skill.name} is on cooldown.`, 'error');
      return;
    }
    const costMana = (skill.resource_cost && skill.resource_cost.mana) || 0;
    const costEndurance = (skill.resource_cost && (skill.resource_cost.endurance || skill.resource_cost.stamina || 0)) || 0;
    if (costMana > mana) {
      addLog('Not enough mana.', 'error');
      return;
    }
    if (costEndurance > endurance) {
      addLog('Not enough endurance.', 'error');
      return;
    }
    if (costMana > 0) {
      setMana((m) => Math.max(0, m - costMana));
    }
    if (costEndurance > 0) {
      setEndurance((e) => Math.max(0, e - costEndurance));
    }
    if (skill.cooldown_seconds) {
      setSkillCooldowns((prev) => ({ ...prev, [skill.id]: Date.now() + skill.cooldown_seconds * 1000 }));
    }

    const effect = skill.effect || {};
    if (effect.type === 'damage') {
      if (!currentMob || mobHp <= 0) {
        addLog('No target to hit.', 'error');
        return;
      }
      setInCombat(true);
      setIsSitting(false);
      const base = effect.base || 0;
      const scaling = effect.scaling?.coef ? Math.floor((statTotals[effect.scaling.stat] || 0) * effect.scaling.coef) : 0;
      const spellModPct = (derivedStats.spellDmgMod || 0);
      const preMit = Math.max(1, Math.floor((base + scaling) * (1 + spellModPct / 100)));
      const mitigation = Math.min(preMit - 1, Math.floor((currentMob.ac || 0) / 10));
      const dmg = Math.max(1, preMit - mitigation);
      const newHp = Math.max(0, mobHp - dmg);
      setMobHp(newHp);
      addLog(`${skill.name} hits ${currentMob.name} for ${dmg} damage!`, 'damage');
      if (newHp === 0) {
        handleMobDeath();
      } else {
        setTimeout(() => {
          if (!currentMob) return;
          const mobDamage = currentMob.damage;
          const dodgeChance = Math.min(0.3, (statTotals.agi || 0) * 0.002);
          if (Math.random() < dodgeChance) {
            addLog(`You dodge ${currentMob.name}'s attack!`, 'system');
            return;
          }
          const isSpell = currentMob.damage_type === 'spell' || currentMob.damageType === 'spell';
          const school = currentMob.damage_school || currentMob.damageSchool || 'magic';
          let finalMobDmg;
          if (isSpell) {
            const { final } = mitigateSpellDamage(mobDamage, school);
            finalMobDmg = Math.max(0, final);
          } else {
            const mitigation = Math.min(mobDamage - 1, Math.floor((totalBonuses.ac || 0) / 10));
            finalMobDmg = Math.max(1, mobDamage - mitigation);
          }
          setHp(prev => {
            const updatedHp = Math.max(0, prev - finalMobDmg);
            if (updatedHp === 0) {
              setTimeout(() => handleDeath(currentMob.name), 0);
            }
            return updatedHp;
          });
          addLog(`${currentMob.name} hits YOU for ${finalMobDmg} ${isSpell ? `${school} ` : ''}damage!`, 'mobattack');
        }, 500);
      }
    } else if (effect.type === 'heal' || effect.type === 'hot') {
      const base = effect.base || effect.tick || 0;
      const healModPct = derivedStats.healMod || 0;
      const healAmount = Math.max(1, Math.floor(base * (1 + healModPct / 100)));
      setHp((prev) => Math.min(maxHp, prev + healAmount));
      addLog(`You cast ${skill.name} and heal for ${healAmount}!`, 'heal');
    } else {
      addLog(`${skill.name} used.`, 'system');
    }
  };

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
              characterName={characterName}
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
              hardcoreRuns={displayedHardcoreRuns}
              normalRuns={displayedNormalRuns}
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
    </div>
  );
}
