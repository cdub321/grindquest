import { useEffect, useState } from 'react';
import {
  fetchClassesCatalog,
  fetchDeities,
  fetchDeityClassAllowed,
  fetchItemsCatalog,
  fetchSkillsCatalog,
  fetchMobTemplates,
  fetchLootTables,
  fetchLootTableEntries,
  fetchCamps,
  fetchCampMembers,
  fetchMerchantItems,
  fetchZonesAndConnections,
  fetchRaceClassAllowed,
  fetchRaces
} from '../services/referenceData';

export function useReferenceData() {
  const [classCatalog, setClassCatalog] = useState([]);
  const [races, setRaces] = useState([]);
  const [deities, setDeities] = useState([]);
  const [raceClassAllowed, setRaceClassAllowed] = useState([]);
  const [deityClassAllowed, setDeityClassAllowed] = useState([]);
  const [zones, setZones] = useState({});
  const [items, setItems] = useState({});
  const [skills, setSkills] = useState([]);
  const [campMembers, setCampMembers] = useState({});
  const [campsByZone, setCampsByZone] = useState({});
  const [lootTables, setLootTables] = useState({});
  const [merchantStock, setMerchantStock] = useState({});
  const [currentCampId, setCurrentCampId] = useState(null);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [
          cls,
          rcs,
          dts,
          rcMap,
          dcMap,
          zonesResult,
          itemsResult,
          skillsResult,
          campsResult,
          mobTemplatesResult,
          lootTablesResult,
          lootEntriesResult,
          campMembersResult,
          merchantItemsResult
        ] = await Promise.all([
          fetchClassesCatalog(),
          fetchRaces(),
          fetchDeities(),
          fetchRaceClassAllowed(),
          fetchDeityClassAllowed(),
          fetchZonesAndConnections(),
          fetchItemsCatalog(),
          fetchSkillsCatalog(),
          fetchCamps().catch(() => []),
          fetchMobTemplates().catch(() => []),
          fetchLootTables().catch(() => []),
          fetchLootTableEntries().catch(() => []),
          fetchCampMembers().catch(() => []),
          fetchMerchantItems().catch(() => [])
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
              id: it.id,
              name: it.name,
              slot: it.slot,
              price: Number(it.price ?? 0) || 0,
              stackable: it.stackable ?? false,
              maxStack: it.max_stack || 1,
              iconIndex: it.icon_index ?? it.icon ?? null,
              bonuses: {
                damage: it.damage || 0,
                delay: it.delay || null,
                range: it.range || null,
                ranged_damage: it.ranged_damage || 0,
                ranged_delay: it.ranged_delay || null,
                ammo_type: it.ammo_type || null,
                ammo_consumption: it.ammo_consumption ?? false,
                haste: it.haste_bonus || 0,
                hp: it.hp_bonus || 0,
                mana: it.mana_bonus || 0,
                endurance: it.endurance_bonus || it.end_bonus || it.end || 0,
                hpRegen: it.hp_regen || 0,
                manaRegen: it.mana_regen || 0,
                enduranceRegen: it.endurance_regen || 0,
                totalResist: it.total_resist || it.totalResist || 0,
                xp: it.xp_bonus || it.xpBonus || 0,
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
          });
          setItems(mapped);
        }
        if (skillsResult?.length) {
          setSkills(skillsResult);
        }

        if (lootEntriesResult?.length) {
          const groupedLoot = {};
          lootEntriesResult.forEach((row) => {
            const tableId = row.loot_table_id || row.table_id || row.id;
            if (!tableId) return;
            groupedLoot[tableId] = groupedLoot[tableId] || [];
            groupedLoot[tableId].push({
              item_id: row.item_id,
              drop_chance: row.drop_chance ?? row.chance ?? 0,
              min_qty: row.min_qty || 1,
              max_qty: row.max_qty || row.min_qty || 1
            });
          });
          setLootTables(groupedLoot);
        }
        const parseTags = (val) => {
          if (!val) return {};
          if (typeof val === 'object' && !Array.isArray(val)) return val;
          // Allow array-style tags such as ["banker","true"] or ["merchant","qeynos_1"]
          if (Array.isArray(val)) {
            const obj = {};
            val.forEach((entry, idx) => {
              if (typeof entry !== 'string') return;
              const lower = entry.toLowerCase();
              if (lower === 'banker') {
                obj.Banker = true;
                return;
              }
              if (lower === 'merchant') {
                const next = val[idx + 1];
                obj.Merchant = typeof next === 'string' ? next : true;
                return;
              }
              if (entry.includes(':')) {
                const [k, v] = entry.split(':');
                if (k?.toLowerCase() === 'merchant') obj.Merchant = v || true;
                if (k?.toLowerCase() === 'banker') obj.Banker = true;
              }
            });
            return obj;
          }
          try {
            return JSON.parse(val);
          } catch {
            return {};
          }
        };

        const mobTemplateMap = (mobTemplatesResult || []).reduce((acc, row) => {
          acc[row.id] = {
            ...row,
            melee_range: Number(row.melee_range ?? 10) || 10,
            aggro_range: Number(row.aggro_range ?? 10) || 10,
            tagsObj: parseTags(row.tags)
          };
          return acc;
        }, {});

        if (campMembersResult?.length) {
          const byCamp = {};
          campMembersResult.forEach((row) => {
            if (!byCamp[row.camp_id]) byCamp[row.camp_id] = [];
            const template = mobTemplateMap[row.mob_id] || {};
            byCamp[row.camp_id].push({
              id: row.mob_id,
              name: template.name || row.mob_name || row.name || row.mob_id,
              camp_id: row.camp_id,
              weight: row.weight || 0,
              hp: row.hp || template.hp || 0,
              mana: row.mana || template.mana || 0,
              endurance: row.endurance || row.end || template.endurance || template.end || 0,
              damage: row.damage || template.damage || 1,
              xp: row.xp || template.xp || 0,
              level: row.level || template.level || null,
              isNamed: row.is_named ?? template.is_named,
              ac: row.ac || template.ac || 0,
              mr: row.mr || template.mr || 0,
              fr: row.fr || template.fr || 0,
              cr: row.cr || template.cr || 0,
              pr: row.pr || template.pr || 0,
              dr: row.dr || template.dr || 0,
              max_level: row.max_level ?? template.max_level ?? template.maxLevel ?? null,
              delay: row.delay || template.delay,
              movespeed: row.movespeed || row.move_speed || template.movespeed || template.move_speed || 1,
              lootTableId: row.loot_table_id || template.loot_table_id || template.loot_table || null,
              melee_range: row.melee_range || template.melee_range || 10,
              aggro_range: row.aggro_range || template.aggro_range || 10,
              race_id: row.race_id ?? template.race_id ?? template.raceId ?? null,
              gender: row.gender ?? template.gender ?? 0,
              texture_id: row.texture_id ?? template.texture_id ?? template.textureId ?? 1,
              tags: row.tags || template.tags || [],
              tagsObj: parseTags(row.tags || template.tags)
            });
          });
          Object.keys(byCamp).forEach((campId) => {
            byCamp[campId] = byCamp[campId].sort((a, b) => (b.weight || 0) - (a.weight || 0));
          });
          setCampMembers(byCamp);
        }
        const zonesMap = {};
        if (zonesResult?.zones?.length) {
          zonesResult.zones.forEach((z) => {
            zonesMap[z.id] = {
              ...(zonesMap[z.id] || {}),
              name: z.name,
              biome: z.biome,
              hostility_tier: Number(z.hostility_tier ?? z.hostilityTier ?? 0) || 0,
              zone_area: Number(z.zone_area ?? 0) || 0,
              xp_mod: Number(z.zone_xp_mod ?? z.xp_mod ?? 1) || 1,
              connections: []
            };
          });
          (zonesResult.connections || []).forEach((c) => {
            if (zonesMap[c.from_zone]) {
              zonesMap[c.from_zone].connections = zonesMap[c.from_zone].connections || [];
              zonesMap[c.from_zone].connections.push(c.to_zone);
            }
          });
        }
        setZones(zonesMap);
        if (campsResult?.length) {
          const parseConnected = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            if (typeof val === 'object') return Object.values(val);
            try {
              const parsed = JSON.parse(val);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          };
          const grouped = campsResult.reduce((acc, camp) => {
            if (!camp.zone_id) return acc;
            acc[camp.zone_id] = acc[camp.zone_id] || [];
            acc[camp.zone_id].push({
              id: camp.id,
              zone_id: camp.zone_id,
              name: camp.name,
              notes: camp.notes,
              key_item: camp.key_item,
              spawn_time: camp.spawn_time ?? camp.respawn_seconds,
              camp_xp_mod: Number(camp.camp_xp_mod ?? camp.xp_mod ?? 1) || 1,
              camp_area: Number(camp.camp_area ?? 0) || 0,
              connections: parseConnected(camp.connected)
            });
            return acc;
          }, {});
          setCampsByZone(grouped);
        }

        if (merchantItemsResult?.length) {
          const grouped = {};
          merchantItemsResult.forEach((row) => {
            if (!row.merchant_id || !row.item_id) return;
            grouped[row.merchant_id] = grouped[row.merchant_id] || [];
            grouped[row.merchant_id].push({
              item_id: row.item_id,
              price: row.price || 0,
              stock: row.stock ?? null,
              weight: row.weight ?? 1
            });
          });
          setMerchantStock(grouped);
        }
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };
    loadReferenceData();
  }, []);

  return {
    classCatalog,
    races,
    deities,
    raceClassAllowed,
    deityClassAllowed,
    zones,
    items,
    skills,
    campMembers,
    campsByZone,
    lootTables,
    merchantStock,
    currentCampId,
    setCurrentCampId
  };
}
