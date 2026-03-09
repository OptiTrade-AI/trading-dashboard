'use client';

import { useState, useEffect, useCallback } from 'react';
import { CoveredCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDTEFromEntry } from '@/lib/utils';

export function useCoveredCalls() {
  const [calls, setCalls] = useState<CoveredCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/covered-calls');
        if (!res.ok) throw new Error('Failed to load covered calls');
        const data = await res.json();
        setCalls(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        console.error('Error loading covered calls:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch('/api/covered-calls')
      .then(async (res) => {
        if (res.ok) setCalls(await res.json());
        else throw new Error('Failed to load');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setIsLoading(false));
  }, []);

  const addCall = useCallback((call: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status'>) => {
    const newCall: CoveredCall = {
      ...call,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(call.entryDate, call.expiration),
      sharesHeld: call.contracts * 100,
      status: 'open',
    };
    setCalls(prev => [newCall, ...prev]);
    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCall),
    }).catch(err => console.error('Error adding covered call:', err));
    return newCall;
  }, []);

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
    setCalls(prev => prev.map(call =>
      call.id === id ? { ...call, ...updates } : call
    ));
    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('Error closing covered call:', err));
  }, []);

  const deleteCall = useCallback((id: string) => {
    setCalls(prev => prev.filter(call => call.id !== id));
    fetch('/api/covered-calls', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('Error deleting covered call:', err));
  }, []);

  const rollCall = useCallback((
    id: string,
    exitPrice: number,
    exitDate: string,
    newCallData: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status' | 'rollChainId' | 'rollNumber'>
  ) => {
    const currentCall = calls.find(c => c.id === id);
    if (!currentCall) return null;

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
    setCalls(prev => prev.map(call =>
      call.id === id ? { ...call, ...closeUpdates } : call
    ));
    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...closeUpdates }),
    }).catch(err => console.error('Error closing rolled call:', err));

    const newCall: CoveredCall = {
      ...newCallData,
      id: uuidv4(),
      dteAtEntry: calculateDTEFromEntry(newCallData.entryDate, newCallData.expiration),
      sharesHeld: newCallData.contracts * 100,
      status: 'open',
      rollChainId,
      rollNumber: currentRollNumber + 1,
    };
    setCalls(prev => [newCall, ...prev]);
    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCall),
    }).catch(err => console.error('Error adding rolled call:', err));

    return newCall;
  }, [calls]);

  const partialCloseCall = useCallback((
    id: string,
    contractsToClose: number,
    exitPrice: number,
    exitDate: string,
    exitReason: CoveredCall['exitReason'],
    wasCalled: boolean = false
  ) => {
    const call = calls.find(c => c.id === id);
    if (!call || contractsToClose >= call.contracts || contractsToClose < 1) return null;

    const totalContracts = call.originalContracts || call.contracts;
    const remaining = call.contracts - contractsToClose;
    const ratio = contractsToClose / call.contracts;

    // Create closed portion
    const closedPortion: CoveredCall = {
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

    // Update remaining portion
    const remainingUpdates = {
      contracts: remaining,
      sharesHeld: remaining * 100,
      premiumCollected: call.premiumCollected * (1 - ratio),
      costBasis: call.costBasis * (1 - ratio),
      originalContracts: totalContracts,
    };

    setCalls(prev => [
      closedPortion,
      ...prev.map(c => c.id === id ? { ...c, ...remainingUpdates } : c),
    ]);

    fetch('/api/covered-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closedPortion),
    }).catch(err => console.error('Error adding partial close call:', err));

    fetch('/api/covered-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...remainingUpdates }),
    }).catch(err => console.error('Error updating remaining call:', err));

    return closedPortion;
  }, [calls]);

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
