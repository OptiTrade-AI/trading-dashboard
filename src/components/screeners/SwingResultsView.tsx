'use client';

import { useMemo, useState } from 'react';
import type { SwingSignal, ScreenerFilters } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'long' | 'short';

const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function ConfidenceDots({ level }: { level: string }) {
  const filled = level === 'HIGH' ? 3 : level === 'MEDIUM' ? 2 : 1;
  const color = level === 'HIGH' ? 'bg-emerald-400' : level === 'MEDIUM' ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i <= filled ? color : 'bg-border')} />
      ))}
    </div>
  );
}

function RiskRewardBar({ entry, target, stop, isLong }: { entry: number; target: number; stop: number; isLong: boolean }) {
  const min = Math.min(entry, target, stop);
  const max = Math.max(entry, target, stop);
  const range = max - min;
  if (range === 0) return null;

  const pos = (v: number) => ((v - min) / range) * 100;

  return (
    <div className="relative h-2 bg-border/30 rounded-full overflow-hidden mt-1">
      {/* Risk zone (stop to entry) */}
      <div
        className="absolute top-0 h-full bg-red-500/20 rounded-full"
        style={{
          left: `${pos(isLong ? stop : entry)}%`,
          width: `${Math.abs(pos(entry) - pos(stop))}%`,
        }}
      />
      {/* Reward zone (entry to target) */}
      <div
        className="absolute top-0 h-full bg-emerald-500/20 rounded-full"
        style={{
          left: `${pos(isLong ? entry : target)}%`,
          width: `${Math.abs(pos(target) - pos(entry))}%`,
        }}
      />
      {/* Markers */}
      <div className="absolute top-0 h-full w-1 bg-red-400 rounded-full" style={{ left: `${pos(stop)}%` }} />
      <div className="absolute top-0 h-full w-1.5 bg-foreground rounded-full" style={{ left: `${pos(entry)}%` }} />
      <div className="absolute top-0 h-full w-1 bg-emerald-400 rounded-full" style={{ left: `${pos(target)}%` }} />
    </div>
  );
}

interface SwingResultsViewProps {
  longSignals: SwingSignal[];
  shortSignals: SwingSignal[];
  filters: ScreenerFilters;
}

export function SwingResultsView({ longSignals, shortSignals, filters }: SwingResultsViewProps) {
  const [tab, setTab] = useState<Tab>('long');

  const { sorted, confluenceTickers } = useMemo(() => {
    const signals = tab === 'long' ? longSignals : shortSignals;

    // Apply filters
    const filtered = signals.filter((s) => {
      if (filters.tickerSearch && !s.ticker.includes(filters.tickerSearch)) return false;
      if (!filters.confidence.includes(s.confidence)) return false;
      if (filters.minRiskReward > 0 && s.risk_reward_ratio < filters.minRiskReward) return false;
      if (filters.swingStrategy !== 'all' && s.strategy !== filters.swingStrategy) return false;
      return true;
    });

    // Confluence detection
    const stratMap = new Map<string, Set<string>>();
    for (const s of filtered) {
      if (!stratMap.has(s.ticker)) stratMap.set(s.ticker, new Set());
      stratMap.get(s.ticker)!.add(s.strategy);
    }
    const confTickers = new Set<string>();
    for (const [ticker, strats] of stratMap) {
      if (strats.size >= 2) confTickers.add(ticker);
    }

    // Sort: confluence first, then by confidence
    const sortedSignals = [...filtered].sort((a, b) => {
      const aConf = confTickers.has(a.ticker) ? 1 : 0;
      const bConf = confTickers.has(b.ticker) ? 1 : 0;
      if (aConf !== bConf) return bConf - aConf;
      return (CONFIDENCE_ORDER[b.confidence] ?? 0) - (CONFIDENCE_ORDER[a.confidence] ?? 0);
    });

    return { sorted: sortedSignals, confluenceTickers: confTickers };
  }, [longSignals, shortSignals, tab, filters]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['long', 'short'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
                tab === t
                  ? t === 'long'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30 ring-1 ring-red-500/30'
                  : 'bg-card-solid/30 border-border/50 text-muted hover:text-foreground',
              )}
            >
              {t === 'long' ? 'Long Signals' : 'Short Signals'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">{sorted.length} signals</span>
      </div>

      {sorted.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted text-sm">No {tab} swing signals match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((signal, i) => {
            const isLong = signal.signal_type === 'LONG';
            const isConf = confluenceTickers.has(signal.ticker);

            return (
              <div
                key={`${signal.ticker}-${signal.strategy}-${i}`}
                className={cn(
                  'glass-card p-5 space-y-3',
                  isConf && 'border-accent/40 shadow-[0_0_12px_-3px] shadow-accent/20',
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{signal.ticker}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-md text-xs font-bold',
                      isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
                    )}>
                      {signal.signal_type}
                    </span>
                    <ConfidenceDots level={signal.confidence} />
                  </div>
                  {isConf && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/20 text-accent">
                      CONFLUENCE
                    </span>
                  )}
                </div>

                {/* Strategy */}
                <p className="text-xs text-muted">
                  <span className="text-foreground font-medium">{signal.strategy}</span>
                </p>

                {/* R:R Bar */}
                <div>
                  <RiskRewardBar entry={signal.entry_price} target={signal.target} stop={signal.stop_loss} isLong={isLong} />
                  <div className="flex justify-between mt-1 text-[10px]">
                    <span className="text-red-400">SL {formatCurrency(signal.stop_loss)}</span>
                    <span className="text-foreground">Entry {formatCurrency(signal.entry_price)}</span>
                    <span className="text-emerald-400">TP {formatCurrency(signal.target)}</span>
                  </div>
                </div>

                {/* Price Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wider">R:R Ratio</p>
                    <p className={cn(
                      'text-sm font-bold',
                      signal.risk_reward_ratio >= 2 ? 'text-emerald-400' : signal.risk_reward_ratio >= 1.5 ? 'text-yellow-400' : 'text-red-400',
                    )}>
                      {signal.risk_reward_ratio.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted uppercase tracking-wider">Volume</p>
                    <p className="text-sm font-medium text-foreground">{formatNumber(signal.volume)}</p>
                  </div>
                </div>

                {/* Details */}
                {signal.details && (
                  <p className="text-xs text-muted leading-relaxed">{signal.details}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
