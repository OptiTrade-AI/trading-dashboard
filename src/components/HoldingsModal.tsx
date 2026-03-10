'use client';

import { useState, useEffect } from 'react';
import { StockHolding, ALL_TICKERS } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface HoldingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (holding: Omit<StockHolding, 'id'>) => void;
  editHolding?: StockHolding | null;
  onUpdate?: (id: string, updates: Partial<Omit<StockHolding, 'id'>>) => void;
}

export function HoldingsModal({ isOpen, onClose, onSubmit, editHolding, onUpdate }: HoldingsModalProps) {
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [costBasisPerShare, setCostBasisPerShare] = useState('');
  const [acquiredDate, setAcquiredDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [showTickerList, setShowTickerList] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState(ALL_TICKERS);

  const isEdit = !!editHolding;

  useEffect(() => {
    if (editHolding) {
      setTicker(editHolding.ticker);
      setShares(editHolding.shares.toString());
      setCostBasisPerShare(editHolding.costBasisPerShare.toString());
      setAcquiredDate(editHolding.acquiredDate);
      setNotes(editHolding.notes || '');
    } else {
      setTicker('');
      setShares('');
      setCostBasisPerShare('');
      setAcquiredDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
    }
  }, [editHolding, isOpen]);

  useEffect(() => {
    if (ticker) {
      setFilteredTickers(ALL_TICKERS.filter(t => t.toLowerCase().includes(ticker.toLowerCase())));
    } else {
      setFilteredTickers(ALL_TICKERS);
    }
  }, [ticker]);

  const numShares = parseInt(shares) || 0;
  const numCostBasis = parseFloat(costBasisPerShare) || 0;
  const totalCost = numShares * numCostBasis;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !shares || !costBasisPerShare || !acquiredDate) return;

    const data = {
      ticker: ticker.toUpperCase(),
      shares: numShares,
      costBasisPerShare: numCostBasis,
      acquiredDate,
      ...(notes ? { notes } : {}),
    };

    if (isEdit && onUpdate && editHolding) {
      onUpdate(editHolding.id, data);
    } else {
      onSubmit(data);
    }

    setTicker('');
    setShares('');
    setCostBasisPerShare('');
    setAcquiredDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Holding' : 'Add Holding'}
            </h2>
            <p className="text-muted text-sm mt-0.5">
              {isEdit ? 'Update your position details' : 'Enter your share position'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Ticker */}
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
                    onClick={() => { setTicker(t); setShowTickerList(false); }}
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

          {/* Shares + Cost Basis */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="stat-label mb-2 block">Shares</label>
              <input
                type="number"
                min="1"
                step="1"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="input-field"
                placeholder="100"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Cost Basis / Share</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costBasisPerShare}
                onChange={(e) => setCostBasisPerShare(e.target.value)}
                className="input-field"
                placeholder="150.00"
                required
              />
            </div>
          </div>

          {/* Acquired Date */}
          <div>
            <label className="stat-label mb-2 block">Acquired Date</label>
            <input
              type="date"
              value={acquiredDate}
              onChange={(e) => setAcquiredDate(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="stat-label mb-2 block">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Optional notes about this lot..."
            />
          </div>

          {/* Preview */}
          {numShares > 0 && numCostBasis > 0 && (
            <div className="bg-background/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted">Total Cost</span>
                <span className="text-foreground font-semibold">{formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Shares</span>
                <span className="text-foreground font-semibold">{numShares}</span>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3">
            {isEdit ? 'Update Holding' : 'Add Holding'}
          </button>
        </form>
      </div>
    </div>
  );
}
