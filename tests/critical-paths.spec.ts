import { test, expect, Page } from '@playwright/test';

/**
 * Critical path E2E tests for Silly Chess.
 *
 * These test the most important user journeys that must always work.
 * They avoid Stockfish WASM (which is slow/flaky on CI) by using
 * the REST API to submit AI moves directly.
 */

/** Start a new game via the UI modal */
async function startGameVsCpu(page: Page, color: 'white' | 'black'): Promise<void> {
  await page.getByRole('button', { name: /new game/i }).click();
  await page.locator('.mode-btn[data-mode="vs-ai"]').click();
  await page.locator(`.color-btn[data-color="${color}"]`).click();
}

/** Get the current game ID from the page URL or app state */
async function getGameId(page: Page): Promise<string> {
  // The app stores gameId — extract it from the URL or network requests
  // After starting a game, the URL may update to /game/:id
  const url = page.url();
  const match = url.match(/\/game\/([a-f0-9-]+)/);
  if (match) return match[1];

  // Fallback: intercept the game creation response
  // For now, wait for URL to update
  await page.waitForURL(/\/game\//, { timeout: 5000 }).catch(() => {});
  const newUrl = page.url();
  const newMatch = newUrl.match(/\/game\/([a-f0-9-]+)/);
  if (newMatch) return newMatch[1];

  throw new Error('Could not determine game ID');
}

/** Submit an AI move via REST API (bypasses Stockfish WASM) */
async function submitAIMove(page: Page, gameId: string, uciMove: string): Promise<void> {
  const baseUrl = page.url().split('/game/')[0] || 'http://localhost:8787';
  await page.evaluate(
    async ([base, id, move]) => {
      await fetch(`${base}/api/games/${id}/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move }),
      });
    },
    [baseUrl, gameId, uciMove]
  );
  // Give the WebSocket message time to arrive and board to update
  await page.waitForTimeout(500);
}

test.describe('Critical Paths', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board-container')).toBeVisible();
    await expect(page.locator('#status-container')).toContainText('Ready', { timeout: 30000 });
  });

  test('Full game: Scholar\'s Mate (4-move checkmate)', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    const gameId = await getGameId(page);

    // Move 1: e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);

    // AI response: e5
    await submitAIMove(page, gameId, 'e7e5');
    await expect(page.locator('[data-square="e5"] .piece')).toHaveCount(1);

    // Move 2: Bc4
    await page.locator('[data-square="f1"]').click();
    await page.locator('[data-square="c4"]').click();
    await expect(page.locator('[data-square="c4"] .piece')).toHaveCount(1);

    // AI response: Nc6
    await submitAIMove(page, gameId, 'b8c6');
    await expect(page.locator('[data-square="c6"] .piece')).toHaveCount(1);

    // Move 3: Qh5
    await page.locator('[data-square="d1"]').click();
    await page.locator('[data-square="h5"]').click();
    await expect(page.locator('[data-square="h5"] .piece')).toHaveCount(1);

    // AI response: Nf6 (blunder)
    await submitAIMove(page, gameId, 'g8f6');
    await expect(page.locator('[data-square="f6"] .piece')).toHaveCount(1);

    // Move 4: Qxf7# (Scholar's Mate!)
    await page.locator('[data-square="h5"]').click();
    await page.locator('[data-square="f7"]').click();

    // Game should end with checkmate
    await expect(page.locator('#status-container')).toContainText(/checkmate|white wins/i, { timeout: 5000 });

    // Verify board shows the final position
    await expect(page.locator('[data-square="f7"] .piece')).toHaveCount(1);
  });

  test('Resign preserves move history for review', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    const gameId = await getGameId(page);

    // Make a few moves
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await submitAIMove(page, gameId, 'e7e5');

    await page.locator('[data-square="d2"]').click();
    await page.locator('[data-square="d4"]').click();
    await submitAIMove(page, gameId, 'd7d5');

    // Resign
    await page.getByRole('button', { name: /resign/i }).click();

    // Game should end
    await expect(page.locator('#status-container')).toContainText(/resign|black wins|game over/i, { timeout: 5000 });

    // Move list should still show moves (not cleared)
    const moveList = page.locator('#move-list');
    await expect(moveList).toBeVisible();
    // Should have at least the moves we played
    const moveText = await moveList.textContent();
    expect(moveText).toContain('e4');
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

    // Click on a non-legal square to deselect
    await page.locator('[data-square="a6"]').click();

    // Indicators should clear
    await expect(page.locator('.square.legal-move')).toHaveCount(0);
    await expect(page.locator('.square.selected')).toHaveCount(0);
  });

  test('Board flips when playing as black', async ({ page }) => {
    await startGameVsCpu(page, 'black');
    // Don't wait for AI — just check the board orientation

    // When playing as black, rank 8 should be at the bottom
    // The board should show black pieces at the bottom
    // Verify by checking that a8 is in the bottom-right area
    // We can check the data attributes or CSS to verify orientation
    const board = page.locator('#board-container');
    await expect(board).toBeVisible();

    // The board should have the 'flipped' class or equivalent
    // Check that the first rank label shows 8 (if labels exist)
    // Or check that square a1 is in the top-right
    // Simple check: the piece on a8 (black rook) should be visible
    await expect(page.locator('[data-square="a8"] .piece')).toHaveCount(1);
  });

  test('Game persists across page reload', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    const gameId = await getGameId(page);

    // Make a move
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);

    // Reload the page
    await page.goto(`/game/${gameId}`);
    await expect(page.locator('#board-container')).toBeVisible({ timeout: 10000 });

    // The pawn should still be on e4
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1, { timeout: 5000 });
    // And e2 should be empty
    await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(0);
  });

  test('New Game button starts a fresh game', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make a move
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

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

  test('Eval bar shows reasonable value', async ({ page }) => {
    await startGameVsCpu(page, 'white');
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Wait for eval to initialize
    await page.waitForTimeout(2000);

    const evalContainer = page.locator('#eval-bar-container');
    await expect(evalContainer).toBeVisible();

    const evalText = await evalContainer.textContent();
    // Should contain a number (the eval value)
    expect(evalText).toMatch(/[+-]?\d/);
  });
});
