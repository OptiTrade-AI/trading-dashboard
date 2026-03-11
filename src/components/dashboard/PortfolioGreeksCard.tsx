'use client';

import { useState, useEffect } from 'react';
import { formatCurrency as rawFormatCurrency, cn } from '@/lib/utils';
import { OpenPosition } from './PositionsTimeline';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ReferenceLine,
} from 'recharts';

interface PortfolioGreeksCardProps {
  positions: OpenPosition[];
  privacyMode: boolean;
  fetchedAt: string | null;
}

/* ── SVG helpers ── */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y}`;
}

/* ── Risk scoring ── */
function computeRiskLevel(
  netDelta: number,
  totalGamma: number,
  avgIV: number | null,
  dailyTheta: number,
) {
  let score = 0;
  if (Math.abs(netDelta) > 3) score += 2;
  else if (Math.abs(netDelta) > 1.5) score += 1;
  if (Math.abs(totalGamma) > 0.05) score += 1;
  if (avgIV !== null && avgIV > 0.5) score += 1;
  if (dailyTheta < -100) score += 1;

  if (score >= 4)
    return { label: 'High Risk', color: 'text-loss', bg: 'bg-loss/10', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]' };
  if (score >= 2)
    return { label: 'Moderate', color: 'text-caution', bg: 'bg-caution/10', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' };
  return { label: 'Low Risk', color: 'text-profit', bg: 'bg-profit/10', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' };
}

/* ── Info icon ── */
function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span
      title={tooltip}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-zinc-700/50 text-[9px] text-zinc-400 cursor-help ml-1 hover:bg-zinc-600/50 transition-colors"
    >
      ?
    </span>
  );
}

/* ── Delta Gauge ── */
function DeltaGauge({ value, privacyMode }: { value: number; privacyMode: boolean }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  const cx = 60, cy = 55, r = 42;
  const minVal = -5, maxVal = 5;
  const clamped = Math.max(minVal, Math.min(maxVal, value));
  const pct = (clamped - minVal) / (maxVal - minVal); // 0..1

  const bgArc = describeArc(cx, cy, r, 0, 180);
  const arcLength = Math.PI * r; // semicircle length
  const dashOffset = animated ? arcLength * (1 - pct) : arcLength;

  const needlePos = polarToCartesian(cx, cy, r, 180 - pct * 180);
  const biasLabel = value > 0.1 ? 'Bullish' : value < -0.1 ? 'Bearish' : 'Neutral';
  const biasColor = Math.abs(value) > 2 ? '#f59e0b' : value > 0.1 ? '#10b981' : value < -0.1 ? '#ef4444' : '#71717a';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 68" className="w-full max-w-[180px]">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="needleGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={biasColor} floodOpacity="0.6" />
          </filter>
        </defs>
        {/* background arc */}
        <path d={bgArc} fill="none" stroke="#27272a" strokeWidth="6" strokeLinecap="round" />
        {/* value arc */}
        <path
          d={describeArc(cx, cy, r, 0, 180)}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        {/* needle dot */}
        {animated && (
          <circle
            cx={needlePos.x}
            cy={needlePos.y}
            r="4"
            fill={biasColor}
            filter="url(#needleGlow)"
            style={{ transition: 'cx 1s ease-out, cy 1s ease-out' }}
          />
        )}
        {/* center value */}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground text-[14px] font-bold">
          {privacyMode ? '***' : value.toFixed(2)}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-muted text-[8px]">
          {biasLabel}
        </text>
        {/* end labels */}
        <text x="8" y={cy + 14} className="fill-zinc-500 text-[7px]">−5</text>
        <text x="104" y={cy + 14} className="fill-zinc-500 text-[7px]" textAnchor="end">+5</text>
      </svg>
    </div>
  );
}

/* ── Magnitude bar ── */
function MagnitudeBar({ pct, color }: { pct: number; color: string }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-1 w-full bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
      <div
        className={cn('h-full rounded-full', color)}
        style={{
          width: animated ? `${Math.min(pct, 100)}%` : '0%',
          transition: 'width 0.7s ease-out',
        }}
      />
    </div>
  );
}

/* ── Main component ── */
export function PortfolioGreeksCard({ positions, privacyMode, fetchedAt }: PortfolioGreeksCardProps) {
  const positionsWithData = positions.filter(
    (p) => p.delta !== null || p.theta !== null || p.iv !== null,
  );
  if (positionsWithData.length === 0) return null;

  // Aggregations
  const netDelta = positionsWithData.reduce((sum, p) => sum + (p.delta ?? 0), 0);
  const netGamma = positionsWithData.reduce((sum, p) => sum + (p.gamma ?? 0), 0);
  const dailyTheta = positionsWithData.reduce((sum, p) => sum + (p.theta ?? 0) * 100, 0);
  const netVega = positionsWithData.reduce((sum, p) => sum + (p.vega ?? 0), 0);
  const ivValues = positionsWithData.filter((p) => p.iv !== null).map((p) => p.iv!);
  const avgIV = ivValues.length > 0 ? ivValues.reduce((a, b) => a + b, 0) / ivValues.length : null;

  const monthlyTheta = dailyTheta * 30;
  const risk = computeRiskLevel(netDelta, netGamma, avgIV, dailyTheta);

  // Delta by ticker
  const deltaByTicker = new Map<string, number>();
  positionsWithData.forEach((p) => {
    if (p.delta != null) {
      deltaByTicker.set(p.ticker, (deltaByTicker.get(p.ticker) || 0) + p.delta);
    }
  });
  const deltaExposure = Array.from(deltaByTicker.entries())
    .map(([ticker, delta]) => ({ ticker, delta: +delta.toFixed(2) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);
  const showChart = deltaExposure.length >= 2 && !privacyMode;

  // Secondary Greeks config
  const gammaLabel =
    Math.abs(netGamma) > 0.05 ? 'High risk' : Math.abs(netGamma) > 0.02 ? 'Moderate' : 'Low';
  const gammaColor =
    Math.abs(netGamma) > 0.05 ? 'text-caution' : Math.abs(netGamma) > 0.02 ? 'text-zinc-300' : 'text-zinc-400';
  const gammaBarColor =
    Math.abs(netGamma) > 0.05 ? 'bg-caution' : Math.abs(netGamma) > 0.02 ? 'bg-zinc-500' : 'bg-zinc-600';

  const vegaLabel = Math.abs(netVega) > 0.5 ? 'High vol sens' : 'Low vol sens';
  const vegaColor = Math.abs(netVega) > 0.5 ? 'text-caution' : 'text-zinc-400';
  const vegaBarColor = Math.abs(netVega) > 0.5 ? 'bg-caution' : 'bg-zinc-600';

  const ivLabel = avgIV !== null ? (avgIV > 0.5 ? 'Elevated' : avgIV > 0.3 ? 'Moderate' : 'Low') : 'N/A';
  const ivColor = avgIV !== null && avgIV > 0.5 ? 'text-amber-400' : 'text-zinc-300';
  const ivBarColor = avgIV !== null && avgIV > 0.5 ? 'bg-amber-400' : avgIV !== null && avgIV > 0.3 ? 'bg-zinc-400' : 'bg-zinc-600';

  const thetaPositive = dailyTheta >= 0;

  return (
    <div className="glass-card overflow-hidden relative">
      {/* Top edge highlight */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <h3 className="text-base font-semibold text-foreground">Portfolio Greeks</h3>
          <span className="text-xs text-muted">{positionsWithData.length} positions</span>
          {fetchedAt && (
            <span className="text-[10px] text-muted" title={`Data fetched: ${fetchedAt}`}>
              {new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <div className="flex-1" />
          <span
            className={cn(
              'text-[11px] font-medium px-2.5 py-0.5 rounded-full',
              risk.bg,
              risk.color,
              risk.glow,
            )}
          >
            {risk.label}
          </span>
        </div>

        {/* Primary Greeks: Delta + Theta */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Delta Gauge */}
          <div className="rounded-xl bg-zinc-900/50 border border-border/10 p-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted font-medium">Net Delta</span>
              <InfoIcon tooltip="Directional exposure. +1 delta ≈ 100 shares long. Negative = bearish bias." />
            </div>
            <DeltaGauge value={netDelta} privacyMode={privacyMode} />
          </div>

          {/* Theta Block */}
          <div className="rounded-xl bg-zinc-900/50 border border-border/10 p-3 flex flex-col">
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-muted font-medium">Daily Theta</span>
              <InfoIcon tooltip="Time decay. Positive = earning from selling premium. Negative = paying for time." />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div
                className={cn(
                  'text-2xl font-bold tracking-tight',
                  thetaPositive ? 'text-profit' : 'text-loss',
                )}
              >
                {privacyMode
                  ? '$***'
                  : `${dailyTheta >= 0 ? '+' : ''}${rawFormatCurrency(dailyTheta)}`}
                <span className="text-xs font-normal text-muted ml-1">/day</span>
              </div>

              {/* Animated gradient bar */}
              <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-2 overflow-hidden">
                <AnimatedBar
                  pct={Math.min(Math.abs(dailyTheta) / 300, 1) * 100}
                  positive={thetaPositive}
                />
              </div>

              <div className="text-[11px] text-muted mt-1.5">
                {privacyMode
                  ? '~$***/mo'
                  : `~${monthlyTheta >= 0 ? '+' : ''}${rawFormatCurrency(monthlyTheta)}/mo`}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />
        </div>

        {/* Secondary Greeks: Gamma, Vega, IV */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Gamma */}
          <div className="rounded-lg bg-zinc-900/30 border border-border/5 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center">
                <span className="text-purple-400 text-xs font-bold">Γ</span>
              </div>
              <span className="text-[10px] text-muted">Gamma</span>
              <InfoIcon tooltip="Rate of delta change. High gamma = delta shifts rapidly with price moves." />
            </div>
            <div className={cn('text-sm font-bold', gammaColor)}>
              {privacyMode ? '***' : netGamma.toFixed(3)}
            </div>
            <div className="text-[10px] text-muted">{gammaLabel}</div>
            <MagnitudeBar pct={(Math.abs(netGamma) / 0.1) * 100} color={gammaBarColor} />
          </div>

          {/* Vega */}
          <div className="rounded-lg bg-zinc-900/30 border border-border/5 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-500/5 flex items-center justify-center">
                <span className="text-sky-400 text-xs font-bold">ν</span>
              </div>
              <span className="text-[10px] text-muted">Vega</span>
              <InfoIcon tooltip="Volatility sensitivity. Positive vega profits from rising IV." />
            </div>
            <div className={cn('text-sm font-bold', vegaColor)}>
              {privacyMode ? '***' : netVega.toFixed(3)}
            </div>
            <div className="text-[10px] text-muted">{vegaLabel}</div>
            <MagnitudeBar pct={(Math.abs(netVega) / 1) * 100} color={vegaBarColor} />
          </div>

          {/* IV */}
          <div className="rounded-lg bg-zinc-900/30 border border-border/5 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                <span className="text-amber-400 text-xs font-bold">σ</span>
              </div>
              <span className="text-[10px] text-muted">Avg IV</span>
              <InfoIcon tooltip="Implied volatility. Higher IV = more expensive options, wider expected moves." />
            </div>
            <div className={cn('text-sm font-bold', ivColor)}>
              {privacyMode ? '**%' : avgIV !== null ? `${(avgIV * 100).toFixed(0)}%` : 'N/A'}
            </div>
            <div className="text-[10px] text-muted">{ivLabel}</div>
            {avgIV !== null && (
              <MagnitudeBar pct={(avgIV / 1) * 100} color={ivBarColor} />
            )}
          </div>
        </div>

        {/* Delta Exposure Chart */}
        {showChart && (
          <>
            <div className="relative my-4">
              <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />
            </div>
            <div className="text-[11px] text-muted font-medium mb-2">Delta Exposure by Ticker</div>
            <ResponsiveContainer width="100%" height={deltaExposure.length * 28 + 12}>
              <BarChart layout="vertical" data={deltaExposure} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradPos" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="barGradNeg" x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide domain={['auto', 'auto']} />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  width={48}
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine x={0} stroke="#3f3f46" strokeWidth={1} />
                <Bar dataKey="delta" radius={[0, 4, 4, 0]} barSize={14}>
                  {deltaExposure.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.delta >= 0 ? 'url(#barGradPos)' : 'url(#barGradNeg)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Theta animated bar ── */
function AnimatedBar({ pct, positive }: { pct: number; positive: boolean }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={cn(
        'h-full rounded-full',
        positive
          ? 'bg-gradient-to-r from-profit/60 to-profit'
          : 'bg-gradient-to-r from-loss/60 to-loss',
      )}
      style={{
        width: animated ? `${Math.min(pct, 100)}%` : '0%',
        transition: 'width 0.8s ease-out',
      }}
    />
  );
}
