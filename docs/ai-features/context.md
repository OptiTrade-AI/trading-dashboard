# AI Features — Technical Context

This document captures the full technical context of the AI features implementation for future reference.

---

## Architecture

### Pattern: Simple LLM Calls, Not Agents

Every feature follows the same pattern — no agents, no tool use, no multi-step loops:

```
Gather data server-side (MongoDB + Polygon) → Construct focused prompt → Single Claude API call → Return response
```

**Why not agents?**
- Data is already gathered — all trades, Greeks, prices are in MongoDB/Polygon
- Decisions are scoped — each feature asks one specific question
- Latency matters — trading decisions need 1-2s response, not 15-30s agent loops
- Cost predictability — agent loops can 5-10x token usage unpredictably

### Model Selection

| Model | Use Case | Cost |
|-------|----------|------|
| `claude-haiku-4-5-20251001` | Exit Coach, Smart Alerts, Trade Check, Roll Advisor, Events Check | $0.80/$4.00 per 1M tokens |
| `claude-sonnet-4-6` | Chat (existing), Behavioral Patterns | $3.00/$15.00 per 1M tokens |

Haiku for all frequent/focused calls. Sonnet only for deep analysis (patterns) and conversation (chat).

---

## File Map

### Core Infrastructure

| File | Purpose |
|------|---------|
| `src/lib/ai.ts` | Shared Anthropic client, `trackAICall()`, `aiCall()`, `aiStream()` |
| `src/lib/ai-data.ts` | `gatherPortfolioData()`, `getClosedTradesForTicker()` — server-side data for all AI features |
| `src/lib/collections.ts` | Added `getAIUsageCollection()`, `getPatternAnalysesCollection()` for MongoDB collections |
| `src/types/index.ts` | `AIFeature`, `AIUsageRecord`, `AIUsageStats`, `ExitCoachVerdict`, `TradeCheckResult`, `SmartAlert`, `BehavioralPattern`, `RollRecommendation`, `EarningsEvent`, `PatternAnalysisRecord` |

### API Routes

| Route | Method | Model | Feature |
|-------|--------|-------|---------|
| `/api/ai/usage` | GET | N/A | Cost tracker — returns usage stats |
| `/api/ai/exit-coach` | POST | Haiku 4.5 | Streaming HOLD/CLOSE/ROLL verdict |
| `/api/ai/smart-alerts` | GET | Haiku 4.5 | Evaluates all open positions for alerts |
| `/api/ai/trade-check` | POST | Haiku 4.5 | Evaluates proposed trade against portfolio |
| `/api/ai/patterns` | GET/POST | Sonnet 4.6 | GET: fetch history (last 20 runs). POST: run new analysis, save to MongoDB |
| `/api/ai/roll-advisor` | POST | Haiku 4.5 | Roll parameter recommendations |
| `/api/ai/events-check` | GET | Haiku 4.5 | Earnings/events detection for tickers |
| `/api/chat` | POST | Sonnet 4.6 | Existing chatbot (retrofitted with tracking) |

### Client Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAIUsage` | `src/hooks/useAIUsage.ts` | SWR for `/api/ai/usage`, 1 min refresh |
| `useExitCoach` | `src/hooks/useExitCoach.ts` | Streaming fetch for exit coach |
| `useSmartAlerts` | `src/hooks/useSmartAlerts.ts` | SWR for smart alerts, 5 min during market hours |
| `useTradeCheck` | `src/hooks/useTradeCheck.ts` | On-demand trade evaluation |
| `useEarningsWatch` | `src/hooks/useEarningsWatch.ts` | SWR for events check, 4 hour refresh |

### UI Components

| Component | File | Where Used |
|-----------|------|------------|
| `AICostIndicator` | `src/components/AICostIndicator.tsx` | Navigation bar (right side) |
| `SmartAlertsBadge` | `src/components/dashboard/SmartAlertsBadge.tsx` | Dashboard (top, before hero) |
| `EarningsWatchCard` | `src/components/dashboard/EarningsWatchCard.tsx` | Dashboard (top, before hero) |
| `ScenarioSimulator` | `src/components/dashboard/ScenarioSimulator.tsx` | Dashboard (after theta card) |
| `AITradeCheck` | `src/components/AITradeCheck.tsx` | All 4 add-trade modals |
| `AIRollAdvisor` | `src/components/AIRollAdvisor.tsx` | CSP and CC close modals (roll mode) |
| `BehavioralPatterns` | `src/components/BehavioralPatterns.tsx` | Analytics page (bottom) |
| AI Coach tab | In `PositionDetailModal.tsx` | Position detail modal (4th tab) |

### Modified Existing Files

| File | Changes |
|------|---------|
| `src/types/index.ts` | Added 8 new type definitions |
| `src/lib/collections.ts` | Added `getAIUsageCollection()` |
| `src/app/api/chat/route.ts` | Added `trackAICall()` import and usage tracking after stream |
| `src/components/Navigation.tsx` | Added `AICostIndicator` import and render |
| `src/components/dashboard/PositionDetailModal.tsx` | Added AI Coach tab (4th chart tab) |
| `src/components/TradeModal.tsx` | Added `AITradeCheck` to AddTradeModal, `AIRollAdvisor` to CloseTradeModal |
| `src/components/CCModal.tsx` | Added `AITradeCheck` to AddCCModal, `AIRollAdvisor` to CloseCCModal |
| `src/components/DirectionalModal.tsx` | Added `AITradeCheck` to AddDirectionalModal |
| `src/components/SpreadsModal.tsx` | Added `AITradeCheck` to AddSpreadModal |
| `src/app/page.tsx` | Added `SmartAlertsBadge`, `EarningsWatchCard`, `ScenarioSimulator` imports and renders |
| `src/app/analytics/page.tsx` | Added `BehavioralPatterns` import and render |

---

## Token Economics

| Feature | Input | Output | Model | Frequency | Daily Cost |
|---------|-------|--------|-------|-----------|------------|
| Exit Coach | ~500-800 | ~100-150 | Haiku 4.5 | ~10/day | ~$0.01 |
| Smart Alerts | ~1,500-2,000 | ~200-500 | Haiku 4.5 | ~78/day (5 min) | ~$0.25 |
| Trade Entry Advisor | ~500-1,000 | ~100-200 | Haiku 4.5 | ~5-10/day | < $0.01 |
| Pattern Recognition | ~3,000-5,000 | ~500-1,000 | Sonnet 4.6 | Weekly | ~$0.05/use |
| Scenario Simulator | 0 | 0 | N/A (client-side) | On-demand | $0 |
| Roll Advisor | ~800-1,200 | ~200-300 | Haiku 4.5 | On-demand | Negligible |
| Earnings Watchdog | ~1,000 | ~300 | Haiku 4.5 | ~4/day | < $0.01 |
| Chat (existing) | ~2,000-4,000 | ~500-1,500 | Sonnet 4.6 | Varies | ~$0.02/msg |
| Cost Tracker | 0 | 0 | N/A (tracks others) | Passive | $0 |

---

## MongoDB Collections

### `aiUsage`
```ts
interface AIUsageRecord {
  timestamp: string;       // ISO date
  feature: AIFeature;      // 'chat' | 'exit-coach' | 'smart-alerts' | etc.
  model: string;           // 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6'
  inputTokens: number;
  outputTokens: number;
  costUsd: number;         // calculated from model pricing
  ticker?: string;         // optional, for position-specific calls
}
```

### `patternAnalyses`
```ts
interface PatternAnalysisRecord {
  id: string;              // UUID
  timestamp: string;       // ISO date of analysis run
  patterns: BehavioralPattern[];  // 3-5 pattern cards from Claude
  tradeCount: number;      // number of closed trades analyzed
  totalPL: number;         // total P/L at time of analysis
  winRate: number;         // win rate % at time of analysis
}
```

---

## Key Design Decisions

1. **Usage tracking is cross-cutting** — Every AI call goes through `trackAICall()` or `aiCall()`/`aiStream()` which auto-track. No AI route can skip tracking.

2. **Graceful degradation** — All features check for `ANTHROPIC_API_KEY` and return appropriate fallbacks (empty arrays, null, hide UI) when not configured.

3. **Privacy mode respected** — All AI UI components use `useFormatters().privacyMode` to mask financial data.

4. **Smart Alerts only poll during market hours** — Uses `useMarketStatus` to set `refreshInterval: isOpen ? 5min : 0`.

5. **Scenario Simulator is pure client-side math** — No LLM call needed. Uses `delta × S × Δ% × 100 × contracts + 0.5 × gamma × (S × Δ%)² × 100 × contracts` with live stock prices from `useStockPrices`.

6. **Pattern Recognition is on-demand** — User clicks "Analyze Patterns" button. Not automatic, because it uses Sonnet (more expensive).

7. **Data reuse** — `gatherPortfolioData()` is the single source of truth for server-side portfolio context, used by exit-coach, smart-alerts, trade-check, patterns, roll-advisor, and events-check.

8. **Streaming for Exit Coach** — Uses `aiStream()` for real-time response in the modal, same pattern as the chatbot.

9. **Non-streaming for structured responses** — Smart Alerts, Trade Check, Roll Advisor, Patterns all use `aiCall()` because they need to parse JSON from the response.

---

## Verification Checklist

For each feature:
- [x] `npx tsc --noEmit` — no type errors
- [x] `npm run build` — production build succeeds
- [ ] Manual test: trigger the feature in the UI, verify AI response renders correctly
- [ ] Test with `ANTHROPIC_API_KEY` unset — graceful fallback (hide AI elements or show setup prompt)
- [ ] Test with privacy mode on — all AI outputs masked
- [ ] Run `/review` before pushing
