# Architecture

Visual guide to the OptiTrade Dashboard architecture.

---

## System Overview

```mermaid
graph TB
    subgraph Client["Browser (React)"]
        Pages["Pages<br/>Dashboard · Logs · Analytics · Optimizer · AI Chat"]
        Components["Components<br/>Modals · Cards · Charts"]
        Hooks["SWR Hooks<br/>useTrades · useOptionQuotes · useSmartAlerts<br/>usePortfolioPositions · useAnalyticsData · useCallOptimizer"]
        Contexts["Contexts<br/>Privacy · Toast"]
    end

    subgraph Server["Next.js API Routes"]
        TradeAPI["Trade APIs<br/>/api/trades · /api/covered-calls<br/>/api/directional-trades · /api/spreads"]
        MarketAPI["Market APIs<br/>/api/stock-prices · /api/option-quotes<br/>/api/stock-aggregates"]
        AIAPI["AI APIs<br/>/api/ai/exit-coach · /api/ai/smart-alerts<br/>/api/ai/roll-advisor · /api/chat"]
    end

    subgraph External["External Services"]
        MongoDB[(MongoDB)]
        Polygon["Polygon.io API"]
        Anthropic["Anthropic Claude API"]
        Tavily["Tavily Web Search"]
    end

    Pages --> Components
    Components --> Hooks
    Hooks --> Contexts
    Hooks -->|fetch / SWR| TradeAPI
    Hooks -->|fetch / SWR| MarketAPI
    Hooks -->|fetch / SWR| AIAPI
    TradeAPI -->|CRUD| MongoDB
    MarketAPI -->|REST| Polygon
    AIAPI -->|REST| Anthropic
    AIAPI -->|portfolio data| MongoDB
    AIAPI -->|options chain| Polygon
    AIAPI -->|web search| Tavily
```

---

## Data Flow

### Trade Operations

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant H as SWR Hook
    participant A as API Route
    participant M as MongoDB

    U->>C: Add / Close / Roll trade
    C->>H: mutate(newData)
    H->>H: Optimistic UI update
    H->>A: POST /api/trades
    A->>M: deleteMany + insertMany
    M-->>A: ack
    A-->>H: 200 OK
    H->>H: Revalidate cache
```

### Market Data Pipeline

```mermaid
sequenceDiagram
    participant H as SWR Hook
    participant A as API Route
    participant C as Cache
    participant P as Polygon.io

    H->>A: GET /api/stock-prices?tickers=AAPL,MSFT
    A->>C: Check in-memory cache
    alt Cache hit (< 5 min)
        C-->>A: Cached data
    else Cache miss
        A->>P: GET /v2/snapshot/locale/us/markets/stocks/tickers
        P-->>A: Price data
        A->>C: Store with TTL
    end
    A-->>H: { prices: [...] }

    Note over H: Refreshes every 60s (market open)<br/>or 300s (market closed)
```

### AI Feature Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant A as AI API Route
    participant D as ai-data.ts
    participant M as MongoDB
    participant P as Polygon.io
    participant AI as Claude API

    U->>C: Trigger AI feature
    C->>A: POST /api/ai/{feature}
    A->>D: gatherPortfolioData()
    D->>M: Fetch trades, settings
    M-->>D: Portfolio data
    D-->>A: Aggregated context

    opt Options Chain (Roll Advisor)
        A->>P: fetchOptionsChain()
        P-->>A: Available contracts
    end

    A->>A: Construct prompt
    A->>AI: aiCall() or aiStream()
    AI-->>A: Response + token counts
    A->>M: trackAICall() usage record
    A-->>C: JSON result or stream
    C->>U: Render result
```

---

## Page Architecture

```mermaid
graph LR
    subgraph Pages
        D["/ Dashboard"]
        L["/log CSP"]
        CC["/cc Covered Calls"]
        DR["/directional"]
        SP["/spreads"]
        H["/holdings"]
        SE["/stock Events"]
        AN["/analytics"]
        OPT["/optimizer CC Optimizer"]
        AI["/analysis AI Chat"]
    end

    subgraph Shared
        Nav["Navigation"]
        Toast["Toast Provider"]
        Privacy["Privacy Provider"]
        CmdK["Command Palette"]
        FAB["Quick-Add FAB"]
        Ticker["TickerAutocomplete"]
    end

    D --- Nav
    D --- Toast
    D --- Privacy
    D --- CmdK
    D --- FAB
    L --- Nav
    CC --- Nav
    DR --- Nav
    SP --- Nav
    H --- Nav
    SE --- Nav
    AN --- Nav
    OPT --- Nav
    AI --- Nav
```

---

## Database Schema

```mermaid
erDiagram
    TRADES {
        string id PK
        string ticker
        number strike
        number contracts
        string expiration
        string entryDate
        number premiumCollected
        number collateral
        string status
        string exitReason
    }

    COVERED_CALLS {
        string id PK
        string ticker
        number strike
        number contracts
        number sharesHeld
        number costBasis
        number premiumCollected
        string status
        string exitReason
    }

    DIRECTIONAL_TRADES {
        string id PK
        string ticker
        string optionType
        number strike
        number entryPrice
        number costAtOpen
        string status
        string exitReason
    }

    SPREADS {
        string id PK
        string ticker
        string spreadType
        number longStrike
        number shortStrike
        number netDebit
        number maxProfit
        number maxLoss
        string status
    }

    HOLDINGS {
        string id PK
        string ticker
        number shares
        number costBasisPerShare
        string acquiredDate
    }

    STOCK_EVENTS {
        string id PK
        string ticker
        number shares
        number costBasis
        number salePrice
        number realizedPL
        boolean isTaxLossHarvest
    }

    AI_USAGE {
        string timestamp
        string feature
        string model
        number inputTokens
        number outputTokens
        number costUsd
    }

    PATTERN_ANALYSES {
        string id PK
        string timestamp
        json patterns
        number tradeCount
        number totalPL
        number winRate
    }

    DAILY_SUMMARY {
        string id PK
        string summary
        string generatedAt
    }

    CONVERSATIONS {
        string id PK
        string title
        json messages
        string createdAt
    }

    AGENT_TRACES {
        string id PK
        string createdAt
        array tickers
        string mode
        json steps
        number totalDurationMs
        number totalInputTokens
        number totalOutputTokens
        number costUsd
        json result
    }

    ACCOUNT_SETTINGS {
        number accountValue
        number maxHeatPercent
        number alertDTEWarning
        number alertDTECritical
        number alertHeatThreshold
    }
```

---

## AI Features Map

```mermaid
graph TB
    subgraph Entry["Trade Entry"]
        TC["Trade Check<br/>proceed / caution / reconsider"]
    end

    subgraph Monitoring["Active Monitoring"]
        SA["Smart Alerts<br/>info · warning · critical"]
        EW["Earnings Watch<br/>upcoming events"]
        DS["Daily Summary<br/>hero banner line"]
    end

    subgraph Exit["Trade Exit"]
        EC["Exit Coach<br/>HOLD · CLOSE · ROLL"]
        RA["Roll Advisor<br/>+ live options chain"]
    end

    subgraph Analysis["Deep Analysis"]
        BP["Behavioral Patterns<br/>evolution tracking"]
        CH["AI Chat<br/>multi-turn conversations"]
        CO["CC Optimizer Agent<br/>tool_use + web search"]
    end

    subgraph Infra["Infrastructure"]
        CT["Cost Tracker<br/>usage & spend"]
        DC["Discuss in Chat<br/>context bridging"]
    end

    TC -->|"Discuss in Chat"| CH
    EC -->|"Discuss in Chat"| CH
    BP -->|"Discuss in Chat"| CH
    CO -->|"Write This Call"| AddCC["AddCCModal"]
    EC -->|"verdict: ROLL"| RA

    SA -.->|"polls 5 min"| SA
    EW -.->|"polls 4 hr"| EW
    DS -.->|"cached 24 hr"| DS

    TC -.->|tracks| CT
    SA -.->|tracks| CT
    EC -.->|tracks| CT
    RA -.->|tracks| CT
    BP -.->|tracks| CT
    CH -.->|tracks| CT
    EW -.->|tracks| CT
    CO -.->|tracks| CT
    DS -.->|tracks| CT
```

---

## Caching Strategy

```mermaid
graph LR
    subgraph Client["Client-Side (SWR)"]
        C1["Trade data<br/>dedup 10s"]
        C2["Stock prices<br/>60s open · 300s closed"]
        C3["Option quotes<br/>60s open · 300s closed"]
        C4["Smart Alerts<br/>5 min open · off closed"]
        C5["Earnings Watch<br/>4 hr"]
        C6["Daily Summary<br/>1 hr"]
        C7["AI Usage<br/>1 min"]
    end

    subgraph Server["Server-Side (In-Memory)"]
        S1["Stock aggregates<br/>5 min TTL"]
        S2["Options chain<br/>5 min TTL"]
    end

    subgraph DB["MongoDB"]
        D1["Daily summary<br/>24 hr TTL"]
        D2["Pattern analyses<br/>permanent"]
        D3["AI usage records<br/>permanent"]
    end
```

---

## Component Hierarchy (Dashboard)

```mermaid
graph TD
    Page["page.tsx (Dashboard)"]
    Page --> Portfolio["usePortfolioPositions<br/>(master data hook)"]

    Page --> Nav["Navigation + AICostIndicator"]
    Page --> Alert["ExpirationAlertBanner"]
    Page --> Smart["SmartAlertsBadge"]
    Page --> Earn["EarningsWatchCard"]
    Page --> Hero["Hero Banner"]
    Hero --> Summary["DailySummaryLine"]
    Page --> Pulse["Strategy Pulse Cards"]
    Page --> Greeks["PortfolioGreeksCard"]
    Page --> Theta["ThetaDashboardCard"]
    Page --> Pressure["PressureCard"]
    Page --> Timeline["PositionsTimeline"]
    Timeline --> Detail["PositionDetailModal"]
    Detail --> Coach["AI Exit Coach (tab 4)"]
    Page --> Capital["CapitalAllocationCard"]
    Page --> Recent["Recent Activity"]
    Page --> FAB["QuickAddFAB"]
    Page --> CmdK["CommandPalette"]

    FAB --> AddCSP["AddTradeModal"]
    FAB --> AddCC["AddCCModal"]
    FAB --> AddDir["AddDirectionalModal"]
    FAB --> AddSprd["AddSpreadModal"]

    AddCSP --> TradeCheck["AITradeCheck"]
    AddCC --> TradeCheck
    AddDir --> TradeCheck
    AddSprd --> TradeCheck
```

---

## Request Flow Summary

| Layer | Technology | Role |
|-------|-----------|------|
| **UI** | React + Tailwind | Dark-themed components, glass-card styling |
| **State** | SWR + React Context | Caching, optimistic updates, privacy/toast |
| **API** | Next.js App Router | Server-side routes, no auth layer |
| **Data** | MongoDB | Document store for all trade and AI data |
| **Market** | Polygon.io | Stock prices, option quotes, aggregates, events |
| **AI** | Anthropic Claude | Haiku 4.5 (fast calls), Sonnet 4.6 (deep analysis + CC Optimizer agent) |
| **Search** | Tavily | Web search for AI agent (analyst targets, earnings, news) |
