'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Line,
  ComposedChart,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ZAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = {
  profit: '#10b981',
  loss: '#ef4444',
  accent: '#10b981',
  grid: 'rgba(63, 63, 70, 0.3)',
  text: '#71717a',
  tooltipBg: 'rgba(24, 24, 27, 0.95)',
  tooltipBorder: 'rgba(63, 63, 70, 0.5)',
  tooltipText: '#fafafa',
  csp: '#10b981',
  cc: '#3b82f6',
  directional: '#f59e0b',
  spreads: '#a855f7',
  cash: '#3f3f46',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: COLORS.tooltipBg,
    border: `1px solid ${COLORS.tooltipBorder}`,
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  labelStyle: { color: COLORS.tooltipText, fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: COLORS.tooltipText },
};

// ─── P/L by Ticker ───

interface PLByTickerData { ticker: string; pl: number }

export function PLByTickerChart({ data }: { data: PLByTickerData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="ticker" tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(0)}`, 'P/L']} />
        <Bar dataKey="pl" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pl >= 0 ? COLORS.profit : COLORS.loss} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Monthly P/L ───

interface MonthlyPLData { month: string; pl: number }

export function MonthlyPLChart({ data }: { data: MonthlyPLData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(0)}`, 'P/L']} />
        <Bar dataKey="pl" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pl >= 0 ? COLORS.profit : COLORS.loss} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Trade Frequency (Area + dots) ───

interface TradeFrequencyData { month: string; count: number }

export function TradeFrequencyChart({ data }: { data: TradeFrequencyData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  const avg = data.reduce((s, d) => s + d.count, 0) / data.length;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="freqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [Number(v), 'Trades']} />
        <Area
          type="monotone"
          dataKey={() => avg}
          stroke="rgba(113, 113, 122, 0.4)"
          strokeDasharray="6 4"
          fill="none"
          dot={false}
          activeDot={false}
          legendType="none"
          tooltipType="none"
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={COLORS.accent}
          fill="url(#freqGrad)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.accent, stroke: '#09090b', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: COLORS.accent, stroke: '#09090b', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Cumulative P/L ───

interface CumulativePLData { date: string; total: number; trade: string }

export function CumulativePLChart({ data }: { data: CumulativePLData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: any) => [`$${Number(v).toFixed(0)}`, 'Total P/L']}
          labelFormatter={(label: any, payload: any) => {
            const trade = payload?.[0]?.payload?.trade;
            return trade ? `${label} — ${trade}` : String(label);
          }}
        />
        <Area type="monotone" dataKey="total" stroke={COLORS.accent} fill="url(#cumGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Cumulative P/L with Drawdown Overlay ───

interface CumulativeWithDrawdownData {
  date: string;
  total: number;
  drawdown: number;
  trade: string;
}

export function CumulativePLWithDrawdownChart({ data }: { data: CumulativeWithDrawdownData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  const hasDrawdown = data.some((d) => d.drawdown < 0);
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cumGradOverlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="ddGradOverlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.loss} stopOpacity={0.3} />
            <stop offset="100%" stopColor={COLORS.loss} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload;
            if (!row) return null;
            return (
              <div
                className="rounded-xl px-4 py-3 shadow-xl border"
                style={{ backgroundColor: 'rgba(24,24,27,0.95)', borderColor: 'rgba(63,63,70,0.5)' }}
              >
                <div className="text-zinc-300 font-semibold text-sm mb-1.5">
                  {label}{row.trade ? ` — ${row.trade}` : ''}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400 text-xs">Cumulative</span>
                    <span className={cn('text-xs font-bold', row.total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      ${row.total.toFixed(0)}
                    </span>
                  </div>
                  {row.drawdown < 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400 text-xs">Drawdown</span>
                      <span className="text-xs font-bold text-red-400">${row.drawdown.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        />
        <ReferenceLine y={0} stroke="rgba(113, 113, 122, 0.3)" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="total" stroke={COLORS.accent} fill="url(#cumGradOverlay)" strokeWidth={2.5} dot={false} />
        {hasDrawdown && (
          <Area type="monotone" dataKey="drawdown" stroke={COLORS.loss} fill="url(#ddGradOverlay)" strokeWidth={1.5} strokeOpacity={0.6} dot={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Strategy Allocation Donut ───

interface AllocationData { name: string; value: number; color: string }

export function StrategyDonutChart({ data, centerLabel }: { data: AllocationData[]; centerLabel?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="h-64 flex items-center justify-center text-muted">No allocations</div>;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data as any}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(v: any, name: any) => {
              const pct = ((Number(v) / total) * 100).toFixed(1);
              return [`$${Number(v).toLocaleString()} (${pct}%)`, String(name)];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">${(total / 1000).toFixed(1)}k</div>
            <div className="text-xs text-muted">{centerLabel}</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Win Rate Rings (full row component) ───

interface WinRateData {
  label: string;
  rate: number;
  color: string;
  count?: string;
}

export function WinRateRing({ rate, label, color }: { rate: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const filled = (rate / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(63, 63, 70, 0.3)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{rate.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-muted font-medium">{label}</span>
    </div>
  );
}

export function WinRateRow({ rates }: { rates: WinRateData[] }) {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${rates.length}, 1fr)` }}>
      {rates.map((r) => {
        const circumference = 2 * Math.PI * 40;
        const filled = (r.rate / 100) * circumference;
        return (
          <div key={r.label} className="flex flex-col items-center gap-2 py-2">
            <div className="relative w-[100px] h-[100px]">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(63, 63, 70, 0.25)" strokeWidth="7" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={r.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${circumference}`}
                  style={{ filter: `drop-shadow(0 0 6px ${r.color}40)` }}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground">{r.rate.toFixed(0)}%</span>
              </div>
            </div>
            <span className="text-sm text-muted font-medium">{r.label}</span>
            {r.count && <span className="text-xs text-muted/60">{r.count}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Drawdown Chart ───

interface DrawdownData { date: string; drawdown: number }

export function DrawdownChart({ data }: { data: DrawdownData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.loss} stopOpacity={0.4} />
            <stop offset="100%" stopColor={COLORS.loss} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(0)}`, 'Drawdown']} />
        <Area type="monotone" dataKey="drawdown" stroke={COLORS.loss} fill="url(#ddGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── P/L Heatmap Calendar ───

interface HeatmapDay {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  pl: number;
}

interface HeatmapTooltipState { x: number; y: number; date: string; pl: number }

function HeatmapTooltip({ tooltip }: { tooltip: HeatmapTooltipState | null }) {
  if (!tooltip) return null;
  const d = new Date(tooltip.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const plStr = tooltip.pl === 0 ? 'No trades' : `${tooltip.pl >= 0 ? '+' : ''}$${tooltip.pl.toFixed(0)}`;
  return (
    <div
      className="fixed z-50 pointer-events-none px-3 py-2 rounded-xl text-xs shadow-xl border"
      style={{
        left: tooltip.x,
        top: tooltip.y - 50,
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        borderColor: 'rgba(63, 63, 70, 0.5)',
        transform: 'translateX(-50%)',
      }}
    >
      <div className="text-zinc-400 font-medium">{dateStr}</div>
      <div className={cn('font-bold', tooltip.pl > 0 ? 'text-emerald-400' : tooltip.pl < 0 ? 'text-red-400' : 'text-zinc-500')}>
        {plStr}
      </div>
    </div>
  );
}

export function PLHeatmapCalendar({ trades }: { trades: { exitDate: string; pl: number }[] }) {
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null);

  const { weeks, maxAbsPL, monthLabels, totalDays, totalProfit, totalLoss } = useMemo(() => {
    const plByDate = new Map<string, number>();
    trades.forEach((t) => {
      if (!t.exitDate) return;
      const dateKey = t.exitDate.slice(0, 10);
      plByDate.set(dateKey, (plByDate.get(dateKey) || 0) + t.pl);
    });
    if (plByDate.size === 0) return { weeks: [] as HeatmapDay[][], maxAbsPL: 0, monthLabels: [] as { weekIndex: number; label: string }[], totalDays: 0, totalProfit: 0, totalLoss: 0 };

    const sortedDates = Array.from(plByDate.keys()).sort();
    const startDate = new Date(sortedDates[0] + 'T12:00:00');
    const endDate = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00');
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days: HeatmapDay[] = [];
    let maxAbs = 0;
    let profitDays = 0;
    let lossDays = 0;
    const current = new Date(startDate);
    const months: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;

    while (current <= endDate || current.getDay() !== 0) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const pl = plByDate.get(dateStr) || 0;
      if (Math.abs(pl) > maxAbs) maxAbs = Math.abs(pl);
      if (pl > 0) profitDays++;
      if (pl < 0) lossDays++;
      const weekIdx = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (current.getMonth() !== lastMonth) {
        lastMonth = current.getMonth();
        months.push({ weekIndex: weekIdx, label: current.toLocaleDateString('en-US', { month: 'short' }) });
      }
      days.push({ date: dateStr, dayOfWeek: current.getDay(), weekIndex: weekIdx, pl });
      current.setDate(current.getDate() + 1);
      if (days.length > 365) break;
    }

    const weekMap = new Map<number, HeatmapDay[]>();
    days.forEach((d) => {
      if (!weekMap.has(d.weekIndex)) weekMap.set(d.weekIndex, []);
      weekMap.get(d.weekIndex)!.push(d);
    });
    return { weeks: Array.from(weekMap.values()), maxAbsPL: maxAbs, monthLabels: months, totalDays: plByDate.size, totalProfit: profitDays, totalLoss: lossDays };
  }, [trades]);

  if (weeks.length === 0) return <div className="h-32 flex items-center justify-center text-muted">No trade data for heatmap</div>;

  const totalWeeksCount = weeks.length;
  const CELL = Math.max(20, Math.min(36, Math.floor(800 / (totalWeeksCount + 2))));
  const GAP = Math.max(2, Math.min(4, Math.floor(CELL / 6)));

  const getColor = (pl: number) => {
    if (pl === 0) return 'rgba(63, 63, 70, 0.15)';
    const intensity = Math.min(Math.abs(pl) / (maxAbsPL || 1), 1);
    const alpha = 0.15 + intensity * 0.75;
    return pl > 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/60" />
          <span className="text-muted">{totalProfit} profit day{totalProfit !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/60" />
          <span className="text-muted">{totalLoss} loss day{totalLoss !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-muted">{totalDays} trading days</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ paddingLeft: 44 }}>
          <div className="flex" style={{ gap: GAP }}>
            {Array.from({ length: totalWeeksCount }, (_, wi) => {
              const ml = monthLabels.find((m) => m.weekIndex === wi);
              return (
                <div key={wi} style={{ width: CELL, flexShrink: 0 }} className="text-center">
                  {ml && <span className="text-[11px] text-muted font-medium">{ml.label}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex mt-1">
          <div className="flex flex-col mr-2" style={{ gap: GAP }}>
            {dayLabels.map((label, i) => (
              <div key={i} className="flex items-center justify-end pr-1" style={{ height: CELL }}>
                <span className="text-[10px] text-muted/60">{i % 2 === 1 ? label : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                {Array.from({ length: 7 }, (_, di) => {
                  const day = week.find((d) => d.dayOfWeek === di);
                  return (
                    <div
                      key={di}
                      className="rounded-[4px] transition-all duration-150 cursor-default hover:ring-1 hover:ring-white/20"
                      style={{
                        width: CELL,
                        height: CELL,
                        backgroundColor: day ? getColor(day.pl) : 'transparent',
                        boxShadow: day && day.pl !== 0
                          ? `0 0 ${Math.abs(day.pl) > maxAbsPL * 0.5 ? '8' : '4'}px ${day.pl > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
                          : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (day) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ x: rect.left + rect.width / 2, y: rect.top, date: day.date, pl: day.pl });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>Loss</span>
          <div className="flex gap-1">
            {['rgba(239,68,68,0.7)', 'rgba(239,68,68,0.35)', 'rgba(63,63,70,0.15)', 'rgba(16,185,129,0.35)', 'rgba(16,185,129,0.7)'].map((bg, i) => (
              <div key={i} className="rounded-[3px]" style={{ width: 16, height: 16, backgroundColor: bg }} />
            ))}
          </div>
          <span>Profit</span>
        </div>
        <span className="text-[11px] text-muted/60">Peak: ${maxAbsPL.toFixed(0)}</span>
      </div>

      <HeatmapTooltip tooltip={tooltip} />
    </div>
  );
}

// ─── Expiration Timeline ───

interface TimelineItem {
  ticker: string;
  expiration: string;
  dte: number;
  type: 'csp' | 'cc' | 'directional' | 'spread';
  label: string;
}

const URGENCY_ZONES = [
  { key: 'critical', label: 'This Week', sublabel: '≤ 7 days', min: 0, max: 7, dotColor: 'bg-loss', borderColor: 'border-loss/30', glowColor: 'shadow-[0_0_15px_rgba(239,68,68,0.1)]' },
  { key: 'caution', label: 'Next 2 Weeks', sublabel: '8–21 days', min: 8, max: 21, dotColor: 'bg-caution', borderColor: 'border-caution/20', glowColor: '' },
  { key: 'safe', label: '3–4 Weeks', sublabel: '22–30 days', min: 22, max: 30, dotColor: 'bg-accent', borderColor: 'border-border/20', glowColor: '' },
  { key: 'distant', label: '30+ Days', sublabel: 'Far out', min: 31, max: Infinity, dotColor: 'bg-zinc-500', borderColor: 'border-border/10', glowColor: '' },
];

const typeColors: Record<string, string> = { csp: COLORS.csp, cc: COLORS.cc, directional: COLORS.directional, spread: COLORS.spreads };
const typeLabels: Record<string, string> = { csp: 'CSP', cc: 'CC', directional: 'DIR', spread: 'SPREAD' };

export function ExpirationTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <div className="py-6 text-center text-muted text-sm">No open positions</div>;

  const sorted = [...items].sort((a, b) => a.dte - b.dte);

  const zones = URGENCY_ZONES
    .map((zone) => ({
      ...zone,
      items: sorted.filter((item) => item.dte >= zone.min && item.dte <= zone.max),
    }))
    .filter((zone) => zone.items.length > 0);

  const soonestDTE = sorted[0]?.dte ?? 0;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">{sorted.length} positions</span>
        </div>
        <div className="h-3 w-px bg-border/30" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted">Next expiry:</span>
          <span className={cn('font-bold', soonestDTE <= 7 ? 'text-loss' : soonestDTE <= 21 ? 'text-caution' : 'text-accent')}>
            {soonestDTE}d
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {Object.entries({ CSP: COLORS.csp, CC: COLORS.cc, Dir: COLORS.directional, Spread: COLORS.spreads }).map(
            ([label, color]) => (
              <div key={label} className="flex items-center gap-1 text-[11px] text-muted">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </div>
            )
          )}
        </div>
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
            {zone.items.map((item, i) => {
              const isUrgent = item.dte <= 7;
              const isCaution = item.dte > 7 && item.dte <= 21;
              return (
                <div
                  key={`${item.ticker}-${item.label}-${i}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                    zone.borderColor,
                    zone.glowColor,
                    'bg-card-solid/20 hover:bg-card-solid/40',
                  )}
                >
                  {/* Strategy color bar */}
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: typeColors[item.type] || COLORS.accent }} />

                  {/* Ticker + details */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{item.ticker}</span>
                    <span className="text-sm text-muted">{item.label}</span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${typeColors[item.type]}15`, color: typeColors[item.type] }}
                    >
                      {typeLabels[item.type]}
                    </span>
                  </div>

                  {/* Expiration date */}
                  <span className="text-xs text-muted flex-shrink-0">{item.expiration}</span>

                  {/* DTE countdown */}
                  <div className={cn(
                    'flex-shrink-0 min-w-[48px] text-center px-2 py-1 rounded-lg text-sm font-bold',
                    isUrgent ? 'bg-loss/10 text-loss' : isCaution ? 'bg-caution/10 text-caution' : 'text-muted'
                  )}>
                    {item.dte}d
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Payoff Diagram ───

export function PayoffDiagram({
  longStrike, shortStrike, netDebit, maxProfit, maxLoss, spreadType,
}: {
  longStrike: number; shortStrike: number; netDebit: number; maxProfit: number; maxLoss: number; spreadType: string;
}) {
  const data = useMemo(() => {
    const low = Math.min(longStrike, shortStrike);
    const high = Math.max(longStrike, shortStrike);
    const range = high - low;
    const padding = range * 1.5;
    const step = range / 20;
    const points: { price: number; pnl: number }[] = [];
    for (let price = low - padding; price <= high + padding; price += step) {
      let pnl: number;
      if (spreadType === 'call_debit') {
        pnl = (Math.max(0, price - longStrike) - Math.max(0, price - shortStrike)) * 100 - netDebit;
      } else if (spreadType === 'call_credit') {
        pnl = (Math.max(0, price - longStrike) - Math.max(0, price - shortStrike)) * 100 + Math.abs(netDebit);
      } else if (spreadType === 'put_debit') {
        pnl = (Math.max(0, longStrike - price) - Math.max(0, shortStrike - price)) * 100 - netDebit;
      } else {
        pnl = (Math.max(0, longStrike - price) - Math.max(0, shortStrike - price)) * 100 + Math.abs(netDebit);
      }
      points.push({ price: Math.round(price * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
    }
    return points;
  }, [longStrike, shortStrike, netDebit, spreadType]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="payoffGradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.profit} stopOpacity={0.3} />
            <stop offset="100%" stopColor={COLORS.profit} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="price" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip {...tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(0)}`, 'P/L']} labelFormatter={(l: any) => `Price: $${l}`} />
        <Area type="monotone" dataKey="pnl" stroke={COLORS.accent} strokeWidth={2} fill="url(#payoffGradProfit)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Monthly P/L by Strategy ───

interface MonthlyStackedData { month: string; csp: number; cc: number; directional: number; spreads: number }

const STRATEGY_META = [
  { key: 'csp', label: 'CSPs', color: COLORS.csp },
  { key: 'cc', label: 'Covered Calls', color: COLORS.cc },
  { key: 'directional', label: 'Directional', color: COLORS.directional },
  { key: 'spreads', label: 'Spreads', color: COLORS.spreads },
];

function StrategyTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const total = (row.csp || 0) + (row.cc || 0) + (row.directional || 0) + (row.spreads || 0);
  const strategies = STRATEGY_META.filter((s) => (row[s.key] || 0) !== 0);

  return (
    <div className="rounded-xl px-4 py-3 shadow-xl border min-w-[180px]" style={{ backgroundColor: 'rgba(24, 24, 27, 0.95)', borderColor: 'rgba(63, 63, 70, 0.5)' }}>
      <div className="text-zinc-300 font-semibold text-sm mb-2">{label}</div>
      <div className="space-y-1.5">
        {strategies.map((s) => {
          const val = row[s.key] || 0;
          return (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-zinc-400 text-xs">{s.label}</span>
              </div>
              <span className={cn('text-xs font-semibold', val >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {val >= 0 ? '+' : ''}${val.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center justify-between">
        <span className="text-zinc-400 text-xs font-medium">Total</span>
        <span className={cn('text-sm font-bold', total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {total >= 0 ? '+' : ''}${total.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

export function MonthlyStackedChart({ data }: { data: MonthlyStackedData[] }) {
  const [activeStrategy, setActiveStrategy] = useState<string | null>(null);
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;

  const enriched = data.map((d) => ({ ...d, total: d.csp + d.cc + d.directional + d.spreads }));
  const activeStrategies = STRATEGY_META.filter((s) => data.some((d) => (d[s.key as keyof MonthlyStackedData] as number) !== 0));
  const grandTotal = enriched.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveStrategy(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
            activeStrategy === null ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border/50 text-muted hover:text-foreground'
          )}
        >
          All
        </button>
        {activeStrategies.map((s) => {
          const isActive = activeStrategy === s.key;
          const stratTotal = data.reduce((sum, d) => sum + (d[s.key as keyof MonthlyStackedData] as number), 0);
          return (
            <button
              key={s.key}
              onClick={() => setActiveStrategy(isActive ? null : s.key)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                isActive ? 'border-border bg-card-solid' : 'border-border/30 text-muted hover:text-foreground hover:border-border'
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color, opacity: isActive || activeStrategy === null ? 1 : 0.3 }} />
              <span>{s.label}</span>
              <span className={cn('font-bold', stratTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {stratTotal >= 0 ? '+' : ''}${stratTotal.toFixed(0)}
              </span>
            </button>
          );
        })}
        <div className="ml-auto">
          <span className={cn('text-sm font-bold', grandTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            Total: {grandTotal >= 0 ? '+' : ''}${grandTotal.toFixed(0)}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={enriched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip content={<StrategyTooltipContent />} />
          {activeStrategies.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={s.color}
              fillOpacity={activeStrategy === null || activeStrategy === s.key ? 0.85 : 0.08}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          ))}
          <Line
            type="monotone"
            dataKey="total"
            stroke="rgba(250, 250, 250, 0.4)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 3, fill: 'rgba(250,250,250,0.5)', stroke: 'none' }}
            activeDot={{ r: 5, fill: '#fafafa', stroke: COLORS.accent, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {enriched.map((d) => (
          <div key={d.month} className={cn('flex-shrink-0 px-3 py-1.5 rounded-lg text-center min-w-[64px] border', d.total >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10')}>
            <div className="text-[10px] text-muted font-medium">{d.month.split(' ')[0]}</div>
            <div className={cn('text-xs font-bold', d.total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {d.total >= 0 ? '+' : ''}${d.total.toFixed(0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── P/L Distribution (Horizontal Butterfly) ───

interface PLDistributionData { range: string; count: number; isProfit: boolean }

export function PLDistributionChart({ data }: { data: PLDistributionData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;
  const maxCount = Math.max(...data.map((d) => d.count));
  const totalTrades = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-2.5">
      {data.map((bucket) => {
        const pct = (bucket.count / maxCount) * 100;
        const tradePct = ((bucket.count / totalTrades) * 100).toFixed(0);
        return (
          <div key={bucket.range} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                'text-xs font-medium',
                bucket.isProfit ? 'text-profit/80' : 'text-loss/80'
              )}>
                {bucket.range}
              </span>
              <span className="text-[11px] text-muted">
                {bucket.count} trade{bucket.count !== 1 ? 's' : ''} ({tradePct}%)
              </span>
            </div>
            <div className="h-3 rounded-full bg-zinc-800/40 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  bucket.isProfit
                    ? 'bg-gradient-to-r from-profit/50 to-profit/80'
                    : 'bg-gradient-to-r from-loss/50 to-loss/80',
                )}
                style={{ width: `${Math.max(pct, 3)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Days Held vs P/L Scatter ───

interface ScatterData { daysHeld: number; pl: number; ticker: string; type: string }

const scatterTypeColors: Record<string, string> = {
  csp: COLORS.csp,
  cc: COLORS.cc,
  directional: COLORS.directional,
  spread: COLORS.spreads,
};

function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 shadow-xl border"
      style={{ backgroundColor: 'rgba(24,24,27,0.95)', borderColor: 'rgba(63,63,70,0.5)' }}
    >
      <div className="text-zinc-300 font-semibold text-sm">{d.ticker}</div>
      <div className="space-y-0.5 mt-1">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-zinc-400">P/L</span>
          <span className={cn('font-bold', d.pl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {d.pl >= 0 ? '+' : ''}${d.pl.toFixed(0)}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-zinc-400">Days Held</span>
          <span className="text-zinc-300 font-medium">{d.daysHeld}</span>
        </div>
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-zinc-400">Type</span>
          <span className="text-zinc-300 font-medium capitalize">{d.type}</span>
        </div>
      </div>
    </div>
  );
}

export function DaysHeldScatterChart({ data }: { data: ScatterData[] }) {
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-muted">No data</div>;

  const types = [...new Set(data.map((d) => d.type))];

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            type="number"
            dataKey="daysHeld"
            name="Days Held"
            tick={{ fill: COLORS.text, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Days Held', position: 'insideBottom', offset: -5, fill: COLORS.text, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="pl"
            name="P/L"
            tick={{ fill: COLORS.text, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <ZAxis range={[40, 200]} />
          <Tooltip content={<ScatterTooltipContent />} />
          <ReferenceLine y={0} stroke="rgba(113, 113, 122, 0.4)" strokeDasharray="4 4" />
          {types.map((type) => (
            <Scatter
              key={type}
              name={type}
              data={data.filter((d) => d.type === type)}
              fill={scatterTypeColors[type] || COLORS.accent}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4">
        {types.map((type) => (
          <div key={type} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scatterTypeColors[type] || COLORS.accent }} />
            <span className="text-muted capitalize">{type === 'csp' ? 'CSP' : type === 'cc' ? 'CC' : type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Win/Loss Streak Bar ───

interface StreakData {
  currentStreak: number;
  currentStreakType: 'win' | 'loss' | 'none';
  longestWinStreak: number;
  longestLossStreak: number;
}

export function WinLossStreakBar({ data }: { data: StreakData }) {
  const maxStreak = Math.max(data.longestWinStreak, data.longestLossStreak, 1);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className={cn(
          'text-3xl font-bold',
          data.currentStreakType === 'win' ? 'text-profit' : data.currentStreakType === 'loss' ? 'text-loss' : 'text-muted'
        )}>
          {data.currentStreak}
        </div>
        <div className="text-xs text-muted mt-0.5">
          Current {data.currentStreakType === 'none' ? '' : data.currentStreakType} streak
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted">Best Win Streak</span>
            <span className="text-xs font-bold text-profit">{data.longestWinStreak}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-profit/70 transition-all duration-700"
              style={{ width: `${(data.longestWinStreak / maxStreak) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted">Worst Loss Streak</span>
            <span className="text-xs font-bold text-loss">{data.longestLossStreak}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-loss/70 transition-all duration-700"
              style={{ width: `${(data.longestLossStreak / maxStreak) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rolling 30-day Sparkline ───

interface RollingPLData { date: string; total: number }

export function RollingPLSparkline({ data, value }: { data: RollingPLData[]; value: number }) {
  if (data.length === 0) return null;
  const isPositive = value >= 0;
  const color = isPositive ? COLORS.profit : COLORS.loss;

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="total" stroke={color} fill="url(#sparkGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Hold Time Analyzer ───

interface HoldTimeAnalyzerProps {
  strategies: {
    label: string;
    color: string;
    min: number;
    avg: number;
    max: number;
    count: number;
  }[];
  buckets: {
    label: string;
    range: string;
    trades: number;
    winRate: number;
    avgPL: number;
  }[];
}

export function HoldTimeAnalyzer({ strategies, buckets }: HoldTimeAnalyzerProps) {
  const globalMax = Math.max(...strategies.map((s) => s.max), 1);

  return (
    <div className="space-y-8">
      {/* Strategy Range Bars */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-4">Hold Time by Strategy</h4>
        <div className="space-y-5">
          {strategies.map((s) => {
            const minPct = (s.min / globalMax) * 100;
            const avgPct = (s.avg / globalMax) * 100;
            const maxPct = (s.max / globalMax) * 100;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-foreground font-medium">{s.label}</span>
                  </div>
                  <span className="text-xs text-muted">{s.count} trades</span>
                </div>
                <div className="relative h-3 rounded-full bg-zinc-800/40">
                  {/* Range line from min to max */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
                    style={{
                      left: `${minPct}%`,
                      width: `${Math.max(maxPct - minPct, 1)}%`,
                      backgroundColor: s.color,
                      opacity: 0.3,
                    }}
                  />
                  {/* Min marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm"
                    style={{ left: `${minPct}%`, backgroundColor: s.color, opacity: 0.5 }}
                  />
                  {/* Max marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-sm"
                    style={{ left: `${Math.min(maxPct, 99)}%`, backgroundColor: s.color, opacity: 0.5 }}
                  />
                  {/* Average dot */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-zinc-900"
                    style={{
                      left: `${avgPct}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: s.color,
                      boxShadow: `0 0 8px ${s.color}60`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-muted">{s.min}d min</span>
                  <span className="text-[11px] font-medium" style={{ color: s.color }}>{s.avg.toFixed(0)}d avg</span>
                  <span className="text-[11px] text-muted">{s.max}d max</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sweet Spot Buckets */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-4">Sweet Spot by Hold Duration</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {buckets.map((b) => {
            const isGood = b.avgPL > 0;
            const isBest = b.avgPL === Math.max(...buckets.filter((x) => x.trades > 0).map((x) => x.avgPL));
            return (
              <div
                key={b.label}
                className={cn(
                  'rounded-xl p-4 border text-center transition-all',
                  isBest
                    ? 'border-profit/30 bg-profit/5 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                    : 'border-border/30 bg-card-solid/20',
                )}
              >
                {isBest && (
                  <div className="text-[10px] font-bold text-profit uppercase tracking-wider mb-2">Sweet Spot</div>
                )}
                <div className="text-sm font-semibold text-foreground">{b.label}</div>
                <div className="text-[11px] text-muted mb-3">{b.range}</div>
                <div className={cn('text-xl font-bold', isGood ? 'text-profit' : b.avgPL < 0 ? 'text-loss' : 'text-muted')}>
                  {b.avgPL >= 0 ? '+' : ''}${b.avgPL.toFixed(0)}
                </div>
                <div className="text-[11px] text-muted mt-0.5">avg P/L</div>
                <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-foreground">{b.winRate.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted">win rate</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{b.trades}</div>
                    <div className="text-[10px] text-muted">trades</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
