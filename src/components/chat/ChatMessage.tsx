'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChatMessage as ChatMessageType } from '@/types';
import { MarkdownRenderer, parseFollowups } from './MarkdownRenderer';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingContent?: string;
  onFollowup?: (question: string) => void;
  privacyMode?: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-card-solid/80 border border-border/30 text-muted/50 hover:text-foreground"
      title="Copy message"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

function UserAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent/15 mt-1">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" className="text-accent"/>
        <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent"/>
      </svg>
    </div>
  );
}

function AIAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-card-solid/60 border border-border/50 mt-1">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2l1.5 3.5L13 7l-3.5 1.5L8 12 6.5 8.5 3 7l3.5-1.5L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="text-muted"/>
        <circle cx="8" cy="7" r="1" fill="currentColor" className="text-muted"/>
      </svg>
    </div>
  );
}

export function ChatMessage({ message, isStreaming, streamingContent, onFollowup, privacyMode }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const content = isStreaming ? (streamingContent || '') : message.content;

  // Parse follow-ups from assistant messages
  const { cleanContent, followups } = isUser ? { cleanContent: content, followups: [] } : parseFollowups(content);

  return (
    <div className={cn('flex gap-3 mb-4', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      {isUser ? <UserAvatar /> : <AIAvatar />}

      {/* Message bubble */}
      <div className={cn('flex flex-col max-w-[85%] min-w-0', isUser && 'items-end')}>
        <div className={cn(
          'relative group rounded-2xl px-4 py-3',
          isUser
            ? 'bg-accent/10 border border-accent/20'
            : 'glass-card',
          privacyMode && 'blur-md select-none'
        )}>
          {isUser ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
          ) : (
            <>
              <MarkdownRenderer content={cleanContent} />
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-accent animate-pulse ml-0.5 align-middle" />
              )}
              {!isStreaming && cleanContent && <MessageCopyButton text={cleanContent} />}
            </>
          )}
        </div>

        {/* Timestamp */}
        <span className={cn('text-[10px] text-muted/50 mt-1', isUser ? 'mr-1' : 'ml-1')}>
          {formatTime(message.createdAt)}
        </span>

        {/* Follow-up chips */}
        {!isStreaming && followups.length > 0 && onFollowup && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {followups.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowup(q)}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border border-accent/20 text-muted hover:text-accent bg-accent/5 hover:bg-accent/10 transition-all hover:translate-x-0.5"
              >
                {q}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                  <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
