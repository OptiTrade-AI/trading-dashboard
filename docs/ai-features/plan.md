# AI Features Plan — Trading Dashboard

## Overview

8 AI features to embed intelligence at the point of decision across the trading dashboard. Architecture: simple LLM calls (not agents) — gather data server-side, construct focused prompt, single Claude API call, return response.

**Monthly cost estimate:** Must-haves only ~$8-12/mo | All 8 features ~$12-18/mo | Heavy chat adds ~$5-10/mo

---

## Feature Status

| # | Feature | Priority | Status | Phase |
|---|---------|----------|--------|-------|
| 1 | AI Exit Coach | MUST-HAVE | COMPLETED | 1 |
| 2 | Smart Alerts | MUST-HAVE | COMPLETED | 2 |
| 3 | Trade Entry Advisor | MUST-HAVE | COMPLETED | 2 |
| 4 | Behavioral Pattern Recognition | MUST-HAVE | COMPLETED | 4 |
| 5 | Portfolio Scenario Simulator | NICE-TO-HAVE | COMPLETED | 3 |
| 6 | AI Roll Advisor | NICE-TO-HAVE | COMPLETED | 4 |
| 7 | Earnings & Events Watchdog | NICE-TO-HAVE | COMPLETED | 3 |
| 8 | AI Cost Tracker | MUST-HAVE (Infra) | COMPLETED | 1 |
| 9 | Conversational Trade Assistant | N/A | PRE-EXISTING | N/A |

---

## Implementation Phases

### Phase 1: Shared Infrastructure + Cost Tracker + Exit Coach — COMPLETED

1. **`src/lib/ai.ts`** — Shared Anthropic client, `trackAICall()` usage wrapper, `aiCall()` (non-streaming), `aiStream()` (streaming) with automatic token tracking
2. **`src/lib/ai-data.ts`** — Server-side portfolio data gathering extracted from chat route. `gatherPortfolioData()` and `getClosedTradesForTicker()` reusable across all AI features
3. **`src/types/index.ts`** — Added `AIFeature`, `AIUsageRecord`, `AIUsageStats`, `ExitCoachVerdict`, `TradeCheckResult`, `SmartAlert`, `BehavioralPattern`, `RollRecommendation`, `EarningsEvent`
4. **`src/lib/collections.ts`** — Added `aiUsage` MongoDB collection accessor
5. **Feature 8: AI Cost Tracker** — `/api/ai/usage` GET route, `useAIUsage` hook, `AICostIndicator` nav component
6. **Retrofit `/api/chat/route.ts`** — Added `trackAICall()` to existing chatbot so its usage is tracked
7. **Feature 1: AI Exit Coach** — `/api/ai/exit-coach` POST streaming route, `useExitCoach` hook, AI Coach tab in `PositionDetailModal`

### Phase 2: Proactive Intelligence — COMPLETED

8. **Feature 2: Smart Alerts** — `/api/ai/smart-alerts` GET route, `useSmartAlerts` hook (polls 5 min during market hours), `SmartAlertsBadge` dashboard component
9. **Feature 3: Trade Entry Advisor** — `/api/ai/trade-check` POST route, `useTradeCheck` hook, `AITradeCheck` component added to all 4 add-trade modals

### Phase 3: Unique Capabilities — COMPLETED

10. **Feature 5: Scenario Simulator** — `ScenarioSimulator` client-side component with delta+gamma math, slider -10% to +10%, per-position impact bars
11. **Feature 7: Earnings Watchdog** — `/api/ai/events-check` GET route (with Polygon API enrichment), `useEarningsWatch` hook, `EarningsWatchCard` dashboard component

### Phase 4: Advanced Features — COMPLETED

12. **Feature 6: Roll Advisor** — `/api/ai/roll-advisor` POST route, `AIRollAdvisor` component with "Use suggestion" button, added to CSP and CC close modals
13. **Feature 4: Pattern Recognition** — `/api/ai/patterns` POST route (Sonnet 4.6), `BehavioralPatterns` component on Analytics page

---

## Post-Launch Fixes (2026-03-12)

Issues discovered during code audit and fixed:

| Fix | File(s) | Issue |
|-----|---------|-------|
| DTE off-by-one | `src/lib/utils.ts` | `calculateDTE()` used `new Date()` with time-of-day, causing Friday expirations to show 1 DTE on Wednesday evening. Fixed with `startOfDay()`. Affects dashboard, chatbot, all AI features. |
| Scenario Simulator math | `src/components/dashboard/ScenarioSimulator.tsx` | P/L formula was missing stock price (`S`), making all numbers meaningless. Added `stockPrice` to `OpenPosition`, sourced from `useStockPrices()`, formula now: `delta × S × Δ% × 100 × contracts + 0.5 × gamma × (S × Δ%)² × 100 × contracts` |
| Position Sizer removed | `src/components/PositionSizerModal.tsx` | Redundant with AI Trade Check. Only supported CSP/Spread, disconnected from trade flow. Deleted. |
| Behavioral Patterns persistence | `src/app/api/ai/patterns/route.ts`, `src/components/BehavioralPatterns.tsx` | Every analysis now saved to `patternAnalyses` MongoDB collection. Component loads latest on mount, history browser with date selector. |
| Exit Coach stream flush | `src/hooks/useExitCoach.ts` | Missing final `decoder.decode()` after stream ends — could lose buffered bytes on multi-byte chars. |
| Smart Alerts false positive | `src/app/api/ai/smart-alerts/route.ts` | JSON parse failure returned `available: true`, hiding broken state. Now returns `available: false`. |
| Trade Check capital calc | `src/app/api/ai/trade-check/route.ts` | `newCapital` used `\|\|` chain that could pick wrong field. Now uses explicit strategy-based logic (CSP → collateral, Directional → costAtOpen, Spread → maxLoss). |

---

## Future Enhancements (NOT YET BUILT)

These are the remaining enhancement ideas that can be built on top of the existing infrastructure. Each includes enough detail to implement from scratch.

---

### Enhancement 1: Richer Smart Alerts

**Status:** NOT STARTED

**Problem:** Smart alerts currently use only server-side position data (DTE, capital, ticker count). They lack live Greeks context, so they can't detect things like "delta approaching -0.40 on a sold put" or "IV crush opportunity after earnings." Alerts are also passive — only visible when the user is looking at the dashboard.

**What to build:**
1. **Live Greeks in alerts** — Pass option quote data (delta, gamma, theta, IV) from `useOptionQuotes` to the smart alerts evaluation. This requires changing `/api/ai/smart-alerts` from a server-only route to accept POST with client-side Greeks, or adding a server-side Polygon option quotes fetch.
2. **Push notifications** — Use the browser Notification API (`Notification.requestPermission()` + `new Notification(...)`) to alert when critical alerts fire. Add a permission prompt UI, respect user's notification preferences stored in `accountSettings`.
3. **Configurable thresholds** — Add alert settings to `AccountSettings`: `alertDTEWarning` (default 7), `alertDTECritical` (default 2), `alertHeatThreshold` (default 30%), `alertEnabled` (default true). New section in settings UI. Pass thresholds to the prompt.

**Technical approach:**
- Modify `/api/ai/smart-alerts` to accept optional `greeks` POST body (map of positionId → Greeks)
- Add `alertSettings` to `AccountSettings` type and settings API
- Add `useNotificationPermission()` hook
- Fire `new Notification()` from `useSmartAlerts` when new critical alerts appear (compare previous vs current alerts)

**New/modified files:**
- `src/app/api/ai/smart-alerts/route.ts` — accept POST with Greeks
- `src/types/index.ts` — add alert settings to `AccountSettings`
- `src/hooks/useSmartAlerts.ts` — add notification firing logic
- `src/components/dashboard/SmartAlertsBadge.tsx` — add notification permission toggle

---

### Enhancement 2: Roll Advisor for All Trade Types

**Status:** NOT STARTED

**Problem:** Roll advisor currently only exists in CSP and CC close modals. Directional trades and spreads can also be rolled, but those close modals have no AI guidance.

**What to build:**
- Add `AIRollAdvisor` component to `CloseDirectionalModal` and `CloseSpreadModal`
- Adapt the roll advisor prompt to handle directional (long calls/puts) and spread (vertical) rolling logic
- For spreads, rolling means adjusting both legs — the prompt needs to suggest new long/short strikes and expiration

**Technical approach:**
- `AIRollAdvisor` component already accepts generic position props — just wire it into the two missing modals
- Modify `/api/ai/roll-advisor` prompt to handle `strategy: 'Directional'` and `strategy: 'Spread'` with appropriate guidance
- For spreads: include both legs, current width, and suggest new width/strikes

**New/modified files:**
- `src/components/DirectionalModal.tsx` — add `AIRollAdvisor` to close modal roll mode
- `src/components/SpreadsModal.tsx` — add `AIRollAdvisor` to close modal roll mode
- `src/app/api/ai/roll-advisor/route.ts` — extend prompt for directional and spread strategies

---

### Enhancement 3: Pattern Evolution Tracking

**Status:** PARTIALLY DONE — persistence is implemented (every run saved to `patternAnalyses` collection, history browser in UI). What remains is the comparison and evolution features.

**What to build:**
1. **Cross-run comparison** — Feed the previous analysis into the prompt so Claude can say "Your win rate under 21 DTE improved from 58% to 72% since last analysis" or "You're still holding losers too long — avg 18 days vs 12 for winners, unchanged from last month."
2. **Auto-run weekly** — Optional cron-style trigger (or SWR with 7-day `refreshInterval`) that runs pattern analysis weekly and stores results. Show notification when new analysis is available.
3. **Trend visualization** — Small sparkline or arrow indicators showing how key metrics (win rate, avg hold time, P/L) have changed across the last N analyses.

**Technical approach:**
- In `/api/ai/patterns` POST, fetch the most recent saved analysis from `patternAnalyses` and include it in the prompt as "Previous analysis (from {date}): ..."
- Add a `lastAutoRun` field to track when the weekly analysis last fired
- In `BehavioralPatterns` component, compute metric diffs across history entries and show as sparklines or delta badges

**New/modified files:**
- `src/app/api/ai/patterns/route.ts` — fetch previous analysis, include in prompt
- `src/components/BehavioralPatterns.tsx` — add trend sparklines, metric diffs between runs

---

### Enhancement 4: AI Summary on Dashboard Hero

**Status:** NOT STARTED

**Problem:** The dashboard hero shows aggregate P/L numbers but no qualitative context. The user must mentally synthesize heat, DTE urgency, earnings risk, and trend data. A brief AI-generated daily summary could surface the one or two most important things.

**What to build:**
- New API route `/api/ai/daily-summary` (GET) that generates a 1-2 sentence portfolio summary
- Combines: open positions, heat level, nearest expirations, smart alerts, earnings dates, recent P/L trend
- Cached in MongoDB with 24-hour TTL (or until positions change)
- Renders as a subtle text line in the dashboard hero area below the P/L number

**Technical approach:**
- New GET route using `gatherPortfolioData()` + `aiCall()` with Haiku 4.5
- System prompt: "Generate a 1-2 sentence daily portfolio summary. Focus on the single most important thing the trader should know today."
- Store in new `dailySummary` collection: `{ date: string, summary: string, timestamp: string }`
- New `useDailySummary` SWR hook, refresh once per hour
- Render in `page.tsx` hero section, below the P/L total

**Model:** Haiku 4.5 (~500 input tokens, ~50 output tokens, negligible cost)

**New files:**
- `src/app/api/ai/daily-summary/route.ts`
- `src/hooks/useDailySummary.ts`
- Modify `src/app/page.tsx` — add summary line to hero

---

### Enhancement 5: Chat Integration ("Discuss in Chat")

**Status:** NOT STARTED

**Problem:** When Exit Coach says "ROLL to lower strike" or Trade Check flags "poor history on this ticker," the user might want to explore deeper. Currently they'd have to switch to `/analysis`, start a new conversation, and re-explain the context.

**What to build:**
- "Discuss in Chat" link on Exit Coach results, Trade Check results, and Pattern cards
- Clicking it navigates to `/analysis` with a pre-loaded conversation containing the relevant position context and AI result
- Uses existing chat infrastructure (`/api/chat` POST, conversation creation)

**Technical approach:**
- Add a utility function `createChatWithContext(context: string)` that POST to `/api/chat` to create a new conversation with a pre-filled user message
- Add "Discuss in Chat" button/link to `PositionDetailModal` (exit coach tab), `AITradeCheck`, `BehavioralPatterns`
- Use `router.push('/analysis?conversation={id}')` to navigate with the new conversation pre-selected

**New/modified files:**
- `src/lib/chat-utils.ts` — `createChatWithContext()` helper
- `src/components/dashboard/PositionDetailModal.tsx` — add discuss link to exit coach tab
- `src/components/AITradeCheck.tsx` — add discuss link to result
- `src/components/BehavioralPatterns.tsx` — add discuss link to pattern cards
- `src/app/analysis/page.tsx` — handle `?conversation=` query param on mount

---

### Enhancement 6: Scenario Simulator with AI Interpretation

**Status:** NOT STARTED

**Problem:** The scenario simulator now shows correct dollar P/L projections per position, but the numbers alone don't tell you what to DO about them. "Your 3 AAPL CSPs account for 80% of downside risk in a -5% move" is more actionable than showing -$2,400 on AAPL.

**What to build:**
- After the user moves the slider to a non-zero position, an optional "Interpret" button sends the scenario results to Claude for a qualitative 2-3 sentence summary
- Highlights concentration risk, positions most affected, and suggests hedging or de-risking actions

**Technical approach:**
- New POST route `/api/ai/scenario-interpret` that receives the scenario impacts array and move percentage
- Haiku 4.5, short prompt (~300 input tokens), returns 2-3 sentences
- Button in `ScenarioSimulator` below the impact bars, shows result inline
- On-demand only (user clicks), not automatic

**Model:** Haiku 4.5 (negligible cost, on-demand only)

**New files:**
- `src/app/api/ai/scenario-interpret/route.ts`
- Modify `src/components/dashboard/ScenarioSimulator.tsx` — add interpret button and result display

---

### Enhancement 7: Options Chain Integration for Roll Advisor

**Status:** NOT STARTED

**Problem:** The roll advisor suggests parameters (target strike, expiration, expected credit) without knowing what's actually tradeable. It might suggest rolling to a $145 strike when the nearest available strikes are $140 and $150.

**What to build:**
- Fetch the actual options chain from Polygon API for the ticker when the roll advisor is triggered
- Pass available strikes, expirations, and their Greeks/premiums to the prompt
- AI recommends from the actual available options, not hypothetical ones

**Technical approach:**
- New server-side utility `fetchOptionsChain(ticker, optionType, minDTE, maxDTE)` that calls Polygon's `/v3/reference/options/contracts` and `/v3/snapshot/options/{underlyingAsset}` endpoints
- Returns: `{ strikes: number[], expirations: string[], contracts: { strike, expiration, bid, ask, delta, theta, oi }[] }`
- Modify `/api/ai/roll-advisor` to call this utility and include the chain data in the prompt
- Claude picks from real contracts with real premiums

**Polygon API endpoints needed:**
- `GET /v3/reference/options/contracts?underlying_ticker={ticker}&expiration_date.gte={minDate}&expiration_date.lte={maxDate}&contract_type={put|call}`
- `GET /v3/snapshot/options/{ticker}` for live quotes on the chain

**New/modified files:**
- `src/lib/polygon.ts` — new `fetchOptionsChain()` utility
- `src/app/api/ai/roll-advisor/route.ts` — integrate chain data into prompt
