'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isStreaming?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, placeholder, isStreaming, onStop }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, []);

  return (
    <div className="border-t border-border/50 bg-card-solid/20 backdrop-blur-sm px-4 py-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          placeholder={placeholder || 'Ask about your portfolio...'}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-card-solid/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground',
            'placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors',
            'min-h-[40px] max-h-[120px]',
            (disabled || isStreaming) && 'opacity-50 cursor-not-allowed'
          )}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-loss/15 text-loss border border-loss/30 hover:bg-loss/25 transition-all"
            title="Stop generating"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all',
              input.trim() && !disabled
                ? 'bg-accent text-white hover:bg-accent/80'
                : 'bg-card-solid/50 text-muted/30 border border-border/50'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted/30 text-center mt-1.5">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
