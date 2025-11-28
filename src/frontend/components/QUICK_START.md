# Quick Start Guide

Get started with the GameControls and DifficultySlider components in 5 minutes.

---

## 1. Basic Usage

### HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Chess Game</title>
</head>
<body>
  <div id="game-controls"></div>

  <script type="module" src="./main.js"></script>
</body>
</html>
```

### JavaScript/TypeScript
```typescript
import { GameControls } from './components/GameControls';

// Initialize
const container = document.getElementById('game-controls');
const controls = new GameControls(container);

// Handle events
controls.onNewGame((color) => {
  console.log('New game as:', color);
});

controls.onResign(() => {
  console.log('Player resigned');
});

controls.onUndo(() => {
  console.log('Undo last moves');
});

// Update state
controls.setGameActive(true);
controls.setCanUndo(true);
```

That's it! The component is fully functional.

---

## 2. With Stockfish Integration

```typescript
import { GameControls } from './components/GameControls';
import { StockfishWorker } from '../lib/stockfish/StockfishWorker';

// Initialize components
const controls = new GameControls(document.getElementById('game-controls'));
const stockfish = new StockfishWorker();

// Initialize Stockfish
await stockfish.initialize();

// Sync difficulty slider with Stockfish
const slider = controls.getDifficultySlider();
if (slider) {
  await stockfish.setElo(slider.getElo());
  slider.onChange((elo) => stockfish.setElo(elo));
}
```

---

## 3. Complete Chess Game

See `/Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components/integration-example.ts`

This file contains a complete working example showing:
- New game handling
- Player move validation
- AI move generation
- Undo functionality
- Game end detection
- Resignation handling

---

## 4. Testing the Demo

```bash
# Navigate to the components directory
cd /Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components

# Open the demo in a browser
open demo.html
# or
firefox demo.html
# or
google-chrome demo.html
```

The demo shows:
- Live component interaction
- Event logging
- State display
- All features working

---

## 5. Component APIs at a Glance

### GameControls

```typescript
// Create
const controls = new GameControls(container);

// Callbacks
controls.onNewGame((color: 'white' | 'black') => { });
controls.onResign(() => { });
controls.onUndo(() => { });

// State
controls.setGameActive(true);
controls.setCanUndo(true);

// Access
const slider = controls.getDifficultySlider();
const prefs = controls.getPreferences();
```

### DifficultySlider

```typescript
// Create
const slider = new DifficultySlider(container);

// Get/Set
const elo = slider.getElo();
slider.setElo(1800);

// Listen
slider.onChange((elo) => { });
```

---

## 6. localStorage Keys

The components automatically persist preferences:

```javascript
// Check stored values
localStorage.getItem('silly-chess-elo');          // "1500"
localStorage.getItem('silly-chess-show-coords');  // "true"
localStorage.getItem('silly-chess-sound');        // "true"

// Clear all preferences
localStorage.removeItem('silly-chess-elo');
localStorage.removeItem('silly-chess-show-coords');
localStorage.removeItem('silly-chess-sound');
```

---

## 7. Customization

### Override Colors

```css
/* Add to your CSS file */
.control-btn {
  background: #your-color !important;
}

.new-game-btn {
  background: #your-accent-color !important;
}

.elo-slider::-webkit-slider-thumb {
  background: #your-accent-color !important;
}
```

### Disable Auto-Styling

Components inject their own styles. To disable:

```typescript
// Remove the style tag before initializing
document.querySelector('style[data-component="game-controls"]')?.remove();
document.querySelector('style[data-component="difficulty-slider"]')?.remove();

// Then initialize components
const controls = new GameControls(container);
```

---

## 8. Common Patterns

### Pattern 1: Enable Undo After Moves
```typescript
let moveCount = 0;

function makeMove() {
  moveCount++;
  controls.setCanUndo(moveCount >= 2);
}
```

### Pattern 2: Auto-Start on Load
```typescript
window.addEventListener('load', () => {
  if (localStorage.getItem('auto-start') === 'true') {
    // Auto-start a new game
    startNewGame('white');
    controls.setGameActive(true);
  }
});
```

### Pattern 3: Sync Preferences with Board
```typescript
const prefs = controls.getPreferences();

if (prefs.showCoordinates) {
  board.showCoordinates();
} else {
  board.hideCoordinates();
}

// Listen for changes (when settings panel closes)
setInterval(() => {
  const newPrefs = controls.getPreferences();
  if (newPrefs.showCoordinates !== prefs.showCoordinates) {
    board.toggleCoordinates();
  }
}, 1000);
```

---

## 9. Troubleshooting

### Issue: Styles not applying
**Solution:** Check that style tag is injected in `<head>`:
```javascript
console.log(document.querySelector('style[data-component="game-controls"]'));
```

### Issue: Callbacks not firing
**Solution:** Register callbacks before user interaction:
```typescript
// Wrong: Registered after user clicks
controls.onNewGame(...);  // May be too late

// Right: Registered immediately after creation
const controls = new GameControls(container);
controls.onNewGame(...);  // Ready before first click
```

### Issue: localStorage not persisting
**Solution:** Check browser settings and privacy mode:
```javascript
try {
  localStorage.setItem('test', 'value');
  console.log('localStorage works');
} catch (e) {
  console.error('localStorage blocked:', e);
}
```

---

## 10. Next Steps

1. Read `/Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components/API_REFERENCE.md` for complete API
2. Check `/Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components/UI_LAYOUT.md` for styling details
3. Study `/Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components/integration-example.ts` for full integration
4. Review `/Users/emilycogsdill/Documents/GitHub/silly-chess/src/frontend/components/README.md` for comprehensive docs

---

## File Locations

```
src/frontend/components/
├── DifficultySlider.ts          (Component)
├── GameControls.ts              (Component)
├── integration-example.ts       (Full example)
├── demo.html                    (Interactive demo)
├── README.md                    (Full documentation)
├── API_REFERENCE.md             (Quick API reference)
├── UI_LAYOUT.md                 (Visual guide)
├── IMPLEMENTATION_SUMMARY.md    (Implementation details)
└── QUICK_START.md               (This file)
```

---

## Support

For issues or questions:
1. Check the documentation files listed above
2. Review the demo.html for working examples
3. Inspect browser console for errors
4. Verify TypeScript/JavaScript module support

---

Happy coding!
