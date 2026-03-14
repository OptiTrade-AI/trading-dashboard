'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { OptimizerAIAnalysis, StrategyLane } from '@/types';
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

/* ── Shared sub-components ── */

function MetricCell({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  const colorClass = color === 'green' ? 'text-profit' : color === 'red' ? 'text-loss' : 'text-foreground';
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted/60 uppercase tracking-wider">{label}</div>
      <div className={cn('text-[13px] font-medium', colorClass)}>{value}</div>
    </div>
  );
}

function dteFromExpiration(exp: string): number | null {
  try {
    const d = new Date(exp);
    const now = new Date();
    return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  } catch { return null; }
}

const LANE_ICONS: Record<string, string> = {
  breakeven: '🛡', balanced: '⚖️', income: '⚡',
  'yield-weekly': '📅', 'yield-biweekly': '📅', 'yield-monthly': '📅',
};

/* ── Strategy Lane Card ── */

function StrategyLaneCard({ lane, mask }: { lane: StrategyLane; mask: (v: string) => string }) {
  const p = lane.pick;
  const dte = p?.expiration ? dteFromExpiration(p.expiration) : null;
  const icon = LANE_ICONS[lane.mode] || '📊';

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      lane.viable ? 'border-zinc-700/40 bg-zinc-900/40' : 'border-zinc-800/30 bg-zinc-900/20',
    )}>
      {/* Lane header */}
      <div className={cn('flex items-center justify-between px-4 py-2.5', !lane.viable && 'opacity-50')}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{lane.label}</span>
        </div>
        {lane.recommended && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 font-medium uppercase tracking-wider">
            Recommended
          </span>
        )}
      </div>

      {/* Not viable */}
      {!lane.viable && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted italic">{lane.viabilityNote || 'Not viable for this position'}</p>
        </div>
      )}

      {/* Viable — show pick metrics */}
      {lane.viable && p && (
        <div className="px-4 pb-4 space-y-2.5">
          {/* Metrics strip */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 rounded-lg bg-zinc-800/30 p-2.5">
            <MetricCell label="Strike" value={mask(`$${p.strike}`)} />
            <MetricCell label="Exp" value={p.expiration.slice(5)} />
            {dte != null && <MetricCell label="DTE" value={`${dte}d`} />}
            {p.premium != null && <MetricCell label="Premium" value={mask(`$${p.premium.toFixed(2)}`)} color="green" />}
            {p.delta != null && <MetricCell label="Delta" value={p.delta.toFixed(3)} />}
            {p.otmPercent != null && <MetricCell label="OTM" value={`${p.otmPercent.toFixed(1)}%`} />}
            {p.openInterest != null && <MetricCell label="OI" value={p.openInterest.toLocaleString()} />}
            {p.calledAwayPL != null && (
              <MetricCell
                label="If Called"
                value={mask(`${p.calledAwayPL >= 0 ? '+' : ''}$${p.calledAwayPL.toFixed(2)}`)}
                color={p.calledAwayPL >= 0 ? 'green' : 'red'}
              />
            )}
          </div>

          {/* Summary line */}
          <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
            {p.totalPremium != null && (
              <span>Total: <span className="text-profit font-medium">{mask(`$${p.totalPremium.toLocaleString()}`)}</span></span>
            )}
            {p.monthlyReturn != null && (
              <span>Monthly: <span className="text-profit font-medium">{p.monthlyReturn.toFixed(1)}%</span></span>
            )}
            {p.annualizedReturn != null && (
              <span>Ann: <span className="text-foreground font-medium">{p.annualizedReturn.toFixed(1)}%</span></span>
            )}
            {p.iv != null && (
              <span>IV: <span className="text-foreground font-medium">{p.iv.toFixed(1)}%</span></span>
            )}
          </div>

          {/* Reasoning */}
          <p className="text-xs text-zinc-400 leading-relaxed">{p.reasoning}</p>
        </div>
      )}
    </div>
  );
}

/* ── Main Analysis Card ── */

function AnalysisCard({ analysis, privacyMode }: { analysis: OptimizerAIAnalysis; privacyMode: boolean }) {
  const mask = (val: string) => privacyMode ? '***' : val;
  const [showAllRisks, setShowAllRisks] = useState(false);

  const hasStrategies = analysis.strategies && analysis.strategies.length > 0;
  const catalysts = analysis.catalysts || [];
  const earningsRisks = analysis.keyRisks?.filter(r => /earning/i.test(r)) || [];
  const otherRisks = analysis.keyRisks?.filter(r => !/earning/i.test(r)) || [];
  const hasEarnings = analysis.earningsDate || earningsRisks.length > 0;
  const rp = analysis.recoveryProjection;
  const rpCycleProgress = rp?.premiumPerCycle != null && rp?.cumulativePremiumNeeded
    ? Math.min(100, (rp.premiumPerCycle / rp.cumulativePremiumNeeded) * 100)
    : null;

  // Fallback checks for old-format data
  const hasStructuredPick = analysis.topPick?.premium != null;
  const hasStructuredAlts = analysis.alternates?.some(a => a.premium != null);

  return (
    <div className="rounded-xl overflow-hidden border border-purple-500/20 bg-zinc-900/50">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 bg-purple-500/5 border-b border-purple-500/10">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-foreground">{analysis.ticker}</span>
          {analysis.positionType && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
              analysis.positionType === 'underwater'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            )}>
              {analysis.positionType === 'underwater' ? 'Underwater' : 'Above Basis'}
            </span>
          )}
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
          {rp && (
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              ~{rp.weeksEstimate}wk recovery
            </span>
          )}
          {analysis.targetReturnPct != null && analysis.positionType === 'above-water' && (
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Target {analysis.targetReturnPct}%/mo
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Catalyst Banner — always visible ── */}
        {catalysts.length > 0 && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400 shrink-0 mt-0.5">
              <path d="M6 1L11 10H1L6 1Z" /><line x1="6" y1="4.5" x2="6" y2="6.5" /><circle cx="6" cy="8" r="0.5" fill="currentColor" />
            </svg>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Upcoming Catalysts</span>
              {catalysts.map((c, i) => (
                <p key={i} className="text-xs text-amber-300/90 leading-relaxed">{c}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── Fallback: Earnings Risk Banner (when no catalysts array but has earnings risks) ── */}
        {catalysts.length === 0 && hasEarnings && earningsRisks.length > 0 && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400 shrink-0 mt-0.5">
              <path d="M6 1L11 10H1L6 1Z" /><line x1="6" y1="4.5" x2="6" y2="6.5" /><circle cx="6" cy="8" r="0.5" fill="currentColor" />
            </svg>
            <div className="space-y-1">
              {earningsRisks.map((risk, i) => (
                <p key={i} className="text-xs text-amber-300/90 leading-relaxed">{risk}</p>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STRATEGY LANES — new format (when strategies array exists)
            ══════════════════════════════════════════════════════════════ */}
        {hasStrategies && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Strategy Options</span>
            {analysis.strategies!.map((lane, i) => (
              <StrategyLaneCard key={lane.mode + i} lane={lane} mask={mask} />
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            FALLBACK — old format (topPick + alternates, no strategies)
            ══════════════════════════════════════════════════════════════ */}
        {!hasStrategies && analysis.topPick && (
          <>
            {/* Top Pick */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">Top Pick</span>
                <span className="text-[11px] text-muted">{analysis.topPick.expiration}</span>
              </div>

              {hasStructuredPick ? (
                <>
                  <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/30 p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <MetricCell label="Strike" value={mask(`$${analysis.topPick.strike}`)} />
                      <MetricCell label="Premium" value={mask(`$${analysis.topPick.premium!.toFixed(2)}`)} color="green" />
                      <MetricCell label="Delta" value={analysis.topPick.delta!.toFixed(3)} />
                      {analysis.topPick.otmPercent != null && <MetricCell label="OTM" value={`${analysis.topPick.otmPercent.toFixed(1)}%`} />}
                      {analysis.topPick.openInterest != null && <MetricCell label="OI" value={analysis.topPick.openInterest.toLocaleString()} />}
                      {analysis.topPick.volume != null && <MetricCell label="Volume" value={analysis.topPick.volume.toLocaleString()} />}
                    </div>
                    {(analysis.topPick.totalPremium != null || analysis.topPick.iv != null) && (
                      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-zinc-700/20 text-[11px] text-muted">
                        {analysis.topPick.totalPremium != null && (
                          <span>Total: <span className="text-profit font-medium">{mask(`$${analysis.topPick.totalPremium.toLocaleString()}`)}</span></span>
                        )}
                        {analysis.topPick.iv != null && (
                          <span>IV: <span className="text-foreground font-medium">{analysis.topPick.iv.toFixed(1)}%</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{analysis.topPick.reasoning}</p>
                </>
              ) : (
                <div className="flex gap-4">
                  <div className="shrink-0 w-[100px] flex flex-col items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/25 p-3">
                    <span className="text-2xl font-bold text-foreground">{mask(`$${analysis.topPick.strike}`)}</span>
                    <span className="text-[10px] text-muted mt-0.5">Call</span>
                    <span className="text-[10px] text-purple-300 font-medium mt-0.5">{analysis.topPick.expiration}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 leading-relaxed">{analysis.topPick.reasoning}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Alternates */}
            {analysis.alternates?.length > 0 && (
              hasStructuredAlts ? (
                <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/30 overflow-hidden">
                  <div className="px-3.5 py-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Alternates</span>
                  </div>
                  <div className="hidden sm:block">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t border-zinc-700/30 text-muted text-[10px] uppercase tracking-wider">
                          <th className="px-3.5 py-1.5 text-left font-medium">Strike</th>
                          <th className="px-2 py-1.5 text-left font-medium">Exp</th>
                          <th className="px-2 py-1.5 text-right font-medium">Premium</th>
                          <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                          <th className="px-2 py-1.5 text-right font-medium">OI</th>
                          <th className="px-2 py-1.5 text-right font-medium">OTM%</th>
                          <th className="px-2 py-1.5 text-right font-medium">Total</th>
                          <th className="px-3.5 py-1.5 text-left font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.alternates.map((alt, i) => (
                          <tr key={i} className="border-t border-zinc-700/20 hover:bg-zinc-800/30">
                            <td className="px-3.5 py-1.5 font-semibold text-foreground">{mask(`$${alt.strike}`)}</td>
                            <td className="px-2 py-1.5 text-muted">{alt.expiration.slice(5)}</td>
                            <td className="px-2 py-1.5 text-right text-foreground font-medium">{alt.premium != null ? mask(`$${alt.premium.toFixed(2)}`) : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-foreground font-medium">
                              {alt.delta != null ? alt.delta.toFixed(3) : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right text-muted">{alt.openInterest != null ? alt.openInterest.toLocaleString() : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-muted">{alt.otmPercent != null ? `${alt.otmPercent.toFixed(1)}%` : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-foreground font-medium">{alt.totalPremium != null ? mask(`$${alt.totalPremium.toLocaleString()}`) : '—'}</td>
                            <td className="px-3.5 py-1.5 text-zinc-400">{alt.label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="sm:hidden space-y-2 px-3.5 pb-3">
                    {analysis.alternates.map((alt, i) => (
                      <div key={i} className="rounded-lg bg-zinc-800/40 border border-zinc-700/30 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold text-foreground">{mask(`$${alt.strike}`)}</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{alt.label}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {alt.premium != null && <MetricCell label="Premium" value={mask(`$${alt.premium.toFixed(2)}`)} />}
                          {alt.delta != null && <MetricCell label="Delta" value={alt.delta.toFixed(3)} />}
                          {alt.openInterest != null && <MetricCell label="OI" value={alt.openInterest.toLocaleString()} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
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
              )
            )}
          </>
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
          {rp && (
            <div className="px-3.5 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <path d="M1 9L5 1L9 9" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="5" x2="7" y2="5" />
                </svg>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wide">Recovery Projection</span>
              </div>
              <p className="text-xs text-zinc-300">
                <span className="text-foreground font-semibold">~{rp.weeksEstimate} weeks</span>
                {rp.assumedWeeklyPremium != null && (
                  <span className="text-muted"> at {mask(`$${Number(rp.assumedWeeklyPremium).toFixed(2)}`)}/wk</span>
                )}
                {rp.cumulativePremiumNeeded != null && (
                  <span className="text-muted"> ({mask(`$${Number(rp.cumulativePremiumNeeded).toFixed(2)}`)} total needed)</span>
                )}
              </p>
              {rpCycleProgress != null && (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${rpCycleProgress}%` }}
                    />
                  </div>
                  {rp.premiumPerCycle != null && rp.cyclesEstimate != null && (
                    <p className="text-[10px] text-muted mt-1">
                      {mask(`$${rp.premiumPerCycle.toFixed(2)}`)}/cycle &middot; ~{rp.cyclesEstimate} cycles to recover
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Risks — always visible ── */}
        {otherRisks.length > 0 && (
          <div className="rounded-lg border border-zinc-700/30 bg-zinc-800/20 overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-amber-400">
                <path d="M6 1L11 10H1L6 1Z" /><line x1="6" y1="4.5" x2="6" y2="6.5" /><circle cx="6" cy="8" r="0.5" fill="currentColor" />
              </svg>
              <span className="text-[11px] font-semibold text-amber-400">{analysis.keyRisks.length} Risk{analysis.keyRisks.length > 1 ? 's' : ''} Identified</span>
            </div>
            <div className="px-3.5 pb-3 space-y-2">
              {(showAllRisks ? otherRisks : otherRisks.slice(0, 4)).map((risk, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn(
                    'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                    /critical/i.test(risk) ? 'bg-amber-400' : 'bg-zinc-500',
                  )} />
                  <p className={cn(
                    'text-xs leading-relaxed',
                    /critical/i.test(risk) ? 'text-amber-300/90' : 'text-zinc-400',
                  )}>{risk}</p>
                </div>
              ))}
              {otherRisks.length > 4 && !showAllRisks && (
                <button
                  onClick={() => setShowAllRisks(true)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium pl-3.5"
                >
                  Show all {otherRisks.length} risks
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Strategy ── */}
        {analysis.strategySteps ? (
          <div className="rounded-lg bg-zinc-800/20 border-l-2 border-purple-500/40 p-4 space-y-2.5">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide block">Strategy</span>
            <div className="flex items-start gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-purple-400 shrink-0 mt-0.5">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 6l1.5 1.5L8 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm text-foreground font-semibold">{analysis.strategySteps.action}</p>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed pl-5">{analysis.strategySteps.rationale}</p>
            <p className="text-xs text-muted italic leading-relaxed pl-5">{analysis.strategySteps.nextStep}</p>
          </div>
        ) : analysis.strategyAdvice ? (
          <div className="px-4 py-3 rounded-lg bg-zinc-800/20 border-l-2 border-purple-500/40">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide block mb-1">Strategy</span>
            <p className="text-xs text-zinc-300 leading-relaxed">{analysis.strategyAdvice}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Outer Panel ── */

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
