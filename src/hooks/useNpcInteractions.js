import { useCallback, useState } from 'react';
import { loadBank, saveBank } from '../services/playerStorage';

export function useNpcInteractions({ characterId, items, addLog, scheduleSave }) {
  const [interaction, setInteraction] = useState(null); // { type: 'merchant'|'banker', npc, merchantId?, bankSlots? }
  const [bankSlots, setBankSlots] = useState([]);
  const [isLoadingBank, setIsLoadingBank] = useState(false);

  const openInteraction = useCallback(
    async (npc) => {
      if (!npc?.tagsObj) return;
      if (npc.tagsObj.Merchant) {
        setInteraction({ type: 'merchant', npc, merchantId: npc.tagsObj.Merchant });
        return;
      }
      if (npc.tagsObj.Banker) {
        setIsLoadingBank(true);
        try {
          if (!characterId) throw new Error('Missing characterId for bank load');
          const rows = await loadBank(characterId);
          const normalized = rows.map((row) => {
            const baseKey = row.base_item_id || row.baseItemId;
            const base = items?.[baseKey] || {};
            return {
              id: row.id || `${baseKey}-${Math.random().toString(16).slice(2)}`,
              baseItemId: base.id || baseKey,
              name: base.name || row.name || baseKey,
              slot: base.slot || row.slot || 'bank',
              bonuses: base.bonuses || {},
              iconIndex: base.iconIndex ?? null,
              quantity: row.quantity || 1,
              stackable: base.stackable ?? false,
              maxStack: base.maxStack || 1,
              slot_id: row.slot_id || null,
              item_data: row.item_data || null
            };
          });
          setBankSlots(normalized);
          setInteraction({ type: 'banker', npc, bankSlots: normalized });
        } catch (err) {
          console.error('Bank load failed', err);
          addLog?.('Failed to load bank.', 'error');
        } finally {
          setIsLoadingBank(false);
        }
      }
    },
    [addLog, characterId, items]
  );

  const closeInteraction = useCallback(() => {
    setInteraction(null);
  }, []);

  const saveBankSlots = useCallback(async (slots) => {
    setBankSlots(slots);
    if (!characterId) return;
    try {
      await saveBank(characterId, slots);
      scheduleSave?.({}); // no-op to keep signature; bank already persisted
    } catch (err) {
      console.error('Bank save failed', err);
      addLog?.('Failed to save bank.', 'error');
    }
  }, [addLog, characterId, scheduleSave]);

  return {
    interaction,
    openInteraction,
    closeInteraction,
    bankSlots,
    setBankSlots: saveBankSlots,
    isLoadingBank
  };
}
