'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useCspOptimizer } from '@/hooks/useCspOptimizer';
import { useTrades } from '@/hooks/useTrades';
import { useEarningsDates } from '@/hooks/useEarningsDates';
import { useCspScoreHistory } from '@/hooks/useCspScoreHistory';
import { CspOptimizerPipelineStatus } from '@/components/csp-optimizer/CspOptimizerPipelineStatus';
import { CspOptimizerFilterBar } from '@/components/csp-optimizer/CspOptimizerFilterBar';
import { CspOptimizerSelectionBar } from '@/components/csp-optimizer/CspOptimizerSelectionBar';
import { CspOptimizerTable } from '@/components/csp-optimizer/CspOptimizerTable';
import { CspOptimizerAIPanel, type AIViewMode } from '@/components/csp-optimizer/CspOptimizerAIPanel';
import { CspOptimizerComparisonView } from '@/components/csp-optimizer/CspOptimizerComparisonView';
import { OptimizerTraceViewer } from '@/components/optimizer/OptimizerTraceViewer';
import { TraceHistoryDrawer } from '@/components/optimizer/TraceHistoryDrawer';
import { AddTradeModal, type TradeInitialValues } from '@/components/TradeModal';
import type { CspOpportunity, CspOptimizerAIAnalysis, CspStrategyPick, AgentTrace } from '@/types';

export default function CspOptimizerPageWrapper() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-muted text-sm">Loading CSP optimizer...</div>
      </div>
    }>
      <CspOptimizerPage />
    </Suspense>
  );
}

function CspOptimizerPage() {
  const { privacyMode } = usePrivacy();
  const { addTrade } = useTrades();

  const optimizer = useCspOptimizer();

  // Extract unique tickers for earnings + score history hooks
  const uniqueTickers = useMemo(() => {
    if (!optimizer.screenerData) return [];
    return [...new Set(optimizer.screenerData.map(d => d.ticker))];
  }, [optimizer.screenerData]);

  // Earnings dates
  const { earningsMap } = useEarningsDates(uniqueTickers);

  // Score history
  const { historyMap: scoreHistoryMap } = useCspScoreHistory(uniqueTickers);

  // AI view mode
  const [aiViewMode, setAiViewMode] = useState<AIViewMode>('cards');

  // Trade modal
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeInitialValues | undefined>();

  // Trace drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replayTrace, setReplayTrace] = useState<AgentTrace | null>(null);

  // Handle "Write This Put" from table
  const handleWritePutFromTable = useCallback((opp: CspOpportunity) => {
    setTradeInitial({
      ticker: opp.ticker,
      strike: opp.strike,
      expiration: opp.expiration,
      premium: opp.premium,
    });
    setTradeModalOpen(true);
  }, []);

  // Handle "Write This Put" from AI panel
  const handleWritePutFromAI = useCallback((ticker: string, pick: CspStrategyPick) => {
    setTradeInitial({
      ticker,
      strike: pick.strike,
      expiration: pick.expiration,
      premium: pick.premium,
    });
    setTradeModalOpen(true);
  }, []);

  // Handle trace history selection
  const handleTraceSelect = useCallback((trace: AgentTrace) => {
    setReplayTrace(trace);
    setHistoryOpen(false);
  }, []);

  // Build analyses map from replay trace results when replaying
  const displayAnalyses = useMemo(() => {
    if (replayTrace?.result && replayTrace.result.length > 0) {
      const map = new Map<string, CspOptimizerAIAnalysis>();
      for (const r of replayTrace.result as CspOptimizerAIAnalysis[]) {
        if (r.ticker) map.set(r.ticker, r);
      }
      return map;
    }
    return optimizer.analyses;
  }, [replayTrace, optimizer.analyses]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CSP Optimizer</h1>
          <p className="text-sm text-muted mt-0.5">Pipeline screening + AI-powered deep analysis</p>
        </div>
        <button
          onClick={() => setHistoryOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          History
        </button>
      </div>

      {/* Pipeline status + run controls */}
      <CspOptimizerPipelineStatus
        totalCount={optimizer.totalCount}
        onPipelineComplete={optimizer.refresh}
      />

      {/* Filters */}
      <CspOptimizerFilterBar
        filters={optimizer.filters}
        setFilters={optimizer.setFilters}
        activePreset={optimizer.activePreset}
        onPreset={optimizer.applyPreset}
        sectors={optimizer.sectors}
        filteredCount={optimizer.filteredCount}
        totalCount={optimizer.totalCount}
      />

      {/* Selection bar */}
      <CspOptimizerSelectionBar
        selectedCount={optimizer.selectedTickers.size}
        totalCount={optimizer.filteredCount}
        aiLoading={optimizer.aiLoading}
        onSelectTopN={optimizer.selectTopN}
        onAnalyze={() => optimizer.runAIAnalysis()}
        onAnalyzeTopN={optimizer.analyzeTopN}
        onClear={optimizer.clearSelection}
      />

      {/* Table */}
      {optimizer.screenerLoading ? (
        <div className="text-center py-12 text-muted text-sm">Loading pipeline results...</div>
      ) : optimizer.screenerError ? (
        <div className="text-center py-12 text-loss text-sm">{optimizer.screenerError}</div>
      ) : (
        <CspOptimizerTable
          data={optimizer.screenerData}
          selectedTickers={optimizer.selectedTickers}
          analyzingTickers={optimizer.analyzingTickers}
          analyzedTickers={optimizer.analyzedTickers}
          onToggleTicker={optimizer.toggleTicker}
          onWritePut={handleWritePutFromTable}
          earningsMap={earningsMap}
          scoreHistoryMap={scoreHistoryMap}
        />
      )}

      {/* AI Analysis Panel */}
      <CspOptimizerAIPanel
        analyses={displayAnalyses}
        loading={optimizer.aiLoading}
        error={optimizer.aiError}
        progress={optimizer.aiProgress}
        progressData={optimizer.aiProgressData}
        onWritePut={handleWritePutFromAI}
        privacyMode={privacyMode}
        viewMode={aiViewMode}
        onViewModeChange={setAiViewMode}
      />

      {/* Comparison View */}
      {aiViewMode === 'compare' && displayAnalyses.size >= 2 && (
        <CspOptimizerComparisonView
          analyses={displayAnalyses}
          onWritePut={handleWritePutFromAI}
          privacyMode={privacyMode}
        />
      )}

      {/* Trace Viewer */}
      {(optimizer.aiTrace.length > 0 || replayTrace) && (
        <OptimizerTraceViewer
          steps={replayTrace?.steps || optimizer.aiTrace}
          traceMeta={replayTrace ? {
            traceId: replayTrace.id,
            totalSteps: replayTrace.steps.length,
            durationMs: replayTrace.totalDurationMs,
            costUsd: replayTrace.costUsd,
          } : optimizer.aiTraceMeta}
          loading={optimizer.aiLoading}
          privacyMode={privacyMode}
        />
      )}

      {/* Trade Modal */}
      <AddTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        onSubmit={addTrade}
        initialValues={tradeInitial}
      />

      {/* Trace History Drawer */}
      <TraceHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleTraceSelect}
        activeTraceId={optimizer.aiTraceMeta?.traceId}
        privacyMode={privacyMode}
        feature="csp-optimizer"
      />
    </div>
  );
}
