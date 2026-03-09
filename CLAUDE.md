# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server with Turbopack (port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint

## Architecture

Options trading log built with **Next.js 14 (App Router)** + **MongoDB** + **Tailwind CSS**.

### Data Flow

Client hooks (`src/hooks/`) fetch from Next.js API routes (`src/app/api/`), which read/write to MongoDB via `src/lib/collections.ts`. The API pattern is simple: GET returns all documents, POST replaces the entire collection (delete-all + insert-many). There is no auth layer.

### Trade Types

Four independent trade types, each with its own type definition (`src/types/index.ts`), hook, API route, modal, and table component:

| Type | Hook | API Route | Page |
|------|------|-----------|------|
| Cash-Secured Puts (CSP) | `useTrades` | `/api/trades` | `/log` |
| Covered Calls (CC) | `useCoveredCalls` | `/api/covered-calls` | `/cc` |
| Directional (long calls/puts) | `useDirectionalTrades` | `/api/directional-trades` | `/directional` |
| Vertical Spreads | `useSpreads` | `/api/spreads` | `/spreads` |

### Key Files

- `src/types/index.ts` — All TypeScript interfaces and type unions for trades, exit reasons, spread types
- `src/lib/utils.ts` — P/L calculations, formatting, CSV export, `cn()` class helper
- `src/lib/mongodb.ts` — MongoDB connection with dev-mode global caching
- `src/lib/collections.ts` — Typed collection accessors for each MongoDB collection
- `src/app/page.tsx` — Dashboard aggregating stats across all trade types
- `src/app/analytics/page.tsx` — Charts and analytics (uses Recharts)
- `src/app/strategy/page.tsx` — Strategy reference page

### UI Conventions

- Dark theme only (`darkMode: 'class'`, always-on `dark` class on `<html>`)
- Custom color tokens in `tailwind.config.ts`: `profit` (green), `loss` (red), `caution` (amber), `card`, `muted`, `accent`
- Glass-card styling via `glass-card` CSS class; button styles via `btn-primary`
- `cn()` utility for conditional class names (simple filter+join, not clsx/tailwind-merge)

### Environment Variables

- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB` — Database name (defaults to `csp-tracker`)
