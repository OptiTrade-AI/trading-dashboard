'use client';

import { useCallback } from 'react';
import { CoveredCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry, calculateCCPL, calculateCCPLPercent } from '@/lib/utils';
import { createTradeHook } from './useTradeData';

const useCCBase = createTradeHook<CoveredCall>({
  apiEndpoint: '/api/covered-calls',
  prepareNew: (input) => ({
    ...input,
    id: uuidv4(),
    dteAtEntry: calculateDTEFromEntry(input.entryDate as string, input.expiration as string),
    sharesHeld: (input.contracts as number) * 100,
    status: 'open',
  } as CoveredCall),
  prepareClose: (_item, exitPrice, exitDate, exitReason, wasCalled, closeCommission) => ({
    status: (wasCalled ? 'called' : 'closed') as CoveredCall['status'],
    exitPrice: exitPrice as number,
    exitDate: exitDate as string,
    exitReason: exitReason as CoveredCall['exitReason'],
    ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
  }),
  preparePartialClose: (item, contractsToClose, exitPrice, exitDate, exitReason, wasCalled, closeCommission) => {
    const ratio = contractsToClose / item.contracts;
    const remaining = item.contracts - contractsToClose;
    return {
      closedPortion: {
        sharesHeld: contractsToClose * 100,
        premiumCollected: item.premiumCollected * ratio,
        costBasis: item.costBasis * ratio,
        status: ((wasCalled as boolean) ? 'called' : 'closed') as CoveredCall['status'],
        exitPrice: (exitPrice as number) * ratio,
        exitDate: exitDate as string,
        exitReason: exitReason as CoveredCall['exitReason'],
        ...(closeCommission != null ? { closeCommission: closeCommission as number } : {}),
      },
      remainingUpdates: {
        contracts: remaining,
        sharesHeld: remaining * 100,
        premiumCollected: item.premiumCollected * (1 - ratio),
        costBasis: item.costBasis * (1 - ratio),
      },
    };
  },
  isOpen: (item) => item.status === 'open',
});

export function useCoveredCalls() {
  const base = useCCBase();

  const addCall = useCallback((call: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status'>) => {
    return base.addItem(call);
  }, [base]);

  const editCall = useCallback((id: string, updates: Partial<CoveredCall>) => {
    base.editItem(id, updates);
  }, [base]);

  const closeCall = useCallback((
    id: string, exitPrice: number, exitDate: string,
    exitReason: CoveredCall['exitReason'], wasCalled: boolean = false, closeCommission?: number
  ) => {
    base.closeItem(id, exitPrice, exitDate, exitReason, wasCalled, closeCommission);
  }, [base]);

  const deleteCall = useCallback((id: string) => {
    base.deleteItem(id);
  }, [base]);

  const rollCall = useCallback((
    id: string, exitPrice: number, exitDate: string,
    newCallData: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    return base.rollItem(id, [exitPrice, exitDate, 'rolled', false], newCallData);
  }, [base]);

  const partialCloseCall = useCallback((
    id: string, contractsToClose: number, exitPrice: number, exitDate: string,
    exitReason: CoveredCall['exitReason'], wasCalled: boolean = false, closeCommission?: number
  ) => {
    return base.partialCloseItem(id, contractsToClose, exitPrice, exitDate, exitReason, wasCalled, closeCommission);
  }, [base]);

  return {
    calls: base.items,
    openCalls: base.openItems,
    closedCalls: base.closedItems,
    isLoading: base.isLoading,
    error: base.error,
    retry: base.retry,
    addCall,
    editCall,
    closeCall,
    deleteCall,
    rollCall,
    partialCloseCall,
    getRollChain: base.getRollChain,
  };
}

// Re-export from utils for backwards compatibility
export { calculateCCPL, calculateCCPLPercent } from '@/lib/utils';
