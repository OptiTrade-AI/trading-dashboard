'use client';

import { formatCurrency as rawFormatCurrency, cn } from '@/lib/utils';

interface CapitalAllocationCardProps {
  data: { name: string; value: number; color: string }[];
  accountValue: number;
  privacyMode: boolean;
}

export function CapitalAllocationCard({ data, accountValue, privacyMode }: CapitalAllocationCardProps) {
  const totalDeployed = data.reduce((sum, d) => sum + d.value, 0);
  const utilization = accountValue > 0 ? (totalDeployed / accountValue) * 100 : 0;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-foreground">Capital Deployed</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">{privacyMode ? '$***' : rawFormatCurrency(totalDeployed)}</span>
          <span className={cn('text-xs font-medium px-2 py-1 rounded-lg',
            utilization < 50 ? 'bg-profit/10 text-profit' :
            utilization < 75 ? 'bg-caution/10 text-caution' : 'bg-loss/10 text-loss'
          )}>
            {privacyMode ? '**%' : `${utilization.toFixed(0)}%`} of account
          </span>
        </div>
      </div>

      {/* Segmented bar */}
      <div className="mb-6">
        <div className="h-3 rounded-full bg-zinc-800/30 overflow-hidden flex">
          {data.map((d, i) => {
            const pct = accountValue > 0 ? (d.value / accountValue) * 100 : 0;
            return (
              <div
                key={d.name}
                className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: d.color,
                  opacity: 0.8,
                  marginLeft: i > 0 ? '2px' : 0,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Strategy grid */}
      <div className={cn('grid gap-5', data.length <= 3 ? `grid-cols-${data.length}` : 'grid-cols-2 lg:grid-cols-4')} style={{ gridTemplateColumns: data.length <= 4 ? `repeat(${data.length}, 1fr)` : undefined }}>
        {data.map((d) => {
          const pctOfAccount = accountValue > 0 ? (d.value / accountValue) * 100 : 0;
          return (
            <div key={d.name} className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${d.color}15` }}
              >
                <span className="text-base font-bold" style={{ color: d.color }}>
                  {d.name === 'CSP Collateral' ? 'P' : d.name === 'CC Shares' ? 'C' : d.name === 'Directional' ? 'D' : 'S'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted">{d.name}</div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xl font-bold text-foreground">{privacyMode ? '$***' : rawFormatCurrency(d.value)}</span>
                  <span className="text-sm text-muted">{privacyMode ? '**%' : `${pctOfAccount.toFixed(0)}%`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
