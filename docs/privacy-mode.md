# Privacy Mode

Privacy mode masks all financial data across the entire app — useful for screen sharing, demos, or recordings.

## Usage

- **Toggle** — Click the eye icon in the navigation bar
- **Keyboard shortcut** — `Ctrl+Shift+H` (or `Cmd+Shift+H` on Mac)

## Coverage

- All dollar amounts, percentages, strike prices, and P/L values replaced with `***`
- Analytics charts are blurred with a "Hidden" overlay
- AI analysis content is blurred
- Portfolio Greeks card masks all values; delta exposure chart hidden entirely
- Positions Under Pressure masks prices and percentages
- Position Detail Modal masks all financial metrics
- Holdings page masks prices, cost basis, and P/L values
- Dashboard hero banner masks account value, realized/unrealized P/L

## Persistence

The setting is saved to `localStorage` and survives page refreshes.
