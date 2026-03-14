'use client';

import { cn } from '@/lib/utils';
import type { OptimizerParams, OptimizerPreset } from '@/types';

interface PresetDef {
  key: OptimizerPreset;
  label: string;
  icon: string;
  tagline: string;
  color: string;         // tailwind color stem e.g. 'emerald'
  delta: string;
  dte: string;
  philosophy: string;
}

const PRESETS: PresetDef[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    icon: '🛡',
    tagline: 'Protect upside',
    color: 'emerald',
    delta: '0.10 – 0.20',
    dte: '21 – 60 d',
    philosophy: 'Low assignment risk, monthly+ expirations. Best when you expect recovery and want to preserve upside.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    icon: '⚖',
    tagline: 'Balanced',
    color: 'blue',
    delta: '0.15 – 0.30',
    dte: '7 – 45 d',
    philosophy: 'Balanced premium vs. recovery potential. Good default for most tickers. Includes weeklies.',
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    icon: '⚡',
    tagline: 'Max income',
    color: 'amber',
    delta: '0.25 – 0.40',
    dte: '0 – 21 d',
    philosophy: 'Weeklies and short-dated. Higher premium, higher assignment risk. Fastest income cycle.',
  },
  {
    key: 'recovery',
    label: 'Recovery',
    icon: '🔄',
    tagline: 'Show everything',
    color: 'purple',
    delta: '0.10 – 0.40',
    dte: '0 – 90 d',
    philosophy: 'Widest net — all deltas, all expirations, no minimum premium. See every available option.',
  },
];

const COLOR_MAP: Record<string, { active: string; ring: string; tag: string; dot: string }> = {
  emerald: { active: 'bg-emerald-500/10 border-emerald-500/30', ring: 'ring-emerald-500/30', tag: 'text-emerald-400 bg-emerald-500/10', dot: 'bg-emerald-400' },
  blue:    { active: 'bg-blue-500/10 border-blue-500/30',    ring: 'ring-blue-500/30',    tag: 'text-blue-400 bg-blue-500/10',    dot: 'bg-blue-400' },
  amber:   { active: 'bg-amber-500/10 border-amber-500/30',   ring: 'ring-amber-500/30',   tag: 'text-amber-400 bg-amber-500/10',   dot: 'bg-amber-400' },
  purple:  { active: 'bg-purple-500/10 border-purple-500/30',  ring: 'ring-purple-500/30',  tag: 'text-purple-400 bg-purple-500/10',  dot: 'bg-purple-400' },
};

interface OptimizerParamControlsProps {
  params: OptimizerParams;
  onPreset: (preset: OptimizerPreset) => void;
  totalResults: number;
  filteredResults: number;
}

export function OptimizerParamControls({
  params,
  onPreset,
  totalResults,
  filteredResults,
}: OptimizerParamControlsProps) {
  const activePreset = PRESETS.find(p => p.key === params.preset);

  return (
    <div className="space-y-3">
      {/* Preset cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESETS.map((preset) => {
          const selected = params.preset === preset.key;
          const colors = COLOR_MAP[preset.color];

          return (
            <button
              key={preset.key}
              onClick={() => onPreset(preset.key)}
              className={cn(
                'relative text-left p-3.5 rounded-xl border transition-all duration-200',
                selected
                  ? `${colors.active} ring-1 ${colors.ring}`
                  : 'bg-card-solid/30 border-border/50 hover:border-zinc-600 hover:bg-card-solid/50',
              )}
            >
              {/* Selected indicator dot */}
              {selected && (
                <div className={cn('absolute top-3 right-3 w-2 h-2 rounded-full', colors.dot)} />
              )}

              <div className="text-xs mb-1.5 opacity-70">{preset.icon}</div>
              <div className={cn(
                'text-sm font-semibold mb-0.5',
                selected ? 'text-foreground' : 'text-foreground/80',
              )}>
                {preset.label}
              </div>
              <div className="text-[11px] text-muted leading-tight">{preset.tagline}</div>

              {/* Param chips */}
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  selected ? colors.tag : 'text-muted/70 bg-zinc-800/50',
                )}>
                  δ {preset.delta}
                </span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  selected ? colors.tag : 'text-muted/70 bg-zinc-800/50',
                )}>
                  {preset.dte}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active params strip */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-card-solid/50 rounded-xl border border-border">
          <ParamChip label="δ" value={`${params.minDelta.toFixed(2)}–${params.maxDelta.toFixed(2)}`} />
          <div className="w-px h-4 bg-border" />
          <ParamChip label="DTE" value={`${params.minDTE}–${params.maxDTE}d`} />
          <div className="w-px h-4 bg-border" />
          <ParamChip label="Min $" value={params.minPremium > 0 ? `$${params.minPremium.toFixed(2)}` : 'any'} />
        </div>

        <span className="text-xs text-muted">
          {filteredResults}<span className="opacity-50">/{totalResults}</span> matches
        </span>
      </div>

      {/* Philosophy blurb for active preset */}
      {activePreset && (
        <p className="text-xs text-muted/70 italic pl-1">{activePreset.philosophy}</p>
      )}
    </div>
  );
}

/* ── Tiny sub-components ── */

function ParamChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 text-xs flex items-center gap-1.5">
      <span className="text-muted/60 font-medium">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  );
}
