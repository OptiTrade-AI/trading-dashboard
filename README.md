# OptiTrade Dashboard

A professional-grade options trading journal built with **Next.js 14**, **MongoDB**, and **Tailwind CSS**. Track cash-secured puts, covered calls, directional trades, vertical spreads, and stock events — all in one sleek, dark-themed dashboard with deep analytics.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

<!-- Add your own screenshot here -->
<!-- ![Dashboard Screenshot](docs/screenshot.png) -->

---

## Features

### Multi-Strategy Trade Logging

| Strategy | Description |
|----------|-------------|
| **Cash-Secured Puts** | Track premium, collateral, ROC%, annualized returns |
| **Covered Calls** | Log against shares held with cost basis tracking |
| **Directional Trades** | Long calls and puts with per-contract cost tracking |
| **Vertical Spreads** | Call/put debit & credit spreads with max profit/loss calculations |
| **Stock Events** | Tax loss harvesting with replacement trade linking |

### Dashboard

- **Account Overview** — Editable account value, net P/L (options + stock), win rate gauge
- **Portfolio Heat Gauge** — Visual heat meter with safe/caution/over-limit zones
- **Strategy Pulse Cards** — At-a-glance P/L, win rate, and position counts per strategy
- **Open Positions Timeline** — Grouped by urgency: Critical (≤7 DTE), Caution (8-21), Safe (22-30), Distant (30+)
- **Capital Allocation** — Segmented bar showing deployment across strategies
- **Recent Activity** — Last 8 closed trades across all types

### Analytics Suite (10+ Charts)

- **Cumulative P/L with Drawdown** — Running total with peak drawdown overlay
- **Strategy Breakdown Donut** — P/L distribution across strategies
- **Monthly Stacked Bar** — P/L trends by strategy over time
- **P/L by Ticker** — Horizontal bar chart ranking tickers by profitability
- **P/L Heatmap Calendar** — Daily P/L intensity visualization
- **P/L Distribution Histogram** — Trade outcome frequency ranges
- **Days Held vs P/L Scatter** — Correlation analysis
- **Hold Time Analyzer** — Min/avg/max hold times with bucketed win rates
- **Trade Frequency** — Monthly trade count trends
- **Win/Loss Streaks** — Current and longest streak tracking
- **Risk Metrics** — Profit factor, avg win/loss, max drawdown

### Trade Management

- **Roll Tracking** — Full roll chain history (Original → Roll 1 → Roll 2...) with per-leg P/L
- **Partial Closes** — Close X of Y contracts independently
- **Sortable & Filterable Tables** — Sort by any column, filter by status/ticker/date range
- **CSV Export** — Export trade data for external analysis
- **Delete Confirmation** — Safe deletion with confirmation modals

### Privacy Mode

- **One-click toggle** — Eye icon in the navigation bar masks all financial data instantly
- **Keyboard shortcut** — `Ctrl+Shift+H` (or `Cmd+Shift+H` on Mac) to toggle
- **Full coverage** — All dollar amounts, percentages, strike prices, and P/L values replaced with `***`
- **Chart blur** — Analytics charts are blurred with a "Hidden" overlay when privacy is active
- **Persistent** — Setting saved to localStorage, survives page refreshes
- **Demo-friendly** — Perfect for sharing your screen or recording walkthroughs without exposing real P/L

### UI / UX

- **Dark-only glass morphism theme** — Semi-transparent cards with backdrop blur and glow effects
- **Fully responsive** — Desktop grid layouts collapse gracefully to mobile
- **Skeleton loaders** — Smooth loading states across all pages
- **Color-coded P/L** — Green for profit, red for loss, amber for caution — everywhere

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router + Turbopack) |
| Language | TypeScript 5 |
| Database | MongoDB 7.x |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts 3.6 |
| Dates | date-fns 4.x |
| IDs | uuid 13.x |

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Installation

```bash
git clone https://github.com/OptiTrade-AI/trading-dashboard.git
cd trading-dashboard
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb+srv://your-connection-string
MONGODB_DB=your-database-name
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── log/                        # CSP trade log
│   ├── cc/                         # Covered calls log
│   ├── directional/                # Directional trades log
│   ├── spreads/                    # Vertical spreads log
│   ├── stock/                      # Stock events / TLH
│   ├── analytics/                  # Analytics suite
│   ├── strategy/                   # Strategy reference
│   └── api/                        # REST API routes
│       ├── trades/
│       ├── covered-calls/
│       ├── directional-trades/
│       ├── spreads/
│       ├── stock-events/
│       └── settings/
├── components/                     # UI components
│   ├── *Modal.tsx                  # Entry/close/roll modals
│   ├── *Table.tsx                  # Sortable data tables
│   ├── Charts.tsx                  # 11+ chart components
│   ├── Navigation.tsx              # App navigation
│   ├── Providers.tsx               # Client-side context wrapper
│   ├── StatCard.tsx                # Reusable stat display
│   ├── PositionCard.tsx            # Open position cards
│   ├── HeatGauge.tsx               # Portfolio heat visualization
│   └── SkeletonLoader.tsx          # Loading states
├── contexts/
│   └── PrivacyContext.tsx          # Privacy mode global state
├── hooks/                          # Data fetching hooks
│   └── useFormatters.ts            # Privacy-aware formatting hook
├── lib/                            # MongoDB connection, utilities, calculations
└── types/                          # TypeScript interfaces
```

---

## API Routes

All routes support `GET` (fetch all) and `POST` (replace collection).

| Endpoint | Collection |
|----------|-----------|
| `/api/trades` | Cash-secured puts |
| `/api/covered-calls` | Covered calls |
| `/api/directional-trades` | Directional trades |
| `/api/spreads` | Vertical spreads |
| `/api/stock-events` | Stock events |
| `/api/settings` | Account settings |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

---

## License

MIT
