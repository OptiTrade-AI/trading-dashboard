'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { usePipelines } from '@/hooks/useScreenerData';
import { usePipelineProgress, type PipelineProgressEvent } from '@/hooks/usePipelineProgress';
import { mutate } from 'swr';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never run';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function freshnessColor(dateStr: string | null): string {
  if (!dateStr) return 'text-red-400';
  const hrs = (Date.now() - new Date(dateStr).getTime()) / (60 * 60 * 1000);
  if (hrs < 1) return 'text-emerald-400';
  if (hrs < 6) return 'text-amber-400';
  return 'text-red-400';
}

function freshnessDot(dateStr: string | null): string {
  if (!dateStr) return 'bg-red-500';
  const hrs = (Date.now() - new Date(dateStr).getTime()) / (60 * 60 * 1000);
  if (hrs < 1) return 'bg-emerald-500';
  if (hrs < 6) return 'bg-amber-500';
  return 'bg-red-500';
}

interface CspOptimizerPipelineStatusProps {
  totalCount: number;
  onPipelineComplete?: () => void;
}

export function CspOptimizerPipelineStatus({ totalCount, onPipelineComplete }: CspOptimizerPipelineStatusProps) {
  const { data: pipelines } = usePipelines();
  const [runId, setRunId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const { event: progressEvent, reset: resetProgress } = usePipelineProgress(runId);

  // Find CSP pipeline info
  const cspPipeline = pipelines?.find(p => p.type === 'CSP_SCREENER') || null;
  const lastRunAt = cspPipeline?.lastRunAt || null;
  const lastStatus = cspPipeline?.lastRunStatus || null;
  const lastDuration = cspPipeline?.lastRunDuration || null;

  const isRunning = progressEvent?.status === 'RUNNING';
  const isCompleted = progressEvent?.status === 'COMPLETED';
  const isFailed = progressEvent?.status === 'FAILED';

  // Handle completion — refresh screener data (only on transition)
  const handledRef = useRef(false);
  useEffect(() => {
    if (isCompleted || isFailed) {
      if (!handledRef.current) {
        handledRef.current = true;
        mutate('/api/pipelines');
        mutate('/api/screeners/csp');
        if (isCompleted && onPipelineComplete) {
          onPipelineComplete();
        }
      }
    } else {
      handledRef.current = false;
    }
  }, [isCompleted, isFailed, onPipelineComplete]);

  const handleRun = useCallback(async () => {
    setIsStarting(true);
    setRunError(null);
    resetProgress();

    try {
      const res = await fetch('/api/pipelines/CSP_SCREENER/run', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setRunError('Pipeline already running');
        } else {
          setRunError(data.error || 'Failed to start pipeline');
        }
        return;
      }
      const data = await res.json();
      setRunId(data.runId);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to start pipeline');
    } finally {
      setIsStarting(false);
    }
  }, [resetProgress]);

  const progress = progressEvent?.progress;
  const pct = progress?.pct ?? null;
  const message = progress?.message ?? null;

  return (
    <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/50 overflow-hidden">
      {/* Main bar */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Status dot + info */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isRunning ? 'bg-blue-500 animate-pulse' : freshnessDot(lastRunAt),
          )} />
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="text-foreground font-medium">{totalCount} opportunities</span>
            <span className="text-zinc-600">·</span>
            <span className={freshnessColor(lastRunAt)}>{timeAgo(lastRunAt)}</span>
            {lastDuration && !isRunning && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{(lastDuration / 1000).toFixed(0)}s</span>
              </>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Running status / Run button */}
        {isRunning ? (
          <div className="flex items-center gap-2 text-xs">
            <svg className="animate-spin h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-blue-300">
              {message || 'Running pipeline...'}
            </span>
            {pct !== null && (
              <span className="text-blue-400 font-mono">{Math.round(pct)}%</span>
            )}
          </div>
        ) : isCompleted && runId ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">
              Complete — {progressEvent?.totalOpportunities ?? totalCount} opportunities found
            </span>
            <button
              onClick={handleRun}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Run Again
            </button>
          </div>
        ) : isFailed ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-loss">{progressEvent?.error || 'Pipeline failed'}</span>
            <button
              onClick={handleRun}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {runError && <span className="text-xs text-loss">{runError}</span>}
            <button
              onClick={handleRun}
              disabled={isStarting}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Run Pipeline
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && pct !== null && (
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}
