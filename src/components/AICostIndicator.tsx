'use client';

import { useState } from 'react';
import { useAIUsage } from '@/hooks/useAIUsage';
import { useFormatters } from '@/hooks/useFormatters';
import { cn } from '@/lib/utils';

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat',
  'exit-coach': 'Exit Coach',
  'smart-alerts': 'Smart Alerts',
  'trade-check': 'Trade Check',
  patterns: 'Patterns',
  'roll-advisor': 'Roll Advisor',
  'events-check': 'Events',
  scenario: 'Scenario',
};

export function AICostIndicator() {
  const { stats, isLoading } = useAIUsage();
  const { privacyMode } = useFormatters();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !stats) return null;
  if (stats.allTime === 0 && Object.keys(stats.byFeature).length === 0) return null;

  const todayCost = privacyMode ? '$***' : `$${stats.today.toFixed(2)}`;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
          'text-muted hover:text-foreground hover:bg-card/50'
        )}
        title="AI usage today"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>AI: {todayCost}</span>
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 glass-card w-72 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">AI Usage</h3>

            {/* Cost summary */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Today', value: stats.today },
                { label: 'This Week', value: stats.thisWeek },
                { label: 'This Month', value: stats.thisMonth },
                { label: 'All Time', value: stats.allTime },
              ].map(({ label, value }) => (
                <div key={label} className="bg-background/30 rounded-lg p-2">
                  <div className="text-[10px] text-muted">{label}</div>
                  <div className="text-sm font-semibold text-foreground">
                    {privacyMode ? '$***' : `$${value.toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>

            {/* By feature */}
            {Object.keys(stats.byFeature).length > 0 && (
              <div>
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">By Feature</div>
                <div className="space-y-1">
                  {Object.entries(stats.byFeature)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([feature, data]) => (
                      <div key={feature} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{FEATURE_LABELS[feature] || feature}</span>
                        <span className="text-foreground">
                          {data.calls} calls {privacyMode ? '' : `· $${data.cost.toFixed(3)}`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* By model */}
            {Object.keys(stats.byModel).length > 0 && (
              <div>
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">By Model</div>
                <div className="space-y-1">
                  {Object.entries(stats.byModel).map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between text-xs">
                      <span className="text-muted">
                        {model.includes('haiku') ? 'Haiku 4.5' : model.includes('sonnet') ? 'Sonnet 4.6' : model}
                      </span>
                      <span className="text-foreground">
                        {data.calls} calls {privacyMode ? '' : `· $${data.cost.toFixed(3)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
