import { useState, useEffect, useRef, useMemo } from 'react';
import classesData from './data/classes.json';
import zonesData from './data/zones.json';
import CharacterPanel from './components/CharacterPanel';
import InventoryPanel from './components/InventoryPanel';
import ZonePanel from './components/ZonePanel';
import CombatPanel from './components/CombatPanel';
import CombatLog from './components/CombatLog';
import InstructionsPanel from './components/InstructionsPanel';
import StatsPanel from './components/StatsPanel';
import FutureFeaturesPanel from './components/FutureFeaturesPanel';
import SkillsPanel from './components/SkillsPanel';
import DevPanel from './components/DevPanel';
import HardcoreLeaderboard from './components/HardcoreLeaderboard';
import EquipmentPanel from './components/EquipmentPanel';
import AuthPanel from './components/AuthPanel';
import { supabase } from './lib/supabaseClient';
import {
  signIn,
  signOut,
  signUp,
  onAuthStateChange,
  saveCharacter,
  saveInventory,
  saveEquipment,
  getSession,
  fetchCharacters,
  createCharacter,
  deleteCharacter,
  loadCharacter,
  fetchUserRole
} from './services/playerStorage';
import CharacterSelectPanel from './components/CharacterSelectPanel';
import CharacterCreatePanel from './components/CharacterCreatePanel';
import {
  fetchClassesCatalog,
  fetchDeities,
  fetchDeityClassAllowed,
  fetchItemsCatalog,
  fetchSkillsCatalog,
  fetchCamps,
  fetchZoneMobs,
  fetchZonesAndConnections,
  fetchRaceClassAllowed,
  fetchRaces
} from './services/referenceData';

export default function GrindQuest() {
  const [playerClassKey, setPlayerClassKey] = useState('warrior');
  const [classCatalog, setClassCatalog] = useState([]);
  const [races, setRaces] = useState([]);
  const [deities, setDeities] = useState([]);
  const [raceClassAllowed, setRaceClassAllowed] = useState([]);
  const [deityClassAllowed, setDeityClassAllowed] = useState([]);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [copper, setCopper] = useState(0);
  const [silver, setSilver] = useState(0);
  const [gold, setGold] = useState(0);
  const [platinum, setPlatinum] = useState(0);
  const [mode, setMode] = useState('normal');
  const [raceId, setRaceId] = useState(null);
  const [deityId, setDeityId] = useState(null);
  const [zones, setZones] = useState(zonesData);
  const [items, setItems] = useState({});
  const [skills, setSkills] = useState([]);
  const [zoneMobs, setZoneMobs] = useState({});
  const [campsByZone, setCampsByZone] = useState({});
  const [currentCampId, setCurrentCampId] = useState(null);
  const [boundLevel, setBoundLevel] = useState(1);
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [skillCooldowns, setSkillCooldowns] = useState({});
  const [cooldownTick, setCooldownTick] = useState(0);

  const classes = useMemo(() => {
    const merged = { ...classesData };
    classCatalog.forEach((cls) => {
      merged[cls.id] = {
        name: cls.name,
        baseDamage: cls.base_damage ?? cls.baseDamage ?? 5,
        baseHp: cls.base_hp ?? cls.baseHp ?? 100,
        baseMana: cls.base_mana ?? cls.baseMana ?? 0,
        attackSpeed: cls.attack_speed ?? cls.attackSpeed ?? 1000,
        isCaster: cls.is_caster ?? cls.isCaster ?? false,
        runSpeed: Number(cls.run_speed ?? cls.runSpeed ?? 1)
      };
    });
    return merged;
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

  const playerClass = classes[playerClassKey] || classesData[playerClassKey] || classesData.warrior;
  const baseMaxHp = playerClass.baseHp;
  const baseMaxMana = playerClass.baseMana;
  const [hp, setHp] = useState(baseMaxHp);
  const [maxHp, setMaxHp] = useState(baseMaxHp);
  const [mana, setMana] = useState(baseMaxMana);
  const [maxMana, setMaxMana] = useState(baseMaxMana);

  const zoneEntries = Object.entries(zones);
  const initialZoneId = zoneEntries[0]?.[0] || '';
  const [currentZoneId, setCurrentZoneId] = useState(initialZoneId);
  const currentZone = zones[currentZoneId] || { name: 'Unknown', mobs: [] };
  const currentZoneCamps = campsByZone[currentZoneId] || [];
  const equipSlots = ['weapon', 'chest', 'feet', 'waist', 'jewelry', 'hands', 'back', 'trinket'];
  const [currentMob, setCurrentMob] = useState(null);
  const [mobHp, setMobHp] = useState(0);
  const [isAutoAttack, setIsAutoAttack] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [equipment, setEquipment] = useState({
    weapon: null,
    chest: null,
    feet: null,
    waist: null,
    jewelry: null,
    hands: null,
    back: null,
    trinket: null
  });
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

  const xpNeeded = level * 100;

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [cls, rcs, dts, rcMap, dcMap, zonesResult, itemsResult, skillsResult, mobsResult, campsResult] = await Promise.all([
          fetchClassesCatalog(),
          fetchRaces(),
          fetchDeities(),
          fetchRaceClassAllowed(),
          fetchDeityClassAllowed(),
          fetchZonesAndConnections(),
          fetchItemsCatalog(),
          fetchSkillsCatalog(),
          fetchZoneMobs().catch(() => []),
          fetchCamps().catch(() => [])
        ]);
        setClassCatalog(cls || []);
        setRaces(rcs || []);
        setDeities(dts || []);
        setRaceClassAllowed(rcMap || []);
        setDeityClassAllowed(dcMap || []);
        if (itemsResult?.length) {
          const mapped = {};
          itemsResult.forEach((it) => {
            mapped[it.id] = {
              name: it.name,
              slot: it.slot,
              bonuses: {
                damage: it.damage || 0,
                delay: it.delay || null,
                haste: it.haste_bonus || 0,
                hp: it.hp_bonus || 0,
                mana: it.mana_bonus || 0,
                str: it.str_bonus || 0,
                sta: it.sta_bonus || 0,
                agi: it.agi_bonus || 0,
                dex: it.dex_bonus || 0,
                int: it.int_bonus || 0,
                wis: it.wis_bonus || 0,
                cha: it.cha_bonus || 0,
                mr: it.mr_bonus || 0,
                dr: it.dr_bonus || 0,
                fr: it.fr_bonus || 0,
                cr: it.cr_bonus || 0,
                pr: it.pr_bonus || 0,
                ac: it.ac_bonus || 0
              }
            };
            if (it.name && !mapped[it.name]) {
              mapped[it.name] = mapped[it.id];
            }
          });
          setItems(mapped);
        }
        if (skillsResult?.length) {
          setSkills(skillsResult);
        }
        if (mobsResult?.length) {
          const byZone = {};
          mobsResult.forEach((row) => {
            if (!byZone[row.zone_id]) byZone[row.zone_id] = [];
            byZone[row.zone_id].push({
              name: row.name,
              hp: row.hp,
              damage: row.damage,
              xp: row.xp,
              camp_id: row.camp_id || null,
              isNamed: row.is_named,
              tags: row.tags || [],
              ac: row.ac || 0,
              resists: {
                mr: row.mr || 0,
                fr: row.fr || 0,
                cr: row.cr || 0,
                pr: row.pr || 0,
                dr: row.dr || 0
              },
              lootTable: row.loot_table || []
            });
          });
          setZoneMobs(byZone);
        }
        if (zonesResult?.zones?.length) {
          const base = { ...zonesData };
          zonesResult.zones.forEach((z) => {
            base[z.id] = {
              ...(base[z.id] || {}),
              name: z.name,
              biome: z.biome,
              connections: []
            };
          });
          (zonesResult.connections || []).forEach((c) => {
            if (base[c.from_zone]) {
              base[c.from_zone].connections = base[c.from_zone].connections || [];
              base[c.from_zone].connections.push(c.to_zone);
            }
          });
          setZones(base);
        }
        if (campsResult?.length) {
          const grouped = campsResult.reduce((acc, c) => {
            acc[c.zone_id] = acc[c.zone_id] || [];
            acc[c.zone_id].push(c);
            return acc;
          }, {});
          setCampsByZone(grouped);
          // set default camp if current zone has camps
          const zoneCamps = grouped[initialZoneId] || [];
          if (zoneCamps.length) {
            setCurrentCampId(zoneCamps[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };
    loadReferenceData();
  }, []);

  const createItemInstance = (name) => {
    const data = items[name] || items[name?.toLowerCase?.()] || { slot: 'misc', bonuses: {} };
    return {
      id: `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: data.name || name,
      slot: data.slot || 'misc',
      bonuses: data.bonuses || {}
    };
  };

  const totalBonuses = useMemo(() => {
    return Object.values(equipment).reduce(
      (acc, item) => {
        if (!item) return acc;
        return {
          damage: acc.damage + (item.bonuses.damage || 0),
          delay: item.bonuses.delay ? item.bonuses.delay : acc.delay,
          haste: acc.haste + (item.bonuses.haste || 0),
          hp: acc.hp + (item.bonuses.hp || 0),
          mana: acc.mana + (item.bonuses.mana || 0),
          str: acc.str + (item.bonuses.str || 0),
          sta: acc.sta + (item.bonuses.sta || 0),
          agi: acc.agi + (item.bonuses.agi || 0),
          dex: acc.dex + (item.bonuses.dex || 0),
          int: acc.int + (item.bonuses.int || 0),
          wis: acc.wis + (item.bonuses.wis || 0),
          cha: acc.cha + (item.bonuses.cha || 0),
          mr: acc.mr + (item.bonuses.mr || 0),
          dr: acc.dr + (item.bonuses.dr || 0),
          fr: acc.fr + (item.bonuses.fr || 0),
          cr: acc.cr + (item.bonuses.cr || 0),
          pr: acc.pr + (item.bonuses.pr || 0),
          ac: acc.ac + (item.bonuses.ac || 0)
        };
      },
      {
        damage: 0,
        delay: null,
        haste: 0,
        hp: 0,
        mana: 0,
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
  }, [equipment]);

  const derivedStats = useMemo(() => {
    const strMod = Math.floor((totalBonuses.str || 0) / 10);
    const dexSpeedMod = Math.max(0.7, 1 - (totalBonuses.dex || 0) * 0.002);
    const hasteMod = Math.max(0.5, 1 - (totalBonuses.haste || 0) / 100);
    const baseDelay = totalBonuses.delay || playerClass.attackSpeed || 1000;
    const attackDelay = Math.max(300, Math.floor(baseDelay * dexSpeedMod * hasteMod));
    const minDamageBase = Math.floor(playerClass.baseDamage * (1 + level * 0.1));
    const minDamage = minDamageBase + strMod + (totalBonuses.damage || 0);
    const maxDamage = minDamage + 5;
    const hpFromSta = (totalBonuses.sta || 0) * 5;
    const manaFromStats = ((totalBonuses.int || 0) + (totalBonuses.wis || 0)) * 2;
    return {
      minDamage,
      maxDamage,
      attackDelay,
      strMod,
      hpFromSta,
      manaFromStats,
      spellDmgMod: Math.floor((totalBonuses.int || 0) / 10),
      healMod: Math.floor((totalBonuses.wis || 0) / 10),
      carryCap: totalBonuses.str || 0
    };
  }, [playerClass.attackSpeed, playerClass.baseDamage, totalBonuses, level]);

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

  useEffect(() => {
    const t = setInterval(() => setCooldownTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const hpFromSta = (totalBonuses.sta || 0) * 5;
    const manaFromStats = ((totalBonuses.int || 0) + (totalBonuses.wis || 0)) * 2;
    const newMaxHp = baseMaxHp + totalBonuses.hp + hpFromSta;
    const newMaxMana = baseMaxMana + totalBonuses.mana + manaFromStats;
    setMaxHp(newMaxHp);
    if (justLoadedRef.current) {
      setHp(newMaxHp);
    } else {
      setHp(prev => Math.min(newMaxHp, prev));
    }
    setMaxMana(newMaxMana);
    if (justLoadedRef.current) {
      setMana(newMaxMana);
      justLoadedRef.current = false;
    } else {
      setMana(prev => Math.min(newMaxMana, prev));
    }
  }, [baseMaxHp, baseMaxMana, totalBonuses.hp, totalBonuses.mana, totalBonuses.sta, totalBonuses.int, totalBonuses.wis]);

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

  const spawnMob = () => {
    const mobList = (zoneMobs[currentZoneId] || currentZone.mobs || []).filter((m) => {
      if (!currentCampId) return true;
      const campId = m.camp_id || m.campId;
      return campId ? campId === currentCampId : true;
    });
    if (!mobList.length) {
      addLog('No mobs available in this zone.', 'error');
      return;
    }
    const mob = mobList[Math.floor(Math.random() * mobList.length)];
    setCurrentMob(mob);
    setMobHp(mob.hp);
    addLog(`${mob.name} spawns!`, 'spawn');
  };

  const handleMobDeath = () => {
    if (!currentMob) return;
    addLog(`${currentMob.name} has been slain!`, 'kill');
    const xpGain = currentMob.xp;
    const newXp = xp + xpGain;
    setXp(newXp);
    addLog(`You gain ${xpGain} experience!`, 'xp');
    scheduleSave({
      character: {
        level,
        xp: newXp,
        zone_id: currentZoneId,
        currency: { copper, silver, gold, platinum }
      },
      inventory,
      equipment
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
        inventory,
        equipment
      });
    }

    const lootTable = currentMob.lootTable || [];
    lootTable.forEach((entry) => {
      if (entry.drop_chance == null) return;
      const def = items[entry.item_id];
      if (!def) return;
      if (Math.random() <= entry.drop_chance) {
        const qtyMin = entry.min_qty || 1;
        const qtyMax = entry.max_qty || qtyMin;
        const qty = Math.max(qtyMin, Math.ceil(Math.random() * qtyMax));
        for (let i = 0; i < qty; i++) {
          const item = createItemInstance(def.name);
          setInventory(prev => {
            const updated = [...prev, item];
            scheduleSave({ inventory: updated });
            return updated;
          });
        }
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

  const scheduleSave = (payload) => {
    if (!user || !characterId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        if (payload.character) {
          await saveCharacter(characterId, payload.character);
        }
        if (payload.inventory) {
          await saveInventory(characterId, payload.inventory);
        }
        if (payload.equipment) {
          await saveEquipment(characterId, payload.equipment);
        }
      } catch (err) {
        console.error('Save failed', err);
        addLog('Save failed. Check connection.', 'error');
      }
    }, 500);
  };

  const changeZone = (zoneId) => {
    if (!availableZoneIds.includes(zoneId)) {
      addLog('You cannot travel there directly from this zone.', 'error');
      return;
    }
    setCurrentZoneId(zoneId);
    const zoneCamps = campsByZone[zoneId] || [];
    setCurrentCampId(zoneCamps[0]?.id || null);
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
      setLeaderboard(prev => {
        const updated = [{ levelReached: level, timestamp: Date.now() }, ...prev];
        return updated.sort((a, b) => b.levelReached - a.levelReached).slice(0, 5);
      });
      setLevel(1);
      setXp(0);
      setHp(playerClass.baseHp);
      setMana(playerClass.baseMana);
      setCopper(0);
      setSilver(0);
      setGold(0);
      setPlatinum(0);
      setInventory([]);
      setEquipment({
        weapon: null,
        chest: null,
        feet: null,
        waist: null,
        jewelry: null,
        hands: null,
        back: null,
        trinket: null
      });
      scheduleSave({
        character: {
          level: 1,
          xp: 0,
          zone_id: initialZoneId,
          currency: { copper: 0, silver: 0, gold: 0, platinum: 0 }
        },
        inventory: [],
        equipment: {}
      });
      setBoundLevel(1);
      addLog('Hardcore death! Reset to level 1.', 'system');
      addLog('Your run was added to the leaderboard.', 'system');
    } else {
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
        inventory,
        equipment
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
          const dodgeChance = Math.min(0.3, (totalBonuses.agi || 0) * 0.002);
          if (Math.random() < dodgeChance) {
            addLog(`You dodge ${currentMob.name}'s attack!`, 'system');
            return;
          }
          const mitigation = Math.min(mobDamage - 1, Math.floor((totalBonuses.ac || 0) / 10));
          const finalMobDmg = Math.max(1, mobDamage - mitigation);
          setHp(prev => {
            const updatedHp = Math.max(0, prev - finalMobDmg);
            if (updatedHp === 0) {
              setTimeout(() => handleDeath(currentMob.name), 0);
            }
            return updatedHp;
          });
          addLog(`${currentMob.name} hits YOU for ${finalMobDmg} damage!`, 'mobattack');
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

  const equipItem = (itemId) => {
    setInventory(prev => {
      const item = prev.find(i => i.id === itemId);
      if (!item) return prev;
      if (!equipSlots.includes(item.slot)) {
        addLog(`You cannot equip ${item.name}.`, 'error');
        return prev;
      }
      const remaining = prev.filter(i => i.id !== itemId);
      const updatedEquip = { ...equipment, [item.slot]: item };
      const swapped = equipment[item.slot] || null;
      const updatedInv = swapped ? [...remaining, swapped] : remaining;
      setEquipment(updatedEquip);
      scheduleSave({ equipment: updatedEquip, inventory: updatedInv });
      addLog(`You equip ${item.name} (${item.slot}).`, 'system');
      return updatedInv;
    });
  };

  const unequipItem = (slot) => {
    setEquipment(prevEquip => {
      const item = prevEquip[slot];
      if (!item) return prevEquip;
      const updatedEquip = { ...prevEquip, [slot]: null };
      setInventory(prev => {
        const updatedInv = [...prev, item];
        scheduleSave({ equipment: updatedEquip, inventory: updatedInv });
        return updatedInv;
      });
      addLog(`You unequip ${item.name}.`, 'system');
      return updatedEquip;
    });
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
    if (isAutoAttack && currentMob && mobHp > 0) {
      autoAttackInterval.current = setInterval(() => {
        attackMob();
      }, derivedStats.attackDelay);
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
  }, [isAutoAttack, currentMob, mobHp, derivedStats.attackDelay]);

  useEffect(() => {
    spawnMob();
  }, [currentZoneId]);

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
      }
    }, 2000);

    return () => {
      if (regenInterval.current) {
        clearInterval(regenInterval.current);
      }
    };
  }, [inCombat, isSitting, maxHp, maxMana, playerClass.isCaster, fleeExhausted]);

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
    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const { character, inventory: inv, equipment: eq } = await loadCharacter(characterId);
        const classKey = character.class_id || character.class || 'warrior';
        const loadedClass = classes[classKey] || classesData[classKey] || classesData.warrior;
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
        setInventory(inv.map(i => ({ ...i, id: i.id || `${i.name}-${Math.random()}` })));
        setEquipment(eq);
        justLoadedRef.current = true;
        setMaxHp(loadedClass.baseHp);
        setHp(loadedClass.baseHp);
        setMaxMana(loadedClass.baseMana);
        setMana(loadedClass.baseMana);
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

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    fetchUserRole(user.id)
      .then(setUserRole)
      .catch(() => setUserRole(null));
  }, [user]);

  const displayMinDamage = derivedStats.minDamage;
  const displayMaxDamage = derivedStats.maxDamage;

  const availableSkills = useMemo(() => {
    const cls = classCatalog.find(c => c.id === playerClassKey) || {};
    const starters = new Set([
      ...(cls.starting_general_skills || []),
      ...(cls.starting_spells || []),
      ...(cls.starting_innate || []),
      ...Object.keys(cls.starting_abilities || {})
    ]);
    return (skills || [])
      .filter((s) => {
        const classAllowed = !s.class_ids?.length || s.class_ids.includes(playerClassKey);
        const starterAllowed = starters.has(s.id);
        const levelOk = (s.required_level || 1) <= level;
        return levelOk && (classAllowed || starterAllowed);
      })
      .sort((a, b) => (a.required_level || 1) - (b.required_level || 1));
  }, [skills, classCatalog, playerClassKey, level]);

  const isSkillOnCooldown = (skill) => {
    const until = skillCooldowns[skill.id];
    return until && until > Date.now();
  };

  const handleUseSkill = (skill) => {
    if (isSkillOnCooldown(skill)) {
      addLog(`${skill.name} is on cooldown.`, 'error');
      return;
    }
    const costMana = (skill.resource_cost && skill.resource_cost.mana) || 0;
    if (costMana > mana) {
      addLog('Not enough mana.', 'error');
      return;
    }
    if (costMana > 0) {
      setMana((m) => Math.max(0, m - costMana));
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
      const scaling = effect.scaling?.coef ? Math.floor((totalBonuses[effect.scaling.stat] || 0) * effect.scaling.coef) : 0;
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
          const dodgeChance = Math.min(0.3, (totalBonuses.agi || 0) * 0.002);
          if (Math.random() < dodgeChance) {
            addLog(`You dodge ${currentMob.name}'s attack!`, 'system');
            return;
          }
          const mitigation = Math.min(mobDamage - 1, Math.floor((totalBonuses.ac || 0) / 10));
          const finalMobDmg = Math.max(1, mobDamage - mitigation);
          setHp(prev => {
            const updatedHp = Math.max(0, prev - finalMobDmg);
            if (updatedHp === 0) {
              setTimeout(() => handleDeath(currentMob.name), 0);
            }
            return updatedHp;
          });
          addLog(`${currentMob.name} hits YOU for ${finalMobDmg} damage!`, 'mobattack');
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

  const handleCreateCharacter = async ({ name, classKey, raceId: newRaceId, deityId: newDeityId, mode: newMode }) => {
    if (!user) return;
    if (characters.length >= 6) {
      addLog('All 6 character slots are used.', 'error');
      return;
    }
    try {
      const newChar = await createCharacter(user.id, {
        name,
        class: classKey,
        class_id: classKey,
        race_id: newRaceId,
        deity_id: newDeityId,
        zone_id: initialZoneId,
        currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
        mode: newMode || mode
      });
      const updated = [...characters, newChar];
      setCharacters(updated);
      setCharacterId(newChar.id);
    } catch (err) {
      console.error(err);
      addLog('Failed to create character.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-blue-400 mb-2">GrindQuest</h1>
          <p className="text-gray-400">An EverQuest Idle Adventure</p>
        </div>

        {!user && (
          <AuthPanel onSignIn={handleAuthSubmit} />
        )}

        {user && (
          <div className="flex justify-between items-center mb-6 text-sm text-gray-300">
            <div>Logged in as {user.email}</div>
            <button
              onClick={handleSignOut}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded"
            >
              Sign Out
            </button>
          </div>
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
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
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
              playerClass={playerClass}
              level={level}
              hp={hp}
              maxHp={maxHp}
              mana={mana}
              maxMana={maxMana}
              xp={xp}
              xpNeeded={xpNeeded}
              inCombat={inCombat}
              isMeditating={isSitting}
              currency={{ copper, silver, gold, platinum }}
            />
            <EquipmentPanel equipment={equipment} onUnequip={unequipItem} />
            <InventoryPanel inventory={inventory} onEquip={equipItem} equipSlots={equipSlots} />
            <SkillsPanel
              skills={availableSkills}
              onUse={handleUseSkill}
              cooldowns={skillCooldowns}
              now={cooldownTick}
            />
            <DevPanel userRole={userRole} />
          </div>

          <div className="space-y-6">
            <ZonePanel
              zones={zones}
              currentZoneId={currentZoneId}
              onZoneChange={changeZone}
              availableZoneIds={availableZoneIds}
              camps={currentZoneCamps}
              currentCampId={currentCampId}
              onCampChange={setCurrentCampId}
            />
            <CombatPanel
              currentMob={currentMob}
              mobHp={mobHp}
              attackMob={attackMob}
              toggleAutoAttack={toggleAutoAttack}
              isAutoAttack={isAutoAttack}
              fleeCombat={fleeCombat}
              toggleMeditate={toggleSit}
              playerClass={playerClass}
              inCombat={inCombat}
              isMeditating={isSitting}
            />
            <CombatLog combatLog={combatLog} />
          </div>

          <div className="space-y-6">
            <InstructionsPanel isCaster={playerClass.isCaster} />
            <StatsPanel
              playerClass={playerClass}
              level={level}
              inCombat={inCombat}
              isMeditating={isSitting}
              hpRegenRate={getHpRegenRate()}
              manaRegenRate={getManaRegenRate()}
              fleeExhausted={fleeExhausted}
              damageRange={{ min: displayMinDamage, max: displayMaxDamage }}
              gearBonuses={totalBonuses}
              inventoryLength={inventory.length}
              attackDelay={derivedStats.attackDelay}
              derivedStats={derivedStats}
            />
            <HardcoreLeaderboard leaderboard={leaderboard} />
            <FutureFeaturesPanel />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
