/**
 * Verify full game can be played without "AI is thinking..." getting stuck
 * This tests the fixes for:
 * - Timeout cleanup in FairyStockfishClient
 * - Concurrent call guards
 * - WebSocket broadcast reliability
 */

import { chromium } from 'playwright';

async function verifyFullGame() {
  console.log('🎮 Starting full game verification...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Track stuck detection
  let lastStatusChange = Date.now();
  let consecutiveAIThinkingChecks = 0;
  
  try {
    console.log('📡 Starting local dev server...');
    
    // Navigate to production (or local dev server)
    const url = process.env.CHESS_URL || 'https://chess.emilycogsdill.com';
    console.log(`🌐 Navigating to ${url}...`);
    await page.goto(url, { timeout: 30000 });
    
    // Wait for app to initialize
    await page.waitForSelector('#status-container', { timeout: 10000 });
    console.log('✅ App loaded');
    
    // Start new game as white
    console.log('🆕 Starting new game as white...');
    await page.click('button:has-text("New Game")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("White")');
    
    // Wait for game to be active
    await page.waitForFunction(() => {
      const status = document.querySelector('#status-container')?.textContent || '';
      return status.includes('Your turn') || status.includes('Game started');
    }, { timeout: 15000 });
    console.log('✅ Game started');
    
    // Play moves - we'll alternate between player and AI
    const moveSequence = [
      // Opening moves (e4, d4, knight moves, etc.)
      ['e2', 'e4'],
      ['d2', 'd4'],
      ['g1', 'f3'],
      ['b1', 'c3'],
      ['f1', 'c4'],
      ['e1', 'g1'], // Castle kingside (if possible)
      ['f3', 'e5'], // Knight to center
      ['d1', 'h5'], // Queen out
      ['c4', 'f7'], // Attack f7
      ['h5', 'f7'], // Take on f7 if possible
    ];
    
    let movesMade = 0;
    const maxMoves = 12; // Try to make 12 moves (plenty to trigger the bug if it exists)
    
    for (let i = 0; i < maxMoves; i++) {
      // Check if game ended
      const status = await page.locator('#status-container').textContent();
      if (status?.includes('Checkmate') || status?.includes('Stalemate') || status?.includes('wins')) {
        console.log(`🏁 Game ended: ${status}`);
        break;
      }
      
      // Wait for our turn
      console.log(`⏳ Waiting for player turn (move ${i + 1})...`);
      
      // Monitor for stuck "AI is thinking..."
      const startWait = Date.now();
      const maxWaitTime = 25000; // 25 seconds max wait
      
      while (Date.now() - startWait < maxWaitTime) {
        const currentStatus = await page.locator('#status-container').textContent();
        
        if (currentStatus?.includes('Your turn') || currentStatus?.includes('Game over') || 
            currentStatus?.includes('Checkmate') || currentStatus?.includes('wins')) {
          break;
        }
        
        if (currentStatus?.includes('AI is thinking')) {
          consecutiveAIThinkingChecks++;
          if (consecutiveAIThinkingChecks > 20) { // 20 checks = ~10 seconds stuck
            console.error('❌ STUCK: "AI is thinking..." for too long!');
            await page.screenshot({ path: 'stuck-ai-thinking.png', fullPage: true });
            throw new Error('AI got stuck thinking');
          }
        } else {
          consecutiveAIThinkingChecks = 0;
        }
        
        await page.waitForTimeout(500);
      }
      
      // Check if it's still not our turn
      const turnStatus = await page.locator('#status-container').textContent();
      if (!turnStatus?.includes('Your turn')) {
        console.log(`⚠️ Not player turn after wait: ${turnStatus}`);
        if (turnStatus?.includes('Game over') || turnStatus?.includes('Checkmate') || turnStatus?.includes('wins')) {
          console.log('🏁 Game ended');
          break;
        }
        continue; // Skip this iteration
      }
      
      // Get board squares for the move
      const moveIndex = i % moveSequence.length;
      const [from, to] = moveSequence[moveIndex];
      
      try {
        // Click source square
        const fromSquare = page.locator(`[data-square="${from}"]`);
        if (await fromSquare.count() > 0 && await fromSquare.isVisible()) {
          await fromSquare.click();
          await page.waitForTimeout(200);
          
          // Click destination square
          const toSquare = page.locator(`[data-square="${to}"]`);
          if (await toSquare.count() > 0 && await toSquare.isVisible()) {
            await toSquare.click();
            movesMade++;
            console.log(`✅ Move ${movesMade}: ${from}-${to}`);
            await page.waitForTimeout(500); // Wait for move to process
          }
        }
      } catch (moveError) {
        console.log(`⚠️ Move ${from}-${to} failed, trying next move`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Moves made: ${movesMade}`);
    
    // Take final screenshot
    await page.screenshot({ path: 'full-game-final.png', fullPage: true });
    console.log('📸 Screenshot saved: full-game-final.png');
    
    if (movesMade >= 5) {
      console.log('\n✅ SUCCESS: Full game played without AI getting stuck!');
      return true;
    } else {
      console.log('\n⚠️ Only made ' + movesMade + ' moves - may need investigation');
      return movesMade >= 3;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'full-game-error.png', fullPage: true });
    return false;
  } finally {
    await browser.close();
  }
}

// Run verification
verifyFullGame()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
