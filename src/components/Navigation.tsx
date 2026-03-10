'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/contexts/PrivacyContext';

const tradePages = [
  { href: '/log', label: 'Cash-Secured Puts' },
  { href: '/cc', label: 'Covered Calls' },
  { href: '/directional', label: 'Directional' },
  { href: '/spreads', label: 'Spreads' },
  { href: '/stock', label: 'Stock / TLH' },
  { href: '/holdings', label: 'Holdings' },
];

const topNav = [
  { href: '/', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/analysis', label: 'Analyzer' },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const { privacyMode, togglePrivacy } = usePrivacy();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isTradesActive = tradePages.some((p) => pathname === p.href);
  const activeTradeLabel = tradePages.find((p) => pathname === p.href)?.label;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTradesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setTradesOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-8 h-8">
              {/* Glow layer */}
              <div className="absolute inset-0 rounded-lg bg-accent/25 blur-md group-hover:blur-lg group-hover:bg-accent/35 transition-all duration-300" />
              {/* Icon */}
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-accent via-accent-dark to-emerald-800 flex items-center justify-center overflow-hidden">
                {/* Diagonal accent stripe */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="relative">
                  {/* Stylized candlestick / chart mark */}
                  <rect x="2" y="4" width="2.5" height="8" rx="0.5" fill="#09090b" opacity="0.9" />
                  <rect x="6.75" y="2" width="2.5" height="12" rx="0.5" fill="#09090b" opacity="0.9" />
                  <rect x="11.5" y="5.5" width="2.5" height="6.5" rx="0.5" fill="#09090b" opacity="0.9" />
                  {/* Tick marks on bars */}
                  <line x1="1" y1="6" x2="5.5" y2="6" stroke="#09090b" strokeWidth="1" opacity="0.5" />
                  <line x1="5.75" y1="5" x2="10.25" y2="5" stroke="#09090b" strokeWidth="1" opacity="0.5" />
                  <line x1="10.5" y1="8" x2="15" y2="8" stroke="#09090b" strokeWidth="1" opacity="0.5" />
                </svg>
              </div>
            </div>
            <span className="hidden sm:block text-foreground font-semibold text-sm">Options Tracker</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {/* Trades dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setTradesOpen(!tradesOpen)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                  isTradesActive
                    ? 'text-accent bg-accent/10'
                    : 'text-muted hover:text-foreground hover:bg-card-solid/50'
                )}
              >
                {activeTradeLabel || 'Trades'}
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={cn('transition-transform duration-150', tradesOpen && 'rotate-180')}
                >
                  <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {tradesOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 py-1 rounded-xl bg-card-solid border border-border shadow-lg shadow-black/20">
                  {tradePages.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'block px-3 py-2 text-sm transition-colors',
                        pathname === item.href
                          ? 'text-accent bg-accent/10'
                          : 'text-muted hover:text-foreground hover:bg-card/80'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-border mx-1" />

            {/* Top-level links */}
            {topNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-accent bg-accent/10'
                    : 'text-muted hover:text-foreground hover:bg-card-solid/50'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Privacy toggle */}
            <button
              onClick={togglePrivacy}
              className={cn(
                'p-2 rounded-lg transition-colors',
                privacyMode
                  ? 'text-accent bg-accent/10 hover:bg-accent/20'
                  : 'text-muted hover:text-foreground hover:bg-card-solid/50'
              )}
              title={privacyMode ? 'Show financial data' : 'Hide financial data'}
            >
              {privacyMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-solid/50 transition-colors"
            >
              <div className="w-4.5 h-3.5 flex flex-col justify-between">
                <span className={cn(
                  'block h-0.5 w-[18px] bg-current transition-all duration-200',
                  mobileOpen && 'rotate-45 translate-y-[6px]'
                )} />
                <span className={cn(
                  'block h-0.5 w-[18px] bg-current transition-all duration-200',
                  mobileOpen && 'opacity-0'
                )} />
                <span className={cn(
                  'block h-0.5 w-[18px] bg-current transition-all duration-200',
                  mobileOpen && '-rotate-45 -translate-y-[6px]'
                )} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-0.5">
            <div className="text-xs font-medium text-muted/60 uppercase tracking-wider px-3 pt-1 pb-2">
              Trade Logs
            </div>
            {tradePages.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-accent bg-accent/10'
                    : 'text-muted hover:text-foreground hover:bg-card-solid/50'
                )}
              >
                {item.label}
              </Link>
            ))}

            <div className="h-px bg-border my-2" />

            {topNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-accent bg-accent/10'
                    : 'text-muted hover:text-foreground hover:bg-card-solid/50'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
