'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { AgentTraceStep } from '@/types';
import { buildTraceGraph } from './traceLayout';
import { StartNode } from './trace-nodes/StartNode';
import { ThinkingNode } from './trace-nodes/ThinkingNode';
import { ToolNode } from './trace-nodes/ToolNode';
import { FinalNode } from './trace-nodes/FinalNode';
import { NodeDetailPanel } from './trace-nodes/NodeDetailPanel';

const nodeTypes = {
  startNode: StartNode,
  thinkingNode: ThinkingNode,
  toolNode: ToolNode,
  finalNode: FinalNode,
};

interface TraceNodeGraphProps {
  steps: AgentTraceStep[];
  tickers: string[];
  traceMeta: { traceId?: string; totalSteps?: number; durationMs?: number; costUsd?: number } | null;
  loading: boolean;
  privacyMode: boolean;
}

function TraceGraph({ steps, tickers, traceMeta, loading, privacyMode }: TraceNodeGraphProps) {
  const { fitView } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const prevNodeCount = useRef(0);
  const hasFitOnce = useRef(false);

  const { nodes, edges } = useMemo(
    () => buildTraceGraph(steps, tickers, privacyMode, traceMeta),
    [steps, tickers, privacyMode, traceMeta],
  );

  // Auto fit when nodes change during streaming, and on completion
  useEffect(() => {
    if (nodes.length === 0) return;
    const isNewContent = nodes.length !== prevNodeCount.current;
    if (isNewContent) {
      // Re-fit as new nodes stream in, and once more when loading completes
      const delay = hasFitOnce.current ? 150 : 100;
      setTimeout(() => fitView({ padding: 0.15, duration: hasFitOnce.current ? 300 : 400 }), delay);
      hasFitOnce.current = true;
      prevNodeCount.current = nodes.length;
    }
  }, [nodes.length, fitView]);

  // Final fit when streaming completes
  useEffect(() => {
    if (!loading && hasFitOnce.current) {
      setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 200);
    }
  }, [loading, fitView]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  return (
    <div className="relative h-[500px] rounded-xl overflow-hidden bg-zinc-950/50 border border-zinc-800/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!rounded-xl !border-zinc-700/50 !bg-zinc-900/90 !shadow-lg"
        />
      </ReactFlow>

      {/* Detail panel overlay */}
      <NodeDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        privacyMode={privacyMode}
      />

      {/* Loading overlay */}
      {loading && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60">
          <div className="flex items-center gap-3 text-muted">
            <svg className="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Building trace graph...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in provider
export function TraceNodeGraph(props: TraceNodeGraphProps) {
  return (
    <ReactFlowProvider>
      <TraceGraph {...props} />
    </ReactFlowProvider>
  );
}
