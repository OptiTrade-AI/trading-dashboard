'use client';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'profit' | 'loss' | 'accent';
  icon?: React.ReactNode;
}

export function StatCard({ label, value, subValue, variant = 'default', icon }: StatCardProps) {
  const variantConfig = {
    default: {
      text: 'text-foreground',
      glow: '',
      iconBg: 'bg-foreground/5',
    },
    profit: {
      text: 'text-profit',
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.1)]',
      iconBg: 'bg-profit/10',
    },
    loss: {
      text: 'text-loss',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.1)]',
      iconBg: 'bg-loss/10',
    },
    accent: {
      text: 'text-accent',
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.1)]',
      iconBg: 'bg-accent/10',
    },
  };

  const config = variantConfig[variant];

  return (
    <div className={cn('glass-card p-5 transition-all duration-300 hover:border-accent/20', config.glow)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="stat-label mb-2">{label}</div>
          <div className={cn('stat-value', config.text)}>{value}</div>
          {subValue && (
            <div className="text-muted text-sm mt-1">{subValue}</div>
          )}
        </div>
        {icon && (
          <div className={cn('p-2 rounded-lg', config.iconBg)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
