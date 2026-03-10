'use client';

import { useCallback } from 'react';
import { CoveredCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';
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
  prepareClose: (_item, exitPrice, exitDate, exitReason, wasCalled) => ({
    status: (wasCalled ? 'called' : 'closed') as CoveredCall['status'],
    exitPrice: exitPrice as number,
    exitDate: exitDate as string,
    exitReason: exitReason as CoveredCall['exitReason'],
  }),
  preparePartialClose: (item, contractsToClose, exitPrice, exitDate, exitReason, wasCalled) => {
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
    exitReason: CoveredCall['exitReason'], wasCalled: boolean = false
  ) => {
    base.closeItem(id, exitPrice, exitDate, exitReason, wasCalled);
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
    exitReason: CoveredCall['exitReason'], wasCalled: boolean = false
  ) => {
    return base.partialCloseItem(id, contractsToClose, exitPrice, exitDate, exitReason, wasCalled);
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

// Calculate P/L for a covered call
export function calculateCCPL(call: CoveredCall): number {
  if (call.status === 'open') return 0;
  return call.premiumCollected - (call.exitPrice ?? 0);
}

// Calculate P/L percent based on cost basis
export function calculateCCPLPercent(call: CoveredCall): number {
  const pl = calculateCCPL(call);
  if (call.costBasis === 0) return 0;
  return (pl / call.costBasis) * 100;
}
