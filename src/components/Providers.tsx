'use client';

import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { PrivacyProvider } from '@/contexts/PrivacyContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ToastContainer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, dedupingInterval: 10000, revalidateOnFocus: false }}>
      <PrivacyProvider>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </PrivacyProvider>
    </SWRConfig>
  );
}
