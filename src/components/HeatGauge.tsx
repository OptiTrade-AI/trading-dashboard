'use client';

import { getHeatLevel } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';

interface HeatGaugeProps {
  heat: number;
  maxHeat: number;
}

export function HeatGauge({ heat, maxHeat }: HeatGaugeProps) {
  const { formatPercent } = useFormatters();
  const level = getHeatLevel(heat);
  const percentage = Math.min((heat / maxHeat) * 100, 100);

  const colorMap = {
    green: {
      gradient: 'from-emerald-500 to-emerald-400',
      text: 'text-profit',
      glow: 'rgba(16, 185, 129, 0.4)',
      bg: 'bg-profit/10',
    },
    yellow: {
      gradient: 'from-amber-500 to-amber-400',
      text: 'text-caution',
      glow: 'rgba(245, 158, 11, 0.4)',
      bg: 'bg-caution/10',
    },
    red: {
      gradient: 'from-red-500 to-red-400',
      text: 'text-loss',
      glow: 'rgba(239, 68, 68, 0.4)',
      bg: 'bg-loss/10',
    },
  };

  const colors = colorMap[level];

  const statusMessages = {
    green: { title: 'Safe Zone', desc: 'Room for more positions' },
    yellow: { title: 'Caution', desc: 'Approaching max heat' },
    red: { title: 'Over Limit', desc: 'Reduce exposure' },
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="stat-label mb-1">Portfolio Heat</h3>
          <div className={`stat-value ${colors.text}`}>
            {formatPercent(heat)}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg ${colors.bg} ${colors.text} text-sm font-medium`}>
          {statusMessages[level].title}
        </div>
      </div>

      {/* Gauge Track */}
      <div className="relative h-3 bg-background/50 rounded-full overflow-hidden mb-3">
        {/* Gradient zones background */}
        <div className="absolute inset-0 flex">
          <div className="w-[62.5%] bg-gradient-to-r from-emerald-500/10 to-emerald-500/20" />
          <div className="w-[12.5%] bg-gradient-to-r from-amber-500/10 to-amber-500/20" />
          <div className="flex-1 bg-gradient-to-r from-red-500/10 to-red-500/20" />
        </div>

        {/* Active bar */}
        <div
          className={`absolute left-0 top-0 h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-700 ease-out`}
          style={{
            width: `${percentage}%`,
            boxShadow: `0 0 20px ${colors.glow}`,
          }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
        </div>

        {/* Threshold markers */}
        <div
          className="absolute top-0 h-full w-0.5 bg-caution/60"
          style={{ left: `${(25 / maxHeat) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-loss/60"
          style={{ left: `${(30 / maxHeat) * 100}%` }}
        />
      </div>

      {/* Scale */}
      <div className="flex justify-between text-xs text-muted mb-4">
        <span>0%</span>
        <span className="text-caution">25%</span>
        <span className="text-loss">30%</span>
        <span>{maxHeat}%</span>
      </div>

      {/* Status message */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${colors.gradient} animate-pulse`} />
        {statusMessages[level].desc}
      </div>
    </div>
  );
}
