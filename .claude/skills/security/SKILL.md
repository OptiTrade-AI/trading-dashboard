---
name: security
description: Deep scan for leaked secrets, credentials, and confidential data before pushing to GitHub
---

# Security — Credential & Secret Guard

Deep scan of all pending changes and the full repo for leaked secrets, credentials, and confidential data. This is a dedicated pre-push secret scanner, more focused than `/review`'s security section.

## Process

1. **Gather scope**: Run `git diff`, `git diff --cached`, and `git status` to find all changed/new files. Read every changed file in full.

2. **Secret pattern scan** — Check changed files AND scan the full repo for:
   - API keys and tokens: `sk-`, `pk_`, `AKIA`, `ghp_`, `gho_`, `xoxb-`, `xoxp-`, `Bearer `
   - Passwords: `password\s*=`, `passwd`, `secret\s*=`, `token\s*=` (outside type definitions)
   - `.env` files or env-like content (`KEY=value`) in committed files
   - Hardcoded connection strings: MongoDB URIs (`mongodb+srv://`), database URLs, Redis URLs
   - Private keys: `-----BEGIN.*PRIVATE KEY-----`
   - JWT tokens: `eyJ` followed by base64 content
   - Webhook URLs: Slack webhook URLs, Discord webhook URLs
   - AWS credentials: `AKIA`, `aws_access_key_id`, `aws_secret_access_key`
   - Anthropic keys: `sk-ant-`
   - Polygon keys in code (not just env references)

3. **Gitignore audit** — Read `.gitignore` and verify these sensitive patterns are present:
   - `.env`, `.env.*`, `.env.local`, `.env.production`
   - `*.pem`, `*.key`, `*.p12`, `*.pfx`
   - `credentials.json`, `secrets/`, `*.secret`
   - `node_modules/` (sanity check)
   Report any missing recommended rules.

4. **Staged file audit** — Flag any files in staging that shouldn't be committed:
   - `.env` files (any variant)
   - Key/certificate files (`*.pem`, `*.key`)
   - Data exports, database dumps (`*.sql`, `*.dump`)
   - Backup files (`*.bak`, `*.backup`)
   - IDE credential stores

5. **Environment variable audit** — Check that `process.env.*` values are only accessed in server-side code:
   - Server-side OK: files in `src/app/api/`, `src/lib/`, `next.config.*`
   - Client-side PROBLEM: files in `src/components/`, `src/hooks/`, client-marked files
   - Exception: `NEXT_PUBLIC_*` variables are safe on client side

6. **Git history check** — Run `git log --all --diff-filter=A --name-only -- "*.env" "*.pem" "*.key" "credentials.json"` to check if sensitive files were ever committed previously.

## Output Format

### CRITICAL FINDINGS
Exposed secrets or credentials that MUST be resolved before pushing. Include file path, line number, and what was found.

### WARNINGS
Potential issues that should be reviewed:
- Missing gitignore rules
- Client-side environment variable access
- Suspicious patterns that may or may not be actual secrets

### GITIGNORE STATUS
List of recommended rules and whether each is present (✓) or missing (✗).

### Verdict

End with one of:
- **CLEAN** — No secrets detected, gitignore is healthy
- **WARNINGS** — No secrets found but some recommendations to address
- **SECRETS DETECTED — DO NOT PUSH** — Active secrets or credentials found in code

## Rules

- ALWAYS read the full content of every changed file, not just the diff
- ALWAYS scan the full repo for secret patterns, not just changed files
- Be precise — flag real secrets, not false positives like example placeholders or type definitions
- If a secret is found, recommend the remediation (remove from code, add to .env, rotate the key)
- NEVER display the actual secret value in the output — redact it (e.g., `sk-ant-...XXXX`)
