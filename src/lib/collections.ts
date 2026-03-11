import { Collection } from 'mongodb';
import { getDb } from './mongodb';
import type { Trade, CoveredCall, DirectionalTrade, SpreadTrade, AccountSettings, StockEvent, TradeAnalysis, StockHolding, PLAnnotation } from '@/types';

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
