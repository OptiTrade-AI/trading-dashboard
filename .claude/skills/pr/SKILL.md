---
name: pr
description: Create a feature branch, commit all changes, push, and open a pull request to main
---

# Create Pull Request

Commit all pending changes to a feature branch and open a PR to main.

## Steps

1. **Check for changes**: Run `git status` and `git diff --stat`. If no changes exist, inform the user and stop.

2. **Determine branch name**: If the user provided an argument, use it as the branch name (prefixed with `feat/`, `fix/`, or `chore/` as appropriate). Otherwise, analyze the changes and generate a short descriptive kebab-case branch name.

3. **Create and switch to feature branch**: Run `git checkout -b <branch-name>` from main. If already on a feature branch, use it.

4. **Stage files**: Stage all modified/new files individually by name. NEVER use `git add -A` or `git add .`. Do NOT stage `.env`, credentials, or secret files.

5. **Commit**: Analyze the staged changes and write a descriptive commit message (1-2 sentence summary of the "why"). Use a HEREDOC. Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

6. **Push**: Run `git push -u origin <branch-name>`.

7. **Create PR**: Use `gh` CLI (located at `/c/Program Files/GitHub CLI/gh.exe` on this machine). Format:
   ```
   gh pr create --title "<short title>" --body "<markdown body>"
   ```
   PR body must include:
   - `## Summary` — 1-3 bullet points describing what changed
   - `## Test plan` — Checklist of verification steps
   - Footer: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

8. **Return the PR URL** to the user.

## Safety Rules

- NEVER commit `.env`, credentials, API keys, or secret files
- NEVER force push
- NEVER push directly to main — always use a feature branch
- ALWAYS create a NEW commit (never amend)
- If pre-commit hooks fail, fix the issue and retry with a new commit
