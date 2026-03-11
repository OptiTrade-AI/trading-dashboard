# API Routes

All trade routes support `GET` (fetch all) and `POST` (replace collection). Holdings and stock events also support `PATCH` and `DELETE` for individual records.

## Trade Endpoints

| Endpoint | Collection | Methods |
|----------|-----------|---------|
| `/api/trades` | Cash-secured puts | GET, POST |
| `/api/covered-calls` | Covered calls | GET, POST |
| `/api/directional-trades` | Directional trades | GET, POST |
| `/api/spreads` | Vertical spreads | GET, POST |
| `/api/holdings` | Stock holdings | GET, POST, PATCH, DELETE |
| `/api/stock-events` | Stock events | GET, POST, PATCH, DELETE |
| `/api/settings` | Account settings | GET, POST |
| `/api/analysis` | AI trade analyses | GET, POST, DELETE |
| `/api/annotations` | P/L chart annotations | GET, POST |

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
