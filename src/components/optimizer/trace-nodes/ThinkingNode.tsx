import { Handle, Position } from '@xyflow/react';

interface ThinkingNodeData {
  text: string;
  iteration: number;
  durationMs?: number;
  tokens?: { input: number; output: number };
}

export function ThinkingNode({ data }: { data: ThinkingNodeData }) {
  const truncated = data.text.length > 120 ? data.text.slice(0, 120) + '...' : data.text;

  return (
    <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl px-4 py-3 shadow-lg shadow-purple-500/5 min-w-[200px] max-w-[220px]">
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} id="tools" className="!bg-blue-400 !w-2 !h-2 !border-0" />

      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🧠</span>
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Reasoning</span>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
          #{data.iteration}
        </span>
      </div>

      <p className="text-[10px] text-zinc-400 leading-relaxed">{truncated}</p>

      <div className="flex items-center gap-2 mt-2">
        {data.durationMs != null && (
          <span className="text-[9px] text-muted/50">
            {data.durationMs < 1000 ? `${data.durationMs}ms` : `${(data.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {data.tokens && (
          <span className="text-[9px] text-muted/50">
            {data.tokens.input + data.tokens.output} tok
          </span>
        )}
      </div>
    </div>
  );
}
