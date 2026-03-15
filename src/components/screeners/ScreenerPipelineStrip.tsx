'use client';

import { cn } from '@/lib/utils';
import { SCREENER_COLORS } from '@/lib/screener-colors';
import type { PipelineInfo, ScreenerTab } from '@/types';
import type { PipelineProgressEvent } from '@/hooks/usePipelineProgress';

const TAB_PIPELINE_MAP: Record<ScreenerTab, string[]> = {
  csp: ['CSP_ENHANCED'],
  pcs: ['PCS_SCREENER'],
  aggressive: ['AGGRESSIVE_OPTIONS'],
  charts: ['CHART_SETUPS'],
  swing: ['SWING_TRADES'],
};

const TABS_ORDERED: ScreenerTab[] = ['csp', 'pcs', 'aggressive', 'charts', 'swing'];

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

interface ScreenerPipelineStripProps {
  pipelines: PipelineInfo[];
  counts: Record<ScreenerTab, number>;
  runningPipelines: Record<string, string>;
  activeRunType: string | null;
  progressEvent: PipelineProgressEvent | null;
  isRunningAll: boolean;
  onRunPipeline: (type: string) => void;
  onRunAll: () => void;
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

        return (
          <button
            key={tab}
            onClick={() => pipeline && !isRunning && onRunPipeline(pipeline.type)}
            disabled={isRunning || !pipeline}
            className={cn(
              'shrink-0 rounded-xl text-left transition-all border relative overflow-hidden',
              isRunning
                ? 'border-blue-500/40 bg-blue-500/5 cursor-wait'
                : pipeline
                  ? cn(freshnessClass(pipeline.lastRunAt), 'hover:opacity-80 cursor-pointer')
                  : 'border-border bg-card-solid/30 opacity-50 cursor-not-allowed',
              'px-3 py-2',
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
        );
      })}
    </div>
  );
}
