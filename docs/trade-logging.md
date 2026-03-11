# Multi-Strategy Trade Logging

OptiTrade supports five independent trade types, each with its own dedicated page, data model, and API.

## Strategies

| Strategy | Page | Description |
|----------|------|-------------|
| **Cash-Secured Puts** | `/log` | Track premium, collateral, ROC%, annualized returns |
| **Covered Calls** | `/cc` | Log against shares held with cost basis tracking |
| **Directional Trades** | `/directional` | Long calls and puts with per-contract cost tracking |
| **Vertical Spreads** | `/spreads` | Call/put debit & credit spreads with max profit/loss calculations |
| **Stock Holdings** | `/holdings` | Current share inventory with cost basis per lot |

### Cash-Secured Puts (`/log`)
Fields: ticker, strike, contracts, expiration, premium collected, entry date, notes. Auto-calculates collateral, DTE at entry, ROC%, and annualized return.

Exit reasons: `50% profit`, `early profit`, `time stop`, `rolled`, `support broke`, `assigned`, `expired worthless`, `other`.

### Covered Calls (`/cc`)
Fields: ticker, strike, contracts, shares held, cost basis, expiration, premium collected, entry date, notes. Links to holdings for cost basis lookups.

Exit reasons: `50% profit`, `early profit`, `time stop`, `rolled`, `called away`, `expired`, `other`.

### Directional Trades (`/directional`)
Fields: ticker, option type (call/put), strike, contracts, entry price, expiration, entry date, notes. Tracks cost at open and credit at close.

### Vertical Spreads (`/spreads`)
Four spread types: call debit, call credit, put debit, put credit. Fields: ticker, long/short strikes, long/short prices, contracts, expiration, entry date, notes. Auto-calculates net debit/credit, max profit, and max loss.

## Stock Events

The **Stock Events** page (`/stock`) serves as a sales ledger for realized stock P/L and tax loss harvesting. It supports replacement trade linking for wash sale tracking.

## Data Flow

Each strategy follows the same pattern:

1. **Client hook** (`src/hooks/use*.ts`) manages local state via SWR
2. **API route** (`src/app/api/*/route.ts`) handles CRUD against MongoDB
3. **MongoDB collection** stores the raw documents

See [API Routes](api-routes.md) for endpoint details.
