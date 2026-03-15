'use client';

import { useState, useEffect } from 'react';
import { DirectionalTrade, DIRECTIONAL_EXIT_REASONS, DirectionalExitReason, OptionType } from '@/types';
import { calculateDTEFromEntry } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { format } from 'date-fns';
import { AITradeCheck } from './AITradeCheck';
import { AIRollAdvisor } from './AIRollAdvisor';
import { TickerAutocomplete } from './shared/TickerAutocomplete';
import type { RollRecommendation } from '@/types';

export interface DirectionalInitialValues {
  ticker?: string;
  strike?: number;
  expiration?: string;
  optionType?: OptionType;
}

interface AddDirectionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status'>) => void;
  initialValues?: DirectionalInitialValues;
}

export function AddDirectionalModal({ isOpen, onClose, onSubmit, initialValues }: AddDirectionalModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [optionType, setOptionType] = useState<OptionType>('call');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [expiration, setExpiration] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [commission, setCommission] = useState('');

  useEffect(() => {
    if (initialValues) {
      if (initialValues.ticker) setTicker(initialValues.ticker);
      if (initialValues.strike) setStrike(initialValues.strike.toString());
      if (initialValues.expiration) setExpiration(initialValues.expiration);
      if (initialValues.optionType) setOptionType(initialValues.optionType);
    }
  }, [initialValues]);

  const numContracts = parseInt(contracts) || 1;
  const price = parseFloat(entryPrice) || 0;
  const totalCost = price * 100 * numContracts;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !strike || !expiration || !entryPrice || !contracts) return;

    onSubmit({
      ticker: ticker.toUpperCase(),
      optionType,
      strike: parseFloat(strike),
      contracts: numContracts,
      entryPrice: price,
      expiration,
      entryDate,
      notes: notes || undefined,
      commission: commission ? parseFloat(commission) : undefined,
    });

    setTicker('');
    setOptionType('call');
    setStrike('');
    setContracts('1');
    setEntryPrice('');
    setExpiration('');
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    setCommission('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add Directional Trade</h2>
            <p className="text-muted text-sm mt-0.5">Long call or put position</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <TickerAutocomplete
            value={ticker}
            onChange={setTicker}
            iconBgClass="bg-amber-500/10"
            iconTextClass="text-amber-400"
          />

          {/* Option Type Toggle */}
          <div>
            <label className="stat-label mb-2 block">Option Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOptionType('call')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  optionType === 'call'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-background/30 text-muted border border-border hover:text-foreground'
                }`}
              >
                Call
              </button>
              <button
                type="button"
                onClick={() => setOptionType('put')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  optionType === 'put'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-background/30 text-muted border border-border hover:text-foreground'
                }`}
              >
                Put
              </button>
            </div>
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
              <label className="stat-label mb-2 block">Entry Price</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="input-field"
                placeholder="2.50"
                required
              />
            </div>
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

          <div>
            <label className="stat-label mb-2 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Hedge against..."
            />
          </div>

          <div>
            <label className="stat-label mb-2 block">Commission (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="input-field"
              placeholder="0.65"
            />
          </div>

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Total Cost</span>
              <span className="text-foreground font-semibold">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
          </div>

          <AITradeCheck
            trade={{
              ticker: ticker.toUpperCase(),
              strategy: 'Directional',
              strike: parseFloat(strike) || undefined,
              contracts: numContracts,
              expiration,
              entryPrice: price || undefined,
              costAtOpen: totalCost || undefined,
            }}
            disabled={!ticker || !strike || !expiration || !entryPrice}
          />

          <button type="submit" className="btn-primary w-full py-3">
            Add Directional Trade
          </button>
        </form>
      </div>
    </div>
  );
}

interface EditDirectionalModalProps {
  isOpen: boolean;
  trade: DirectionalTrade | null;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<DirectionalTrade>) => void;
}

export function EditDirectionalModal({ isOpen, trade, onClose, onSubmit }: EditDirectionalModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [optionType, setOptionType] = useState<OptionType>('call');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [expiration, setExpiration] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [commission, setCommission] = useState('');

  useEffect(() => {
    if (trade) {
      setTicker(trade.ticker);
      setOptionType(trade.optionType);
      setStrike(trade.strike.toString());
      setContracts(trade.contracts.toString());
      setEntryPrice(trade.entryPrice.toString());
      setExpiration(trade.expiration);
      setEntryDate(trade.entryDate);
      setNotes(trade.notes || '');
      setCommission(trade.commission?.toString() || '');
    }
  }, [trade]);

  const numContracts = parseInt(contracts) || 1;
  const price = parseFloat(entryPrice) || 0;
  const totalCost = price * 100 * numContracts;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade || !ticker || !strike || !expiration || !entryPrice || !contracts) return;

    onSubmit(trade.id, {
      ticker: ticker.toUpperCase(),
      optionType,
      strike: parseFloat(strike),
      contracts: numContracts,
      entryPrice: price,
      expiration,
      entryDate,
      dteAtEntry: dte,
      costAtOpen: price * 100 * numContracts,
      notes: notes || undefined,
      commission: commission ? parseFloat(commission) : undefined,
    });
    onClose();
  };

  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="text-amber-400 font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Edit Directional Trade</h2>
              <p className="text-muted text-sm">{trade.ticker} ${trade.strike}{trade.optionType === 'call' ? 'C' : 'P'}</p>
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
          <TickerAutocomplete
            value={ticker}
            onChange={setTicker}
            iconBgClass="bg-amber-500/10"
            iconTextClass="text-amber-400"
          />

          {/* Option Type Toggle */}
          <div>
            <label className="stat-label mb-2 block">Option Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOptionType('call')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  optionType === 'call'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-background/30 text-muted border border-border hover:text-foreground'
                }`}
              >
                Call
              </button>
              <button
                type="button"
                onClick={() => setOptionType('put')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  optionType === 'put'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-background/30 text-muted border border-border hover:text-foreground'
                }`}
              >
                Put
              </button>
            </div>
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
              <label className="stat-label mb-2 block">Entry Price</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="input-field"
                placeholder="2.50"
                required
              />
            </div>
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

          <div>
            <label className="stat-label mb-2 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Hedge against..."
            />
          </div>

          <div>
            <label className="stat-label mb-2 block">Commission (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="input-field"
              placeholder="0.65"
            />
          </div>

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Total Cost</span>
              <span className="text-foreground font-semibold">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-3">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

interface CloseDirectionalModalProps {
  isOpen: boolean;
  trade: DirectionalTrade | null;
  onClose: () => void;
  onSubmit: (exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number) => void;
  onPartialClose?: (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: DirectionalExitReason, closeCommission?: number) => void;
  onRoll?: (exitPrice: number, exitDate: string, newTrade: Omit<DirectionalTrade, 'id' | 'dteAtEntry' | 'costAtOpen' | 'status' | 'rollChainId' | 'rollNumber'>) => void;
}

export function CloseDirectionalModal({ isOpen, trade, onClose, onSubmit, onPartialClose, onRoll }: CloseDirectionalModalProps) {
  const { formatCurrency } = useFormatters();
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exitReason, setExitReason] = useState<DirectionalExitReason>('profit target');
  const [isPartialClose, setIsPartialClose] = useState(false);
  const [contractsToClose, setContractsToClose] = useState('1');
  const [isRolling, setIsRolling] = useState(false);
  const [closeCommission, setCloseCommission] = useState('');

  // Roll fields
  const [newStrike, setNewStrike] = useState('');
  const [newExpiration, setNewExpiration] = useState('');
  const [newEntryPrice, setNewEntryPrice] = useState('');
  const [newContracts, setNewContracts] = useState('');

  useEffect(() => {
    if (trade) {
      setExitPrice('');
      setExitReason('profit target');
      setIsPartialClose(false);
      setContractsToClose('1');
      setIsRolling(false);
      setNewStrike(trade.strike.toString());
      setNewContracts(trade.contracts.toString());
      setNewExpiration('');
      setNewEntryPrice('');
    }
  }, [trade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const commissionVal = closeCommission ? parseFloat(closeCommission) : undefined;
    if (exitPrice === '') return;
    if (isPartialClose && onPartialClose && trade) {
      const numToClose = parseInt(contractsToClose);
      if (!numToClose || numToClose < 1 || numToClose >= trade.contracts) return;
      onPartialClose(numToClose, parseFloat(exitPrice), exitDate, exitReason, commissionVal);
    } else if (isRolling && onRoll && trade) {
      if (!newStrike || !newExpiration || !newEntryPrice) return;
      onRoll(parseFloat(exitPrice), exitDate, {
        ticker: trade.ticker,
        optionType: trade.optionType,
        strike: parseFloat(newStrike),
        contracts: parseInt(newContracts) || trade.contracts,
        entryPrice: parseFloat(newEntryPrice),
        expiration: newExpiration,
        entryDate: exitDate,
      });
    } else {
      onSubmit(parseFloat(exitPrice), exitDate, exitReason, commissionVal);
    }
    onClose();
  };

  if (!isOpen || !trade) return null;

  const exitPriceNum = parseFloat(exitPrice || '0');
  const creditAtClose = exitPriceNum * 100 * trade.contracts;
  const pl = creditAtClose - trade.costAtOpen;
  const plPercent = trade.costAtOpen > 0 ? (pl / trade.costAtOpen) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="text-amber-400 font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isRolling ? 'Roll Directional Trade' : 'Close Directional Trade'}
              </h2>
              <p className="text-muted text-sm">
                {trade.ticker} ${trade.strike}{trade.optionType === 'call' ? 'C' : 'P'} × {trade.contracts}
              </p>
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
          {/* Position summary */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Type</span>
              <span className={`font-semibold ${trade.optionType === 'call' ? 'text-green-400' : 'text-red-400'}`}>
                Long {trade.optionType === 'call' ? 'Call' : 'Put'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Contracts</span>
              <span className="text-foreground font-semibold">{trade.contracts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Cost at Open</span>
              <span className="text-foreground font-semibold">{formatCurrency(trade.costAtOpen)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Entry Price</span>
              <span className="text-foreground font-semibold">${trade.entryPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Partial close toggle */}
          {onPartialClose && trade.contracts > 1 && !isRolling && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPartialClose(!isPartialClose)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isPartialClose ? 'bg-caution' : 'bg-background/50'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    isPartialClose ? 'left-7' : 'left-1'
                  }`} />
                </button>
                <span className="text-foreground text-sm">Partial close (close some contracts)</span>
              </div>
              {isPartialClose && (
                <div>
                  <label className="stat-label mb-2 block">
                    Contracts to close (of {trade.contracts})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={trade.contracts - 1}
                    step="1"
                    value={contractsToClose}
                    onChange={(e) => setContractsToClose(e.target.value)}
                    className="input-field"
                    required
                  />
                  <p className="text-muted text-xs mt-1">
                    {parseInt(contractsToClose) || 0} will close, {trade.contracts - (parseInt(contractsToClose) || 0)} will remain open
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Roll toggle */}
          {onRoll && !isPartialClose && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsRolling(!isRolling)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isRolling ? 'bg-amber-500' : 'bg-background/50'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isRolling ? 'left-7' : 'left-1'
                }`} />
              </button>
              <span className="text-foreground text-sm">Roll to new position</span>
            </div>
          )}

          <div>
            <label className="stat-label mb-2 block">Exit Price (per contract)</label>
            <input
              type="number"
              step="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="input-field"
              placeholder="3.50"
              required
            />
          </div>

          <div>
            <label className="stat-label mb-2 block">{isRolling ? 'Roll Date' : 'Exit Date'}</label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {!isRolling && (
            <div>
              <label className="stat-label mb-2 block">Exit Reason</label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value as DirectionalExitReason)}
                className="input-field"
              >
                {DIRECTIONAL_EXIT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="stat-label mb-2 block">Commission (optional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closeCommission}
              onChange={(e) => setCloseCommission(e.target.value)}
              className="input-field"
              placeholder="0.65"
            />
          </div>

          {/* Roll fields */}
          {isRolling && (
            <>
              <AIRollAdvisor
                position={{
                  ticker: trade.ticker,
                  strategy: 'Directional',
                  strike: trade.strike,
                  contracts: trade.contracts,
                  expiration: trade.expiration,
                  entryDate: trade.entryDate,
                  costAtOpen: trade.costAtOpen,
                  entryPrice: trade.entryPrice,
                }}
                onApply={(rec: RollRecommendation) => {
                  setNewStrike(rec.targetStrike.toString());
                  setNewExpiration(rec.targetExpiration);
                  if (rec.expectedCredit > 0) setNewEntryPrice(rec.expectedCredit.toString());
                }}
              />
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-3">New Position</h3>
                <div className="grid grid-cols-3 gap-4">
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
                    <label className="stat-label mb-2 block">Contracts</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newContracts}
                      onChange={(e) => setNewContracts(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-2 block">Entry Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newEntryPrice}
                      onChange={(e) => setNewEntryPrice(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
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
              {newEntryPrice && newContracts && (
                <div className="bg-amber-500/5 rounded-xl p-4 space-y-3 border border-amber-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">New Cost</span>
                    <span className="text-foreground font-semibold">
                      {formatCurrency(parseFloat(newEntryPrice) * 100 * (parseInt(newContracts) || 1))}
                    </span>
                  </div>
                  {newExpiration && exitDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted">New DTE</span>
                      <span className="text-foreground font-semibold">
                        {calculateDTEFromEntry(exitDate, newExpiration)} days
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* P/L preview */}
          {!isRolling && (
            <div className={`rounded-xl p-4 space-y-2 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <div className="flex justify-between items-center">
                <span className={pl >= 0 ? 'text-profit' : 'text-loss'}>Credit at Close</span>
                <span className={`font-semibold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(creditAtClose)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={pl >= 0 ? 'text-profit' : 'text-loss'}>Estimated P/L</span>
                <span className={`text-xl font-bold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                  <span className="text-sm font-normal ml-2">({plPercent.toFixed(2)}%)</span>
                </span>
              </div>
            </div>
          )}

          {/* Roll P/L preview */}
          {isRolling && (
            <div className={`rounded-xl p-4 space-y-2 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">P/L on closed leg</span>
                <span className={`font-bold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                </span>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3">
            {isPartialClose && trade ? `Close ${contractsToClose} of ${trade.contracts} Contracts` : isRolling ? 'Roll Directional Trade' : 'Close Directional Trade'}
          </button>
        </form>
      </div>
    </div>
  );
}
