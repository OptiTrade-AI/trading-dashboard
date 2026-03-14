'use client';

import { useCallback, useMemo } from 'react';
import { SpreadTrade, SpreadExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry, normalizeSpreadLegs } from '@/lib/utils';
import { createTradeHook } from './useTradeData';

function computeSpreadValues(trade: { longStrike: number; shortStrike: number; longPrice: number; shortPrice: number; contracts: number; spreadType: string }) {
  const isDebit = trade.spreadType === 'call_debit' || trade.spreadType === 'put_debit';

  // Normalize: if debit spread has negative netDebit (or credit spread has positive),
  // the user entered long/short prices in the wrong order — swap them
  let { longStrike, shortStrike, longPrice, shortPrice } = trade;
  const rawNetDebit = (longPrice - shortPrice) * 100 * trade.contracts;

  if ((isDebit && rawNetDebit < 0) || (!isDebit && rawNetDebit > 0)) {
    [longStrike, shortStrike] = [shortStrike, longStrike];
    [longPrice, shortPrice] = [shortPrice, longPrice];
  }

  const strikeDiff = Math.abs(longStrike - shortStrike);
  const netDebitPerContract = longPrice - shortPrice;
  const netDebit = netDebitPerContract * 100 * trade.contracts;

  const maxProfit = isDebit
    ? (strikeDiff - netDebitPerContract) * 100 * trade.contracts
    : Math.abs(netDebit);
  const maxLoss = isDebit
    ? netDebit
    : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * trade.contracts;

  return { netDebit, maxProfit, maxLoss, longStrike, shortStrike, longPrice, shortPrice };
}

const useSpreadBase = createTradeHook<SpreadTrade>({
  apiEndpoint: '/api/spreads',
  prepareNew: (input) => {
    const { netDebit, maxProfit, maxLoss, longStrike, shortStrike, longPrice, shortPrice } = computeSpreadValues(input as unknown as Parameters<typeof computeSpreadValues>[0]);
    return {
      ...input,
      longStrike,
      shortStrike,
      longPrice,
      shortPrice,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(input.entryDate as string, input.expiration as string),
      netDebit,
      maxProfit,
      maxLoss,
      status: 'open',
    } as SpreadTrade;
  },
  prepareClose: (_item, closeNetCredit, exitDate, exitReason, closeCommission) => ({
    status: 'closed' as const,
    closeNetCredit: closeNetCredit as number,
    exitDate: exitDate as string,
    exitReason: exitReason as SpreadExitReason,
    ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
  }),
  preparePartialClose: (rawItem, contractsToClose, closeNetCredit, exitDate, exitReason, closeCommission) => {
    // Normalize in case legs were entered in wrong order
    const item = normalizeSpreadLegs(rawItem);
    const remaining = item.contracts - contractsToClose;
    const strikeDiff = Math.abs(item.longStrike - item.shortStrike);
    const netDebitPerContract = item.longPrice - item.shortPrice;
    const isDebit = item.spreadType === 'call_debit' || item.spreadType === 'put_debit';

    const closedNetDebit = netDebitPerContract * 100 * contractsToClose;
    const closedMaxProfit = isDebit
      ? (strikeDiff - netDebitPerContract) * 100 * contractsToClose
      : Math.abs(closedNetDebit);
    const closedMaxLoss = isDebit
      ? closedNetDebit
      : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * contractsToClose;

    const remainingNetDebit = netDebitPerContract * 100 * remaining;
    const remainingMaxProfit = isDebit
      ? (strikeDiff - netDebitPerContract) * 100 * remaining
      : Math.abs(remainingNetDebit);
    const remainingMaxLoss = isDebit
      ? remainingNetDebit
      : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * remaining;

    return {
      closedPortion: {
        longStrike: item.longStrike,
        shortStrike: item.shortStrike,
        longPrice: item.longPrice,
        shortPrice: item.shortPrice,
        netDebit: closedNetDebit,
        maxProfit: closedMaxProfit,
        maxLoss: closedMaxLoss,
        status: 'closed' as const,
        closeNetCredit: closeNetCredit as number,
        exitDate: exitDate as string,
        exitReason: exitReason as SpreadExitReason,
        ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
      },
      remainingUpdates: {
        longStrike: item.longStrike,
        shortStrike: item.shortStrike,
        longPrice: item.longPrice,
        shortPrice: item.shortPrice,
        contracts: remaining,
        netDebit: remainingNetDebit,
        maxProfit: remainingMaxProfit,
        maxLoss: remainingMaxLoss,
      },
    };
  },
  isOpen: (item) => item.status === 'open',
});

export function useSpreads() {
  const base = useSpreadBase();

  // Normalize existing data from DB in case legs were entered in wrong order
  const spreads = useMemo(() => base.items.map(normalizeSpreadLegs), [base.items]);
  const openSpreads = useMemo(() => base.openItems.map(normalizeSpreadLegs), [base.openItems]);
  const closedSpreads = useMemo(() => base.closedItems.map(normalizeSpreadLegs), [base.closedItems]);

  const addSpread = useCallback((trade: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status'>) => {
    return base.addItem(trade);
  }, [base]);

  const closeSpread = useCallback((
    id: string, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason, closeCommission?: number
  ) => {
    base.closeItem(id, closeNetCredit, exitDate, exitReason, closeCommission);
  }, [base]);

  const deleteSpread = useCallback((id: string) => {
    base.deleteItem(id);
  }, [base]);

  const rollSpread = useCallback((
    id: string, closeNetCredit: number, exitDate: string,
    newSpreadData: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    return base.rollItem(id, [closeNetCredit, exitDate, 'rolled'], newSpreadData);
  }, [base]);

  const partialCloseSpread = useCallback((
    id: string, contractsToClose: number, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason, closeCommission?: number
  ) => {
    return base.partialCloseItem(id, contractsToClose, closeNetCredit, exitDate, exitReason, closeCommission);
  }, [base]);

  const editSpread = useCallback((id: string, updates: Partial<SpreadTrade>) => {
    base.editItem(id, updates);
  }, [base]);

  return {
    spreads,
    openSpreads,
    closedSpreads,
    isLoading: base.isLoading,
    error: base.error,
    retry: base.retry,
    addSpread,
    editSpread,
    closeSpread,
    deleteSpread,
    rollSpread,
    partialCloseSpread,
    getRollChain: base.getRollChain,
  };
}
