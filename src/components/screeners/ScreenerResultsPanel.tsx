'use client';

import type { ScreenerTab, ScreenerFilters, CspOpportunity, AggressiveOpportunity, ScreenerTickerChanges } from '@/types';
import { CspResultsView } from './CspResultsView';
import { AggressiveResultsView } from './AggressiveResultsView';

interface ScreenerResultsPanelProps {
  activeTab: ScreenerTab;
  filters: ScreenerFilters;
  // CSP
  cspData: CspOpportunity[];
  onCspTradeClick: (opp: CspOpportunity) => void;
  // Aggressive
  aggressiveCalls: AggressiveOpportunity[];
  aggressivePuts: AggressiveOpportunity[];
  aggressiveTickerChanges: { calls: ScreenerTickerChanges | null; puts: ScreenerTickerChanges | null };
  // Loading
  isLoading: boolean;
}

export function ScreenerResultsPanel({
  activeTab,
  filters,
  cspData,
  onCspTradeClick,
  aggressiveCalls,
  aggressivePuts,
  aggressiveTickerChanges,
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
    case 'aggressive':
      return (
        <AggressiveResultsView
          calls={aggressiveCalls}
          puts={aggressivePuts}
          tickerChanges={aggressiveTickerChanges}
          filters={filters}
        />
      );
    default:
      return null;
  }
}
