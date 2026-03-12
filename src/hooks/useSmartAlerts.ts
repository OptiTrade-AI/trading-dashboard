'use client';

import { useRef, useEffect, useCallback } from 'react';
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

  const fetcher = useCallback(async (url: string) => {
    if (greeksMap && Object.keys(greeksMap).length > 0) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greeks: greeksMap }),
      });
      return res.json();
    }
    return fetch(url).then(r => r.json());
  }, [greeksMap]);

  const { data, error, isLoading } = useSWR<{ alerts: SmartAlert[]; available: boolean }>(
    '/api/ai/smart-alerts',
    fetcher,
    {
      refreshInterval: isOpen ? 5 * 60 * 1000 : 0,
      revalidateOnFocus: false,
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
