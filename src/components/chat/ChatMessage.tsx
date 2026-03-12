'use client';

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

export function ChatMessage({ message, isStreaming, streamingContent, onFollowup, privacyMode }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const content = isStreaming ? (streamingContent || '') : message.content;

  // Parse follow-ups from assistant messages
  const { cleanContent, followups } = isUser ? { cleanContent: content, followups: [] } : parseFollowups(content);

  return (
    <div className={cn('flex gap-3 mb-4', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-1',
        isUser ? 'bg-accent/15 text-accent' : 'bg-card-solid/60 text-muted border border-border/50'
      )}>
        {isUser ? 'You' : 'AI'}
      </div>

      {/* Message bubble */}
      <div className={cn('flex flex-col max-w-[85%] min-w-0', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3',
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
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.4s]" />
                </div>
              )}
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
                className="text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted hover:text-accent hover:border-accent/30 transition-colors bg-card-solid/30"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
