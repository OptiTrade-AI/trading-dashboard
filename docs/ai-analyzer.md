# AI Features

OptiTrade embeds AI intelligence at every decision point — from trade entry to exit, rolling, alerts, and portfolio review. All features use Claude via the Anthropic API.

## Requirements

- `ANTHROPIC_API_KEY` environment variable (server-side only)
- Optional: `POLYGON_API_KEY` for live options chain data in Roll Advisor and Trade Entry Advisor

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
| **CC Optimizer Agent** | `/optimizer` page → per-ticker or portfolio-wide | Sonnet 4.6 | Agentic tool-use loop with 6 tools + Tavily web search for CC recommendations |
| **AI Cost Tracker** | Navigation bar button → centered modal | N/A | Rich usage dashboard with charts and breakdowns |

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
Shown in all four add-trade modals (CSP, CC, Directional, Spreads). Fetches live market data in parallel (stock price from Polygon, options chain for Greeks) and computes strategy-specific metrics server-side.

**CSP analysis includes:** ROC, annualized ROC, distance to strike, delta/IV from options chain, premium quality assessment, assignment risk
**CC analysis includes:** ROS, annualized ROS, strike vs cost basis, called-away P/L, upside cap assessment, premium quality
**Directional/Spreads:** Stock price, distance to strike, risk/reward, sizing

Display shows:
- Recommendation badge (`proceed` / `caution` / `reconsider`) with headline
- Color-coded metrics bar (stock price, ROC/ROS, delta, IV, distance to strike, etc.)
- 3-5 strategy-specific insights from AI
- "Discuss in Chat" link with full context

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

### AI Cost Tracker
Navigation bar button that opens a centered modal dialog (max-width 3xl, portaled to document body):

- **Hero** — Today's spend with animated count-up (requestAnimationFrame, ease-out cubic), % change vs yesterday badge, inline SVG sparkline of last 7 days, stats grid (yesterday / week / month / all-time), total calls and avg daily spend
- **Daily Cost Chart** — Recharts stacked AreaChart of last 30 days, broken down by model (Haiku = purple, Sonnet = blue) with gradient fills
- **Feature Breakdown** — Horizontal BarChart with per-feature colors, sorted by cost, with call count legend
- **Model Split** — Segmented bar showing Haiku vs Sonnet cost proportions, detail cards with calls and percentage
- **Token Efficiency** — Input/output token segmented bar with totals, avg cost per call ranked by feature
- **Recent Activity** — Last 20 calls as compact timeline with relative timestamps, colored feature dots, ticker badges, and cost
- **Privacy Mode** — All cost values masked, charts replaced with "Hidden in privacy mode" overlay

Data comes from `/api/ai/usage` which aggregates all `AIUsageRecord` documents in a single pass computing daily breakdowns, feature/model splits, and token totals.

### CC Optimizer Agent
The first **agentic** AI feature — uses Claude's `tool_use` capability in a multi-step reasoning loop (up to 8 iterations per ticker) rather than a single prompt-response call.

**Architecture:** SSE streaming from `/api/ai/cc-optimizer`. The agent has access to 6 tools:
- `get_options_chain` — Live call options from Polygon.io
- `get_stock_price` — Current price from Polygon snapshot
- `get_historical_prices` — Daily OHLC for support/resistance analysis
- `get_holdings_data` — User's cost basis and share lots from MongoDB
- `get_cc_history` — Past covered call trades and total premium earned
- `web_search` — Tavily web search for analyst price targets, earnings dates, news

**Output per ticker:**
- Top pick with specific strike/expiration and reasoning
- Alternate strikes (higher premium / safer)
- Analyst consensus and earnings date from web search
- IV context and key risks
- Recovery projection (weeks to breakeven via premium collection)

**Agent Trace Viewer:** Every tool call, result, and thinking step is captured as an `AgentTraceStep` and streamed to the client in real-time. The trace viewer uses React Flow (`@xyflow/react`) to render a visual node graph of the agent's decision path. Completed traces are saved to the `agentTraces` MongoDB collection and can be replayed from the Trace History Drawer.

**Modes:**
- **Single ticker** — Runs one focused agent for the selected holding
- **Portfolio-wide** — Runs parallel per-ticker agents concurrently for all uncovered holdings, streaming results as each completes

**Integration:** "Write This Call" button in the optimizer chain table pre-fills the AddCCModal with strike, expiration, premium, and contracts for one-click CC creation.

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
| `/api/chat` | GET, POST, PATCH, DELETE | Sonnet 4.6 | GET: list conversations; POST: send message (streaming); PATCH: rename; DELETE: remove |
| `/api/ai/cc-optimizer` | POST | Sonnet 4.6 | Agentic CC optimization with parallel per-ticker tool_use loops (SSE streaming) |
| `/api/cc-optimizer` | GET | N/A | Options chain with computed optimizer metrics |
| `/api/agent-traces` | GET | N/A | List or fetch saved agent traces |
| `/api/chat/context` | POST | N/A | Create conversation with pre-loaded context |

---

## Architecture

Most AI features follow a simple single-call pattern:

```
Gather data server-side (MongoDB + Polygon) → Construct focused prompt → Single Claude API call → Return response
```

**Exception: CC Optimizer Agent** uses per-ticker agentic tool-use loops (up to 8 iterations each). In portfolio mode, tickers are analyzed in parallel. Each agent autonomously decides which tools to call (options chain, stock price, web search, etc.) and reasons across multiple steps before producing a final recommendation. This is the only multi-step AI feature.

- **Usage tracking is automatic** — Every call goes through `aiCall()` or `aiStream()` which auto-track tokens and cost
- **Retry with backoff** — `aiCall()` and `aiStream()` automatically retry up to 3 times on 529 (overloaded) responses with exponential backoff
- **Robust JSON parsing** — `extractJSON()` utility handles code fences, surrounding text, and partial responses when extracting structured data from AI output
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

| CC Optimizer | On-demand | ~$0.10–0.30/run |

**Estimated monthly cost:** $8-18/mo depending on usage intensity (excluding CC Optimizer agent runs).
