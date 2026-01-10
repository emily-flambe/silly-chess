---
allowed-tools:
  - Bash
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_snapshot
  - mcp__plugin_playwright_playwright__browser_take_screenshot
  - mcp__plugin_playwright_playwright__browser_click
  - mcp__plugin_playwright_playwright__browser_wait_for
  - mcp__plugin_playwright_playwright__browser_console_messages
---

# Verify UI

Launch the app and visually verify UI functionality using Playwright.

## Steps

1. Start dev server if not running:
   ```bash
   # Check if server is running
   curl -s http://localhost:8787/api/health || npm run dev &
   ```

2. Navigate to the app:
   - Open http://localhost:8787
   - Take a screenshot

3. Wait for engine to load:
   - Wait for "Ready" status text

4. Test basic functionality:
   - Click "New Game"
   - Select White
   - Make a move (e2 to e4)
   - Wait for AI response

5. Check for console errors

6. Take final screenshot and report findings
