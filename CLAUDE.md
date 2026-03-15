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

Client hooks (`src/hooks/`) fetch from Next.js API routes (`src/app/api/`), which read/write to MongoDB via `src/lib/collections.ts`. All trade routes use `createTradeHandlers` for individual CRUD: GET returns all documents, POST inserts one, PATCH updates by `id`, DELETE removes by `id`. All routes are protected by NextAuth v5 (Google OAuth) via `src/proxy.ts` edge proxy — only the single `ALLOWED_EMAIL` can access the app.

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
| CC Optimizer | `/optimizer` | Covered call optimizer for underwater and above-water positions — AI agent with strategy lanes (breakeven/balanced/income for underwater, yield-weekly/biweekly/monthly for above-water), target return %, catalyst analysis, web search, options chain analysis, recovery projections, trace viewer, and one-click CC writing |
| CSP Optimizer | `/csp-optimizer` | Hybrid pipeline + agentic CSP optimizer — displays quantitative screener results from the Python CSP pipeline, lets user select candidates for AI deep analysis. AI agent with 7 tools (put options chain, stock price, historical prices, screener data, CSP history, portfolio exposure, web search) produces 3 strategy lanes (conservative/balanced/aggressive), assignment scenario, position sizing, catalyst research, and "Write This Put" trade creation |
| Screeners Hub | `/screeners` | Unified screener dashboard with 5 tabs (CSP, PCS, Aggressive, Charts, Swing), pipeline management strip, filter presets, overview cards, and tab-specific result tables. Sub-routes `/screeners/csp`, `/screeners/pcs`, `/screeners/aggressive`, `/screeners/charts`, `/screeners/swing` redirect to tabs. `/pipelines` redirects here |
| AI Chat | `/analysis` | Conversational AI trading coach with saved history and "Discuss in Chat" integration |
| Login | `/login` | Google OAuth sign-in page (only page accessible without auth) |

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
| `useCallOptimizer` | CC optimizer: fetches options chain via `/api/cc-optimizer`, client-side param filtering (delta/DTE/premium/loss/targetReturnPct), sorting, preset strategies (conservative/moderate/aggressive/recovery), target monthly return %, and AI analysis via streaming `/api/ai/cc-optimizer` with strategy lanes and agent trace |
| `useCspOptimizer` | CSP optimizer: combines pipeline screener data (via `useCspOpportunities`) with agentic AI analysis. Client-side filtering (delta/DTE/ROR/IV/OI/score/marketCap/sector), filter presets (conservative/balanced/aggressive/all), ticker selection with "Select Top N", streaming AI analysis via `/api/ai/csp-optimizer` with per-ticker progress, strategy lanes, and agent trace |
| `useScreenerHub` | Master screener orchestrator: combines all screener hooks + pipeline progress. Returns per-tab data, counts, top picks, confluence tickers, pipeline health, and controls for running pipelines (single or "Run All" sequential queue) |
| `useScreenerData` | Individual screener SWR hooks: `useCspOpportunities`, `usePcsOpportunities`, `useAggressiveOpportunities`, `useChartSetups`, `useSwingSignals`, `usePipelines`, `usePipelineHistory`. All cache 60s with 60s dedup |
| `usePipelineProgress` | Opens EventSource to `/api/pipelines/events/[runId]` for real-time pipeline run progress (status, progress %, duration, opportunities, errors) |
| `useCspScoreHistory` | Fetches CSP opportunity score history for selected tickers (up to 50) with trend analysis (up/down/stable/new) |
| `useEarningsDates` | Fetches estimated next earnings dates for array of tickers via `/api/earnings-dates` (1h dedup) |

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
| BehavioralPatterns | `src/components/BehavioralPatterns.tsx` | 3-lens AI pattern analysis (timing/exit/strategy) with time range sync, trade fingerprinting, severity-based findings, streaming progress, and history browser |
| AICostIndicator | `src/components/AICostIndicator.tsx` | Nav button with sparkle icon + centered modal (portaled): hero with count-up animation & sparkline, 30-day stacked AreaChart by model, feature BarChart, model split segmented bar, token efficiency, recent activity timeline. Privacy mode overlays on all charts |
| UncoveredHoldingsCard | `src/components/dashboard/UncoveredHoldingsCard.tsx` | Shows holdings not covered by calls, with per-ticker "Optimize" links to `/optimizer` and header CTA |
| DiscussChatLink | `src/components/DiscussChatLink.tsx` | "Discuss in Chat" button linking AI outputs to conversational coach |
| TickerAutocomplete | `src/components/shared/TickerAutocomplete.tsx` | Reusable ticker search input with autocomplete dropdown, used in all trade add/edit modals |
| OptimizerTickerStrip | `src/components/optimizer/OptimizerTickerStrip.tsx` | Horizontal ticker cards for uncovered holdings with coverage status, "AI Analyze All" button |
| OptimizerHoldingSummary | `src/components/optimizer/OptimizerHoldingSummary.tsx` | Selected ticker summary: cost basis, shares, stock price, underwater %, historical CC premium |
| OptimizerParamControls | `src/components/optimizer/OptimizerParamControls.tsx` | Preset strategy selector (conservative/moderate/aggressive/recovery) with active param chips and match count |
| OptimizerChainTable | `src/components/optimizer/OptimizerChainTable.tsx` | Sortable options chain table with strike, premium, annualized return, distance metrics, earnings collision warning, "Write This Call" action |
| OptimizerRecoveryChart | `src/components/optimizer/OptimizerRecoveryChart.tsx` | Recharts chart showing premium income vs cost basis gap for recovery projection |
| OptimizerScatterChart | `src/components/optimizer/OptimizerScatterChart.tsx` | Recharts scatter plot of annualized return vs delta for strike comparison |
| OptimizerTargetReturn | `src/components/optimizer/OptimizerTargetReturn.tsx` | Monthly return target selector with quick presets (1%/2%/4%/6%) and custom slider, context line showing per-share premium needed |
| OptimizerAIPanel | `src/components/optimizer/OptimizerAIPanel.tsx` | AI analysis with strategy lane cards (breakeven/balanced/income or yield-weekly/biweekly/monthly), catalyst banner, position type detection, metrics strips with called-away P/L and monthly/annualized returns. Falls back to top pick + alternates for old traces |
| OptimizerTraceViewer | `src/components/optimizer/OptimizerTraceViewer.tsx` | Visual agent trace: step-by-step tool calls, thinking, results with timing and cost. Uses React Flow for node graph |
| TraceHistoryDrawer | `src/components/optimizer/TraceHistoryDrawer.tsx` | Slide-out drawer listing past AI agent traces from MongoDB, click to replay. Supports `feature` filter prop to show only cc-optimizer or csp-optimizer traces |
| CspOptimizerFilterBar | `src/components/csp-optimizer/CspOptimizerFilterBar.tsx` | All CSP filter knobs (delta/DTE/ROR/IV/OI/score/marketCap/sector) with preset buttons (Conservative/Balanced/Aggressive/All) and match count |
| CspOptimizerSelectionBar | `src/components/csp-optimizer/CspOptimizerSelectionBar.tsx` | "Select Top N" quick buttons, selected count badge, estimated AI cost, "AI Analyze Selected" CTA |
| CspOptimizerTable | `src/components/csp-optimizer/CspOptimizerTable.tsx` | Pipeline results table with checkbox selection, AI status indicators (spinner/checkmark), sortable columns, "Write Put" action. Uses @tanstack/react-table |
| CspOptimizerAIPanel | `src/components/csp-optimizer/CspOptimizerAIPanel.tsx` | AI analysis cards with 3 strategy lanes (conservative/balanced/aggressive), catalyst banner, "Why This Trade" thesis, assignment scenario (effective cost basis, quality assessment, CC opportunity), position sizing (contracts, capital, heat impact), IV/Bollinger/sector context, key risks, "Write This Put" per lane, "Discuss in Chat" integration |
| CspOptimizerComparisonView | `src/components/csp-optimizer/CspOptimizerComparisonView.tsx` | Side-by-side ticker comparison table with strategy mode toggle, best-value highlighting, and per-metric ranking across analyzed tickers |
| CspOptimizerPipelineStatus | `src/components/csp-optimizer/CspOptimizerPipelineStatus.tsx` | Pipeline run status banner with opportunity count, freshness indicator, progress bar, and "Run Pipeline" / "Run Again" actions |
| ScreenerHub | `src/components/screeners/ScreenerHub.tsx` | Master screener component: manages active tab, filters, pipeline controls, and delegates to tab-specific result views |
| ScreenerTabBar | `src/components/screeners/ScreenerTabBar.tsx` | 5 color-coded tabs (CSP, PCS, Aggressive, Charts, Swing) with per-tab opportunity counts |
| ScreenerPipelineStrip | `src/components/screeners/ScreenerPipelineStrip.tsx` | Horizontal strip of pipeline cards with "Run All" button and overall pipeline status |
| ScreenerOverviewCards | `src/components/screeners/ScreenerOverviewCards.tsx` | 4 summary cards: top CSP, top PCS, confluence tickers (swing), and pipeline health with total opportunity count |
| ScreenerFilterBar | `src/components/screeners/ScreenerFilterBar.tsx` | Tab-aware filter controls with presets (Conservative/Balanced/Aggressive/All) and match count |
| ScreenerResultsPanel | `src/components/screeners/ScreenerResultsPanel.tsx` | Delegates to tab-specific result component (CspResultsView, PcsResultsView, AggressiveResultsView, ChartSetupsResultsView, SwingResultsView) |
| CspTable | `src/components/screeners/CspTable.tsx` | TanStack table for CSP opportunities: score badge, ticker, strike, DTE, ROR%, IV, OI, market cap, sector. Sortable, paginated, "Write Put" action |
| PcsTable | `src/components/screeners/PcsTable.tsx` | TanStack table for put credit spread opportunities |
| AggressiveCard | `src/components/screeners/AggressiveCard.tsx` | Card for individual aggressive call/put opportunity |
| SwingSignalCard | `src/components/screeners/SwingSignalCard.tsx` | Card for individual swing trade signal (long/short) |
| PipelineCard | `src/components/screeners/PipelineCard.tsx` | Card for single pipeline: status badge, last run time, duration, opportunity count, progress bar, "Run" button |
| QuickTradeButton | `src/components/screeners/QuickTradeButton.tsx` | One-click "Write This Put/Call" action button for trade creation from screener results |
| OpportunityScoreBadge | `src/components/screeners/OpportunityScoreBadge.tsx` | Reusable color-coded score display badge for CSP opportunity scores |

### Key Files

- `src/types/index.ts` — All TypeScript interfaces and type unions for trades, exit reasons, spread types, PLAnnotation, StrategyLane, OptimizerAIAnalysis, CspStrategyLane, CspOptimizerAIAnalysis
- `src/lib/utils.ts` — P/L calculations, formatting, CSV export, `cn()` class helper
- `src/lib/mongodb.ts` — MongoDB connection with dev-mode global caching
- `src/lib/collections.ts` — Typed collection accessors for each MongoDB collection (including annotations)
- `src/contexts/ToastContext.tsx` — Toast notification system (success/error/info) with auto-dismiss
- `src/contexts/PrivacyContext.tsx` — Privacy mode toggle with keyboard shortcut
- `src/app/page.tsx` — Dashboard aggregating stats across all trade types
- `src/app/analytics/page.tsx` — Charts, analytics, SPY benchmark, and P/L annotations
- `src/app/analysis/page.tsx` — Conversational AI trading coach with saved history
- `src/lib/ai.ts` — Shared Anthropic client, `aiCall()`, `aiStream()` (with retry on 529), `extractJSON()`, automatic usage tracking
- `src/lib/ai-data.ts` — Server-side portfolio data gathering for all AI features, includes `getCspTradesForTicker()` for CSP optimizer agent
- `src/lib/polygon.ts` — Polygon options chain fetcher with 5-min in-memory cache
- `src/lib/createTradeRoute.ts` — Generic API route factory for trade CRUD (GET, POST, PATCH, DELETE)
- `src/lib/fetcher.ts` — SWR fetch wrapper for GET requests
- `src/lib/strategy-colors.ts` — Canonical strategy color palette (text/bg/border classes + hex for Recharts) per strategy type
- `src/lib/starterPrompts.ts` — Context-aware starter prompt generation for AI chat
- `src/lib/chatContext.ts` — Portfolio context helpers for AI chat
- `src/lib/tavily.ts` — Tavily web search client for AI agents (CC Optimizer and CSP Optimizer)
- `src/lib/pipeline-runner.ts` — Python pipeline subprocess spawner with run tracking, progress parsing, 10-min timeout, and MongoDB result persistence. Maps `PipelineType` to Python module entry points
- `src/lib/screener-colors.ts` — Canonical screener color palette per tab (csp=emerald, pcs=purple, aggressive=amber, charts=blue, swing=cyan) with text/bg/border classes + hex
- `src/lib/auth.ts` — NextAuth v5 config: Google OAuth provider, single-email whitelist (`ALLOWED_EMAIL`), `authorized` callback for proxy
- `src/proxy.ts` — Next.js 16 edge proxy: redirects unauthenticated requests to `/login`, protects all pages and API routes

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
| `/api/agent-traces` | GET | Agent trace history (list or single by `?id=`). Supports `?feature=cc-optimizer` or `?feature=csp-optimizer` to filter by agent type |
| `/api/auth/[...nextauth]` | GET, POST | NextAuth v5 OAuth handlers (Google sign-in/out/callback) |

### API Routes — Market Data (Polygon.io)

| Endpoint | Description |
|----------|-------------|
| `/api/stock-prices` | Stock prices with snapshot + prev-close fallback for off-hours |
| `/api/option-quotes` | Option quotes and Greeks with session.close fallback for off-hours |
| `/api/stock-aggregates` | OHLC bar data for charts (5-min in-memory cache) |
| `/api/ticker-details` | Company name metadata |
| `/api/market-status` | Market open/closed/extended-hours |
| `/api/earnings-dates` | Estimated next earnings dates per ticker via Polygon financials (1h in-memory cache, up to 50 tickers) |

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
| `/api/ai/cc-optimizer` | POST | Streaming AI agent for CC optimization — auto-detects underwater vs above-water positions, parallel per-ticker tool_use loops (up to 8 iterations each) with 6 tools (options chain, stock price, historical prices, holdings, CC history, web search) and Tavily; accepts `targetReturnPct` for yield mode; returns SSE with strategy lanes, catalysts, progress, analysis, and agent trace |
| `/api/ai/csp-optimizer` | POST | Streaming AI agent for CSP optimization — takes tickers from pipeline screener results, runs parallel per-ticker analysis (up to 8 iterations each) with 7 tools (put options chain, stock price, historical prices, screener data, CSP history, portfolio exposure, web search); returns SSE with 3 strategy lanes (conservative/balanced/aggressive), assignment scenario, position sizing, catalysts, and agent trace. Traces saved with `feature: 'csp-optimizer'` |
| `/api/cc-optimizer` | GET | Options chain data with computed optimizer metrics (annualized return, distance from cost basis, recovery weeks, called-away P/L) for a ticker |
| `/api/chat/context` | POST | Create conversation with pre-loaded context |

### API Routes — Screeners & Pipelines

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/screeners/csp` | GET | Latest CSP_ENHANCED pipeline results with scored opportunities |
| `/api/screeners/csp/history` | GET | CSP score history for selected tickers (up to 50). Query: `?tickers=AAPL,MSFT`. Returns trend analysis (up/down/stable/new) |
| `/api/screeners/pcs` | GET | Latest PCS_SCREENER pipeline results |
| `/api/screeners/aggressive` | GET | Latest AGGRESSIVE_OPTIONS results with calls/puts/ticker_changes |
| `/api/screeners/charts` | GET | Latest CHART_SETUPS pipeline results |
| `/api/screeners/swing` | GET | Latest SWING_TRADES results with long/short signals |
| `/api/pipelines` | GET | Lists all 5 pipeline types with metadata (last run, status, duration, opportunity count) |
| `/api/pipelines/[type]/run` | POST | Spawns Python subprocess for pipeline type. Returns `{ runId, status: 'RUNNING' }` |
| `/api/pipelines/[type]/status/[runId]` | GET | Status of a specific pipeline run (in-memory + DB fallback) |
| `/api/pipelines/[type]/history` | GET | Run history for pipeline type. Query: `?limit=10` |
| `/api/pipelines/events/[runId]` | GET | SSE streaming endpoint for real-time pipeline progress (polls 500ms, 15-min timeout) |

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
- `ANTHROPIC_API_KEY` — Anthropic API key for 11 AI features (server-side only)
- `POLYGON_API_KEY` — Polygon.io API key for real-time stock/option prices (server-side only)
- `TAVILY_API_KEY` — Tavily API key for AI agent web search in CC Optimizer and CSP Optimizer (server-side only)
- `PIPELINE_SCRIPTS_DIR` — Path to Python pipelines directory (required for screener pipelines)
- `PYTHON_PATH` — Python binary path (optional, defaults to `python` or `{PIPELINE_SCRIPTS_DIR}/venv/bin/python`)
- `AUTH_SECRET` — NextAuth session encryption secret (generate via `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` — Google OAuth 2.0 client ID (from Google Cloud Console)
- `GOOGLE_CLIENT_SECRET` — Google OAuth 2.0 client secret
- `ALLOWED_EMAIL` — Single authorized email address (fail-secure: blocks all if unset)
- `AUTH_TRUST_HOST` — Set to `true` on Vercel deployments

### Dependencies

- **Next.js 16** — App Router with Turbopack
- **MongoDB** — via `mongodb` driver with typed collections
- **SWR** — Client-side data fetching with caching and revalidation
- **Recharts** — All charts and visualizations
- **Tailwind CSS** — Styling with custom dark theme tokens
- **date-fns** — Date formatting and calculations
- **Anthropic SDK** — 11 AI features: exit coach, smart alerts, trade check, patterns, roll advisor, earnings watch, daily summary, chat, cost tracker, CC optimizer agent, CSP optimizer agent (server-side)
- **Tavily** — Web search for AI agents in CC Optimizer and CSP Optimizer (analyst targets, earnings dates, news)
- **TanStack React Table** — Headless table for CSP optimizer and screener tables (`@tanstack/react-table`)
- **React Flow** — Node graph visualization for AI agent trace viewer (`@xyflow/react`)
- **NextAuth v5** — Authentication via Google OAuth, single-user email whitelist, edge proxy protection

### GitHub

- **Remote**: `origin` → `https://github.com/OptiTrade-AI/trading-dashboard.git`
- **Main branch**: `main`
- **PR workflow**: Feature branches → PR to main
- **`gh` CLI path**: `/c/Program Files/GitHub CLI/gh.exe` (Windows)
