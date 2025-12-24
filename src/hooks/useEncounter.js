import { useCallback, useRef } from 'react';

/**
 * Encounter logic: mob selection/spawning and loot/xp handling
 * Keeps data/side-effects out of useCombat.
 */
export function useEncounter({
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
  xpRate,
  characterXpMod,
  zoneXpMod,
  campXpMod,
  copper,
  silver,
  gold,
  platinum,
  scheduleSave,
  onInteraction = () => {}
}) {
  const lastKillRef = useRef({ mobKey: null, ts: 0 });
  const selectMobForCamp = useCallback(
    (campId) => {
      const mobList = campMembers[campId] || [];
      if (!mobList.length) {
        addLog('No mobs available in this zone.', 'error');
        throw new Error(`No mobs configured for camp ${campId}`);
      }

      const weights = mobList.map((mob) => {
        const weight = Number(mob.weight);
        if (!Number.isFinite(weight) || weight <= 0) {
          throw new Error(`Invalid weight for mob ${mob.id} in camp ${campId}`);
        }
        return weight;
      });

      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const randomValue = Math.random() * totalWeight;

      let cumulativeWeight = 0;
      for (let idx = 0; idx < mobList.length; idx += 1) {
        cumulativeWeight += weights[idx];
        const mob = mobList[idx];
        if (randomValue < cumulativeWeight) {
          return mob;
        }
      }

      return mobList[0];
    },
    [addLog, campMembers]
  );

  const normalizeMob = useCallback((selectedMob) => {
    const mobName = selectedMob.name || 'Unknown';
    const reqNum = (field, value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(`Mob ${mobName} missing required numeric field: ${field}`);
      }
      return num;
    };
    const optNum = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const baseLevel = reqNum('level', selectedMob.level);
    const maxLevel = optNum(selectedMob.max_level ?? selectedMob.maxLevel);
    const rolledLevel =
      maxLevel && maxLevel > baseLevel
        ? baseLevel + Math.floor(Math.random() * (maxLevel - baseLevel + 1))
        : baseLevel;

    return {
      ...selectedMob,
      name: mobName,
      level: rolledLevel,
      max_level: maxLevel,
      hp: reqNum('hp', selectedMob.hp),
      mana: reqNum('mana', selectedMob.mana),
      endurance: reqNum('endurance', selectedMob.endurance),
      damage: reqNum('damage', selectedMob.damage),
      xp: reqNum('xp', selectedMob.xp),
      ac: reqNum('ac', selectedMob.ac),
      delay: reqNum('delay', selectedMob.delay),
      movespeed: reqNum('movespeed', selectedMob.movespeed),
      melee_range: reqNum('melee_range', selectedMob.melee_range || 10),
      aggro_range: reqNum('aggro_range', selectedMob.aggro_range || 10),
      tags: selectedMob.tags || [],
      race_id: selectedMob.race_id ?? selectedMob.raceId ?? null,
      gender: selectedMob.gender ?? 0,
      texture_id: selectedMob.texture_id ?? selectedMob.textureId ?? 1
    };
  }, []);

  const spawnMob = useCallback(
    (campId = currentCampId) => {
      const selectedMob = selectMobForCamp(campId);
      if (!selectedMob) return null;

      const normalizedMob = normalizeMob(selectedMob);
      normalizedMob.distance = Math.max(0, Math.random() * (currentCamp?.camp_area || 0));

      const tagsObj = normalizedMob.tagsObj || {};
      if (tagsObj.Merchant || tagsObj.Banker) {
        setCurrentMob(null);
        setMobHp(0);
        setMobMana(0);
        setMobEndurance(0);
        onInteraction?.(normalizedMob);
        return null;
      }

      setCurrentMob(normalizedMob);
      setMobHp(normalizedMob.hp);
      setMobMana(normalizedMob.mana);
      setMobEndurance(normalizedMob.endurance);
      addLog(`${normalizedMob.name} spawns!`, 'spawn');
      return normalizedMob;
    },
    [addLog, currentCampId, normalizeMob, onInteraction, selectMobForCamp, setCurrentMob, setMobEndurance, setMobHp, setMobMana, currentCamp]
  );

  const handleMobKilled = useCallback(
    (mob) => {
      if (!mob) return;
      const now = Date.now();
      const mobKey = mob.id || mob.name || 'mob';
      if (lastKillRef.current.mobKey === mobKey && now - lastKillRef.current.ts < 1000) {
        return;
      }
      lastKillRef.current = { mobKey, ts: now };

      // XP calculation
      const baseXp = Number(mob.xp) || 0;
      const xpBonusPct = derivedStats?.xpBonus || 0;
      const bonusMultiplier = 1 + xpBonusPct / 100;
      const totalMultiplier =
        (xpRate || 1) *
        (characterXpMod || 1) *
        (zoneXpMod || 1) *
        (campXpMod || 1);
      const xpGain = Math.floor(baseXp * bonusMultiplier * totalMultiplier);
      const bonusPart = xpGain - baseXp;

      // Calculate new XP value directly to avoid stale closure issue
      const newXp = xp + xpGain;
      
      setXp(newXp);

      if (bonusPart > 0) {
        addLog(`You gain ${xpGain} experience! (+${bonusPart} bonus)`, 'xp');
      } else {
        addLog(`You gain ${xpGain} experience!`, 'xp');
      }

      // Save immediately with the calculated new XP value
      scheduleSave(
        {
          character: {
            level,
            xp: newXp,
            zone_id: currentZoneId,
            currency: { copper, silver, gold, platinum }
          },
          inventory: true
        },
        { immediate: true }
      );

      // Loot drops
      const lootTableKey = mob.loot_table_id || mob.lootTableId;
      const lootTable = (lootTableKey && lootTables[lootTableKey]) || [];

      lootTable.forEach((entry) => {
        if (entry.drop_chance == null) return;
        const def = items[entry.item_id];
        if (!def) return;
        if (Math.random() <= entry.drop_chance) {
          const qtyMin = entry.min_qty || 1;
          const qtyMax = entry.max_qty || qtyMin;
          const qty = Math.max(qtyMin, Math.ceil(Math.random() * qtyMax));
          const item = createItemInstance(def.id);
          addItemToInventory(item, qty);
          addLog(`You receive: ${def.name}${qty > 1 ? ` x${qty}` : ''}`, 'loot');
        }
      });

      const respawnSeconds = Number(currentCamp?.spawn_time);
      if (!Number.isFinite(respawnSeconds) || respawnSeconds <= 0) {
        addLog('Camp respawn time is not configured.', 'error');
        throw new Error(`Camp ${currentCamp?.id || 'unknown'} missing spawn_time`);
      }
      setTimeout(() => spawnMob(), respawnSeconds * 1000);
    },
    [
      addItemToInventory,
      addLog,
      copper,
      createItemInstance,
      currentZoneId,
      derivedStats?.xpBonus,
      gold,
      level,
      lootTables,
      platinum,
      scheduleSave,
      setLevel,
      setXp,
      silver,
      spawnMob,
      xp,
      items,
      currentCamp,
      xpRate,
      characterXpMod,
      zoneXpMod,
      campXpMod
    ]
  );

  return {
    spawnMob,
    handleMobKilled
  };
}
