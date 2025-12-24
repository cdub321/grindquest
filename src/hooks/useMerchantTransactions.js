import { useCallback, useEffect, useState } from 'react';

/**
 * Encapsulates merchant stock state, pricing, and buy/sell flows.
 */
export function useMerchantTransactions({
  items,
  statTotals,
  merchantStockData,
  currency,
  setCurrency,
  coinsToCp,
  cpToCoins,
  addLog,
  addItemToInventory,
  createItemInstance,
  scheduleSave,
  setSlots,
  slotsRef,
  updateMerchantStock
}) {
  const [merchantStockState, setMerchantStockState] = useState({});

  useEffect(() => {
    setMerchantStockState(merchantStockData || {});
  }, [merchantStockData]);

  const getBasePrice = useCallback((itemId) => {
    if (!itemId) return 0;
    const item = items[itemId];
    return Number(item?.price ?? 0) || 0;
  }, [items]);

  const chaPriceMod = useCallback(() => {
    const chaVal = statTotals.cha || 0;
    return Math.max(0, Math.floor(chaVal / 10) * 0.05);
  }, [statTotals]);

  const getBuyPrice = useCallback((itemId, qty = 1) => {
    const base = getBasePrice(itemId);
    if (!base) return 0;
    const mod = chaPriceMod();
    return Math.max(1, Math.round(base * qty * (1 - mod)));
  }, [chaPriceMod, getBasePrice]);

  const getSellPrice = useCallback((itemId, qty = 1) => {
    const base = getBasePrice(itemId);
    if (!base) return 0;
    const mod = chaPriceMod();
    return Math.max(1, Math.round(base * qty * (1 + mod)));
  }, [chaPriceMod, getBasePrice]);

  const adjustMerchantStock = useCallback((merchantId, itemId, delta, price = 0) => {
    if (!merchantId || !itemId || !delta) return;
    setMerchantStockState((prev) => {
      const existing = prev[merchantId] || [];
      const next = [...existing];
      const idx = next.findIndex((row) => `${row.item_id}` === `${itemId}`);
      if (idx !== -1) {
        const currentStock = Number.isFinite(next[idx].stock) ? Number(next[idx].stock) : 1;
        const currentPrice = Number(next[idx].price) || price || 0;
        const updated = currentStock + delta;
        if (updated <= 0) {
          next.splice(idx, 1);
        } else {
          const newPrice =
            delta > 0
              ? Math.round(((currentStock * currentPrice) + (delta * (price || currentPrice))) / Math.max(1, currentStock + delta))
              : currentPrice;
          next[idx] = { ...next[idx], stock: updated, price: newPrice };
        }
      } else if (delta > 0) {
        next.push({ item_id: itemId, stock: delta, price, weight: 1 });
      }
      return { ...prev, [merchantId]: next };
    });
  }, []);

  const handleBuyFromMerchant = useCallback(
    async (merchantId, itemId) => {
      if (!merchantId) {
        addLog('No merchant selected.', 'error');
        return;
      }
      const priceCp = getBuyPrice(itemId, 1);
      if (!priceCp) {
        addLog('This item has no price set.', 'error');
        return;
      }
      const totalCp = coinsToCp(currency);
      if (priceCp > totalCp) {
        addLog('You do not have enough coin.', 'error');
        return;
      }
      const stockList = merchantStockState[merchantId] || [];
      const row = stockList.find((r) => `${r.item_id}` === `${itemId}`);
      const currentStock = Number.isFinite(row?.stock) ? Number(row.stock) : null;
      if (currentStock !== null && currentStock <= 0) {
        addLog('That item is sold out.', 'error');
        return;
      }

      const newCoins = cpToCoins(totalCp - priceCp);
      setCurrency(newCoins);
      addItemToInventory(createItemInstance(itemId), 1);
      scheduleSave(
        {
          character: { currency: newCoins },
          inventory: true
        },
        { immediate: true }
      );
      adjustMerchantStock(merchantId, itemId, -1, getBasePrice(itemId));
      try {
        await updateMerchantStock({
          merchantId,
          itemId,
          delta: -1,
          price: getBasePrice(itemId)
        });
      } catch (err) {
        console.error('Failed to update merchant stock', err);
        addLog('Purchase saved, but merchant stock update failed.', 'error');
      }
      addLog(`You buy ${items[itemId]?.name || itemId} for ${priceCp} cp.`, 'system');
    },
    [
      addItemToInventory,
      addLog,
      adjustMerchantStock,
      coinsToCp,
      cpToCoins,
      currency,
      getBasePrice,
      getBuyPrice,
      items,
      merchantStockState,
      scheduleSave,
      setCurrency,
      updateMerchantStock
    ]
  );

  const handleSellToMerchant = useCallback(
    async (merchantId, entry) => {
      if (!merchantId) {
        addLog('No merchant selected.', 'error');
        return;
      }
      if (!entry?.item) return;
      const baseId = entry.item.baseItemId || entry.item.base_item_id || entry.item.id;
      const basePrice = getBasePrice(baseId);
      if (!basePrice) {
        addLog('This item has no price set.', 'error');
        return;
      }
      const qty = entry.item.quantity || 1;
      const sellPrice = getSellPrice(baseId, qty);
      const existingRow = (merchantStockState[merchantId] || []).find((r) => `${r.item_id}` === `${baseId}`);
      const currentStock = Number.isFinite(existingRow?.stock) ? Number(existingRow.stock) : 0;
      const currentPrice = Number(existingRow?.price) || basePrice;
      const newAvgPrice = Math.round(((currentStock * currentPrice) + (qty * basePrice)) / Math.max(1, currentStock + qty));
      const totalCp = coinsToCp(currency) + sellPrice;
      const newCoins = cpToCoins(totalCp);
      setCurrency(newCoins);

      setSlots((prev) => {
        const next = [...prev];
        const parent = next[entry.slotIndex];
        if (!parent) return prev;
        if (entry.containerIndex === null || entry.containerIndex === undefined) {
          next[entry.slotIndex] = null;
        } else if (parent.contents) {
          const contents = [...parent.contents];
          if (!contents[entry.containerIndex]) return prev;
          contents[entry.containerIndex] = null;
          next[entry.slotIndex] = { ...parent, contents };
        }
        slotsRef.current = next;
        return next;
      });

      scheduleSave(
        {
          character: { currency: newCoins },
          inventory: true
        },
        { immediate: true }
      );

      adjustMerchantStock(merchantId, baseId, qty, newAvgPrice);
      try {
        await updateMerchantStock({
          merchantId,
          itemId: baseId,
          delta: qty,
          price: newAvgPrice
        });
      } catch (err) {
        console.error('Failed to update merchant stock after selling', err);
        addLog('Sale completed, but merchant stock update failed.', 'error');
      }
      addLog(`You sell ${entry.item.name || baseId} for ${sellPrice} cp.`, 'system');
    },
    [
      addLog,
      adjustMerchantStock,
      coinsToCp,
      cpToCoins,
      currency,
      getBasePrice,
      getSellPrice,
      merchantStockState,
      scheduleSave,
      setCurrency,
      setSlots,
      slotsRef,
      updateMerchantStock
    ]
  );

  return {
    merchantStockState,
    getBuyPrice,
    getSellPrice,
    handleBuyFromMerchant,
    handleSellToMerchant
  };
}
