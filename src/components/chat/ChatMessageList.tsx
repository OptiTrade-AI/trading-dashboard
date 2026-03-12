'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '@/types';
import { ChatMessage } from './ChatMessage';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  streamingContent: string;
  isStreaming: boolean;
  onFollowup: (question: string) => void;
  privacyMode: boolean;
}

function ShimmerBar({ width }: { width: string }) {
  return (
    <div className="relative overflow-hidden rounded" style={{ width, height: '10px' }}>
      <div className="absolute inset-0 bg-card-solid/40" />
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
    </div>
  );
}

export function ChatMessageList({ messages, streamingContent, isStreaming, onFollowup, privacyMode }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
      {messages.map((msg, i) => {
        const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
        return (
          <ChatMessage
            key={msg.id}
            message={msg}
            onFollowup={isLastAssistant && !isStreaming ? onFollowup : undefined}
            privacyMode={privacyMode}
          />
        );
      })}

      {/* Streaming message */}
      {isStreaming && streamingContent && (
        <ChatMessage
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            createdAt: new Date().toISOString(),
          }}
          isStreaming
          streamingContent={streamingContent}
          privacyMode={privacyMode}
        />
      )}

      {/* Shimmer thinking indicator when no content yet */}
      {isStreaming && !streamingContent && (
        <div className="flex gap-3 mb-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-card-solid/60 border border-border/50 mt-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2l1.5 3.5L13 7l-3.5 1.5L8 12 6.5 8.5 3 7l3.5-1.5L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="text-muted"/>
              <circle cx="8" cy="7" r="1" fill="currentColor" className="text-muted"/>
            </svg>
          </div>
          <div className="glass-card rounded-2xl px-4 py-3 space-y-2">
            <ShimmerBar width="60%" />
            <ShimmerBar width="80%" />
            <ShimmerBar width="45%" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
