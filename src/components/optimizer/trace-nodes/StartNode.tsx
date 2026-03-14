import { Handle, Position } from '@xyflow/react';

interface StartNodeData {
  tickers: string[];
  timestamp?: string;
}

export function StartNode({ data }: { data: StartNodeData }) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-700/50 rounded-xl px-4 py-3 shadow-lg min-w-[180px]">
      <Handle type="source" position={Position.Right} className="!bg-zinc-500 !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🚀</span>
        <span className="text-xs font-bold text-foreground">Analysis Started</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.tickers?.map(t => (
          <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            {t}
          </span>
        ))}
      </div>
      {data.timestamp && (
        <p className="text-[9px] text-muted/50 mt-1.5">
          {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
