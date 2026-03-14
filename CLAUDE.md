# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server with Turbopack (port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — Type check without emitting

## Workflow

**Always follow this workflow when making code changes:**

1. **Implement** — Make the requested changes
2. **Verify** — Run `npx tsc --noEmit` or `npm run build` to confirm no type errors
3. **Review** — Run `/review` before any push to check for security issues and code quality
4. **Ship** — Run `/pr` to create a feature branch, commit, push, and open a PR to main

**Never push directly to main. Always use feature branches + PRs.**

## Custom Skills

| Skill | Description |
|-------|-------------|
| `/review` | Security and quality code review of all pending changes. Checks for secrets, injection, XSS, type errors, and code quality. Outputs a verdict: SAFE TO PUSH / NEEDS FIXES / DO NOT PUSH |
| `/pr` | Creates a feature branch, commits staged files, pushes to origin, and opens a GitHub PR with summary and test plan. Never commits secrets or force pushes |
| `/security` | Deep scan for leaked secrets, credentials, and confidential data. Checks secret patterns, gitignore rules, staged files, env var access, and git history. Verdict: CLEAN / WARNINGS / SECRETS DETECTED — DO NOT PUSH |
| `/docs` | Auto-updates documentation (docs/, README.md, CLAUDE.md) to stay in sync with code changes. Maps changed files to affected docs and applies targeted updates |

## Architecture

Options trading dashboard built with **Next.js 16 (App Router)** + **MongoDB** + **Tailwind CSS** + **Recharts** + **Polygon.io**.

### Data Flow

Client hooks (`src/hooks/`) fetch from Next.js API routes (`src/app/api/`), which read/write to MongoDB via `src/lib/collections.ts`. All trade routes use `createTradeHandlers` for individual CRUD: GET returns all documents, POST inserts one, PATCH updates by `id`, DELETE removes by `id`. There is no auth layer.

Market data flows from Polygon.io API → Next.js API routes (server-side) → SWR hooks (client-side). Option quotes refresh every 60s during market hours, 5 min when closed.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Aggregated overview: hero banner, AI daily summary, smart alerts, earnings watch, expiration alerts, strategy pulse, Greeks card, theta income, pressure card, positions timeline, capital allocation, recent activity, quick-add FAB, command palette, CSV import |
| CSP Log | `/log` | Cash-secured puts table with add/edit/close/roll modals |
| Covered Calls | `/cc` | Covered calls table with add/edit/close modals |
| Directional | `/directional` | Long calls/puts table with add/edit/close modals |
| Spreads | `/spreads` | Vertical spreads table with add/edit/close modals |
| Holdings | `/holdings` | Stock inventory with live prices, charts, sparklines, treemap, heatmap, lot grouping by ticker |
| Stock Events | `/stock` | Realized stock P/L and tax loss harvest ledger |
| Analytics | `/analytics` | 10+ Recharts visualizations (cumulative P/L, heatmap, scatter, etc.), SPY benchmark comparison, P/L annotations, interactive strategy drill-down, stock capital gains |
| AI Chat | `/analysis` | Conversational AI trading coach with saved history and "Discuss in Chat" integration |

### Trade Types

Five independent trade types, each with its own type definition (`src/types/index.ts`), hook, API route, modal, and table component:

| Type | Hook | API Route | Page |
|------|------|-----------|------|
| Cash-Secured Puts (CSP) | `useTrades` | `/api/trades` | `/log` |
| Covered Calls (CC) | `useCoveredCalls` | `/api/covered-calls` | `/cc` |
| Directional (long calls/puts) | `useDirectionalTrades` | `/api/directional-trades` | `/directional` |
| Vertical Spreads | `useSpreads` | `/api/spreads` | `/spreads` |
| Stock Holdings | `useHoldings` | `/api/holdings` | `/holdings` |

### Market Data Hooks

| Hook | Purpose |
|------|---------|
| `useOptionQuotes` | Live Greeks (delta, gamma, theta, vega), IV, unrealized P/L for all open positions. Greeks are per-share; sold positions have sign flipped to reflect seller's perspective. Portfolio aggregation multiplies by contracts. |
| `usePressure` | Monitors positions approaching strike prices with severity levels |
| `useMarketStatus` | Market open/closed/extended-hours status from Polygon |
| `useTickerDetails` | Company name lookup for tickers |
| `useStockAggregates` | OHLC chart data for position detail modal and SPY benchmark |
| `useStockPrices` | Live stock prices with change/changePercent for tickers (60s/5min refresh) |
| `useIntradayData` | 5-min candle data for single ticker intraday charts |
| `useOptionAggregates` | Multi-ticker option aggregate data |
| `useAnnotations` | CRUD for P/L chart annotations stored in MongoDB |

### Utility Hooks

| Hook | Purpose |
|------|---------|
| `usePortfolioPositions` | Master dashboard hook aggregating all trade hooks + market data into unified open positions, recent activity, capital allocation, strategy pulse, and unrealized P/L by strategy |
| `useAnalyticsData` | Computes 40+ analytics metrics (per-strategy P/L, win rates, avg premium captured, drawdown, monthly stacked P/L, scatter/heatmap data, streaks, hold time buckets, stock capital gains, strategy trade drill-down) with time range filter (1W/1M/3M/6M/YTD/ALL) |
| `useTableSortFilter` | Generic table sort/filter state: sorting by any key with custom extractors, filtering by status/ticker/date range. Used by all trade log tables |
| `useTradeStats` | Lightweight stats calculator: total P/L, win/loss counts, win rate, open/closed counts. Generic over any trade type via `calculatePL` parameter |

### Dashboard Components

| Component | File | Description |
|-----------|------|-------------|
| ExpirationAlertBanner | `src/components/dashboard/ExpirationAlertBanner.tsx` | Warns about positions expiring within 2 DTE, links to trade log, dismissible per session |
| PortfolioGreeksCard | `src/components/dashboard/PortfolioGreeksCard.tsx` | SVG delta gauge, theta block, gamma/vega/IV row, delta exposure chart, risk badge. Greeks multiplied by contracts for portfolio totals. |
| ThetaDashboardCard | `src/components/dashboard/ThetaDashboardCard.tsx` | Daily/weekly/monthly theta income, decay acceleration by DTE, top contributors |
| PressureCard | `src/components/PressureCard.tsx` | Real-time pressure monitoring with configurable thresholds and severity levels |
| PositionsTimeline | `src/components/dashboard/PositionsTimeline.tsx` | Positions grouped by DTE urgency zones with Greeks badges and profit target progress bars (pulse at 50%, gold at 75%) |
| PositionDetailModal | `src/components/dashboard/PositionDetailModal.tsx` | 3-tab chart modal (intraday, since entry, 1Y) with metrics, risk analysis, and AI Exit Coach tab |
| CapitalAllocationCard | `src/components/dashboard/CapitalAllocationCard.tsx` | Segmented bar showing capital deployment across strategies |
| CompactHeat | `src/components/dashboard/CompactHeat.tsx` | Portfolio heat gauge with safe/caution/over-limit zones |
| QuickAddFAB | `src/components/QuickAddFAB.tsx` | Floating action button for adding trades from dashboard (keyboard shortcut: N) |
| CommandPalette | `src/components/CommandPalette.tsx` | Global search across all trades/pages (keyboard shortcut: Ctrl+K) |
| SmartAlertsBadge | `src/components/dashboard/SmartAlertsBadge.tsx` | AI-powered position alerts with Greeks enrichment and browser notifications |
| EarningsWatchCard | `src/components/dashboard/EarningsWatchCard.tsx` | Upcoming earnings/events for open position tickers |
| DailySummaryLine | `src/components/dashboard/DailySummaryLine.tsx` | AI daily portfolio summary in hero banner (24h cache) |
| ImportModal | `src/components/ImportModal.tsx` | CSV import with file upload, drag-and-drop, paste, row validation |
| AITradeCheck | `src/components/AITradeCheck.tsx` | Pre-trade risk check with live market data, strategy-specific metrics (ROC/ROS/Greeks), and AI insights in all add-trade modals |
| AIRollAdvisor | `src/components/AIRollAdvisor.tsx` | Roll suggestions with live options chain in all close modals |
| BehavioralPatterns | `src/components/BehavioralPatterns.tsx` | AI pattern recognition with evolution tracking on Analytics page |
| AICostIndicator | `src/components/AICostIndicator.tsx` | Nav button with sparkle icon + centered modal (portaled): hero with count-up animation & sparkline, 30-day stacked AreaChart by model, feature BarChart, model split segmented bar, token efficiency, recent activity timeline. Privacy mode overlays on all charts |
| UncoveredHoldingsCard | `src/components/dashboard/UncoveredHoldingsCard.tsx` | Shows holdings not covered by calls, with suggestion to write covered calls |
| DiscussChatLink | `src/components/DiscussChatLink.tsx` | "Discuss in Chat" button linking AI outputs to conversational coach |
| TickerAutocomplete | `src/components/shared/TickerAutocomplete.tsx` | Reusable ticker search input with autocomplete dropdown, used in all trade add/edit modals |

### Key Files

- `src/types/index.ts` — All TypeScript interfaces and type unions for trades, exit reasons, spread types, PLAnnotation
- `src/lib/utils.ts` — P/L calculations, formatting, CSV export, `cn()` class helper
- `src/lib/mongodb.ts` — MongoDB connection with dev-mode global caching
- `src/lib/collections.ts` — Typed collection accessors for each MongoDB collection (including annotations)
- `src/contexts/ToastContext.tsx` — Toast notification system (success/error/info) with auto-dismiss
- `src/contexts/PrivacyContext.tsx` — Privacy mode toggle with keyboard shortcut
- `src/app/page.tsx` — Dashboard aggregating stats across all trade types
- `src/app/analytics/page.tsx` — Charts, analytics, SPY benchmark, and P/L annotations
- `src/app/analysis/page.tsx` — Conversational AI trading coach with saved history
- `src/lib/ai.ts` — Shared Anthropic client, `aiCall()`, `aiStream()` (with retry on 529), `extractJSON()`, automatic usage tracking
- `src/lib/ai-data.ts` — Server-side portfolio data gathering for all AI features
- `src/lib/polygon.ts` — Polygon options chain fetcher with 5-min in-memory cache
- `src/lib/createTradeRoute.ts` — Generic API route factory for trade CRUD (GET, POST, PATCH, DELETE)
- `src/lib/fetcher.ts` — SWR fetch wrapper for GET requests
- `src/lib/strategy-colors.ts` — Canonical strategy color palette (text/bg/border classes + hex for Recharts) per strategy type
- `src/lib/starterPrompts.ts` — Context-aware starter prompt generation for AI chat
- `src/lib/chatContext.ts` — Portfolio context helpers for AI chat

### API Routes — Trade Data

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/trades` | GET, POST, PATCH, DELETE | Cash-secured puts CRUD |
| `/api/covered-calls` | GET, POST, PATCH, DELETE | Covered calls CRUD |
| `/api/directional-trades` | GET, POST, PATCH, DELETE | Directional trades CRUD |
| `/api/spreads` | GET, POST, PATCH, DELETE | Vertical spreads CRUD |
| `/api/holdings` | GET, POST, PATCH, DELETE | Stock holdings CRUD |
| `/api/stock-events` | GET, POST, PATCH, DELETE | Realized stock P/L and TLH ledger |
| `/api/annotations` | GET, POST, PATCH, DELETE | P/L chart annotations CRUD |
| `/api/settings` | GET, POST | Account settings (account value, max heat %) |

### API Routes — Market Data (Polygon.io)

| Endpoint | Description |
|----------|-------------|
| `/api/stock-prices` | Stock prices with snapshot + prev-close fallback for off-hours |
| `/api/option-quotes` | Option quotes and Greeks with session.close fallback for off-hours |
| `/api/stock-aggregates` | OHLC bar data for charts (5-min in-memory cache) |
| `/api/ticker-details` | Company name metadata |
| `/api/market-status` | Market open/closed/extended-hours |

### API Routes — AI Features (Anthropic Claude)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/exit-coach` | POST | Streaming HOLD/CLOSE/ROLL verdict |
| `/api/ai/smart-alerts` | GET, POST | Position alerts (POST accepts Greeks for enrichment) |
| `/api/ai/trade-check` | POST | Pre-trade risk evaluation |
| `/api/ai/patterns` | GET, POST | Behavioral pattern analysis with history |
| `/api/ai/roll-advisor` | POST | Roll recommendations with live options chain |
| `/api/ai/events-check` | GET | Earnings/events detection |
| `/api/ai/daily-summary` | GET | Cached daily portfolio summary |
| `/api/ai/usage` | GET | AI usage stats and costs |
| `/api/analysis` | GET, POST, DELETE | Trade analysis debrief with streaming and history |
| `/api/chat` | GET, POST, PATCH, DELETE | Multi-turn conversational AI with history management |
| `/api/chat/context` | POST | Create conversation with pre-loaded context |

### UI Conventions

- Dark theme only (`darkMode: 'class'`, always-on `dark` class on `<html>`)
- Custom color tokens in `tailwind.config.ts`: `profit` (green), `loss` (red), `caution` (amber), `card`, `muted`, `accent`
- Glass-card styling via `glass-card` CSS class; button styles via `btn-primary`
- `cn()` utility for conditional class names (simple filter+join, not clsx/tailwind-merge)
- Privacy mode: toggled via eye icon or `Ctrl+Shift+H`, masks all financial data, persisted in localStorage
- Toast notifications: auto-dismiss 4s, slide-in from right, success/error/info variants
- Keyboard shortcuts: `N` (quick-add trade), `Ctrl+K` (global search), `Ctrl+Shift+H` (privacy mode)

### Environment Variables

- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB` — Database name (defaults to `csp-tracker`)
- `ANTHROPIC_API_KEY` — Anthropic API key for 9 AI features (server-side only)
- `POLYGON_API_KEY` — Polygon.io API key for real-time stock/option prices (server-side only)

### Dependencies

- **Next.js 16** — App Router with Turbopack
- **MongoDB** — via `mongodb` driver with typed collections
- **SWR** — Client-side data fetching with caching and revalidation
- **Recharts** — All charts and visualizations
- **Tailwind CSS** — Styling with custom dark theme tokens
- **date-fns** — Date formatting and calculations
- **Anthropic SDK** — 9 AI features: exit coach, smart alerts, trade check, patterns, roll advisor, earnings watch, daily summary, chat, cost tracker (server-side)

### GitHub

- **Remote**: `origin` → `https://github.com/OptiTrade-AI/trading-dashboard.git`
- **Main branch**: `main`
- **PR workflow**: Feature branches → PR to main
- **`gh` CLI path**: `/c/Program Files/GitHub CLI/gh.exe` (Windows)
