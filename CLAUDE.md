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

## Architecture

Options trading dashboard built with **Next.js 14 (App Router)** + **MongoDB** + **Tailwind CSS** + **Recharts** + **Polygon.io**.

### Data Flow

Client hooks (`src/hooks/`) fetch from Next.js API routes (`src/app/api/`), which read/write to MongoDB via `src/lib/collections.ts`. The API pattern is simple: GET returns all documents, POST replaces the entire collection (delete-all + insert-many). There is no auth layer.

Market data flows from Polygon.io API → Next.js API routes (server-side) → SWR hooks (client-side). Option quotes refresh every 60s during market hours, 5 min when closed.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Aggregated overview: hero banner, strategy pulse, Greeks card, pressure card, positions timeline, capital allocation, recent activity |
| CSP Log | `/log` | Cash-secured puts table with add/edit/close/roll modals |
| Covered Calls | `/cc` | Covered calls table with add/edit/close modals |
| Directional | `/directional` | Long calls/puts table with add/close modals |
| Spreads | `/spreads` | Vertical spreads table with add/close modals |
| Holdings | `/holdings` | Stock inventory with live prices, charts, sparklines, treemap, heatmap |
| Stock Events | `/stock` | Realized stock P/L and tax loss harvest ledger |
| Analytics | `/analytics` | 10+ Recharts visualizations (cumulative P/L, heatmap, scatter, etc.) |
| AI Analyzer | `/analysis` | Claude-powered strategy review with streaming output and saved history |

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
| `useOptionQuotes` | Live Greeks (delta, gamma, theta, vega), IV, unrealized P/L for all open positions |
| `usePressure` | Monitors positions approaching strike prices with severity levels |
| `useMarketStatus` | Market open/closed/extended-hours status from Polygon |
| `useTickerDetails` | Company name lookup for tickers |
| `useStockAggregates` | OHLC chart data for position detail modal |

### Dashboard Components

| Component | File | Description |
|-----------|------|-------------|
| PortfolioGreeksCard | `src/components/dashboard/PortfolioGreeksCard.tsx` | SVG delta gauge, theta block, gamma/vega/IV row, delta exposure chart, risk badge |
| PressureCard | `src/components/PressureCard.tsx` | Real-time pressure monitoring with configurable thresholds and severity levels |
| PositionsTimeline | `src/components/dashboard/PositionsTimeline.tsx` | Positions grouped by DTE urgency zones with Greeks badges |
| PositionDetailModal | `src/components/dashboard/PositionDetailModal.tsx` | 3-tab chart modal (intraday, since entry, 1Y) with metrics and risk analysis |
| CapitalAllocationCard | `src/components/dashboard/CapitalAllocationCard.tsx` | Segmented bar showing capital deployment across strategies |
| CompactHeat | `src/components/dashboard/CompactHeat.tsx` | Portfolio heat gauge with safe/caution/over-limit zones |

### Key Files

- `src/types/index.ts` — All TypeScript interfaces and type unions for trades, exit reasons, spread types
- `src/lib/utils.ts` — P/L calculations, formatting, CSV export, `cn()` class helper
- `src/lib/mongodb.ts` — MongoDB connection with dev-mode global caching
- `src/lib/collections.ts` — Typed collection accessors for each MongoDB collection
- `src/app/page.tsx` — Dashboard aggregating stats across all trade types
- `src/app/analytics/page.tsx` — Charts and analytics (uses Recharts)
- `src/app/analysis/page.tsx` — AI Strategy Analyzer with saved history

### API Routes — Market Data (Polygon.io)

| Endpoint | Description |
|----------|-------------|
| `/api/stock-prices` | Stock prices with snapshot + prev-close fallback for off-hours |
| `/api/option-quotes` | Option quotes and Greeks with session.close fallback for off-hours |
| `/api/stock-aggregates` | OHLC bar data for charts (5-min in-memory cache) |
| `/api/ticker-details` | Company name metadata |
| `/api/market-status` | Market open/closed/extended-hours |

### UI Conventions

- Dark theme only (`darkMode: 'class'`, always-on `dark` class on `<html>`)
- Custom color tokens in `tailwind.config.ts`: `profit` (green), `loss` (red), `caution` (amber), `card`, `muted`, `accent`
- Glass-card styling via `glass-card` CSS class; button styles via `btn-primary`
- `cn()` utility for conditional class names (simple filter+join, not clsx/tailwind-merge)
- Privacy mode: toggled via eye icon or `Ctrl+Shift+H`, masks all financial data, persisted in localStorage

### Environment Variables

- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB` — Database name (defaults to `csp-tracker`)
- `ANTHROPIC_API_KEY` — Anthropic API key for AI Strategy Analyzer (server-side only)
- `POLYGON_API_KEY` — Polygon.io API key for real-time stock/option prices (server-side only)

### Dependencies

- **Next.js 14** — App Router with Turbopack
- **MongoDB** — via `mongodb` driver with typed collections
- **SWR** — Client-side data fetching with caching and revalidation
- **Recharts** — All charts and visualizations
- **Tailwind CSS** — Styling with custom dark theme tokens
- **date-fns** — Date formatting and calculations
- **Anthropic SDK** — AI Strategy Analyzer (server-side)

### GitHub

- **Remote**: `origin` → `https://github.com/OptiTrade-AI/trading-dashboard.git`
- **Main branch**: `main`
- **PR workflow**: Feature branches → PR to main
- **`gh` CLI path**: `/c/Program Files/GitHub CLI/gh.exe` (Windows)
