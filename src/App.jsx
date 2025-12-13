import { useState, useEffect, useRef, useMemo } from 'react';
import classesData from './data/classes.json';
import zonesData from './data/zones.json';
import itemsData from './data/items.json';
import CharacterPanel from './components/CharacterPanel';
import InventoryPanel from './components/InventoryPanel';
import ZonePanel from './components/ZonePanel';
import CombatPanel from './components/CombatPanel';
import CombatLog from './components/CombatLog';
import InstructionsPanel from './components/InstructionsPanel';
import StatsPanel from './components/StatsPanel';
import FutureFeaturesPanel from './components/FutureFeaturesPanel';
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
  loadCharacter
} from './services/playerStorage';
import CharacterSelectPanel from './components/CharacterSelectPanel';
import CharacterCreatePanel from './components/CharacterCreatePanel';
import {
  fetchClassesCatalog,
  fetchDeities,
  fetchDeityClassAllowed,
  fetchRaceClassAllowed,
  fetchRaces
} from './services/referenceData';

export default function GrindQuest() {
  const [playerClassKey, setPlayerClassKey] = useState('warrior');
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
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const baseMaxHp = playerClass.baseHp;
  const baseMaxMana = playerClass.baseMana;
  const [hp, setHp] = useState(baseMaxHp);
  const [maxHp, setMaxHp] = useState(baseMaxHp);
  const [mana, setMana] = useState(baseMaxMana);
  const [maxMana, setMaxMana] = useState(baseMaxMana);
  const [copper, setCopper] = useState(0);
  const [silver, setSilver] = useState(0);
  const [gold, setGold] = useState(0);
  const [platinum, setPlatinum] = useState(0);
  const [mode, setMode] = useState('normal');
  const [raceId, setRaceId] = useState(null);
  const [deityId, setDeityId] = useState(null);
  const [classCatalog, setClassCatalog] = useState([]);
  const [races, setRaces] = useState([]);
  const [deities, setDeities] = useState([]);
  const [raceClassAllowed, setRaceClassAllowed] = useState([]);
  const [deityClassAllowed, setDeityClassAllowed] = useState([]);
  const [boundLevel, setBoundLevel] = useState(1);
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSelectingCharacter, setIsSelectingCharacter] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [loadError, setLoadError] = useState('');

  const zoneEntries = Object.entries(zonesData);
  const initialZoneId = zoneEntries[0]?.[0] || '';
  const [currentZoneId, setCurrentZoneId] = useState(initialZoneId);
  const currentZone = zonesData[currentZoneId] || { name: 'Unknown', mobs: [] };
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

  const xpNeeded = level * 100;

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [cls, rcs, dts, rcMap, dcMap] = await Promise.all([
          fetchClassesCatalog(),
          fetchRaces(),
          fetchDeities(),
          fetchRaceClassAllowed(),
          fetchDeityClassAllowed()
        ]);
        setClassCatalog(cls || []);
        setRaces(rcs || []);
        setDeities(dts || []);
        setRaceClassAllowed(rcMap || []);
        setDeityClassAllowed(dcMap || []);
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };
    loadReferenceData();
  }, []);

  const createItemInstance = (name) => {
    const data = itemsData[name] || { slot: 'misc', bonuses: {} };
    return {
      id: `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
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
          hp: acc.hp + (item.bonuses.hp || 0),
          mana: acc.mana + (item.bonuses.mana || 0)
        };
      },
      { damage: 0, hp: 0, mana: 0 }
    );
  }, [equipment]);

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
    const newMaxHp = baseMaxHp + totalBonuses.hp;
    const newMaxMana = baseMaxMana + totalBonuses.mana;
    setMaxHp(newMaxHp);
    setHp(prev => Math.min(newMaxHp, prev));
    setMaxMana(newMaxMana);
    setMana(prev => Math.min(newMaxMana, prev));
  }, [baseMaxHp, baseMaxMana, totalBonuses.hp, totalBonuses.mana]);

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
    if (!currentZone?.mobs?.length) {
      addLog('No mobs available in this zone.', 'error');
      return;
    }
    const mob = currentZone.mobs[Math.floor(Math.random() * currentZone.mobs.length)];
    setCurrentMob(mob);
    setMobHp(mob.hp);
    addLog(`${mob.name} spawns!`, 'spawn');
  };

  const availableZoneIds = useMemo(() => {
    const connections = currentZone.connections || [];
    const options = new Set([currentZoneId, ...connections]);
    return Array.from(options).filter(id => zonesData[id]);
  }, [currentZone, currentZoneId]);

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
    addLog(`You travel to ${zonesData[zoneId].name}.`, 'system');
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

    const baseDamage = Math.floor(playerClass.baseDamage * (1 + level * 0.1));
    const damage = Math.floor(baseDamage + totalBonuses.damage + Math.random() * 5);
    const newHp = Math.max(0, mobHp - damage);
    setMobHp(newHp);
    addLog(`You hit ${currentMob.name} for ${damage} damage!`, 'damage');

    if (newHp === 0) {
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

      if (Math.random() < 0.3) {
        const lootItemName = currentMob.loot[Math.floor(Math.random() * currentMob.loot.length)];
        addLog(`You receive: ${lootItemName}`, 'loot');

        if (lootItemName.includes("Pieces")) {
          if (lootItemName.includes("Platinum")) {
            setPlatinum(prev => {
              const next = prev + Math.floor(Math.random() * 5) + 1;
              scheduleSave({ character: { currency: { copper, silver, gold, platinum: next } } });
              return next;
            });
          } else if (lootItemName.includes("Gold")) {
            setGold(prev => {
              const next = prev + Math.floor(Math.random() * 10) + 1;
              scheduleSave({ character: { currency: { copper, silver, gold: next, platinum } } });
              return next;
            });
          } else if (lootItemName.includes("Silver")) {
            setSilver(prev => {
              const next = prev + Math.floor(Math.random() * 20) + 1;
              scheduleSave({ character: { currency: { copper, silver: next, gold, platinum } } });
              return next;
            });
          } else if (lootItemName.includes("Copper")) {
            setCopper(prev => {
              const next = prev + Math.floor(Math.random() * 50) + 1;
              scheduleSave({ character: { currency: { copper: next, silver, gold, platinum } } });
              return next;
            });
          }
        } else {
          const item = createItemInstance(lootItemName);
          setInventory(prev => {
            const updated = [...prev, item];
            scheduleSave({ inventory: updated });
            return updated;
          });
        }
      }

      setTimeout(() => spawnMob(), 1000);
      setInCombat(false);
    } else {
      setTimeout(() => {
        if (newHp > 0) {
          const mobDamage = currentMob.damage;
          setHp(prev => {
            const updatedHp = Math.max(0, prev - mobDamage);
            if (updatedHp === 0) {
              setTimeout(() => handleDeath(currentMob.name), 0);
            }
            return updatedHp;
          });
          addLog(`${currentMob.name} hits YOU for ${mobDamage} damage!`, 'mobattack');
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
      }, playerClass.attackSpeed);
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
  }, [isAutoAttack, currentMob, mobHp]);

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

  const displayMinDamage = Math.floor(playerClass.baseDamage * (1 + level * 0.1)) + totalBonuses.damage;
  const displayMaxDamage = displayMinDamage + 5;

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
          </div>

          <div className="space-y-6">
            <ZonePanel
              zones={zonesData}
              currentZoneId={currentZoneId}
              onZoneChange={changeZone}
              availableZoneIds={availableZoneIds}
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
