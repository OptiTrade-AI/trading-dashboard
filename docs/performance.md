# Performance & Caching

All data fetching uses [SWR](https://swr.vercel.app/) for a fast, responsive UI.

## SWR Features

- **Instant page transitions** — Cached data renders immediately while revalidating in the background
- **Request deduplication** — Identical requests within 10s are deduped (no redundant fetches)
- **Optimistic mutations** — Add, close, roll, and delete operations update the UI instantly before the API responds
- **Background revalidation** — Stale data is refreshed in the background without blocking navigation

## Market Data Refresh Intervals

| Data Source | Market Open | Market Closed / Extended |
|-------------|------------|------------------------|
| Stock prices (pressure card) | 60s | 300s (5 min) |
| Option quotes (Greeks, unrealized P/L) | 60s | 300s (5 min) |
| Market status | 60s | 60s |
| Ticker details | 3600s (1 hr) dedup | 3600s (1 hr) dedup |

## Server-Side Caching

- **Stock aggregates API** — 5-minute in-memory TTL cache to reduce Polygon API calls for chart data
