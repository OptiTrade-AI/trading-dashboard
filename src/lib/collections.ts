import { Collection } from 'mongodb';
import { getDb } from './mongodb';
import type { Trade, CoveredCall, DirectionalTrade, SpreadTrade, AccountSettings, StockEvent, TradeAnalysis, StockHolding, PLAnnotation, Conversation, AIUsageRecord, PatternAnalysisRecord, DailySummary, AgentTrace, PipelineRunRecord, Watchlist, CspPipelineConfig, PipelineType } from '@/types';

export async function getCspTradesCollection(): Promise<Collection<Trade>> {
  const db = await getDb();
  return db.collection<Trade>('cspTrades');
}

export async function getCoveredCallsCollection(): Promise<Collection<CoveredCall>> {
  const db = await getDb();
  return db.collection<CoveredCall>('coveredCalls');
}

export async function getDirectionalTradesCollection(): Promise<Collection<DirectionalTrade>> {
  const db = await getDb();
  return db.collection<DirectionalTrade>('directionalTrades');
}

export async function getSpreadsCollection(): Promise<Collection<SpreadTrade>> {
  const db = await getDb();
  return db.collection<SpreadTrade>('spreads');
}

export async function getStockEventsCollection(): Promise<Collection<StockEvent>> {
  const db = await getDb();
  return db.collection<StockEvent>('stockEvents');
}

export async function getAccountSettingsCollection(): Promise<Collection<AccountSettings>> {
  const db = await getDb();
  return db.collection<AccountSettings>('accountSettings');
}

export async function getAnalysesCollection(): Promise<Collection<TradeAnalysis>> {
  const db = await getDb();
  return db.collection<TradeAnalysis>('analyses');
}

export async function getHoldingsCollection(): Promise<Collection<StockHolding>> {
  const db = await getDb();
  return db.collection<StockHolding>('holdings');
}

export async function getAnnotationsCollection(): Promise<Collection<PLAnnotation>> {
  const db = await getDb();
  return db.collection<PLAnnotation>('annotations');
}

export async function getConversationsCollection(): Promise<Collection<Conversation>> {
  const db = await getDb();
  return db.collection<Conversation>('conversations');
}

export async function getAIUsageCollection(): Promise<Collection<AIUsageRecord>> {
  const db = await getDb();
  return db.collection<AIUsageRecord>('aiUsage');
}

export async function getPatternAnalysesCollection(): Promise<Collection<PatternAnalysisRecord>> {
  const db = await getDb();
  return db.collection<PatternAnalysisRecord>('patternAnalyses');
}

export async function getDailySummaryCollection(): Promise<Collection<DailySummary>> {
  const db = await getDb();
  return db.collection<DailySummary>('dailySummary');
}

export async function getAgentTracesCollection(): Promise<Collection<AgentTrace>> {
  const db = await getDb();
  return db.collection<AgentTrace>('agentTraces');
}

// Pipeline collections
export async function getPipelineRunsCollection(): Promise<Collection<PipelineRunRecord>> {
  const db = await getDb();
  return db.collection<PipelineRunRecord>('pipelineRuns');
}

export async function getPipelineResultsCollection() {
  const db = await getDb();
  return db.collection('pipelineResults');
}

export interface PipelineConfigDoc {
  pipelineType: PipelineType;
  config: CspPipelineConfig;
  updatedAt: string;
}

export async function getPipelineConfigCollection(): Promise<Collection<PipelineConfigDoc>> {
  const db = await getDb();
  return db.collection<PipelineConfigDoc>('pipelineConfig');
}

export async function getWatchlistsCollection(): Promise<Collection<Watchlist>> {
  const db = await getDb();
  return db.collection<Watchlist>('watchlists');
}
