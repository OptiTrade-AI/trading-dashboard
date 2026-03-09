// Cash-Secured Put
export interface Trade {
  id: string;
  ticker: string;
  strike: number;
  contracts: number; // number of contracts
  expiration: string; // ISO date
  entryDate: string;
  exitDate?: string;
  premiumCollected: number; // total premium (per contract * contracts * 100)
  collateral: number; // total collateral (strike * 100 * contracts)
  dteAtEntry: number;
  status: 'open' | 'closed';
  exitPrice?: number; // total cost to close
  exitReason?: ExitReason;
  notes?: string;
  rollChainId?: string; // links rolled positions together
  rollNumber?: number; // position in roll chain (1 = original, 2 = first roll, etc.)
  originalContracts?: number; // tracks original qty before partial close (e.g., 5 if "2/5 closed")
}

// Covered Call
export interface CoveredCall {
  id: string;
  ticker: string;
  strike: number;
  contracts: number; // number of contracts (100 shares each)
  expiration: string; // ISO date
  entryDate: string;
  exitDate?: string;
  premiumCollected: number; // total premium received
  sharesHeld: number; // typically contracts * 100
  costBasis: number; // total cost basis of shares
  dteAtEntry: number;
  status: 'open' | 'closed' | 'called';
  exitPrice?: number; // cost to buy back the call (0 if expired/called)
  exitReason?: CCExitReason;
  notes?: string;
  rollChainId?: string;
  rollNumber?: number;
  originalContracts?: number;
}

export interface AccountSettings {
  accountValue: number;
  maxHeatPercent: number; // default 30
}

// CSP Exit Reasons
export type ExitReason = '50% profit' | 'time stop' | 'rolled' | 'support broke' | 'assigned' | 'partial close' | 'other';

export const EXIT_REASONS: ExitReason[] = [
  '50% profit',
  'time stop',
  'rolled',
  'support broke',
  'assigned',
  'partial close',
  'other'
];

// CC Exit Reasons
export type CCExitReason = '50% profit' | 'time stop' | 'rolled' | 'called away' | 'expired' | 'partial close' | 'other';

export const CC_EXIT_REASONS: CCExitReason[] = [
  '50% profit',
  'time stop',
  'rolled',
  'called away',
  'expired',
  'partial close',
  'other'
];

// Directional Trades (long calls/puts)
export type OptionType = 'call' | 'put';

export interface DirectionalTrade {
  id: string;
  ticker: string;
  optionType: OptionType;
  strike: number;
  contracts: number;
  entryPrice: number; // per-contract avg price paid
  costAtOpen: number; // entryPrice × 100 × contracts
  expiration: string; // ISO date
  entryDate: string;
  exitDate?: string;
  dteAtEntry: number;
  status: 'open' | 'closed';
  exitPrice?: number; // per-contract avg price received
  creditAtClose?: number; // exitPrice × 100 × contracts
  exitReason?: DirectionalExitReason;
  notes?: string;
  rollChainId?: string;
  rollNumber?: number;
  originalContracts?: number;
}

export type DirectionalExitReason = 'profit target' | 'stop loss' | 'expired worthless' | 'rolled' | 'partial close' | 'other';

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

export interface SpreadTrade {
  id: string;
  ticker: string;
  spreadType: SpreadType;
  longStrike: number;
  shortStrike: number;
  contracts: number;
  longPrice: number;      // per-contract price paid for long leg
  shortPrice: number;     // per-contract price received for short leg
  netDebit: number;       // (longPrice - shortPrice) × 100 × contracts (negative = net credit)
  maxProfit: number;
  maxLoss: number;
  expiration: string;
  entryDate: string;
  exitDate?: string;
  dteAtEntry: number;
  status: 'open' | 'closed';
  closeNetCredit?: number; // net credit received when closing
  exitReason?: SpreadExitReason;
  notes?: string;
  rollChainId?: string;
  rollNumber?: number;
  originalContracts?: number;
}

export type SpreadExitReason = 'max profit' | 'profit target' | 'stop loss' | 'expired' | 'rolled' | 'partial close' | 'other';

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

export const CORE_WATCHLIST = {
  tier1: [] as string[],
  tier2: [] as string[]
};

export const ALL_TICKERS = [...CORE_WATCHLIST.tier1, ...CORE_WATCHLIST.tier2];
