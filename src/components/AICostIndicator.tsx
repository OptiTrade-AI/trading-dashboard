'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAIUsage } from '@/hooks/useAIUsage';
import { useFormatters } from '@/hooks/useFormatters';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { DailyCostEntry } from '@/types';

/* ─── Constants ─── */

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat',
  'exit-coach': 'Exit Coach',
  'smart-alerts': 'Smart Alerts',
  'trade-check': 'Trade Check',
  patterns: 'Patterns',
  'roll-advisor': 'Roll Advisor',
  'events-check': 'Events',
  'daily-summary': 'Daily Summary',
  scenario: 'Scenario',
};

const FEATURE_COLORS: Record<string, string> = {
  chat: '#3b82f6',
  'exit-coach': '#10b981',
  'smart-alerts': '#f59e0b',
  'trade-check': '#8b5cf6',
  patterns: '#ec4899',
  'roll-advisor': '#06b6d4',
  'events-check': '#f97316',
  'daily-summary': '#6366f1',
  scenario: '#14b8a6',
};

const MODEL_COLORS: Record<string, string> = {
  haiku: '#8b5cf6',
  sonnet: '#3b82f6',
};

const CHART_COLORS = {
  grid: 'rgba(63, 63, 70, 0.3)',
  text: '#71717a',
  tooltipBg: 'rgba(24, 24, 27, 0.95)',
  tooltipBorder: 'rgba(63, 63, 70, 0.5)',
};

function modelLabel(model: string) {
  if (model.includes('haiku')) return 'Haiku 4.5';
  if (model.includes('sonnet')) return 'Sonnet 4.6';
  return model;
}

function modelKey(model: string) {
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  return model;
}

/* ─── Count-up Hook ─── */

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ─── Sparkline (inline SVG) ─── */

function MiniSparkline({ data, width = 100, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.001);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  });
  const polyline = points.join(' ');
  const areaPath = `M ${points[0]} ${points.slice(1).map(p => `L ${p}`).join(' ')} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <polyline points={polyline} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Sparkle Icon ─── */

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20.5 10l-6.41 1.74L12 18l-2.09-6.26L3.5 10l6.41-1.74L12 2z" />
      <path d="M18 14l1.05 3.15L22.25 18.5l-3.2.85L18 22.5l-1.05-3.15L13.75 18.5l3.2-.85L18 14z" opacity={0.6} />
    </svg>
  );
}

/* ─── Main Component ─── */

export function AICostIndicator() {
  const { stats, isLoading } = useAIUsage();
  const { privacyMode } = useFormatters();
  const [open, setOpen] = useState(false);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (isLoading || !stats) return null;
  if (stats.allTime === 0 && stats.totalCalls === 0) return null;

  const todayCost = privacyMode ? '$***' : `$${stats.today.toFixed(2)}`;
  const trendUp = stats.yesterday > 0 ? stats.today > stats.yesterday : false;
  const trendDown = stats.yesterday > 0 ? stats.today < stats.yesterday : false;

  return (
    <>
      {/* Nav button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap shrink-0',
          'text-muted hover:text-foreground hover:bg-card/50',
          stats.today > 0 && 'shadow-[0_0_6px_rgba(16,185,129,0.15)]'
        )}
        title="AI usage & costs"
      >
        <SparkleIcon className={cn('w-3.5 h-3.5', stats.today > 0 && 'text-accent animate-pulse-slow')} />
        <span>AI: {todayCost}</span>
        {!privacyMode && stats.yesterday > 0 && (
          <span className={cn('text-[10px]', trendUp ? 'text-caution' : trendDown ? 'text-profit' : 'text-muted')}>
            {trendUp ? '\u25B2' : trendDown ? '\u25BC' : '\u2013'}
          </span>
        )}
      </button>

      {/* Slide-out panel — portaled to body to escape nav's backdrop-filter containing block */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-3xl max-h-[85vh] bg-card-solid border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col pointer-events-auto animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <SparkleIcon className="w-5 h-5 text-accent" />
                  <h2 className="text-base font-semibold text-foreground">AI Usage</h2>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground transition-colors p-1 rounded-lg hover:bg-card/50">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <HeroSection stats={stats} privacyMode={privacyMode} />
                <Divider />
                <DailyCostChart dailyCosts={stats.dailyCosts} privacyMode={privacyMode} />
                <Divider />
                <FeatureBreakdown byFeature={stats.byFeatureDetailed} privacyMode={privacyMode} />
                <Divider />
                <ModelSplit byModel={stats.byModel} privacyMode={privacyMode} />
                <Divider />
                <TokenEfficiency byFeature={stats.byFeatureDetailed} privacyMode={privacyMode} />
                <Divider />
                <RecentActivity recentCalls={stats.recentCalls} privacyMode={privacyMode} />
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

/* ─── Divider ─── */

function Divider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />;
}

/* ─── Section: Hero ─── */

function HeroSection({ stats, privacyMode }: { stats: { today: number; yesterday: number; thisWeek: number; thisMonth: number; allTime: number; avgDailyLast30: number; totalCalls: number; dailyCosts: DailyCostEntry[] }; privacyMode: boolean }) {
  const animatedToday = useCountUp(stats.today);
  const pctChange = stats.yesterday > 0 ? ((stats.today - stats.yesterday) / stats.yesterday) * 100 : null;
  const last7 = stats.dailyCosts.slice(-7).map(d => d.cost);

  return (
    <div className="space-y-4">
      {/* Today's cost hero */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Today&apos;s AI Spend</div>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {privacyMode ? '$***' : `$${animatedToday.toFixed(2)}`}
          </div>
          {!privacyMode && pctChange !== null && (
            <div className={cn('text-xs mt-1 flex items-center gap-1', pctChange > 0 ? 'text-caution' : 'text-profit')}>
              <span>{pctChange > 0 ? '\u25B2' : '\u25BC'}</span>
              <span>{Math.abs(pctChange).toFixed(0)}% vs yesterday</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <MiniSparkline data={last7} />
          <span className="text-[10px] text-muted">7-day trend</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Yesterday', value: stats.yesterday },
          { label: 'This Week', value: stats.thisWeek },
          { label: 'This Month', value: stats.thisMonth },
          { label: 'All Time', value: stats.allTime },
        ].map(({ label, value }) => (
          <div key={label} className="bg-background/30 rounded-lg p-2 text-center">
            <div className="text-[10px] text-muted">{label}</div>
            <div className="text-sm font-semibold text-foreground">
              {privacyMode ? '$***' : `$${value.toFixed(2)}`}
            </div>
          </div>
        ))}
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 text-xs text-muted">
        <span>{privacyMode ? '***' : stats.totalCalls.toLocaleString()} total calls</span>
        <span>\u00B7</span>
        <span>{privacyMode ? '$***' : `$${stats.avgDailyLast30.toFixed(2)}`}/day avg</span>
      </div>
    </div>
  );
}

/* ─── Section: Daily Cost Chart ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: { value: number }) => s + p.value, 0);
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-lg" style={{ backgroundColor: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}` }}>
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="text-foreground">${p.value.toFixed(3)}</span>
        </div>
      ))}
      <div className="border-t border-border/30 mt-1 pt-1 font-semibold text-foreground">Total: ${total.toFixed(3)}</div>
    </div>
  );
}

function DailyCostChart({ dailyCosts, privacyMode }: { dailyCosts: DailyCostEntry[]; privacyMode: boolean }) {
  // Collect all model keys across all days
  const allModels = useMemo(() => {
    const set = new Set<string>();
    dailyCosts.forEach(d => Object.keys(d.byModel).forEach(m => set.add(m)));
    return Array.from(set);
  }, [dailyCosts]);

  const chartData = useMemo(() =>
    dailyCosts.map(d => {
      const row: Record<string, string | number> = { date: d.date.slice(5) }; // "03-13"
      allModels.forEach(m => { row[modelLabel(m)] = d.byModel[m] || 0; });
      return row;
    }),
  [dailyCosts, allModels]);

  if (privacyMode) return <PrivacyOverlay label="Daily Costs" />;

  return (
    <div>
      <SectionHeader title="Daily Costs" subtitle="Last 30 days" />
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {allModels.map(m => (
                <linearGradient key={m} id={`grad-${modelKey(m)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={MODEL_COLORS[modelKey(m)] || '#71717a'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={MODEL_COLORS[modelKey(m)] || '#71717a'} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip content={<DailyTooltip />} />
            {allModels.map(m => (
              <Area
                key={m}
                type="monotone"
                dataKey={modelLabel(m)}
                stackId="1"
                stroke={MODEL_COLORS[modelKey(m)] || '#71717a'}
                fill={`url(#grad-${modelKey(m)})`}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Section: Feature Breakdown ─── */

function FeatureBreakdown({ byFeature, privacyMode }: {
  byFeature: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number; avgCostPerCall: number }>;
  privacyMode: boolean;
}) {
  const sorted = useMemo(() =>
    Object.entries(byFeature).sort((a, b) => b[1].cost - a[1].cost),
  [byFeature]);

  if (sorted.length === 0) return null;

  const chartData = sorted.map(([feature, data]) => ({
    name: FEATURE_LABELS[feature] || feature,
    cost: data.cost,
    calls: data.calls,
    color: FEATURE_COLORS[feature] || '#71717a',
  }));

  if (privacyMode) return <PrivacyOverlay label="Feature Breakdown" />;

  return (
    <div>
      <SectionHeader title="Feature Breakdown" subtitle={`${sorted.length} features`} />
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={sorted.length * 36 + 12}>
          <BarChart layout="vertical" data={chartData} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={90} tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-xl px-3 py-2 text-xs shadow-lg" style={{ backgroundColor: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}` }}>
                    <div className="font-semibold text-foreground">{d.name}</div>
                    <div className="text-muted">{d.calls} calls \u00B7 ${d.cost.toFixed(3)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="cost" radius={[0, 6, 6, 0]} barSize={18}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend with call counts */}
        <div className="space-y-1.5 mt-2">
          {sorted.map(([feature, data]) => (
            <div key={feature} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FEATURE_COLORS[feature] || '#71717a' }} />
                <span className="text-muted">{FEATURE_LABELS[feature] || feature}</span>
              </div>
              <span className="text-foreground tabular-nums">
                {data.calls} calls \u00B7 ${data.cost.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Section: Model Split ─── */

function ModelSplit({ byModel, privacyMode }: {
  byModel: Record<string, { calls: number; cost: number }>;
  privacyMode: boolean;
}) {
  const models = Object.entries(byModel);
  if (models.length === 0) return null;

  const totalCost = models.reduce((s, [, d]) => s + d.cost, 0);

  return (
    <div>
      <SectionHeader title="Model Split" subtitle={`${models.length} models`} />
      <div className="mt-3 space-y-3">
        {/* Segmented bar */}
        <div className="h-3 rounded-full overflow-hidden flex bg-background/30">
          {models.map(([model, data], i) => {
            const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={model}
                className="h-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: MODEL_COLORS[modelKey(model)] || '#71717a',
                  opacity: 0.85,
                  marginLeft: i > 0 ? 2 : 0,
                }}
              />
            );
          })}
        </div>

        {/* Model details */}
        <div className="grid grid-cols-2 gap-2">
          {models.map(([model, data]) => {
            const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
            return (
              <div key={model} className="bg-background/30 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[modelKey(model)] || '#71717a' }} />
                  <span className="text-xs font-medium text-foreground">{modelLabel(model)}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {privacyMode ? '$***' : `$${data.cost.toFixed(2)}`}
                </div>
                <div className="text-[10px] text-muted">
                  {data.calls} calls \u00B7 {privacyMode ? '**' : `${pct.toFixed(0)}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Section: Token Efficiency ─── */

function TokenEfficiency({ byFeature, privacyMode }: {
  byFeature: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number; avgCostPerCall: number }>;
  privacyMode: boolean;
}) {
  const totals = useMemo(() => {
    let input = 0, output = 0;
    Object.values(byFeature).forEach(d => { input += d.inputTokens; output += d.outputTokens; });
    return { input, output, total: input + output };
  }, [byFeature]);

  const sorted = useMemo(() =>
    Object.entries(byFeature).sort((a, b) => b[1].avgCostPerCall - a[1].avgCostPerCall),
  [byFeature]);

  if (totals.total === 0) return null;

  const inputPct = (totals.input / totals.total) * 100;

  return (
    <div>
      <SectionHeader title="Token Efficiency" />
      <div className="mt-3 space-y-3">
        {/* Input/Output bar */}
        <div>
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>Input ({privacyMode ? '***' : inputPct.toFixed(0) + '%'})</span>
            <span>Output ({privacyMode ? '***' : (100 - inputPct).toFixed(0) + '%'})</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-background/30">
            <div className="h-full bg-accent/60 transition-all duration-700" style={{ width: `${inputPct}%` }} />
            <div className="h-full bg-accent/25 transition-all duration-700" style={{ width: `${100 - inputPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>{privacyMode ? '***' : totals.input.toLocaleString()} tokens</span>
            <span>{privacyMode ? '***' : totals.output.toLocaleString()} tokens</span>
          </div>
        </div>

        {/* Avg cost per call by feature */}
        <div>
          <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Avg Cost per Call</div>
          <div className="space-y-1">
            {sorted.slice(0, 6).map(([feature, data]) => (
              <div key={feature} className="flex items-center justify-between text-xs">
                <span className="text-muted">{FEATURE_LABELS[feature] || feature}</span>
                <span className="text-foreground tabular-nums">
                  {privacyMode ? '$***' : `$${data.avgCostPerCall.toFixed(4)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section: Recent Activity ─── */

function RecentActivity({ recentCalls, privacyMode }: {
  recentCalls: { timestamp: string; feature: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; ticker?: string }[];
  privacyMode: boolean;
}) {
  if (recentCalls.length === 0) return null;

  return (
    <div>
      <SectionHeader title="Recent Activity" subtitle={`Last ${recentCalls.length} calls`} />
      <div className="mt-3 max-h-[260px] overflow-y-auto space-y-0.5 -mx-1 px-1">
        {recentCalls.map((call, i) => {
          let timeAgo: string;
          try {
            timeAgo = formatDistanceToNow(new Date(call.timestamp), { addSuffix: true });
          } catch {
            timeAgo = call.timestamp.slice(11, 16);
          }

          return (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between py-1.5 px-2 rounded-lg text-xs',
                i % 2 === 0 && 'bg-background/20'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FEATURE_COLORS[call.feature] || '#71717a' }} />
                <span className="text-muted truncate">{FEATURE_LABELS[call.feature] || call.feature}</span>
                {call.ticker && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium shrink-0">
                    {call.ticker}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-foreground tabular-nums">
                  {privacyMode ? '$***' : `$${call.costUsd.toFixed(4)}`}
                </span>
                <span className="text-muted text-[10px] w-20 text-right">{timeAgo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shared UI ─── */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {subtitle && <span className="text-[10px] text-muted">{subtitle}</span>}
    </div>
  );
}

function PrivacyOverlay({ label }: { label: string }) {
  return (
    <div>
      <SectionHeader title={label} />
      <div className="mt-3 flex items-center justify-center py-8 text-muted text-xs gap-2">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M1 1l22 22" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Hidden in privacy mode</span>
      </div>
    </div>
  );
}
