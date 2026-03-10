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

export function calculateDaysHeld(trade: { entryDate: string; exitDate?: string }): number {
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

// Generic CSV export
type CellValue = string | number | boolean;

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

function exportCSV<T>(
  items: T[],
  columns: { header: string; value: (item: T) => CellValue }[],
  filename: string
): void {
  const headers = columns.map(c => c.header);
  const rows = items.map(item => columns.map(c => c.value(item)));
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  downloadCSV(csvContent, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

export function exportToCSV(trades: Trade[]): void {
  exportCSV(trades, [
    { header: 'Ticker', value: t => t.ticker },
    { header: 'Strike', value: t => t.strike },
    { header: 'Contracts', value: t => t.contracts },
    { header: 'Expiration', value: t => t.expiration },
    { header: 'Entry Date', value: t => t.entryDate },
    { header: 'Exit Date', value: t => t.exitDate || '' },
    { header: 'DTE at Entry', value: t => t.dteAtEntry },
    { header: 'Premium Collected', value: t => t.premiumCollected },
    { header: 'Collateral', value: t => t.collateral },
    { header: 'Status', value: t => t.status },
    { header: 'Exit Price', value: t => t.exitPrice || '' },
    { header: 'P/L', value: t => calculatePL(t) },
    { header: 'P/L %', value: t => calculatePLPercent(t).toFixed(2) },
    { header: 'Exit Reason', value: t => t.exitReason || '' },
    { header: 'Notes', value: t => t.notes || '' },
  ], 'csp-trades');
}

export function exportCCToCSV(calls: CoveredCall[]): void {
  exportCSV(calls, [
    { header: 'Ticker', value: c => c.ticker },
    { header: 'Strike', value: c => c.strike },
    { header: 'Contracts', value: c => c.contracts },
    { header: 'Shares Held', value: c => c.sharesHeld },
    { header: 'Expiration', value: c => c.expiration },
    { header: 'Entry Date', value: c => c.entryDate },
    { header: 'Exit Date', value: c => c.exitDate || '' },
    { header: 'DTE at Entry', value: c => c.dteAtEntry },
    { header: 'Premium Collected', value: c => c.premiumCollected },
    { header: 'Cost Basis', value: c => c.costBasis },
    { header: 'Status', value: c => c.status },
    { header: 'Exit Price', value: c => c.exitPrice || '' },
    { header: 'P/L', value: c => c.status !== 'open' ? c.premiumCollected - (c.exitPrice ?? 0) : '' },
    { header: 'Exit Reason', value: c => c.exitReason || '' },
    { header: 'Notes', value: c => c.notes || '' },
  ], 'covered-calls');
}

export function exportDirectionalToCSV(trades: DirectionalTrade[]): void {
  exportCSV(trades, [
    { header: 'Ticker', value: t => t.ticker },
    { header: 'Type', value: t => t.optionType },
    { header: 'Strike', value: t => t.strike },
    { header: 'Contracts', value: t => t.contracts },
    { header: 'Entry Price', value: t => t.entryPrice },
    { header: 'Cost at Open', value: t => t.costAtOpen },
    { header: 'Expiration', value: t => t.expiration },
    { header: 'Entry Date', value: t => t.entryDate },
    { header: 'Exit Date', value: t => t.exitDate || '' },
    { header: 'DTE at Entry', value: t => t.dteAtEntry },
    { header: 'Status', value: t => t.status },
    { header: 'Exit Price', value: t => t.exitPrice || '' },
    { header: 'Credit at Close', value: t => t.creditAtClose || '' },
    { header: 'P/L', value: t => calculateDirectionalPL(t) },
    { header: 'P/L %', value: t => calculateDirectionalPLPercent(t).toFixed(2) },
    { header: 'Exit Reason', value: t => t.exitReason || '' },
    { header: 'Notes', value: t => t.notes || '' },
  ], 'directional-trades');
}

export function exportSpreadsToCSV(trades: SpreadTrade[]): void {
  exportCSV(trades, [
    { header: 'Ticker', value: t => t.ticker },
    { header: 'Spread Type', value: t => SPREAD_TYPE_LABELS[t.spreadType] },
    { header: 'Long Strike', value: t => t.longStrike },
    { header: 'Short Strike', value: t => t.shortStrike },
    { header: 'Contracts', value: t => t.contracts },
    { header: 'Long Price', value: t => t.longPrice },
    { header: 'Short Price', value: t => t.shortPrice },
    { header: 'Net Debit', value: t => t.netDebit },
    { header: 'Max Profit', value: t => t.maxProfit },
    { header: 'Max Loss', value: t => t.maxLoss },
    { header: 'Expiration', value: t => t.expiration },
    { header: 'Entry Date', value: t => t.entryDate },
    { header: 'Exit Date', value: t => t.exitDate || '' },
    { header: 'DTE at Entry', value: t => t.dteAtEntry },
    { header: 'Status', value: t => t.status },
    { header: 'Close Net Credit', value: t => t.closeNetCredit || '' },
    { header: 'P/L', value: t => calculateSpreadPL(t) },
    { header: 'P/L %', value: t => calculateSpreadPLPercent(t).toFixed(2) },
    { header: 'Exit Reason', value: t => t.exitReason || '' },
    { header: 'Notes', value: t => t.notes || '' },
  ], 'spread-trades');
}

export function exportStockEventsToCSV(events: StockEvent[]): void {
  exportCSV(events, [
    { header: 'Ticker', value: e => e.ticker },
    { header: 'Shares', value: e => e.shares },
    { header: 'Cost Basis', value: e => e.costBasis },
    { header: 'Sale Price', value: e => e.salePrice },
    { header: 'Sale Date', value: e => e.saleDate },
    { header: 'Realized P/L', value: e => e.realizedPL },
    { header: 'Tax Loss Harvest', value: e => e.isTaxLossHarvest ? 'Yes' : 'No' },
    { header: 'Replacement Type', value: e => e.replacementTradeType || '' },
    { header: 'Notes', value: e => e.notes || '' },
  ], 'stock-events');
}
