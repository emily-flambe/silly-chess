// Screenshot the start modal across all three themes.
// Usage: node scripts/screenshot-modal.mjs <baseUrl> <outPrefix>
// e.g.: node scripts/screenshot-modal.mjs https://chess.emilycogsdill.com before
//       node scripts/screenshot-modal.mjs http://localhost:8787     after
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'https://chess.emilycogsdill.com';
const outPrefix = process.argv[3] || 'shot';

const themes = ['classic', 'minimal', 'dark'];
const labels = { classic: 'classic', minimal: 'minimal', dark: 'dusk' };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Surface console errors to make debugging easier.
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => {
  if (m.type() === 'error') console.error('console.error:', m.text());
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
// Give the JS a moment to hydrate controls (the "New Game" button is created by JS).
await page.waitForSelector('.new-game-btn', { timeout: 15000 });
await page.waitForTimeout(500);

// Make sure the start / new-game modal is visible. In the live app the modal
// is opened by clicking "New Game"; the modal DOM is rendered but initially
// hidden. We force it open by calling into the app directly or clicking.
for (const theme of themes) {
  // Switch theme by clicking the actual topbar button so ThemeManager
  // applies the class to BOTH <html> and #app-root — otherwise modals
  // (which live outside #app-root) don't pick up the theme vars.
  await page.evaluate((t) => {
    const btn = document.querySelector(`[data-theme="${t}"]`);
    if (btn) btn.click();
  }, theme);
  await page.waitForTimeout(150);

  // Open the New Game modal.
  await page.evaluate(() => {
    const btn = document.querySelector('.new-game-btn');
    if (btn) btn.click();
  });

  // Wait for the modal to be displayed.
  await page.waitForSelector('.game-modal', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);

  const outPath = `.screenshots/${outPrefix}-${labels[theme]}.png`;
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`wrote ${outPath}`);

  // Close the modal so the next screenshot is clean.
  await page.evaluate(() => {
    const cancel = document.querySelector('.cancel-btn');
    if (cancel) cancel.click();
  });
  await page.waitForTimeout(150);
}

await browser.close();
