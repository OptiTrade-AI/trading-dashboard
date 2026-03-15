'use client';

import type { ScreenerTab, ScreenerFilters, CspOpportunity, PcsOpportunity, ChartSetup, SwingSignal, AggressiveOpportunity, ScreenerTickerChanges } from '@/types';
import { CspResultsView } from './CspResultsView';
import { PcsResultsView } from './PcsResultsView';
import { AggressiveResultsView } from './AggressiveResultsView';
import { ChartSetupsResultsView } from './ChartSetupsResultsView';
import { SwingResultsView } from './SwingResultsView';

interface ScreenerResultsPanelProps {
  activeTab: ScreenerTab;
  filters: ScreenerFilters;
  // CSP
  cspData: CspOpportunity[];
  onCspTradeClick: (opp: CspOpportunity) => void;
  // PCS
  pcsData: PcsOpportunity[];
  onPcsTradeClick?: (opp: PcsOpportunity) => void;
  // Aggressive
  aggressiveCalls: AggressiveOpportunity[];
  aggressivePuts: AggressiveOpportunity[];
  aggressiveTickerChanges: { calls: ScreenerTickerChanges | null; puts: ScreenerTickerChanges | null };
  // Charts
  chartSetups: ChartSetup[];
  // Swing
  longSignals: SwingSignal[];
  shortSignals: SwingSignal[];
  // Loading
  isLoading: boolean;
}

export function ScreenerResultsPanel({
  activeTab,
  filters,
  cspData,
  onCspTradeClick,
  pcsData,
  onPcsTradeClick,
  aggressiveCalls,
  aggressivePuts,
  aggressiveTickerChanges,
  chartSetups,
  longSignals,
  shortSignals,
  isLoading,
}: ScreenerResultsPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center text-muted animate-pulse">
        Loading screener data...
      </div>
    );
  }

  switch (activeTab) {
    case 'csp':
      return <CspResultsView data={cspData} filters={filters} onTradeClick={onCspTradeClick} />;
    case 'pcs':
      return <PcsResultsView data={pcsData} filters={filters} onTradeClick={onPcsTradeClick} />;
    case 'aggressive':
      return (
        <AggressiveResultsView
          calls={aggressiveCalls}
          puts={aggressivePuts}
          tickerChanges={aggressiveTickerChanges}
          filters={filters}
        />
      );
    case 'charts':
      return <ChartSetupsResultsView data={chartSetups} filters={filters} />;
    case 'swing':
      return <SwingResultsView longSignals={longSignals} shortSignals={shortSignals} filters={filters} />;
    default:
      return null;
  }
}
