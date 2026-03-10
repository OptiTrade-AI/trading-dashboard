'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePressure } from '@/hooks/usePressure';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { useTickerDetails } from '@/hooks/useTickerDetails';
import { useFormatters } from '@/hooks/useFormatters';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import { DEFAULT_PRESSURE_THRESHOLDS } from '@/types';
import type { OpenPosition } from '@/components/dashboard/PositionsTimeline';
import { PositionDetailModal } from '@/components/dashboard/PositionDetailModal';

const SEVERITY_STYLES = {
  critical: 'border-l-red-500 bg-red-500/5',
  danger: 'border-l-red-400 bg-red-400/5',
  warning: 'border-l-amber-400 bg-amber-400/5',
};

const TYPE_BADGE = {
  csp: { label: 'CSP', color: 'bg-emerald-500/10 text-emerald-400', href: '/log' },
  cc: { label: 'CC', color: 'bg-blue-500/10 text-blue-400', href: '/cc' },
  credit_spread: { label: 'SPREAD', color: 'bg-purple-500/10 text-purple-400', href: '/spreads' },
};

function useRelativeTime(iso: string | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) return null;
  const seconds = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function PressureCard({ openPositions }: { openPositions: OpenPosition[] }) {
  const {
    pressurePositions,
    stockPrices,
    thresholds,
    setThresholds,
    isLoading,
    error,
  } = usePressure();

  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);

  const positionMap = useMemo(() => {
    const map = new Map<string, OpenPosition>();
    openPositions.forEach((p) => map.set(p.id, p));
    return map;
  }, [openPositions]);

  const { isOpen: isMarketOpen, isExtended, label: marketStatusLabel } = useMarketStatus();
  const pressureTickers = useMemo(() => pressurePositions.map(p => p.ticker), [pressurePositions]);
  const { nameMap: tickerNames } = useTickerDetails(pressureTickers);
  const { privacyMode } = useFormatters();
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage('pressure-collapsed', false);

  // Severity summary counts
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, danger: 0, warning: 0 };
    pressurePositions.forEach((p) => counts[p.severity]++);
    return counts;
  }, [pressurePositions]);

  // Last updated from the most recent stock price
  const lastUpdated = useMemo(() => {
    if (stockPrices.length === 0) return null;
    return stockPrices.reduce((latest, p) =>
      p.updatedAt > latest ? p.updatedAt : latest, stockPrices[0].updatedAt);
  }, [stockPrices]);

  const relativeTime = useRelativeTime(lastUpdated);

  // Don't render if no positions under pressure and not loading
  if (!isLoading && pressurePositions.length === 0 && !error) {
    return null;
  }

  const priceMap = new Map(stockPrices.map((p) => [p.ticker, p]));

  return (<>
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-muted hover:text-foreground transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={cn('w-4 h-4 transition-transform', collapsed ? '-rotate-90' : '')}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-foreground">
            Positions Under Pressure
          </h3>
          {pressurePositions.length > 0 && (
            <div className="flex items-center gap-1.5">
              {severityCounts.critical > 0 && (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500/15 text-red-400 text-[11px] font-bold">
                  {severityCounts.critical}
                </span>
              )}
              {severityCounts.danger > 0 && (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-400/10 text-red-400/80 text-[11px] font-bold">
                  {severityCounts.danger}
                </span>
              )}
              {severityCounts.warning > 0 && (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-400/10 text-amber-400 text-[11px] font-bold">
                  {severityCounts.warning}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {relativeTime && (
            <span className="text-[11px] text-muted">{relativeTime}</span>
          )}
          <span
            className={cn(
              'text-[11px] font-medium px-2 py-1 rounded-lg',
              isMarketOpen
                ? 'bg-profit/10 text-profit'
                : isExtended
                  ? 'bg-caution/10 text-caution'
                  : 'bg-muted/10 text-muted'
            )}
          >
            {marketStatusLabel}
          </span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="text-muted hover:text-foreground transition-colors"
            title="Threshold settings"
          >
            <svg
              className="w-4.5 h-4.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Threshold settings */}
      {showSettings && !collapsed && (
        <div className="px-5 py-3 border-b border-border/20 bg-background/30">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted text-xs">CSP warn at</span>
              <input
                type="number"
                value={thresholds.csp}
                onChange={(e) =>
                  setThresholds({ ...thresholds, csp: Number(e.target.value) })
                }
                className="input-field w-16 text-center text-xs py-1"
              />
              <span className="text-muted text-xs">%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted text-xs">CC warn at</span>
              <input
                type="number"
                value={thresholds.cc}
                onChange={(e) =>
                  setThresholds({ ...thresholds, cc: Number(e.target.value) })
                }
                className="input-field w-16 text-center text-xs py-1"
              />
              <span className="text-muted text-xs">%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted text-xs">Spread warn at</span>
              <input
                type="number"
                value={thresholds.creditSpread}
                onChange={(e) =>
                  setThresholds({
                    ...thresholds,
                    creditSpread: Number(e.target.value),
                  })
                }
                className="input-field w-16 text-center text-xs py-1"
              />
              <span className="text-muted text-xs">%</span>
            </div>
            <button
              onClick={() => setThresholds(DEFAULT_PRESSURE_THRESHOLDS)}
              className="text-xs text-accent hover:text-accent-light transition-colors ml-auto"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Collapsed: show nothing below header */}
      {collapsed ? null : isLoading ? (
        <div className="px-5 py-8 text-center text-muted text-sm">
          Loading prices...
        </div>
      ) : error ? (
        <div className="px-5 py-4 text-center text-muted text-sm">
          Unable to fetch stock prices
        </div>
      ) : pressurePositions.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <span className="text-profit text-sm font-medium">
            All clear — no positions under pressure
          </span>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {pressurePositions.map((pos) => {
            const badge = TYPE_BADGE[pos.tradeType];
            const sp = priceMap.get(pos.ticker);
            const changeUp = sp ? sp.change >= 0 : true;

            return (
              <button
                key={`${pos.tradeType}-${pos.id}`}
                onClick={() => {
                  const match = positionMap.get(pos.id);
                  if (match) setSelectedPosition(match);
                }}
                className={cn(
                  'flex items-center gap-3 px-5 py-3 border-l-[3px] transition-colors hover:bg-background/40 w-full text-left',
                  SEVERITY_STYLES[pos.severity],
                  pos.severity === 'critical' && 'ring-1 ring-red-500/20'
                )}
              >
                {/* Ticker + badge */}
                <div className="flex flex-col w-28 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {pos.ticker}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded',
                        badge.color
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {tickerNames.get(pos.ticker) && (
                    <span className="text-[11px] text-muted truncate">
                      {tickerNames.get(pos.ticker)}
                    </span>
                  )}
                </div>

                {/* Strike label */}
                <span className="text-sm text-muted w-32 flex-shrink-0">
                  {pos.label}
                </span>

                {/* Current price + change */}
                <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                  <span className="text-sm font-medium text-foreground">
                    {privacyMode ? '$***' : `$${pos.currentPrice.toFixed(2)}`}
                  </span>
                  {sp && !privacyMode && (
                    <span
                      className={cn(
                        'text-[11px]',
                        changeUp ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {changeUp ? '↑' : '↓'}
                      {Math.abs(sp.changePercent).toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* % to strike */}
                <span
                  className={cn(
                    'text-xs font-medium w-16 text-right flex-shrink-0',
                    pos.severity === 'critical'
                      ? 'text-loss'
                      : pos.severity === 'danger'
                        ? 'text-red-400'
                        : 'text-caution'
                  )}
                >
                  {privacyMode ? '**%' : `${pos.priceToStrikePercent.toFixed(1)}%`}
                </span>

                {/* DTE */}
                <span
                  className={cn(
                    'text-sm font-bold w-12 text-right flex-shrink-0',
                    pos.dte <= 7 ? 'text-loss' : 'text-muted'
                  )}
                >
                  {pos.dte}d
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
    <PositionDetailModal
      position={selectedPosition}
      isOpen={!!selectedPosition}
      onClose={() => setSelectedPosition(null)}
    />
  </>
  );
}
