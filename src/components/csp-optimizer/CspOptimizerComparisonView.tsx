'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CspOptimizerAIAnalysis, CspStrategyMode, CspStrategyPick } from '@/types';

interface CspOptimizerComparisonViewProps {
  analyses: Map<string, CspOptimizerAIAnalysis>;
  onWritePut: (ticker: string, pick: CspStrategyPick) => void;
  privacyMode: boolean;
}

function n(v: unknown, decimals = 2): string {
  const num = typeof v === 'number' ? v : Number(v);
  if (isNaN(num)) return '\u2014';
  return num.toFixed(decimals);
}

type MetricRow = {
  label: string;
  getValue: (a: CspOptimizerAIAnalysis, pick: CspStrategyPick | null) => string;
  isCurrency?: boolean;
  isPercent?: boolean;
  higherIsBetter?: boolean;
};

const STOCK_ROWS: MetricRow[] = [
  { label: 'Stock Price', getValue: (a) => `$${n(a.stockPrice)}`, isCurrency: true },
];

const PICK_ROWS: MetricRow[] = [
  { label: 'Strike', getValue: (_, p) => p ? `$${n(p.strike)}` : '\u2014', isCurrency: true },
  { label: 'Premium', getValue: (_, p) => p ? `$${n(p.premium)}` : '\u2014', isCurrency: true, higherIsBetter: true },
  { label: 'ROR%', getValue: (_, p) => p ? `${n(p.returnOnRisk, 1)}%` : '\u2014', isPercent: true, higherIsBetter: true },
  { label: 'Ann. ROR%', getValue: (_, p) => p ? `${n(p.annualizedROR, 0)}%` : '\u2014', isPercent: true, higherIsBetter: true },
  { label: 'PoP%', getValue: (_, p) => p ? `${n(p.probabilityOfProfit, 0)}%` : '\u2014', isPercent: true, higherIsBetter: true },
  { label: 'Break Even', getValue: (_, p) => p ? `$${n(p.breakEven)}` : '\u2014', isCurrency: true },
  { label: 'Discount', getValue: (_, p) => p ? `${n(p.discountFromCurrent, 1)}%` : '\u2014', isPercent: true, higherIsBetter: true },
  { label: 'Delta', getValue: (_, p) => p ? n(p.delta) : '\u2014' },
  { label: 'IV', getValue: (_, p) => p ? `${n(p.iv, 0)}%` : '\u2014' },
  { label: 'OI', getValue: (_, p) => p ? Number(p.openInterest || 0).toLocaleString() : '\u2014', higherIsBetter: true },
];

const CONTEXT_ROWS: MetricRow[] = [
  { label: 'Earnings', getValue: (a) => a.earningsDate || '\u2014' },
  { label: 'Quality', getValue: (a) => a.assignmentScenario?.qualityAssessment?.slice(0, 40) || '\u2014' },
  { label: 'Heat Impact', getValue: (a) => a.positionSizing ? `+${n(a.positionSizing.portfolioHeatImpact, 1)}%` : '\u2014' },
  { label: 'Contracts', getValue: (a) => a.positionSizing ? `${a.positionSizing.suggestedContracts}` : '\u2014' },
];

const MODE_LABELS: Record<CspStrategyMode, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

function findBestIndex(values: (number | null)[], higherIsBetter: boolean): number {
  let bestIdx = -1;
  let bestVal: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    if (bestVal === null || (higherIsBetter ? v > bestVal : v < bestVal)) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function extractNumeric(s: string): number | null {
  const cleaned = s.replace(/[$,%+]/g, '').replace(/\u2014/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function CspOptimizerComparisonView({
  analyses,
  onWritePut,
  privacyMode,
}: CspOptimizerComparisonViewProps) {
  const [strategyMode, setStrategyMode] = useState<CspStrategyMode>('balanced');
  const items = useMemo(() => Array.from(analyses.values()), [analyses]);
  const mask = (v: string) => privacyMode ? '\u2022\u2022\u2022' : v;

  if (items.length < 2) return null;

  const getPick = (a: CspOptimizerAIAnalysis): CspStrategyPick | null => {
    const lane = a.strategies.find(s => s.mode === strategyMode);
    return lane?.viable ? (lane.pick || null) : null;
  };

  const renderRow = (row: MetricRow, isPickRow: boolean) => {
    const values = items.map(a => {
      const pick = isPickRow ? getPick(a) : null;
      return row.getValue(a, pick);
    });
    const numericValues = values.map(v => extractNumeric(v));
    const bestIdx = row.higherIsBetter !== undefined ? findBestIndex(numericValues, row.higherIsBetter) : -1;

    return (
      <tr key={row.label} className="border-b border-zinc-800/30">
        <td className="px-3 py-2 text-xs text-muted whitespace-nowrap font-medium">{row.label}</td>
        {values.map((val, i) => (
          <td
            key={i}
            className={cn(
              'px-3 py-2 text-xs text-center whitespace-nowrap',
              i === bestIdx ? 'text-profit font-semibold' : 'text-foreground',
            )}
          >
            {row.isCurrency ? mask(val) : val}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      {/* Strategy mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Strategy:</span>
        {(['conservative', 'balanced', 'aggressive'] as CspStrategyMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setStrategyMode(mode)}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
              strategyMode === mode
                ? 'bg-accent/20 text-accent'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
            )}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto glass-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="px-3 py-2.5 text-left text-muted font-medium w-28"></th>
              {items.map(a => (
                <th key={a.ticker} className="px-3 py-2.5 text-center">
                  <span className="text-base font-bold text-foreground">{a.ticker}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Viable pick indicator */}
            <tr className="border-b border-zinc-800/30">
              <td className="px-3 py-2 text-xs text-muted font-medium">Viable</td>
              {items.map(a => {
                const pick = getPick(a);
                return (
                  <td key={a.ticker} className="px-3 py-2 text-xs text-center">
                    {pick ? (
                      <span className="text-profit font-semibold">{'\u2713'}</span>
                    ) : (
                      <span className="text-loss">{'\u2717'}</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Stock info */}
            {STOCK_ROWS.map(row => renderRow(row, false))}

            {/* Section divider */}
            <tr>
              <td colSpan={items.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted/60 bg-zinc-800/20 font-medium">
                {MODE_LABELS[strategyMode]} Pick
              </td>
            </tr>

            {/* Pick metrics */}
            {PICK_ROWS.map(row => renderRow(row, true))}

            {/* Section divider */}
            <tr>
              <td colSpan={items.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted/60 bg-zinc-800/20 font-medium">
                Context
              </td>
            </tr>

            {/* Context rows */}
            {CONTEXT_ROWS.map(row => renderRow(row, false))}

            {/* Catalysts row */}
            <tr className="border-b border-zinc-800/30">
              <td className="px-3 py-2 text-xs text-muted font-medium">Catalysts</td>
              {items.map(a => (
                <td key={a.ticker} className="px-3 py-2 text-xs text-center">
                  <span className="text-amber-400/80">
                    {a.catalysts?.length ? `${a.catalysts.length} found` : '\u2014'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Risks row */}
            <tr className="border-b border-zinc-800/30">
              <td className="px-3 py-2 text-xs text-muted font-medium">Key Risks</td>
              {items.map(a => (
                <td key={a.ticker} className="px-3 py-2 text-xs text-center">
                  <span className={cn(a.keyRisks?.length > 2 ? 'text-loss' : 'text-zinc-400')}>
                    {a.keyRisks?.length || 0}
                  </span>
                </td>
              ))}
            </tr>

            {/* Action row */}
            <tr>
              <td className="px-3 py-3 text-xs text-muted font-medium"></td>
              {items.map(a => {
                const pick = getPick(a);
                return (
                  <td key={a.ticker} className="px-3 py-3 text-center">
                    {pick ? (
                      <button
                        onClick={() => onWritePut(a.ticker, pick)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                      >
                        Write Put
                      </button>
                    ) : (
                      <span className="text-xs text-muted italic">No viable pick</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
