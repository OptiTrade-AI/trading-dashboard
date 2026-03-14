'use client';

import { useCallback } from 'react';
import { DirectionalTrade, DirectionalExitReason } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';
import { createTradeHook } from './useTradeData';

const useDirBase = createTradeHook<DirectionalTrade>({
  apiEndpoint: '/api/directional-trades',
  prepareNew: (input) => ({
    ...input,
    id: uuidv4(),
    dteAtEntry: calculateDTEFromEntry(input.entryDate as string, input.expiration as string),
    costAtOpen: (input.entryPrice as number) * 100 * (input.contracts as number),
    status: 'open',
  } as DirectionalTrade),
  prepareClose: (item, exitPrice, exitDate, exitReason, closeCommission) => ({
    status: 'closed' as const,
    exitPrice: exitPrice as number,
    exitDate: exitDate as string,
    exitReason: exitReason as DirectionalExitReason,
    creditAtClose: (exitPrice as number) * 100 * item.contracts,
    ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
  }),
  preparePartialClose: (item, contractsToClose, exitPrice, exitDate, exitReason, closeCommission) => {
    const ratio = contractsToClose / item.contracts;
    const remaining = item.contracts - contractsToClose;
    return {
      closedPortion: {
        costAtOpen: item.costAtOpen * ratio,
        status: 'closed' as const,
        exitPrice: exitPrice as number,
        exitDate: exitDate as string,
        exitReason: exitReason as DirectionalExitReason,
        creditAtClose: (exitPrice as number) * 100 * contractsToClose,
        ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
      },
      remainingUpdates: {
        contracts: remaining,
        costAtOpen: item.costAtOpen * (1 - ratio),
      },
    };
  },
  isOpen: (item) => item.status === 'open',
});

export function useDirectionalTrades() {
  const base = useDirBase();

  const addTrade = useCallback((trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => {
    return base.addItem(trade);
  }, [base]);

  const closeTrade = useCallback((
    id: string, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number
  ) => {
    base.closeItem(id, exitPrice, exitDate, exitReason, closeCommission);
  }, [base]);

  const deleteTrade = useCallback((id: string) => {
    base.deleteItem(id);
  }, [base]);

  const rollTrade = useCallback((
    id: string, exitPrice: number, exitDate: string,
    newTradeData: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    return base.rollItem(id, [exitPrice, exitDate, 'rolled'], newTradeData);
  }, [base]);

  const partialCloseTrade = useCallback((
    id: string, contractsToClose: number, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number
  ) => {
    return base.partialCloseItem(id, contractsToClose, exitPrice, exitDate, exitReason, closeCommission);
  }, [base]);

  const editTrade = useCallback((id: string, updates: Partial<DirectionalTrade>) => {
    base.editItem(id, updates);
  }, [base]);

  return {
    trades: base.items,
    openTrades: base.openItems,
    closedTrades: base.closedItems,
    isLoading: base.isLoading,
    error: base.error,
    retry: base.retry,
    addTrade,
    editTrade,
    closeTrade,
    deleteTrade,
    rollTrade,
    partialCloseTrade,
    getRollChain: base.getRollChain,
  };
}
