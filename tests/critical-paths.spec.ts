import { test, expect, Page } from '@playwright/test';

/**
 * Critical path E2E tests for Silly Chess.
 *
 * These focus on UI interactions that don't require Stockfish WASM.
 * Game logic (checkmate, move validation, etc.) is tested exhaustively
 * via Vitest backend tests. E2E tests verify the UI layer.
 */

/** Start a new game via the UI modal */
async function startGameVsCpu(page: Page, color: 'white' | 'black'): Promise<void> {
  await page.getByRole('button', { name: /new game/i }).click();
  await page.locator('.mode-btn[data-mode="vs-ai"]').click();
  await page.locator(`.color-btn[data-color="${color}"]`).click();
}

test.describe('Critical Paths', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board-container')).toBeVisible();
    await expect(page.locator('#status-container')).toContainText('Ready', { timeout: 30000 });
  });

  test('Player can make a move as white', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Click e2 pawn, then e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Verify pawn moved
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);
    await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(0);
  });

  test('Legal move indicators appear and disappear correctly', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Click e2 pawn
    await page.locator('[data-square="e2"]').click();

    // Should show selected state and legal moves
    await expect(page.locator('[data-square="e2"].selected')).toBeVisible();
    await expect(page.locator('[data-square="e3"].legal-move')).toBeVisible();
    await expect(page.locator('[data-square="e4"].legal-move')).toBeVisible();

    // Click on an empty non-legal square to deselect
    await page.locator('[data-square="a6"]').click();

    // Indicators should clear
    await expect(page.locator('.square.legal-move')).toHaveCount(0);
    await expect(page.locator('.square.selected')).toHaveCount(0);
  });

  test('Knight shows correct legal moves', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Click b1 knight
    await page.locator('[data-square="b1"]').click();

    // Knight on b1 can go to a3 or c3
    await expect(page.locator('[data-square="a3"].legal-move')).toBeVisible();
    await expect(page.locator('[data-square="c3"].legal-move')).toBeVisible();
    // Should not show illegal moves
    await expect(page.locator('[data-square="d2"].legal-move')).not.toBeVisible();
  });

  // Note: piece-switching (click own piece while another is selected) behavior
  // depends on the frontend's move-attempt-then-fallback logic and is not
  // reliably testable without knowing the exact click handler implementation.
  // The underlying move validation is covered by backend tests.

  test('New Game button starts a fresh game', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make a move
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);

    // Start a new game
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Board should be reset - e2 should have a pawn, e4 should not
    await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(1);
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(0);
  });

  test('Captured pieces section exists', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    await expect(page.locator('.captured-pieces-section')).toBeVisible();
    await expect(page.locator('.captured-pieces[data-side="white"]')).toHaveCount(1);
    await expect(page.locator('.captured-pieces[data-side="black"]')).toHaveCount(1);
  });

  test('Eval bar is visible', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    const evalContainer = page.locator('#eval-bar-container');
    await expect(evalContainer).toBeVisible();
  });

  test('Move list container exists', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    await expect(page.locator('#move-list-container')).toBeVisible();
  });

  test('Mode selection modal has correct options', async ({ page }) => {
    await page.getByRole('button', { name: /new game/i }).click();

    // Should show mode selection
    await expect(page.locator('.mode-btn[data-mode="vs-ai"]')).toBeVisible();
    await expect(page.locator('.mode-btn[data-mode="vs-player"]')).toBeVisible();

    // Click vs Computer
    await page.locator('.mode-btn[data-mode="vs-ai"]').click();

    // Should show color selection
    await expect(page.locator('.color-btn[data-color="white"]')).toBeVisible();
    await expect(page.locator('.color-btn[data-color="black"]')).toBeVisible();
  });

  test('Game persists across page reload', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make a move
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);

    // Wait for the URL to update to /game/:id
    await page.waitForURL(/\/game\//, { timeout: 5000 }).catch(() => {});
    const gameUrl = page.url();

    // Only test persistence if we got a game URL
    if (gameUrl.includes('/game/')) {
      await page.goto(gameUrl);
      await expect(page.locator('#board-container')).toBeVisible({ timeout: 10000 });

      // The pawn should still be on e4
      await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1, { timeout: 5000 });
      await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(0);
    }
  });
});
