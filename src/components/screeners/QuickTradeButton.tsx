'use client';

import { cn } from '@/lib/utils';

interface QuickTradeButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md';
}

export function QuickTradeButton({ onClick, label = 'Trade', size = 'sm' }: QuickTradeButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
      )}
    >
      {label}
    </button>
  );
}
