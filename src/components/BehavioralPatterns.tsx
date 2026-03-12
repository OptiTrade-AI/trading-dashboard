'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { BehavioralPattern, PatternAnalysisRecord } from '@/types';
import { DiscussChatLink } from './DiscussChatLink';

const trendIcons = {
  improving: { icon: '↗', color: 'text-profit', bg: 'bg-profit/10' },
  worsening: { icon: '↘', color: 'text-loss', bg: 'bg-loss/10' },
  stable: { icon: '→', color: 'text-accent', bg: 'bg-accent/10' },
};

export function BehavioralPatterns() {
  const [patterns, setPatterns] = useState<BehavioralPattern[]>([]);
  const [history, setHistory] = useState<PatternAnalysisRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    fetch('/api/ai/patterns')
      .then(res => res.json())
      .then(data => {
        if (data.history?.length) {
          setHistory(data.history);
          setPatterns(data.history[0].patterns);
          setSelectedIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, []);

  const analyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/patterns', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to analyze patterns');
      const data = await res.json();
      const newPatterns = data.patterns || [];
      setPatterns(newPatterns);
      // Prepend the new record to history
      if (data.record) {
        setHistory(prev => [data.record, ...prev]);
        setSelectedIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectHistoryEntry = (index: number) => {
    setSelectedIndex(index);
    setPatterns(history[index].patterns);
  };

  const hasData = patterns.length > 0;
  const isViewingLatest = selectedIndex === 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Behavioral Patterns</h3>
          <p className="text-xs text-muted mt-0.5">AI-detected trading patterns across all strategies</p>
        </div>
        <button
          onClick={analyze}
          disabled={isLoading}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
            'border border-purple-500/30 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? (
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
        <div className="text-sm text-loss text-center py-4">{error}</div>
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
      {history.length >= 3 && isViewingLatest && (
        <div className="flex items-center gap-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted uppercase tracking-wider">Win Rate</span>
            <svg width="60" height="20" viewBox={`0 0 60 20`} className="overflow-visible">
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
            <svg width="60" height="20" viewBox={`0 0 60 20`} className="overflow-visible">
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

      {isLoadingHistory && !hasData && (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      )}

      {!isLoadingHistory && !hasData && !isLoading && !error && (
        <div className="text-center py-8">
          <p className="text-sm text-muted">Click &quot;Analyze Patterns&quot; to discover behavioral insights across your trading history.</p>
          <p className="text-xs text-muted/60 mt-1">Uses Sonnet 4.6 for deep analysis</p>
        </div>
      )}

      {isLoading && !hasData && (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <span className="text-sm text-muted">Analyzing your trading history...</span>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {patterns.map((pattern) => {
            const trend = trendIcons[pattern.trend];
            return (
              <div
                key={pattern.id}
                className="rounded-xl border border-border/30 bg-background/20 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{pattern.title}</h4>
                  <span className={cn(
                    'shrink-0 text-xs font-bold px-2 py-0.5 rounded-full',
                    trend.bg, trend.color
                  )}>
                    {trend.icon} {pattern.trend}
                  </span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{pattern.description}</p>
                {pattern.metric && (
                  <div className="text-xs font-medium text-accent">{pattern.metric}</div>
                )}
                <DiscussChatLink
                  context={`I'd like to discuss this behavioral pattern from my trading: "${pattern.title}" — ${pattern.description}${pattern.metric ? ` Key metric: ${pattern.metric}` : ''}`}
                  sourceFeature="Behavioral Patterns"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
