import { test, expect } from '@playwright/test';

/**
 * Bug fix and feature tests for Silly Chess
 */

test.describe('Bug Fixes', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board-container')).toBeVisible();
    await expect(page.locator('#status-container')).toContainText('Ready', { timeout: 30000 });
  });

  test('BUG-002: Resign should end the game', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make a move first so resign is meaningful
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    // Wait for AI to finish (may take longer on CI)
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 60000 });

    // Click Resign
    await page.getByRole('button', { name: /resign/i }).click();

    // Status should indicate game over with black winning
    await expect(page.locator('#status-container')).toContainText(/resign|black wins|game over/i, { timeout: 5000 });

    // Resign and Undo buttons should be disabled after game ends
    await expect(page.getByRole('button', { name: /resign/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled();
  });

  test('BUG-003: Hint highlight should clear on New Game', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Click Hint to show a suggested move
    await page.getByRole('button', { name: /hint/i }).click();
    
    // Wait for hint to appear (squares get the 'hint' class)
    await expect(page.locator('.square.hint')).toHaveCount(2, { timeout: 5000 });

    // Start a new game
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    // Status could be "Game started" or already "Your turn" depending on timing
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Hint highlights should be cleared
    const hintSquares = await page.locator('.square.hint').count();
    expect(hintSquares).toBe(0);
  });

  test('BUG-004: Eval bar should show reasonable value at game start', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Wait a moment for eval to update
    await page.waitForTimeout(3000);

    // Get the eval text
    const evalText = await page.locator('#eval-bar-container').textContent();
    
    // Parse the eval value - should be between -1.0 and +1.0 for starting position
    // (Stockfish at different depths may show small variations)
    const evalMatch = evalText?.match(/([+-]?\d+\.?\d*)/);
    expect(evalMatch).toBeTruthy();
    
    const evalValue = parseFloat(evalMatch![1]);
    expect(evalValue).toBeGreaterThanOrEqual(-1.0);
    expect(evalValue).toBeLessThanOrEqual(1.0);
  });

});

test.describe('Move History Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board-container')).toBeVisible();
    await expect(page.locator('#status-container')).toContainText('Ready', { timeout: 30000 });
  });

  // TODO: Fix history navigation feature - currently fenHistory is empty on reconnect
  test.skip('Can view previous positions without undoing moves', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    
    // Verify pawn is on e4
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);

    // Wait for AI to move
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

    // Use left arrow key to go back in history
    await page.keyboard.press('ArrowLeft');
    
    // Status should indicate viewing history
    await expect(page.locator('#status-container')).toContainText(/viewing|move/i, { timeout: 2000 });

    // Use right arrow to return to current position
    await page.keyboard.press('ArrowRight');
    
    // Should be able to make another move
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 2000 });
  });

  // TODO: Fix move list click handler data attributes
  test.skip('Can click on moves in move list to view positions', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Wait for AI to move
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

    // Click on the first move in the move list
    await page.locator('[data-move-index="0"]').click();

    // Should show that we're viewing a historical position
    await expect(page.locator('#status-container')).toContainText(/viewing|move/i, { timeout: 2000 });
  });

});
