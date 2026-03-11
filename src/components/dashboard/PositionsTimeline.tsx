'use client';

import { useState } from 'react';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade } from '@/types';
import { formatDateShort, formatCurrency as rawFormatCurrency, cn } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import { PositionDetailModal } from './PositionDetailModal';

const URGENCY_ZONES = [
  { key: 'critical', label: 'This Week', sublabel: '≤ 7 days', min: 0, max: 7, dotColor: 'bg-loss', borderColor: 'border-loss/30', glowColor: 'shadow-[0_0_15px_rgba(239,68,68,0.08)]' },
  { key: 'caution', label: 'Next 2 Weeks', sublabel: '8–21 days', min: 8, max: 21, dotColor: 'bg-caution', borderColor: 'border-caution/20', glowColor: '' },
  { key: 'safe', label: '3–4 Weeks', sublabel: '22–30 days', min: 22, max: 30, dotColor: 'bg-accent', borderColor: 'border-border/20', glowColor: '' },
  { key: 'distant', label: '30+ Days', sublabel: 'Far out', min: 31, max: Infinity, dotColor: 'bg-zinc-500', borderColor: 'border-border/10', glowColor: '' },
];

const strategyColors: Record<string, string> = {
  csp: '#10b981',
  cc: '#3b82f6',
  directional: '#f59e0b',
  spread: '#a855f7',
};

const strategyLabels: Record<string, string> = {
  csp: 'CSP',
  cc: 'CC',
  directional: 'DIR',
  spread: 'SPREAD',
};

export type OpenPosition = {
  id: string;
  ticker: string;
  type: 'csp' | 'cc' | 'directional' | 'spread';
  label: string;
  badge: string;
  badgeColor: string;
  dte: number;
  expiration: string;
  contracts: number;
  detail: string;
  value: string;
  valueLabel: string;
  subDetail: string;
  canClose: boolean;
  trade: Trade | null;
  rawTrade?: Trade | CoveredCall | DirectionalTrade | SpreadTrade;
  unrealizedPL: number | null;
  maxPremium: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  companyName: string | null;
};

export function PositionsTimeline({ positions, onCloseTrade }: { positions: OpenPosition[]; onCloseTrade: (trade: Trade) => void }) {
  const { privacyMode } = useFormatters();
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);
  const sorted = [...positions].sort((a, b) => a.dte - b.dte);

  const zones = URGENCY_ZONES
    .map((zone) => ({
      ...zone,
      items: sorted.filter((p) => p.dte >= zone.min && p.dte <= zone.max),
    }))
    .filter((zone) => zone.items.length > 0);

  const soonestDTE = sorted[0]?.dte ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Positions & Expirations</h3>
          <span className="text-sm text-muted">{sorted.length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Next expiry:</span>
          <span className={cn('text-sm font-bold', soonestDTE <= 7 ? 'text-loss' : soonestDTE <= 21 ? 'text-caution' : 'text-accent')}>
            {soonestDTE}d
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3">
        {Object.entries({ CSP: '#10b981', CC: '#3b82f6', Dir: '#f59e0b', Spread: '#a855f7' }).map(
          ([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          )
        )}
      </div>

      {/* Urgency zones */}
      {zones.map((zone) => (
        <div key={zone.key}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className={cn('w-2 h-2 rounded-full', zone.dotColor)} />
            <span className="text-sm font-medium text-foreground">{zone.label}</span>
            <span className="text-[11px] text-muted">{zone.sublabel}</span>
            <span className="text-[11px] text-muted ml-auto">{zone.items.length}</span>
          </div>
          <div className="space-y-1.5">
            {zone.items.map((pos) => {
              const color = strategyColors[pos.type] || '#10b981';
              const isSold = pos.type === 'csp' || pos.type === 'cc' || (pos.type === 'spread' && pos.valueLabel === 'credit');
              const profitCapture = (pos.unrealizedPL !== null && isSold && pos.maxPremium > 0)
                ? Math.min(Math.max((pos.unrealizedPL / pos.maxPremium) * 100, -100), 100)
                : null;

              return (
                <div
                  key={`${pos.type}-${pos.id}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group cursor-pointer',
                    zone.borderColor,
                    zone.glowColor,
                    'bg-card-solid/20 hover:bg-card-solid/40',
                  )}
                  onClick={() => setSelectedPosition(pos)}
                >
                  {/* Strategy color bar */}
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

                  {/* Ticker + type badge + company */}
                  <div className="flex flex-col w-28 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{pos.ticker}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {strategyLabels[pos.type]}
                      </span>
                    </div>
                    {pos.companyName && (
                      <span className="text-[11px] text-muted truncate">{pos.companyName}</span>
                    )}
                  </div>

                  {/* Strike + contracts */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-muted">{pos.label} {pos.detail}</span>
                  </div>

                  {/* Unrealized P/L pill */}
                  <div className="flex-shrink-0 w-24 hidden sm:block">
                    {pos.unrealizedPL !== null ? (
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold',
                        pos.unrealizedPL >= 0
                          ? 'bg-profit/10 text-profit'
                          : 'bg-loss/10 text-loss'
                      )}>
                        {privacyMode ? '$***' : `${pos.unrealizedPL >= 0 ? '+' : ''}${rawFormatCurrency(pos.unrealizedPL)}`}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">{pos.value}</div>
                    )}
                  </div>

                  {/* Profit capture bar (sold positions) */}
                  <div className="flex-shrink-0 w-24 hidden md:block">
                    {profitCapture !== null && !privacyMode ? (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={cn('text-[10px] font-bold',
                            profitCapture >= 75 ? 'text-amber-400' :
                            profitCapture >= 50 ? 'text-profit' :
                            profitCapture >= 25 ? 'text-emerald-400/70' :
                            profitCapture >= 0 ? 'text-zinc-400' : 'text-loss'
                          )}>
                            {profitCapture.toFixed(0)}%
                          </span>
                          {profitCapture >= 75 && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 rounded">75%</span>
                          )}
                          {profitCapture >= 50 && profitCapture < 75 && (
                            <span className="text-[9px] font-bold text-profit bg-profit/10 px-1 rounded animate-pulse">50%</span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800/40 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500',
                              profitCapture >= 75 ? 'bg-amber-400' :
                              profitCapture >= 50 ? 'bg-profit animate-pulse' :
                              profitCapture >= 25 ? 'bg-emerald-600/70' :
                              profitCapture >= 0 ? 'bg-zinc-500' : 'bg-loss'
                            )}
                            style={{ width: `${Math.abs(Math.min(profitCapture, 100))}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted">profit captured</span>
                      </div>
                    ) : profitCapture !== null && privacyMode ? (
                      <span className="text-[11px] text-muted">**% captured</span>
                    ) : pos.subDetail ? (
                      <span className="text-[11px] text-muted">{pos.subDetail}</span>
                    ) : null}
                  </div>

                  {/* Greeks badges */}
                  <div className="flex-shrink-0 hidden lg:flex items-center gap-1.5">
                    {pos.delta !== null && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                        Math.abs(pos.delta) > 0.5
                          ? 'bg-loss/10 text-loss'
                          : Math.abs(pos.delta) > 0.3
                            ? 'bg-caution/10 text-caution'
                            : 'bg-zinc-500/10 text-zinc-400'
                      )}>
                        {privacyMode ? 'Δ **' : `Δ${pos.delta.toFixed(2)}`}
                      </span>
                    )}
                    {pos.theta !== null && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-profit/10 text-profit">
                        {privacyMode ? 'Θ $**' : `Θ${rawFormatCurrency(Math.abs(pos.theta * 100))}`}
                      </span>
                    )}
                    {pos.iv !== null && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                        pos.iv > 0.5
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-zinc-500/10 text-zinc-400'
                      )}>
                        {privacyMode ? 'IV **' : `${(pos.iv * 100).toFixed(0)}%`}
                      </span>
                    )}
                  </div>

                  {/* Expiration */}
                  <span className="text-xs text-muted flex-shrink-0 w-20 text-right hidden md:block">
                    {formatDateShort(pos.expiration)}
                  </span>

                  {/* DTE countdown */}
                  <div className={cn(
                    'flex-shrink-0 min-w-[48px] text-center px-2 py-1 rounded-lg text-sm font-bold',
                    pos.dte <= 3 ? 'bg-loss/10 text-loss' :
                    pos.dte <= 7 ? 'bg-loss/10 text-loss' :
                    pos.dte <= 21 ? 'bg-caution/10 text-caution' : 'text-muted'
                  )}>
                    {pos.dte}d
                  </div>

                  {/* Close button for CSPs */}
                  {pos.canClose && pos.trade ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onCloseTrade(pos.trade!); }}
                      className="flex-shrink-0 text-[11px] font-semibold text-accent border border-accent/20 rounded-lg
                                 px-2.5 py-1 bg-accent/5 hover:bg-accent/10 hover:border-accent/40
                                 transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      Close
                    </button>
                  ) : (
                    <div className="w-[52px] flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <PositionDetailModal
        position={selectedPosition}
        isOpen={!!selectedPosition}
        onClose={() => setSelectedPosition(null)}
      />
    </div>
  );
}
