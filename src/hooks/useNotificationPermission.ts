'use client';

import { useState, useCallback, useEffect } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  return {
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    permission,
    requestPermission,
  };
}
