'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trade, CoveredCall, DirectionalTrade, SpreadTrade, StockHolding, StockEvent } from '@/types';

interface CommandPaletteProps {
  trades: Trade[];
  coveredCalls: CoveredCall[];
  directionalTrades: DirectionalTrade[];
  spreads: SpreadTrade[];
  holdings: StockHolding[];
  stockEvents: StockEvent[];
  tickerNames: Map<string, string>;
}

interface SearchResult {
  id: string;
  ticker: string;
  label: string;
  detail: string;
  type: 'csp' | 'cc' | 'directional' | 'spread' | 'holding' | 'stock';
  status: string;
  href: string;
}

const typeConfig: Record<string, { label: string; color: string; href: string }> = {
  csp: { label: 'CSP', color: 'text-emerald-400', href: '/log' },
  cc: { label: 'CC', color: 'text-blue-400', href: '/cc' },
  directional: { label: 'DIR', color: 'text-amber-400', href: '/directional' },
  spread: { label: 'SPREAD', color: 'text-purple-400', href: '/spreads' },
  holding: { label: 'HOLDING', color: 'text-cyan-400', href: '/holdings' },
  stock: { label: 'STOCK', color: 'text-pink-400', href: '/stock' },
};

const pages = [
  { label: 'Dashboard', href: '/' },
  { label: 'Cash-Secured Puts', href: '/log' },
  { label: 'Covered Calls', href: '/cc' },
  { label: 'Directional', href: '/directional' },
  { label: 'Spreads', href: '/spreads' },
  { label: 'Holdings', href: '/holdings' },
  { label: 'Stock / TLH', href: '/stock' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'AI Analyzer', href: '/analysis' },
];

export function CommandPalette({
  trades, coveredCalls, directionalTrades, spreads, holdings, stockEvents, tickerNames,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Build searchable items
  const allItems = useMemo((): SearchResult[] => {
    const items: SearchResult[] = [];

    trades.forEach(t => items.push({
      id: t.id, ticker: t.ticker, label: `$${t.strike}P x${t.contracts}`,
      detail: `${t.expiration}${t.notes ? ` — ${t.notes}` : ''}`,
      type: 'csp', status: t.status, href: '/log',
    }));

    coveredCalls.forEach(c => items.push({
      id: c.id, ticker: c.ticker, label: `$${c.strike}C x${c.contracts}`,
      detail: `${c.expiration}${c.notes ? ` — ${c.notes}` : ''}`,
      type: 'cc', status: c.status, href: '/cc',
    }));

    directionalTrades.forEach(t => items.push({
      id: t.id, ticker: t.ticker,
      label: `$${t.strike}${t.optionType === 'call' ? 'C' : 'P'} x${t.contracts}`,
      detail: `${t.expiration}${t.notes ? ` — ${t.notes}` : ''}`,
      type: 'directional', status: t.status, href: '/directional',
    }));

    spreads.forEach(s => items.push({
      id: s.id, ticker: s.ticker,
      label: `$${s.longStrike}/$${s.shortStrike} x${s.contracts}`,
      detail: `${s.expiration}${s.notes ? ` — ${s.notes}` : ''}`,
      type: 'spread', status: s.status, href: '/spreads',
    }));

    holdings.forEach(h => items.push({
      id: h.id, ticker: h.ticker, label: `${h.shares} shares`,
      detail: `@ $${h.costBasisPerShare.toFixed(2)}${h.notes ? ` — ${h.notes}` : ''}`,
      type: 'holding', status: 'active', href: '/holdings',
    }));

    stockEvents.forEach(e => items.push({
      id: e.id, ticker: e.ticker, label: `${e.shares} shares sold`,
      detail: `${e.saleDate}${e.notes ? ` — ${e.notes}` : ''}`,
      type: 'stock', status: 'closed', href: '/stock',
    }));

    return items;
  }, [trades, coveredCalls, directionalTrades, spreads, holdings, stockEvents]);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return { items: [], pages: pages.slice(0, 5) };

    const q = query.toLowerCase();

    const matchedItems = allItems.filter(item => {
      const companyName = tickerNames.get(item.ticker) || '';
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        companyName.toLowerCase().includes(q)
      );
    }).slice(0, 20);

    const matchedPages = pages.filter(p => p.label.toLowerCase().includes(q));

    return { items: matchedItems, pages: matchedPages };
  }, [query, allItems, tickerNames]);

  const totalResults = results.items.length + results.pages.length;

  // Reset selected index when results change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleSelect = (href: string) => {
    router.push(href);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalResults - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && totalResults > 0) {
      e.preventDefault();
      const pagesOffset = results.pages.length;
      if (selectedIndex < pagesOffset) {
        handleSelect(results.pages[selectedIndex].href);
      } else {
        handleSelect(results.items[selectedIndex - pagesOffset].href);
      }
    }
  };

  if (!open) return null;

  // Group items by type
  const grouped = new Map<string, SearchResult[]>();
  results.items.forEach(item => {
    const group = grouped.get(item.type) || [];
    group.push(item);
    grouped.set(item.type, group);
  });

  let flatIndex = results.pages.length; // pages come first in index

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card-solid border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search trades, tickers, pages..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted text-sm outline-none"
          />
          <kbd className="text-[10px] text-muted bg-background/50 px-1.5 py-0.5 rounded border border-border/50">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {/* Pages */}
          {results.pages.length > 0 && (
            <div>
              <div className="px-4 py-1 text-[10px] font-bold text-muted uppercase tracking-wider">Pages</div>
              {results.pages.map((page, i) => (
                <button
                  key={page.href}
                  onClick={() => handleSelect(page.href)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors',
                    selectedIndex === i ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-card/80'
                  )}
                >
                  <span className="text-muted">→</span>
                  {page.label}
                </button>
              ))}
            </div>
          )}

          {/* Trade results grouped by type */}
          {Array.from(grouped.entries()).map(([type, items]) => {
            const config = typeConfig[type];
            return (
              <div key={type}>
                <div className="px-4 py-1 mt-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                  {config.label}
                </div>
                {items.map(item => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item.href)}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors',
                        selectedIndex === idx ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-card/80'
                      )}
                    >
                      <span className={cn('text-[10px] font-bold w-8', config.color)}>{config.label}</span>
                      <span className="font-semibold">{item.ticker}</span>
                      <span className="text-muted">{item.label}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded ml-auto',
                        item.status === 'open' ? 'bg-profit/10 text-profit' : 'bg-zinc-500/10 text-zinc-400'
                      )}>
                        {item.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Reset flatIndex counter for proper indexing */}
          {(() => { flatIndex = results.pages.length; return null; })()}

          {query && totalResults === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {!query && (
            <div className="px-4 py-4 text-center text-xs text-muted">
              Type to search across all trades, holdings, and pages
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted">
          <span><kbd className="bg-background/50 px-1 py-0.5 rounded border border-border/50">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-background/50 px-1 py-0.5 rounded border border-border/50">↵</kbd> Open</span>
          <span className="ml-auto"><kbd className="bg-background/50 px-1 py-0.5 rounded border border-border/50">Ctrl+K</kbd> Toggle</span>
        </div>
      </div>
    </div>
  );
}
