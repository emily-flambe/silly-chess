---
allowed-tools:
  - Bash
---

# Run Tests

Run the Playwright e2e test suite.

## Arguments

- `$ARGUMENTS` - (Optional) Specific test file or pattern to run

## Steps

1. Run tests:
   ```bash
   # If argument provided, run specific test
   # Otherwise run all tests
   npx playwright test $ARGUMENTS
   ```

2. If tests fail:
   - Show the failure details
   - Suggest potential fixes based on the error messages

3. If tests pass:
   - Report success
   - Show test duration
