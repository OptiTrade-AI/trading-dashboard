'use client';

import { cn } from '@/lib/utils';

export interface CspFilters {
  minDelta: number;
  maxDelta: number;
  minDte: number;
  maxDte: number;
  minRor: number;
  minIv: number;
  minOi: number;
  minScore: number;
  minMarketCap: string; // 'any' | '500M' | '1B' | '4B' | '10B' | '50B'
  sector: string; // 'all' or specific sector
}

export const defaultCspFilters: CspFilters = {
  minDelta: 0,
  maxDelta: 1,
  minDte: 0,
  maxDte: 90,
  minRor: 0,
  minIv: 0,
  minOi: 0,
  minScore: 0,
  minMarketCap: 'any',
  sector: 'all',
};

interface CspFiltersProps {
  filters: CspFilters;
  onChange: (filters: CspFilters) => void;
  sectors: string[];
}

const inputClass =
  'w-full bg-card-solid border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50';

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: '$500M+', value: '500M' },
  { label: '$1B+', value: '1B' },
  { label: '$4B+', value: '4B' },
  { label: '$10B+', value: '10B' },
  { label: '$50B+', value: '50B' },
];

export function CspFiltersBar({ filters, onChange, sectors }: CspFiltersProps) {
  const update = (patch: Partial<CspFilters>) => onChange({ ...filters, ...patch });

  const isDefault =
    filters.minDelta === defaultCspFilters.minDelta &&
    filters.maxDelta === defaultCspFilters.maxDelta &&
    filters.minDte === defaultCspFilters.minDte &&
    filters.maxDte === defaultCspFilters.maxDte &&
    filters.minRor === defaultCspFilters.minRor &&
    filters.minIv === defaultCspFilters.minIv &&
    filters.minOi === defaultCspFilters.minOi &&
    filters.minScore === defaultCspFilters.minScore &&
    filters.minMarketCap === defaultCspFilters.minMarketCap &&
    filters.sector === defaultCspFilters.sector;

  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Delta range */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Delta</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={filters.minDelta}
              onChange={(e) => update({ minDelta: parseFloat(e.target.value) || 0 })}
              className={cn(inputClass, 'w-[70px]')}
              placeholder="Min"
            />
            <span className="text-muted text-xs">-</span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={filters.maxDelta}
              onChange={(e) => update({ maxDelta: parseFloat(e.target.value) || 1 })}
              className={cn(inputClass, 'w-[70px]')}
              placeholder="Max"
            />
          </div>
        </div>

        {/* DTE range */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">DTE</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              value={filters.minDte}
              onChange={(e) => update({ minDte: parseInt(e.target.value) || 0 })}
              className={cn(inputClass, 'w-[70px]')}
              placeholder="Min"
            />
            <span className="text-muted text-xs">-</span>
            <input
              type="number"
              min="0"
              value={filters.maxDte}
              onChange={(e) => update({ maxDte: parseInt(e.target.value) || 90 })}
              className={cn(inputClass, 'w-[70px]')}
              placeholder="Max"
            />
          </div>
        </div>

        {/* Min ROR% */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Min ROR%</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={filters.minRor}
            onChange={(e) => update({ minRor: parseFloat(e.target.value) || 0 })}
            className={cn(inputClass, 'w-[80px]')}
            placeholder="0"
          />
        </div>

        {/* Min IV% */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Min IV%</label>
          <input
            type="number"
            step="1"
            min="0"
            value={filters.minIv}
            onChange={(e) => update({ minIv: parseFloat(e.target.value) || 0 })}
            className={cn(inputClass, 'w-[80px]')}
            placeholder="0"
          />
        </div>

        {/* Min OI */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Min OI</label>
          <input
            type="number"
            min="0"
            value={filters.minOi}
            onChange={(e) => update({ minOi: parseInt(e.target.value) || 0 })}
            className={cn(inputClass, 'w-[80px]')}
            placeholder="0"
          />
        </div>

        {/* Min Score */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Min Score</label>
          <input
            type="number"
            min="0"
            max="100"
            value={filters.minScore}
            onChange={(e) => update({ minScore: parseInt(e.target.value) || 0 })}
            className={cn(inputClass, 'w-[80px]')}
            placeholder="0"
          />
        </div>

        {/* Market Cap */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Mkt Cap</label>
          <select
            value={filters.minMarketCap}
            onChange={(e) => update({ minMarketCap: e.target.value })}
            className={cn(inputClass, 'w-[100px]')}
          >
            {MARKET_CAP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sector */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Sector</label>
          <select
            value={filters.sector}
            onChange={(e) => update({ sector: e.target.value })}
            className={cn(inputClass, 'w-[150px]')}
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Reset */}
        {!isDefault && (
          <button
            onClick={() => onChange({ ...defaultCspFilters })}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-solid transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
