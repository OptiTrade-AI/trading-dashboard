// Base fields shared across all trade types
export interface BaseTrade {
  id: string;
  ticker: string;
  contracts: number;
  expiration: string; // ISO date
  entryDate: string;
  exitDate?: string;
  dteAtEntry: number;
  status: string;
  notes?: string;
  commission?: number; // opening commission/fees
  closeCommission?: number; // closing commission/fees
  rollChainId?: string; // links rolled positions together
  rollNumber?: number; // position in roll chain (1 = original, 2 = first roll, etc.)
  originalContracts?: number; // tracks original qty before partial close
}

// Cash-Secured Put
export interface Trade extends BaseTrade {
  strike: number;
  premiumCollected: number; // total premium (per contract * contracts * 100)
  collateral: number; // total collateral (strike * 100 * contracts)
  status: 'open' | 'closed';
  exitPrice?: number; // total cost to close
  exitReason?: ExitReason;
}

// Covered Call
export interface CoveredCall extends BaseTrade {
  strike: number;
  premiumCollected: number; // total premium received
  sharesHeld: number; // typically contracts * 100
  costBasis: number; // total cost basis of shares
  status: 'open' | 'closed' | 'called';
  exitPrice?: number; // cost to buy back the call (0 if expired/called)
  exitReason?: CCExitReason;
}

export interface AccountSettings {
  accountValue: number;
  maxHeatPercent: number; // default 30
  alertDTEWarning?: number;    // DTE threshold for warning alerts (default 7)
  alertDTECritical?: number;   // DTE threshold for critical alerts (default 2)
  alertHeatThreshold?: number; // Heat % threshold for alerts (default 30)
}

// Base exit reasons shared across strategies
export type BaseExitReason = 'rolled' | 'partial close' | 'other';

// CSP Exit Reasons
export type ExitReason = BaseExitReason | '50% profit' | 'early profit' | 'time stop' | 'support broke' | 'assigned' | 'expired worthless';

export const EXIT_REASONS: ExitReason[] = [
  '50% profit',
  'early profit',
  'time stop',
  'rolled',
  'support broke',
  'assigned',
  'expired worthless',
  'partial close',
  'other'
];

// CC Exit Reasons
export type CCExitReason = BaseExitReason | '50% profit' | 'early profit' | 'time stop' | 'called away' | 'expired';

export const CC_EXIT_REASONS: CCExitReason[] = [
  '50% profit',
  'early profit',
  'time stop',
  'rolled',
  'called away',
  'expired',
  'partial close',
  'other'
];

// Directional Trades (long calls/puts)
export type OptionType = 'call' | 'put';

export interface DirectionalTrade extends BaseTrade {
  optionType: OptionType;
  strike: number;
  entryPrice: number; // per-contract avg price paid
  costAtOpen: number; // entryPrice × 100 × contracts
  status: 'open' | 'closed';
  exitPrice?: number; // per-contract avg price received
  creditAtClose?: number; // exitPrice × 100 × contracts
  exitReason?: DirectionalExitReason;
}

export type DirectionalExitReason = BaseExitReason | 'profit target' | 'stop loss' | 'expired worthless';

export const DIRECTIONAL_EXIT_REASONS: DirectionalExitReason[] = [
  'profit target',
  'stop loss',
  'expired worthless',
  'rolled',
  'partial close',
  'other'
];

// Vertical Spreads
export type SpreadType = 'call_debit' | 'call_credit' | 'put_debit' | 'put_credit';

export interface SpreadTrade extends BaseTrade {
  spreadType: SpreadType;
  longStrike: number;
  shortStrike: number;
  longPrice: number;      // per-contract price paid for long leg
  shortPrice: number;     // per-contract price received for short leg
  netDebit: number;       // (longPrice - shortPrice) × 100 × contracts (negative = net credit)
  maxProfit: number;
  maxLoss: number;
  status: 'open' | 'closed';
  closeNetCredit?: number; // net credit received when closing
  exitReason?: SpreadExitReason;
}

export type SpreadExitReason = BaseExitReason | 'max profit' | 'profit target' | 'stop loss' | 'expired';

export const SPREAD_EXIT_REASONS: SpreadExitReason[] = [
  'max profit',
  'profit target',
  'stop loss',
  'expired',
  'rolled',
  'partial close',
  'other'
];

export const SPREAD_TYPE_LABELS: Record<SpreadType, string> = {
  call_debit: 'Call Debit',
  call_credit: 'Call Credit',
  put_debit: 'Put Debit',
  put_credit: 'Put Credit',
};

// Stock Events (Tax Loss Harvesting)
export interface StockEvent {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number;        // per-share avg cost
  salePrice: number;        // per-share sale price
  saleDate: string;         // ISO date
  realizedPL: number;       // (salePrice - costBasis) * shares
  isTaxLossHarvest: boolean;
  replacementTradeId?: string;
  replacementTradeType?: 'csp' | 'cc' | 'spread';
  notes?: string;
}

// Stock Holdings
export interface StockHolding {
  id: string;
  ticker: string;
  shares: number;
  costBasisPerShare: number;
  acquiredDate: string;       // ISO date
  notes?: string;
}

export const CORE_WATCHLIST = {
  tier1: [] as string[],
  tier2: [] as string[]
};

export const ALL_TICKERS = [...CORE_WATCHLIST.tier1, ...CORE_WATCHLIST.tier2];

// Stock Prices (from Polygon.io)
export interface StockPrice {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface PressurePosition {
  id: string;
  ticker: string;
  tradeType: 'csp' | 'cc' | 'credit_spread';
  strike: number;
  currentPrice: number;
  priceToStrikePercent: number;
  dte: number;
  expiration: string;
  contracts: number;
  severity: 'warning' | 'danger' | 'critical';
  label: string;
}

export const DEFAULT_PRESSURE_THRESHOLDS = {
  csp: 105,
  cc: 95,
  creditSpread: 105,
};

// Trade Analysis (saved AI analyses)
export interface TradeAnalysis {
  id: string;
  createdAt: string;       // ISO date
  timeRange: string;       // '1W'|'1M'|'3M'|etc
  startDate?: string;      // for CUSTOM range
  endDate?: string;
  content: string;         // full markdown analysis text
}

// Option Quotes (from Polygon.io)
export interface OptionQuote {
  symbol: string;        // O:AAPL250321C00150000
  underlying: string;
  bid: number;
  ask: number;
  midpoint: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  change: number | null;         // session daily change in price
  changePercent: number | null;  // session daily change percent
  previousClose: number | null;
}

export interface MarketStatus {
  market: 'open' | 'closed' | 'extended-hours';
  serverTime: string;
}

export interface TickerInfo {
  ticker: string;
  name: string;
}

// P/L Annotations
export interface PLAnnotation {
  id: string;
  date: string;      // ISO date (YYYY-MM-DD)
  label: string;     // Short annotation text
  color?: string;    // Optional color override
}

export interface AggBar {
  t: number;  // timestamp ms
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

// AI Chat Conversations
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;       // ISO date
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
}

export interface StarterPrompt {
  label: string;
  description: string;
  prompt: string;
  icon: string;
  category: 'risk' | 'review' | 'strategy' | 'position';
}

// AI Features
export type AIFeature = 'chat' | 'exit-coach' | 'smart-alerts' | 'trade-check' | 'patterns' | 'roll-advisor' | 'events-check' | 'scenario' | 'daily-summary' | 'cc-optimizer' | 'csp-optimizer';

export interface AIUsageRecord {
  timestamp: string; // ISO date
  feature: AIFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ticker?: string;
}

export interface DailyCostEntry {
  date: string; // "2026-03-13"
  cost: number;
  calls: number;
  byModel: Record<string, number>; // model -> cost
}

export interface AIUsageStats {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  avgDailyLast30: number;
  totalCalls: number;
  dailyCosts: DailyCostEntry[];
  byFeature: Record<string, { calls: number; cost: number; tokens: number }>;
  byFeatureDetailed: Record<string, {
    calls: number;
    cost: number;
    inputTokens: number;
    outputTokens: number;
    avgCostPerCall: number;
  }>;
  byModel: Record<string, { calls: number; cost: number }>;
  recentCalls: AIUsageRecord[];
}

export interface ExitCoachVerdict {
  verdict: 'HOLD' | 'CLOSE' | 'ROLL';
  reason: string;
  rollTarget?: string;
}

export interface TradeCheckMetrics {
  stockPrice: number | null;
  distanceToStrike: number | null;
  dte: number;
  newHeatPercent: number;
  // CSP
  roc?: number;
  annualizedROC?: number;
  // CC
  ros?: number;
  annualizedROS?: number;
  costBasisPerShare?: number;
  strikeVsCostBasis?: number;
  calledAwayPL?: number;
  // Greeks
  delta?: number | null;
  theta?: number | null;
  iv?: number | null;
}

export interface TradeCheckInsight {
  label: string;
  text: string;
}

export interface TradeCheckResult {
  recommendation: 'proceed' | 'caution' | 'reconsider';
  headline: string;
  insights: TradeCheckInsight[];
  metrics: TradeCheckMetrics;
}

export interface SmartAlert {
  positionId: string;
  ticker: string;
  urgency: 'info' | 'warning' | 'critical';
  action: string;
  reason: string;
}

// Behavioral Patterns — new lens-based system
export type PatternLens = 'timing' | 'exit' | 'strategy';
export type PatternSeverity = 'positive' | 'negative' | 'neutral';

export interface BehavioralFinding {
  id: string;
  lens: PatternLens;
  title: string;
  description: string;
  severity: PatternSeverity;
  trend: 'improving' | 'worsening' | 'stable' | 'new';
  metric: string;
  actionItem: string;
  evidenceTrades?: string[];
}

// Legacy format — kept for backward compat with stored history records
export interface BehavioralPattern {
  id: string;
  title: string;
  description: string;
  trend: 'improving' | 'worsening' | 'stable';
  metric?: string;
}

export interface RollRecommendation {
  action: string;
  targetStrike: number;
  targetExpiration: string;
  expectedCredit: number;
  reasoning: string;
}

export interface EarningsEvent {
  ticker: string;
  eventType: string;
  eventDate: string;
  daysUntil: number;
  urgency: 'low' | 'medium' | 'high';
  recommendation: string;
  positions: string[];
}

export interface DailySummary {
  id: string;
  summary: string;
  generatedAt: string; // ISO date
}

export interface OptionsContract {
  symbol: string;
  strike: number;
  expiration: string;
  bid: number;
  ask: number;
  midpoint: number;
  delta: number | null;
  theta: number | null;
  iv: number | null;
  openInterest: number;
  volume: number;
}

export interface PatternAnalysisRecord {
  id: string;
  timestamp: string;
  findings?: BehavioralFinding[];    // New: lens-based findings
  patterns?: BehavioralPattern[];    // Legacy: old format for historical records
  tradeCount: number;
  totalPL: number;
  winRate: number;
  timeRange?: string;
  tradeFingerprint?: string;
}

// Covered Call Optimizer
export interface OptimizerRow {
  symbol: string;           // O:AAPL260417C00150000
  strike: number;
  expiration: string;       // YYYY-MM-DD
  dte: number;
  bid: number;
  ask: number;
  midpoint: number;
  delta: number | null;
  theta: number | null;
  iv: number | null;
  openInterest: number;
  volume: number;
  // Computed metrics
  premiumPerShare: number;
  totalPremium: number;
  annualizedReturn: number;
  returnOnCostBasis: number;
  distanceFromPrice: number;
  distanceFromCostBasis: number;
  breakevenPerShare: number;
  calledAwayPL: number;
  weeksToBreakeven: number;
  bidAskSpread: number;
}

export type OptimizerPreset = 'conservative' | 'moderate' | 'aggressive' | 'recovery' | 'custom';

export interface OptimizerParams {
  minDelta: number;
  maxDelta: number;
  minDTE: number;
  maxDTE: number;
  minPremium: number;
  maxLossIfCalled: number;
  preset: OptimizerPreset;
  targetReturnPct: number;
}

export interface OptimizerResult {
  ticker: string;
  stockPrice: number;
  costBasisPerShare: number;
  totalShares: number;
  availableContracts: number;
  coveredContracts: number;
  historicalCCPremium: number;
  chain: OptimizerRow[];
}

// Agent Trace (full decision path)
export interface AgentTraceStep {
  stepIndex: number;
  timestamp: string;
  type: 'tool_call' | 'tool_result' | 'thinking' | 'final_answer';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  thinking?: string;           // agent's reasoning text before/after tool calls
  durationMs?: number;
  tokens?: { input: number; output: number };
}

export interface AgentTrace {
  id: string;
  feature?: 'cc-optimizer' | 'csp-optimizer';
  createdAt: string;
  tickers: string[];
  mode: 'single' | 'portfolio';
  steps: AgentTraceStep[];
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costUsd: number;
  result?: OptimizerAIAnalysis[] | CspOptimizerAIAnalysis[];
}

export type StrategyMode = 'breakeven' | 'balanced' | 'income' | 'yield-weekly' | 'yield-biweekly' | 'yield-monthly';

export interface StrategyLane {
  mode: StrategyMode;
  label: string;
  viable: boolean;
  viabilityNote?: string;
  recommended?: boolean;
  pick: {
    symbol: string;
    strike: number;
    expiration: string;
    reasoning: string;
    premium?: number;
    delta?: number;
    openInterest?: number;
    volume?: number;
    otmPercent?: number;
    totalPremium?: number;
    iv?: number;
    calledAwayPL?: number;
    monthlyReturn?: number;
    annualizedReturn?: number;
  } | null;
}

export interface OptimizerAIAnalysis {
  ticker: string;
  topPick: {
    symbol: string;
    strike: number;
    expiration: string;
    reasoning: string;
    premium?: number;
    delta?: number;
    openInterest?: number;
    volume?: number;
    otmPercent?: number;
    totalPremium?: number;
    iv?: number;
  };
  alternates: {
    strike: number;
    expiration: string;
    label: string;
    premium?: number;
    delta?: number;
    openInterest?: number;
    otmPercent?: number;
    totalPremium?: number;
  }[];
  analystConsensus?: string;
  earningsDate?: string;
  ivContext?: string;
  keyRisks: string[];
  strategyAdvice: string;
  strategySteps?: {
    action: string;
    rationale: string;
    nextStep: string;
  };
  recoveryProjection: {
    weeksEstimate: number;
    assumedWeeklyPremium: number;
    cumulativePremiumNeeded: number;
    premiumPerCycle?: number;
    cyclesEstimate?: number;
  };
  positionType?: 'underwater' | 'above-water';
  targetReturnPct?: number;
  strategies?: StrategyLane[];
  catalysts?: string[];
}

// ==================== CSP Optimizer Types ====================

export type CspStrategyMode = 'conservative' | 'balanced' | 'aggressive';

export interface CspStrategyPick {
  symbol: string;
  strike: number;
  expiration: string;
  reasoning: string;
  premium: number;
  delta: number;
  openInterest: number;
  volume: number;
  iv: number;
  collateral: number;
  returnOnRisk: number;
  annualizedROR: number;
  probabilityOfProfit: number;
  breakEven: number;
  discountFromCurrent: number;
}

export interface CspStrategyLane {
  mode: CspStrategyMode;
  label: string;
  viable: boolean;
  recommended?: boolean;
  pick: CspStrategyPick | null;
}

export interface CspOptimizerAIAnalysis {
  ticker: string;
  stockPrice: number;
  strategies: CspStrategyLane[];
  catalysts: string[];
  analystConsensus: string;
  earningsDate: string;
  ivContext: string;
  bollingerContext: string;
  sectorContext: string;
  whyThisTrade: string;
  keyRisks: string[];
  assignmentScenario: {
    effectiveCostBasis: number;
    currentDiscount: number;
    qualityAssessment: string;
    ccOpportunity: string;
  };
  positionSizing: {
    suggestedContracts: number;
    capitalRequired: number;
    portfolioHeatImpact: number;
    maxContracts: number;
  };
}

// ==================== Screener Types ====================

// CSP Screener
export interface CspOpportunity {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  current_price: number;
  strike: number;
  expiration: string;
  dte: number;
  delta: number;
  premium: number;
  open_interest: number;
  volume: number;
  implied_volatility: number;
  bid: number;
  ask: number;
  cash_collateral: number;
  total_premium: number;
  return_on_collateral_pct: number;
  return_on_risk_pct: number;
  annualized_roc_pct: number;
  annualized_ror_pct: number;
  break_even: number;
  probability_of_profit: number;
  score?: number;
}

export interface BollingerBandPosition {
  ticker: string;
  close: number;
  sma: number;
  upper_band: number;
  lower_band: number;
  position: 'below_lower' | 'below_sma' | 'above_sma' | 'above_upper';
}

// PCS Screener
export interface PcsOpportunity {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  current_price: number;
  short_strike: number;
  long_strike: number;
  expiration: string;
  dte: number;
  delta: number;
  premium: number;
  open_interest: number;
  volume: number;
  implied_volatility: number;
  spread_width: number;
  max_loss: number;
  max_profit: number;
  return_on_risk_pct: number;
  annualized_ror_pct: number;
  break_even: number;
  probability_of_profit: number;
  score?: number;
}

// Aggressive Options
export interface BestContract {
  ticker: string;
  strike_price: number;
  expiration_date: string;
  dte: number;
  premium: number;
  open_interest: number;
  volume: number;
  delta: number;
  implied_volatility: number;
}

export interface AggressiveOpportunity {
  ticker: string;
  current_price: number;
  total_contracts: number;
  total_open_interest: number;
  total_volume: number;
  atm_open_interest: number;
  liquid_strikes: number;
  best_contracts: BestContract[];
  rsi: number;
  stock_volume: number;
  rsi_value: number;
  bollinger_band: Record<string, number> | null;
}

export interface ScreenerTickerChanges {
  same_tickers: string[];
  new_tickers: string[];
  removed_tickers: string[];
}

export type ScreenerChangeStatus = 'same' | 'new' | 'removed';

// Swing Trades
export type SwingSignalType = 'LONG' | 'SHORT';
export type SwingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type SwingStrategy =
  | 'EMA Support Bounce'
  | 'Golden Cross Setup'
  | 'EMA Resistance Rejection'
  | 'Death Cross Setup';

export interface SwingSignal {
  ticker: string;
  signal_type: SwingSignalType;
  strategy: SwingStrategy;
  entry_price: number;
  confidence: SwingConfidence;
  stop_loss: number;
  target: number;
  risk_reward_ratio: number;
  volume: number;
  details: string;
}

export interface SwingTradeResults {
  long_signals: SwingSignal[];
  short_signals: SwingSignal[];
  timestamp?: string;
}

// Chart Setups
export interface SlopeData {
  slope: number;
  trend: 'strong_upward' | 'moderate_upward' | 'flat' | 'moderate_downward' | 'strong_downward';
  percent_change?: number;
}

export interface ChartSetup {
  ticker: string;
  company_name: string;
  industry: string;
  current_close: number;
  sma_200: number;
  ema_9: number;
  ema_21: number;
  percent_below_sma_200: number;
  percent_above_ema_9: number;
  percent_above_ema_21?: number;
  sma_200_slope: SlopeData;
  ema_9_slope: SlopeData;
  ema_21_slope: SlopeData;
}

export interface ChartSetupResults {
  timestamp: string;
  total_setups_found: number;
  chart_setups: ChartSetup[];
}

// ==================== Pipeline Types ====================

export type PipelineType =
  | 'AGGRESSIVE_OPTIONS'
  | 'CSP_SCREENER'
  | 'CSP_ENHANCED'
  | 'PCS_SCREENER'
  | 'CHART_SETUPS'
  | 'SWING_TRADES';

export type PipelineRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PipelineInfo {
  type: PipelineType;
  name: string;
  description: string;
  lastRunAt: string | null;
  lastRunStatus: PipelineRunStatus | null;
  lastRunDuration: number | null;
  totalOpportunities: number | null;
  cronExpression: string | null;
  enabled: boolean;
}

export interface PipelineRunRecord {
  id: string;
  pipelineType: PipelineType;
  status: PipelineRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  totalOpportunities: number | null;
  newOpportunities: number | null;
}

// ==================== Screener Hub Types ====================

export type ScreenerTab = 'csp' | 'pcs' | 'aggressive' | 'charts' | 'swing';

export interface ScreenerFilters {
  // Common
  minScore: number;
  sector: string;
  tickerSearch: string;
  // CSP/PCS
  minDelta: number;
  maxDelta: number;
  minDte: number;
  maxDte: number;
  minRor: number;
  minIv: number;
  minOi: number;
  minMarketCap: string;
  minPop: number;
  // PCS
  maxSpreadWidth: number;
  // Aggressive
  maxRsi: number;
  minRsi: number;
  minVolume: number;
  // Charts
  slopeDirection: 'any' | 'upward' | 'flat' | 'downward';
  maxPctBelowSma: number;
  // Swing
  confidence: SwingConfidence[];
  minRiskReward: number;
  swingStrategy: string;
}

export interface ScreenerPreset {
  key: string;
  label: string;
  tagline: string;
  color: string;
  filters: Partial<ScreenerFilters>;
}
