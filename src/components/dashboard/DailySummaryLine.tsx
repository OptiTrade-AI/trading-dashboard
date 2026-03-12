'use client';

import { useState } from 'react';
import { useDailySummary } from '@/hooks/useDailySummary';
import { usePrivacy } from '@/contexts/PrivacyContext';

export function DailySummaryLine() {
  const { summary, available, isLoading, refreshing, refresh } = useDailySummary();
  const { privacyMode } = usePrivacy();
  const [expanded, setExpanded] = useState(false);

  if (!available || (!summary && !isLoading)) return null;

  // Truncate for collapsed view
  const maxLen = 180;
  const isLong = summary ? summary.length > maxLen : false;
  const displayText = privacyMode
    ? 'Portfolio summary hidden in privacy mode'
    : summary
    ? expanded || !isLong
      ? summary
      : summary.slice(0, maxLen).replace(/\s+\S*$/, '') + '...'
    : '';

  return (
    <div className="relative overflow-hidden rounded-xl border border-purple-500/15 bg-gradient-to-r from-purple-500/[0.04] via-indigo-500/[0.04] to-purple-500/[0.04]">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="px-4 py-3">
        {isLoading && !summary ? (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-md bg-purple-500/10 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-purple-500/10 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-purple-500/10 rounded animate-pulse" />
            </div>
          </div>
        ) : summary ? (
          <div className="flex items-start gap-3">
            {/* AI icon */}
            <div className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-purple-500/10 flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8L8 14l-6-4.8h7.6z" />
              </svg>
            </div>

            {/* Summary text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/70">AI Daily Brief</span>
                <span className="text-[10px] text-muted">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-purple-100/80">
                {displayText}
              </p>
              {isLong && !privacyMode && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[11px] text-purple-400/60 hover:text-purple-400 mt-1 transition-colors"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={refreshing}
              className="shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-purple-400/40 hover:text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-30"
              title="Refresh summary"
            >
              <svg
                className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
