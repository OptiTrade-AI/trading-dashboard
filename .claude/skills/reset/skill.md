---
name: reset
description: Switch back to main and pull latest — run after /pr to prep for the next feature
---

# Reset to Main

Switch back to main and pull latest changes so the workspace is ready for the next feature.

## Steps

1. **Check current branch**: Run `git branch --show-current`. If already on main, just pull.

2. **Switch to main**: Run `git checkout main`.

3. **Pull latest**: Run `git pull` to get the latest changes (including any merged PRs).

4. **Confirm**: Show the user the current branch and latest commit to confirm they're ready to go.
