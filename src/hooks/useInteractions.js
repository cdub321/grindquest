import { useCallback, useState } from 'react';
import { loadBank, saveBank } from '../services/playerStorage';

export function useInteractions({ characterId, items, addLog }) {
  const [interaction, setInteraction] = useState(null);
  const [bankSlots, setBankSlots] = useState([]);
  const [isBankLoading, setIsBankLoading] = useState(false);

  const saveBankSafe = useCallback(async (slots) => {
    try {
      await saveBank(characterId, slots);
    } catch (err) {
      console.error('Bank save failed', err);
      addLog?.('Failed to save bank.', 'error');
      throw err;
    }
  }, [addLog, characterId]);

  const parseTags = (val) => {
    if (!val) return {};
    if (typeof val === 'object' && !Array.isArray(val)) return val;
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

  const openInteraction = useCallback(
    async (npc) => {
      const tagsObj = parseTags(npc?.tags || npc?.tagsObj);
      if (tagsObj.Merchant) {
        setInteraction({ type: 'merchant', npc, merchantId: tagsObj.Merchant });
        return;
      }
      if (tagsObj.Banker) {
        setIsBankLoading(true);
        try {
          const rows = await loadBank(characterId);
          const normalized = rows.map((row) => {
            const baseKey = row.base_item_id || row.baseItemId;
            const base = items?.[baseKey] || {};
            return {
              id: row.id || `${baseKey}-${Math.random().toString(16).slice(2)}`,
              baseItemId: base.id || baseKey,
              name: base.name || row.name || baseKey,
              slot: 'bank',
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
          setIsBankLoading(false);
        }
      }
    },
    [addLog, characterId, items]
  );

  const closeInteraction = useCallback(() => {
      setInteraction(null);
    }, []);

  const withdrawFromBank = useCallback(async (row) => {
    const remaining = bankSlots.filter((r) => r.id !== row.id);
    setBankSlots(remaining);
    await saveBankSafe(remaining);
    return row;
  }, [addLog, bankSlots, characterId, saveBankSafe]);

  const depositToBank = useCallback(async (rows = []) => {
    const next = [...bankSlots, ...rows];
    setBankSlots(next);
    await saveBankSafe(next);
    return true;
  }, [bankSlots, saveBankSafe]);

  return {
    interaction,
    openInteraction,
    closeInteraction,
    bankSlots,
    isBankLoading,
    withdrawFromBank,
    depositToBank,
    setBankSlots
  };
}
