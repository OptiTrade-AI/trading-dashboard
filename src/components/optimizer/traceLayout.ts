import type { Node, Edge } from '@xyflow/react';
import type { AgentTraceStep } from '@/types';

// ── Types ──

interface ToolPair {
  call: AgentTraceStep;
  result: AgentTraceStep | null;
}

interface TraceIteration {
  thinking: AgentTraceStep | null;
  toolPairs: ToolPair[];
}

export interface TraceGraphData {
  nodes: Node[];
  edges: Edge[];
}

// ── Helpers ──

const TOOL_ICONS: Record<string, string> = {
  get_options_chain: '📊',
  get_stock_price: '💹',
  get_historical_prices: '📈',
  get_holdings_data: '💼',
  get_cc_history: '📋',
  web_search: '🔍',
};

const TOOL_LABELS: Record<string, string> = {
  get_options_chain: 'Options Chain',
  get_stock_price: 'Stock Price',
  get_historical_prices: 'Historical Data',
  get_holdings_data: 'Holdings',
  get_cc_history: 'CC History',
  web_search: 'Web Search',
};

function summarizeToolInput(input?: Record<string, unknown>): string {
  if (!input) return '';
  if (input.ticker) return String(input.ticker);
  if (input.query) return String(input.query).slice(0, 40);
  return Object.values(input).map(String).join(', ').slice(0, 40);
}

function summarizeToolResult(result: unknown, privacyMode: boolean): string {
  if (!result || typeof result !== 'object') return '—';
  const r = result as Record<string, unknown>;
  if (r.error) return `Error: ${r.error}`;
  if (r.contracts && Array.isArray(r.contracts)) return `${(r.contracts as unknown[]).length} contracts`;
  if (r.price != null) return privacyMode ? 'Price: ***' : `$${r.price}`;
  if (r.results && Array.isArray(r.results)) return `${(r.results as unknown[]).length} results`;
  if (r.totalShares != null) return privacyMode ? '*** shares' : `${r.totalShares} shares`;
  if (r.totalClosedTrades != null) return `${r.totalClosedTrades} trades`;
  if (r.days != null) return `${r.days} bars`;
  return 'Done';
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Layout constants ──

const COL_GAP = 340;
const ROW_GAP = 130;
const START_X = 0;
const START_Y = 80;
const NODE_W = 210;

// ── Main transform ──

export function buildTraceGraph(
  steps: AgentTraceStep[],
  tickers: string[],
  privacyMode: boolean,
  traceMeta?: { totalSteps?: number; durationMs?: number; costUsd?: number } | null,
): TraceGraphData {
  if (steps.length === 0) return { nodes: [], edges: [] };

  // 1. Pair tool_call ↔ tool_result
  const usedResults = new Set<number>();
  function findResult(callIdx: number, toolName: string): AgentTraceStep | null {
    for (let i = callIdx + 1; i < steps.length; i++) {
      if (steps[i].type === 'tool_result' && steps[i].toolName === toolName && !usedResults.has(i)) {
        usedResults.add(i);
        return steps[i];
      }
    }
    return null;
  }

  // 2. Group into iterations
  const iterations: TraceIteration[] = [];
  let current: TraceIteration = { thinking: null, toolPairs: [] };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === 'thinking') {
      // Start new iteration if current has content
      if (current.thinking || current.toolPairs.length > 0) {
        iterations.push(current);
        current = { thinking: null, toolPairs: [] };
      }
      current.thinking = step;
    } else if (step.type === 'tool_call') {
      const result = findResult(i, step.toolName || '');
      current.toolPairs.push({ call: step, result });
    } else if (step.type === 'final_answer') {
      // Push current iteration then we'll handle final separately
      if (current.thinking || current.toolPairs.length > 0) {
        iterations.push(current);
        current = { thinking: null, toolPairs: [] };
      }
    }
    // tool_result handled via pairing above
  }
  // Push last iteration if has content
  if (current.thinking || current.toolPairs.length > 0) {
    iterations.push(current);
  }

  const finalStep = steps.find(s => s.type === 'final_answer');

  // 3. Generate nodes and edges
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Start node
  nodes.push({
    id: 'start',
    type: 'startNode',
    position: { x: START_X, y: START_Y },
    data: { tickers, timestamp: steps[0]?.timestamp },
  });

  let prevId = 'start';

  // Track last tool node ID per iteration for connecting to next iteration
  let lastToolIdInPrevIter: string | null = null;

  iterations.forEach((iter, colIdx) => {
    const x = START_X + (colIdx + 1) * COL_GAP;

    // Thinking node
    if (iter.thinking) {
      const thinkId = `think-${colIdx}`;
      nodes.push({
        id: thinkId,
        type: 'thinkingNode',
        position: { x, y: START_Y },
        data: {
          text: iter.thinking.thinking || '',
          iteration: colIdx + 1,
          durationMs: iter.thinking.durationMs,
          tokens: iter.thinking.tokens,
        },
      });

      // Edge from previous thinking node (reasoning chain at top)
      edges.push({
        id: `e-${prevId}-${thinkId}`,
        source: prevId,
        target: thinkId,
        type: 'smoothstep',
        style: { stroke: '#3f3f46', strokeWidth: 1.5 },
        animated: false,
      });

      // Also connect last tool from previous iteration → this thinking node
      // This shows the flow: tools complete → agent reasons again
      if (lastToolIdInPrevIter) {
        edges.push({
          id: `e-toolreturn-${lastToolIdInPrevIter}-${thinkId}`,
          source: lastToolIdInPrevIter,
          target: thinkId,
          type: 'smoothstep',
          style: { stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4,4' },
          animated: false,
        });
      }

      prevId = thinkId;
      lastToolIdInPrevIter = null;

      // Tool nodes below thinking
      iter.toolPairs.forEach((pair, toolIdx) => {
        const toolId = `tool-${colIdx}-${toolIdx}`;
        const toolName = pair.call.toolName || 'unknown';
        nodes.push({
          id: toolId,
          type: 'toolNode',
          position: { x, y: START_Y + (toolIdx + 1) * ROW_GAP },
          data: {
            icon: TOOL_ICONS[toolName] || '🔧',
            label: TOOL_LABELS[toolName] || toolName,
            toolName,
            inputSummary: summarizeToolInput(pair.call.toolInput),
            resultSummary: pair.result ? summarizeToolResult(pair.result.toolResult, privacyMode) : null,
            durationMs: pair.result?.durationMs,
            hasError: pair.result?.toolResult && typeof pair.result.toolResult === 'object' && 'error' in (pair.result.toolResult as Record<string, unknown>),
            loading: pair.result === null,
            callStep: pair.call,
            resultStep: pair.result,
            privacyMode,
          },
        });

        // Edge from thinking to tool
        edges.push({
          id: `e-${thinkId}-${toolId}`,
          source: thinkId,
          target: toolId,
          type: 'smoothstep',
          style: { stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '6,4' },
          animated: false,
        });

        // Track last tool for return edge to next iteration
        lastToolIdInPrevIter = toolId;
      });
    }
  });

  // Final node
  if (finalStep) {
    const finalX = START_X + (iterations.length + 1) * COL_GAP;
    nodes.push({
      id: 'final',
      type: 'finalNode',
      position: { x: finalX, y: START_Y },
      data: {
        text: finalStep.thinking || 'Analysis complete',
        durationMs: traceMeta?.durationMs,
        costUsd: traceMeta?.costUsd,
        privacyMode,
      },
    });

    edges.push({
      id: `e-${prevId}-final`,
      source: prevId,
      target: 'final',
      type: 'smoothstep',
      style: { stroke: '#10b981', strokeWidth: 2 },
      animated: true,
    });
  }

  return { nodes, edges };
}

export { TOOL_ICONS, TOOL_LABELS, summarizeToolInput, summarizeToolResult, formatMs, NODE_W };
