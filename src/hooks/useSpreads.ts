'use client';

import { useCallback } from 'react';
import { SpreadTrade, SpreadExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';
import { createTradeHook } from './useTradeData';

function computeSpreadValues(trade: { longStrike: number; shortStrike: number; longPrice: number; shortPrice: number; contracts: number; spreadType: string }) {
  const strikeDiff = Math.abs(trade.longStrike - trade.shortStrike);
  const netDebit = (trade.longPrice - trade.shortPrice) * 100 * trade.contracts;
  const netDebitPerContract = trade.longPrice - trade.shortPrice;
  const isDebit = trade.spreadType === 'call_debit' || trade.spreadType === 'put_debit';

  const maxProfit = isDebit
    ? (strikeDiff - netDebitPerContract) * 100 * trade.contracts
    : Math.abs(netDebit);
  const maxLoss = isDebit
    ? netDebit
    : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * trade.contracts;

  return { netDebit, maxProfit, maxLoss };
}

const useSpreadBase = createTradeHook<SpreadTrade>({
  apiEndpoint: '/api/spreads',
  prepareNew: (input) => {
    const { netDebit, maxProfit, maxLoss } = computeSpreadValues(input as unknown as Parameters<typeof computeSpreadValues>[0]);
    return {
      ...input,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(input.entryDate as string, input.expiration as string),
      netDebit,
      maxProfit,
      maxLoss,
      status: 'open',
    } as SpreadTrade;
  },
  prepareClose: (_item, closeNetCredit, exitDate, exitReason) => ({
    status: 'closed' as const,
    closeNetCredit: closeNetCredit as number,
    exitDate: exitDate as string,
    exitReason: exitReason as SpreadExitReason,
  }),
  preparePartialClose: (item, contractsToClose, closeNetCredit, exitDate, exitReason) => {
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
        netDebit: closedNetDebit,
        maxProfit: closedMaxProfit,
        maxLoss: closedMaxLoss,
        status: 'closed' as const,
        closeNetCredit: closeNetCredit as number,
        exitDate: exitDate as string,
        exitReason: exitReason as SpreadExitReason,
      },
      remainingUpdates: {
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

  const addSpread = useCallback((trade: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status'>) => {
    return base.addItem(trade);
  }, [base]);

  const closeSpread = useCallback((
    id: string, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason
  ) => {
    base.closeItem(id, closeNetCredit, exitDate, exitReason);
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
    id: string, contractsToClose: number, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason
  ) => {
    return base.partialCloseItem(id, contractsToClose, closeNetCredit, exitDate, exitReason);
  }, [base]);

  return {
    spreads: base.items,
    openSpreads: base.openItems,
    closedSpreads: base.closedItems,
    isLoading: base.isLoading,
    error: base.error,
    retry: base.retry,
    addSpread,
    closeSpread,
    deleteSpread,
    rollSpread,
    partialCloseSpread,
    getRollChain: base.getRollChain,
  };
}
