'use client';

import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { PrivacyProvider } from '@/contexts/PrivacyContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, dedupingInterval: 10000, revalidateOnFocus: false }}>
      <PrivacyProvider>{children}</PrivacyProvider>
    </SWRConfig>
  );
}
