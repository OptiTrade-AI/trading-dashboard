'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SCREENER_COLORS } from '@/lib/screener-colors';
import { usePipelineConfig } from '@/hooks/usePipelineConfig';
import { DEFAULT_CSP_CONFIG, CSP_CONFIG_PRESETS } from '@/lib/pipeline-defaults';
import type { PipelineInfo, ScreenerTab, CspPipelineConfig } from '@/types';
import type { PipelineProgressEvent } from '@/hooks/usePipelineProgress';

const TAB_PIPELINE_MAP: Record<ScreenerTab, string[]> = {
  csp: ['CSP_SCREENER'],
  aggressive: ['AGGRESSIVE_OPTIONS'],
};

/** Tabs that support ticker selection + config */
const TICKER_SELECT_TABS = new Set<ScreenerTab>(['csp']);

const TABS_ORDERED: ScreenerTab[] = ['csp', 'aggressive'];

const MARKET_CAP_OPTIONS = [
  { value: 100_000_000, label: '$100M' },
  { value: 300_000_000, label: '$300M' },
  { value: 500_000_000, label: '$500M' },
  { value: 1_000_000_000, label: '$1B' },
  { value: 2_000_000_000, label: '$2B' },
  { value: 5_000_000_000, label: '$5B' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function freshnessClass(dateStr: string | null): string {
  if (!dateStr) return 'border-red-500/30 bg-red-500/5';
  const ms = Date.now() - new Date(dateStr).getTime();
  const hrs = ms / (60 * 60 * 1000);
  if (hrs < 1) return 'border-emerald-500/30 bg-emerald-500/5';
  if (hrs < 6) return 'border-amber-500/30 bg-amber-500/5';
  return 'border-red-500/30 bg-red-500/5';
}

function isDefault(config: CspPipelineConfig): boolean {
  const d = DEFAULT_CSP_CONFIG;
  return (
    config.deltaLower === d.deltaLower &&
    config.deltaUpper === d.deltaUpper &&
    config.minDte === d.minDte &&
    config.maxDte === d.maxDte &&
    config.minOpenInterest === d.minOpenInterest &&
    config.minImpliedVolatility === d.minImpliedVolatility &&
    config.minReturnOnRiskPercent === d.minReturnOnRiskPercent &&
    config.minMarketCap === d.minMarketCap &&
    config.minStockPrice === d.minStockPrice &&
    config.minVolume === d.minVolume
  );
}

interface ScreenerPipelineStripProps {
  pipelines: PipelineInfo[];
  counts: Record<ScreenerTab, number>;
  runningPipelines: Record<string, string>;
  activeRunType: string | null;
  progressEvent: PipelineProgressEvent | null;
  isRunningAll: boolean;
  onRunPipeline: (type: string, tickers?: string[], config?: CspPipelineConfig) => void;
  onRunAll: () => void;
}

/** Inline popover for CSP Screener: ticker selection + pipeline config */
function CspPipelineConfigPopover({
  onRunAll,
  onRunSelected,
  onClose,
}: {
  onRunAll: (config: CspPipelineConfig) => void;
  onRunSelected: (tickers: string[], config: CspPipelineConfig) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { config, updateConfig, resetConfig, activePreset, setPreset } = usePipelineConfig('CSP_SCREENER');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const parsedTickers = input
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const handleRunSelected = () => {
    if (parsedTickers.length > 0) {
      onRunSelected(parsedTickers, config);
      onClose();
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-2 z-50 glass-card p-3 shadow-xl border border-emerald-500/30"
      style={{ width: showConfig ? 420 : 320 }}
    >
      {/* Tickers section */}
      <label className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5 block">
        CSP Screener — Select Tickers
      </label>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleRunSelected();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="AAPL, MSFT, NVDA..."
        className="w-full px-3 py-2 rounded-lg bg-card-solid border border-border text-foreground text-sm placeholder:text-muted/50 focus:outline-none focus:border-emerald-500/50 mb-2"
      />
      {parsedTickers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {parsedTickers.map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Config toggle */}
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-2 w-full"
      >
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={cn('transition-transform', showConfig && 'rotate-90')}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Pipeline Config
        {!isDefault(config) && (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">Custom</span>
        )}
      </button>

      {/* Config section */}
      {showConfig && (
        <div className="border-t border-border pt-2 mb-2 space-y-2">
          {/* Presets */}
          <div className="flex gap-1.5">
            {CSP_CONFIG_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setPreset(activePreset === preset.key ? null : preset.key)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-semibold transition-all border',
                  activePreset === preset.key
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-card-solid text-muted border-border hover:border-emerald-500/30 hover:text-foreground',
                )}
                title={preset.tagline}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Param grid */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <ConfigInput label="Delta Lower" value={config.deltaLower} step={0.05}
              onChange={(v) => updateConfig({ deltaLower: v })} />
            <ConfigInput label="Delta Upper" value={config.deltaUpper} step={0.05}
              onChange={(v) => updateConfig({ deltaUpper: v })} />
            <ConfigInput label="Min DTE" value={config.minDte} step={1}
              onChange={(v) => updateConfig({ minDte: v })} />
            <ConfigInput label="Max DTE" value={config.maxDte} step={1}
              onChange={(v) => updateConfig({ maxDte: v })} />
            <ConfigInput label="Min ROR%" value={config.minReturnOnRiskPercent} step={0.5}
              onChange={(v) => updateConfig({ minReturnOnRiskPercent: v })} />
            <ConfigInput label="Min IV%" value={Math.round(config.minImpliedVolatility * 100)} step={5}
              onChange={(v) => updateConfig({ minImpliedVolatility: v / 100 })} />
            <ConfigInput label="Min OI" value={config.minOpenInterest} step={10}
              onChange={(v) => updateConfig({ minOpenInterest: v })} />
            <ConfigInput label="Min Volume" value={config.minVolume} step={5}
              onChange={(v) => updateConfig({ minVolume: v })} />
            <ConfigInput label="Min Price" value={config.minStockPrice} step={1}
              onChange={(v) => updateConfig({ minStockPrice: v })} />
            <div>
              <label className="text-[10px] text-muted block mb-0.5">Min Mkt Cap</label>
              <select
                value={config.minMarketCap}
                onChange={(e) => updateConfig({ minMarketCap: Number(e.target.value) })}
                className="w-full px-2 py-1 rounded bg-card-solid border border-border text-foreground text-xs focus:outline-none focus:border-emerald-500/50"
              >
                {MARKET_CAP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset */}
          {!isDefault(config) && (
            <button
              onClick={resetConfig}
              className="text-[10px] text-muted hover:text-foreground transition-colors"
            >
              Reset to Defaults
            </button>
          )}
        </div>
      )}

      {/* Run buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRunSelected}
          disabled={parsedTickers.length === 0}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
            parsedTickers.length > 0
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-border text-muted cursor-not-allowed',
          )}
        >
          Run {parsedTickers.length > 0 ? `${parsedTickers.length} Ticker${parsedTickers.length > 1 ? 's' : ''}` : 'Selected'}
        </button>
        <button
          onClick={() => { onRunAll(config); onClose(); }}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-accent/15 text-accent hover:bg-accent/25 transition-all"
        >
          Run All (~4K)
        </button>
      </div>
    </div>
  );
}

function ConfigInput({ label, value, step, onChange }: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted block mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1 rounded bg-card-solid border border-border text-foreground text-xs focus:outline-none focus:border-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

export function ScreenerPipelineStrip({
  pipelines,
  counts,
  runningPipelines,
  activeRunType,
  progressEvent,
  isRunningAll,
  onRunPipeline,
  onRunAll,
}: ScreenerPipelineStripProps) {
  const [openPopover, setOpenPopover] = useState<ScreenerTab | null>(null);

  const getPipeline = (tab: ScreenerTab): PipelineInfo | null => {
    const types = TAB_PIPELINE_MAP[tab];
    return pipelines.find((p) => types.includes(p.type)) ?? null;
  };

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
      {/* Run All button */}
      <button
        onClick={onRunAll}
        disabled={isRunningAll || Object.keys(runningPipelines).length > 0}
        className={cn(
          'shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border',
          'bg-accent/15 text-accent border-accent/30',
          'hover:bg-accent/25 hover:border-accent/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isRunningAll ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run All
          </span>
        )}
      </button>

      <div className="w-px h-8 bg-border shrink-0" />

      {/* Pipeline chips */}
      {TABS_ORDERED.map((tab) => {
        const pipeline = getPipeline(tab);
        const colors = SCREENER_COLORS[tab];
        const isRunning = pipeline ? pipeline.type in runningPipelines : false;
        const isActivelyTracked = pipeline ? activeRunType === pipeline.type : false;
        const pct = isActivelyTracked ? (progressEvent?.progress?.pct ?? 0) : 0;
        const message = isActivelyTracked ? (progressEvent?.progress?.message ?? '') : '';
        const supportsTickerSelect = TICKER_SELECT_TABS.has(tab);

        const handleChipClick = () => {
          if (!pipeline || isRunning) return;
          if (supportsTickerSelect) {
            setOpenPopover(openPopover === tab ? null : tab);
          } else {
            onRunPipeline(pipeline.type);
          }
        };

        return (
          <div key={tab} className="relative shrink-0">
            <button
              onClick={handleChipClick}
              disabled={isRunning || !pipeline}
              className={cn(
                'rounded-xl text-left transition-all border relative overflow-hidden',
                isRunning
                  ? 'border-blue-500/40 bg-blue-500/5 cursor-wait'
                  : pipeline
                    ? cn(freshnessClass(pipeline.lastRunAt), 'hover:opacity-80 cursor-pointer')
                    : 'border-border bg-card-solid/30 opacity-50 cursor-not-allowed',
                'px-3 py-2',
                openPopover === tab && 'border-emerald-500/50 bg-emerald-500/5',
              )}
            >
              <div className="flex items-center gap-2">
                {/* Status dot */}
                {isRunning ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                  </span>
                ) : pipeline?.lastRunStatus === 'FAILED' ? (
                  <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                ) : pipeline?.lastRunStatus === 'COMPLETED' ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-zinc-500 shrink-0" />
                )}

                <span className={cn('text-sm font-bold', colors.text)}>{colors.shortLabel}</span>
                <span className="text-xs text-muted">{timeAgo(pipeline?.lastRunAt ?? null)}</span>
                <span className={cn(
                  'text-xs font-semibold px-1.5 py-0.5 rounded-md',
                  colors.bg, colors.text,
                )}>
                  {counts[tab]}
                </span>

                {/* Chevron indicator for ticker-selectable chips */}
                {supportsTickerSelect && !isRunning && (
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={cn('text-muted transition-transform', openPopover === tab && 'rotate-180')}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>

              {/* Progress bar (when running) */}
              {isRunning && (
                <div className="mt-1.5">
                  <div className="w-full h-1 bg-border/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(isActivelyTracked ? pct : 0, 100)}%` }}
                    />
                  </div>
                  {message && (
                    <p className="text-[10px] text-muted truncate mt-0.5 max-w-[120px]">{message}</p>
                  )}
                </div>
              )}
            </button>

            {/* Ticker selection + config popover */}
            {openPopover === tab && pipeline && !isRunning && (
              <CspPipelineConfigPopover
                onRunAll={(cfg) => onRunPipeline(pipeline.type, undefined, cfg)}
                onRunSelected={(tickers, cfg) => onRunPipeline(pipeline.type, tickers, cfg)}
                onClose={() => setOpenPopover(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
