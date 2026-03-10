# API Routes

All trade routes support `GET` (fetch all) and `POST` (replace collection). Holdings and stock events also support `PATCH` and `DELETE` for individual records.

## Endpoints

| Endpoint | Collection |
|----------|-----------|
| `/api/trades` | Cash-secured puts |
| `/api/covered-calls` | Covered calls |
| `/api/directional-trades` | Directional trades |
| `/api/spreads` | Vertical spreads |
| `/api/holdings` | Stock holdings (GET/POST/PATCH/DELETE) |
| `/api/stock-events` | Stock events (GET/POST/PATCH/DELETE) |
| `/api/settings` | Account settings |
| `/api/analysis` | AI trade analyses (GET/POST/DELETE) |

## Market Data (Polygon.io)

| Endpoint | Description |
|----------|-------------|
| `/api/stock-prices` | Current stock prices |
| `/api/option-quotes` | Option chain quotes |
| `/api/ticker-details` | Ticker metadata |
| `/api/market-status` | Market open/closed status |

Requires the `POLYGON_API_KEY` environment variable.
