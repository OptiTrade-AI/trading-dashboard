'use client';

import { useState, useMemo } from 'react';
import { useSmartAlerts } from '@/hooks/useSmartAlerts';
import { useOptionQuotes } from '@/hooks/useOptionQuotes';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { cn } from '@/lib/utils';

const urgencyStyles = {
  critical: { bg: 'bg-loss/10', border: 'border-loss/30', text: 'text-loss', dot: 'bg-loss' },
  warning: { bg: 'bg-caution/10', border: 'border-caution/30', text: 'text-caution', dot: 'bg-caution' },
  info: { bg: 'bg-accent/10', border: 'border-accent/30', text: 'text-accent', dot: 'bg-accent' },
};

export function SmartAlertsBadge() {
  const { positions } = useOptionQuotes();
  const { isSupported, isGranted, requestPermission } = useNotificationPermission();

  // Build greeksMap from option quotes
  const greeksMap = useMemo(() => {
    const map: Record<string, { delta?: number; theta?: number; iv?: number }> = {};
    positions.forEach((quote, posId) => {
      map[posId] = {
        delta: quote.delta ?? undefined,
        theta: quote.theta ?? undefined,
        iv: quote.iv ?? undefined,
      };
    });
    return map;
  }, [positions]);

  const { alerts, available, isLoading } = useSmartAlerts({
    greeksMap: Object.keys(greeksMap).length > 0 ? greeksMap : undefined,
    notificationsEnabled: isGranted,
  });

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!available || isLoading) return null;

  const activeAlerts = alerts.filter(a => !dismissed.has(`${a.positionId}-${a.action}`));
  if (activeAlerts.length === 0) return null;

  const criticalCount = activeAlerts.filter(a => a.urgency === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.urgency === 'warning').length;

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full animate-pulse',
            criticalCount > 0 ? 'bg-loss' : warningCount > 0 ? 'bg-caution' : 'bg-accent'
          )} />
          <h3 className="text-sm font-semibold text-foreground">
            Smart Alerts
          </h3>
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded-full',
            criticalCount > 0 ? 'bg-loss/15 text-loss' : 'bg-caution/15 text-caution'
          )}>
            {activeAlerts.length}
          </span>
          {/* Notification toggle */}
          {isSupported && !isGranted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                requestPermission();
              }}
              className="text-muted hover:text-foreground transition-colors ml-1"
              title="Enable browser notifications"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          )}
          {isGranted && (
            <span className="text-[10px] text-profit/60" title="Browser notifications enabled">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={cn('text-muted transition-transform', expanded && 'rotate-180')}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {activeAlerts.map((alert, i) => {
            const style = urgencyStyles[alert.urgency];
            return (
              <div
                key={`${alert.positionId}-${i}`}
                className={cn('rounded-lg border p-3 flex items-start gap-3', style.bg, style.border)}
              >
                <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', style.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', style.text)}>{alert.ticker}</span>
                    <span className="text-xs text-muted">{alert.action}</span>
                  </div>
                  <p className="text-xs text-foreground/70 mt-0.5">{alert.reason}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissed(prev => new Set(prev).add(`${alert.positionId}-${alert.action}`));
                  }}
                  className="text-muted hover:text-foreground text-xs shrink-0"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
