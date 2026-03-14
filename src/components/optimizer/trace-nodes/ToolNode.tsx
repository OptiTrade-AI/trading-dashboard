import { Handle, Position } from '@xyflow/react';

interface ToolNodeData {
  icon: string;
  label: string;
  toolName: string;
  inputSummary: string;
  resultSummary: string | null;
  durationMs?: number;
  hasError?: boolean;
  loading?: boolean;
  privacyMode?: boolean;
}

export function ToolNode({ data }: { data: ToolNodeData }) {
  return (
    <div className="rounded-xl shadow-lg shadow-black/20 overflow-hidden min-w-[200px] max-w-[210px] border border-zinc-700/40">
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-500 !w-2 !h-2 !border-0" />

      {/* Call section (blue) */}
      <div className="bg-blue-950/50 px-3 py-2.5 border-b border-zinc-700/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{data.icon}</span>
          <span className="text-[10px] font-bold text-blue-400">{data.label}</span>
        </div>
        <p className="text-[10px] text-zinc-400 font-mono truncate">{data.inputSummary}</p>
      </div>

      {/* Result section (green/red/loading) */}
      <div className={
        data.loading
          ? 'bg-zinc-900/80 px-3 py-2.5'
          : data.hasError
          ? 'bg-red-950/30 px-3 py-2.5'
          : 'bg-emerald-950/30 px-3 py-2.5'
      }>
        {data.loading ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-[10px] text-muted animate-pulse">Running...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-medium ${data.hasError ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.hasError ? '✗' : '✓'} {data.resultSummary || '—'}
              </span>
            </div>
            {data.durationMs != null && (
              <span className="text-[9px] text-muted/40 mt-0.5 block">
                {data.durationMs < 1000 ? `${data.durationMs}ms` : `${(data.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
