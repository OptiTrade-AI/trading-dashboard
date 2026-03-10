'use client';

import { cn } from '@/lib/utils';

interface CompactHeatProps {
  heat: number;
  maxHeatPercent: number;
  privacyMode: boolean;
}

export function CompactHeat({ heat, maxHeatPercent, privacyMode }: CompactHeatProps) {
  const maxHeat = maxHeatPercent;
  const percentage = Math.min((heat / maxHeat) * 100, 100);
  const level = heat < 25 ? 'green' : heat < 30 ? 'yellow' : 'red';

  const config = {
    green: { gradient: 'from-emerald-500 to-emerald-400', text: 'text-profit', label: 'Safe', glow: 'rgba(16,185,129,0.4)' },
    yellow: { gradient: 'from-amber-500 to-amber-400', text: 'text-caution', label: 'Caution', glow: 'rgba(245,158,11,0.4)' },
    red: { gradient: 'from-red-500 to-red-400', text: 'text-loss', label: 'Over Limit', glow: 'rgba(239,68,68,0.4)' },
  }[level];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="stat-label">Heat</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-bold', config.text)}>{privacyMode ? '**%' : `${heat.toFixed(1)}%`}</span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
            level === 'green' ? 'bg-profit/10 text-profit' : level === 'yellow' ? 'bg-caution/10 text-caution' : 'bg-loss/10 text-loss'
          )}>
            {config.label}
          </span>
        </div>
      </div>
      <div className="relative h-2.5 bg-background/50 rounded-full overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="w-[62.5%] bg-gradient-to-r from-emerald-500/10 to-emerald-500/15" />
          <div className="w-[12.5%] bg-gradient-to-r from-amber-500/10 to-amber-500/15" />
          <div className="flex-1 bg-gradient-to-r from-red-500/10 to-red-500/15" />
        </div>
        <div
          className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-700 bg-gradient-to-r', config.gradient)}
          style={{ width: `${percentage}%`, boxShadow: `0 0 12px ${config.glow}` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-caution/50" style={{ left: `${(25 / maxHeat) * 100}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-loss/50" style={{ left: `${(30 / maxHeat) * 100}%` }} />
      </div>
    </div>
  );
}
