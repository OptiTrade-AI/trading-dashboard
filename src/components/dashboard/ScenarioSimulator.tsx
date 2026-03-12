'use client';

import { useState, useMemo } from 'react';
import { OpenPosition } from './PositionsTimeline';
import { useFormatters } from '@/hooks/useFormatters';
import { cn } from '@/lib/utils';

interface ScenarioSimulatorProps {
  positions: OpenPosition[];
}

interface PositionImpact {
  ticker: string;
  type: string;
  label: string;
  totalImpact: number;
  contracts: number;
  stockPrice: number;
}

export function ScenarioSimulator({ positions }: ScenarioSimulatorProps) {
  const [movePercent, setMovePercent] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { formatCurrency, privacyMode } = useFormatters();

  // Only include positions that have both Greeks AND stock price — both required for accurate math
  const positionsWithData = positions.filter(p => p.delta !== null && p.stockPrice !== null);

  const scenario = useMemo(() => {
    if (positionsWithData.length === 0) return null;

    const impacts: PositionImpact[] = [];
    let totalImpact = 0;

    for (const p of positionsWithData) {
      if (p.delta === null || p.stockPrice === null) continue;

      const S = p.stockPrice;
      const dollarMove = S * (movePercent / 100); // actual dollar move per share
      const gamma = p.gamma || 0;

      // P/L ≈ delta × ΔS × 100 × contracts + 0.5 × gamma × ΔS² × 100 × contracts
      // delta/gamma are already per-share and seller-sign-adjusted from useOptionQuotes
      const multiplier = 100 * p.contracts;
      const impact = (p.delta * dollarMove + 0.5 * gamma * dollarMove * dollarMove) * multiplier;

      impacts.push({
        ticker: p.ticker,
        type: p.type,
        label: p.label,
        totalImpact: impact,
        contracts: p.contracts,
        stockPrice: S,
      });

      totalImpact += impact;
    }

    return {
      impacts: impacts.sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact)),
      totalImpact,
    };
  }, [positionsWithData, movePercent]);

  if (positionsWithData.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">Scenario Simulator</h3>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={cn('text-muted transition-transform', expanded && 'rotate-180')}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">Market Move</span>
              <span className={cn(
                'text-sm font-bold',
                movePercent > 0 ? 'text-profit' : movePercent < 0 ? 'text-loss' : 'text-foreground'
              )}>
                {movePercent > 0 ? '+' : ''}{movePercent}%
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.5"
              value={movePercent}
              onChange={(e) => setMovePercent(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>-10%</span>
              <span>0%</span>
              <span>+10%</span>
            </div>
          </div>

          {/* Total impact */}
          {scenario && movePercent !== 0 && (
            <>
              <div className={cn(
                'rounded-xl p-3 text-center',
                scenario.totalImpact >= 0 ? 'bg-profit/10' : 'bg-loss/10'
              )}>
                <div className="text-xs text-muted mb-0.5">Estimated Portfolio Impact</div>
                <div className={cn(
                  'text-xl font-bold',
                  scenario.totalImpact >= 0 ? 'text-profit' : 'text-loss'
                )}>
                  {privacyMode ? '$***' : `${scenario.totalImpact >= 0 ? '+' : ''}${formatCurrency(scenario.totalImpact)}`}
                </div>
              </div>

              {/* Per-position breakdown */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Per Position Impact</div>
                {scenario.impacts.slice(0, 8).map((impact, i) => {
                  const maxAbs = Math.max(...scenario.impacts.map(im => Math.abs(im.totalImpact)), 1);
                  const barWidth = Math.abs(impact.totalImpact) / maxAbs * 100;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-muted truncate">{impact.ticker} {impact.label}</span>
                      <div className="flex-1 h-3 bg-background/30 rounded-full overflow-hidden relative">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            impact.totalImpact >= 0 ? 'bg-profit/40' : 'bg-loss/40'
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={cn(
                        'w-16 text-right font-medium',
                        impact.totalImpact >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {privacyMode ? '$***' : `${impact.totalImpact >= 0 ? '+' : ''}$${Math.abs(impact.totalImpact).toFixed(0)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {movePercent === 0 && (
            <p className="text-xs text-muted text-center py-4">
              Drag the slider to simulate market moves and see projected P/L impact.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
