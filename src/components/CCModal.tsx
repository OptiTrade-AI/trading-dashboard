'use client';

import { useState, useEffect } from 'react';
import { CoveredCall, ALL_TICKERS, CC_EXIT_REASONS, CCExitReason } from '@/types';
import { calculateDTEFromEntry, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { AITradeCheck } from './AITradeCheck';
import { AIRollAdvisor } from './AIRollAdvisor';
import type { RollRecommendation } from '@/types';

interface AddCCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (call: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status'>) => void;
  getCostBasis?: (ticker: string, sharesNeeded: number) => number | null;
}

export function AddCCModal({ isOpen, onClose, onSubmit, getCostBasis }: AddCCModalProps) {
  const [ticker, setTicker] = useState('');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('1');
  const [expiration, setExpiration] = useState('');
  const [premium, setPremium] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showTickerList, setShowTickerList] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState(ALL_TICKERS);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (ticker) {
      setFilteredTickers(
        ALL_TICKERS.filter(t => t.toLowerCase().includes(ticker.toLowerCase()))
      );
    } else {
      setFilteredTickers(ALL_TICKERS);
    }
  }, [ticker]);

  // Auto-fill cost basis from holdings
  useEffect(() => {
    if (!getCostBasis || !ticker) return;
    const numC = parseInt(contracts) || 1;
    const sharesNeeded = numC * 100;
    const basis = getCostBasis(ticker, sharesNeeded);
    if (basis !== null) {
      setCostBasis(basis.toFixed(2));
      setAutoFilled(true);
    } else {
      if (autoFilled) {
        setCostBasis('');
        setAutoFilled(false);
      }
    }
  }, [ticker, contracts, getCostBasis]); // eslint-disable-line react-hooks/exhaustive-deps

  const numContracts = parseInt(contracts) || 1;
  const shares = numContracts * 100;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;
  const totalCostBasis = parseFloat(costBasis) || 0;
  const perShare = parseFloat(premium) || 0;
  const totalPremium = perShare * 100 * numContracts;
  const returnOnShares = totalCostBasis > 0 && premium
    ? ((totalPremium / totalCostBasis) * 100).toFixed(2)
    : '0.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !strike || !expiration || !premium || !contracts || !costBasis) return;

    onSubmit({
      ticker: ticker.toUpperCase(),
      strike: parseFloat(strike),
      contracts: numContracts,
      expiration,
      entryDate,
      premiumCollected: totalPremium,
      costBasis: totalCostBasis,
    });

    setTicker('');
    setStrike('');
    setContracts('1');
    setExpiration('');
    setPremium('');
    setCostBasis('');
    setAutoFilled(false);
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add Covered Call</h2>
            <p className="text-muted text-sm mt-0.5">Enter your CC details</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="relative">
            <label className="stat-label mb-2 block">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onFocus={() => setShowTickerList(true)}
              onBlur={() => setTimeout(() => setShowTickerList(false), 200)}
              className="input-field"
              placeholder="AAPL"
              required
            />
            {showTickerList && filteredTickers.length > 0 && (
              <div className="absolute top-full left-0 right-0 glass-card mt-2 overflow-hidden z-10 max-h-48 overflow-y-auto">
                {filteredTickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTicker(t);
                      setShowTickerList(false);
                    }}
                    className="w-full px-4 py-3 text-left text-foreground hover:bg-accent/10 transition-colors flex items-center gap-3"
                  >
                    <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                      {t.slice(0, 2)}
                    </span>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Strike Price</label>
              <input
                type="number"
                step="0.01"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                className="input-field"
                placeholder="30.00"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Contracts</label>
              <input
                type="number"
                min="1"
                step="1"
                value={contracts}
                onChange={(e) => setContracts(e.target.value)}
                className="input-field"
                placeholder="1"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Premium / Share</label>
              <input
                type="number"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="input-field"
                placeholder="1.30"
                required
              />
            </div>
          </div>

          <div>
            <label className="stat-label mb-2 block">Total Cost Basis (for {shares} shares)</label>
            <input
              type="number"
              step="0.01"
              value={costBasis}
              onChange={(e) => { setCostBasis(e.target.value); setAutoFilled(false); }}
              className="input-field"
              placeholder="2500.00"
              required
            />
            {autoFilled && <p className="text-accent text-xs mt-1">Auto-filled from holdings</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Expiration</label>
              <input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Shares Covered</span>
              <span className="text-foreground font-semibold">{shares}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
            {premium && (
              <div className="flex justify-between items-center">
                <span className="text-muted">Total Premium</span>
                <span className="text-profit font-semibold">{formatCurrency(totalPremium)}</span>
              </div>
            )}
            {totalCostBasis > 0 && premium && (
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted">Return on Shares</span>
                <span className="text-profit font-semibold">
                  {returnOnShares}%
                </span>
              </div>
            )}
          </div>

          <AITradeCheck
            trade={{
              ticker: ticker.toUpperCase(),
              strategy: 'CC',
              strike: parseFloat(strike) || undefined,
              contracts: numContracts,
              expiration,
              premium: totalPremium || undefined,
            }}
            disabled={!ticker || !strike || !expiration || !premium}
          />

          <button type="submit" className="btn-primary w-full py-3">
            Add Covered Call
          </button>
        </form>
      </div>
    </div>
  );
}

interface EditCCModalProps {
  isOpen: boolean;
  call: CoveredCall | null;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<CoveredCall>) => void;
}

export function EditCCModal({ isOpen, call, onClose, onSubmit }: EditCCModalProps) {
  const [ticker, setTicker] = useState('');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('');
  const [expiration, setExpiration] = useState('');
  const [premium, setPremium] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [entryDate, setEntryDate] = useState('');

  useEffect(() => {
    if (call) {
      setTicker(call.ticker);
      setStrike(call.strike.toString());
      setContracts(call.contracts.toString());
      setExpiration(call.expiration);
      setPremium(call.premiumCollected.toString());
      setCostBasis(call.costBasis.toString());
      setEntryDate(call.entryDate);
    }
  }, [call]);

  const numContracts = parseInt(contracts) || 1;
  const shares = numContracts * 100;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;
  const totalCostBasis = parseFloat(costBasis) || 0;
  const totalPremium = parseFloat(premium) || 0;
  const returnOnShares = totalCostBasis > 0 && totalPremium > 0
    ? ((totalPremium / totalCostBasis) * 100).toFixed(2)
    : '0.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!call || !ticker || !strike || !expiration || !premium || !contracts || !costBasis) return;

    onSubmit(call.id, {
      ticker: ticker.toUpperCase(),
      strike: parseFloat(strike),
      contracts: numContracts,
      sharesHeld: shares,
      expiration,
      entryDate,
      premiumCollected: totalPremium,
      costBasis: totalCostBasis,
      dteAtEntry: dte,
    });
    onClose();
  };

  if (!isOpen || !call) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">{call.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Edit Covered Call</h2>
              <p className="text-muted text-sm">{call.ticker} ${call.strike}C</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="stat-label mb-2 block">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Strike Price</label>
              <input
                type="number"
                step="0.01"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Contracts</label>
              <input
                type="number"
                min="1"
                step="1"
                value={contracts}
                onChange={(e) => setContracts(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Premium</label>
              <input
                type="number"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="stat-label mb-2 block">Total Cost Basis (for {shares} shares)</label>
            <input
              type="number"
              step="0.01"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Expiration</label>
              <input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Shares Covered</span>
              <span className="text-foreground font-semibold">{shares}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
            {totalCostBasis > 0 && totalPremium > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted">Return on Shares</span>
                <span className="text-profit font-semibold">{returnOnShares}%</span>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary w-full py-3">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

interface CloseCCModalProps {
  isOpen: boolean;
  call: CoveredCall | null;
  onClose: () => void;
  onSubmit: (exitPrice: number, exitDate: string, exitReason: CCExitReason, wasCalled: boolean) => void;
  onRoll?: (exitPrice: number, exitDate: string, newCall: Omit<CoveredCall, 'id' | 'dteAtEntry' | 'sharesHeld' | 'status' | 'rollChainId' | 'rollNumber'>) => void;
  onPartialClose?: (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: CCExitReason, wasCalled: boolean) => void;
}

type CloseMode = 'close' | 'partial' | 'roll' | 'called';

export function CloseCCModal({ isOpen, call, onClose, onSubmit, onRoll, onPartialClose }: CloseCCModalProps) {
  const [mode, setMode] = useState<CloseMode>('close');
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exitReason, setExitReason] = useState<CCExitReason>('50% profit');
  const [contractsToClose, setContractsToClose] = useState('1');

  // Roll fields
  const [newStrike, setNewStrike] = useState('');
  const [newExpiration, setNewExpiration] = useState('');
  const [newPremium, setNewPremium] = useState('');

  useEffect(() => {
    if (call) {
      setMode('close');
      setExitPrice((call.premiumCollected * 0.5).toFixed(2));
      setExitReason('50% profit');
      setContractsToClose('1');
      setNewStrike(call.strike.toString());
      setNewExpiration('');
      setNewPremium('');
    }
  }, [call]);

  useEffect(() => {
    if (mode === 'called') {
      setExitPrice('0');
      setExitReason('called away');
    } else if (call) {
      setExitPrice((call.premiumCollected * 0.5).toFixed(2));
      if (exitReason === 'called away') setExitReason('50% profit');
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (exitPrice === '' || !call) return;

    if (mode === 'partial' && onPartialClose) {
      const numToClose = parseInt(contractsToClose);
      if (!numToClose || numToClose < 1 || numToClose >= call.contracts) return;
      onPartialClose(numToClose, parseFloat(exitPrice), exitDate, exitReason, false);
    } else if (mode === 'roll' && onRoll) {
      if (!newStrike || !newExpiration || !newPremium) return;
      onRoll(parseFloat(exitPrice), exitDate, {
        ticker: call.ticker,
        strike: parseFloat(newStrike),
        contracts: call.contracts,
        expiration: newExpiration,
        entryDate: exitDate,
        premiumCollected: parseFloat(newPremium) * 100 * call.contracts,
        costBasis: call.costBasis,
      });
    } else {
      onSubmit(parseFloat(exitPrice), exitDate, exitReason, mode === 'called');
    }
    onClose();
  };

  if (!isOpen || !call) return null;

  const pl = call.premiumCollected - parseFloat(exitPrice || '0');
  const plPercent = call.costBasis > 0 ? (pl / call.costBasis) * 100 : 0;
  const newDte = newExpiration && exitDate ? calculateDTEFromEntry(exitDate, newExpiration) : 0;

  // Build available modes
  const modes: { key: CloseMode; label: string }[] = [
    { key: 'close', label: 'Close' },
    ...(onPartialClose && call.contracts > 1 ? [{ key: 'partial' as const, label: 'Partial' }] : []),
    ...(onRoll ? [{ key: 'roll' as const, label: 'Roll' }] : []),
    { key: 'called', label: 'Called Away' },
  ];

  const modeTitle: Record<CloseMode, string> = {
    close: 'Close Covered Call',
    partial: 'Partial Close',
    roll: 'Roll Covered Call',
    called: 'Called Away',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">{call.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{modeTitle[mode]}</h2>
              <p className="text-muted text-sm">{call.ticker} ${call.strike}C × {call.contracts}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Action mode selector */}
          <div className="flex rounded-xl bg-background/30 p-1 gap-1">
            {modes.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  mode === m.key
                    ? m.key === 'called'
                      ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                      : m.key === 'roll'
                      ? 'bg-accent/20 text-accent shadow-sm'
                      : m.key === 'partial'
                      ? 'bg-caution/20 text-caution shadow-sm'
                      : 'bg-card-solid text-foreground shadow-sm'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Position summary */}
          <div className="bg-background/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">Premium Collected</span>
              <span className="text-profit font-semibold text-sm">{formatCurrency(call.premiumCollected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">Cost Basis</span>
              <span className="text-foreground font-semibold text-sm">{formatCurrency(call.costBasis)}</span>
            </div>
          </div>

          {/* Partial close: contract count */}
          {mode === 'partial' && (
            <div>
              <label className="stat-label mb-2 block">Contracts to close (of {call.contracts})</label>
              <input
                type="number"
                min="1"
                max={call.contracts - 1}
                step="1"
                value={contractsToClose}
                onChange={(e) => setContractsToClose(e.target.value)}
                className="input-field"
                required
              />
              <p className="text-muted text-xs mt-1">
                {parseInt(contractsToClose) || 0} close, {call.contracts - (parseInt(contractsToClose) || 0)} remain open
              </p>
            </div>
          )}

          {/* Exit price + date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">
                {mode === 'called' ? 'Exit Price' : 'Buy-back Cost'}
              </label>
              <input
                type="number"
                step="0.01"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="input-field"
                placeholder="32.50"
                disabled={mode === 'called'}
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">{mode === 'roll' ? 'Roll Date' : 'Exit Date'}</label>
              <input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>

          {mode === 'called' && (
            <p className="text-muted text-xs -mt-3">Exit price is $0 when shares are called away</p>
          )}

          {/* Exit reason (close + partial only) */}
          {(mode === 'close' || mode === 'partial') && (
            <div>
              <label className="stat-label mb-2 block">Exit Reason</label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value as CCExitReason)}
                className="input-field"
              >
                {CC_EXIT_REASONS.filter(r => r !== 'called away' && r !== 'rolled').map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          )}

          {/* Roll: new position fields */}
          {mode === 'roll' && (
            <div className="space-y-4 pt-2 border-t border-border/30">
              <AIRollAdvisor
                position={{
                  ticker: call.ticker,
                  strategy: 'CC',
                  strike: call.strike,
                  contracts: call.contracts,
                  expiration: call.expiration,
                  entryDate: call.entryDate,
                  premiumCollected: call.premiumCollected,
                }}
                onApply={(rec: RollRecommendation) => {
                  setNewStrike(rec.targetStrike.toString());
                  setNewExpiration(rec.targetExpiration);
                  if (rec.expectedCredit > 0) setNewPremium(rec.expectedCredit.toString());
                }}
              />
              <h3 className="text-sm font-semibold text-accent">New Position</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="stat-label mb-2 block">Strike</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newStrike}
                    onChange={(e) => setNewStrike(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="stat-label mb-2 block">Premium / Share</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPremium}
                    onChange={(e) => setNewPremium(e.target.value)}
                    className="input-field"
                    placeholder="1.30"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="stat-label mb-2 block">New Expiration</label>
                <input
                  type="date"
                  value={newExpiration}
                  onChange={(e) => setNewExpiration(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              {newDte > 0 && (
                <div className="bg-accent/5 rounded-xl p-3 border border-accent/20">
                  <div className="flex justify-between items-center">
                    <span className="text-muted text-sm">New DTE</span>
                    <span className="text-foreground font-semibold text-sm">{newDte} days</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Called away: assignment info */}
          {mode === 'called' && (
            <div className="bg-blue-500/5 rounded-xl p-4 space-y-2 border border-blue-500/20">
              <p className="text-blue-400 text-sm font-medium">
                {call.contracts * 100} shares of {call.ticker} called away
              </p>
              <div className="text-blue-300/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Strike price:</span>
                  <span>${call.strike.toFixed(2)}/share</span>
                </div>
                <div className="flex justify-between">
                  <span>Premium received:</span>
                  <span>-${(call.premiumCollected / (call.contracts * 100)).toFixed(2)}/share</span>
                </div>
                <div className="flex justify-between border-t border-blue-500/20 pt-1 font-medium">
                  <span>Effective cost basis:</span>
                  <span>${(call.strike - call.premiumCollected / (call.contracts * 100)).toFixed(2)}/share</span>
                </div>
              </div>
            </div>
          )}

          {/* P/L preview (close, partial, called) */}
          {mode !== 'roll' && (
            <div className={`rounded-xl p-4 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {mode === 'called' ? 'Premium Kept' : 'Estimated P/L'}
                </span>
                <span className={`text-lg font-bold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                  {mode !== 'called' && <span className="text-xs font-normal ml-1.5">({plPercent.toFixed(2)}%)</span>}
                </span>
              </div>
            </div>
          )}

          {/* Roll P/L preview */}
          {mode === 'roll' && (
            <div className={`rounded-xl p-4 space-y-2 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">P/L on closed leg</span>
                <span className={`font-bold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                </span>
              </div>
              {newPremium && (
                <div className="flex justify-between items-center pt-1 border-t border-border/20">
                  <span className="text-muted text-sm">Net credit (close + new)</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(pl + parseFloat(newPremium) * 100 * call.contracts)}
                  </span>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3">
            {mode === 'partial'
              ? `Close ${contractsToClose} of ${call.contracts} Contracts`
              : mode === 'roll'
              ? 'Roll Covered Call'
              : mode === 'called'
              ? 'Mark as Called Away'
              : 'Close Covered Call'}
          </button>
        </form>
      </div>
    </div>
  );
}
