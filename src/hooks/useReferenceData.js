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
  const [currentCampId, setCurrentCampId] = useState(null);
  const [initialZoneId, setInitialZoneId] = useState('');

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
          campMembersResult
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
          fetchCampMembers().catch(() => [])
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
              iconIndex: it.icon_index ?? it.icon ?? null,
              bonuses: {
                damage: it.damage || 0,
                delay: it.delay || null,
                haste: it.haste_bonus || 0,
                hp: it.hp_bonus || 0,
                mana: it.mana_bonus || 0,
                endurance: it.endurance_bonus || it.end_bonus || it.end || 0,
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
        const mobTemplateMap = (mobTemplatesResult || []).reduce((acc, row) => {
          acc[row.id] = row;
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
              isNamed: row.is_named ?? template.is_named,
              ac: row.ac || template.ac || 0,
              mr: row.mr || template.mr || 0,
              fr: row.fr || template.fr || 0,
              cr: row.cr || template.cr || 0,
              pr: row.pr || template.pr || 0,
              dr: row.dr || template.dr || 0,
              lootTableId: row.loot_table_id || template.loot_table_id || template.loot_table || null
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
        const firstZoneId = Object.keys(zonesMap)[0] || '';
        if (firstZoneId) setInitialZoneId(firstZoneId);
        if (campsResult?.length) {
          const grouped = campsResult.reduce((acc, camp) => {
            if (!camp.zone_id) return acc;
            acc[camp.zone_id] = acc[camp.zone_id] || [];
            acc[camp.zone_id].push({
              id: camp.id,
              zone_id: camp.zone_id,
              name: camp.name,
              notes: camp.notes,
              key_item: camp.key_item
            });
            return acc;
          }, {});
          setCampsByZone(grouped);
          const zoneCamps = grouped[firstZoneId] || [];
          if (!currentCampId && zoneCamps.length) {
            setCurrentCampId(zoneCamps[0].id);
          }
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
    currentCampId,
    setCurrentCampId,
    initialZoneId
  };
}
