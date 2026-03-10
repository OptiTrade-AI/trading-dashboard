'use client';

import { PrivacyProvider } from '@/contexts/PrivacyContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <PrivacyProvider>{children}</PrivacyProvider>;
}
