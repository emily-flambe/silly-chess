---
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - WebFetch
  - mcp__linear__get_issue
---

# Fix GitHub Issue

Fix the GitHub issue specified by number.

## Arguments

- `$ARGUMENTS` - GitHub issue number (e.g., `42`)

## Steps

1. Fetch the issue details:
   ```bash
   gh issue view $ARGUMENTS --repo emily-flambe/silly-chess
   ```

2. Analyze the issue description and any linked code references

3. Investigate the codebase to understand the affected areas

4. Implement the fix following existing code patterns

5. Run verification:
   ```bash
   npm run typecheck
   npx playwright test
   ```

6. Summarize changes and ask if user wants to commit
