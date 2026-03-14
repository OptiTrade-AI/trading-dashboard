'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { OptimizerAIAnalysis } from '@/types';
import { DiscussChatLink } from '@/components/DiscussChatLink';

export interface ProgressData {
  iteration?: number;
  elapsedMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

interface OptimizerAIPanelProps {
  analysis: OptimizerAIAnalysis | null;
  analyses?: OptimizerAIAnalysis[];
  loading: boolean;
  error: string | null;
  progress: string;
  progressData?: ProgressData | null;
  privacyMode: boolean;
}

function AnalysisCard({ analysis, privacyMode }: { analysis: OptimizerAIAnalysis; privacyMode: boolean }) {
  const mask = (val: string) => privacyMode ? '***' : val;
  const [showRisks, setShowRisks] = useState(false);
  const hasEarningsWarning = analysis.earningsDate || analysis.keyRisks?.some(r => /earning/i.test(r));

  return (
    <div className="rounded-xl overflow-hidden border border-purple-500/20 bg-zinc-900/50">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-purple-500/5 border-b border-purple-500/10">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-foreground">{analysis.ticker}</span>
          {analysis.analystConsensus && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              {analysis.analystConsensus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {analysis.earningsDate && (
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 font-semibold flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="6" r="5" /><path d="M6 3v3l2 1" />
              </svg>
              Earnings {analysis.earningsDate}
            </span>
          )}
          {analysis.recoveryProjection && (
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              ~{analysis.recoveryProjection.weeksEstimate}wk recovery
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Top Pick — hero section ── */}
        {analysis.topPick && (
          <div className="flex gap-4">
            {/* Strike badge */}
            <div className="shrink-0 w-[100px] flex flex-col items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/25 p-3">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Top Pick</span>
              <span className="text-2xl font-bold text-foreground mt-1">{mask(`$${analysis.topPick.strike}`)}</span>
              <span className="text-[10px] text-muted mt-0.5">Call</span>
              <span className="text-[10px] text-purple-300 font-medium mt-0.5">{analysis.topPick.expiration}</span>
            </div>

            {/* Reasoning */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 leading-relaxed">{analysis.topPick.reasoning}</p>
            </div>
          </div>
        )}

        {/* ── Alternates ── */}
        {analysis.alternates?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {analysis.alternates.map((alt, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/40">
                <span className="text-sm font-bold text-foreground">{mask(`$${alt.strike}`)}</span>
                <span className="text-[10px] text-muted">{alt.expiration.slice(5)}</span>
                <span className="w-px h-3 bg-zinc-700" />
                <span className="text-[10px] text-zinc-400 font-medium">{alt.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Context grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.ivContext && (
            <div className="px-3.5 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                  <path d="M1 9L3 3L5 7L7 1L9 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wide">IV Context</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{analysis.ivContext}</p>
            </div>
          )}
          {analysis.recoveryProjection && (
            <div className="px-3.5 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <path d="M1 9L5 1L9 9" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="5" x2="7" y2="5" />
                </svg>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Recovery Projection</span>
              </div>
              <p className="text-xs text-zinc-300">
                <span className="text-foreground font-semibold">~{analysis.recoveryProjection.weeksEstimate} weeks</span>
                {analysis.recoveryProjection.assumedWeeklyPremium != null && (
                  <span className="text-muted"> at {mask(`$${Number(analysis.recoveryProjection.assumedWeeklyPremium).toFixed(2)}`)}/wk</span>
                )}
                {analysis.recoveryProjection.cumulativePremiumNeeded != null && (
                  <span className="text-muted"> ({mask(`$${Number(analysis.recoveryProjection.cumulativePremiumNeeded).toFixed(2)}`)} total needed)</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Risks — collapsible ── */}
        {analysis.keyRisks?.length > 0 && (
          <div className={cn(
            'rounded-lg border overflow-hidden transition-colors',
            hasEarningsWarning ? 'border-amber-500/25 bg-amber-500/5' : 'border-zinc-700/30 bg-zinc-800/20',
          )}>
            <button
              onClick={() => setShowRisks(!showRisks)}
              className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-zinc-800/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400">
                  <path d="M6 1L11 10H1L6 1Z" /><line x1="6" y1="4.5" x2="6" y2="6.5" /><circle cx="6" cy="8" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-[11px] font-semibold text-amber-400">{analysis.keyRisks.length} Risk{analysis.keyRisks.length > 1 ? 's' : ''} Identified</span>
              </div>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={cn('text-muted transition-transform', showRisks && 'rotate-180')}>
                <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showRisks && (
              <div className="px-3.5 pb-3 space-y-2">
                {analysis.keyRisks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={cn(
                      'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                      /earning|critical/i.test(risk) ? 'bg-amber-400' : 'bg-zinc-500',
                    )} />
                    <p className={cn(
                      'text-xs leading-relaxed',
                      /earning|critical/i.test(risk) ? 'text-amber-300/90' : 'text-zinc-400',
                    )}>{risk}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Strategy Advice ── */}
        {analysis.strategyAdvice && (
          <div className="px-4 py-3 rounded-lg bg-zinc-800/20 border-l-2 border-purple-500/40">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide block mb-1">Strategy</span>
            <p className="text-xs text-zinc-300 leading-relaxed">{analysis.strategyAdvice}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function OptimizerAIPanel({ analysis, analyses, loading, error, progress, progressData, privacyMode }: OptimizerAIPanelProps) {
  const allAnalyses = analyses || (analysis ? [analysis] : []);

  // Live elapsed timer
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

  if (!loading && !error && allAnalyses.length === 0) {
    return null;
  }

  const totalTokens = (progressData?.totalInputTokens || 0) + (progressData?.totalOutputTokens || 0);
  const elapsedDisplay = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-foreground">AI Analysis</h4>
          <span className="text-[10px] text-muted/50 font-mono">claude-sonnet-4-6</span>
        </div>
        {allAnalyses.length > 0 && (
          <DiscussChatLink
            context={`Covered call optimization analysis:\n${allAnalyses
              .filter(a => a?.topPick)
              .map(a => `${a.ticker}: Top pick $${a.topPick.strike} ${a.topPick.expiration} — ${a.topPick.reasoning}`)
              .join('\n')}`}
            sourceFeature="cc-optimizer"
          />
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-purple-400 font-medium truncate">{progress || 'Analyzing...'}</p>
            </div>
          </div>
          {/* Live stats bar */}
          <div className="flex items-center gap-4 mt-2.5 pl-8">
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted/50">
                <circle cx="5" cy="5" r="4" /><path d="M5 3v2l1.5 1" />
              </svg>
              <span className="text-xs text-muted font-mono tabular-nums">{elapsedDisplay}</span>
            </div>
            {progressData?.iteration && (
              <span className="text-[11px] text-muted">
                Iteration <span className="text-foreground/70 font-semibold">{progressData.iteration}</span>
              </span>
            )}
            {totalTokens > 0 && (
              <span className="text-[11px] text-muted">
                <span className="text-foreground/70 font-semibold tabular-nums">{(totalTokens / 1000).toFixed(1)}k</span> tokens
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {allAnalyses.length > 0 && (
        <div className={cn('space-y-4', loading && 'opacity-50')}>
          {allAnalyses.map((a) => (
            <AnalysisCard key={a.ticker} analysis={a} privacyMode={privacyMode} />
          ))}
        </div>
      )}
    </div>
  );
}
