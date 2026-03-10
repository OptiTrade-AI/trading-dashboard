'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/contexts/PrivacyContext';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◉' },
  { href: '/log', label: 'CSPs', icon: '◎' },
  { href: '/cc', label: 'CCs', icon: '◆' },
  { href: '/directional', label: 'Directional', icon: '◫' },
  { href: '/spreads', label: 'Spreads', icon: '⊟' },
  { href: '/stock', label: 'Stock / TLH', icon: '◩' },
  { href: '/analytics', label: 'Analytics', icon: '◈' },
  { href: '/strategy', label: 'Strategy', icon: '◇' },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { privacyMode, togglePrivacy } = usePrivacy();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-glow">
                <span className="text-background font-bold text-sm">CSP</span>
              </div>
              <div className="absolute inset-0 rounded-xl bg-accent/20 blur-lg group-hover:blur-xl transition-all" />
            </div>
            <div className="hidden sm:block">
              <div className="text-foreground font-semibold">Options Tracker</div>
              <div className="text-muted text-xs">CSPs, CCs, Directional & Spreads</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 p-1 bg-card-solid/50 rounded-xl border border-border">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  pathname === item.href
                    ? 'text-accent'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {pathname === item.href && (
                  <div className="absolute inset-0 bg-accent/10 rounded-lg" />
                )}
                <span className="relative flex items-center gap-2">
                  <span className="hidden lg:inline opacity-60">{item.icon}</span>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
          {/* Privacy toggle */}
          <button
            onClick={togglePrivacy}
            className={cn(
              'p-2 rounded-lg transition-all duration-200',
              privacyMode
                ? 'text-accent bg-accent/10 hover:bg-accent/20'
                : 'text-muted hover:text-foreground hover:bg-card-solid/50'
            )}
            title={privacyMode ? 'Show financial data (Ctrl+Shift+H)' : 'Hide financial data (Ctrl+Shift+H)'}
          >
            {privacyMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={cn(
                'block h-0.5 w-5 bg-current transition-all duration-300',
                mobileOpen && 'rotate-45 translate-y-[7px]'
              )} />
              <span className={cn(
                'block h-0.5 w-5 bg-current transition-all duration-300',
                mobileOpen && 'opacity-0'
              )} />
              <span className={cn(
                'block h-0.5 w-5 bg-current transition-all duration-300',
                mobileOpen && '-rotate-45 -translate-y-[7px]'
              )} />
            </div>
          </button>
        </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  pathname === item.href
                    ? 'text-accent bg-accent/10'
                    : 'text-muted hover:text-foreground hover:bg-card-solid/50'
                )}
              >
                <span className="opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
