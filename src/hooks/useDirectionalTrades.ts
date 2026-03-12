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
  prepareClose: (item, exitPrice, exitDate, exitReason) => ({
    status: 'closed' as const,
    exitPrice: exitPrice as number,
    exitDate: exitDate as string,
    exitReason: exitReason as DirectionalExitReason,
    creditAtClose: (exitPrice as number) * 100 * item.contracts,
  }),
  preparePartialClose: (item, contractsToClose, exitPrice, exitDate, exitReason) => {
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
    id: string, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason
  ) => {
    base.closeItem(id, exitPrice, exitDate, exitReason);
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
    id: string, contractsToClose: number, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason
  ) => {
    return base.partialCloseItem(id, contractsToClose, exitPrice, exitDate, exitReason);
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
