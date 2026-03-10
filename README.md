# OptiTrade Dashboard

A professional-grade options trading journal built with **Next.js 14**, **MongoDB**, and **Tailwind CSS**. Track cash-secured puts, covered calls, directional trades, vertical spreads, and stock holdings — all in one sleek, dark-themed dashboard with deep analytics.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

<!-- ![Dashboard Screenshot](docs/screenshot.png) -->

---

## Features

| Feature | Description | Docs |
|---------|-------------|------|
| **Trade Logging** | CSPs, CCs, directional, spreads, holdings | [docs/trade-logging.md](docs/trade-logging.md) |
| **Dashboard** | Account overview, heat gauge, positions timeline | [docs/dashboard.md](docs/dashboard.md) |
| **Analytics** | 10+ interactive charts (P/L, streaks, heatmaps) | [docs/analytics.md](docs/analytics.md) |
| **Trade Management** | Rolls, partial closes, sorting, CSV export | [docs/trade-management.md](docs/trade-management.md) |
| **Holdings Auto-Sync** | CSP assignment adds shares, CC called away removes | [docs/holdings-sync.md](docs/holdings-sync.md) |
| **Privacy Mode** | One-click mask for all financial data | [docs/privacy-mode.md](docs/privacy-mode.md) |
| **AI Analyzer** | Claude-powered strategy review with saved history | [docs/ai-analyzer.md](docs/ai-analyzer.md) |
| **Performance** | SWR caching, optimistic mutations, deduplication | [docs/performance.md](docs/performance.md) |
| **API Routes** | REST endpoints for all trade types and market data | [docs/api-routes.md](docs/api-routes.md) |

### UI / UX

- Dark-only glass morphism theme with backdrop blur and glow effects
- Fully responsive — desktop grids collapse gracefully to mobile
- Skeleton loaders across all pages
- Color-coded P/L — green for profit, red for loss, amber for caution

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router + Turbopack) |
| Language | TypeScript 5 |
| Database | MongoDB 7.x |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts 3.6 |
| Caching | SWR 2.x |
| AI | Anthropic Claude API |
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
ANTHROPIC_API_KEY=sk-ant-...    # Optional: enables AI Strategy Analyzer
POLYGON_API_KEY=...             # Optional: enables real-time stock prices
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
│   ├── holdings/                   # Stock holdings
│   ├── stock/                      # Stock events / TLH
│   ├── analytics/                  # Analytics suite
│   ├── analysis/                   # AI Strategy Analyzer
│   └── api/                        # REST API routes
├── components/                     # UI components
├── contexts/                       # React context providers
├── hooks/                          # SWR data fetching hooks
├── lib/                            # MongoDB, utilities, calculations
└── types/                          # TypeScript interfaces
```

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
