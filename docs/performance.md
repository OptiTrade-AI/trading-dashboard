# Performance & Caching

All data fetching uses [SWR](https://swr.vercel.app/) for a fast, responsive UI.

## SWR Features

- **Instant page transitions** — Cached data renders immediately while revalidating in the background
- **Request deduplication** — Identical requests within 10s are deduped (no redundant fetches)
- **Optimistic mutations** — Add, close, roll, and delete operations update the UI instantly before the API responds
- **Background revalidation** — Stale data is refreshed in the background without blocking navigation
