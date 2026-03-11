'use client';

import { useMemo } from 'react';
import { cn, formatCurrency as rawFormatCurrency } from '@/lib/utils';
import { useFormatters } from '@/hooks/useFormatters';
import type { OpenPosition } from './PositionsTimeline';

interface ThetaDashboardCardProps {
  positions: OpenPosition[];
  fetchedAt: string | null;
}

export function ThetaDashboardCard({ positions, fetchedAt }: ThetaDashboardCardProps) {
  const { privacyMode } = useFormatters();

  const thetaData = useMemo(() => {
    const withTheta = positions
      .filter(p => p.theta !== null && p.theta !== 0)
      .map(p => ({
        id: p.id,
        ticker: p.ticker,
        type: p.type,
        label: p.label,
        dte: p.dte,
        // theta is per-share from Polygon, multiply by 100 (per-contract) × contracts
        dailyTheta: Math.abs(p.theta!) * 100 * p.contracts,
        contracts: p.contracts,
      }));

    const totalDaily = withTheta.reduce((sum, p) => sum + p.dailyTheta, 0);
    const weekly = totalDaily * 5;
    const monthly = totalDaily * 21;

    // Top contributors sorted by daily theta
    const topContributors = [...withTheta]
      .sort((a, b) => b.dailyTheta - a.dailyTheta)
      .slice(0, 5);

    // DTE buckets for acceleration visualization
    const buckets = [
      { label: '0-7d', min: 0, max: 7 },
      { label: '8-14d', min: 8, max: 14 },
      { label: '15-30d', min: 15, max: 30 },
      { label: '30d+', min: 31, max: Infinity },
    ].map(bucket => {
      const inBucket = withTheta.filter(p => p.dte >= bucket.min && p.dte <= bucket.max);
      return {
        ...bucket,
        theta: inBucket.reduce((sum, p) => sum + p.dailyTheta, 0),
        count: inBucket.length,
      };
    }).filter(b => b.count > 0);

    const maxBucketTheta = Math.max(...buckets.map(b => b.theta), 1);

    return { totalDaily, weekly, monthly, topContributors, buckets, maxBucketTheta, count: withTheta.length };
  }, [positions]);

  if (thetaData.count === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Theta Income</h3>
          <span className="text-xs text-muted">{thetaData.count} positions</span>
        </div>
        {fetchedAt && (
          <span className="text-[11px] text-muted">
            {new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Income projections */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-profit/5 rounded-xl p-3 border border-profit/10">
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Daily</div>
          <div className="text-xl font-bold text-profit">
            {privacyMode ? '$***' : `+${rawFormatCurrency(thetaData.totalDaily)}`}
          </div>
        </div>
        <div className="bg-profit/5 rounded-xl p-3 border border-profit/10">
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Weekly</div>
          <div className="text-xl font-bold text-profit">
            {privacyMode ? '$***' : `+${rawFormatCurrency(thetaData.weekly)}`}
          </div>
        </div>
        <div className="bg-profit/5 rounded-xl p-3 border border-profit/10">
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Monthly</div>
          <div className="text-xl font-bold text-profit">
            {privacyMode ? '$***' : `+${rawFormatCurrency(thetaData.monthly)}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Theta acceleration by DTE */}
        <div>
          <div className="text-xs font-medium text-muted mb-3 uppercase tracking-wider">Decay Acceleration</div>
          <div className="space-y-2">
            {thetaData.buckets.map(bucket => (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="text-xs text-muted w-12 flex-shrink-0">{bucket.label}</span>
                <div className="flex-1 h-5 rounded-full bg-zinc-800/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      bucket.min <= 7 ? 'bg-profit' : bucket.min <= 14 ? 'bg-emerald-600/70' : 'bg-zinc-500'
                    )}
                    style={{ width: `${(bucket.theta / thetaData.maxBucketTheta) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground w-16 text-right flex-shrink-0">
                  {privacyMode ? '$***' : rawFormatCurrency(bucket.theta)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">Theta accelerates as expiration approaches</p>
        </div>

        {/* Top contributors */}
        <div>
          <div className="text-xs font-medium text-muted mb-3 uppercase tracking-wider">Top Theta Contributors</div>
          <div className="space-y-1.5">
            {thetaData.topContributors.map(pos => (
              <div key={pos.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card-solid/20">
                <span className="font-semibold text-sm text-foreground w-16">{pos.ticker}</span>
                <span className="text-xs text-muted">{pos.label}</span>
                <span className={cn(
                  'text-[10px] font-bold ml-auto',
                  pos.dte <= 7 ? 'text-loss' : pos.dte <= 21 ? 'text-caution' : 'text-muted'
                )}>
                  {pos.dte}d
                </span>
                <span className="text-xs font-bold text-profit w-14 text-right">
                  {privacyMode ? '$**' : `+${rawFormatCurrency(pos.dailyTheta)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
