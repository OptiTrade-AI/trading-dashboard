'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useScreenerHub } from '@/hooks/useScreenerHub';
import { useTrades } from '@/hooks/useTrades';
import { ScreenerPipelineStrip } from './ScreenerPipelineStrip';
import { ScreenerOverviewCards } from './ScreenerOverviewCards';
import { ScreenerTabBar } from './ScreenerTabBar';
import { ScreenerFilterBar, defaultScreenerFilters } from './ScreenerFilterBar';
import { ScreenerResultsPanel } from './ScreenerResultsPanel';
import { AddTradeModal, type TradeInitialValues } from '@/components/TradeModal';
import type { ScreenerTab, ScreenerFilters, CspOpportunity } from '@/types';

export function ScreenerHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = (searchParams.get('tab') ?? 'csp') as ScreenerTab;
  const validTabs: ScreenerTab[] = ['csp', 'aggressive'];
  const activeTab = validTabs.includes(tabParam) ? tabParam : 'csp';

  const hub = useScreenerHub();
  const { addTrade } = useTrades();

  // Filters
  const [filters, setFilters] = useState<ScreenerFilters>({ ...defaultScreenerFilters });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Trade modal state
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeInitial, setTradeInitial] = useState<TradeInitialValues | undefined>();

  // Sectors for CSP filter
  const sectors = useMemo(() => {
    const set = new Set(hub.cspData.map((d) => d.sector).filter(Boolean));
    return Array.from(set).sort();
  }, [hub.cspData]);

  const setTab = useCallback(
    (tab: ScreenerTab) => {
      router.push(`/screeners?tab=${tab}`, { scroll: false });
      // Reset filters when switching tabs
      setFilters({ ...defaultScreenerFilters });
      setActivePreset(null);
    },
    [router],
  );

  const handleCspTradeClick = useCallback((opp: CspOpportunity) => {
    setTradeInitial({
      ticker: opp.ticker,
      strike: opp.strike,
      expiration: opp.expiration,
      premium: opp.premium,
    });
    setTradeModalOpen(true);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Screeners</h1>
          <p className="text-sm text-muted mt-0.5">
            {hub.totalOpportunities} opportunities across {Object.keys(hub.counts).length} screeners
          </p>
        </div>
      </div>

      {/* Pipeline Strip */}
      <ScreenerPipelineStrip
        pipelines={hub.pipelines}
        counts={hub.counts}
        runningPipelines={hub.runningPipelines}
        activeRunType={hub.activeRunType}
        progressEvent={hub.progressEvent}
        isRunningAll={hub.isRunningAll}
        onRunPipeline={hub.runPipeline}
        onRunAll={hub.runAll}
      />

      {/* Overview Cards */}
      <ScreenerOverviewCards
        topCsp={hub.topCsp}
        pipelineHealth={hub.pipelineHealth}
        totalOpportunities={hub.totalOpportunities}
        onTabChange={setTab}
      />

      {/* Tab Bar */}
      <ScreenerTabBar activeTab={activeTab} onChange={setTab} counts={hub.counts} />

      {/* Filter Bar */}
      <ScreenerFilterBar
        activeTab={activeTab}
        filters={filters}
        onChange={setFilters}
        activePreset={activePreset}
        onPreset={setActivePreset}
        sectors={sectors}
      />

      {/* Results */}
      <ScreenerResultsPanel
        activeTab={activeTab}
        filters={filters}
        cspData={hub.cspData}
        onCspTradeClick={handleCspTradeClick}
        aggressiveCalls={hub.aggressiveData?.calls ?? []}
        aggressivePuts={hub.aggressiveData?.puts ?? []}
        aggressiveTickerChanges={{
          calls: hub.aggressiveData?.ticker_changes?.calls ?? null,
          puts: hub.aggressiveData?.ticker_changes?.puts ?? null,
        }}
        isLoading={hub.isLoading}
      />

      {/* Trade Modal */}
      <AddTradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        onSubmit={addTrade}
        initialValues={tradeInitial}
      />
    </div>
  );
}
