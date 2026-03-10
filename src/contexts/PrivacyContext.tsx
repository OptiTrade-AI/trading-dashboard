'use client';

import { createContext, useContext, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  privacyMode: false,
  togglePrivacy: () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useLocalStorage('privacy-mode', false);

  const togglePrivacy = useCallback(() => {
    setPrivacyMode((prev: boolean) => !prev);
  }, [setPrivacyMode]);

  // Keyboard shortcut: Ctrl+Shift+H
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        togglePrivacy();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePrivacy]);

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
