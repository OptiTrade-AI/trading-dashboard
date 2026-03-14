import { Handle, Position } from '@xyflow/react';

interface FinalNodeData {
  text: string;
  durationMs?: number;
  costUsd?: number;
  privacyMode?: boolean;
}

export function FinalNode({ data }: { data: FinalNodeData }) {
  const mask = (val: string) => data.privacyMode ? '***' : val;

  return (
    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-4 py-3 shadow-lg shadow-emerald-500/5 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!bg-emerald-400 !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">✨</span>
        <span className="text-xs font-bold text-emerald-400">Complete</span>
      </div>

      <p className="text-[10px] text-zinc-400">{data.text}</p>

      <div className="flex items-center gap-3 mt-2">
        {data.durationMs != null && (
          <span className="text-[9px] text-muted/50">
            {(data.durationMs / 1000).toFixed(1)}s total
          </span>
        )}
        {data.costUsd != null && (
          <span className="text-[9px] text-muted/50">
            {mask(`$${data.costUsd.toFixed(4)}`)}
          </span>
        )}
      </div>
    </div>
  );
}
