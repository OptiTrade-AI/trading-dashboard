# UX Enhancements

## Toast Notifications

All trade mutations (add, close, roll, delete, edit, partial close) trigger toast notifications confirming success or displaying errors. Wired into `useTradeData.ts` — the single integration point for all 5 trade types.

- Fixed bottom-right stack with auto-dismiss after 4 seconds
- Three styles: success (green), error (red), info (accent)
- Slide-in animation

## Quick-Add FAB

Floating action button (bottom-right corner) for adding trades without leaving the dashboard:

- Opens dropdown with CSP, CC, Directional, and Spread options
- Each opens the existing add modal for that trade type
- Keyboard shortcut: `N` (when no input is focused)
- Button rotates 45° when open

## Command Palette (Ctrl+K)

Global search overlay for fast navigation:

- Searches across all 5 trade types, holdings, stock events
- Matches on ticker, strike, expiration, notes, company name
- Results grouped by type with keyboard navigation (↑↓ Enter)
- Page shortcuts (Dashboard, Analytics, etc.) also searchable
- ESC to close

## CSV Import

Bulk trade import accessible from the "Import" button on the dashboard:

- File upload, drag-and-drop, or paste CSV text
- Select trade type (CSP, CC, Directional, Spread)
- Per-row validation against required columns
- Preview table with valid/invalid status indicators
- Import all valid rows in one click

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `N` | Open Quick-Add FAB menu |
| `Ctrl+K` | Open Command Palette |
| `Ctrl+Shift+H` | Toggle Privacy Mode |
