'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { BehavioralFinding, BehavioralPattern, PatternAnalysisRecord, PatternLens } from '@/types';
import { DiscussChatLink } from './DiscussChatLink';

type TimeRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | 'ALL';

interface Props {
  timeRange: TimeRange;
}

const severityStyles = {
  positive: { border: 'border-l-profit', badge: 'bg-profit/10 text-profit' },
  negative: { border: 'border-l-loss', badge: 'bg-loss/10 text-loss' },
  neutral: { border: 'border-l-accent', badge: 'bg-accent/10 text-accent' },
};

const trendIcons = {
  improving: { icon: '↗', color: 'text-profit', bg: 'bg-profit/10' },
  worsening: { icon: '↘', color: 'text-loss', bg: 'bg-loss/10' },
  stable: { icon: '→', color: 'text-accent', bg: 'bg-accent/10' },
  new: { icon: '★', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const lensConfig: Record<PatternLens, { label: string; color: string }> = {
  timing: { label: 'TIMING & ENTRY', color: 'text-blue-400' },
  exit: { label: 'EXIT EXECUTION', color: 'text-amber-400' },
  strategy: { label: 'STRATEGY & TICKER', color: 'text-purple-400' },
};

// Type guard for new findings format
function hasFindings(record: PatternAnalysisRecord): boolean {
  return Array.isArray(record.findings) && record.findings.length > 0;
}

export function BehavioralPatterns({ timeRange }: Props) {
  const [findings, setFindings] = useState<BehavioralFinding[]>([]);
  const [history, setHistory] = useState<PatternAnalysisRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeLens, setActiveLens] = useState<PatternLens | null>(null);
  const [completedLenses, setCompletedLenses] = useState<Set<PatternLens>>(new Set());
  const [noNewTrades, setNoNewTrades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());

  // Load history on mount
  useEffect(() => {
    fetch('/api/ai/patterns')
      .then(res => res.json())
      .then(data => {
        if (data.history?.length) {
          setHistory(data.history);
          const latest = data.history[0];
          if (hasFindings(latest)) {
            setFindings(latest.findings!);
          }
          setSelectedIndex(0);
        }
      })
      .catch(() => setError('Failed to load pattern history'))
      .finally(() => setIsLoadingHistory(false));
  }, []);

  const analyze = useCallback(async (force = false) => {
    setIsStreaming(true);
    setError(null);
    setNoNewTrades(false);
    setFindings([]);
    setCompletedLenses(new Set());
    setActiveLens(null);
    setExpandedEvidence(new Set());

    try {
      const res = await fetch('/api/ai/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeRange, force }),
      });

      if (!res.ok) throw new Error('Failed to analyze patterns');

      // Check for non-streaming JSON response (noNewTrades or insufficient data)
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.noNewTrades) {
          setNoNewTrades(true);
          if (data.lastAnalysis?.findings) {
            setFindings(data.lastAnalysis.findings);
          }
          return;
        }
        if (data.findings) {
          setFindings(data.findings);
        }
        return;
      }

      // SSE stream consumption
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const event = JSON.parse(payload);
              if (event.type === 'progress') {
                setActiveLens(event.lens || null);
              } else if (event.type === 'finding') {
                setFindings(prev => [...prev, event.data]);
              } else if (event.type === 'lens_complete') {
                setCompletedLenses(prev => new Set([...prev, event.lens]));
              } else if (event.type === 'done') {
                if (event.record) {
                  setHistory(prev => [event.record, ...prev]);
                  setSelectedIndex(0);
                }
              } else if (event.type === 'error') {
                setError(event.message);
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsStreaming(false);
      setActiveLens(null);
    }
  }, [timeRange]);

  const selectHistoryEntry = (index: number) => {
    setSelectedIndex(index);
    setExpandedEvidence(new Set());
    const entry = history[index];
    if (hasFindings(entry)) {
      setFindings(entry.findings!);
    } else if (entry.patterns) {
      // Legacy: convert old patterns to findings for display
      setFindings(entry.patterns.map((p, i) => ({
        id: p.id || String(i + 1),
        lens: (['timing', 'exit', 'strategy'] as PatternLens[])[i % 3],
        title: p.title,
        description: p.description,
        severity: 'neutral' as const,
        trend: p.trend,
        metric: p.metric || '',
        actionItem: '',
      })));
    } else {
      setFindings([]);
    }
    setNoNewTrades(false);
  };

  const toggleEvidence = (id: string) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasData = findings.length > 0;
  const isViewingLatest = selectedIndex === 0;

  // Group findings by lens
  const findingsByLens = (['timing', 'exit', 'strategy'] as PatternLens[])
    .map(lens => ({
      lens,
      findings: findings.filter(f => f.lens === lens),
    }))
    .filter(g => g.findings.length > 0 || (isStreaming && activeLens === g.lens));

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Behavioral Patterns</h3>
          <p className="text-xs text-muted mt-0.5">
            {isStreaming && activeLens
              ? lensConfig[activeLens].label.toLowerCase() + '...'
              : history[selectedIndex]
              ? `${history[selectedIndex].tradeCount} trades · ${history[selectedIndex].timeRange || 'ALL'} range`
              : 'AI-detected trading patterns across all strategies'}
          </p>
        </div>
        <button
          onClick={() => analyze()}
          disabled={isStreaming}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
            'border border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {isStreaming ? (
            <>
              <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              Analyzing...
            </>
          ) : hasData ? (
            'Run New Analysis'
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              Analyze Patterns
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-sm text-loss text-center py-2 mb-3">{error}</div>
      )}

      {/* No new trades banner */}
      {noNewTrades && (
        <div className="flex items-center justify-between rounded-lg border border-caution/20 bg-caution/5 px-3 py-2 mb-4">
          <span className="text-xs text-caution">No new closed trades since last analysis.</span>
          <button
            onClick={() => analyze(true)}
            className="text-xs text-caution hover:text-caution/80 underline underline-offset-2"
          >
            Re-analyze Anyway
          </button>
        </div>
      )}

      {/* History selector */}
      {history.length > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <span className="text-[10px] text-muted uppercase tracking-wider shrink-0">History:</span>
          {history.map((entry, i) => {
            const date = new Date(entry.timestamp);
            return (
              <button
                key={entry.id}
                onClick={() => selectHistoryEntry(i)}
                className={cn(
                  'shrink-0 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                  i === selectedIndex
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'text-muted hover:text-foreground hover:bg-background/30'
                )}
              >
                {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {i === 0 && ' (latest)'}
              </button>
            );
          })}
        </div>
      )}

      {/* Snapshot stats for selected analysis */}
      {history.length > 0 && history[selectedIndex] && (
        <div className="flex items-center gap-4 mb-3 text-[11px] text-muted flex-wrap">
          <span>{history[selectedIndex].tradeCount} trades analyzed</span>
          <span className="flex items-center gap-1">
            {history[selectedIndex].winRate}% win rate
            {history.length >= 2 && selectedIndex < history.length - 1 && (() => {
              const prev = history[selectedIndex + 1];
              const delta = history[selectedIndex].winRate - prev.winRate;
              if (Math.abs(delta) < 0.1) return null;
              return (
                <span className={cn('font-bold', delta > 0 ? 'text-profit' : 'text-loss')}>
                  {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%
                </span>
              );
            })()}
          </span>
          <span className={cn('flex items-center gap-1', history[selectedIndex].totalPL >= 0 ? 'text-profit' : 'text-loss')}>
            ${Math.abs(history[selectedIndex].totalPL).toLocaleString()} {history[selectedIndex].totalPL >= 0 ? 'profit' : 'loss'}
            {history.length >= 2 && selectedIndex < history.length - 1 && (() => {
              const prev = history[selectedIndex + 1];
              const delta = history[selectedIndex].totalPL - prev.totalPL;
              if (Math.abs(delta) < 1) return null;
              return (
                <span className={cn('font-bold', delta > 0 ? 'text-profit' : 'text-loss')}>
                  {delta > 0 ? '↑' : '↓'}${Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              );
            })()}
          </span>
          {!isViewingLatest && (
            <span className="text-purple-400/60">viewing past analysis</span>
          )}
        </div>
      )}

      {/* Sparklines for win rate and P/L across history */}
      {history.length >= 3 && isViewingLatest && !isStreaming && (
        <div className="flex items-center gap-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">Win Rate</span>
            <svg width="60" height="20" viewBox="0 0 60 20" className="overflow-visible">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                points={history.slice(0, 10).reverse().map((h, i, arr) => {
                  const x = (i / (arr.length - 1)) * 56 + 2;
                  const rates = arr.map(a => a.winRate);
                  const min = Math.min(...rates);
                  const max = Math.max(...rates);
                  const range = max - min || 1;
                  const y = 18 - ((h.winRate - min) / range) * 16;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">P/L</span>
            <svg width="60" height="20" viewBox="0 0 60 20" className="overflow-visible">
              <polyline
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
                points={history.slice(0, 10).reverse().map((h, i, arr) => {
                  const x = (i / (arr.length - 1)) * 56 + 2;
                  const pls = arr.map(a => a.totalPL);
                  const min = Math.min(...pls);
                  const max = Math.max(...pls);
                  const range = max - min || 1;
                  const y = 18 - ((h.totalPL - min) / range) * 16;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Loading states */}
      {isLoadingHistory && !hasData && (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      )}

      {!isLoadingHistory && !hasData && !isStreaming && !error && !noNewTrades && (
        <div className="text-center py-8">
          <p className="text-sm text-muted">Click &quot;Analyze Patterns&quot; to discover behavioral insights across your trading history.</p>
          <p className="text-xs text-muted/60 mt-1">3 focused analyses: timing, exit discipline, strategy selection</p>
        </div>
      )}

      {/* Streaming progress (before any findings arrive) */}
      {isStreaming && !hasData && (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-sm text-muted">
            {activeLens ? `Analyzing ${lensConfig[activeLens].label.toLowerCase()}...` : 'Starting analysis...'}
          </span>
        </div>
      )}

      {/* Findings grouped by lens */}
      {(hasData || isStreaming) && findingsByLens.length > 0 && (
        <div className="space-y-4">
          {findingsByLens.map(({ lens, findings: lensFindings }) => {
            const config = lensConfig[lens];
            const isActive = isStreaming && activeLens === lens;
            const isComplete = completedLenses.has(lens);

            return (
              <div key={lens}>
                {/* Lens section header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', config.color)}>
                    {config.label}
                  </span>
                  <div className="flex-1 h-px bg-border/20" />
                  {isActive && (
                    <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  )}
                  {isComplete && !isActive && (
                    <svg className="w-3.5 h-3.5 text-profit" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Finding cards */}
                <div className="space-y-2">
                  {lensFindings.map((finding) => {
                    const severity = severityStyles[finding.severity] || severityStyles.neutral;
                    const trend = trendIcons[finding.trend] || trendIcons.stable;
                    const hasEvidence = finding.evidenceTrades && finding.evidenceTrades.length > 0;
                    const isExpanded = expandedEvidence.has(finding.id);

                    return (
                      <div
                        key={finding.id}
                        className={cn(
                          'rounded-xl border border-border/30 bg-background/20 p-4 space-y-2',
                          'border-l-2', severity.border
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-foreground leading-tight">{finding.title}</h4>
                          <span className={cn(
                            'shrink-0 text-xs font-bold px-2 py-0.5 rounded-full',
                            trend.bg, trend.color
                          )}>
                            {trend.icon} {finding.trend}
                          </span>
                        </div>

                        <p className="text-xs text-foreground/70 leading-relaxed">{finding.description}</p>

                        {finding.metric && (
                          <div className="text-xs font-medium text-accent">{finding.metric}</div>
                        )}

                        {/* Action item */}
                        {finding.actionItem && (
                          <div className={cn(
                            'flex items-start gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5',
                            finding.severity === 'negative' ? 'bg-loss/5 text-loss/90' :
                            finding.severity === 'positive' ? 'bg-profit/5 text-profit/90' :
                            'bg-accent/5 text-accent/90'
                          )}>
                            <span className="shrink-0 mt-px">&#9654;</span>
                            <span>{finding.actionItem}</span>
                          </div>
                        )}

                        {/* Evidence trades (collapsible) */}
                        {hasEvidence && (
                          <div>
                            <button
                              onClick={() => toggleEvidence(finding.id)}
                              className="text-[11px] text-muted hover:text-foreground transition-colors"
                            >
                              {isExpanded ? '▾ Hide evidence' : '▸ Show evidence trades'}
                            </button>
                            {isExpanded && (
                              <div className="mt-1.5 space-y-0.5 pl-2 border-l border-border/20">
                                {finding.evidenceTrades!.map((trade, i) => (
                                  <div key={i} className="text-[11px] text-muted/80 font-mono">{trade}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <DiscussChatLink
                          context={`I'd like to discuss this behavioral pattern from my trading: "${finding.title}" — ${finding.description}${finding.metric ? ` Key metric: ${finding.metric}` : ''}${finding.actionItem ? ` Recommended action: ${finding.actionItem}` : ''}`}
                          sourceFeature="Behavioral Patterns"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
