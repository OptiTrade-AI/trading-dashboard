'use client';

import type { SwingSignal } from '@/types';
import { cn } from '@/lib/utils';

interface SwingSignalCardProps {
  signal: SwingSignal;
  isConfluence?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function SwingSignalCard({ signal, isConfluence }: SwingSignalCardProps) {
  const isLong = signal.signal_type === 'LONG';

  const signalBadgeClass = isLong
    ? 'bg-emerald-500/20 text-emerald-400'
    : 'bg-red-500/20 text-red-400';

  const confidenceClass =
    signal.confidence === 'HIGH'
      ? 'bg-emerald-500/20 text-emerald-400'
      : signal.confidence === 'MEDIUM'
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-red-500/20 text-red-400';

  return (
    <div
      className={cn(
        'glass-card p-5 space-y-4',
        isConfluence && 'border-accent/40'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-foreground">{signal.ticker}</h3>
          <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold', signalBadgeClass)}>
            {signal.signal_type}
          </span>
          <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold', confidenceClass)}>
            {signal.confidence}
          </span>
        </div>
        {isConfluence && (
          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-accent/20 text-accent">
            CONFLUENCE
          </span>
        )}
      </div>

      {/* Strategy */}
      <p className="text-sm text-muted">
        Strategy: <span className="text-foreground font-medium">{signal.strategy}</span>
      </p>

      {/* Price Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted">Entry</p>
          <p className="text-sm font-medium text-foreground">{formatCurrency(signal.entry_price)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Target</p>
          <p className="text-sm font-medium text-profit">{formatCurrency(signal.target)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Stop Loss</p>
          <p className="text-sm font-medium text-loss">{formatCurrency(signal.stop_loss)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">R:R Ratio</p>
          <p className="text-sm font-medium text-foreground">{signal.risk_reward_ratio.toFixed(2)}</p>
        </div>
      </div>

      {/* Details */}
      {signal.details && (
        <p className="text-xs text-muted leading-relaxed">{signal.details}</p>
      )}

      {/* Volume */}
      <p className="text-xs text-muted">
        Volume: <span className="text-foreground">{formatNumber(signal.volume)}</span>
      </p>
    </div>
  );
}
