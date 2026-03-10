'use client';

import { useCallback } from 'react';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { formatCurrency as rawFormatCurrency, formatPercent as rawFormatPercent } from '@/lib/utils';

export function useFormatters() {
  const { privacyMode } = usePrivacy();

  const formatCurrency = useCallback(
    (value: number) => (privacyMode ? '$***' : rawFormatCurrency(value)),
    [privacyMode]
  );

  const formatPercent = useCallback(
    (value: number, decimals?: number) => (privacyMode ? '**%' : rawFormatPercent(value, decimals)),
    [privacyMode]
  );

  const mask = useCallback(
    (value: string | number) => (privacyMode ? '***' : String(value)),
    [privacyMode]
  );

  const maskValue = useCallback(
    (formatted: string) => (privacyMode ? '***' : formatted),
    [privacyMode]
  );

  return { formatCurrency, formatPercent, mask, maskValue, privacyMode };
}
