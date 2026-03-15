'use client';

import { cn } from '@/lib/utils';
import { SCREENER_COLORS } from '@/lib/screener-colors';
import type { ScreenerTab, ScreenerFilters, ScreenerPreset } from '@/types';

export const defaultScreenerFilters: ScreenerFilters = {
  minScore: 0,
  sector: 'all',
  tickerSearch: '',
  minDelta: 0,
  maxDelta: 1,
  minDte: 0,
  maxDte: 90,
  minRor: 0,
  minIv: 0,
  minOi: 0,
  minMarketCap: 'any',
  maxRsi: 100,
  minRsi: 0,
  minVolume: 0,
};

const CSP_PRESETS: ScreenerPreset[] = [
  { key: 'conservative', label: 'Conservative', tagline: 'Low delta, high score', color: 'emerald', filters: { minDelta: 0.10, maxDelta: 0.20, minDte: 30, maxDte: 60, minScore: 60 } },
  { key: 'income', label: 'Income Focus', tagline: 'High ROR, any delta', color: 'blue', filters: { minRor: 1, minDte: 7, maxDte: 45 } },
  { key: 'conviction', label: 'High Conviction', tagline: 'Score 80+, large cap', color: 'purple', filters: { minScore: 80, minMarketCap: '10B' } },
];

const PRESETS_BY_TAB: Partial<Record<ScreenerTab, ScreenerPreset[]>> = {
  csp: CSP_PRESETS,
};

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: '$500M+', value: '500M' },
  { label: '$1B+', value: '1B' },
  { label: '$4B+', value: '4B' },
  { label: '$10B+', value: '10B' },
  { label: '$50B+', value: '50B' },
];

const inputClass =
  'bg-card-solid border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50';

interface ScreenerFilterBarProps {
  activeTab: ScreenerTab;
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  activePreset: string | null;
  onPreset: (key: string | null) => void;
  sectors: string[];
}

export function ScreenerFilterBar({
  activeTab,
  filters,
  onChange,
  activePreset,
  onPreset,
  sectors,
}: ScreenerFilterBarProps) {
  const update = (patch: Partial<ScreenerFilters>) => {
    onPreset(null);
    onChange({ ...filters, ...patch });
  };

  const presets = PRESETS_BY_TAB[activeTab] ?? [];

  const isDefault = JSON.stringify(filters) === JSON.stringify(defaultScreenerFilters);

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Presets row */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {presets.map((preset) => {
            const isActive = activePreset === preset.key;
            const colors = SCREENER_COLORS[activeTab];
            return (
              <button
                key={preset.key}
                onClick={() => {
                  if (isActive) {
                    onPreset(null);
                    onChange({ ...defaultScreenerFilters });
                  } else {
                    onPreset(preset.key);
                    onChange({ ...defaultScreenerFilters, ...preset.filters });
                  }
                }}
                className={cn(
                  'shrink-0 px-3 py-2 rounded-xl text-left transition-all border',
                  isActive
                    ? cn(colors.bg, colors.border, colors.text, 'ring-1',
                        activeTab === 'csp' ? 'ring-emerald-500/30' : 'ring-amber-500/30',
                      )
                    : 'bg-card-solid/30 border-border/50 text-muted hover:text-foreground hover:bg-card-solid/60',
                )}
              >
                <span className="text-xs font-semibold block">{preset.label}</span>
                <span className="text-[10px] text-muted block mt-0.5">{preset.tagline}</span>
              </button>
            );
          })}

          {!isDefault && (
            <button
              onClick={() => {
                onPreset(null);
                onChange({ ...defaultScreenerFilters });
              }}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border border-border text-muted hover:text-foreground hover:bg-card-solid transition-colors"
            >
              Reset All
            </button>
          )}
        </div>
      )}

      {/* Filter inputs */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Ticker search (all tabs) */}
        <div className="space-y-1">
          <label className="text-xs text-muted uppercase tracking-wider">Ticker</label>
          <input
            type="text"
            value={filters.tickerSearch}
            onChange={(e) => update({ tickerSearch: e.target.value.toUpperCase() })}
            className={cn(inputClass, 'w-[90px]')}
            placeholder="Search"
          />
        </div>

        {/* CSP filters */}
        {activeTab === 'csp' && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Delta</label>
              <div className="flex items-center gap-1.5">
                <input type="number" step="0.05" min="0" max="1" value={filters.minDelta}
                  onChange={(e) => update({ minDelta: parseFloat(e.target.value) || 0 })}
                  className={cn(inputClass, 'w-[65px]')} />
                <span className="text-muted text-xs">-</span>
                <input type="number" step="0.05" min="0" max="1" value={filters.maxDelta}
                  onChange={(e) => update({ maxDelta: parseFloat(e.target.value) || 1 })}
                  className={cn(inputClass, 'w-[65px]')} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">DTE</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" value={filters.minDte}
                  onChange={(e) => update({ minDte: parseInt(e.target.value) || 0 })}
                  className={cn(inputClass, 'w-[65px]')} />
                <span className="text-muted text-xs">-</span>
                <input type="number" min="0" value={filters.maxDte}
                  onChange={(e) => update({ maxDte: parseInt(e.target.value) || 90 })}
                  className={cn(inputClass, 'w-[65px]')} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Min ROR%</label>
              <input type="number" step="0.1" min="0" value={filters.minRor}
                onChange={(e) => update({ minRor: parseFloat(e.target.value) || 0 })}
                className={cn(inputClass, 'w-[75px]')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Min IV%</label>
              <input type="number" step="1" min="0" value={filters.minIv}
                onChange={(e) => update({ minIv: parseFloat(e.target.value) || 0 })}
                className={cn(inputClass, 'w-[75px]')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Min OI</label>
              <input type="number" min="0" value={filters.minOi}
                onChange={(e) => update({ minOi: parseInt(e.target.value) || 0 })}
                className={cn(inputClass, 'w-[75px]')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Min Score</label>
              <input type="number" min="0" max="100" value={filters.minScore}
                onChange={(e) => update({ minScore: parseInt(e.target.value) || 0 })}
                className={cn(inputClass, 'w-[75px]')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Mkt Cap</label>
              <select value={filters.minMarketCap}
                onChange={(e) => update({ minMarketCap: e.target.value })}
                className={cn(inputClass, 'w-[95px]')}>
                {MARKET_CAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Sector</label>
              <select value={filters.sector}
                onChange={(e) => update({ sector: e.target.value })}
                className={cn(inputClass, 'w-[140px]')}>
                <option value="all">All Sectors</option>
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Aggressive filters */}
        {activeTab === 'aggressive' && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted uppercase tracking-wider">Min Volume</label>
              <input type="number" min="0" value={filters.minVolume}
                onChange={(e) => update({ minVolume: parseInt(e.target.value) || 0 })}
                className={cn(inputClass, 'w-[90px]')} />
            </div>
          </>
        )}

        {/* Reset (when no presets or non-default) */}
        {presets.length === 0 && !isDefault && (
          <button
            onClick={() => {
              onPreset(null);
              onChange({ ...defaultScreenerFilters });
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-solid transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
