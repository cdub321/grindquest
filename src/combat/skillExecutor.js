/**
 * Executes skills/spells and built-in actions. Pure function with caller-supplied state getters/setters.
 */
export function createSkillExecutor(ctx) {
  const {
    addLog,
    blockIfHardcoreDead,
    getPlayerEffects,
    getMobEffects,
    getStatModifiers,
    getCurrentMob,
    getMobHp,
    getMobMana,
    getMobEndurance,
    getMobDistance,
    getHp,
    getMana,
    getEndurance,
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
    performRangedAttack,
    attackMob,
    toggleSit,
    fleeCombat,
    castTimeoutRef,
    castingState,
    setCastingState,
    mitigateSpellDamageVsMob,
    isAutoAttackRef,
    isInCombat,
    breakRootOnHit,
    getCasterCha
  } = ctx;

  const isSkillOnCooldown = (skill) => {
    const until = skillCooldowns[skill.id];
    return until && until > Date.now();
  };

  const getSpellIcon = (skill) =>
    skill?.spellIconIndex ?? skill?.spellicon ?? skill?.iconIndex ?? skill?.icon ?? null;

  const isPlayerMezzed = () =>
    getPlayerEffects().some((e) => e.type === 'mez' && e.expiresAt > Date.now());
  const isMobMezzed = () =>
    getMobEffects().some((e) => e.type === 'mez' && e.expiresAt > Date.now());

  const handleUseSkill = (skill) => {
    const currentMob = getCurrentMob();
    const mobHp = getMobHp();
    const mobMana = getMobMana();
    const mobEndurance = getMobEndurance();
    const mobDistance = getMobDistance ? getMobDistance() : 0;
    const hp = getHp();
    const mana = getMana();
    const endurance = getEndurance();

    if (blockIfHardcoreDead('use skills')) return;
    if (isPlayerMezzed()) {
      addLog('You are mesmerized and cannot act.', 'error');
      return;
    }
    if (!skill) return;
    if (castingState) return;
    const playerMods = getStatModifiers('player') || {};
    const effectiveMaxHp = maxHp + (playerMods.mod_max_hp || 0);
    const effectiveMaxMana = maxMana + (playerMods.mod_max_mana || 0);
    const effectiveMaxEndurance = maxEndurance + (playerMods.mod_max_endurance || 0);
    const skillRange = Number(skill.range_units ?? skill.range ?? 0);
    const targetIsMob = (skill.target || '').toLowerCase() !== 'self';

    const builtInAbilityHandlers = {
      'builtin-attack': attackMob,
      'builtin-ranged': () => {
        if (performRangedAttack) {
          performRangedAttack();
        }
      },
      'builtin-auto': () => {
        setIsAutoAttack((prev) => {
          const next = !prev;
          if (isAutoAttackRef) isAutoAttackRef.current = next;
          return next;
        });
      },
      'builtin-sit': toggleSit,
      'builtin-meditate': () => {
        if (castingState) {
          addLog('You cannot meditate while casting!', 'error');
          return;
        }
        if (isInCombat && isInCombat()) {
          addLog('You cannot meditate while in combat!', 'error');
          return;
        }
        setIsSitting(true);
        setIsAutoAttack(false);
        addLog('You begin meditating.', 'system');
      },
      'builtin-flee': fleeCombat
    };

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

    if (targetIsMob && skillRange > 0 && mobDistance > skillRange) {
      addLog('Target is out of range.', 'error');
      return;
    }

    if (isSkillOnCooldown(skill)) {
      addLog(`${skill.name} is on cooldown.`, 'error');
      return;
    }

    const costMana = Math.max(0, skill.mana || 0);
    const costEndurance = Math.max(0, skill.endurance || 0);

    if (costMana > mana) {
      addLog('Not enough mana.', 'error');
      return;
    }
    if (costEndurance > endurance) {
      addLog('Not enough endurance.', 'error');
      return;
    }

    const castMs = (skill.cast_time || 0);
    const effectType = (skill.effect_type || skill.effectType || '').toLowerCase();
    const allowedEffects = new Set([
      'damage',
      'dot',
      'heal',
      'hot',
      'manarestore',
      'endrestore',
      'manadrain',
      'enddrain',
      'lifetap',
      'movespeed',
      'root',
      'delay',
      'attack',
      'dmgshield',
      'rune',
      'mez',
      'buff',
      'debuff'
    ]);
    if (!effectType) {
      addLog(`${skill.name} has no effect type defined.`, 'error');
      throw new Error(`Missing effect_type for skill ${skill.id || skill.name || 'unknown'}`);
    }
    if (!allowedEffects.has(effectType)) {
      addLog(`${skill.name} has invalid effect type: ${effectType}`, 'error');
      throw new Error(`Invalid effect_type '${effectType}' for skill ${skill.id || skill.name || 'unknown'}`);
    }
    const school = (skill.resist || 'magic').toLowerCase();
    const baseHp = Number(skill.base_hp ?? 0);
    const tickHp = Number(skill.tick_hp ?? 0);
    const baseManaVal = Number(skill.base_mana ?? 0);
    const tickManaVal = Number(skill.tick_mana ?? 0);
    const baseEndVal = Number(skill.base_endurance ?? 0);
    const tickEndVal = Number(skill.tick_endurance ?? 0);

    const executeSkill = () => {
      const currentMobExec = getCurrentMob();
      const mobHpExec = getMobHp();
      const mobManaExec = getMobMana();
      const mobEndExec = getMobEndurance();
      const hpExec = getHp();

      if (costMana > 0) {
        setMana((m) => Math.max(0, m - costMana));
      }
      if (costEndurance > 0) {
        setEndurance((e) => Math.max(0, e - costEndurance));
      }

      if (skill.cooldown_seconds) {
        setSkillCooldowns((prev) => ({ ...prev, [skill.id]: Date.now() + skill.cooldown_seconds * 1000 }));
      }

      const spellIcon = getSpellIcon(skill);

      if (effectType === 'damage') {
        if (!currentMobExec || mobHpExec <= 0) {
          addLog('No target to hit.', 'error');
          return;
        }

        setInCombat(true);
        setIsSitting(false);

        const spellModPct = (derivedStats.spellDmgMod || 0);
        const signedBase = Math.max(1, Math.floor(baseHp * (1 + spellModPct / 100)));
        const { final: resisted } = mitigateSpellDamageVsMob(signedBase, school);
        if (resisted <= 0) {
          addLog(`${currentMobExec.name} resists ${skill.name}!`, 'system');
          return;
        }
        const isHeal = baseHp > 0 && effectType === 'heal';
        if (isHeal) {
          setHp((prev) => Math.min(maxHp, prev + resisted));
          addLog(`You cast ${skill.name} and heal for ${resisted}!`, 'heal');
        } else {
          const newHp = Math.max(0, mobHpExec - resisted);
          setMobHp(newHp);
          addLog(`${skill.name} hits ${currentMobExec.name} for ${resisted} ${school} damage!`, 'damage');
          if (breakRootOnHit) breakRootOnHit('mob');
        }

      } else if (effectType === 'lifetap') {
        if (baseHp) {
          if (!currentMobExec || mobHpExec <= 0) {
            addLog('No target to hit.', 'error');
            return;
          }
          setInCombat(true);
          setIsSitting(false);
          const dmg = Math.max(0, Math.floor(baseHp));
          const absorbed = consumeRune('mob', dmg);
          const finalDmg = Math.max(0, dmg - absorbed);
          if (finalDmg > 0) {
            const newHp = Math.max(0, mobHpExec - finalDmg);
            setMobHp(newHp);
            addLog(`${skill.name} lifetaps ${currentMobExec.name} for ${finalDmg}.`, 'damage');
            setHp((h) => Math.min(maxHp, h + finalDmg));
            if (breakRootOnHit) breakRootOnHit('mob');
          } else {
            addLog(`${currentMobExec.name}'s rune absorbs ${skill.name}.`, 'system');
          }
        }
        if (baseManaVal) {
          const amt = Math.max(0, Math.floor(baseManaVal));
          setMobMana((m) => Math.max(0, m - amt));
          setMana((m) => Math.min(maxMana, m + amt));
        }
        if (baseEndVal) {
          const amt = Math.max(0, Math.floor(baseEndVal));
          setMobEndurance((e) => Math.max(0, e - amt));
          setEndurance((e) => Math.min(maxEndurance, e + amt));
        }
        if (tickHp || tickManaVal || tickEndVal) {
          const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
          const tickIntervalSec = 3;
          if (durationSec <= 0) {
            addLog(`${skill.name} is missing duration; over-time tap skipped.`, 'error');
          } else {
            addEffect('mob', {
              name: skill.name,
              duration: durationSec,
              tickDamage: Math.max(0, Math.floor(tickHp || 0)),
              tickMana: Math.max(0, Math.floor(tickManaVal || 0)),
              tickEndurance: Math.max(0, Math.floor(tickEndVal || 0)),
              tapHp: Math.max(0, Math.floor(tickHp || 0)),
              tapMana: Math.max(0, Math.floor(tickManaVal || 0)),
              tapEndurance: Math.max(0, Math.floor(tickEndVal || 0)),
              tickInterval: tickIntervalSec,
              icon: spellIcon,
              type: 'lifetap'
            });
          }
        }
      } else if (effectType === 'dot') {
        if (!currentMobExec || mobHpExec <= 0) {
          addLog('No target to hit.', 'error');
          return;
        }

        setInCombat(true);
        setIsSitting(false);

        const spellModPct = (derivedStats.spellDmgMod || 0);
        const preMitTick = Math.max(1, Math.floor((tickHp || baseHp) * (1 + spellModPct / 100)));
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        const tickIntervalSec = 3;
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; DoT skipped.`, 'error');
          return;
        }
        const { final: resistedTick } = mitigateSpellDamageVsMob(preMitTick, school);
        if (resistedTick <= 0) {
          addLog(`${currentMobExec.name} resists ${skill.name}!`, 'system');
          return;
        }
        const tickDamage = Math.max(1, resistedTick);

        addEffect('mob', {
          name: skill.name,
          duration: durationSec,
          tickDamage,
          tickInterval: tickIntervalSec,
          icon: spellIcon,
          school,
          tapHp: skill.effect_type === 'lifetap' ? tickDamage : 0
        });

        addLog(`${skill.name} afflicts ${currentMobExec.name}!`, 'damage');
      } else if (effectType === 'heal') {
        const healModPct = derivedStats.healMod || 0;
        const healAmount = Math.max(1, Math.floor(baseHp * (1 + healModPct / 100)));
        setHp((prev) => Math.min(effectiveMaxHp, prev + healAmount));
        addLog(`You cast ${skill.name} and heal for ${healAmount}!`, 'heal');
      } else if (effectType === 'hot') {
        const healModPct = derivedStats.healMod || 0;
        const tickHeal = Math.max(1, Math.floor((tickHp || baseHp) * (1 + healModPct / 100)));
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        const tickIntervalSec = 3;
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; HoT skipped.`, 'error');
          return;
        }

        addEffect('player', {
          name: skill.name,
          duration: durationSec,
          tickHeal,
          tickInterval: tickIntervalSec,
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });

        addLog(`You cast ${skill.name}.`, 'heal');
      } else if (effectType === 'manarestore' || effectType === 'endrestore') {
        const isMana = effectType === 'manarestore';
        const base = isMana ? baseManaVal : baseEndVal;
        const tick = isMana ? tickManaVal : tickEndVal;
        const amount = Math.max(1, Math.floor(base));
        const tickAmount = Math.max(0, Math.floor(tick));
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        const tickIntervalSec = 3;

        if (tickAmount > 0) {
          if (durationSec <= 0) {
            addLog(`${skill.name} is missing duration; over-time restore skipped.`, 'error');
          } else {
            addEffect('player', {
              name: skill.name,
              duration: durationSec,
              tickMana: isMana ? tickAmount : 0,
              tickEndurance: isMana ? 0 : tickAmount,
              tickInterval: tickIntervalSec,
              icon: spellIcon,
              onExpire: `${skill.name} fades.`
            });
            addLog(`You cast ${skill.name}.`, 'heal');
          }
        } else {
          if (isMana) {
            setMana((prev) => Math.min(effectiveMaxMana, prev + amount));
          } else {
            setEndurance((prev) => Math.min(effectiveMaxEndurance, prev + amount));
          }
          addLog(`You restore ${amount} ${isMana ? 'mana' : 'endurance'} with ${skill.name}.`, 'heal');
        }
      } else if (effectType === 'manadrain') {
        if (!currentMobExec || mobManaExec <= 0) {
          addLog('No target to drain.', 'error');
          return;
        }
        setInCombat(true);
        setIsSitting(false);
        const amount = Math.max(0, Math.floor(baseManaVal));
        const tickAmount = Math.max(0, Math.floor(tickManaVal));
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        const tickIntervalSec = 3;

        if (amount > 0) {
          setMobMana((prev) => Math.max(0, prev - amount));
          if (skill.effect_type === 'lifetap') {
            setMana((prev) => Math.min(maxMana, prev + amount));
          }
          addLog(`${skill.name} drains ${amount} mana from ${currentMobExec.name}.`, 'damage');
        }

        if (tickAmount > 0) {
          if (durationSec <= 0) {
            addLog(`${skill.name} is missing duration; over-time mana drain skipped.`, 'error');
          } else {
            addEffect('mob', {
              name: skill.name,
              duration: durationSec,
              tickMana: tickAmount,
              tapMana: skill.effect_type === 'lifetap' ? tickAmount : 0,
              tickInterval: tickIntervalSec,
              icon: spellIcon,
              onExpire: `${skill.name} fades.`
            });
            addLog(`${skill.name} begins draining ${tickAmount} mana/tick from ${currentMobExec.name}.`, 'damage');
          }
        }
      } else if (effectType === 'enddrain') {
        if (!currentMobExec || mobEndExec <= 0) {
          addLog('No target to drain.', 'error');
          return;
        }
        setInCombat(true);
        setIsSitting(false);
        const amount = Math.max(0, Math.floor(baseEndVal));
        const tickAmount = Math.max(0, Math.floor(tickEndVal));
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        const tickIntervalSec = 3;

        if (amount > 0) {
          setMobEndurance((prev) => Math.max(0, prev - amount));
          if (skill.effect_type === 'lifetap') {
            setEndurance((prev) => Math.min(maxEndurance, prev + amount));
          }
          addLog(`${skill.name} drains ${amount} endurance from ${currentMobExec.name}.`, 'damage');
        }

        if (tickAmount > 0) {
          if (durationSec <= 0) {
            addLog(`${skill.name} is missing duration; over-time endurance drain skipped.`, 'error');
          } else {
            addEffect('mob', {
              name: skill.name,
              duration: durationSec,
              tickEndurance: tickAmount,
              tapEndurance: skill.effect_type === 'lifetap' ? tickAmount : 0,
              tickInterval: tickIntervalSec,
              icon: spellIcon,
              onExpire: `${skill.name} fades.`
            });
            addLog(`${skill.name} begins draining ${tickAmount} endurance/tick from ${currentMobExec.name}.`, 'damage');
          }
        }
      } else if (effectType === 'movespeed' || effectType === 'root') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; movespeed effect skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        const moveMod = Number(skill.mod_move);
        if (!Number.isFinite(moveMod)) {
          throw new Error(`${skill.name} is missing mod_move; movespeed/root effects require mod_move in the DB.`);
        }
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          statMods: { mod_move: moveMod },
          icon: spellIcon,
          type: effectType === 'root' ? 'root' : 'movespeed',
          casterCha: getCasterCha ? getCasterCha(target === 'player' ? 'mob' : 'player') : 0,
          onExpire: `${skill.name} fades.`
        });
        addLog(`${skill.name} alters movement speed.`, 'system');
      } else if (effectType === 'delay') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; delay effect skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          statMods: { mod_delay: skill.mod_delay || 0 },
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });
        addLog(`${skill.name} alters attack speed.`, 'system');
      } else if (effectType === 'attack') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; attack mod skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          statMods: { mod_damage: skill.mod_damage || 0 },
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });
        addLog(`${skill.name} alters attack damage.`, 'system');
      } else if (effectType === 'dmgshield') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; damage shield skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          damageShield: Math.max(0, Math.floor(skill.base_hp || 0)),
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });
        addLog(`${skill.name} forms a damage shield.`, 'system');
      } else if (effectType === 'rune') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; rune skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        const runeAmt = Math.max(0, Math.floor(skill.base_hp || 0));
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          rune: runeAmt,
          runeRemaining: runeAmt,
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });
        addLog(`${skill.name} creates a protective rune.`, 'system');
      } else if (effectType === 'mez') {
        const durationSec = Math.max(0, Math.floor(skill.base_hp || 0));
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; mez skipped.`, 'error');
          return;
        }
        const target = skill.target === 'self' ? 'player' : 'mob';
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          icon: spellIcon,
          onExpire: `${skill.name} fades.`,
          type: 'mez'
        });
        addLog(`${skill.name} mesmerizes the ${target === 'mob' ? currentMobExec?.name || 'target' : 'player'}.`, 'system');
      } else if (effectType === 'buff' || effectType === 'debuff') {
        const durationSec = Number(skill.duration_seconds ?? skill.durationSeconds ?? 0);
        if (durationSec <= 0) {
          addLog(`${skill.name} is missing duration; ${effectType} skipped.`, 'error');
          return;
        }
        const target = effectType === 'buff' ? 'player' : 'mob';
        if (target === 'mob' && (!currentMobExec || mobHpExec <= 0)) {
          addLog('No target.', 'error');
          return;
        }
        if (target === 'mob') {
          setInCombat(true);
          setIsSitting(false);
        }
        const statMods = {
          str: skill.mod_str || 0,
          sta: skill.mod_sta || 0,
          agi: skill.mod_agi || 0,
          dex: skill.mod_dex || 0,
          int: skill.mod_int || 0,
          wis: skill.mod_wis || 0,
          cha: skill.mod_cha || 0,
          ac: skill.mod_ac || 0,
          mr: skill.mod_mr || 0,
          fr: skill.mod_fr || 0,
          cr: skill.mod_cr || 0,
          pr: skill.mod_pr || 0,
          dr: skill.mod_dr || 0,
          totalResist: skill.mod_total_resist || 0,
          damage: skill.mod_damage || 0,
          delay: skill.mod_delay || 0,
          mod_move: skill.mod_move || 0,
          mod_spell_dmg_pct: skill.mod_spell_dmg_pct || 0,
          mod_heal_pct: skill.mod_heal_pct || 0,
          mod_max_hp: skill.mod_max_hp || 0,
          mod_max_mana: skill.mod_max_mana || 0,
          mod_max_endurance: skill.mod_max_endurance || 0,
          mod_hp_regen: skill.mod_hp_regen || 0,
          mod_mana_regen: skill.mod_mana_regen || 0,
          mod_endurance_regen: skill.mod_endurance_regen || 0
        };
        addEffect(target, {
          name: skill.name,
          duration: durationSec,
          statMods,
          icon: spellIcon,
          onExpire: `${skill.name} fades.`
        });
        addLog(target === 'player' ? `You cast ${skill.name}.` : `${skill.name} weakens ${currentMobExec.name}!`, 'system');
      } else {
        addLog(`${skill.name} has unsupported effect type: ${effectType}`, 'error');
        throw new Error(`Unsupported effect_type '${effectType}' for skill ${skill.id || skill.name || 'unknown'}`);
      }
    };

    if (castMs > 0) {
      addLog(`You begin casting ${skill.name}...`, 'system');
      const startTs = Date.now();
      setCastingState({
        skillId: skill.id,
        name: skill.name,
        startedAt: startTs,
        endsAt: startTs + castMs,
        durationMs: castMs
      });
      castTimeoutRef.current = setTimeout(() => {
        castTimeoutRef.current = null;
        setCastingState(null);
        executeSkill();
      }, castMs);
    } else {
      executeSkill();
    }
  };

  return { handleUseSkill, isSkillOnCooldown };
}
