'use client';

import { cn } from '@/lib/utils';
import type { CspOptimizerFilters, CspFilterPreset } from '@/hooks/useCspOptimizer';

interface CspOptimizerFilterBarProps {
  filters: CspOptimizerFilters;
  setFilters: (f: CspOptimizerFilters) => void;
  activePreset: CspFilterPreset | null;
  onPreset: (preset: CspFilterPreset) => void;
  sectors: string[];
  filteredCount: number;
  totalCount: number;
}

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: '$500M+', value: '500M' },
  { label: '$1B+', value: '1B' },
  { label: '$4B+', value: '4B' },
  { label: '$10B+', value: '10B' },
  { label: '$50B+', value: '50B' },
];

const PRESETS: { key: CspFilterPreset; label: string; tagline: string; color: string }[] = [
  { key: 'conservative', label: 'Conservative', tagline: 'Low delta, large cap', color: 'emerald' },
  { key: 'balanced', label: 'Balanced', tagline: 'Mid delta, good ROR', color: 'blue' },
  { key: 'aggressive', label: 'Aggressive', tagline: 'High premium', color: 'amber' },
  { key: 'all', label: 'All', tagline: 'No filters', color: 'zinc' },
];

export function CspOptimizerFilterBar({
  filters,
  setFilters,
  activePreset,
  onPreset,
  sectors,
  filteredCount,
  totalCount,
}: CspOptimizerFilterBarProps) {
  const update = <K extends keyof CspOptimizerFilters>(key: K, value: CspOptimizerFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              activePreset === p.key
                ? p.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : p.color === 'blue' ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : p.color === 'amber' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-zinc-700/40 border-zinc-600/40 text-zinc-300'
                : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60',
            )}
          >
            <span>{p.label}</span>
            <span className="ml-1.5 opacity-60">{p.tagline}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          {filteredCount} / {totalCount} matches
        </span>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        {/* Delta */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Delta</span>
          <input
            type="number"
            min="0" max="1" step="0.05"
            value={filters.minDelta}
            onChange={e => update('minDelta', +e.target.value)}
            className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
          <span className="text-zinc-600">-</span>
          <input
            type="number"
            min="0" max="1" step="0.05"
            value={filters.maxDelta}
            onChange={e => update('maxDelta', +e.target.value)}
            className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
        </label>

        {/* DTE */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">DTE</span>
          <input
            type="number"
            min="0" max="90"
            value={filters.minDte}
            onChange={e => update('minDte', +e.target.value)}
            className="w-12 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
          <span className="text-zinc-600">-</span>
          <input
            type="number"
            min="0" max="90"
            value={filters.maxDte}
            onChange={e => update('maxDte', +e.target.value)}
            className="w-12 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
        </label>

        {/* Min ROR */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Min ROR%</span>
          <input
            type="number"
            min="0" step="0.5"
            value={filters.minRor}
            onChange={e => update('minRor', +e.target.value)}
            className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
        </label>

        {/* Min Score */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Min Score</span>
          <input
            type="number"
            min="0" max="100"
            value={filters.minScore}
            onChange={e => update('minScore', +e.target.value)}
            className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground text-center"
          />
        </label>

        {/* Market Cap */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Mkt Cap</span>
          <select
            value={filters.minMarketCap}
            onChange={e => update('minMarketCap', e.target.value)}
            className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground"
          >
            {MARKET_CAP_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {/* Sector */}
        {sectors.length > 0 && (
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Sector</span>
            <select
              value={filters.sector}
              onChange={e => update('sector', e.target.value)}
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground max-w-[150px]"
            >
              <option value="all">All</option>
              {sectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        {/* Ticker search */}
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Search</span>
          <input
            type="text"
            placeholder="AAPL..."
            value={filters.tickerSearch}
            onChange={e => update('tickerSearch', e.target.value)}
            className="w-20 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-foreground placeholder:text-zinc-600"
          />
        </label>
      </div>
    </div>
  );
}
