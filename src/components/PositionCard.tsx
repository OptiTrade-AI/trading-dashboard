'use client';

import { Trade } from '@/types';
import { calculateDTE, formatCurrency, formatDateShort, calculateReturnOnCollateral } from '@/lib/utils';

interface PositionCardProps {
  trade: Trade;
  onClose?: (trade: Trade) => void;
}

export function PositionCard({ trade, onClose }: PositionCardProps) {
  const dte = calculateDTE(trade.expiration);
  const returnOnCollateral = calculateReturnOnCollateral(trade);
  const dteWarning = dte <= 7;
  const dteCritical = dte <= 3;

  return (
    <div className="glass-card-hover p-5 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <span className="text-accent font-bold text-sm">{trade.ticker.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-semibold text-foreground">{trade.ticker}</div>
            <div className="text-muted text-sm">${trade.strike}P × {trade.contracts}</div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
          dteCritical
            ? 'bg-loss/10 text-loss'
            : dteWarning
              ? 'bg-caution/10 text-caution'
              : 'bg-accent/10 text-accent'
        }`}>
          {dte}d
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-background/30 rounded-xl p-3">
          <div className="text-muted text-xs uppercase tracking-wider mb-1">Premium</div>
          <div className="text-profit font-semibold">{formatCurrency(trade.premiumCollected)}</div>
        </div>
        <div className="bg-background/30 rounded-xl p-3">
          <div className="text-muted text-xs uppercase tracking-wider mb-1">Collateral</div>
          <div className="text-foreground font-semibold">{formatCurrency(trade.collateral)}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted">
          Exp: {formatDateShort(trade.expiration)}
        </div>
        <div className="text-profit font-medium">
          {returnOnCollateral.toFixed(1)}% ROC
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={() => onClose(trade)}
          className="mt-4 w-full py-2.5 text-sm font-semibold text-accent border border-accent/30 rounded-xl
                     bg-accent/5 hover:bg-accent/10 hover:border-accent/50 transition-all duration-200
                     group-hover:border-accent/40"
        >
          Close Position
        </button>
      )}
    </div>
  );
}
