'use client';

import { useRef, useEffect } from 'react';
import useSWR from 'swr';
import { useMarketStatus } from './useMarketStatus';
import type { SmartAlert } from '@/types';

interface UseSmartAlertsOptions {
  greeksMap?: Record<string, { delta?: number; theta?: number; iv?: number }>;
  notificationsEnabled?: boolean;
}

export function useSmartAlerts(options?: UseSmartAlertsOptions) {
  const { isOpen } = useMarketStatus();
  const prevAlertIds = useRef<Set<string>>(new Set());
  const greeksMap = options?.greeksMap;
  const notificationsEnabled = options?.notificationsEnabled ?? false;
  const hasGreeks = !!(greeksMap && Object.keys(greeksMap).length > 0);

  // Store greeksMap in a ref so the fetcher always reads the latest value
  const greeksRef = useRef(greeksMap);
  greeksRef.current = greeksMap;

  const { data, error, isLoading } = useSWR<{ alerts: SmartAlert[]; available: boolean }>(
    // Change key when greeks become available so SWR refetches with POST
    hasGreeks ? 'smart-alerts-with-greeks' : 'smart-alerts',
    async () => {
      const greeks = greeksRef.current;
      if (greeks && Object.keys(greeks).length > 0) {
        const res = await fetch('/api/ai/smart-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ greeks }),
        });
        return res.json();
      }
      return fetch('/api/ai/smart-alerts').then(r => r.json());
    },
    {
      refreshInterval: isOpen ? 5 * 60 * 1000 : 0,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    }
  );

  const alerts = data?.alerts || [];

  // Fire browser notifications for new critical alerts
  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined' || Notification.permission !== 'granted') return;

    const currentIds = new Set(alerts.map(a => `${a.positionId}-${a.action}`));
    for (const alert of alerts) {
      if (alert.urgency === 'critical') {
        const key = `${alert.positionId}-${alert.action}`;
        if (!prevAlertIds.current.has(key)) {
          new Notification(`${alert.ticker}: ${alert.action}`, {
            body: alert.reason,
            icon: '/favicon.ico',
          });
        }
      }
    }
    prevAlertIds.current = currentIds;
  }, [alerts, notificationsEnabled]);

  return {
    alerts,
    available: data?.available ?? false,
    isLoading,
    error,
  };
}
