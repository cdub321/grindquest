import { useEffect, useRef } from 'react';
import { loadCharacter } from '../services/playerStorage';
import { slotOrder, CARRY_START } from '../services/inventoryManager';

export function useCharacterLoader({
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
}) {
  const lastUserIdRef = useRef(null);
  const lastCharacterIdRef = useRef(null);

  useEffect(() => {
    if (!characterId || !user) return;
    if (!items || !Object.keys(items || {}).length) return;
    if (!skills || skills.length === 0) return;

    // Avoid reloading the same profile repeatedly (e.g., tab blur auth jitters)
    if (user.id === lastUserIdRef.current && characterId === lastCharacterIdRef.current) {
      return;
    }

    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const { character, inventory: inv, spells: learnedRows } = await loadCharacter(characterId);
        const classKey = character.class_id || character.class || '';
        const loadedClass = classes[classKey] || {};

        setCharacterName(character.name || '');
        setPlayerClassKey(classKey);
        setMode(character.mode || 'normal');
        setKilledAt(character.killed_at || null);
        setRaceId(character.race_id || null);
        setDeityId(character.deity_id || null);
        setLevel(character.level);
        setXp(character.xp);
        const lastZone = character.zone_id || null;
        const bindZone = character.bind_zone_id || lastZone;
        setBindZoneId(bindZone);
        // Always move to bind on load and persist zone immediately
        if (bindZone) {
          setCurrentZoneId(bindZone);
          scheduleSave?.(
            {
              character: { zone_id: bindZone }
            },
            { immediate: true }
          );
        } else {
          setCurrentZoneId(lastZone);
        }
        setCurrentCampId(null);
        setCurrentMob(null);
        setMobHp(0);
        setMobMana(0);
        setMobEndurance(0);
        setInCombat(false);
        setIsSitting(false);
        setIsAutoAttack(false);
        setFleeExhausted(false);
        setSkillCooldowns({});
        // Restore active effects from saved data
        const nowMs = Date.now();
        const rawEffects = character.active_effects || [];
        const reviveEffect = (e) => {
          const endMs = e.endsAt ? new Date(e.endsAt).getTime() : 0;
          const remainingMs = endMs ? endMs - nowMs : 0;
          const durationSec = Math.max(0, Math.ceil(remainingMs / 1000));
          if (!durationSec) return null;
          return {
            id: e.id || `loaded-${Math.random().toString(16).slice(2)}`,
            name: e.name || 'Effect',
            type: e.type || null,
            statMods: e.statMods || null,
            icon: e.icon || null,
            tickDamage: e.tickDamage || 0,
            tickHeal: e.tickHeal || 0,
            tickMana: e.tickMana || 0,
            tickEndurance: e.tickEndurance || 0,
            tapHp: e.tapHp || 0,
            tapMana: e.tapMana || 0,
            tapEndurance: e.tapEndurance || 0,
            damageShield: e.damageShield || 0,
            rune: e.rune || 0,
            runeRemaining: e.runeRemaining ?? e.rune ?? 0,
            tickInterval: (e.tickInterval || 3) * 1000,
            lastTick: nowMs,
            expiresAt: nowMs + durationSec * 1000,
            duration: durationSec,
            casterCha: e.casterCha || 0,
            onExpire: e.onExpire || null
          };
        };
        const playerRestored = [];
        const mobRestored = [];
        rawEffects.forEach((e) => {
          const revived = reviveEffect(e);
          if (!revived) return;
          if (e.target === 'mob') {
            mobRestored.push(revived);
          } else {
            playerRestored.push(revived);
          }
        });
        setPlayerEffects(playerRestored);
        setMobEffects(mobRestored);
        const cooldowns = character.cooldowns || {};
        setSkillCooldowns(
          Object.fromEntries(
            Object.entries(cooldowns || {}).map(([k, v]) => [k, new Date(v).getTime() || 0])
          )
        );
        setFleeExhausted(false);
        setCopper(character.currency?.copper || 0);
        setSilver(character.currency?.silver || 0);
        setGold(character.currency?.gold || 0);
        setPlatinum(character.currency?.platinum || 0);

        const learned = (learnedRows || []).reduce((arr, row) => {
          const data = skills.find((s) => s.id === row.skill_id);
          if (!data) return arr;
          const gemIconIndex = data.gemicon ?? data.gemIcon ?? data.gem_icon ?? null;
          const spellIconIndex = data.spellicon ?? data.spellIcon ?? data.spell_icon ?? data.icon ?? data.iconIndex ?? null;
          arr.push({
            ...data,
            iconIndex: spellIconIndex, // backward compat for any legacy callers
            gemIconIndex,
            spellIconIndex,
            ability_slot: row.ability_slot || 0,
            spell_slot: row.spell_slot || 0,
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
            stackable: base.stackable ?? false,
            maxStack: base.maxStack || 1,
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
        const baseHpVal = Number(character.base_hp ?? 0) || 0;
        const baseManaVal = Number(character.base_mana ?? 0) || 0;
        const baseEndVal = Number(character.base_endurance ?? 0) || 0;
        setBaseVitals?.({
          hp: baseHpVal,
          mana: baseManaVal,
          endurance: baseEndVal
        });
        setMaxHp(baseHpVal);
        setHp((character.hp ?? baseHpVal) || 0);
        setMaxMana(baseManaVal);
        setMana((character.mana ?? baseManaVal) || 0);
        setMaxEndurance(baseEndVal);
        setEndurance((character.endurance ?? baseEndVal) || 0);
        // We reset encounter state on load, so skip restoring mob/effects here.
        setIsSelectingCharacter(false);
        setIsCreatingCharacter(false);
        setLoadError('');
        lastUserIdRef.current = user.id;
        lastCharacterIdRef.current = characterId;
        setProfileHydrated?.(true);
        if (profileHydratedRef) {
          profileHydratedRef.current = true;
        }
      } catch (err) {
        console.error(err);
        addLog('Failed to load profile.', 'error');
        setLoadError('Failed to load profile. Please re-select a character.');
        setIsSelectingCharacter(true);
      } finally {
        setIsProfileLoading(false);
      }
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, user, items, skills, classes]);
}
