import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, StockEvent, SPREAD_TYPE_LABELS } from '@/types';
import { differenceInDays, parseISO, format } from 'date-fns';

export function calculateDTE(expirationDate: string): number {
  const today = new Date();
  const expiry = parseISO(expirationDate);
  return Math.max(0, differenceInDays(expiry, today));
}

export function calculateDTEFromEntry(entryDate: string, expirationDate: string): number {
  const entry = parseISO(entryDate);
  const expiry = parseISO(expirationDate);
  return Math.max(0, differenceInDays(expiry, entry));
}

export function calculateCollateral(strike: number, contracts: number = 1): number {
  return strike * 100 * contracts;
}

export function calculatePL(trade: Trade): number {
  if (trade.status === 'open') {
    return 0;
  }
  const exitPrice = trade.exitPrice ?? 0;
  return trade.premiumCollected - exitPrice;
}

export function calculatePLPercent(trade: Trade): number {
  const pl = calculatePL(trade);
  if (trade.collateral === 0) return 0;
  return (pl / trade.collateral) * 100;
}

export function calculateReturnOnCollateral(trade: Trade): number {
  if (trade.collateral === 0) return 0;
  return (trade.premiumCollected / trade.collateral) * 100;
}

export function calculateDaysHeld(trade: Trade): number {
  const entry = parseISO(trade.entryDate);
  const exit = trade.exitDate ? parseISO(trade.exitDate) : new Date();
  return Math.max(1, differenceInDays(exit, entry));
}

export function calculateAnnualizedReturn(trade: Trade): number {
  const plPercent = calculatePLPercent(trade);
  const daysHeld = calculateDaysHeld(trade);
  return (plPercent / daysHeld) * 365;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'MMM dd, yyyy');
}

export function formatDateShort(dateString: string): string {
  return format(parseISO(dateString), 'MM/dd/yy');
}

export function getHeatLevel(heat: number): 'green' | 'yellow' | 'red' {
  if (heat < 25) return 'green';
  if (heat <= 30) return 'yellow';
  return 'red';
}

export function calculateDirectionalPL(trade: DirectionalTrade): number {
  if (trade.status === 'open') return 0;
  const creditAtClose = trade.creditAtClose ?? 0;
  return creditAtClose - trade.costAtOpen;
}

export function calculateDirectionalPLPercent(trade: DirectionalTrade): number {
  const pl = calculateDirectionalPL(trade);
  if (trade.costAtOpen === 0) return 0;
  return (pl / trade.costAtOpen) * 100;
}

export function calculateSpreadPL(trade: SpreadTrade): number {
  if (trade.status === 'open') return 0;
  return (trade.closeNetCredit ?? 0) - trade.netDebit;
}

export function calculateSpreadPLPercent(trade: SpreadTrade): number {
  const pl = calculateSpreadPL(trade);
  // For credit spreads (negative netDebit), use maxLoss as denominator
  if (trade.netDebit < 0) {
    if (trade.maxLoss === 0) return 0;
    return (pl / trade.maxLoss) * 100;
  }
  // For debit spreads, use netDebit (cost basis)
  if (trade.netDebit === 0) return 0;
  return (pl / trade.netDebit) * 100;
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = et.getHours() * 60 + et.getMinutes();
  return minutes >= 570 && minutes < 960; // 9:30 AM - 4:00 PM ET
}

export function buildOptionSymbol(
  ticker: string, expiration: string, type: 'C' | 'P', strike: number
): string {
  const d = parseISO(expiration);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const strikeStr = String(Math.round(strike * 1000)).padStart(8, '0');
  return `O:${ticker}${yy}${mm}${dd}${type}${strikeStr}`;
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function exportToCSV(trades: Trade[]): void {
  const headers = [
    'Ticker',
    'Strike',
    'Contracts',
    'Expiration',
    'Entry Date',
    'Exit Date',
    'DTE at Entry',
    'Premium Collected',
    'Collateral',
    'Status',
    'Exit Price',
    'P/L',
    'P/L %',
    'Exit Reason',
    'Notes'
  ];

  const rows = trades.map(trade => [
    trade.ticker,
    trade.strike,
    trade.contracts,
    trade.expiration,
    trade.entryDate,
    trade.exitDate || '',
    trade.dteAtEntry,
    trade.premiumCollected,
    trade.collateral,
    trade.status,
    trade.exitPrice || '',
    calculatePL(trade),
    calculatePLPercent(trade).toFixed(2),
    trade.exitReason || '',
    trade.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `csp-trades-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCCToCSV(calls: CoveredCall[]): void {
  const headers = [
    'Ticker', 'Strike', 'Contracts', 'Shares Held', 'Expiration', 'Entry Date', 'Exit Date',
    'DTE at Entry', 'Premium Collected', 'Cost Basis', 'Status', 'Exit Price',
    'P/L', 'Exit Reason', 'Notes'
  ];

  const rows = calls.map(c => [
    c.ticker, c.strike, c.contracts, c.sharesHeld, c.expiration, c.entryDate,
    c.exitDate || '', c.dteAtEntry, c.premiumCollected, c.costBasis, c.status,
    c.exitPrice || '', c.status !== 'open' ? c.premiumCollected - (c.exitPrice ?? 0) : '',
    c.exitReason || '', c.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadCSV(csvContent, `covered-calls-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

export function exportDirectionalToCSV(trades: DirectionalTrade[]): void {
  const headers = [
    'Ticker', 'Type', 'Strike', 'Contracts', 'Entry Price', 'Cost at Open',
    'Expiration', 'Entry Date', 'Exit Date', 'DTE at Entry', 'Status',
    'Exit Price', 'Credit at Close', 'P/L', 'P/L %', 'Exit Reason', 'Notes'
  ];

  const rows = trades.map(t => [
    t.ticker, t.optionType, t.strike, t.contracts, t.entryPrice, t.costAtOpen,
    t.expiration, t.entryDate, t.exitDate || '', t.dteAtEntry, t.status,
    t.exitPrice || '', t.creditAtClose || '',
    calculateDirectionalPL(t), calculateDirectionalPLPercent(t).toFixed(2),
    t.exitReason || '', t.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadCSV(csvContent, `directional-trades-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

export function exportSpreadsToCSV(trades: SpreadTrade[]): void {
  const headers = [
    'Ticker', 'Spread Type', 'Long Strike', 'Short Strike', 'Contracts',
    'Long Price', 'Short Price', 'Net Debit', 'Max Profit', 'Max Loss',
    'Expiration', 'Entry Date', 'Exit Date', 'DTE at Entry', 'Status',
    'Close Net Credit', 'P/L', 'P/L %', 'Exit Reason', 'Notes'
  ];

  const rows = trades.map(t => [
    t.ticker, SPREAD_TYPE_LABELS[t.spreadType], t.longStrike, t.shortStrike,
    t.contracts, t.longPrice, t.shortPrice, t.netDebit, t.maxProfit, t.maxLoss,
    t.expiration, t.entryDate, t.exitDate || '', t.dteAtEntry, t.status,
    t.closeNetCredit || '', calculateSpreadPL(t), calculateSpreadPLPercent(t).toFixed(2),
    t.exitReason || '', t.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadCSV(csvContent, `spread-trades-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

export function exportStockEventsToCSV(events: StockEvent[]): void {
  const headers = [
    'Ticker', 'Shares', 'Cost Basis', 'Sale Price', 'Sale Date',
    'Realized P/L', 'Tax Loss Harvest', 'Replacement Type', 'Notes'
  ];

  const rows = events.map(e => [
    e.ticker, e.shares, e.costBasis, e.salePrice, e.saleDate,
    e.realizedPL, e.isTaxLossHarvest ? 'Yes' : 'No',
    e.replacementTradeType || '', e.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadCSV(csvContent, `stock-events-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}
