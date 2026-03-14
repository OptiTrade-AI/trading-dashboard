'use client';

import type { Node } from '@xyflow/react';

interface NodeDetailPanelProps {
  node: Node | null;
  onClose: () => void;
  privacyMode: boolean;
}

export function NodeDetailPanel({ node, onClose, privacyMode }: NodeDetailPanelProps) {
  if (!node) return null;

  const data = node.data as Record<string, unknown>;

  return (
    <div className="absolute top-2 right-2 w-72 max-h-[460px] z-10 bg-zinc-900/95 border border-zinc-700/50 rounded-xl shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-foreground capitalize">
          {node.type?.replace('Node', '') || 'Node'} Details
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground transition-colors p-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
        {/* Thinking node */}
        {node.type === 'thinkingNode' && (
          <>
            <div>
              <span className="text-muted text-[10px] uppercase tracking-wide">Full Reasoning</span>
              <p className="text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed text-[11px]">
                {String(data.text || '')}
              </p>
            </div>
            {data.tokens && (
              <div className="flex gap-3">
                <div>
                  <span className="text-muted text-[10px]">Input Tokens</span>
                  <p className="text-foreground font-semibold">{(data.tokens as { input: number }).input}</p>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Output Tokens</span>
                  <p className="text-foreground font-semibold">{(data.tokens as { output: number }).output}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tool node */}
        {node.type === 'toolNode' && (
          <>
            <div>
              <span className="text-muted text-[10px] uppercase tracking-wide">Tool</span>
              <p className="text-blue-400 font-semibold mt-0.5">{String(data.icon)} {String(data.label)}</p>
              <p className="text-[10px] text-muted font-mono">{String(data.toolName)}</p>
            </div>
            {data.callStep && (
              <div>
                <span className="text-muted text-[10px] uppercase tracking-wide">Input</span>
                <pre className="text-[10px] text-zinc-400 bg-zinc-950/50 rounded-lg p-2 mt-1 overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                  {JSON.stringify((data.callStep as { toolInput?: unknown }).toolInput, null, 2)}
                </pre>
              </div>
            )}
            {data.resultStep && (
              <div>
                <span className="text-muted text-[10px] uppercase tracking-wide">Result</span>
                <pre className="text-[10px] text-zinc-400 bg-zinc-950/50 rounded-lg p-2 mt-1 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                  {privacyMode ? '{ ... masked ... }' : JSON.stringify((data.resultStep as { toolResult?: unknown }).toolResult, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}

        {/* Start node */}
        {node.type === 'startNode' && (
          <div>
            <span className="text-muted text-[10px]">Tickers</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(data.tickers as string[])?.map(t => (
                <span key={t} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-semibold">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Final node */}
        {node.type === 'finalNode' && (
          <div>
            <span className="text-muted text-[10px]">Result</span>
            <p className="text-zinc-300 mt-1">{String(data.text)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
