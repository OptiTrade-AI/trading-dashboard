# Dashboard

The main dashboard (`/`) aggregates stats across all trade types into a single overview.

## Sections

### Expiration Alert Banner
Shown when any open positions have DTE ≤ 2. Displays above the hero banner with:
- Ticker, strike, type badge, and DTE countdown for each expiring position
- "TODAY" label with pulse animation for 0 DTE positions
- Click to navigate to the relevant trade log page
- Dismissible per session (reappears on reload)

### Hero Banner
- **Account Value** — Editable inline; click to update
- **Realized P/L** — Net P/L broken down by options and stock
- **Unrealized P/L** — Live mark-to-market across all open positions (requires Polygon API)
- **Win Rate Gauge** — SVG donut showing overall win/loss ratio
- **Compact Heat Gauge** — Portfolio heat meter with safe (0–25%), caution (25–30%), and over-limit (30%+) zones

### Strategy Pulse Cards
At-a-glance P/L, open/closed counts per strategy (CSP, CC, Directional, Spreads, Stock).

### Portfolio Greeks Card
Shown when live option quote data is available. Displays aggregated Greeks for all open positions. **All Greeks are multiplied by contract count** for accurate portfolio-level totals:

- **Delta Semicircle Gauge** — Animated SVG arc from −5 to +5 with gradient fill and glowing needle. Shows bullish/bearish/neutral bias label
- **Daily Theta Block** — Large currency value (per-share × 100 × contracts) with animated gradient bar and monthly projection (~daily × 30)
- **Secondary Greeks Row** — Gamma (Γ), Vega (ν), and Avg IV (σ) each with icon, contextual label, and animated magnitude bar
- **Delta Exposure Chart** — Recharts horizontal bar chart grouping delta by ticker (top 6). Green gradient for positive, red for negative. Hidden in privacy mode
- **Risk Badge** — Pill in the header scored from delta magnitude + gamma + IV level + theta sign. Shows "Low Risk" (green glow), "Moderate" (amber), or "High Risk" (red)
- **Info Tooltips** — `title` attributes on each Greek label explaining the metric

**Sign convention:** Polygon reports Greeks from the option holder's perspective. For sold positions (CSP, CC), signs are negated in `useOptionQuotes.ts` to reflect the seller's exposure: selling a put gives positive delta (bullish), selling a call gives negative delta (gives up upside), and premium sellers earn positive theta (time decay works in your favor).

### Theta Income Card
Shown when live option quote data is available. Core metric card for premium sellers:

- **Daily / Weekly / Monthly** — Projected theta income ($daily, $daily × 5, $daily × 21)
- **Decay Acceleration** — Horizontal bar chart showing theta income by DTE bucket (0–7d, 8–14d, 15–30d, 30d+), visually demonstrating that theta accelerates near expiration
- **Top Contributors** — Top 5 positions ranked by daily theta with DTE indicators

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

**Profit Target Progress Bars** (sold positions):
- Gray (0–25%) — position is early
- Dim green (25–50%) — making progress
- Bright green + **pulse animation** at 50% — common "close at 50%" target reached
- Gold at 75%+ — deep profit capture, consider closing
- Threshold labels ("50%", "75%") appear as badges when targets are hit

### Position Detail Modal
Three-tab modal opened by clicking any position in the Timeline or Pressure Card:

- **Today Tab** — Intraday price chart (5-min candles)
- **Since Entry Tab** — Daily price chart from entry date
- **Stock 1Y Tab** — One-year daily price chart for the underlying
- **Key Metrics** — Unrealized P/L, DTE, Delta, Theta, IV, Profit Capture %
- **Strategy-Specific Metrics** — ROC (CSP), shares held (CC), cost at open (Directional), max profit/loss (Spreads)
- **Breakeven & Probability** — Calculated breakeven price and estimated probability of profit
- **Risk Metrics** — Additional risk context per position

### Uncovered Holdings Card
Shows stock holdings that don't have active covered calls written against them. Each uncovered ticker has an "Optimize" link to `/optimizer?ticker=XXX` for AI-powered call selection. The header "Optimize Calls" button links to the full Optimizer page.

### Capital Allocation Card
Segmented bar showing deployed capital across strategies (CSP collateral, CC shares, Directional cost, Spreads at-risk) with total utilization percentage relative to account value.

### Recent Activity
Last 8 closed trades across all types with P/L, exit date, and strategy badge.

### Quick-Add FAB
Floating action button (bottom-right) for adding trades without leaving the dashboard:
- Opens dropdown with CSP, CC, Directional, and Spread options
- Each opens the existing add modal for that trade type
- Keyboard shortcut: `N` (when no input is focused)
- Button rotates 45° when open

### Command Palette (Ctrl+K)
Global search overlay for fast navigation:
- Searches across all 5 trade types, holdings, stock events
- Matches on ticker, strike, expiration, notes, company name
- Results grouped by type with keyboard navigation (↑↓ Enter)
- Page shortcuts (Dashboard, Analytics, etc.) also searchable
- ESC to close

### Smart Alerts Badge
AI-powered proactive alerts for positions needing attention:
- Three severity levels: info, warning, critical
- Live Greeks enrichment from option quotes
- Browser notification support for critical alerts (opt-in)
- Configurable DTE and heat thresholds via Account Settings

### Earnings Watch Card
Upcoming earnings and events for open position tickers:
- Urgency levels based on days until event
- AI-generated recommendations per affected position

### Daily Summary Line
AI-generated 1-2 sentence portfolio summary in the hero banner:
- Cached for 24 hours in MongoDB
- Highlights the most notable portfolio item
- Respects privacy mode

### CSV Import
Bulk trade import accessible from the "Import" button:
- File upload, drag-and-drop, or paste CSV text
- Select trade type (CSP, CC, Directional, Spread)
- Per-row validation against required columns
- Preview table with valid/invalid status indicators
- Import all valid rows in one click
