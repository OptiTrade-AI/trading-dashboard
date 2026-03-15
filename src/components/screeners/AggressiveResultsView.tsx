'use client';

import { useMemo, useState } from 'react';
import type { AggressiveOpportunity, ScreenerTickerChanges, ScreenerChangeStatus, ScreenerFilters } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'calls' | 'puts';
type SortKey = 'rsi' | 'volume' | 'oi' | 'contracts';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function RsiGauge({ rsi }: { rsi: number }) {
  // Semicircular gauge
  const angle = (rsi / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 20;
  const cx = 24;
  const cy = 24;
  const x = cx - r * Math.cos(rad);
  const y = cy - r * Math.sin(rad);
  const largeArc = angle > 90 ? 1 : 0;

  const color = rsi >= 70 ? '#ef4444' : rsi <= 30 ? '#10b981' : '#f59e0b';

  return (
    <svg width="48" height="28" viewBox="0 0 48 28" className="shrink-0">
      {/* Background arc */}
      <path d={`M 4 24 A 20 20 0 0 1 44 24`} fill="none" stroke="rgba(63,63,70,0.5)" strokeWidth="3" strokeLinecap="round" />
      {/* Value arc */}
      <path d={`M 4 24 A 20 20 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Needle dot */}
      <circle cx={x} cy={y} r="2" fill={color} />
      {/* Value text */}
      <text x="24" y="22" textAnchor="middle" className="text-[9px] font-bold" fill={color}>
        {rsi.toFixed(0)}
      </text>
    </svg>
  );
}

interface AggressiveResultsViewProps {
  calls: AggressiveOpportunity[];
  puts: AggressiveOpportunity[];
  tickerChanges: { calls: ScreenerTickerChanges | null; puts: ScreenerTickerChanges | null };
  filters: ScreenerFilters;
}

export function AggressiveResultsView({ calls, puts, tickerChanges, filters }: AggressiveResultsViewProps) {
  const [tab, setTab] = useState<Tab>('calls');
  const [sortBy, setSortBy] = useState<SortKey>('rsi');

  const { filtered, changeMap } = useMemo(() => {
    const list = tab === 'calls' ? calls : puts;
    const changes = tab === 'calls' ? tickerChanges?.calls : tickerChanges?.puts;

    const cMap = new Map<string, ScreenerChangeStatus>();
    if (changes) {
      changes.new_tickers?.forEach((t) => cMap.set(t, 'new'));
      changes.removed_tickers?.forEach((t) => cMap.set(t, 'removed'));
      changes.same_tickers?.forEach((t) => cMap.set(t, 'same'));
    }

    let rsiFiltered = list.filter((opp) => {
      const rsi = opp.rsi_value ?? opp.rsi;
      if (tab === 'calls' && rsi > 30) return false;
      if (tab === 'puts' && rsi < 70) return false;
      if (filters.tickerSearch && !opp.ticker.includes(filters.tickerSearch)) return false;
      if (filters.minVolume > 0 && opp.total_volume < filters.minVolume) return false;
      return true;
    });

    rsiFiltered.sort((a, b) => {
      switch (sortBy) {
        case 'rsi': {
          const rsiA = a.rsi_value ?? a.rsi;
          const rsiB = b.rsi_value ?? b.rsi;
          return tab === 'calls' ? rsiA - rsiB : rsiB - rsiA;
        }
        case 'volume': return b.total_volume - a.total_volume;
        case 'oi': return b.total_open_interest - a.total_open_interest;
        case 'contracts': return b.total_contracts - a.total_contracts;
        default: return 0;
      }
    });

    return { filtered: rsiFiltered, changeMap: cMap };
  }, [calls, puts, tab, tickerChanges, filters, sortBy]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(['calls', 'puts'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
                tab === t
                  ? t === 'calls'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30 ring-1 ring-red-500/30'
                  : 'bg-card-solid/30 border-border/50 text-muted hover:text-foreground',
              )}
            >
              {t === 'calls' ? 'Calls (Oversold)' : 'Puts (Overbought)'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Sort:</span>
          {(['rsi', 'volume', 'oi', 'contracts'] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-medium transition-colors',
                sortBy === s ? 'bg-accent/15 text-accent' : 'text-muted hover:text-foreground',
              )}
            >
              {s === 'rsi' ? 'RSI' : s === 'volume' ? 'Vol' : s === 'oi' ? 'OI' : 'Contracts'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">{filtered.length} results</p>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted text-sm">
            No {tab} with {tab === 'calls' ? 'RSI ≤ 30 (oversold)' : 'RSI ≥ 70 (overbought)'} found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((opp) => {
            const rsi = opp.rsi_value ?? opp.rsi;
            const changeStatus = changeMap.get(opp.ticker);
            const borderClass =
              changeStatus === 'new' ? 'border-emerald-500/40'
              : changeStatus === 'removed' ? 'border-red-500/40'
              : 'border-border';
            const topContracts = (opp.best_contracts || []).slice(0, 3);

            return (
              <div key={opp.ticker} className={cn('glass-card p-5 space-y-4 border', borderClass)}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RsiGauge rsi={rsi} />
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{opp.ticker}</h3>
                      <p className="text-xs text-muted">{formatCurrency(opp.current_price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {changeStatus === 'new' && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400">NEW</span>
                    )}
                    {changeStatus === 'removed' && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-500/20 text-red-400">REMOVED</span>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">Contracts</p><p className="text-sm font-medium text-foreground">{formatNumber(opp.total_contracts)}</p></div>
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">Total OI</p><p className="text-sm font-medium text-foreground">{formatNumber(opp.total_open_interest)}</p></div>
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">Liquid</p><p className="text-sm font-medium text-foreground">{opp.liquid_strikes}</p></div>
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">Volume</p><p className="text-sm font-medium text-foreground">{formatNumber(opp.total_volume)}</p></div>
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">ATM OI</p><p className="text-sm font-medium text-foreground">{formatNumber(opp.atm_open_interest)}</p></div>
                  <div><p className="text-[11px] text-muted uppercase tracking-wider">Stock Vol</p><p className="text-sm font-medium text-foreground">{formatNumber(opp.stock_volume)}</p></div>
                </div>

                {/* Best Contracts */}
                {topContracts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted uppercase tracking-wider font-medium">Best Contracts</p>
                    {topContracts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-background/40 rounded-lg px-3 py-2">
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
