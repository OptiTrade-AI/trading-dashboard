'use client';

import { useState, useEffect } from 'react';
import { Trade, EXIT_REASONS, ExitReason } from '@/types';
import { calculateCollateral, calculateDTEFromEntry } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { format } from 'date-fns';
import { AITradeCheck } from './AITradeCheck';
import { AIRollAdvisor } from './AIRollAdvisor';
import { TickerAutocomplete } from './shared/TickerAutocomplete';
import type { RollRecommendation } from '@/types';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status'>) => void;
}

export function AddTradeModal({ isOpen, onClose, onSubmit }: AddTradeModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('1');
  const [expiration, setExpiration] = useState('');
  const [premium, setPremium] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const numContracts = parseInt(contracts) || 1;
  const collateral = strike ? calculateCollateral(parseFloat(strike), numContracts) : 0;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !strike || !expiration || !premium || !contracts) return;

    onSubmit({
      ticker: ticker.toUpperCase(),
      strike: parseFloat(strike),
      contracts: numContracts,
      expiration,
      entryDate,
      premiumCollected: parseFloat(premium),
    });

    setTicker('');
    setStrike('');
    setContracts('1');
    setExpiration('');
    setPremium('');
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Add New Trade</h2>
            <p className="text-muted text-sm mt-0.5">Enter your CSP details</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <TickerAutocomplete value={ticker} onChange={setTicker} />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Strike Price</label>
              <input
                type="number"
                step="0.01"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                className="input-field"
                placeholder="25.00"
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
              <label className="stat-label mb-2 block">Premium</label>
              <input
                type="number"
                step="0.01"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="input-field"
                placeholder="85.00"
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

          {/* Calculated values */}
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Collateral Required</span>
              <span className="text-foreground font-semibold">{formatCurrency(collateral)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
            {collateral > 0 && premium && (
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted">Return on Collateral</span>
                <span className="text-profit font-semibold">
                  {((parseFloat(premium) / collateral) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <AITradeCheck
            trade={{
              ticker: ticker.toUpperCase(),
              strategy: 'CSP',
              strike: parseFloat(strike) || undefined,
              contracts: numContracts,
              expiration,
              premium: parseFloat(premium) || undefined,
              collateral,
            }}
            disabled={!ticker || !strike || !expiration || !premium}
          />

          <button type="submit" className="btn-primary w-full py-3">
            Add Trade
          </button>
        </form>
      </div>
    </div>
  );
}

interface EditTradeModalProps {
  isOpen: boolean;
  trade: Trade | null;
  onClose: () => void;
  onSubmit: (id: string, updates: Partial<Trade>) => void;
}

export function EditTradeModal({ isOpen, trade, onClose, onSubmit }: EditTradeModalProps) {
  const { formatCurrency } = useFormatters();
  const [ticker, setTicker] = useState('');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('');
  const [expiration, setExpiration] = useState('');
  const [premium, setPremium] = useState('');
  const [entryDate, setEntryDate] = useState('');

  useEffect(() => {
    if (trade) {
      setTicker(trade.ticker);
      setStrike(trade.strike.toString());
      setContracts(trade.contracts.toString());
      setExpiration(trade.expiration);
      setPremium(trade.premiumCollected.toString());
      setEntryDate(trade.entryDate);
    }
  }, [trade]);

  const numContracts = parseInt(contracts) || 1;
  const collateral = strike ? calculateCollateral(parseFloat(strike), numContracts) : 0;
  const dte = expiration && entryDate ? calculateDTEFromEntry(entryDate, expiration) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade || !ticker || !strike || !expiration || !premium || !contracts) return;

    onSubmit(trade.id, {
      ticker: ticker.toUpperCase(),
      strike: parseFloat(strike),
      contracts: numContracts,
      expiration,
      entryDate,
      premiumCollected: parseFloat(premium),
      dteAtEntry: dte,
      collateral,
    });
    onClose();
  };

  if (!isOpen || !trade) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-accent font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Edit Trade</h2>
              <p className="text-muted text-sm">{trade.ticker} ${trade.strike}P</p>
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
              <span className="text-muted">Collateral Required</span>
              <span className="text-foreground font-semibold">{formatCurrency(collateral)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Days to Expiration</span>
              <span className="text-foreground font-semibold">{dte} days</span>
            </div>
            {collateral > 0 && premium && (
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted">Return on Collateral</span>
                <span className="text-profit font-semibold">
                  {((parseFloat(premium) / collateral) * 100).toFixed(2)}%
                </span>
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

interface CloseTradeModalProps {
  isOpen: boolean;
  trade: Trade | null;
  onClose: () => void;
  onSubmit: (exitPrice: number, exitDate: string, exitReason: ExitReason) => void;
  onRoll?: (exitPrice: number, exitDate: string, newTrade: Omit<Trade, 'id' | 'dteAtEntry' | 'collateral' | 'status' | 'rollChainId' | 'rollNumber'>) => void;
  onPartialClose?: (contractsToClose: number, exitPrice: number, exitDate: string, exitReason: ExitReason) => void;
}

type CSPCloseMode = 'close' | 'partial' | 'roll' | 'assigned';

export function CloseTradeModal({ isOpen, trade, onClose, onSubmit, onRoll, onPartialClose }: CloseTradeModalProps) {
  const { formatCurrency } = useFormatters();
  const [mode, setMode] = useState<CSPCloseMode>('close');
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exitReason, setExitReason] = useState<ExitReason>('50% profit');
  const [contractsToClose, setContractsToClose] = useState('1');

  // Roll fields
  const [newStrike, setNewStrike] = useState('');
  const [newExpiration, setNewExpiration] = useState('');
  const [newPremium, setNewPremium] = useState('');
  const [newContracts, setNewContracts] = useState('');

  useEffect(() => {
    if (trade) {
      setMode('close');
      setExitPrice((trade.premiumCollected * 0.5).toFixed(2));
      setExitReason('50% profit');
      setContractsToClose('1');
      setNewStrike(trade.strike.toString());
      setNewContracts(trade.contracts.toString());
      setNewExpiration('');
      setNewPremium('');
    }
  }, [trade]);

  useEffect(() => {
    if (mode === 'assigned') {
      setExitPrice(trade?.premiumCollected.toFixed(2) ?? '0');
      setExitReason('assigned');
    } else if (trade) {
      setExitPrice((trade.premiumCollected * 0.5).toFixed(2));
      if (exitReason === 'assigned') setExitReason('50% profit');
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitPrice) return;

    if (mode === 'partial' && onPartialClose && trade) {
      const numToClose = parseInt(contractsToClose);
      if (!numToClose || numToClose < 1 || numToClose >= trade.contracts) return;
      onPartialClose(numToClose, parseFloat(exitPrice), exitDate, exitReason);
    } else if (mode === 'roll' && onRoll && trade) {
      if (!newStrike || !newExpiration || !newPremium) return;
      onRoll(parseFloat(exitPrice), exitDate, {
        ticker: trade.ticker,
        strike: parseFloat(newStrike),
        contracts: parseInt(newContracts) || trade.contracts,
        expiration: newExpiration,
        entryDate: exitDate,
        premiumCollected: parseFloat(newPremium),
      });
    } else {
      onSubmit(parseFloat(exitPrice), exitDate, exitReason);
    }
    onClose();
  };

  if (!isOpen || !trade) return null;

  const pl = trade.premiumCollected - parseFloat(exitPrice || '0');
  const plPercent = trade.collateral > 0 ? (pl / trade.collateral) * 100 : 0;
  const newCollateral = newStrike ? calculateCollateral(parseFloat(newStrike), parseInt(newContracts) || trade.contracts) : 0;
  const newDte = newExpiration && exitDate ? calculateDTEFromEntry(exitDate, newExpiration) : 0;

  // Build available modes
  const modes: { key: CSPCloseMode; label: string }[] = [
    { key: 'close', label: 'Close' },
    ...(onPartialClose && trade.contracts > 1 ? [{ key: 'partial' as const, label: 'Partial' }] : []),
    ...(onRoll ? [{ key: 'roll' as const, label: 'Roll' }] : []),
    { key: 'assigned', label: 'Assigned' },
  ];

  const modeTitle: Record<CSPCloseMode, string> = {
    close: 'Close Position',
    partial: 'Partial Close',
    roll: 'Roll Position',
    assigned: 'Assigned',
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-accent font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{modeTitle[mode]}</h2>
              <p className="text-muted text-sm">{trade.ticker} ${trade.strike}P × {trade.contracts}</p>
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
                    ? m.key === 'assigned'
                      ? 'bg-loss/20 text-loss shadow-sm'
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
          <div className="bg-background/30 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted">Contracts</span>
              <span className="text-foreground font-semibold">{trade.contracts}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Premium Collected</span>
              <span className="text-profit font-semibold">{formatCurrency(trade.premiumCollected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Collateral</span>
              <span className="text-foreground font-semibold">{formatCurrency(trade.collateral)}</span>
            </div>
          </div>

          {/* Partial close: contracts selector */}
          {mode === 'partial' && (
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

          {/* Exit reason (close & partial modes) */}
          {mode !== 'roll' && mode !== 'assigned' && (
            <div>
              <label className="stat-label mb-2 block">Exit Reason</label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value as ExitReason)}
                className="input-field"
              >
                {EXIT_REASONS.filter(r => r !== 'assigned').map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Exit price (not shown for assigned) */}
          {mode !== 'assigned' && (
            <div>
              <label className="stat-label mb-2 block">Exit Price (cost to close)</label>
              <input
                type="number"
                step="0.01"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="input-field"
                placeholder="42.50"
                required
              />
            </div>
          )}

          {/* Assignment info */}
          {mode === 'assigned' && (
            <div className="bg-accent/10 rounded-xl p-4 space-y-2">
              <p className="text-accent text-sm font-medium">
                You now own {trade.contracts * 100} shares of {trade.ticker}
              </p>
              <div className="text-accent/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Strike price:</span>
                  <span>${trade.strike.toFixed(2)}/share</span>
                </div>
                <div className="flex justify-between">
                  <span>Premium received:</span>
                  <span>-${(trade.premiumCollected / (trade.contracts * 100)).toFixed(2)}/share</span>
                </div>
                <div className="flex justify-between border-t border-accent/20 pt-1 font-medium">
                  <span>Effective cost basis:</span>
                  <span>${(trade.strike - trade.premiumCollected / (trade.contracts * 100)).toFixed(2)}/share</span>
                </div>
              </div>
            </div>
          )}

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

          {/* Roll fields */}
          {mode === 'roll' && (
            <>
              <AIRollAdvisor
                position={{
                  ticker: trade.ticker,
                  strategy: 'CSP',
                  strike: trade.strike,
                  contracts: trade.contracts,
                  expiration: trade.expiration,
                  entryDate: trade.entryDate,
                  premiumCollected: trade.premiumCollected,
                  collateral: trade.collateral,
                }}
                onApply={(rec: RollRecommendation) => {
                  setNewStrike(rec.targetStrike.toString());
                  setNewExpiration(rec.targetExpiration);
                  if (rec.expectedCredit > 0) setNewPremium(rec.expectedCredit.toString());
                }}
              />
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-sm font-semibold text-accent mb-3">New Position</h3>
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
                    <label className="stat-label mb-2 block">Premium</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPremium}
                      onChange={(e) => setNewPremium(e.target.value)}
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

              {/* New position preview */}
              <div className="bg-accent/5 rounded-xl p-4 space-y-3 border border-accent/20">
                <div className="flex justify-between items-center">
                  <span className="text-muted">New Collateral</span>
                  <span className="text-foreground font-semibold">{formatCurrency(newCollateral)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">New DTE</span>
                  <span className="text-foreground font-semibold">{newDte} days</span>
                </div>
                {newCollateral > 0 && newPremium && (
                  <div className="flex justify-between items-center pt-2 border-t border-accent/20">
                    <span className="text-muted">New ROC</span>
                    <span className="text-profit font-semibold">
                      {((parseFloat(newPremium) / newCollateral) * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* P/L preview (close & partial modes) */}
          {(mode === 'close' || mode === 'partial') && (
            <div className={`rounded-xl p-4 ${pl >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
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
                    {formatCurrency(pl + parseFloat(newPremium))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Assignment info */}
          {mode === 'assigned' && (
            <div className="rounded-xl p-4 bg-muted/10">
              <div className="flex justify-between items-center">
                <span className="text-muted">Realized P/L</span>
                <span className="text-foreground font-bold">$0.00</span>
              </div>
              <p className="text-muted text-xs mt-2">
                Premium is reflected in your cost basis. P/L realized when shares are sold.
              </p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3">
            {mode === 'partial' ? `Close ${contractsToClose} of ${trade.contracts} Contracts` : mode === 'roll' ? 'Roll Position' : mode === 'assigned' ? 'Mark as Assigned' : 'Close Trade'}
          </button>
        </form>
      </div>
    </div>
  );
}
