# Analytics Suite

The analytics page (`/analytics`) provides 10+ interactive charts powered by Recharts. All analytics data is computed by the `useAnalyticsData` hook, which accepts a time range filter (1W/1M/3M/6M/YTD/ALL) and returns 40+ metrics across all trade types.

## Charts

| Chart | Description |
|-------|-------------|
| Cumulative P/L with Drawdown | Running total with peak drawdown overlay |
| **Benchmark vs SPY** | Toggle to overlay normalized SPY returns on cumulative P/L chart (% return comparison) |
| Strategy Breakdown Donut | P/L distribution across strategies (click a slice to drill into trades) |
| Monthly Stacked Bar | P/L trends by strategy over time |
| P/L by Ticker | Horizontal bar ranking tickers by profitability |
| P/L Heatmap Calendar | Daily P/L intensity visualization |
| P/L Distribution Histogram | Trade outcome frequency ranges |
| Days Held vs P/L Scatter | Correlation analysis |
| Hold Time Analyzer | Min/avg/max hold times with bucketed win rates |
| Trade Frequency | Monthly trade count trends |
| Win/Loss Streaks | Current and longest streak tracking |
| Risk Metrics | Profit factor, avg win/loss, max drawdown |

## SPY Benchmark Comparison
The "vs SPY" toggle on the Cumulative P/L chart switches to a dual-line chart comparing:
- **Portfolio** — Cumulative P/L as a % of account value (green solid line)
- **SPY** — S&P 500 total return over the same period (blue dashed line)

Both series are normalized to % returns from the start of trading activity. Data fetched via the existing `useStockAggregates` hook (daily bars for SPY).

## P/L Annotations
Add dated notes to your P/L chart for context:
- Click "+ Add Note" to add an annotation with a date and label (e.g., "Fed rate decision", "Changed to defensive strategy")
- Annotations stored in MongoDB via `/api/annotations` endpoint
- Displayed as tags below the chart; click × to remove
- Useful for correlating P/L changes with market events or strategy shifts

## Strategy Trades Drill-Down
Click any slice on the Strategy Donut chart to open a modal showing all trades for that strategy:
- Summary stats (total P/L, win rate, avg P/L)
- Sortable table (by P/L, date, ticker)
- Per-trade details (ticker, strike/type, exit date, days held, P/L)

## Stock Capital Gains
The strategy breakdown section includes a Stock Capital Gains card when stock sale events exist:
- Total P/L from stock sales in the selected time range
- Win rate and stock count
- Largest gain ticker highlighted
- Included as a fifth segment (teal) in the Strategy Donut chart

All charts respect [Privacy Mode](privacy-mode.md) — they blur with a "Hidden" overlay when active.
