'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type TradeType = 'csp' | 'cc' | 'directional' | 'spread';

const tradeTypes: { key: TradeType; label: string; color: string }[] = [
  { key: 'csp', label: 'Cash-Secured Put', color: 'text-emerald-400' },
  { key: 'cc', label: 'Covered Call', color: 'text-blue-400' },
  { key: 'directional', label: 'Directional', color: 'text-amber-400' },
  { key: 'spread', label: 'Spread', color: 'text-purple-400' },
];

interface QuickAddFABProps {
  onSelect: (type: TradeType) => void;
}

export function QuickAddFAB({ onSelect }: QuickAddFABProps) {
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: N when no input focused
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setOpen(prev => !prev);
        }
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
      {/* Dropdown menu */}
      {open && (
        <div className="mb-2 bg-card-solid border border-border rounded-xl shadow-lg shadow-black/30 overflow-hidden animate-slide-in">
          {tradeTypes.map(type => (
            <button
              key={type.key}
              onClick={() => { onSelect(type.key); setOpen(false); }}
              className="w-full px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-card/80 transition-colors flex items-center gap-3"
            >
              <span className={cn('font-bold', type.color)}>+</span>
              {type.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200',
          'bg-gradient-to-r from-accent to-accent-light text-background',
          'shadow-glow hover:shadow-glow hover:scale-105 active:scale-95',
          open && 'rotate-45'
        )}
        title="Quick add trade (N)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
