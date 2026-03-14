'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useHoldings } from '@/hooks/useHoldings';
import { useCoveredCalls } from '@/hooks/useCoveredCalls';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useCallOptimizer } from '@/hooks/useCallOptimizer';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { OptimizerTickerStrip } from '@/components/optimizer/OptimizerTickerStrip';
import { OptimizerHoldingSummary } from '@/components/optimizer/OptimizerHoldingSummary';
import { OptimizerParamControls } from '@/components/optimizer/OptimizerParamControls';
import { OptimizerChainTable } from '@/components/optimizer/OptimizerChainTable';
import { OptimizerRecoveryChart } from '@/components/optimizer/OptimizerRecoveryChart';
import { OptimizerScatterChart } from '@/components/optimizer/OptimizerScatterChart';
import { OptimizerAIPanel, type ProgressData } from '@/components/optimizer/OptimizerAIPanel';
import { OptimizerTraceViewer } from '@/components/optimizer/OptimizerTraceViewer';
import { TraceHistoryDrawer } from '@/components/optimizer/TraceHistoryDrawer';
import { AddCCModal, type AddCCInitialValues } from '@/components/CCModal';
import type { OptimizerRow, OptimizerAIAnalysis, AgentTraceStep, AgentTrace } from '@/types';
import { format } from 'date-fns';

export default function OptimizerPageWrapper() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-muted text-sm">Loading optimizer...</div>
      </div>
    }>
      <OptimizerPage />
    </Suspense>
  );
}

function OptimizerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { privacyMode } = usePrivacy();

  const { holdings } = useHoldings();
  const { openCalls, addCall } = useCoveredCalls();
  const { getCostBasis } = useHoldings();

  // Get unique tickers from holdings
  const holdingTickers = [...new Set(holdings.map(h => h.ticker.toUpperCase()))];
  const { prices: stockPrices } = useStockPrices(holdingTickers);

  // Selected ticker (from URL or click)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    searchParams.get('ticker')?.toUpperCase() || null
  );

  // CC modal state
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccInitialValues, setCcInitialValues] = useState<AddCCInitialValues | undefined>();

  // Trace history state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedTrace, setSavedTrace] = useState<AgentTrace | null>(null);

  // Portfolio-wide AI analysis state
  const [portfolioAnalyses, setPortfolioAnalyses] = useState<OptimizerAIAnalysis[]>([]);
  const [portfolioAiLoading, setPortfolioAiLoading] = useState(false);
  const [portfolioTrace, setPortfolioTrace] = useState<AgentTraceStep[]>([]);
  const [portfolioTraceMeta, setPortfolioTraceMeta] = useState<{ traceId?: string; totalSteps?: number; durationMs?: number; costUsd?: number } | null>(null);
  const [portfolioAiError, setPortfolioAiError] = useState<string | null>(null);
  const [portfolioAiProgress, setPortfolioAiProgress] = useState('');
  const [portfolioProgressData, setPortfolioProgressData] = useState<ProgressData | null>(null);

  // Optimizer hook for selected ticker
  const optimizer = useCallOptimizer(selectedTicker);

  // Update URL when ticker changes
  const handleSelectTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    router.replace(`/optimizer?ticker=${ticker}`, { scroll: false });
  }, [router]);

  // Handle URL param changes
  useEffect(() => {
    const urlTicker = searchParams.get('ticker')?.toUpperCase();
    if (urlTicker && urlTicker !== selectedTicker) {
      setSelectedTicker(urlTicker);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write This Call handler
  const handleWriteCall = useCallback((row: OptimizerRow) => {
    if (!optimizer.data) return;
    setCcInitialValues({
      ticker: optimizer.data.ticker,
      strike: row.strike,
      contracts: optimizer.data.availableContracts,
      expiration: row.expiration,
      premiumPerShare: row.midpoint,
      costBasis: optimizer.data.costBasisPerShare * optimizer.data.availableContracts * 100,
    });
    setCcModalOpen(true);
  }, [optimizer.data]);

  // Analyze All handler
  const handleAnalyzeAll = useCallback(async () => {
    // Get all uncovered tickers
    const uncoveredTickers: string[] = [];
    const byTicker: Record<string, number> = {};
    for (const h of holdings) {
      const key = h.ticker.toUpperCase();
      byTicker[key] = (byTicker[key] || 0) + h.shares;
    }
    const coveredByTicker: Record<string, number> = {};
    for (const c of openCalls) {
      const key = c.ticker.toUpperCase();
      coveredByTicker[key] = (coveredByTicker[key] || 0) + c.sharesHeld;
    }
    for (const [ticker, shares] of Object.entries(byTicker)) {
      const covered = coveredByTicker[ticker] || 0;
      const uncovered = Math.max(0, shares - covered);
      if (Math.floor(uncovered / 100) > 0) {
        uncoveredTickers.push(ticker);
      }
    }

    if (uncoveredTickers.length === 0) return;

    setPortfolioAiLoading(true);
    setPortfolioAiError(null);
    setPortfolioAiProgress('Starting portfolio-wide analysis...');
    setPortfolioProgressData(null);
    setPortfolioAnalyses([]);
    setPortfolioTrace([]);
    setPortfolioTraceMeta(null);

    try {
      const res = await fetch('/api/ai/cc-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: uncoveredTickers, mode: 'portfolio' }),
      });

      if (!res.ok) throw new Error('AI analysis failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const event = JSON.parse(payload);
              if (event.type === 'progress') {
                setPortfolioAiProgress(event.message);
                if (event.data) setPortfolioProgressData(event.data);
              } else if (event.type === 'analyses') {
                setPortfolioAnalyses(event.data);
              } else if (event.type === 'analysis') {
                setPortfolioAnalyses(prev => [...prev, event.data]);
              } else if (event.type === 'error') {
                setPortfolioAiError(event.message);
              } else if (event.type === 'trace_step') {
                setPortfolioTrace(prev => [...prev, event.data]);
              } else if (event.type === 'trace_complete') {
                setPortfolioTraceMeta(event.data);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      setPortfolioAiError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setPortfolioAiLoading(false);
      setPortfolioAiProgress('');
      setPortfolioProgressData(null);
    }
  }, [holdings, openCalls]);

  // CC modal submit handler
  const handleCCSubmit = useCallback((call: Parameters<typeof addCall>[0]) => {
    addCall(call);
    setCcModalOpen(false);
    setCcInitialValues(undefined);
    optimizer.refresh();
  }, [addCall, optimizer]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Covered Call Optimizer</h1>
          <p className="text-muted mt-1">
            Find optimal covered calls for underwater positions — with AI-powered analysis
          </p>
        </div>
        <button
          onClick={() => setHistoryOpen(true)}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-muted border border-border/50 hover:text-foreground hover:border-zinc-600 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          History
        </button>
      </div>

      {/* Saved trace banner */}
      {savedTrace && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-sm text-purple-300">
              Viewing saved trace from <span className="font-semibold">{format(new Date(savedTrace.createdAt), 'MMM d, h:mm a')}</span>
              {' — '}{savedTrace.tickers.join(', ')}
            </span>
          </div>
          <button
            onClick={() => setSavedTrace(null)}
            className="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded-lg hover:bg-purple-500/10"
          >
            Back to live
          </button>
        </div>
      )}

      {/* Ticker Strip */}
      <OptimizerTickerStrip
        holdings={holdings}
        openCalls={openCalls}
        stockPrices={stockPrices}
        selectedTicker={selectedTicker}
        onSelect={handleSelectTicker}
        onAnalyzeAll={handleAnalyzeAll}
        aiLoading={portfolioAiLoading}
        privacyMode={privacyMode}
      />

      {/* Portfolio-wide AI Analysis (shown when "Analyze All" runs) */}
      {(portfolioAiLoading || portfolioAiError || portfolioAnalyses.length > 0) && (
        <>
          <OptimizerAIPanel
            analysis={null}
            analyses={portfolioAnalyses}
            loading={portfolioAiLoading}
            error={portfolioAiError}
            progress={portfolioAiProgress}
            progressData={portfolioProgressData}
            privacyMode={privacyMode}
          />
          <OptimizerTraceViewer
            steps={portfolioTrace}
            tickers={holdingTickers}
            traceMeta={portfolioTraceMeta}
            loading={portfolioAiLoading}
            privacyMode={privacyMode}
            progressData={portfolioProgressData}
          />
        </>
      )}

      {/* Selected Ticker Content */}
      {selectedTicker && (
        <>
          {/* Loading state */}
          {optimizer.isLoading && (
            <div className="glass-card p-8 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-accent mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-muted">Loading options chain for {selectedTicker}...</span>
            </div>
          )}

          {/* Error state */}
          {optimizer.error && (
            <div className="glass-card p-6">
              <p className="text-red-400">{optimizer.error}</p>
            </div>
          )}

          {/* Holding Summary */}
          {optimizer.data && (
            <OptimizerHoldingSummary
              data={optimizer.data}
              privacyMode={privacyMode}
              onRunAI={() => optimizer.runAIAnalysis()}
              aiLoading={optimizer.aiLoading}
            />
          )}

          {/* Param Controls */}
          {optimizer.data && (
            <OptimizerParamControls
              params={optimizer.params}
              onPreset={optimizer.applyPreset}
              onUpdate={optimizer.updateParam}
              totalResults={optimizer.unfilteredCount}
              filteredResults={optimizer.chain.length}
            />
          )}

          {/* Per-ticker AI Analysis */}
          {(optimizer.aiLoading || optimizer.aiError || optimizer.aiAnalysis) && (
            <>
              <OptimizerAIPanel
                analysis={optimizer.aiAnalysis}
                loading={optimizer.aiLoading}
                error={optimizer.aiError}
                progress={optimizer.aiProgress}
                progressData={optimizer.aiProgressData}
                privacyMode={privacyMode}
              />
              <OptimizerTraceViewer
                steps={optimizer.aiTrace}
                tickers={selectedTicker ? [selectedTicker] : []}
                traceMeta={optimizer.aiTraceMeta}
                loading={optimizer.aiLoading}
                privacyMode={privacyMode}
                progressData={optimizer.aiProgressData}
              />
            </>
          )}

          {/* Charts */}
          {optimizer.data && optimizer.chain.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OptimizerRecoveryChart
                chain={optimizer.chain}
                costBasisPerShare={optimizer.data.costBasisPerShare}
                stockPrice={optimizer.data.stockPrice}
                privacyMode={privacyMode}
              />
              <OptimizerScatterChart
                chain={optimizer.chain}
                costBasisPerShare={optimizer.data.costBasisPerShare}
                privacyMode={privacyMode}
              />
            </div>
          )}

          {/* Options Chain Table */}
          {optimizer.data && (
            <OptimizerChainTable
              chain={optimizer.chain}
              costBasisPerShare={optimizer.data.costBasisPerShare}
              stockPrice={optimizer.data.stockPrice}
              sortKey={optimizer.sortKey}
              sortAsc={optimizer.sortAsc}
              onSort={optimizer.toggleSort}
              onWriteCall={handleWriteCall}
              aiPickSymbol={optimizer.aiAnalysis?.topPick?.symbol}
              privacyMode={privacyMode}
            />
          )}
        </>
      )}

      {/* Empty state */}
      {!selectedTicker && portfolioAnalyses.length === 0 && !portfolioAiLoading && (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Select a holding to optimize</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Choose a ticker from the strip above to see available covered calls with computed metrics,
            or click &quot;AI Analyze All&quot; for a full portfolio scan with AI-powered recommendations.
          </p>
        </div>
      )}

      {/* Saved trace rendering */}
      {savedTrace && (
        <>
          <OptimizerAIPanel
            analysis={null}
            analyses={savedTrace.result || []}
            loading={false}
            error={null}
            progress=""
            privacyMode={privacyMode}
          />
          <OptimizerTraceViewer
            steps={savedTrace.steps}
            tickers={savedTrace.tickers}
            traceMeta={{
              traceId: savedTrace.id,
              totalSteps: savedTrace.steps.length,
              durationMs: savedTrace.totalDurationMs,
              costUsd: savedTrace.costUsd,
            }}
            loading={false}
            privacyMode={privacyMode}
          />
        </>
      )}

      {/* Add CC Modal */}
      <AddCCModal
        isOpen={ccModalOpen}
        onClose={() => { setCcModalOpen(false); setCcInitialValues(undefined); }}
        onSubmit={handleCCSubmit}
        getCostBasis={getCostBasis}
        initialValues={ccInitialValues}
      />

      {/* Trace History Drawer */}
      <TraceHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(trace) => { setSavedTrace(trace); setHistoryOpen(false); }}
        activeTraceId={savedTrace?.id}
        privacyMode={privacyMode}
      />
    </div>
  );
}
