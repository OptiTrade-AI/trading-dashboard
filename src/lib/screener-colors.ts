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
  pcs: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    hex: '#a855f7',
    label: 'Put Credit Spreads',
    shortLabel: 'PCS',
  },
  aggressive: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
    label: 'Aggressive Options',
    shortLabel: 'AGG',
  },
  charts: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    hex: '#3b82f6',
    label: 'Chart Setups',
    shortLabel: 'CHRT',
  },
  swing: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    hex: '#06b6d4',
    label: 'Swing Trades',
    shortLabel: 'SWG',
  },
} as const;

export type ScreenerColorKey = keyof typeof SCREENER_COLORS;
