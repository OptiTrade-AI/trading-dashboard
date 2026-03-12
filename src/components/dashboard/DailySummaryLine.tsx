'use client';

import { useDailySummary } from '@/hooks/useDailySummary';
import { usePrivacy } from '@/contexts/PrivacyContext';

export function DailySummaryLine() {
  const { summary, available, isLoading } = useDailySummary();
  const { privacyMode } = usePrivacy();

  if (!available || (!summary && !isLoading)) return null;

  return (
    <div className="mt-2">
      {isLoading && !summary ? (
        <div className="h-4 w-64 bg-purple-500/10 rounded animate-pulse" />
      ) : summary ? (
        <div className="flex items-start gap-1.5 text-xs text-purple-400/80">
          <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8L8 14l-6-4.8h7.6z" />
          </svg>
          <span>{privacyMode ? 'Portfolio summary hidden in privacy mode' : summary}</span>
        </div>
      ) : null}
    </div>
  );
}
