'use client';

import { useState, useMemo } from 'react';
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

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older';

function getDateGroup(iso: string): DateGroup {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay());

  if (d >= startOfToday) return 'Today';
  if (d >= startOfYesterday) return 'Yesterday';
  if (d >= startOfWeek) return 'This Week';
  return 'Older';
}

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Older'];

export function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, privacyMode, isOpen, onToggle,
}: ConversationSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<DateGroup, Conversation[]>();
    for (const conv of conversations) {
      const group = getDateGroup(conv.updatedAt);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(conv);
    }
    return GROUP_ORDER.filter(g => groups.has(g)).map(g => ({ label: g, conversations: groups.get(g)! }));
  }, [conversations]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}

      {/* Sidebar */}
      <div className={cn(
        'flex flex-col bg-card-solid/30 border-r border-border/50 backdrop-blur-sm',
        'hidden lg:flex lg:w-64 lg:relative',
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
            grouped.map(group => (
              <div key={group.label}>
                <div className="px-5 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted/40 font-medium">
                    {group.label}
                  </span>
                </div>
                {group.conversations.map(conv => (
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
                        {conv.messages.length} messages
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
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
