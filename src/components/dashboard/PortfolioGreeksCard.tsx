'use client';

import { formatCurrency as rawFormatCurrency, cn } from '@/lib/utils';
import { OpenPosition } from './PositionsTimeline';

interface PortfolioGreeksCardProps {
  positions: OpenPosition[];
  privacyMode: boolean;
}

export function PortfolioGreeksCard({ positions, privacyMode }: PortfolioGreeksCardProps) {
  const positionsWithData = positions.filter(p => p.delta !== null || p.theta !== null || p.iv !== null);
  if (positionsWithData.length === 0) return null;

  const netDelta = positionsWithData.reduce((sum, p) => sum + (p.delta ?? 0), 0);
  const dailyTheta = positionsWithData.reduce((sum, p) => sum + ((p.theta ?? 0) * 100), 0);
  const ivValues = positionsWithData.filter(p => p.iv !== null).map(p => p.iv!);
  const avgIV = ivValues.length > 0 ? ivValues.reduce((a, b) => a + b, 0) / ivValues.length : null;

  const greekItems = [
    {
      label: 'Net Delta',
      symbol: 'Δ',
      value: privacyMode ? '***' : netDelta.toFixed(2),
      subtext: netDelta > 0 ? 'Bullish bias' : netDelta < 0 ? 'Bearish bias' : 'Neutral',
      color: Math.abs(netDelta) > 2 ? 'text-caution' : 'text-foreground',
      iconBg: Math.abs(netDelta) > 2 ? 'bg-caution/10' : 'bg-accent/10',
      iconColor: Math.abs(netDelta) > 2 ? 'text-caution' : 'text-accent',
    },
    {
      label: 'Daily Theta',
      symbol: 'Θ',
      value: privacyMode ? '$***' : `${dailyTheta >= 0 ? '+' : ''}${rawFormatCurrency(dailyTheta)}`,
      subtext: 'per day time decay',
      color: dailyTheta >= 0 ? 'text-profit' : 'text-loss',
      iconBg: dailyTheta >= 0 ? 'bg-profit/10' : 'bg-loss/10',
      iconColor: dailyTheta >= 0 ? 'text-profit' : 'text-loss',
    },
    ...(avgIV !== null ? [{
      label: 'Avg IV',
      symbol: 'σ',
      value: privacyMode ? '**%' : `${(avgIV * 100).toFixed(0)}%`,
      subtext: avgIV > 0.5 ? 'Elevated' : avgIV > 0.3 ? 'Moderate' : 'Low',
      color: avgIV > 0.5 ? 'text-amber-400' : 'text-foreground',
      iconBg: avgIV > 0.5 ? 'bg-amber-500/10' : 'bg-zinc-500/10',
      iconColor: avgIV > 0.5 ? 'text-amber-400' : 'text-zinc-400',
    }] : []),
  ];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-foreground">Portfolio Greeks</h3>
        <span className="text-xs text-muted">{positionsWithData.length} positions</span>
      </div>
      <div className={cn('grid gap-4', greekItems.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {greekItems.map((g) => (
          <div key={g.label} className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', g.iconBg)}>
              <span className={cn('font-bold text-lg', g.iconColor)}>{g.symbol}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">{g.label}</div>
              <div className={cn('text-xl font-bold', g.color)}>{g.value}</div>
              <div className="text-[11px] text-muted">{g.subtext}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
