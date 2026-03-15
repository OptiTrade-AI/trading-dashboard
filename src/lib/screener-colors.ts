/**
 * Color palette for screener types.
 * Used by the Screener Hub for tab colors, pipeline strip chips, and overview cards.
 */

export const SCREENER_COLORS = {
  csp: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    hex: '#10b981',
    label: 'Cash-Secured Puts',
    shortLabel: 'CSP',
  },
  aggressive: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
    label: 'Aggressive Options',
    shortLabel: 'AGG',
  },
} as const;

export type ScreenerColorKey = keyof typeof SCREENER_COLORS;
