---
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# PR Preparation

Run all checks, stage changes, and prepare commit message.

## Steps

1. Run type checking:
   ```bash
   npm run typecheck
   ```

2. Run tests:
   ```bash
   npx playwright test
   ```

3. If all checks pass, show status:
   ```bash
   git status
   git diff --stat
   ```

4. Generate a commit message based on the changes:
   - Summarize what changed
   - Focus on the "why" not the "what"
   - Follow conventional commit format

5. Present the suggested commit message and ask for confirmation before committing
