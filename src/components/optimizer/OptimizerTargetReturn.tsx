'use client';

import { cn } from '@/lib/utils';

const RETURN_PRESETS = [1, 2, 4, 6];

interface OptimizerTargetReturnProps {
  value: number;
  onChange: (pct: number) => void;
  costBasis?: number;
  privacyMode: boolean;
}

export function OptimizerTargetReturn({ value, onChange, costBasis, privacyMode }: OptimizerTargetReturnProps) {
  const mask = (val: string) => privacyMode ? '***' : val;
  const premiumPerShare = costBasis ? (costBasis * value / 100) : null;
  const annualized = value * 12;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Monthly Return Target</h4>
          <p className="text-[11px] text-muted mt-0.5">Premium / cost basis — used by AI analysis for above-water positions</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-profit tabular-nums">{value.toFixed(1)}%</span>
          <span className="text-[11px] text-muted block">~{annualized.toFixed(0)}% ann.</span>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="flex items-center gap-2">
        {RETURN_PRESETS.map((pct) => (
          <button
            key={pct}
            onClick={() => onChange(pct)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border',
              value === pct
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20'
                : 'bg-card-solid/30 text-muted border-border/50 hover:text-foreground hover:border-zinc-600',
            )}
          >
            {pct}%
          </button>
        ))}
        <div className="flex-1 ml-2">
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(16,185,129,0.4)]"
          />
          <div className="flex justify-between text-[10px] text-muted/50 mt-0.5">
            <span>0.5%</span>
            <span>10%</span>
          </div>
        </div>
      </div>

      {/* Context line */}
      {costBasis != null && premiumPerShare != null && (
        <div className="flex items-center gap-4 text-[11px] text-muted pt-1 border-t border-border/30">
          <span>
            Per share: <span className="text-profit font-semibold">{mask(`$${premiumPerShare.toFixed(2)}`)}</span> premium needed
          </span>
          <span className="w-px h-3 bg-border/30" />
          <span>
            On <span className="text-foreground font-medium">{mask(`$${costBasis.toFixed(2)}`)}</span> cost basis
          </span>
        </div>
      )}
    </div>
  );
}
