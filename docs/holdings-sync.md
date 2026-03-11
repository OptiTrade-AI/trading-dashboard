# Holdings & Auto-Sync

## Stock Holdings

The Holdings page (`/holdings`) tracks your current share inventory — ticker, shares, cost basis per share, and acquisition date. Holdings are used by Covered Calls for automatic cost basis lookups when opening new positions.

### Visual Features

- **Portfolio Return Chart** — Line chart showing realized P/L over time
- **Portfolio Donut Chart** — P/L breakdown by ticker with interactive segments
- **Return Ranking Chart** — Horizontal bar chart ranking tickers by returns
- **Holdings Treemap** — Visual representation of position sizes (larger blocks = bigger positions)
- **Sparklines** — 52-week price sparklines per ticker row
- **52-Week High/Low Bar** — Visual context showing where current price sits within the yearly range
- **Intraday Chart** — Real-time price chart for the current trading session
- **SPY Benchmark** — Portfolio performance compared against SPY in charts

### Real-Time Data

- **Live Pricing** — Current stock prices with daily change % (via Polygon API)
- **Market Status Badge** — Shows market open/closed/extended hours
- **Edit Modal** — Modify holdings (shares, cost basis, date) inline

### Holdings Heatmap

Color-coded grid showing daily performance across all holdings. Green for gains, red for losses, intensity proportional to magnitude.

## Auto-Sync: CSP Assignment

When a Cash-Secured Put is closed with exit reason **"assigned"** (full or partial close), a new holding lot is automatically created:

- **Ticker** — from the CSP trade
- **Shares** — contracts × 100 (or partial contract count × 100)
- **Cost basis per share** — the put's strike price
- **Acquired date** — the exit/assignment date
- **Notes** — auto-generated label (e.g., `Auto: AAPL $150P assigned`)

## Auto-Sync: CC Called Away

When a Covered Call is marked as **called away** (full or partial close), shares are automatically removed from Holdings using FIFO (first-in, first-out) lot consumption:

1. Lots for the ticker are sorted by acquired date (oldest first)
2. Fully consumed lots are deleted
3. The last partially consumed lot has its share count reduced

If no matching holdings exist (e.g., user hasn't added them), the removal silently no-ops — the Stock Event sale is still logged regardless.

## Stock Events

Separately from Holdings, when a CC is called away, a **Stock Event** is auto-logged to the sales ledger with realized P/L and tax loss harvest flagging. This happens independently of the Holdings sync.
