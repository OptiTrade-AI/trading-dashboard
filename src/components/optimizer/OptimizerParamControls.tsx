'use client';

import { cn } from '@/lib/utils';
import type { OptimizerParams, OptimizerPreset } from '@/types';
import { useState } from 'react';

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
  onUpdate: <K extends keyof OptimizerParams>(key: K, value: OptimizerParams[K]) => void;
  totalResults: number;
  filteredResults: number;
}

export function OptimizerParamControls({
  params,
  onPreset,
  onUpdate,
  totalResults,
  filteredResults,
}: OptimizerParamControlsProps) {
  const [showCustom, setShowCustom] = useState(false);
  const activePreset = PRESETS.find(p => p.key === params.preset);
  const isCustom = params.preset === 'custom';

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

      {/* Active params strip + customize toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Active param summary chips */}
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

        <button
          onClick={() => { setShowCustom(!showCustom); if (!showCustom) onPreset('custom'); }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
            showCustom || isCustom
              ? 'bg-accent/10 text-accent border-accent/30'
              : 'text-muted border-border/50 hover:text-foreground hover:border-zinc-600',
          )}
        >
          {showCustom ? 'Hide Tuning' : 'Fine Tune'}
        </button>
      </div>

      {/* Philosophy blurb for active preset */}
      {activePreset && !showCustom && (
        <p className="text-xs text-muted/70 italic pl-1">{activePreset.philosophy}</p>
      )}

      {/* Custom tuning panel */}
      {(showCustom || isCustom) && (
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <RangeControl
              label="Delta Range"
              minVal={params.minDelta}
              maxVal={params.maxDelta}
              min={0.05} max={0.50} step={0.05}
              format={(v) => v.toFixed(2)}
              onMinChange={(v) => onUpdate('minDelta', v)}
              onMaxChange={(v) => onUpdate('maxDelta', v)}
            />
            <RangeControl
              label="Days to Expiration"
              minVal={params.minDTE}
              maxVal={params.maxDTE}
              min={0} max={90} step={1}
              format={(v) => `${v}d`}
              onMinChange={(v) => onUpdate('minDTE', v)}
              onMaxChange={(v) => onUpdate('maxDTE', v)}
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted font-medium">Min Premium</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  ${params.minPremium.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min={0} max={5} step={0.05}
                value={params.minPremium}
                onChange={e => onUpdate('minPremium', parseFloat(e.target.value))}
                className="w-full accent-accent h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(16,185,129,0.4)]"
              />
              <div className="flex justify-between text-[10px] text-muted/50 mt-1">
                <span>$0</span>
                <span>$5</span>
              </div>
            </div>
          </div>
        </div>
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

function RangeControl({
  label, minVal, maxVal, min, max, step, format, onMinChange, onMaxChange,
}: {
  label: string;
  minVal: number; maxVal: number;
  min: number; max: number; step: number;
  format: (v: number) => string;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const sliderClass = "flex-1 accent-accent h-1.5 rounded-full appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(16,185,129,0.4)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted font-medium">{label}</span>
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {format(minVal)} – {format(maxVal)}
        </span>
      </div>
      <div className="flex gap-3 items-center">
        <input
          type="range" min={min} max={max} step={step}
          value={minVal}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onMinChange(Math.min(v, maxVal - step));
          }}
          className={sliderClass}
        />
        <input
          type="range" min={min} max={max} step={step}
          value={maxVal}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onMaxChange(Math.max(v, minVal + step));
          }}
          className={sliderClass}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted/50 mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
