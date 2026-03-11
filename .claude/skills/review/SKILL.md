---
name: review
description: Security and quality code review of all pending changes before pushing to GitHub
---

# Code Review

Review all uncommitted or unpushed changes for security vulnerabilities, code quality, and correctness before pushing.

## Process

1. **Gather changes**: Run `git diff` (unstaged), `git diff --cached` (staged), and `git log origin/main..HEAD --oneline` (unpushed commits). Read every changed file in full.

2. **Security Review** (Critical — blocks push if found):
   - Exposed secrets, API keys, tokens, or credentials in code or logs
   - SQL injection, NoSQL injection, or command injection
   - XSS vulnerabilities (unsanitized user input rendered in HTML)
   - SSRF or open redirect vulnerabilities
   - Insecure use of `eval()`, `dangerouslySetInnerHTML`, or `exec()`
   - Hardcoded passwords or connection strings
   - Missing input validation on API routes (query params, body parsing)
   - Files that should be gitignored (`.env`, `*.pem`, `credentials.json`)

3. **Correctness Review**:
   - Type errors or missing null checks
   - Broken imports or undefined references
   - Race conditions in async code
   - Off-by-one errors, wrong operator (`??` vs `||`), or logic bugs
   - API response shape mismatches between route and consumer

4. **Quality Review**:
   - Unused imports or dead code
   - Inconsistent patterns vs existing codebase conventions
   - Missing error handling on fetch/API calls
   - Performance issues (unnecessary re-renders, missing deps in hooks)

5. **Build verification**: Run `npx tsc --noEmit` to check for type errors.

## Output Format

Provide a structured report:

### Security Issues
List each issue with severity (CRITICAL / HIGH / MEDIUM), file:line, description, and fix recommendation.

### Code Issues
List each issue with severity (HIGH / MEDIUM / LOW), file:line, description, and fix recommendation.

### Verdict

End with one of:
- **SAFE TO PUSH** — No security issues, code is clean
- **NEEDS FIXES** — List blocking issues that must be resolved before pushing
- **DO NOT PUSH** — Critical security vulnerabilities found

## Rules

- ALWAYS read the full content of every changed file, not just the diff
- ALWAYS run the TypeScript type check
- NEVER skip the security review
- Be thorough but concise — only flag real issues, not style preferences
