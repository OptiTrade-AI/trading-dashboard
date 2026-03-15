'use client';

import { cn } from '@/lib/utils';
import { SCREENER_COLORS } from '@/lib/screener-colors';
import type { ScreenerTab } from '@/types';

const TABS: { key: ScreenerTab; label: string }[] = [
  { key: 'csp', label: 'CSP' },
  { key: 'pcs', label: 'PCS' },
  { key: 'aggressive', label: 'Aggressive' },
  { key: 'charts', label: 'Charts' },
  { key: 'swing', label: 'Swing' },
];

interface ScreenerTabBarProps {
  activeTab: ScreenerTab;
  onChange: (tab: ScreenerTab) => void;
  counts: Record<ScreenerTab, number>;
}

export function ScreenerTabBar({ activeTab, onChange, counts }: ScreenerTabBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        const colors = SCREENER_COLORS[key];

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
              isActive
                ? cn('ring-2 ring-offset-0', colors.bg, colors.border, colors.text,
                    key === 'csp' ? 'ring-emerald-500/40' :
                    key === 'pcs' ? 'ring-purple-500/40' :
                    key === 'aggressive' ? 'ring-amber-500/40' :
                    key === 'charts' ? 'ring-blue-500/40' :
                    'ring-cyan-500/40',
                  )
                : 'bg-card-solid/30 border-border/50 text-muted hover:text-foreground hover:bg-card-solid/60',
            )}
          >
            <span className="flex items-center gap-2">
              {label}
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums',
                isActive ? 'bg-white/10' : 'bg-border/50 text-muted',
              )}>
                {counts[key]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
