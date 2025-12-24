import { useState, useMemo, useEffect } from 'react';
import { saveSpellSlots } from '../services/playerStorage';

export function useSkillSlots({
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
}) {
  const abilitySlotCount = 6;
  const spellSlotCount = 6;

  // Built-in abilities (Attack, Auto, Sit/Stand, Flee)
  const builtInAbilities = useMemo(() => ([
    { id: 'builtin-attack', name: 'Attack', iconIndex: 0, type: 'builtin' },
    { id: 'builtin-auto', name: 'Auto', iconIndex: 37, type: 'builtin' },
    { id: 'builtin-sit', name: isSitting ? 'Stand' : 'Sit', iconIndex: 22, type: 'builtin' },
    { id: 'builtin-flee', name: 'Flee', iconIndex: 4, type: 'builtin' }
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
    const defaults = ['builtin-auto', 'builtin-flee'];
    defaults.forEach((id, idx) => {
      if (idx < base.length) base[idx] = id;
    });
    return base;
  });

  // Learned ability slots (non-spell skills)
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

  // Merged ability slots (builtin + learned)
  const mergedAbilitySlots = useMemo(() => {
    const combined = Array(abilitySlotCount).fill(null);
    abilitySlots.forEach((slot, idx) => { combined[idx] = slot; });
    builtinAbilitySlots.forEach((slotId, idx) => {
      if (slotId && builtInAbilityMap[slotId]) combined[idx] = builtInAbilityMap[slotId];
    });
    return combined;
  }, [abilitySlots, builtinAbilitySlots, abilitySlotCount, builtInAbilityMap]);

  // Ability options (for UI selection)
  const abilityOptions = useMemo(() => ([
    ...builtInAbilities.filter((a) => a.id !== 'builtin-attack' && a.id !== 'builtin-sit'),
    ...knownSkills.filter((s) => s.type !== 'spell')
  ]), [builtInAbilities, knownSkills]);

  // Spell slots
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

  // Auto-attack chain setup for turn-based combat
  useEffect(() => {
    if (!setAutoAttackChain) {
      // Fallback to old 250ms interval if timing system not available
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
    } else {
      // Use new turn-based combat timing system
      if (isAutoAttack) {
        const autoIdx = mergedAbilitySlots.findIndex((s) => s?.id === 'builtin-auto');
        const autoChain = autoIdx >= 0 ? mergedAbilitySlots.slice(0, autoIdx) : [];
        setAutoAttackChain(autoChain);
      } else {
        setAutoAttackChain([]);
        if (autoAttackInterval.current) {
          clearInterval(autoAttackInterval.current);
          autoAttackInterval.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAttack, mergedAbilitySlots, setAutoAttackChain]);

  // Persist slots to database
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

  // Assign ability to slot
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

  // Clear ability slot
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

  // Assign spell to slot
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

  // Clear spell slot
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

  return {
    // Slots
    abilitySlots: mergedAbilitySlots,
    spellSlots,
    abilityOptions,

    // Actions
    assignAbilityToSlot,
    assignSpellToSlot,
    clearAbilitySlot,
    clearSpellSlot
  };
}
