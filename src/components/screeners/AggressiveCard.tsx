'use client';

import type { AggressiveOpportunity, ScreenerChangeStatus } from '@/types';
import { cn } from '@/lib/utils';

interface AggressiveCardProps {
  opportunity: AggressiveOpportunity;
  changeStatus?: ScreenerChangeStatus;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function AggressiveCard({ opportunity, changeStatus }: AggressiveCardProps) {
  const rsi = opportunity.rsi_value ?? opportunity.rsi;

  const rsiBadgeClass =
    rsi >= 70
      ? 'bg-red-500/20 text-red-400'
      : rsi <= 30
        ? 'bg-emerald-500/20 text-emerald-400'
        : 'bg-yellow-500/20 text-yellow-400';

  const borderClass =
    changeStatus === 'new'
      ? 'border-emerald-500/40'
      : changeStatus === 'removed'
        ? 'border-red-500/40'
        : 'border-border';

  const topContracts = (opportunity.best_contracts || []).slice(0, 3);

  return (
    <div className={cn('glass-card p-5 space-y-4 border', borderClass)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-foreground">{opportunity.ticker}</h3>
          <span className={cn('px-2 py-0.5 rounded-md text-xs font-bold', rsiBadgeClass)}>
            RSI {rsi.toFixed(0)}
          </span>
        </div>
        {changeStatus === 'new' && (
          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400">
            NEW
          </span>
        )}
        {changeStatus === 'removed' && (
          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-500/20 text-red-400">
            REMOVED
          </span>
        )}
      </div>

      {/* Current Price */}
      <p className="text-sm text-muted">
        Price: <span className="text-foreground font-medium">{formatCurrency(opportunity.current_price)}</span>
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted">Contracts</p>
          <p className="text-sm font-medium text-foreground">{formatNumber(opportunity.total_contracts)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Total OI</p>
          <p className="text-sm font-medium text-foreground">{formatNumber(opportunity.total_open_interest)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Liquid Strikes</p>
          <p className="text-sm font-medium text-foreground">{opportunity.liquid_strikes}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Volume</p>
          <p className="text-sm font-medium text-foreground">{formatNumber(opportunity.total_volume)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">ATM OI</p>
          <p className="text-sm font-medium text-foreground">{formatNumber(opportunity.atm_open_interest)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Stock Vol</p>
          <p className="text-sm font-medium text-foreground">{formatNumber(opportunity.stock_volume)}</p>
        </div>
      </div>

      {/* Top Contracts */}
      {topContracts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wider font-medium">Best Contracts</p>
          <div className="space-y-1.5">
            {topContracts.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-background/40 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">${c.strike_price}</span>
                  <span className="text-muted">{c.expiration_date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-profit">{formatCurrency(c.premium)}</span>
                  <span className="text-muted">OI {formatNumber(c.open_interest)}</span>
                  <span className="text-muted">IV {(c.implied_volatility * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
