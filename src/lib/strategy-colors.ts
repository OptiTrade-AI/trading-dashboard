/**
 * Canonical strategy color constants.
 *
 * These capture the color scheme already in use across the codebase so that
 * future components can reference a single source of truth instead of
 * hard-coding color classes in every file.
 *
 * `hex` values are used by Recharts and inline styles (e.g. Charts.tsx,
 * CapitalAllocationCard).  Tailwind classes are used everywhere else.
 *
 * NOTE: Several older components use the Tailwind `accent` token for CSP
 * (e.g. `text-accent`, `bg-accent/10`) which resolves to the same emerald
 * shade at runtime.  New code should prefer the explicit emerald classes
 * listed here for consistency, but both are valid.
 */

export const STRATEGY_COLORS = {
  csp: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    hex: '#10b981',
    icon: 'P',
    label: 'Cash-Secured Puts',
    shortLabel: 'CSP',
  },
  cc: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    hex: '#3b82f6',
    icon: 'C',
    label: 'Covered Calls',
    shortLabel: 'CC',
  },
  directional: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
    icon: 'D',
    label: 'Directional',
    shortLabel: 'DIR',
  },
  spreads: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    hex: '#a855f7',
    icon: 'S',
    label: 'Spreads',
    shortLabel: 'SPR',
  },
} as const;

export type StrategyKey = keyof typeof STRATEGY_COLORS;
