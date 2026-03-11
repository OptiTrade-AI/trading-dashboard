# Trade Management

## Trade Editing

Edit modals allow updating any field on an open or closed trade:

- **CSP Edit Modal** — Edit ticker, strike, contracts, expiration, premium, entry date, notes
- **CC Edit Modal** — Edit ticker, strike, contracts, shares held, cost basis, expiration, premium, entry date, notes

Directional trades and vertical spreads do not currently have edit modals (add and close only).

## Roll Tracking

Rolls create a chain linking the original trade to each successor: Original → Roll 1 → Roll 2, etc. Each leg tracks its own P/L. Roll history is viewable via a dedicated modal on each trade log page.

## Partial Closes

Close X of Y contracts independently. The remaining contracts stay open as the original trade with an updated contract count.

## Sorting & Filtering

All trade tables support:
- Sort by any column (click header)
- Filter by status (open/closed)
- Filter by ticker or date range

## CSV Export

Each trade log page has an "Export CSV" button that downloads the full trade list for external analysis.

## Delete Confirmation

All destructive actions require confirmation via a modal dialog.
