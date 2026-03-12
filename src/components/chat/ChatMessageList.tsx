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

      {/* Streaming indicator when no content yet */}
      {isStreaming && !streamingContent && (
        <div className="flex gap-3 mb-4">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-1 bg-card-solid/60 text-muted border border-border/50">
            AI
          </div>
          <div className="glass-card rounded-2xl px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.4s]" />
              <span className="text-xs text-muted ml-1">Thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
