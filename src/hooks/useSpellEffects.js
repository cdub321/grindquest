import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for managing active spell effects (DoT, HoT, Buffs, Debuffs)
 * Handles periodic ticking and effect expiration
 */
export function useSpellEffects({
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
  handleMobDeath
}) {
  // Track active effects on player and mob
  const [playerEffects, setPlayerEffects] = useState([]);
  const [mobEffects, setMobEffects] = useState([]);

  const tickInterval = useRef(null);

  // Clear mob effects when mob changes or mob dies
  useEffect(() => {
    if (!currentMob || mobHp <= 0) {
      setMobEffects([]);
    }
  }, [currentMob?.id, mobHp]);

  // Effect ticking system (runs every 2 seconds for DoT/HoT)
  useEffect(() => {
    if (tickInterval.current) {
      clearInterval(tickInterval.current);
    }

    tickInterval.current = setInterval(() => {
      const now = Date.now();

      // Tick player effects
      setPlayerEffects((prev) => {
        const active = [];
        prev.forEach((effect) => {
          if (effect.expiresAt <= now) {
            // Effect expired
            if (effect.onExpire) {
              addLog(effect.onExpire, 'system');
            }
            return;
          }

          // Apply tick effect
          if (effect.type === 'root') {
            const baseChance = 0.15;
            const chaMod = Math.max(0, (effect.casterCha || 0) / 1000); // 10 CHA = 1%
            const breakChance = Math.max(0, baseChance - chaMod);
            if (Math.random() < breakChance) {
              addLog('Roots binding you snap!', 'system');
              return;
            }
          }

          if (effect.tickDamage && effect.lastTick + effect.tickInterval <= now) {
            const dmg = effect.tickDamage;
            if (dmg <= 0) {
              addLog(`${effect.name} was resisted.`, 'system');
            } else {
              setHp((h) => Math.max(1, h - dmg));
              addLog(`${effect.name} deals ${dmg} damage to you.`, 'damage');
              if (effect.tapHp) {
                setHp((h) => Math.min(maxHp, h + effect.tapHp));
              }
            }
            addLog(`${effect.name} ticks.`, 'system');
            effect.lastTick = now;
          } else if (effect.tickHeal && effect.lastTick + effect.tickInterval <= now) {
            const heal = effect.tickHeal;
            setHp((h) => Math.min(maxHp, h + heal));
            addLog(`${effect.name} heals you for ${heal}.`, 'heal');
            effect.lastTick = now;
          } else if (effect.tickMana && effect.lastTick + effect.tickInterval <= now) {
            const gain = effect.tickMana;
            setMana((m) => Math.min(maxMana, m + gain));
            addLog(`${effect.name} restores ${gain} mana.`, 'heal');
            effect.lastTick = now;
          } else if (effect.tickEndurance && effect.lastTick + effect.tickInterval <= now) {
            const gain = effect.tickEndurance;
            setEndurance((e) => Math.min(maxEndurance, e + gain));
            addLog(`${effect.name} restores ${gain} endurance.`, 'heal');
            effect.lastTick = now;
          }

          active.push(effect);
        });
        return active;
      });

      // Tick mob effects
      setMobEffects((prev) => {
        if (!currentMob) return [];

        const active = [];
        let mobDied = false;

        prev.forEach((effect) => {
          if (effect.expiresAt <= now) {
            // Effect expired
            return;
          }

          // Apply tick effect
          if (effect.type === 'root') {
            const baseChance = 0.15;
            const chaMod = Math.max(0, (effect.casterCha || 0) / 1000); // 10 CHA = 1%
            const breakChance = Math.max(0, baseChance - chaMod);
            if (Math.random() < breakChance) {
              addLog('Root breaks!', 'system');
              return;
            }
          }

          if (effect.tickDamage && effect.lastTick + effect.tickInterval <= now) {
            const dmg = effect.tickDamage;
            if (dmg <= 0) {
              addLog(`${currentMob.name} resists ${effect.name}.`, 'system');
            } else {
              setMobHp((h) => {
                const newHp = Math.max(0, h - dmg);
                if (newHp === 0 && h > 0) {
                  mobDied = true;
                }
                return newHp;
              });
              addLog(`${effect.name} deals ${dmg} damage to ${currentMob.name}.`, 'damage');
              if (effect.tapHp) {
                setHp((h) => Math.min(maxHp, h + effect.tapHp));
              }
            }
            addLog(`${effect.name} ticks.`, 'system');
            effect.lastTick = now;
          } else if (effect.tickMana && effect.lastTick + effect.tickInterval <= now) {
            const drain = effect.tickMana;
            if (drain > 0) {
              setMobMana((m) => Math.max(0, m - drain));
              if (effect.tapMana) {
                setMana((m) => Math.min(maxMana, m + drain));
              }
              addLog(`${effect.name} drains ${drain} mana from ${currentMob.name}.`, 'damage');
            }
            effect.lastTick = now;
          } else if (effect.tickEndurance && effect.lastTick + effect.tickInterval <= now) {
            const drain = effect.tickEndurance;
            if (drain > 0) {
              setMobEndurance((e) => Math.max(0, e - drain));
              if (effect.tapEndurance) {
                setEndurance((e) => Math.min(maxEndurance, e + drain));
              }
              addLog(`${effect.name} drains ${drain} endurance from ${currentMob.name}.`, 'damage');
            }
            effect.lastTick = now;
          }

          active.push(effect);
        });

        if (mobDied) {
          handleMobDeath?.();
        }
        return active;
      });
    }, 3000); // Tick every 3 seconds

    return () => {
      if (tickInterval.current) {
        clearInterval(tickInterval.current);
      }
    };
  }, [currentMob?.id]); // keep timer stable while a mob is active

  // Clear lingering mob effects when mob dies
  useEffect(() => {
    if (mobHp <= 0) {
      setMobEffects([]);
    }
  }, [mobHp]);

  /**
   * Add an effect to a target (player or mob)
   * @param {string} target - 'player' or 'mob'
   * @param {object} effect - Effect configuration
   */
  const addEffect = (target, effect) => {
    const now = Date.now();
    const newEffect = {
      id: `${effect.name}-${now}-${Math.random()}`,
      name: effect.name,
      duration: effect.duration || 0,
      expiresAt: now + (effect.duration || 0) * 1000,
      tickDamage: effect.tickDamage || 0,
      tickHeal: effect.tickHeal || 0,
      tickMana: effect.tickMana || 0,
      tickEndurance: effect.tickEndurance || 0,
      tapHp: effect.tapHp || 0,
      tapMana: effect.tapMana || 0,
      tapEndurance: effect.tapEndurance || 0,
      damageShield: effect.damageShield || 0,
      rune: effect.rune || 0,
      runeRemaining: effect.rune || 0,
      tickInterval: (effect.tickInterval || 2) * 1000,
      lastTick: now,
      statMods: effect.statMods || null,
      icon: effect.icon || null,
      onExpire: effect.onExpire || null,
      type: effect.type || null
    };

    const dedupeByName = (list) => list.filter((e) => e.name !== newEffect.name);

    if (target === 'player') {
      setPlayerEffects((prev) => [...dedupeByName(prev), newEffect]);
    } else if (target === 'mob') {
      setMobEffects((prev) => [...dedupeByName(prev), newEffect]);
    }
  };

  /**
   * Remove a specific effect by ID
   */
  const removeEffect = (target, effectId) => {
    if (target === 'player') {
      setPlayerEffects((prev) => prev.filter((e) => e.id !== effectId));
    } else if (target === 'mob') {
      setMobEffects((prev) => prev.filter((e) => e.id !== effectId));
    }
  };

  /**
   * Clear all effects from a target
   */
  const clearEffects = (target) => {
    if (target === 'player') {
      setPlayerEffects([]);
    } else if (target === 'mob') {
      setMobEffects([]);
    }
  };

  /**
   * Get total stat modifications from active buffs/debuffs
   */
  const getStatModifiers = useCallback((target) => {
    const effects = target === 'player' ? playerEffects : mobEffects;
    const mods = {};

    effects.forEach((effect) => {
      if (effect.statMods) {
        Object.entries(effect.statMods).forEach(([stat, value]) => {
          mods[stat] = (mods[stat] || 0) + value;
        });
      }
    });

    return mods;
  }, [playerEffects, mobEffects]);

  return {
    playerEffects,
    mobEffects,
    addEffect,
    removeEffect,
    clearEffects,
    getStatModifiers,
    setPlayerEffects,
    setMobEffects
  };
}
