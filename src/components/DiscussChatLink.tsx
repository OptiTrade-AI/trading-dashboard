'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createChatWithContext } from '@/lib/chatContext';
import { cn } from '@/lib/utils';

interface DiscussChatLinkProps {
  context: string;
  sourceFeature: string;
  className?: string;
}

export function DiscussChatLink({ context, sourceFeature, className }: DiscussChatLinkProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      const conversationId = await createChatWithContext(context, sourceFeature);
      router.push(`/analysis?conversation=${conversationId}`);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [context, sourceFeature, router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] text-purple-400/70 hover:text-purple-400 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {isLoading ? (
        <div className="w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}
      Discuss in Chat
    </button>
  );
}
