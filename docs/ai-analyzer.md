# AI Strategy Analyzer

The AI Strategy Analyzer (`/analysis`) uses Claude to review your trading data and provide structured feedback.

## Features

- **Time range selection** — Analyze last 1W, 1M, 3M, 6M, YTD, all-time, or custom date ranges
- **Streaming responses** — Real-time streaming output with section-by-section rendering
- **Saved history** — Past analyses stored in MongoDB with browse/delete support
- **Structured output** — Scorecard, Top Findings, and Action Items sections with custom rendering
- **Privacy-aware** — Analysis content blurred when [Privacy Mode](privacy-mode.md) is active

## Requirements

Requires the `ANTHROPIC_API_KEY` environment variable to be set (server-side only).
