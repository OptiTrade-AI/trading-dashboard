# Limits, Filters & Refresh Rates

Reference for all data limits, caching, refresh intervals, and AI constraints across the platform. Updated 2026-03-14.

---

## Market Data (Polygon.io)

### Options Chain (`src/lib/polygon.ts`)

| Setting | Value | Notes |
|---------|-------|-------|
| Cache TTL | **5 minutes** | In-memory cache per ticker/type/DTE combo. Stale during fast markets. |
| Contracts per API page | **250** | Auto-paginates via `next_url` |
| Max contracts per fetch | **1,000** | Hard cap — extremely wide chains may lose far OTM strikes |
| Max snapshots per fetch | **1,000** | Greeks/pricing data, same pagination |
| Snapshot fallback | session.close → day.close → prevDay.close | When live bid/ask unavailable (off-hours) |

### Stock Prices (`src/hooks/useStockPrices.ts`)

| Setting | Value |
|---------|-------|
| Refresh (market open) | **60 seconds** |
| Refresh (market closed) | **5 minutes** |
| Fallback | Snapshot → previous close per-ticker |

### Option Quotes / Greeks (`src/hooks/useOptionQuotes.ts`)

| Setting | Value |
|---------|-------|
| Refresh (market open) | **60 seconds** |
| Refresh (market closed) | **5 minutes** |
| Greeks perspective | Negated for sold positions (seller's view) |

### Stock Aggregates (`src/hooks/useStockAggregates.ts`)

| Setting | Value |
|---------|-------|
| Refresh | **5 minutes** |
| Server cache TTL | **5 minutes** |

### Other Market Data Hooks

| Hook | Refresh Rate |
|------|-------------|
| `useMarketStatus` | 60s |
| `useTickerDetails` | Dedup 1 hour |
| `useIntradayData` | 60s (market open only) |
| `usePressure` | 60s open / 5 min closed |

---

## Covered Call Optimizer

### Data Fetching (`/api/cc-optimizer`)

| Setting | Value | Notes |
|---------|-------|-------|
| DTE range | **0–90 days** | Includes same-day weeklies through 3-month expirations |
| SWR dedup interval | **60 seconds** | Won't re-fetch same ticker within 60s |
| Strike viability filter | Hides strikes < 30% of stock price | Removes deep ITM junk |
| Strike viability filter | Hides deep ITM (> 40%) with no delta | Removes no-data artifacts |

### Client Param Presets (`src/hooks/useCallOptimizer.ts`)

| Preset | Delta Range | DTE Range | Min Premium |
|--------|------------|-----------|-------------|
| **Conservative** | 0.10 – 0.20 | 21 – 60 d | $0.10 |
| **Moderate** | 0.15 – 0.30 | 7 – 45 d | $0.10 |
| **Aggressive** | 0.25 – 0.40 | 0 – 21 d | none |
| **Recovery** | 0.10 – 0.40 | 0 – 90 d | none |

### Fine-Tune Slider Ranges (`OptimizerParamControls.tsx`)

| Param | Min | Max | Step |
|-------|-----|-----|------|
| Delta | 0.05 | 0.50 | 0.05 |
| DTE | 0 | 90 | 1 |
| Min Premium | $0.00 | $5.00 | $0.05 |

---

## AI Features — Limits

### CC Optimizer Agent (`/api/ai/cc-optimizer`)

| Setting | Value | Notes |
|---------|-------|-------|
| Model | **Claude Sonnet 4.6** | Best reasoning for strategy analysis |
| Max agent iterations | **30** | Safety cap for the tool-use loop |
| Max tokens per response | **8,192** | Claude output cap per iteration |
| Options chain sent to agent | **80 contracts** | Filtered to midpoint > 0, sorted by exp/strike |
| Agent default DTE range | **0–90 days** | Passed to Polygon via `get_options_chain` tool |
| Historical prices to agent | **20 most recent bars** | Daily OHLC, from 90-day window |
| Closed CC history to agent | **Last 20 trades** | Per-ticker CC history |
| Web search results | **5 per query** | Tavily API limit |
| Web search content | **500 chars per result** | Snippet truncation |
| Trace save | **Full trace to MongoDB** | Every step, input, output, timing, cost |

### Roll Advisor (`/api/ai/roll-advisor`)

| Setting | Value | Notes |
|---------|-------|-------|
| Model | Haiku 4.5 | |
| Max tokens | 800 | |
| Options chain filter | **±20% of current strike** | Only nearby strikes shown |
| Options chain limit | **15 contracts** | Sorted by exp then strike |

### Trade Entry Advisor (`/api/ai/trade-check`)

| Setting | Value |
|---------|-------|
| Model | Haiku 4.5 |
| Max tokens | 1,024 |
| Chain fetched | Full chain (7–60 DTE) for CSP/CC only |

### Exit Coach (`/api/ai/exit-coach`)

| Setting | Value |
|---------|-------|
| Model | Haiku 4.5 |
| Max tokens | 512 |
| Ticker history | Last 10 closed trades |

### Smart Alerts (`/api/ai/smart-alerts`)

| Setting | Value |
|---------|-------|
| Model | Haiku 4.5 |
| Max tokens | 1,024 |
| Poll interval | **5 min** (market open only) |
| Auto-pause | Stops polling when market closed |

### Behavioral Patterns (`/api/ai/patterns`)

| Setting | Value |
|---------|-------|
| Model | **Sonnet 4.6** |
| Max tokens | 2,048 |
| Ticker performance | **Top 10** tickers by trade count |

### Earnings Watchdog (`/api/ai/events-check`)

| Setting | Value |
|---------|-------|
| Model | Haiku 4.5 |
| Max tokens | 1,024 |
| Tickers scanned | **First 10** unique open position tickers |
| Lookahead | **2 months** from today |
| Refresh interval | **4 hours** |

### Daily Summary (`/api/ai/daily-summary`)

| Setting | Value |
|---------|-------|
| Model | Haiku 4.5 |
| Max tokens | 512 |
| Cache duration | **24 hours** (MongoDB) |
| Refresh interval | **1 hour** (client poll) |
| Stock events context | Last 3 events |

### Conversational Coach (`/api/chat`)

| Setting | Value |
|---------|-------|
| Model | **Sonnet 4.6** |
| Streaming | Yes |
| Context | Full portfolio data via `gatherPortfolioData()` |

### AI Usage Tracker (`/api/ai/usage`)

| Setting | Value |
|---------|-------|
| Recent calls shown | **Last 20** |
| Client refresh | **60 seconds** |

---

## Portfolio Data Gathering (`src/lib/ai-data.ts`)

Used by most AI features for portfolio context:

| Setting | Value |
|---------|-------|
| Lookback window | **6 months** for closed trade stats |
| Stock events | Last 10 events |
| Ticker concentration | All open position tickers counted |

---

## Trace History (`/api/agent-traces`)

| Setting | Value |
|---------|-------|
| List page size | **20** (max 50) |
| Full trace fetch | By ID, includes all steps + result |
| Storage | MongoDB `agentTraces` collection |
| Retention | **Unlimited** (no auto-cleanup) |

---

## Caching Summary

| Layer | TTL | Mechanism |
|-------|-----|-----------|
| Options chain | 5 min | In-memory Map |
| Stock aggregates | 5 min | In-memory Map |
| Daily summary | 24 hours | MongoDB |
| Ticker details | 1 hour | SWR dedup |
| SWR fetches | 60s dedup (optimizer) | SWR config |
| Smart alerts | 5 min polling | SWR refreshInterval |
| Earnings watch | 4 hour polling | SWR refreshInterval |

---

## Environment Variables

| Variable | Required By | Scope |
|----------|------------|-------|
| `MONGODB_URI` | All features | Server |
| `MONGODB_DB` | All features (default: `csp-tracker`) | Server |
| `ANTHROPIC_API_KEY` | All AI features | Server |
| `POLYGON_API_KEY` | Market data, options chain, stock prices | Server |
| `TAVILY_API_KEY` | CC Optimizer web search tool | Server |
