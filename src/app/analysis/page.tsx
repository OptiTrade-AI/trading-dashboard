'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn, calculatePL, calculateDTE, calculateDirectionalPL, calculateSpreadPL } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';
import { useTrades } from '@/hooks/useTrades';
import { useCoveredCalls } from '@/hooks/useCoveredCalls';
import { useDirectionalTrades } from '@/hooks/useDirectionalTrades';
import { useSpreads } from '@/hooks/useSpreads';
import { useHoldings } from '@/hooks/useHoldings';
import { useStockEvents } from '@/hooks/useStockEvents';
import { useOptionQuotes } from '@/hooks/useOptionQuotes';
import { usePressure } from '@/hooks/usePressure';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { useStockPrices } from '@/hooks/useStockPrices';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { generateStarterPrompts } from '@/lib/starterPrompts';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { StarterCards } from '@/components/chat/StarterCards';

export default function AnalysisPage() {
  const { privacyMode } = usePrivacy();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat state
  const {
    conversations, activeConversation, streamingContent, isStreaming,
    isAvailable, isLoading: isChatLoading, error,
    sendMessage, startNewConversation, selectConversation, deleteConversation,
  } = useChat();

  // All data hooks for portfolio context
  const { openTrades, closedTrades, accountSettings, heat, totalCollateral } = useTrades();
  const { openCalls, closedCalls } = useCoveredCalls();
  const { openTrades: openDirectional, closedTrades: closedDirectional } = useDirectionalTrades();
  const { openSpreads, closedSpreads } = useSpreads();
  const { holdings } = useHoldings();
  const { stockEvents } = useStockEvents();
  const { positions: optionQuotes } = useOptionQuotes();
  const { pressurePositions, stockPrices } = usePressure();
  const { label: marketLabel } = useMarketStatus();

  // Stock prices for holdings
  const holdingTickers = useMemo(() => [...new Set(holdings.map(h => h.ticker))], [holdings]);
  const { prices: holdingPrices } = useStockPrices(holdingTickers);

  // Build portfolio context for AI
  const portfolioContext = useMemo(() => {
    // Open positions with live Greeks
    const openPositions: Record<string, unknown>[] = [];

    for (const t of openTrades) {
      const quote = optionQuotes.get(t.id);
      const sp = stockPrices.find(s => s.ticker === t.ticker);
      openPositions.push({
        id: t.id, ticker: t.ticker, strategy: 'CSP', label: `$${t.strike}P`,
        contracts: t.contracts, dte: calculateDTE(t.expiration), expiration: t.expiration,
        entryDate: t.entryDate, capitalAtRisk: t.collateral,
        unrealizedPL: quote?.unrealizedPL, delta: quote?.delta, gamma: quote?.gamma,
        theta: quote?.theta, vega: quote?.vega, iv: quote?.iv,
        midpoint: quote?.midpoint, bid: quote?.bid, ask: quote?.ask,
        currentStockPrice: sp?.price,
      });
    }
    for (const c of openCalls) {
      const quote = optionQuotes.get(c.id);
      const sp = stockPrices.find(s => s.ticker === c.ticker);
      openPositions.push({
        id: c.id, ticker: c.ticker, strategy: 'CC', label: `$${c.strike}C`,
        contracts: c.contracts, dte: calculateDTE(c.expiration), expiration: c.expiration,
        entryDate: c.entryDate, capitalAtRisk: c.costBasis,
        unrealizedPL: quote?.unrealizedPL, delta: quote?.delta, gamma: quote?.gamma,
        theta: quote?.theta, vega: quote?.vega, iv: quote?.iv,
        midpoint: quote?.midpoint, bid: quote?.bid, ask: quote?.ask,
        currentStockPrice: sp?.price,
      });
    }
    for (const t of openDirectional) {
      const quote = optionQuotes.get(t.id);
      const sp = stockPrices.find(s => s.ticker === t.ticker);
      openPositions.push({
        id: t.id, ticker: t.ticker, strategy: 'Directional',
        label: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'}`,
        contracts: t.contracts, dte: calculateDTE(t.expiration), expiration: t.expiration,
        entryDate: t.entryDate, capitalAtRisk: t.costAtOpen,
        unrealizedPL: quote?.unrealizedPL, delta: quote?.delta, gamma: quote?.gamma,
        theta: quote?.theta, vega: quote?.vega, iv: quote?.iv,
        midpoint: quote?.midpoint, bid: quote?.bid, ask: quote?.ask,
        currentStockPrice: sp?.price,
      });
    }
    for (const s of openSpreads) {
      const quote = optionQuotes.get(s.id);
      const sp = stockPrices.find(p => p.ticker === s.ticker);
      openPositions.push({
        id: s.id, ticker: s.ticker, strategy: 'Spread',
        label: `${s.longStrike}/${s.shortStrike}`,
        contracts: s.contracts, dte: calculateDTE(s.expiration), expiration: s.expiration,
        entryDate: s.entryDate, capitalAtRisk: s.maxLoss,
        unrealizedPL: quote?.unrealizedPL, delta: quote?.delta, gamma: quote?.gamma,
        theta: quote?.theta, vega: quote?.vega, iv: quote?.iv,
        midpoint: quote?.midpoint, bid: quote?.bid, ask: quote?.ask,
        currentStockPrice: sp?.price,
      });
    }

    // Ticker concentration
    const tickerConcentration: Record<string, number> = {};
    for (const p of openPositions) {
      const t = p.ticker as string;
      tickerConcentration[t] = (tickerConcentration[t] || 0) + 1;
    }

    // Closed stats (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentClosedCSPs = closedTrades.filter(t => t.exitDate && new Date(t.exitDate) >= threeMonthsAgo);
    const recentClosedCCs = closedCalls.filter(t => t.exitDate && new Date(t.exitDate) >= threeMonthsAgo);
    const recentClosedDir = closedDirectional.filter(t => t.exitDate && new Date(t.exitDate) >= threeMonthsAgo);
    const recentClosedSpreads = closedSpreads.filter(t => t.exitDate && new Date(t.exitDate) >= threeMonthsAgo);

    const makeStats = <T extends { ticker: string; dteAtEntry: number; entryDate: string; exitDate?: string }>(
      trades: T[], plFn: (t: T) => number, exitReasonFn: (t: T) => string | undefined
    ) => {
      if (trades.length === 0) return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPL: 0, avgPL: 0, avgDaysHeld: 0, avgDTEAtEntry: 0, exitReasons: {}, topTickers: [] as { ticker: string; count: number; pl: number }[] };
      const pls = trades.map(t => ({ ticker: t.ticker, pl: plFn(t) }));
      const wins = pls.filter(p => p.pl > 0).length;
      const totalPL = pls.reduce((s, p) => s + p.pl, 0);
      const exitReasons: Record<string, number> = {};
      for (const t of trades) { const r = exitReasonFn(t) || 'unknown'; exitReasons[r] = (exitReasons[r] || 0) + 1; }
      const tickerMap = new Map<string, { count: number; pl: number }>();
      for (const p of pls) { const e = tickerMap.get(p.ticker) || { count: 0, pl: 0 }; e.count++; e.pl += p.pl; tickerMap.set(p.ticker, e); }
      const topTickers = Array.from(tickerMap.entries()).map(([ticker, s]) => ({ ticker, ...s })).sort((a, b) => b.count - a.count).slice(0, 10);
      const daysHeld = trades.map(t => { const d = t.exitDate ? Math.max(1, Math.round((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 86400000)) : 1; return d; });
      return {
        totalTrades: trades.length, wins, losses: trades.length - wins,
        winRate: (wins / trades.length) * 100, totalPL, avgPL: totalPL / trades.length,
        avgDaysHeld: daysHeld.reduce((s, d) => s + d, 0) / daysHeld.length,
        avgDTEAtEntry: trades.reduce((s, t) => s + t.dteAtEntry, 0) / trades.length,
        exitReasons, topTickers,
      };
    };

    const cspStats = makeStats(recentClosedCSPs, calculatePL, t => t.exitReason);
    const ccStats = makeStats(recentClosedCCs, (c) => c.premiumCollected - (c.exitPrice ?? 0), t => t.exitReason);
    const dirStats = makeStats(recentClosedDir, calculateDirectionalPL, t => t.exitReason);
    const spreadStats = makeStats(recentClosedSpreads, calculateSpreadPL, t => t.exitReason);

    // Holdings with prices
    const holdingsData = holdings.map(h => {
      const price = holdingPrices.get(h.ticker);
      const currentPrice = price?.price;
      const unrealizedPL = currentPrice ? (currentPrice - h.costBasisPerShare) * h.shares : undefined;
      return { ticker: h.ticker, shares: h.shares, costBasisPerShare: h.costBasisPerShare, currentPrice, unrealizedPL };
    });

    const totalCapitalAtRisk = openPositions.reduce((s, p) => s + Number(p.capitalAtRisk || 0), 0);

    return {
      accountValue: accountSettings.accountValue,
      maxHeatPercent: accountSettings.maxHeatPercent,
      heat,
      totalCollateral,
      totalCapitalAtRisk,
      marketStatus: marketLabel,
      openPositions,
      pressurePositions: pressurePositions.map(p => ({
        ticker: p.ticker, severity: p.severity, dte: p.dte, label: p.label,
        currentPrice: p.currentPrice, priceToStrikePercent: p.priceToStrikePercent,
      })),
      holdings: holdingsData,
      tickerConcentration,
      closedStats: {
        csp: cspStats, cc: ccStats, directional: dirStats, spreads: spreadStats,
        totalPL: cspStats.totalPL + ccStats.totalPL + dirStats.totalPL + spreadStats.totalPL,
        totalTrades: cspStats.totalTrades + ccStats.totalTrades + dirStats.totalTrades + spreadStats.totalTrades,
      },
      stockEvents: stockEvents.slice(0, 10).map(e => ({
        ticker: e.ticker, shares: e.shares, realizedPL: e.realizedPL,
        saleDate: e.saleDate, isTaxLossHarvest: e.isTaxLossHarvest,
      })),
    };
  }, [
    openTrades, openCalls, openDirectional, openSpreads, closedTrades, closedCalls,
    closedDirectional, closedSpreads, optionQuotes, pressurePositions, holdings,
    holdingPrices, stockEvents, stockPrices, accountSettings, heat, totalCollateral, marketLabel,
  ]);

  // Smart starter prompts
  const starterPrompts = useMemo(() => {
    const allRecentClosed = [
      ...closedTrades.map(t => ({ pl: calculatePL(t), exitDate: t.exitDate || '' })),
      ...closedCalls.map(c => ({ pl: c.premiumCollected - (c.exitPrice ?? 0), exitDate: c.exitDate || '' })),
      ...closedDirectional.map(t => ({ pl: calculateDirectionalPL(t), exitDate: t.exitDate || '' })),
      ...closedSpreads.map(t => ({ pl: calculateSpreadPL(t), exitDate: t.exitDate || '' })),
    ].filter(t => t.exitDate);

    return generateStarterPrompts({
      openPositions: (portfolioContext.openPositions as { ticker: string; dte: number; strategy: string; unrealizedPL?: number; contracts: number; capitalAtRisk: number }[]) || [],
      heat,
      maxHeatPercent: accountSettings.maxHeatPercent,
      pressurePositions: pressurePositions.map(p => ({ ticker: p.ticker, severity: p.severity, dte: p.dte, label: p.label })),
      holdings: holdings.map(h => ({ ticker: h.ticker, shares: h.shares })),
      coveredCallTickers: openCalls.map(c => c.ticker),
      recentClosedTrades: allRecentClosed,
      tickerConcentration: (portfolioContext.tickerConcentration as Record<string, number>) || {},
      accountValue: accountSettings.accountValue,
    });
  }, [
    portfolioContext, heat, accountSettings, pressurePositions, holdings,
    openCalls, closedTrades, closedCalls, closedDirectional, closedSpreads,
  ]);

  // Send message handler
  const handleSend = useCallback((message: string) => {
    sendMessage(message, portfolioContext);
  }, [sendMessage, portfolioContext]);

  // Follow-up handler
  const handleFollowup = useCallback((question: string) => {
    sendMessage(question, portfolioContext);
  }, [sendMessage, portfolioContext]);

  if (isChatLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  // No API key state
  if (!isAvailable) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl opacity-20 mb-4">◎</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">AI Trading Coach</h2>
          <p className="text-muted text-sm mb-4">
            AI analysis requires an <code className="text-accent">ANTHROPIC_API_KEY</code> environment variable.
          </p>
          <p className="text-muted text-xs">
            Add it to your <code>.env</code> file and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  const hasActiveChat = !!activeConversation;
  const messages = activeConversation?.messages || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversation?.id || null}
        onSelect={selectConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
        privacyMode={privacyMode}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card-solid/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted hover:text-foreground p-1"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {hasActiveChat ? activeConversation.title : 'AI Trading Coach'}
            </h1>
            {hasActiveChat && (
              <p className="text-[10px] text-muted/50">
                {messages.length} messages
              </p>
            )}
          </div>
          {hasActiveChat && (
            <button
              onClick={startNewConversation}
              className="text-xs px-3 py-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            >
              + New Chat
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-2 px-4 py-2 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
            {error}
          </div>
        )}

        {/* Chat or Starters */}
        {hasActiveChat || isStreaming ? (
          <>
            <ChatMessageList
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
              onFollowup={handleFollowup}
              privacyMode={privacyMode}
            />
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder={isStreaming ? 'AI is responding...' : 'Ask a follow-up question...'}
            />
          </>
        ) : (
          <>
            <StarterCards prompts={starterPrompts} onSelect={handleSend} />
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder="Ask anything about your portfolio..."
            />
          </>
        )}
      </div>
    </div>
  );
}
