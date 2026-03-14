---
name: docs
description: Auto-update documentation (docs/, README.md, CLAUDE.md) to stay in sync with code changes
---

# Documentation Sync

Scan all pending code changes and ensure `docs/` files, `README.md`, and `CLAUDE.md` stay in sync with the actual codebase.

## Process

1. **Gather changes**: Run `git diff --name-only` and `git diff --cached --name-only` to identify all changed files. If no changes exist, inform the user and stop.

2. **Map changes to docs**: Determine which doc files are affected by the code changes:
   - New/removed API routes → `docs/api-routes.md`
   - New/removed components → `docs/dashboard.md`, `docs/ux-enhancements.md`
   - AI feature changes → `docs/ai-analyzer.md`
   - Trade type changes → `docs/trade-logging.md`, `docs/trade-management.md`
   - Holdings changes → `docs/holdings-sync.md`
   - Analytics changes → `docs/analytics.md`
   - Performance/caching changes → `docs/performance.md`
   - Architecture changes → `docs/architecture.md`
   - Privacy changes → `docs/privacy-mode.md`
   - New hooks/types/utils → `CLAUDE.md` tables
   - New pages or routes → `CLAUDE.md` Pages table
   - New env variables → `CLAUDE.md` Environment Variables section

3. **Cross-reference**: For each affected doc file, read both the doc and the changed code. Identify:
   - New features, routes, or components not yet documented
   - Removed features that are still documented
   - Changed behavior (renamed routes, updated intervals, new parameters, new env vars)
   - Stale version numbers or model references

4. **README check**: Read `README.md` and verify:
   - Feature matrix links match actual files in `docs/`
   - Technology versions are accurate
   - Setup instructions reflect current dependencies

5. **CLAUDE.md check**: Read `CLAUDE.md` and verify these tables match actual code:
   - Pages table (routes, descriptions)
   - Trade Types table (hooks, API routes)
   - Market Data Hooks table
   - Dashboard Components table
   - API Routes tables
   - Key Files list
   - Dependencies list
   - Custom Skills table

6. **Apply updates**: Edit affected doc files to reflect current code state. Only modify sections that are actually out of date.

7. **Summary**: Report what was updated and why, organized by file.

## Rules

- Only update docs that are affected by actual code changes — don't rewrite everything
- Preserve existing doc style, formatting, and structure
- Don't add speculative documentation for unfinished features
- Keep CLAUDE.md tables in sync — this is the most impactful doc to maintain
- When adding new entries to tables, follow the existing row format exactly
- Don't remove documentation for features that still exist in code, even if they weren't in the diff
- If no docs need updating, say so — don't make unnecessary edits
