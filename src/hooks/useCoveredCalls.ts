'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { CoveredCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useCoveredCalls() {
  const { data: calls = [], error: swrError, isLoading, mutate } = useSWR<CoveredCall[]>('/api/covered-calls');
  const error = swrError?.message ?? null;

  const retry = useCallback(() => { mutate(); }, [mutate]);

  const addCall = useCallback((call: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status'>) => {
    const newCall: CoveredCall = {
      ...call,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(call.entryDate, call.expiration),
      sharesHeld: call.contracts * 100,
      status: 'open',
    };
    mutate(prev => [newCall, ...(prev || [])], { revalidate: false });
    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCall),
    }).catch(err => console.error('Error adding covered call:', err));
    return newCall;
  }, [mutate]);

  const closeCall = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    exitReason: CoveredCall['exitReason'],
    wasCalled: boolean = false
  ) => {
    const updates = {
      status: wasCalled ? 'called' as const : 'closed' as const,
      exitPrice,
      exitDate,
      exitReason,
    };
    mutate(prev => (prev || []).map(call =>
      call.id === id ? { ...call, ...updates } : call
    ), { revalidate: false });
    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing covered call:', err));
  }, [mutate]);

  const deleteCall = useCallback((id: string) => {
    mutate(prev => (prev || []).filter(call => call.id !== id), { revalidate: false });
    fetch('/api/covered-calls', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting covered call:', err));
  }, [mutate]);

  const rollCall = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newCallData: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    let newCall: CoveredCall | null = null;
    mutate(prev => {
      const currentCall = (prev || []).find(c => c.id === id);
      if (!currentCall) return prev;

      const rollChainId = currentCall.rollChainId || uuidv4();
      const currentRollNumber = currentCall.rollNumber || 1;

      const closeUpdates = {
        status: 'closed' as const,
        exitPrice,
        exitDate,
        exitReason: 'rolled' as const,
        rollChainId,
        rollNumber: currentRollNumber,
      };

      newCall = {
        ...newCallData,
        id: uuidv4(),
        dteAtEntry: calculateDTEFromEntry(newCallData.entryDate, newCallData.expiration),
        sharesHeld: newCallData.contracts * 100,
        status: 'open',
        rollChainId,
        rollNumber: currentRollNumber + 1,
      };

      return [
        newCall,
        ...(prev || []).map(call =>
          call.id === id ? { ...call, ...closeUpdates } : call
        ),
      ];
    }, { revalidate: false });

    if (!newCall) return null;

    // Fire-and-forget API calls
    const currentCall = calls.find(c => c.id === id);
    const rollChainId = currentCall?.rollChainId || (newCall as CoveredCall).rollChainId!;
    const currentRollNumber = currentCall?.rollNumber || 1;

    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: 'closed',
        exitPrice,
        exitDate,
        exitReason: 'rolled',
        rollChainId,
        rollNumber: currentRollNumber,
      }),
    }).catch(err => console.error('Error closing rolled call:', err));

    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCall),
    }).catch(err => console.error('Error adding rolled call:', err));

    return newCall;
  }, [mutate, calls]);

  const partialCloseCall = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: CoveredCall['exitReason'],
    wasCalled: boolean = false
  ) => {
    let closedPortion: CoveredCall | null = null;
    mutate(prev => {
      const call = (prev || []).find(c => c.id === id);
      if (!call || contractsToClose >= call.contracts || contractsToClose < 1) return prev;

      const totalContracts = call.originalContracts || call.contracts;
      const remaining = call.contracts - contractsToClose;
      const ratio = contractsToClose / call.contracts;

      closedPortion = {
        ...call,
        id: uuidv4(),
        contracts: contractsToClose,
        sharesHeld: contractsToClose * 100,
        premiumCollected: call.premiumCollected * ratio,
        costBasis: call.costBasis * ratio,
        status: wasCalled ? 'called' : 'closed',
        exitPrice: exitPrice * ratio,
        exitDate,
        exitReason,
        originalContracts: totalContracts,
      };

      const remainingUpdates = {
        contracts: remaining,
        sharesHeld: remaining * 100,
        premiumCollected: call.premiumCollected * (1 - ratio),
        costBasis: call.costBasis * (1 - ratio),
        originalContracts: totalContracts,
      };

      return [
        closedPortion,
        ...(prev || []).map(c => c.id === id ? { ...c, ...remainingUpdates } : c),
      ];
    }, { revalidate: false });

    if (!closedPortion) return null;

    const call = calls.find(c => c.id === id);
    const totalContracts = call?.originalContracts || call?.contracts || 0;
    const remaining = (call?.contracts || 0) - contractsToClose;
    const ratio = contractsToClose / (call?.contracts || 1);

    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close call:', err));

    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        contracts: remaining,
        sharesHeld: remaining * 100,
        premiumCollected: (call?.premiumCollected || 0) * (1 - ratio),
        costBasis: (call?.costBasis || 0) * (1 - ratio),
        originalContracts: totalContracts,
      }),
    }).catch(err => console.error('Error updating remaining call:', err));

    return closedPortion;
  }, [mutate, calls]);

  const getRollChain = useCallback((rollChainId: string) => {
    return calls
      .filter(c => c.rollChainId === rollChainId)
      .sort((a, b) => (a.rollNumber || 1) - (b.rollNumber || 1));
  }, [calls]);

  const openCalls = calls.filter(c => c.status === 'open');
  const closedCalls = calls.filter(c => c.status !== 'open');

  return {
    calls,
    openCalls,
    closedCalls,
    isLoading,
    error,
    retry,
    addCall,
    closeCall,
    deleteCall,
    rollCall,
    partialCloseCall,
    getRollChain,
  };
}

// Calculate P/L for a covered call
export function calculateCCPL(call: CoveredCall): number {
  if (call.status === 'open') {
    return 0;
  }
  const exitPrice = call.exitPrice ?? 0;
  return call.premiumCollected - exitPrice;
}

// Calculate P/L percent based on cost basis
export function calculateCCPLPercent(call: CoveredCall): number {
  const pl = calculateCCPL(call);
  if (call.costBasis === 0) return 0;
  return (pl / call.costBasis) * 100;
}
