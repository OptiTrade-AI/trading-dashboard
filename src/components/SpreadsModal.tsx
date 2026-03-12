'use client';

import { useState, useEffect } from 'react';
import { SpreadTrade, SpreadType, SPREAD_EXIT_REASONS, SpreadExitReason, SPREAD_TYPE_LABELS } from '@/types';
import { calculateDTEFromEntry } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { format } from 'date-fns';
import { AITradeCheck } from './AITradeCheck';
import { AIRollAdvisor } from './AIRollAdvisor';
import { TickerAutocomplete } from './shared/TickerAutocomplete';
import type { RollRecommendation } from '@/types';

interface AddSpreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status'>) => void;
}

export function AddSpreadModal({ isOpen, onClose, onSubmit }: AddSpreadModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [spreadType, setSpreadType] = useState<SpreadType>('call_debit');
  const [longStrike, setLongStrike] = useState('');
  const [shortStrike, setShortStrike] = useState('');
  const [longPrice, setLongPrice] = useState('');
  const [shortPrice, setShortPrice] = useState('');
  const [contracts, setContracts] = useState('1');
  const [expiration, setExpiration] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const numContracts = parseInt(contracts) || 1;
  const lPrice = parseFloat(longPrice) || 0;
  const sPrice = parseFloat(shortPrice) || 0;
  const lStrike = parseFloat(longStrike) || 0;
  const sStrike = parseFloat(shortStrike) || 0;
  const strikeDiff = Math.abs(lStrike - sStrike);
  const netDebit = (lPrice - sPrice) * 100 * numContracts;
  const netDebitPerContract = lPrice - sPrice;
  const isDebit = spreadType === 'call_debit' || spreadType === 'put_debit';

  const maxProfit = isDebit
    ? (strikeDiff - netDebitPerContract) * 100 * numContracts
    : Math.abs(netDebit);
  const maxLoss = isDebit
    ? netDebit
    : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * numContracts;

  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  // Breakeven calculation
  const breakeven = (() => {
    if (!lStrike || !sStrike) return 0;
    if (spreadType === 'call_debit') return lStrike + netDebitPerContract;
    if (spreadType === 'call_credit') return sStrike + Math.abs(netDebitPerContract);
    if (spreadType === 'put_debit') return lStrike - netDebitPerContract;
    // put_credit
    return sStrike - Math.abs(netDebitPerContract);
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !longStrike || !shortStrike || !longPrice || !shortPrice || !expiration || !contracts) return;

    onSubmit({
      ticker: ticker.toUpperCase(),
      spreadType,
      longStrike: lStrike,
      shortStrike: sStrike,
      longPrice: lPrice,
      shortPrice: sPrice,
      contracts: numContracts,
      expiration,
      entryDate,
      notes: notes || undefined,
    });

    setTicker('');
    setSpreadType('call_debit');
    setLongStrike('');
    setShortStrike('');
    setLongPrice('');
    setShortPrice('');
    setContracts('1');
    setExpiration('');
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add Spread Trade</h2>
            <p className="text-muted text-sm mt-0.5">Vertical spread position</p>
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
            iconBgClass="bg-purple-500/10"
            iconTextClass="text-purple-400"
          />

          {/* Spread Type Selector */}
          <div>
            <label className="stat-label mb-2 block">Spread Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['call_debit', 'call_credit', 'put_debit', 'put_credit'] as SpreadType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSpreadType(type)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                    spreadType === type
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-background/30 text-muted border border-border hover:text-foreground'
                  }`}
                >
                  {SPREAD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">Long Strike</label>
              <input
                type="number"
                step="0.5"
                value={longStrike}
                onChange={(e) => setLongStrike(e.target.value)}
                className="input-field"
                placeholder="30.00"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Short Strike</label>
              <input
                type="number"
                step="0.5"
                value={shortStrike}
                onChange={(e) => setShortStrike(e.target.value)}
                className="input-field"
                placeholder="35.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Long Price</label>
              <input
                type="number"
                step="0.01"
                value={longPrice}
                onChange={(e) => setLongPrice(e.target.value)}
                className="input-field"
                placeholder="2.50"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Short Price</label>
              <input
                type="number"
                step="0.01"
                value={shortPrice}
                onChange={(e) => setShortPrice(e.target.value)}
                className="input-field"
                placeholder="1.20"
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
              placeholder="Earnings play..."
            />
          </div>

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">{netDebit >= 0 ? 'Net Debit' : 'Net Credit'}</span>
              <span className="text-foreground font-semibold">{formatCurrency(Math.abs(netDebit))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Max Profit</span>
              <span className="text-profit font-semibold">+{formatCurrency(maxProfit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Max Loss</span>
              <span className="text-loss font-semibold">-{formatCurrency(maxLoss)}</span>
            </div>
            {breakeven > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted">Breakeven</span>
                <span className="text-foreground font-semibold">${breakeven.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
          </div>

          <AITradeCheck
            trade={{
              ticker: ticker.toUpperCase(),
              strategy: 'Spread',
              contracts: numContracts,
              expiration,
              spreadType,
              longStrike: lStrike || undefined,
              shortStrike: sStrike || undefined,
              netDebit: netDebit || undefined,
              maxLoss: maxLoss || undefined,
            }}
            disabled={!ticker || !longStrike || !shortStrike || !expiration}
          />

          <button type="submit" className="btn-primary w-full py-3">
            Add Spread Trade
          </button>
        </form>
      </div>
    </div>
  );
}

interface EditSpreadModalProps {
  isOpen: boolean;
  trade: SpreadTrade | null;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<SpreadTrade>) => void;
}

export function EditSpreadModal({ isOpen, trade, onClose, onSubmit }: EditSpreadModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [spreadType, setSpreadType] = useState<SpreadType>('call_debit');
  const [longStrike, setLongStrike] = useState('');
  const [shortStrike, setShortStrike] = useState('');
  const [longPrice, setLongPrice] = useState('');
  const [shortPrice, setShortPrice] = useState('');
  const [contracts, setContracts] = useState('');
  const [expiration, setExpiration] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (trade) {
      setTicker(trade.ticker);
      setSpreadType(trade.spreadType);
      setLongStrike(trade.longStrike.toString());
      setShortStrike(trade.shortStrike.toString());
      setLongPrice(trade.longPrice.toString());
      setShortPrice(trade.shortPrice.toString());
      setContracts(trade.contracts.toString());
      setExpiration(trade.expiration);
      setEntryDate(trade.entryDate);
      setNotes(trade.notes || '');
    }
  }, [trade]);

  const numContracts = parseInt(contracts) || 1;
  const lPrice = parseFloat(longPrice) || 0;
  const sPrice = parseFloat(shortPrice) || 0;
  const lStrike = parseFloat(longStrike) || 0;
  const sStrike = parseFloat(shortStrike) || 0;
  const strikeDiff = Math.abs(lStrike - sStrike);
  const netDebit = (lPrice - sPrice) * 100 * numContracts;
  const netDebitPerContract = lPrice - sPrice;
  const isDebit = spreadType === 'call_debit' || spreadType === 'put_debit';

  const maxProfit = isDebit
    ? (strikeDiff - netDebitPerContract) * 100 * numContracts
    : Math.abs(netDebit);
  const maxLoss = isDebit
    ? netDebit
    : (strikeDiff - Math.abs(netDebitPerContract)) * 100 * numContracts;

  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade || !ticker || !longStrike || !shortStrike || !longPrice || !shortPrice || !expiration || !contracts) return;

    onSubmit(trade.id, {
      ticker: ticker.toUpperCase(),
      spreadType,
      longStrike: lStrike,
      shortStrike: sStrike,
      longPrice: lPrice,
      shortPrice: sPrice,
      contracts: numContracts,
      expiration,
      entryDate,
      dteAtEntry: dte,
      netDebit,
      maxProfit,
      maxLoss,
      notes: notes || undefined,
    });
    onClose();
  };

  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <span className="text-purple-400 font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Edit Spread Trade</h2>
              <p className="text-muted text-sm">{trade.ticker} {SPREAD_TYPE_LABELS[trade.spreadType]} ${trade.longStrike}/{trade.shortStrike}</p>
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
            iconBgClass="bg-purple-500/10"
            iconTextClass="text-purple-400"
          />

          {/* Spread Type Selector */}
          <div>
            <label className="stat-label mb-2 block">Spread Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['call_debit', 'call_credit', 'put_debit', 'put_credit'] as SpreadType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSpreadType(type)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                    spreadType === type
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-background/30 text-muted border border-border hover:text-foreground'
                  }`}
                >
                  {SPREAD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">Long Strike</label>
              <input
                type="number"
                step="0.5"
                value={longStrike}
                onChange={(e) => setLongStrike(e.target.value)}
                className="input-field"
                placeholder="30.00"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Short Strike</label>
              <input
                type="number"
                step="0.5"
                value={shortStrike}
                onChange={(e) => setShortStrike(e.target.value)}
                className="input-field"
                placeholder="35.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Long Price</label>
              <input
                type="number"
                step="0.01"
                value={longPrice}
                onChange={(e) => setLongPrice(e.target.value)}
                className="input-field"
                placeholder="2.50"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Short Price</label>
              <input
                type="number"
                step="0.01"
                value={shortPrice}
                onChange={(e) => setShortPrice(e.target.value)}
                className="input-field"
                placeholder="1.20"
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
              placeholder="Earnings play..."
            />
          </div>

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">{netDebit >= 0 ? 'Net Debit' : 'Net Credit'}</span>
              <span className="text-foreground font-semibold">{formatCurrency(Math.abs(netDebit))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Max Profit</span>
              <span className="text-profit font-semibold">+{formatCurrency(maxProfit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Max Loss</span>
              <span className="text-loss font-semibold">-{formatCurrency(maxLoss)}</span>
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

interface CloseSpreadModalProps {
  isOpen: boolean;
  trade: SpreadTrade | null;
  onClose: () => void;
  onSubmit: (closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason) => void;
  onPartialClose?: (contractsToClose: number, closeNetCredit: number, exitDate: string, exitReason: SpreadExitReason) => void;
  onRoll?: (closeNetCredit: number, exitDate: string, newSpread: Omit<SpreadTrade, 'id' | 'dteAtEntry' | 'netDebit' | 'maxProfit' | 'maxLoss' | 'status' | 'rollChainId' | 'rollNumber'>) => void;
}

export function CloseSpreadModal({ isOpen, trade, onClose, onSubmit, onPartialClose, onRoll }: CloseSpreadModalProps) {
  const { formatCurrency } = useFormatters();
  const [closeNetCredit, setCloseNetCredit] = useState('');
  const [exitDate, setExitDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exitReason, setExitReason] = useState<SpreadExitReason>('profit target');
  const [isPartialClose, setIsPartialClose] = useState(false);
  const [contractsToClose, setContractsToClose] = useState('1');
  const [isRolling, setIsRolling] = useState(false);

  // Roll fields
  const [newSpreadType, setNewSpreadType] = useState<SpreadType>('call_debit');
  const [newLongStrike, setNewLongStrike] = useState('');
  const [newShortStrike, setNewShortStrike] = useState('');
  const [newLongPrice, setNewLongPrice] = useState('');
  const [newShortPrice, setNewShortPrice] = useState('');
  const [newContracts, setNewContracts] = useState('');
  const [newExpiration, setNewExpiration] = useState('');

  useEffect(() => {
    if (trade) {
      setCloseNetCredit('');
      setExitReason('profit target');
      setIsPartialClose(false);
      setContractsToClose('1');
      setIsRolling(false);
      setNewSpreadType(trade.spreadType);
      setNewLongStrike(trade.longStrike.toString());
      setNewShortStrike(trade.shortStrike.toString());
      setNewLongPrice('');
      setNewShortPrice('');
      setNewContracts(trade.contracts.toString());
      setNewExpiration('');
    }
  }, [trade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (closeNetCredit === '') return;
    if (isPartialClose && onPartialClose && trade) {
      const numToClose = parseInt(contractsToClose);
      if (!numToClose || numToClose < 1 || numToClose >= trade.contracts) return;
      onPartialClose(numToClose, parseFloat(closeNetCredit), exitDate, exitReason);
    } else if (isRolling && onRoll && trade) {
      if (!newLongStrike || !newShortStrike || !newLongPrice || !newShortPrice || !newExpiration) return;
      onRoll(parseFloat(closeNetCredit), exitDate, {
        ticker: trade.ticker,
        spreadType: newSpreadType,
        longStrike: parseFloat(newLongStrike),
        shortStrike: parseFloat(newShortStrike),
        longPrice: parseFloat(newLongPrice),
        shortPrice: parseFloat(newShortPrice),
        contracts: parseInt(newContracts) || trade.contracts,
        expiration: newExpiration,
        entryDate: exitDate,
      });
    } else {
      onSubmit(parseFloat(closeNetCredit), exitDate, exitReason);
    }
    onClose();
  };

  if (!isOpen || !trade) return null;

  const closeCredit = parseFloat(closeNetCredit || '0');
  const pl = closeCredit - trade.netDebit;
  const plPercent = trade.netDebit < 0
    ? (trade.maxLoss !== 0 ? (pl / trade.maxLoss) * 100 : 0)
    : (trade.netDebit !== 0 ? (pl / trade.netDebit) * 100 : 0);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <span className="text-purple-400 font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isRolling ? 'Roll Spread Trade' : 'Close Spread Trade'}
              </h2>
              <p className="text-muted text-sm">
                {trade.ticker} {SPREAD_TYPE_LABELS[trade.spreadType]} ${trade.longStrike}/{trade.shortStrike} × {trade.contracts}
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
              <span className="text-purple-400 font-semibold">{SPREAD_TYPE_LABELS[trade.spreadType]}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Contracts</span>
              <span className="text-foreground font-semibold">{trade.contracts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">{trade.netDebit >= 0 ? 'Net Debit' : 'Net Credit'}</span>
              <span className="text-foreground font-semibold">{formatCurrency(Math.abs(trade.netDebit))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Max Profit / Max Loss</span>
              <span className="text-foreground font-semibold">
                +{formatCurrency(trade.maxProfit)} / -{formatCurrency(trade.maxLoss)}
              </span>
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
                  isRolling ? 'bg-purple-500' : 'bg-background/50'
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
            <label className="stat-label mb-2 block">Net Credit at Close (total)</label>
            <input
              type="number"
              step="0.01"
              value={closeNetCredit}
              onChange={(e) => setCloseNetCredit(e.target.value)}
              className="input-field"
              placeholder="150.00"
              required
            />
            <p className="text-muted text-xs mt-1">Total net credit received when closing the position</p>
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
                onChange={(e) => setExitReason(e.target.value as SpreadExitReason)}
                className="input-field"
              >
                {SPREAD_EXIT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Roll fields */}
          {isRolling && (
            <>
              <AIRollAdvisor
                position={{
                  ticker: trade.ticker,
                  strategy: 'Spread',
                  strike: trade.shortStrike,
                  contracts: trade.contracts,
                  expiration: trade.expiration,
                  entryDate: trade.entryDate,
                  spreadType: trade.spreadType,
                  longStrike: trade.longStrike,
                  shortStrike: trade.shortStrike,
                }}
                onApply={(rec: RollRecommendation) => {
                  setNewShortStrike(rec.targetStrike.toString());
                  const width = Math.abs(trade.longStrike - trade.shortStrike);
                  const isCredit = trade.spreadType === 'call_credit' || trade.spreadType === 'put_credit';
                  const newLong = isCredit ? rec.targetStrike + width : rec.targetStrike - width;
                  setNewLongStrike(newLong.toString());
                  setNewExpiration(rec.targetExpiration);
                }}
              />
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-sm font-semibold text-purple-400 mb-3">New Position</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="stat-label mb-2 block">Long Strike</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newLongStrike}
                      onChange={(e) => setNewLongStrike(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-2 block">Short Strike</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newShortStrike}
                      onChange={(e) => setNewShortStrike(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="stat-label mb-2 block">Long Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newLongPrice}
                      onChange={(e) => setNewLongPrice(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="stat-label mb-2 block">Short Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newShortPrice}
                      onChange={(e) => setNewShortPrice(e.target.value)}
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
              {newExpiration && exitDate && (
                <div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">New DTE</span>
                    <span className="text-foreground font-semibold">
                      {calculateDTEFromEntry(exitDate, newExpiration)} days
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* P/L preview */}
          {!isRolling && (
            <div className={`rounded-xl p-4 space-y-2 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
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
            {isPartialClose && trade ? `Close ${contractsToClose} of ${trade.contracts} Contracts` : isRolling ? 'Roll Spread Trade' : 'Close Spread Trade'}
          </button>
        </form>
      </div>
    </div>
  );
}
