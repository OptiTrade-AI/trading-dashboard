'use client';

import { useState, useEffect } from 'react';
import { StockEvent, ALL_TICKERS } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface AddStockEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<StockEvent, 'id' | 'realizedPL'>) => void;
}

export function AddStockEventModal({ isOpen, onClose, onSubmit }: AddStockEventModalProps) {
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isTaxLossHarvest, setIsTaxLossHarvest] = useState(true);
  const [replacementTradeType, setReplacementTradeType] = useState<'csp' | 'cc' | 'spread' | ''>('');
  const [notes, setNotes] = useState('');
  const [showTickerList, setShowTickerList] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState(ALL_TICKERS);

  useEffect(() => {
    if (ticker) {
      setFilteredTickers(ALL_TICKERS.filter(t => t.toLowerCase().includes(ticker.toLowerCase())));
    } else {
      setFilteredTickers(ALL_TICKERS);
    }
  }, [ticker]);

  const numShares = parseInt(shares) || 0;
  const numCostBasis = parseFloat(costBasis) || 0;
  const numSalePrice = parseFloat(salePrice) || 0;
  const totalCost = numCostBasis * numShares;
  const totalProceeds = numSalePrice * numShares;
  const realizedPL = totalProceeds - totalCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !shares || !costBasis || !salePrice || !saleDate) return;

    onSubmit({
      ticker: ticker.toUpperCase(),
      shares: numShares,
      costBasis: numCostBasis,
      salePrice: numSalePrice,
      saleDate,
      isTaxLossHarvest,
      ...(isTaxLossHarvest && replacementTradeType ? { replacementTradeType: replacementTradeType as 'csp' | 'cc' | 'spread' } : {}),
      ...(notes ? { notes } : {}),
    });

    setTicker('');
    setShares('');
    setCostBasis('');
    setSalePrice('');
    setSaleDate(format(new Date(), 'yyyy-MM-dd'));
    setIsTaxLossHarvest(true);
    setReplacementTradeType('');
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Log Stock Sale</h2>
            <p className="text-muted text-sm mt-0.5">Record a stock sale or tax loss harvest</p>
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
              placeholder="HOOD"
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

          {/* Shares + Prices */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="stat-label mb-2 block">Shares</label>
              <input
                type="number"
                min="1"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="input-field"
                placeholder="100"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Cost Basis</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                className="input-field"
                placeholder="30.50"
                required
              />
            </div>
            <div>
              <label className="stat-label mb-2 block">Sale Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="input-field"
                placeholder="28.00"
                required
              />
            </div>
          </div>

          {/* Sale Date */}
          <div>
            <label className="stat-label mb-2 block">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {/* TLH Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-background/30 border border-border/30">
            <div>
              <div className="text-sm font-medium text-foreground">Tax Loss Harvest</div>
              <div className="text-xs text-muted mt-0.5">Intentional sale to harvest tax losses</div>
            </div>
            <button
              type="button"
              onClick={() => setIsTaxLossHarvest(!isTaxLossHarvest)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isTaxLossHarvest ? 'bg-caution' : 'bg-zinc-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isTaxLossHarvest ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Replacement Trade Type (shown when TLH) */}
          {isTaxLossHarvest && (
            <div>
              <label className="stat-label mb-2 block">Replacement Strategy</label>
              <select
                value={replacementTradeType}
                onChange={(e) => setReplacementTradeType(e.target.value as '' | 'csp' | 'cc' | 'spread')}
                className="input-field"
              >
                <option value="">None / Not yet</option>
                <option value="csp">Cash-Secured Put</option>
                <option value="cc">Covered Call</option>
                <option value="spread">Spread</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="stat-label mb-2 block">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              placeholder="Sold to harvest loss, selling CSP at $28..."
            />
          </div>

          {/* Preview */}
          {numShares > 0 && (numCostBasis > 0 || numSalePrice > 0) && (
            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-background/30 border border-border/30">
              <div>
                <div className="stat-label mb-1">Total Cost</div>
                <div className="text-sm font-semibold text-foreground">{formatCurrency(totalCost)}</div>
              </div>
              <div>
                <div className="stat-label mb-1">Proceeds</div>
                <div className="text-sm font-semibold text-foreground">{formatCurrency(totalProceeds)}</div>
              </div>
              <div>
                <div className="stat-label mb-1">Realized P/L</div>
                <div className={`text-sm font-bold ${realizedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {realizedPL >= 0 ? '+' : ''}{formatCurrency(realizedPL)}
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full">
            {isTaxLossHarvest ? 'Log Tax Loss Harvest' : 'Log Stock Sale'}
          </button>
        </form>
      </div>
    </div>
  );
}
