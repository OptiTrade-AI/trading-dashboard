'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { AgentTraceStep } from '@/types';
import { TraceNodeGraph } from './TraceNodeGraph';
import { TOOL_ICONS, TOOL_LABELS } from './traceLayout';
import type { ProgressData } from './OptimizerAIPanel';

type ViewMode = 'graph' | 'log';

interface OptimizerTraceViewerProps {
  steps: AgentTraceStep[];
  tickers?: string[];
  traceMeta: { traceId?: string; totalSteps?: number; durationMs?: number; costUsd?: number } | null;
  loading: boolean;
  privacyMode: boolean;
  progressData?: ProgressData | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepCard({ step, privacyMode }: { step: AgentTraceStep; privacyMode: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (step.type === 'thinking') {
    // Truncate long thinking text
    const text = step.thinking || '';
    const isLong = text.length > 200;
    const display = expanded ? text : text.slice(0, 200);

    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400 text-xs shrink-0">
            🧠
          </div>
          <div className="w-px flex-1 bg-border/30 mt-1" />
        </div>
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-purple-400">Agent Reasoning</span>
            {step.durationMs != null && (
              <span className="text-[10px] text-muted/50">{formatDuration(step.durationMs)}</span>
            )}
            {step.tokens && (
              <span className="text-[10px] text-muted/50">{step.tokens.input + step.tokens.output} tokens</span>
            )}
          </div>
          <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{display}</p>
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-accent hover:text-accent/80 mt-1">
              {expanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'tool_call') {
    const icon = TOOL_ICONS[step.toolName || ''] || '🔧';
    const label = TOOL_LABELS[step.toolName || ''] || step.toolName || 'Tool';
    const inputStr = step.toolInput
      ? Object.entries(step.toolInput).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
      : '';

    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-xs shrink-0">
            {icon}
          </div>
          <div className="w-px flex-1 bg-border/30 mt-1" />
        </div>
        <div className="flex-1 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-400">{label}</span>
            <span className="text-[10px] text-muted/60 font-mono">{step.toolName}</span>
          </div>
          <p className="text-[11px] text-muted font-mono mt-0.5 truncate">{inputStr}</p>
        </div>
      </div>
    );
  }

  if (step.type === 'tool_result') {
    const icon = TOOL_ICONS[step.toolName || ''] || '✅';
    const label = TOOL_LABELS[step.toolName || ''] || step.toolName || 'Result';

    // Summarize the result
    let summary = '';
    if (step.toolResult && typeof step.toolResult === 'object') {
      const r = step.toolResult as Record<string, unknown>;
      if (r.error) {
        summary = `Error: ${r.error}`;
      } else if (r.contracts && Array.isArray(r.contracts)) {
        summary = `${(r.contracts as unknown[]).length} contracts returned`;
      } else if (r.price != null) {
        summary = privacyMode ? 'Price: ***' : `Price: $${r.price}`;
      } else if (r.results && Array.isArray(r.results)) {
        summary = `${(r.results as unknown[]).length} search results`;
      } else if (r.totalShares != null) {
        summary = privacyMode ? '*** shares' : `${r.totalShares} shares, CB $${r.costBasisPerShare}`;
      } else if (r.totalClosedTrades != null) {
        summary = `${r.totalClosedTrades} closed trades, ${privacyMode ? '***' : `$${r.totalHistoricalPremium} earned`}`;
      } else if (r.days != null) {
        summary = `${r.days} bars, range $${r.periodLow}–$${r.periodHigh}`;
      } else {
        summary = JSON.stringify(r).slice(0, 100);
      }
    }

    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs shrink-0">
            {icon}
          </div>
          <div className="w-px flex-1 bg-border/30 mt-1" />
        </div>
        <div className="flex-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400">{label} Result</span>
            {step.durationMs != null && (
              <span className="text-[10px] text-muted/50">{formatDuration(step.durationMs)}</span>
            )}
          </div>
          <p className="text-[11px] text-muted mt-0.5">{summary}</p>
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-accent hover:text-accent/80 mt-0.5">
            {expanded ? 'Hide raw data' : 'View raw data'}
          </button>
          {expanded && (
            <pre className="text-[10px] text-muted/70 bg-zinc-900/80 rounded-lg p-2 mt-1 max-h-48 overflow-auto font-mono whitespace-pre-wrap">
              {JSON.stringify(step.toolResult, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (step.type === 'final_answer') {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-xs shrink-0">
            ✨
          </div>
        </div>
        <div className="flex-1 pb-2">
          <span className="text-xs font-semibold text-accent">{step.thinking}</span>
        </div>
      </div>
    );
  }

  return null;
}

export function OptimizerTraceViewer({ steps, tickers, traceMeta, loading, privacyMode, progressData }: OptimizerTraceViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');

  // Live elapsed timer for the header
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
    }
  }, [loading]);

  if (steps.length === 0 && !loading) return null;

  // Build summary stats
  const toolCalls = steps.filter(s => s.type === 'tool_call');
  const thinkingSteps = steps.filter(s => s.type === 'thinking');
  const toolsByName = toolCalls.reduce<Record<string, number>>((acc, s) => {
    const name = s.toolName || 'unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const elapsedDisplay = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
  const totalTokensLive = (progressData?.totalInputTokens || 0) + (progressData?.totalOutputTokens || 0);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-card/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Agent Trace</span>

          {/* Tool call summary chips */}
          <div className="hidden sm:flex items-center gap-1.5">
            {Object.entries(toolsByName).map(([name, count]) => (
              <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-muted">
                {TOOL_ICONS[name] || '🔧'} {count}
              </span>
            ))}
          </div>

          {loading && (
            <svg className="animate-spin h-3.5 w-3.5 text-purple-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Live stats while loading */}
          {loading && (
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted/60">
              <span className="tabular-nums">{elapsedDisplay}</span>
              <span>·</span>
              <span>iter <span className="text-foreground/70 font-semibold">{progressData?.iteration || thinkingSteps.length || 1}</span></span>
              <span>·</span>
              <span>{steps.length} steps</span>
              {totalTokensLive > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{(totalTokensLive / 1000).toFixed(1)}k tok</span>
                </>
              )}
            </div>
          )}
          {/* Final stats when complete */}
          {!loading && traceMeta && (
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted/60">
              <span>{traceMeta.totalSteps} steps</span>
              <span>·</span>
              <span>{traceMeta.durationMs != null ? formatDuration(traceMeta.durationMs) : '...'}</span>
              <span>·</span>
              <span>{privacyMode ? '$***' : `$${traceMeta.costUsd?.toFixed(3) || '...'}`}</span>
            </div>
          )}
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={cn('text-muted transition-transform duration-200', isOpen && 'rotate-180')}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-border/30">
          {/* View mode tabs + meta bar */}
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1 p-0.5 bg-card-solid/50 rounded-lg border border-border">
              {(['graph', 'log'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setViewMode(tab)}
                  className={cn(
                    'px-3 py-1 rounded-md text-[11px] font-semibold transition-all',
                    viewMode === tab
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  {tab === 'graph' ? (
                    <span className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="2" cy="5" r="1.5" /><circle cx="8" cy="2" r="1.5" /><circle cx="8" cy="8" r="1.5" />
                        <line x1="3.5" y1="4.5" x2="6.5" y2="2.5" /><line x1="3.5" y1="5.5" x2="6.5" y2="7.5" />
                      </svg>
                      Graph
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <line x1="1" y1="2" x2="9" y2="2" /><line x1="1" y1="5" x2="9" y2="5" /><line x1="1" y1="8" x2="6" y2="8" />
                      </svg>
                      Log
                    </span>
                  )}
                </button>
              ))}
            </div>

            {traceMeta && (
              <div className="flex items-center gap-3 text-[10px] text-muted/60">
                <span className="font-mono">{traceMeta.traceId?.slice(0, 16)}</span>
                <span>{traceMeta.totalSteps} steps</span>
                <span>{traceMeta.durationMs != null ? formatDuration(traceMeta.durationMs) : '...'}</span>
                <span>{privacyMode ? '$***' : `$${traceMeta.costUsd?.toFixed(4) || '...'}`}</span>
              </div>
            )}
          </div>

          {/* Graph view */}
          {viewMode === 'graph' && (
            <div className="px-3 pb-3">
              <TraceNodeGraph
                steps={steps}
                tickers={tickers || []}
                traceMeta={traceMeta}
                loading={loading}
                privacyMode={privacyMode}
              />
            </div>
          )}

          {/* Log view (original timeline) */}
          {viewMode === 'log' && (
          <div className="px-5 pb-4 pt-2">
          <div className="pl-1">
            {steps.map((step) => (
              <StepCard key={step.stepIndex} step={step} privacyMode={privacyMode} />
            ))}
            {loading && (
              <div className="flex gap-3 items-center">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <svg className="animate-spin h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <span className="text-xs text-muted animate-pulse">Agent is working...</span>
              </div>
            )}
          </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
