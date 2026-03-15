'use client';

import { cn } from '@/lib/utils';
import type { PipelineInfo } from '@/types';
import type { PipelineProgressEvent } from '@/hooks/usePipelineProgress';

interface PipelineCardProps {
  pipeline: PipelineInfo;
  onRun: () => void;
  isRunning: boolean;
  progress?: PipelineProgressEvent | null;
}

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

function formatDuration(ms: number | null): string {
  if (!ms) return '\u2014';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function StatusBadge({ status, isRunning }: { status: PipelineInfo['lastRunStatus']; isRunning: boolean }) {
  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
        </span>
        Running
      </span>
    );
  }

  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/15 text-zinc-400">
        Never Run
      </span>
    );
  }

  const config: Record<string, { bg: string; text: string; label: string }> = {
    COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Completed' },
    FAILED: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
    RUNNING: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Running' },
    PENDING: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Pending' },
    CANCELLED: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: 'Cancelled' },
  };

  const c = config[status] ?? config.CANCELLED;

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      {c.label}
    </span>
  );
}

export function PipelineCard({ pipeline, onRun, isRunning, progress }: PipelineCardProps) {
  const pct = progress?.progress?.pct ?? 0;
  const step = progress?.progress?.step ?? 0;
  const totalSteps = progress?.progress?.total_steps ?? 0;
  const message = progress?.progress?.message ?? '';

  return (
    <div className="glass-card p-5 transition-all duration-300 hover:border-accent/20">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground font-bold text-sm truncate">{pipeline.name}</h3>
          <p className="text-muted text-xs mt-0.5 line-clamp-2">{pipeline.description}</p>
        </div>
        <StatusBadge status={pipeline.lastRunStatus} isRunning={isRunning} />
      </div>

      {/* Progress bar (visible when running) */}
      {isRunning && progress && (
        <div className="mb-4">
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted truncate mr-2">{message || 'Processing...'}</span>
            {totalSteps > 0 && (
              <span className="text-muted whitespace-nowrap">
                Step {step}/{totalSteps}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-muted text-[11px] uppercase tracking-wider mb-0.5">Last Run</div>
          <div className="text-foreground text-sm font-medium">{timeAgo(pipeline.lastRunAt)}</div>
        </div>
        <div>
          <div className="text-muted text-[11px] uppercase tracking-wider mb-0.5">Duration</div>
          <div className="text-foreground text-sm font-medium">{formatDuration(pipeline.lastRunDuration)}</div>
        </div>
        <div>
          <div className="text-muted text-[11px] uppercase tracking-wider mb-0.5">Results</div>
          <div className="text-foreground text-sm font-medium">
            {pipeline.totalOpportunities != null ? pipeline.totalOpportunities : '\u2014'}
          </div>
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={isRunning}
        className={cn(
          'w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
          isRunning
            ? 'bg-border text-muted cursor-not-allowed'
            : 'bg-accent/15 text-accent hover:bg-accent/25 active:bg-accent/30'
        )}
      >
        {isRunning ? 'Running...' : 'Run Now'}
      </button>
    </div>
  );
}
