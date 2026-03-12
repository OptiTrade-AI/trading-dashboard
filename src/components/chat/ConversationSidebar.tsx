'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  privacyMode: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, privacyMode, isOpen, onToggle,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}

      {/* Sidebar */}
      <div className={cn(
        'flex flex-col bg-card-solid/30 border-r border-border/50 backdrop-blur-sm',
        // Desktop: always visible
        'hidden lg:flex lg:w-64 lg:relative',
        // Mobile: slide-out panel
        isOpen && 'fixed inset-y-0 left-0 z-50 flex w-72 lg:relative lg:w-64'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors flex-1"
          >
            <span className="text-lg leading-none">+</span>
            New Chat
          </button>
          <button onClick={onToggle} className="lg:hidden ml-2 text-muted hover:text-foreground p-1">
            ✕
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted/50 text-center py-8">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={cn(
                  'flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group',
                  activeId === conv.id
                    ? 'bg-accent/10 border border-accent/20'
                    : 'hover:bg-card-solid/50 border border-transparent'
                )}
                onClick={() => { onSelect(conv.id); onToggle(); }}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className={cn('flex-1 min-w-0', privacyMode && 'blur-sm select-none')}>
                  <p className="text-sm text-foreground truncate">{conv.title}</p>
                  <p className="text-[10px] text-muted/50 mt-0.5">
                    {formatDate(conv.updatedAt)} · {conv.messages.length} messages
                  </p>
                </div>
                {hoveredId === conv.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="flex-shrink-0 text-muted hover:text-loss transition-colors text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
