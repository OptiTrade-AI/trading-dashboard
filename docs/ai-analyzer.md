# AI Features

OptiTrade embeds AI intelligence at every decision point — from trade entry to exit, rolling, alerts, and portfolio review. All features use Claude via the Anthropic API.

## Requirements

- `ANTHROPIC_API_KEY` environment variable (server-side only)
- Optional: `POLYGON_API_KEY` for live options chain data in Roll Advisor

All AI features degrade gracefully when the API key is not configured — UI elements hide automatically.

---

## Features

| Feature | Trigger | Model | Description |
|---------|---------|-------|-------------|
| **AI Exit Coach** | Click position → AI Coach tab | Haiku 4.5 | Streaming HOLD / CLOSE / ROLL verdict with reasoning |
| **Smart Alerts** | Auto (5 min during market hours) | Haiku 4.5 | Proactive position alerts with configurable thresholds |
| **Trade Entry Advisor** | Open any add-trade modal | Haiku 4.5 | Pre-trade risk check against portfolio context |
| **Behavioral Patterns** | Analytics page → Analyze Patterns | Sonnet 4.6 | Deep pattern recognition across trading history |
| **Roll Advisor** | Close modal → roll mode | Haiku 4.5 | Strike/expiration suggestions with live options chain |
| **Earnings Watchdog** | Auto (4 hr refresh) | Haiku 4.5 | Upcoming earnings/events for open position tickers |
| **Daily Summary** | Auto (dashboard hero, 24h cache) | Haiku 4.5 | 1-2 sentence portfolio summary |
| **Conversational Coach** | `/analysis` page | Sonnet 4.6 | Multi-turn chat with full portfolio context |
| **AI Cost Tracker** | Navigation bar indicator | N/A | Tracks all AI usage and costs |

---

## Feature Details

### AI Exit Coach
Available in the Position Detail Modal (4th tab). Streams a structured verdict:
- **HOLD** — Position is on track, no action needed
- **CLOSE** — Take profit or cut loss now
- **ROLL** — Roll to new strike/expiration with suggested parameters

Uses position Greeks, P/L, DTE, and ticker history for context.

### Smart Alerts
Proactive dashboard alerts with three severity levels (info, warning, critical):
- **Live Greeks enrichment** — Passes delta, theta, IV from option quotes via POST
- **Configurable thresholds** — DTE warning/critical levels and heat threshold from Account Settings
- **Browser notifications** — Push notifications for critical alerts (opt-in via bell icon)
- Polls every 5 minutes during market hours, pauses when closed

### Trade Entry Advisor
Shown in all four add-trade modals (CSP, CC, Directional, Spreads). Evaluates:
- Position sizing relative to account and existing exposure
- Ticker history (past win rate, P/L on this ticker)
- Portfolio concentration risk
- Returns: `proceed` / `caution` / `reconsider` with specific notes

### Behavioral Patterns
Deep analysis using Sonnet 4.6 on your full trading history:
- **Evolution tracking** — Previous analysis fed into prompt for cross-run comparison
- **Delta badges** — Win rate and P/L changes shown with up/down arrows
- **Sparklines** — Inline SVG trend lines for win rate and P/L across history
- **Persistence** — Every analysis saved to MongoDB with history browser
- **Discuss in Chat** — Click to open a conversation about any pattern

### Roll Advisor
Available in all four close modals (CSP, CC, Directional, Spreads) when rolling:
- **Live options chain** — Fetches real contracts from Polygon API (strikes within 20% of current)
- **Market-informed** — Uses actual bid/ask for credit estimates when chain data available
- **Strategy-aware** — Different guidance for CSP (down and out), CC (up and out), Directional (same delta), Spreads (maintain width)
- **One-click apply** — "Use suggestion" populates roll fields automatically

### Earnings Watchdog
Dashboard card showing upcoming earnings and events:
- Scans all open position tickers against Polygon events data
- Urgency levels based on days until event
- Recommendations for each affected position

### Daily Summary
Single-line AI summary in the dashboard hero:
- Generated once per 24 hours, cached in MongoDB
- Highlights the most notable portfolio item (expiring position, high heat, streak, risk)
- Respects privacy mode

### Chat Integration
"Discuss in Chat" links appear on Exit Coach results, Trade Check results, and Pattern cards:
- Creates a new conversation with pre-loaded context
- Navigates to `/analysis` with the conversation selected
- Full multi-turn conversation with portfolio context

---

## API Routes

| Route | Method | Model | Purpose |
|-------|--------|-------|---------|
| `/api/ai/exit-coach` | POST | Haiku 4.5 | Streaming exit verdict |
| `/api/ai/smart-alerts` | GET, POST | Haiku 4.5 | Position alerts (POST accepts Greeks) |
| `/api/ai/trade-check` | POST | Haiku 4.5 | Pre-trade evaluation |
| `/api/ai/patterns` | GET, POST | Sonnet 4.6 | GET: history; POST: new analysis |
| `/api/ai/roll-advisor` | POST | Haiku 4.5 | Roll recommendations |
| `/api/ai/events-check` | GET | Haiku 4.5 | Earnings/events detection |
| `/api/ai/daily-summary` | GET | Haiku 4.5 | Cached daily summary |
| `/api/ai/usage` | GET | N/A | Usage stats and costs |
| `/api/chat` | POST | Sonnet 4.6 | Conversational chat |
| `/api/chat/context` | POST | N/A | Create conversation with pre-loaded context |

---

## Architecture

All AI features follow the same pattern — no agents, no tool use, no multi-step loops:

```
Gather data server-side (MongoDB + Polygon) → Construct focused prompt → Single Claude API call → Return response
```

- **Usage tracking is automatic** — Every call goes through `aiCall()` or `aiStream()` which auto-track tokens and cost
- **Privacy mode respected** — All AI UI components mask financial data when active
- **Graceful degradation** — Features hide when `ANTHROPIC_API_KEY` is not set

---

## Cost Estimates

| Feature | Frequency | Daily Cost |
|---------|-----------|------------|
| Smart Alerts | ~78/day (5 min polling) | ~$0.25 |
| Exit Coach | ~10/day on-demand | ~$0.01 |
| Trade Check | ~5-10/day on-demand | < $0.01 |
| Pattern Recognition | Weekly on-demand | ~$0.05/use |
| Roll Advisor | On-demand | Negligible |
| Earnings Watchdog | ~4/day | < $0.01 |
| Daily Summary | 1/day | Negligible |
| Chat | Varies | ~$0.02/msg |

**Estimated monthly cost:** $8-18/mo depending on usage intensity.
