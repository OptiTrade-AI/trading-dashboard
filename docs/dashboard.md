# Dashboard

The main dashboard (`/`) aggregates stats across all trade types into a single overview.

## Sections

### Hero Banner
- **Account Value** — Editable inline; click to update
- **Realized P/L** — Net P/L broken down by options and stock
- **Unrealized P/L** — Live mark-to-market across all open positions (requires Polygon API)
- **Win Rate Gauge** — SVG donut showing overall win/loss ratio
- **Compact Heat Gauge** — Portfolio heat meter with safe (0–25%), caution (25–30%), and over-limit (30%+) zones

### Strategy Pulse Cards
At-a-glance P/L, open/closed counts per strategy (CSP, CC, Directional, Spreads, Stock).

### Portfolio Greeks Card
Shown when live option quote data is available. Displays aggregated Greeks for all open positions:

- **Delta Semicircle Gauge** — Animated SVG arc from −5 to +5 with gradient fill and glowing needle. Shows bullish/bearish/neutral bias label
- **Daily Theta Block** — Large currency value with animated gradient bar and monthly projection (~daily × 30)
- **Secondary Greeks Row** — Gamma (Γ), Vega (ν), and Avg IV (σ) each with icon, contextual label, and animated magnitude bar
- **Delta Exposure Chart** — Recharts horizontal bar chart grouping delta by ticker (top 6). Green gradient for positive, red for negative. Hidden in privacy mode
- **Risk Badge** — Pill in the header scored from delta magnitude + gamma + IV level + theta sign. Shows "Low Risk" (green glow), "Moderate" (amber), or "High Risk" (red)
- **Info Tooltips** — `title` attributes on each Greek label explaining the metric

### Positions Under Pressure
Real-time monitoring of positions approaching their strike prices. Uses live stock prices from Polygon.

- **Severity Levels** — Critical (ITM or within 2% + ≤7 DTE), Danger (within 2% or ≤3 DTE), Warning (approaching threshold)
- **Configurable Thresholds** — Per-strategy threshold settings (CSP, CC, Credit Spread) stored in localStorage
- **Live Price Updates** — Current stock price with daily change % and directional arrow
- **Market Status Badge** — Shows Market Open / Pre-After Hours / Market Closed
- **Collapsible** — Toggle to hide/show the card; state persisted in localStorage
- **Clickable Positions** — Opens the Position Detail Modal on click

### Open Positions Timeline
Positions grouped by expiration urgency:

- **Critical** (≤7 DTE) — red indicators
- **Caution** (8–21 DTE) — amber indicators
- **Safe** (22–30 DTE) — accent indicators
- **Distant** (30+ DTE) — muted indicators

Each row shows: ticker + company name, strategy badge, strike/contracts, unrealized P/L pill, profit capture bar (sold positions), Greeks badges (Δ, Θ, IV), expiration date, DTE countdown, and close button (CSPs). Clicking opens the Position Detail Modal.

### Position Detail Modal
Three-tab modal opened by clicking any position in the Timeline or Pressure Card:

- **Today Tab** — Intraday price chart (5-min candles)
- **Since Entry Tab** — Daily price chart from entry date
- **Stock 1Y Tab** — One-year daily price chart for the underlying
- **Key Metrics** — Unrealized P/L, DTE, Delta, Theta, IV, Profit Capture %
- **Strategy-Specific Metrics** — ROC (CSP), shares held (CC), cost at open (Directional), max profit/loss (Spreads)
- **Breakeven & Probability** — Calculated breakeven price and estimated probability of profit
- **Risk Metrics** — Additional risk context per position

### Capital Allocation Card
Segmented bar showing deployed capital across strategies (CSP collateral, CC shares, Directional cost, Spreads at-risk) with total utilization percentage relative to account value.

### Recent Activity
Last 8 closed trades across all types with P/L, exit date, and strategy badge.
