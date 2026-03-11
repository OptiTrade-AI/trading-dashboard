'use client';

import Link from 'next/link';
import { StockHolding, CoveredCall } from '@/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface TickerCoverage {
  ticker: string;
  totalShares: number;
  coveredShares: number;
  uncoveredShares: number;
  coveragePct: number;
  availableContracts: number; // 100-share lots available to write
}

interface UncoveredHoldingsCardProps {
  holdings: StockHolding[];
  openCalls: CoveredCall[];
  privacyMode: boolean;
  tickerNames?: Map<string, string>;
}

export function UncoveredHoldingsCard({
  holdings,
  openCalls,
  privacyMode,
  tickerNames,
}: UncoveredHoldingsCardProps) {
  const { tickers, overallCoverage, totalUncoveredShares, totalShares } = useMemo(() => {
    // Group holdings by ticker
    const holdingsByTicker: Record<string, StockHolding[]> = {};
    for (const h of holdings) {
      const key = h.ticker.toUpperCase();
      if (!holdingsByTicker[key]) holdingsByTicker[key] = [];
      holdingsByTicker[key].push(h);
    }

    // Group open CC shares by ticker
    const coveredByTicker: Record<string, number> = {};
    for (const c of openCalls) {
      const key = c.ticker.toUpperCase();
      coveredByTicker[key] = (coveredByTicker[key] || 0) + c.sharesHeld;
    }

    // Build coverage per ticker
    const tickers: TickerCoverage[] = Object.entries(holdingsByTicker).map(
      ([ticker, lots]) => {
        const totalShares = lots.reduce((s, h) => s + h.shares, 0);
        const coveredShares = Math.min(coveredByTicker[ticker] || 0, totalShares);
        const uncoveredShares = totalShares - coveredShares;

        return {
          ticker,
          totalShares,
          coveredShares,
          uncoveredShares,
          coveragePct: totalShares > 0 ? (coveredShares / totalShares) * 100 : 0,
          availableContracts: Math.floor(uncoveredShares / 100),
        };
      }
    );

    // Sort: fully uncovered first, then by uncovered shares desc
    tickers.sort((a, b) => {
      if (a.coveragePct === 0 && b.coveragePct > 0) return -1;
      if (a.coveragePct > 0 && b.coveragePct === 0) return 1;
      return b.uncoveredShares - a.uncoveredShares;
    });

    const totalShares = tickers.reduce((s, t) => s + t.totalShares, 0);
    const totalCovered = tickers.reduce((s, t) => s + t.coveredShares, 0);
    const overallCoverage = totalShares > 0 ? (totalCovered / totalShares) * 100 : 0;
    const totalUncoveredShares = tickers.reduce((s, t) => s + t.uncoveredShares, 0);

    return { tickers, overallCoverage, totalUncoveredShares, totalShares };
  }, [holdings, openCalls]);

  // Don't render if no holdings
  if (holdings.length === 0) return null;

  const uncoveredTickers = tickers.filter((t) => t.uncoveredShares > 0);
  const fullyUncovered = tickers.filter((t) => t.coveragePct === 0);
  const totalAvailableContracts = tickers.reduce((s, t) => s + t.availableContracts, 0);

  // Ring gauge math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const coverageArc = (overallCoverage / 100) * circumference;

  return (
    <div className="glass-card p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Coverage Monitor
            </h3>
            <p className="text-xs text-muted">
              Holdings vs. active covered calls
            </p>
          </div>
        </div>
        {uncoveredTickers.length > 0 && (
          <Link
            href="/cc"
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            Write Calls
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-6 mb-6">
        {/* Coverage ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(63,63,70,0.2)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={
                overallCoverage >= 80
                  ? '#10b981'
                  : overallCoverage >= 40
                  ? '#f59e0b'
                  : '#ef4444'
              }
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${coverageArc} ${circumference}`}
              className="transition-all duration-700"
              style={{
                filter: `drop-shadow(0 0 6px ${
                  overallCoverage >= 80
                    ? 'rgba(16,185,129,0.3)'
                    : overallCoverage >= 40
                    ? 'rgba(245,158,11,0.3)'
                    : 'rgba(239,68,68,0.3)'
                })`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">
              {privacyMode ? '**%' : `${overallCoverage.toFixed(0)}%`}
            </span>
            <span className="text-[9px] text-muted uppercase tracking-wider">
              covered
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted mb-0.5">Uncovered Tickers</div>
            <div className="text-xl font-bold text-foreground">
              {privacyMode ? '***' : `${fullyUncovered.length}`}
              <span className="text-sm font-normal text-muted ml-1">
                / {privacyMode ? '***' : tickers.length}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-0.5">Uncovered Shares</div>
            <div className="text-xl font-bold text-foreground">
              {privacyMode ? '***' : totalUncoveredShares.toLocaleString()}
              <span className="text-sm font-normal text-muted ml-1">
                / {privacyMode ? '***' : totalShares.toLocaleString()}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-0.5">Writable Contracts</div>
            <div className="text-xl font-bold text-amber-400">
              {privacyMode ? '***' : totalAvailableContracts}
              <span className="text-sm font-normal text-muted ml-1">lots</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-ticker breakdown */}
      {tickers.length > 0 && (
        <div className="space-y-2">
          {tickers.map((t) => {
            const isFullyUncovered = t.coveragePct === 0;
            const isFullyCovered = t.coveragePct >= 100;
            const companyName = tickerNames?.get(t.ticker);

            return (
              <div
                key={t.ticker}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
                  isFullyUncovered
                    ? 'bg-red-500/5 hover:bg-red-500/10'
                    : isFullyCovered
                    ? 'bg-emerald-500/5 hover:bg-emerald-500/8'
                    : 'bg-zinc-800/20 hover:bg-zinc-800/30'
                )}
              >
                {/* Ticker + name */}
                <div className="w-28 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">
                      {t.ticker}
                    </span>
                    {isFullyUncovered && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    )}
                  </div>
                  {companyName && (
                    <div className="text-[10px] text-muted truncate">
                      {companyName}
                    </div>
                  )}
                </div>

                {/* Coverage bar */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted">
                      {privacyMode
                        ? '*** / *** shares'
                        : `${t.coveredShares} / ${t.totalShares} shares`}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        isFullyCovered
                          ? 'text-emerald-400'
                          : isFullyUncovered
                          ? 'text-red-400'
                          : 'text-amber-400'
                      )}
                    >
                      {privacyMode ? '**%' : `${t.coveragePct.toFixed(0)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800/40 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        isFullyCovered
                          ? 'bg-emerald-500'
                          : t.coveragePct > 0
                          ? 'bg-amber-500'
                          : 'bg-zinc-700'
                      )}
                      style={{ width: `${Math.max(t.coveragePct, 0)}%` }}
                    />
                  </div>
                </div>

                {/* Available contracts badge */}
                <div className="w-24 text-right flex-shrink-0">
                  {t.availableContracts > 0 ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold',
                        isFullyUncovered
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                      )}
                    >
                      {privacyMode ? '***' : `${t.availableContracts}`}
                      <span className="font-normal text-[10px] opacity-70">
                        {t.availableContracts === 1 ? 'lot' : 'lots'}
                      </span>
                    </span>
                  ) : isFullyCovered ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Full
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">
                      {privacyMode ? '***' : `${t.uncoveredShares} odd`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All covered celebration */}
      {uncoveredTickers.length === 0 && tickers.length > 0 && (
        <div className="mt-4 text-center py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <span className="text-sm text-emerald-400 font-medium">
            All holdings are fully covered — maximum income generation
          </span>
        </div>
      )}
    </div>
  );
}
