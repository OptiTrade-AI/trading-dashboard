'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { AgentTrace } from '@/types';
import { format } from 'date-fns';

interface TraceSummary {
  id: string;
  name?: string;
  createdAt: string;
  tickers: string[];
  mode: 'single' | 'portfolio';
  totalDurationMs: number;
  costUsd: number;
  stepCount: number;
}

interface TraceHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (trace: AgentTrace) => void;
  activeTraceId?: string;
  privacyMode: boolean;
  feature?: 'cc-optimizer' | 'csp-optimizer';
}

export function TraceHistoryDrawer({ isOpen, onClose, onSelect, activeTraceId, privacyMode, feature }: TraceHistoryDrawerProps) {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch trace list when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/agent-traces?limit=30${feature ? `&feature=${feature}` : ''}`)
      .then(r => r.json())
      .then(data => setTraces(data.traces || []))
      .catch(() => setTraces([]))
      .finally(() => setLoading(false));
  }, [isOpen, feature]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSelect = useCallback(async (traceId: string) => {
    if (editingId) return;
    setLoadingId(traceId);
    try {
      const res = await fetch(`/api/agent-traces?id=${encodeURIComponent(traceId)}`);
      if (!res.ok) throw new Error('Failed to load trace');
      const trace: AgentTrace = await res.json();
      onSelect(trace);
    } catch {
      // silently fail
    } finally {
      setLoadingId(null);
    }
  }, [onSelect, editingId]);

  const startEditing = useCallback((e: React.MouseEvent, trace: TraceSummary) => {
    e.stopPropagation();
    setEditingId(trace.id);
    setEditName(trace.name || '');
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  const saveRename = useCallback(async (traceId: string) => {
    const trimmed = editName.trim();
    setSavingId(traceId);
    try {
      const res = await fetch('/api/agent-traces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: traceId, name: trimmed }),
      });
      if (res.ok) {
        setTraces(prev => prev.map(t =>
          t.id === traceId ? { ...t, name: trimmed || undefined } : t
        ));
      }
    } catch {
      // silently fail
    } finally {
      setSavingId(null);
      setEditingId(null);
      setEditName('');
    }
  }, [editName]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent, traceId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename(traceId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [saveRename, cancelEditing]);

  const mask = (val: string) => privacyMode ? '***' : val;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-sm font-semibold text-foreground">Trace History</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && traces.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-muted">No saved traces yet.</p>
              <p className="text-xs text-muted/50 mt-1">Run an AI analysis to create one.</p>
            </div>
          )}

          {traces.map((trace) => {
            const isActive = trace.id === activeTraceId;
            const isLoading = trace.id === loadingId;
            const isEditing = trace.id === editingId;
            const isSaving = trace.id === savingId;
            const dateStr = format(new Date(trace.createdAt), 'MMM d, h:mm a');
            const duration = trace.totalDurationMs < 1000
              ? `${trace.totalDurationMs}ms`
              : `${(trace.totalDurationMs / 1000).toFixed(1)}s`;

            return (
              <div
                key={trace.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(trace.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(trace.id); } }}
                className={cn(
                  'group w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-colors cursor-pointer',
                  isActive
                    ? 'bg-purple-500/10 border-l-2 border-l-purple-500'
                    : 'hover:bg-zinc-800/50',
                  (isLoading || isEditing) && 'pointer-events-none opacity-60',
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1.5 mb-1" onClick={e => e.stopPropagation()}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => handleEditKeyDown(e, trace.id)}
                      onBlur={() => saveRename(trace.id)}
                      maxLength={100}
                      placeholder="Name this run..."
                      disabled={isSaving}
                      className="flex-1 min-w-0 text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-foreground placeholder:text-muted/40 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    />
                    {isSaving && (
                      <svg className="animate-spin h-3 w-3 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {trace.name ? (
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-foreground block truncate">{trace.name}</span>
                          <span className="text-[10px] text-muted/50">{dateStr}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-foreground">{dateStr}</span>
                      )}
                      <button
                        onClick={(e) => startEditing(e, trace)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted/40 hover:text-foreground shrink-0"
                        title="Rename"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                    </div>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      trace.mode === 'portfolio'
                        ? 'bg-purple-500/10 text-purple-400'
                        : 'bg-blue-500/10 text-blue-400',
                    )}>
                      {trace.mode === 'portfolio' ? 'Portfolio' : 'Single'}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mb-1.5">
                  {trace.tickers.slice(0, 4).map((t, i) => (
                    <span key={`${t}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                      {t}
                    </span>
                  ))}
                  {trace.tickers.length > 4 && (
                    <span className="text-[10px] text-muted">+{trace.tickers.length - 4}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted/60">
                  <span>{trace.stepCount} steps</span>
                  <span>{duration}</span>
                  <span>{mask(`$${trace.costUsd.toFixed(3)}`)}</span>
                </div>
                {isLoading && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <svg className="animate-spin h-3 w-3 text-purple-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[10px] text-purple-400">Loading trace...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
