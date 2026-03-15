# API Routes

All trade routes use `createTradeHandlers` for individual CRUD: GET returns all documents, POST inserts one, PATCH updates by `id`, DELETE removes by `id`.

## Trade Endpoints

| Endpoint | Collection | Methods |
|----------|-----------|---------|
| `/api/trades` | Cash-secured puts | GET, POST, PATCH, DELETE |
| `/api/covered-calls` | Covered calls | GET, POST, PATCH, DELETE |
| `/api/directional-trades` | Directional trades | GET, POST, PATCH, DELETE |
| `/api/spreads` | Vertical spreads | GET, POST, PATCH, DELETE |
| `/api/holdings` | Stock holdings | GET, POST, PATCH, DELETE |
| `/api/stock-events` | Stock events | GET, POST, PATCH, DELETE |
| `/api/annotations` | P/L chart annotations | GET, POST, PATCH, DELETE |
| `/api/settings` | Account settings | GET, POST |
| `/api/analysis` | AI trade analyses | GET, POST, DELETE |
| `/api/agent-traces` | AI agent trace history (supports `?feature=cc-optimizer` or `?feature=csp-optimizer` filter) | GET |

## AI Features (Anthropic Claude)

Requires the `ANTHROPIC_API_KEY` environment variable.

| Endpoint | Methods | Model | Description |
|----------|---------|-------|-------------|
| `/api/ai/exit-coach` | POST | Haiku 4.5 | Streaming HOLD/CLOSE/ROLL verdict for a position |
| `/api/ai/smart-alerts` | GET, POST | Haiku 4.5 | Position alerts. POST accepts `{ greeks }` for enrichment |
| `/api/ai/trade-check` | POST | Haiku 4.5 | Pre-trade risk evaluation against portfolio |
| `/api/ai/patterns` | GET, POST | Sonnet 4.6 | GET: fetch analysis history. POST: run new pattern analysis |
| `/api/ai/roll-advisor` | POST | Haiku 4.5 | Roll recommendations with live options chain data |
| `/api/ai/events-check` | GET | Haiku 4.5 | Earnings/events detection for open position tickers |
| `/api/ai/daily-summary` | GET | Haiku 4.5 | 1-2 sentence portfolio summary (24h cache) |
| `/api/ai/usage` | GET | N/A | AI usage stats: today/yesterday/week/month/all-time costs, 30-day daily breakdown by model, per-feature token splits, recent calls |
| `/api/chat` | GET, POST, PATCH, DELETE | Sonnet 4.6 | Conversational AI: GET lists conversations, POST sends message (streaming), PATCH renames, DELETE removes |
| `/api/ai/cc-optimizer` | POST | Sonnet 4.6 | Agentic CC optimization — auto-detects underwater vs above-water positions, parallel per-ticker tool_use loops (up to 8 iterations each) with 6 tools + Tavily web search. Accepts optional `targetReturnPct` for yield mode. SSE streaming with strategy lanes, catalysts, progress, analysis, and agent trace steps |
| `/api/ai/csp-optimizer` | POST | Sonnet 4.6 | Agentic CSP optimization — parallel per-ticker analysis (up to 8 iterations each) with 7 tools (put options chain, stock price, historical prices, screener data, CSP history, portfolio exposure, web search) + Tavily. Returns SSE with 3 strategy lanes (conservative/balanced/aggressive), assignment scenario, position sizing, catalysts, and agent trace. Traces saved with `feature: 'csp-optimizer'` |
| `/api/cc-optimizer` | GET | N/A | Options chain with computed CC optimizer metrics (annualized return, distance from cost basis, recovery weeks, called-away P/L). Query: `?ticker=AAPL&minDTE=7&maxDTE=60` |
| `/api/chat/context` | POST | N/A | Create conversation with pre-loaded context |

## Screeners & Pipelines

Python pipelines run as subprocesses, write results to MongoDB, and the Next.js API serves the latest results.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/screeners/csp` | GET | Latest CSP_SCREENER pipeline results with scored opportunities |
| `/api/screeners/csp/history` | GET | CSP score history for selected tickers. Query: `?tickers=AAPL,MSFT` (up to 50). Returns trend analysis (up/down/stable/new) |
| `/api/screeners/aggressive` | GET | Latest AGGRESSIVE_OPTIONS results with calls/puts separated + ticker changes |
| `/api/pipelines` | GET | Lists all pipeline types with metadata (last run, status, duration, opportunities) |
| `/api/pipelines/[type]/run` | POST | Spawns Python subprocess for pipeline type. Accepts optional `{ tickers: string[], config: CspPipelineConfig }` body. If no config, loads saved config from DB. Returns `{ runId, status: 'RUNNING' }` |
| `/api/pipelines/[type]/status/[runId]` | GET | Status of a specific pipeline run (in-memory + DB fallback) |
| `/api/pipelines/[type]/history` | GET | Run history for pipeline type. Query: `?limit=10` |
| `/api/pipelines/events/[runId]` | GET | SSE streaming for real-time pipeline progress (polls 500ms, 15-min timeout) |
| `/api/pipeline-config` | GET, POST | GET: `?pipelineType=CSP_SCREENER` returns stored config merged with defaults. POST: `{ pipelineType, config }` upserts singleton per pipeline type |

## Watchlists

Ticker watchlists stored in MongoDB, used by Python pipelines to determine which tickers to scan.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/watchlists` | GET | List all watchlists (add `?full=true` to include batches). Without `full`, batches are omitted for performance |
| `/api/watchlists` | POST | Create watchlist: `{ slug, name, batches: { batch_1: ["AAPL", ...] } }` |
| `/api/watchlists` | PATCH | Update watchlist: `{ id, batches?, name? }`. Auto-recomputes `tickerCount` |
| `/api/watchlists` | DELETE | Delete watchlist by `?id=` |
| `/api/watchlists/batches/[slug]` | GET | Returns raw batches object for a watchlist slug (e.g., `main-batches`). Consumed directly by Python pipelines via `ticker_loader.py` |

Seeded watchlists:
- `main-batches` — ~4,000 tickers in 4 batches (used by all pipelines)
- `sp-nasdaq` — ~500 S&P 500 / NASDAQ tickers (used by CSP screeners for quality scoring)

## Market Data (Polygon.io)

Requires the `POLYGON_API_KEY` environment variable.

### `/api/stock-prices`
Returns current stock prices for a comma-separated list of tickers.

- **Query**: `?tickers=AAPL,MSFT,TSLA`
- **Primary source**: Polygon snapshot endpoint (`/v2/snapshot/locale/us/markets/stocks/tickers`) — real-time during market hours
- **Price fallback chain**: `lastTrade.p` → `min.c` (minute aggregate) → `day.c` → `prevDay.c`. Uses `||` (not `??`) so zero values are skipped (important during pre/post market when `day.c` is 0)
- **Off-hours fallback**: If snapshot returns empty or partial data, falls back to Polygon's previous close endpoint (`/v2/aggs/ticker/{ticker}/prev`) per-ticker. This works on all API plans and always returns data
- **Response**: `{ prices: [{ ticker, price, change, changePercent, updatedAt }] }`

### `/api/option-quotes`
Returns live option quotes and Greeks for open positions.

- **Query**: `?symbols=O:AAPL260320P00200000,O:MSFT260417C00400000`
- **Source**: Polygon universal snapshot (`/v3/snapshot`)
- **Midpoint calculation**: `(bid + ask) / 2` during market hours. Off-hours fallback chain: `last_trade.price` → `day.close` → `session.close`
- **Response**: `{ quotes: [{ symbol, underlying, bid, ask, midpoint, lastPrice, volume, openInterest, delta, gamma, theta, vega, iv }] }`

### `/api/stock-aggregates`
Returns OHLC bar data for charting. Supports configurable timespan and date ranges.

- **Query**: `?ticker=AAPL&multiplier=5&timespan=minute&from=2026-03-10&to=2026-03-11`
- **Source**: Polygon aggregates endpoint (`/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`)
- **Caching**: 5-minute in-memory TTL cache to reduce API calls
- **Batch support**: Up to 20 tickers per request

### `/api/ticker-details`
Returns company metadata (name, description) for tickers.

- **Query**: `?tickers=AAPL,MSFT`
- **Source**: Polygon ticker details endpoint (`/v3/reference/tickers/{ticker}`)
- **Response**: `{ details: [{ ticker, name }] }`

### `/api/market-status`
Returns current market status (open, extended-hours, closed).

- **Source**: Polygon market status endpoint (`/v1/marketstatus/now`)
- **Response**: `{ status: { market: "open" | "extended-hours" | "closed", serverTime: string } }`
- **Mapping**: Polygon's `pre-market` and `after-hours` values are normalized to `extended-hours`

### `/api/earnings-dates`
Returns estimated next earnings dates for tickers via Polygon financials data.

- **Query**: `?tickers=AAPL,MSFT` (up to 50 tickers)
- **Source**: Polygon financials endpoint, extracts next estimated earnings date
- **Caching**: 1-hour in-memory TTL cache per ticker
- **Response**: `{ earningsDates: { AAPL: "2026-04-24", MSFT: null, ... } }`
