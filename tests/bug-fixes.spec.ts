import { test, expect } from '@playwright/test';

/**
 * Bug fix tests - these should all FAIL initially and PASS after fixes
 */

test.describe('Bug Fixes', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board-container')).toBeVisible();
    await expect(page.locator('#status-container')).toContainText('Ready', { timeout: 30000 });
  });

  test('BUG-001: Undo should actually undo moves', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    
    // Verify pawn is on e4
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(1);
    await expect(page.locator('[data-square="e2"] .piece')).toHaveCount(0);

    // Wait for AI to move
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

    // Remember where black moved (check common responses)
    const blackMovedE5 = await page.locator('[data-square="e5"] .piece.piece-black').count() > 0;
    const blackMovedE6 = await page.locator('[data-square="e6"] .piece.piece-black').count() > 0;
    const blackMovedD5 = await page.locator('[data-square="d5"] .piece.piece-black').count() > 0;
    const blackMovedC5 = await page.locator('[data-square="c5"] .piece.piece-black').count() > 0;
    
    // At least one of these should be true
    expect(blackMovedE5 || blackMovedE6 || blackMovedD5 || blackMovedC5).toBe(true);

    // Click Undo
    await page.getByRole('button', { name: /undo/i }).click();
    
    // After undo, we should be back to starting position:
    // - e2 should have white pawn again
    // - e4 should be empty
    // - Black's move should be undone (e7 should have pawn back)
    await expect(page.locator('[data-square="e2"] .piece.piece-white')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(0);
    await expect(page.locator('[data-square="e7"] .piece.piece-black')).toHaveCount(1);
  });

  test('BUG-002: Resign should end the game', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make a move first so resign is meaningful
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

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
    
    // Wait for hint to appear (squares get hint class)
    await expect(page.locator('.hint-from, .hint-to, [class*="hint"]')).toHaveCount(2, { timeout: 5000 });

    // Start a new game
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started/i, { timeout: 5000 });

    // Hint highlights should be cleared
    const hintSquares = await page.locator('.hint-from, .hint-to, [class*="hint"]').count();
    expect(hintSquares).toBe(0);
  });

  test('BUG-004: Eval bar should show ~0 at game start', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Wait a moment for eval to update
    await page.waitForTimeout(2000);

    // Get the eval text
    const evalText = await page.locator('#eval-bar-container').textContent();
    
    // Parse the eval value - should be between -0.3 and +0.3 for starting position
    const evalMatch = evalText?.match(/([+-]?\d+\.?\d*)/);
    expect(evalMatch).toBeTruthy();
    
    const evalValue = parseFloat(evalMatch![1]);
    expect(evalValue).toBeGreaterThanOrEqual(-0.3);
    expect(evalValue).toBeLessThanOrEqual(0.3);
  });

  test('BUG-005: Board should update visually after Undo', async ({ page }) => {
    // Start game as white
    await page.getByRole('button', { name: /new game/i }).click();
    await page.locator('.color-btn[data-color="white"]').click();
    await expect(page.locator('#status-container')).toContainText(/Game started|Your turn/i, { timeout: 5000 });

    // Make move d2-d4
    await page.locator('[data-square="d2"]').click();
    await page.locator('[data-square="d4"]').click();
    
    // Verify move was made
    await expect(page.locator('[data-square="d4"] .piece.piece-white')).toHaveCount(1);
    await expect(page.locator('[data-square="d2"] .piece')).toHaveCount(0);

    // Wait for AI
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

    // Make another move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"] .piece.piece-white')).toHaveCount(1);

    // Wait for AI
    await expect(page.locator('#status-container')).toContainText('Your turn', { timeout: 30000 });

    // Click Undo - should undo BOTH last white move AND AI's response
    await page.getByRole('button', { name: /undo/i }).click();

    // After undo: e2 should have pawn, e4 should be empty, d4 still has pawn
    await expect(page.locator('[data-square="e2"] .piece.piece-white')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('[data-square="e4"] .piece')).toHaveCount(0);
    await expect(page.locator('[data-square="d4"] .piece.piece-white')).toHaveCount(1);
  });

});
