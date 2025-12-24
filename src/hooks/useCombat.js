import { useRef, useEffect, useState } from 'react';
import { useSpellEffects } from './useSpellEffects';
import { computeFleeSuccessChance, computeDodgeChance } from '../utils/combatRules';
import { createResistUtils } from '../combat/resistUtils';
import { createDamageResolver } from '../combat/damageResolution';
import { createSkillExecutor } from '../combat/skillExecutor';
import { slotOrder } from '../services/inventoryManager';

/**
 * Custom hook for managing all combat-related logic
 * Handles: attacking, skills/spells, mob spawning, death, fleeing, resistances
 */
export const useCombat = ({
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
  setLevel,
  xp,
  setXp,

  // Character data
  mode,
  killedAt,

  // Stats
  derivedStats,
  statTotals,
  totalBonuses,

  // Encounter
  spawnMob,
  onMobKilled,
  onPlayerDeath,

  // Loot/Items

  // Currency

  // Cooldowns
  skillCooldowns,
  setSkillCooldowns,

  // Utils
  addLog,
  tickSignal,
  slots,
  setSlots,

  // Refs
  isDeadRef,
  combatTimeout,
  fleeExhaustTimeout
}) => {
  const isHardcoreDead = mode === 'hardcore' && Boolean(killedAt);
  const [castingState, setCastingState] = useState(null);
  const [mobDistance, setMobDistance] = useState(0);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const hasRootEffect = (target = 'mob') => {
    const effects = target === 'player' ? playerEffects : mobEffects;
    return effects.some((e) => e.type === 'root');
  };

  const breakRootOnHit = (target = 'mob') => {
    if (!hasRootEffect(target)) return;
    const chance = 0.15; // 15% on hit, no CHA mod
    const effects = target === 'player' ? playerEffects : mobEffects;
    const rootEffect = effects.find((e) => e.type === 'root');
    if (!rootEffect) return;
    if (Math.random() < chance) {
      removeEffect(target, rootEffect.id);
      addLog(target === 'player' ? 'Roots binding you snap!' : 'Your root breaks!', 'system');
    }
  };

  const computeHitChance = (attackerLevel, defenderLevel) => {
    const base = 0.9;
    const diff = (defenderLevel || 0) - (attackerLevel || 0);
    const penalty = diff > 0 ? diff * 0.03 : diff * 0.01; // harder when underlevel, small bonus when higher
    return clamp(base - penalty, 0.05, 0.98);
  };

  const adjustDodgeForLevel = (dodgeChance, attackerLevel, defenderLevel) => {
    const diff = (attackerLevel || 0) - (defenderLevel || 0);
    let adjusted = dodgeChance;
    if (diff > 0) {
      adjusted -= diff * 0.01; // better attacker reduces defender dodge
    } else if (diff < 0) {
      adjusted += Math.abs(diff) * 0.005; // weaker attacker = slightly more dodge
    }
    return clamp(adjusted, 0, 0.5);
  };

  const levelDamageMultiplier = (attackerLevel, defenderLevel) => {
    const diff = (attackerLevel || 0) - (defenderLevel || 0);
    const delta = clamp(diff * 0.02, -0.3, 0.3); // +/-2% per level gap, capped at 30%
    return 1 + delta;
  };

  // Turn-based combat timing refs
  const lastPlayerAttackRef = useRef(0);
  const lastMobAttackRef = useRef(0);
  const combatTimerRef = useRef(null);
  const mobAutoAttackTimerRef = useRef(null); // Timer for mob auto-attacks when engaged
  const autoAttackChainRef = useRef([]); // Chain of abilities to execute in auto-attack
  const isAutoAttackRef = useRef(isAutoAttack); // Track auto-attack state in ref
  const inCombatRef = useRef(inCombat);
  const currentMobRef = useRef(currentMob);
  const mobHpRef = useRef(mobHp);
  const mobDistanceRef = useRef(0);
  const lastMobRegenTickRef = useRef(Date.now());
  const castTimeoutRef = useRef(null);
  const lastDistanceTickRef = useRef(Date.now());
  const playerHpRef = useRef(hp);
  const playerManaRef = useRef(mana);
  const playerEnduranceRef = useRef(endurance);
  const isMobDeadRef = useRef(false);
  const killHandledRef = useRef(false);

  const requireMobDelay = () => {
    const mob = currentMobRef.current || currentMob;
    const delay = mob?.delay;
    if (!Number.isFinite(delay) || delay <= 0) {
      throw new Error('Mob delay missing; ensure it is defined in the database.');
    }
    return delay;
  };

  const requirePlayerDelay = () => {
    const delay = derivedStats?.attackDelay;
    if (!Number.isFinite(delay) || delay <= 0) {
      throw new Error('Player attackDelay missing; ensure class/gear defines it.');
    }
    return delay;
  };

  const rangeSlotIndex = slotOrder.indexOf('range');
  const ammoSlotIndex = slotOrder.indexOf('ammo');

  const getRangedWeapon = () => {
    if (!Array.isArray(slots)) return null;
    return slots[rangeSlotIndex] || null;
  };

  const getAmmoItem = () => {
    if (!Array.isArray(slots)) return null;
    return slots[ammoSlotIndex] || null;
  };

  const consumeAmmo = () => {
    const ammoItem = getAmmoItem();
    if (!ammoItem) return false;
    const qty = ammoItem.quantity || 1;
    if (qty <= 0) return false;
    setSlots((prev) => {
      const next = [...prev];
      if (qty <= 1) {
        next[ammoSlotIndex] = null;
      } else {
        next[ammoSlotIndex] = { ...ammoItem, quantity: qty - 1 };
      }
      return next;
    });
    return true;
  };

  const getMobDistance = () => mobDistanceRef.current || 0;

  const performRangedAttack = () => {
    if (blockIfHardcoreDead('ranged attack')) return;
    const mob = currentMobRef.current || currentMob;
    if (!mob || mobHpRef.current <= 0) return;
    const weapon = getRangedWeapon();
    const hasDamage = Number(weapon?.bonuses?.ranged_damage ?? weapon?.bonuses?.damage ?? 0) > 0;
    const hasDelay = Number(weapon?.bonuses?.ranged_delay ?? weapon?.bonuses?.delay ?? 0) > 0;
    if (!weapon || !hasDamage || !hasDelay) {
      addLog('No usable ranged weapon equipped.', 'error');
      return;
    }
    const weaponRange = Number(weapon?.bonuses?.range ?? weapon?.range ?? 20) || 20;
    if (getMobDistance() > weaponRange) {
      addLog('Target is out of range.', 'error');
      return;
    }
    const needsAmmo = weapon?.bonuses?.ammo_consumption ?? weapon?.ammo_consumption ?? false;
    const ammoType = weapon?.bonuses?.ammo_type ?? weapon?.ammo_type ?? null;
    if (needsAmmo) {
      const ammoItem = getAmmoItem();
      const matchesAmmo =
        ammoItem &&
        (!ammoType ||
          ammoType === ammoItem.baseItemId ||
          ammoType === ammoItem.ammo_type ||
          ammoType === ammoItem.bonuses?.ammo_type);
      if (!matchesAmmo) {
        addLog('No compatible ammo equipped.', 'error');
        return;
      }
      if (!consumeAmmo()) {
        addLog('Out of ammo.', 'error');
        return;
      }
    }
    const dexBonus = Math.floor((statTotals.dex || 0) / 10);
    const baseDmg = (weapon?.bonuses?.ranged_damage ?? weapon?.bonuses?.damage ?? 1) + dexBonus;
    const mitigation = Math.min(baseDmg - 1, Math.floor((mob.ac || 0) / 10));
    const damage = Math.max(1, baseDmg - mitigation);
    applyHitToTarget({
      rawDamage: damage,
      isSpell: false,
      school: 'physical',
      mitigation: 0,
      target: 'mob',
      attackerName: 'You'
    });
    breakRootOnHit('mob');
    setInCombat(true);
    setIsSitting(false);
    refreshCombatTimer();
    const rangedDelay = weapon?.bonuses?.ranged_delay ?? weapon?.bonuses?.delay;
    if (!Number.isFinite(rangedDelay) || rangedDelay <= 0) {
      throw new Error('Ranged weapon delay missing; ensure ranged_delay or delay is defined.');
    }
    setSkillCooldowns((prev) => ({ ...prev, 'builtin-ranged': Date.now() + rangedDelay }));
    lastPlayerAttackRef.current = Date.now();
  };

  useEffect(() => {
    lastMobRegenTickRef.current = Date.now();
  }, [currentMob]);

  useEffect(() => {
    const dist = currentMob?.distance || 0;
    setMobDistance(dist);
    mobDistanceRef.current = dist;
    lastDistanceTickRef.current = Date.now();
  }, [currentMob]);

  useEffect(() => {
    // Reset per-mob death guard on new target
    if (currentMob) {
      isMobDeadRef.current = false;
      killHandledRef.current = false;
    }
  }, [currentMob]);

  // Centralized mob death handling when HP hits zero (fallback guard)
  useEffect(() => {
    if (currentMob && mobHp <= 0 && !isMobDeadRef.current) {
      handleMobDeathOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobHp, currentMob]);

  // Keeps combat active while either side is swinging
  const refreshCombatTimer = () => {
    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    combatTimeout.current = setTimeout(() => setInCombat(false), 6000);
  };

  const blockIfHardcoreDead = (reason = 'act') => {
    if (!isHardcoreDead) return false;
    addLog(`You are dead and cannot ${reason}. Create a new hardcore character to continue.`, 'error');
    return true;
  };

  // ============================================================================
  // SPELL EFFECTS (DoT, HoT, Buffs, Debuffs)
  // ============================================================================

  const {
    playerEffects,
    mobEffects,
    addEffect,
    removeEffect,
    clearEffects,
    getStatModifiers,
    setPlayerEffects,
    setMobEffects
  } = useSpellEffects({
    setHp,
    maxHp,
    setMana,
    maxMana,
    setEndurance,
    maxEndurance,
    setMobMana,
    setMobEndurance,
    mobHp,
    setMobHp,
    currentMob,
    addLog,
    handleMobDeath: () => handleMobDeathOnce() // Forward declaration, defined below
  });

  const getCurrentMob = () => currentMobRef.current || currentMob;

  // ============================================================================
  // RESIST & MITIGATION
  // ============================================================================

  const { getResistValue, getMobSpellDmgMod, mitigateSpellDamage, mitigateSpellDamageVsMob } = createResistUtils({
    getStatTotals: () => statTotals,
    getDerivedStats: () => derivedStats,
    getCurrentMob,
    getPlayerLevel: () => level
  });

  // ============================================================================
  // MOB DEATH & LOOT
  // ============================================================================

  const handleMobDeath = () => {
    const mob = currentMob || currentMobRef.current;
    if (!mob) return;
    if (killHandledRef.current) return;
    killHandledRef.current = true;
    addLog(`${mob.name} has been slain!`, 'kill');

    if (typeof onMobKilled === 'function') {
      onMobKilled(mob);
    }

    // Don't set inCombat(false) if auto-attack is active - it will continue with next mob
    if (!isAutoAttackRef.current) {
      setInCombat(false);
    }
    setMobHp(0);
    setMobMana(0);
    setMobEndurance(0);
  };

  // ============================================================================
  // PLAYER DEATH
  // ============================================================================

  const handleDeath = (killerName = 'an enemy') => {
    if (isDeadRef.current) return;
    isDeadRef.current = true;

    if (castTimeoutRef.current) {
      clearTimeout(castTimeoutRef.current);
      castTimeoutRef.current = null;
      setCastingState(null);
    }

    addLog(`You have been slain by ${killerName}!`, 'error');
    setInCombat(false);
    setIsSitting(false);
    setIsAutoAttack(false);
    setFleeExhausted(false);
    clearEffects('player');
    clearEffects('mob');

    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    if (fleeExhaustTimeout.current) clearTimeout(fleeExhaustTimeout.current);

    setCurrentMob(null);
    setMobHp(0);
    setMobMana(0);
    setMobEndurance(0);

    if (typeof onPlayerDeath !== 'function') {
      throw new Error('onPlayerDeath callback is required for death handling.');
    }
    const deathResult = onPlayerDeath(killerName);

    setTimeout(() => {
      // Never reset death flag for hardcore characters
      if (deathResult?.isHardcoreDead) {
        return;
      }
      isDeadRef.current = false;
      if (deathResult?.shouldRespawn) {
        spawnMob();
      }
    }, 2000);
  };

  // ============================================================================
  // MOB COUNTER-ATTACK (shared by attackMob and handleUseSkill)
  // ============================================================================

  const mobCounterAttack = () => {
    if (!currentMob) return;
    if (isMobMezzed()) return;
    if (mobDistanceRef.current > (currentMob.melee_range || 10)) return;
    if (Array.isArray(currentMob.tags) && currentMob.tags.includes('Neutral') && !inCombatRef.current) return;

    setInCombat(true);
    setIsSitting(false);
    refreshCombatTimer();

    const mobSpellMod = getMobSpellDmgMod();
    const mobMods = getStatModifiers('mob') || {};
    const baseMobDamage = Math.max(
      1,
      Math.floor(currentMob.damage * (1 + mobSpellMod / 100) * (1 + (mobMods.mod_damage || 0) / 100))
    );
    const dmgMult = levelDamageMultiplier(currentMob.level || 1, level || 1);
    const mobDamage = Math.max(1, Math.floor(baseMobDamage * dmgMult));

    // Level-based hit chance for mob
    const hitChance = computeHitChance(currentMob.level || 1, level || 1);
    if (Math.random() > hitChance) {
      addLog(`${currentMob.name} misses you!`, 'system');
      return;
    }

    let dodgeChance = computeDodgeChance(statTotals.agi || 0);
    dodgeChance = adjustDodgeForLevel(dodgeChance, currentMob.level || 1, level || 1);

    if (Math.random() < dodgeChance) {
      addLog(`You dodge ${currentMob.name}'s attack!`, 'system');
      return;
    }

    const isSpell = currentMob.damage_type === 'spell' || currentMob.damageType === 'spell';
    const school = currentMob.damage_school || currentMob.damageSchool || 'magic';
    const mitigation = isSpell ? 0 : Math.min(mobDamage - 1, Math.floor((totalBonuses.ac || 0) / 10));
    applyHitToTarget({
      rawDamage: mobDamage,
      isSpell,
      school,
      mitigation,
      target: 'player',
      attackerName: currentMob.name
    });
    breakRootOnHit('player');
  };

  // ============================================================================
  // BASIC ATTACK
  // ============================================================================

  const handleMobDeathOnce = () => {
    if (isMobDeadRef.current) return;
    isMobDeadRef.current = true;
    if (combatTimerRef.current) {
      clearTimeout(combatTimerRef.current);
      combatTimerRef.current = null;
    }
    setIsAutoAttack(false);
    handleMobDeath();
    setCurrentMob(null);
  };

  const attackMob = (opts = {}) => {
    if (blockIfHardcoreDead('attack')) return;
    if (!currentMob || mobHp <= 0) return;
    if (mobDistanceRef.current > (currentMob.melee_range || 10)) {
      addLog('You are too far away for melee.', 'error');
      return;
    }
    if (isMobMezzed()) {
      addLog(`${currentMob.name} is mesmerized.`, 'system');
      return;
    }

    const now = opts.timestamp || Date.now();

    // Level-based hit chance
    const hitChance = computeHitChance(level || 1, currentMob.level || 1);
    if (Math.random() > hitChance) {
      setInCombat(true);
      setIsSitting(false);
      addLog(`You miss ${currentMob.name}.`, 'system');
      refreshCombatTimer();
      return;
    }

    // Mob dodge with level adjustment
    const mobAgi = currentMob.agi || currentMob.agility || 0;
    const mobDodgeBase = computeDodgeChance(mobAgi || 0);
    const mobDodge = adjustDodgeForLevel(mobDodgeBase, level || 1, currentMob.level || 1);
    if (Math.random() < mobDodge) {
      setInCombat(true);
      setIsSitting(false);
      addLog(`${currentMob.name} dodges your attack!`, 'system');
      refreshCombatTimer();
      return;
    }

    setInCombat(true);
    setIsSitting(false);
    refreshCombatTimer();

    // Record attack time for turn-based combat
    lastPlayerAttackRef.current = now;

    const playerMods = getStatModifiers('player') || {};
    const dmgMult = 1 + (playerMods.mod_damage || 0) / 100;
    const levelMult = levelDamageMultiplier(level || 1, currentMob.level || 1);
    const base = Math.floor(
      (derivedStats.minDamage + Math.random() * (derivedStats.maxDamage - derivedStats.minDamage + 1)) * dmgMult
    );
    const mitigation = Math.min(base - 1, Math.floor((currentMob.ac || 0) / 10));
    const result = applyHitToTarget({
      rawDamage: Math.max(1, Math.floor(base * levelMult) - mitigation),
      isSpell: false,
      school: 'physical',
      mitigation: 0,
      target: 'mob',
      attackerName: 'You'
    });
    if (result && result.killed) {
      handleMobDeathOnce();
      return;
    }
    breakRootOnHit('mob');
  };

  // ============================================================================
  // FLEE
  // ============================================================================

  const fleeCombat = () => {
    if (blockIfHardcoreDead('flee')) return;
    if (!currentMob) return;
    if (fleeExhausted) {
      addLog('You are too exhausted to flee again yet.', 'error');
      return;
    }
    if (castTimeoutRef.current) {
      clearTimeout(castTimeoutRef.current);
      castTimeoutRef.current = null;
      setCastingState(null);
    }

    const applyFleeDebuff = () => {
      setFleeExhausted(true);
      if (fleeExhaustTimeout.current) clearTimeout(fleeExhaustTimeout.current);
      const cooldownMs = 60000;
      fleeExhaustTimeout.current = setTimeout(() => setFleeExhausted(false), cooldownMs);
      setSkillCooldowns((prev) => ({ ...prev, 'builtin-flee': Date.now() + cooldownMs }));
      addLog('You feel exhausted from fleeing. You can attempt again in 60 seconds.', 'system');
    };

    const engaged = inCombat || mobHp < currentMob.hp;
    const playerMods = getStatModifiers('player') || {};
    const mobMods = getStatModifiers('mob') || {};
    if (!Number.isFinite(currentMob.movespeed)) {
      throw new Error('Mob movespeed missing; ensure mob template defines it.');
    }
    const playerSpeed = Math.max(0, 1 * (1 + (playerMods.mod_move || 0) / 100));
    const mobSpeed = Math.max(0, currentMob.movespeed * (1 + (mobMods.mod_move || 0) / 100));
    const successChance = computeFleeSuccessChance({ engaged, playerSpeed, mobSpeed });

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
    setIsAutoAttack(false);
    clearEffects('mob');
    setCurrentMob(null);
    setMobHp(0);
    setMobMana(0);
    setMobEndurance(0);

    applyFleeDebuff();
    spawnMob();
  };

  // ============================================================================
  // SIT/STAND
  // ============================================================================

  const toggleSit = () => {
    if (inCombat) {
      addLog('You cannot sit while in combat!', 'error');
      return;
    }
    setIsSitting(!isSitting);
    addLog(isSitting ? 'You stand up.' : 'You sit down to rest.', 'system');
  };

  // ============================================================================
  // SKILL/SPELL EXECUTION
  // ============================================================================

  const isPlayerMezzed = () => playerEffects.some((e) => e.type === 'mez' && e.expiresAt > Date.now());
  const isMobMezzed = () => mobEffects.some((e) => e.type === 'mez' && e.expiresAt > Date.now());

  const sumDefenses = (target = 'player') => {
    const effects = target === 'player' ? playerEffects : mobEffects;
    return effects.reduce(
      (acc, e) => {
        acc.rune += e.runeRemaining || 0;
        acc.damageShield += e.damageShield || 0;
        return acc;
      },
      { rune: 0, damageShield: 0 }
    );
  };

  const consumeRune = (target = 'player', amount = 0) => {
    if (amount <= 0) return 0;
    const setter = target === 'player' ? setPlayerEffects : setMobEffects;
    let remaining = amount;
    setter((prev) =>
      prev.map((e) => {
        if (!e.runeRemaining || remaining <= 0) return e;
        const absorbed = Math.min(e.runeRemaining, remaining);
        remaining -= absorbed;
        return { ...e, runeRemaining: e.runeRemaining - absorbed };
      })
    );
    return amount - remaining;
  };

  const { applyHitToTarget } = createDamageResolver({
    addLog,
    mitigateSpellDamagePlayer: mitigateSpellDamage,
    mitigateSpellDamageMob: mitigateSpellDamageVsMob,
    consumeRune,
    sumDefenses,
    getCurrentMob,
    getPlayerHp: () => playerHpRef.current ?? hp,
    setPlayerHp: setHp,
    getMobHp: () => mobHpRef.current ?? mobHp,
    setMobHp,
    handleDeath,
    handleMobDeath: () => handleMobDeathOnce()
  });

  const { handleUseSkill, isSkillOnCooldown } = createSkillExecutor({
    addLog,
    blockIfHardcoreDead,
    getPlayerEffects: () => playerEffects,
    getMobEffects: () => mobEffects,
    getStatModifiers,
    getCurrentMob,
    getMobHp: () => mobHpRef.current ?? mobHp,
    getMobMana: () => mobMana,
    getMobEndurance: () => mobEndurance,
    getHp: () => playerHpRef.current ?? hp,
    getMana: () => playerManaRef.current ?? mana,
    getEndurance: () => playerEnduranceRef.current ?? endurance,
    maxHp,
    maxMana,
    maxEndurance,
    derivedStats,
    setHp,
    setMana,
    setEndurance,
    setMobHp,
    setMobMana,
    setMobEndurance,
    setInCombat,
    setIsSitting,
    setIsAutoAttack,
    setSkillCooldowns,
    skillCooldowns,
    addEffect,
    consumeRune,
    attackMob,
    toggleSit,
    fleeCombat,
    castTimeoutRef,
    castingState,
    setCastingState,
    mitigateSpellDamageVsMob,
    isAutoAttackRef,
    isInCombat: () => inCombat,
    breakRootOnHit,
    getCasterCha: (target) => {
      if (target === 'player') {
        return currentMobRef.current?.cha || 0;
      }
      return statTotals.cha || 0;
    },
    getMobDistance: () => mobDistanceRef.current,
    performRangedAttack
  });

  // ============================================================================
  // TURN-BASED COMBAT TIMING SYSTEM
  // ============================================================================

  /**
   * Schedule the next attack in turn-based combat
   * Calculates when player and mob should attack next, schedules the earlier one
   */
  const scheduleNextCombatTurn = (abilityChain = []) => {
    if (combatTimerRef.current) {
      clearTimeout(combatTimerRef.current);
      combatTimerRef.current = null;
    }

    if (!isAutoAttackRef.current) {
      return;
    }

    // Ensure we're in combat
    if (!inCombat) {
      setInCombat(true);
    }

    const now = Date.now();
    const playerDelay = requirePlayerDelay();
    const mob = currentMob || currentMobRef.current;
    const mobDelay = mob && mobHp > 0 ? requireMobDelay() : Number.POSITIVE_INFINITY;

    // Calculate next attack times
    const nextPlayerAttack = lastPlayerAttackRef.current + playerDelay;
    const nextMobAttack = lastMobAttackRef.current + mobDelay;

    // Determine which attack comes first
    const nextAttackTime = Math.min(nextPlayerAttack, nextMobAttack);
    let delay = nextAttackTime - now;
    
    // Clamp to a small minimum delay to prevent zero/negative timers
    if (delay < 50) {
      delay = 50;
    }
    
    const isPlayerTurn = nextPlayerAttack <= nextMobAttack;

    // Schedule the attack with proper delay
    combatTimerRef.current = setTimeout(() => {
      // Double-check conditions before executing (critical - stops loops)
      if (!isAutoAttackRef.current) {
        combatTimerRef.current = null;
        return;
      }

      const currentTime = Date.now();

      if (isPlayerTurn) {
        // Execute player attack chain
        if (abilityChain.length > 0) {
          // Execute first available ability in chain
          for (const skill of abilityChain) {
            if (!skill) continue;
            if (isSkillOnCooldown(skill)) continue;
            handleUseSkill(skill);
            break; // Only execute one ability per turn
          }
        } else {
          // Fallback to basic attack
          attackMob();
        }
        lastPlayerAttackRef.current = currentTime;
      } else {
        // Mob's turn
        mobCounterAttack();
        lastMobAttackRef.current = currentTime;
      }

      // Reschedule next turn (only if auto-attack is still on)
      if (isAutoAttackRef.current) {
        scheduleNextCombatTurn(abilityChain);
      }
    }, delay);
  };

  // Expose function to set auto-attack chain (called from useSkillSlots)
  const setAutoAttackChain = (chain) => {
    autoAttackChainRef.current = chain;
    // Let the useEffect handle scheduling - it will trigger when isAutoAttack changes
  };

  // Update refs when state changes
  useEffect(() => {
    isAutoAttackRef.current = isAutoAttack;
    inCombatRef.current = inCombat;
    currentMobRef.current = currentMob;
    mobHpRef.current = mobHp;
    mobDistanceRef.current = mobDistance;
    playerHpRef.current = hp;
    playerManaRef.current = mana;
    playerEnduranceRef.current = endurance;
  }, [isAutoAttack, inCombat, currentMob, mobHp, mobDistance, hp, mana, endurance]);

  // Reset attack timing when a new mob spawns
  useEffect(() => {
    if (!currentMob) return;
    const now = Date.now();
    const playerDelay = requirePlayerDelay();
    const mobDelay = requireMobDelay();
    lastPlayerAttackRef.current = now - playerDelay;
    lastMobAttackRef.current = now;
    if (combatTimerRef.current) {
      clearTimeout(combatTimerRef.current);
      combatTimerRef.current = null;
    }
    // If auto-attack is active, restart the combat loop with the new mob
    if (isAutoAttackRef.current) {
      setInCombat(true);
      scheduleNextCombatTurn(autoAttackChainRef.current);
    }
  }, [currentMob, derivedStats?.attackDelay]);

  // Update attack timing when auto-attack toggles or combat state changes
  useEffect(() => {
    if (isAutoAttack) {
      if (!inCombat) setInCombat(true);
      const now = Date.now();
      if (lastPlayerAttackRef.current === 0) lastPlayerAttackRef.current = now;
      if (lastMobAttackRef.current === 0) lastMobAttackRef.current = now;
      scheduleNextCombatTurn(autoAttackChainRef.current);
    } else {
      if (combatTimerRef.current) {
        clearTimeout(combatTimerRef.current);
        combatTimerRef.current = null;
      }
    }

    return () => {
      if (combatTimerRef.current) {
        clearTimeout(combatTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAttack, inCombat, derivedStats?.attackDelay]);

  // Cleanup cast timer on unmount
  useEffect(() => () => {
    if (castTimeoutRef.current) {
      clearTimeout(castTimeoutRef.current);
    }
  }, []);

  // Mob auto-attack when engaged (separate from player auto-attack)
  useEffect(() => {
    if (mobAutoAttackTimerRef.current) {
      clearTimeout(mobAutoAttackTimerRef.current);
      mobAutoAttackTimerRef.current = null;
    }

    if (inCombat && currentMob && mobHp > 0 && !isAutoAttackRef.current) {
      // Mob attacks automatically when engaged, even if player isn't auto-attacking
      const scheduleMobAttack = () => {
        if (!inCombatRef.current || !currentMobRef.current || mobHpRef.current <= 0 || isAutoAttackRef.current) {
          mobAutoAttackTimerRef.current = null;
          return;
        }

        const now = Date.now();
        const mobDelay = requireMobDelay();
        const nextMobAttack = lastMobAttackRef.current + mobDelay;
        const delay = Math.max(50, nextMobAttack - now);

        mobAutoAttackTimerRef.current = setTimeout(() => {
          mobAutoAttackTimerRef.current = null;
          
          if (!inCombatRef.current || !currentMobRef.current || mobHpRef.current <= 0 || isAutoAttackRef.current) {
            return;
          }

          mobCounterAttack();
          lastMobAttackRef.current = Date.now();

          // Reschedule next attack
          scheduleMobAttack();
        }, delay);
      };

      // Initialize timing if needed
      if (lastMobAttackRef.current === 0) {
        lastMobAttackRef.current = Date.now();
      }

      scheduleMobAttack();
    }

    return () => {
      if (mobAutoAttackTimerRef.current) {
        clearTimeout(mobAutoAttackTimerRef.current);
        mobAutoAttackTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCombat, currentMob, mobHp]);

  // Hidden-tab catch-up for attacks using global tick
  useEffect(() => {
    if (!tickSignal) return;
    const now = tickSignal;
    const mob = currentMobRef.current;
    const playerDelay = requirePlayerDelay();
    const mobDelay = mob && mobHpRef.current > 0 ? requireMobDelay() : Number.POSITIVE_INFINITY;

    if (isAutoAttackRef.current && lastPlayerAttackRef.current + playerDelay <= now && mobHpRef.current > 0) {
      const swingTime = lastPlayerAttackRef.current + playerDelay;
      attackMob({ timestamp: swingTime });
      lastPlayerAttackRef.current = swingTime;
    }

    if (inCombatRef.current && lastMobAttackRef.current + mobDelay <= now && mobHpRef.current > 0) {
      mobCounterAttack();
      lastMobAttackRef.current = now;
    }
  }, [tickSignal, derivedStats.attackDelay]);

  // Distance reduction over time based on mob movespeed
  useEffect(() => {
    if (!tickSignal) return;
    const mob = currentMobRef.current;
    if (!mob) return;
    const now = tickSignal;
    const elapsedSec = Math.max(0, (now - lastDistanceTickRef.current) / 1000);
    if (elapsedSec <= 0) return;
    lastDistanceTickRef.current = now;
    const isNeutral = Array.isArray(mob.tags) && mob.tags.includes('Neutral');
    const aggroRange = mob.aggro_range || mob.melee_range || 10;
    const canPursue = inCombatRef.current || (!isNeutral && mobDistanceRef.current <= aggroRange);
    const mobMods = getStatModifiers('mob') || {};
    const speedMult = 1 + (mobMods.mod_move || 0) / 100;
    const effectiveMoveSpeed = (mob.movespeed || 0) * speedMult;
    if (effectiveMoveSpeed <= 0 || mobDistanceRef.current <= 0 || !canPursue) return;
    const next = Math.max(0, mobDistanceRef.current - effectiveMoveSpeed * elapsedSec);
    setMobDistance(next);
    mobDistanceRef.current = next;
    if (next <= (mob.melee_range || 10) && !inCombatRef.current && !isNeutral) {
      setInCombat(true);
    }
  }, [tickSignal]);

  // Mob regen driven by global tick
  useEffect(() => {
    if (!tickSignal || !currentMobRef.current || mobHpRef.current <= 0) return;
    const now = tickSignal;
    const intervalMs = 3000;
    const last = lastMobRegenTickRef.current;
    const ticks = Math.floor((now - last) / intervalMs);
    if (ticks <= 0) return;
    lastMobRegenTickRef.current = last + ticks * intervalMs;

    const hpRegenRate = (inCombatRef.current ? 1 : 3) * ticks;
    setMobHp(prev => Math.min(currentMobRef.current.hp, prev + hpRegenRate));

    if (currentMobRef.current.mana > 0) {
      const manaRegenRate = (inCombatRef.current ? 1 : 5) * ticks;
      setMobMana(prev => Math.min(currentMobRef.current.mana, prev + manaRegenRate));
    }

    if (currentMobRef.current.endurance > 0) {
      const endRegenRate = (inCombatRef.current ? 1 : 5) * ticks;
      setMobEndurance(prev => Math.min(currentMobRef.current.endurance, prev + endRegenRate));
    }
  }, [tickSignal]);

  // ============================================================================
  // RETURN PUBLIC API
  // ============================================================================

  return {
    attackMob,
    handleMobDeath,
    handleDeath,
    fleeCombat,
    toggleSit,
    handleUseSkill,
    isSkillOnCooldown,
    getResistValue,
    mitigateSpellDamage,
    blockIfHardcoreDead,
    // Spell effects
    playerEffects,
    mobEffects,
    addEffect,
    removeEffect,
    clearEffects,
    getStatModifiers,
    setPlayerEffects,
    setMobEffects,
    // Turn-based combat
    setAutoAttackChain,
    castingState,
    mobDistance
  };
};
