# Component API Reference

Quick reference for GameControls and DifficultySlider components.

---

## DifficultySlider

### Constructor
```typescript
new DifficultySlider(container: HTMLElement)
```

### Methods

#### `getElo(): number`
Returns the current Elo rating (800-3000).

```typescript
const currentElo = slider.getElo();
// Returns: 1500
```

#### `setElo(elo: number): void`
Sets the Elo rating programmatically. Value is clamped to 800-3000 range.

```typescript
slider.setElo(1800);
// Updates slider, display, and saves to localStorage
```

#### `onChange(callback: (elo: number) => void): void`
Registers a callback to be called when Elo changes.

```typescript
slider.onChange((elo) => {
  console.log('New Elo:', elo);
  stockfish.setElo(elo);
});
```

### Types

```typescript
interface DifficultyPreset {
  label: string;  // "Beginner", "Casual", etc.
  elo: number;    // 800, 1200, etc.
}
```

### Constants

```typescript
MIN_ELO = 800
MAX_ELO = 3000
DEFAULT_ELO = 1500

PRESETS = [
  { label: 'Beginner', elo: 800 },
  { label: 'Casual', elo: 1200 },
  { label: 'Club', elo: 1500 },
  { label: 'Advanced', elo: 1800 },
  { label: 'Expert', elo: 2200 },
]
```

### localStorage

- **Key:** `silly-chess-elo`
- **Type:** `string` (number as string)
- **Range:** "800" to "3000"

---

## GameControls

### Constructor
```typescript
new GameControls(container: HTMLElement)
```

### Callback Registration

#### `onNewGame(callback: (color: PlayerColor) => void): void`
Registers callback for new game events. Called with player's chosen color.

```typescript
controls.onNewGame((color) => {
  console.log('Starting new game as:', color);
  // color is 'white' or 'black'
});
```

#### `onResign(callback: () => void): void`
Registers callback for resignation. Called after user confirms resignation.

```typescript
controls.onResign(() => {
  console.log('Player resigned');
  endGame('resignation');
});
```

#### `onUndo(callback: () => void): void`
Registers callback for undo actions. Called when undo button is clicked (if enabled).

```typescript
controls.onUndo(() => {
  console.log('Undo requested');
  undoLastMovePair();
});
```

### State Management

#### `setGameActive(active: boolean): void`
Sets whether a game is currently active. Controls resign button enabled state.

```typescript
controls.setGameActive(true);  // Enable resign button
controls.setGameActive(false); // Disable resign button
```

#### `setCanUndo(canUndo: boolean): void`
Sets whether undo is available. Controls undo button enabled state.

```typescript
controls.setCanUndo(true);  // Enable undo button
controls.setCanUndo(false); // Disable undo button
```

### Access Methods

#### `getDifficultySlider(): DifficultySlider | null`
Returns the DifficultySlider instance from the settings panel.

```typescript
const slider = controls.getDifficultySlider();
if (slider) {
  const elo = slider.getElo();
  slider.onChange((newElo) => {
    // Handle Elo change
  });
}
```

#### `getPreferences(): { showCoordinates: boolean; soundEnabled: boolean }`
Returns current user preferences.

```typescript
const prefs = controls.getPreferences();
console.log('Show coords:', prefs.showCoordinates);
console.log('Sound:', prefs.soundEnabled);
```

### Types

```typescript
type PlayerColor = 'white' | 'black';
```

### localStorage

- **`silly-chess-show-coords`**
  - Type: `string` ("true" or "false")
  - Default: "true"

- **`silly-chess-sound`**
  - Type: `string` ("true" or "false")
  - Default: "true"

---

## Usage Example

```typescript
import { GameControls } from './components/GameControls';
import { StockfishWorker } from '../lib/stockfish/StockfishWorker';

// Initialize controls
const container = document.getElementById('game-controls');
const controls = new GameControls(container);

// Initialize Stockfish
const stockfish = new StockfishWorker();
await stockfish.initialize();

// Get difficulty slider and sync with Stockfish
const slider = controls.getDifficultySlider();
if (slider) {
  await stockfish.setElo(slider.getElo());
  slider.onChange(async (elo) => {
    await stockfish.setElo(elo);
  });
}

// Register callbacks
controls.onNewGame(async (color) => {
  chess.reset();
  playerColor = color;
  controls.setGameActive(true);
  controls.setCanUndo(false);

  if (color === 'black') {
    await makeAIMove();
  }
});

controls.onResign(() => {
  chess.gameOver();
  controls.setGameActive(false);
  controls.setCanUndo(false);
});

controls.onUndo(() => {
  chess.undo(); // AI move
  chess.undo(); // Player move
  updateBoard();
  controls.setCanUndo(chess.history().length >= 2);
});

// Update undo state after each move
function updateUndoState() {
  const canUndo = chess.history().length >= 2;
  controls.setCanUndo(canUndo);
}
```

---

## Event Flow

### New Game Flow
```
User clicks "New Game"
  ↓
Modal opens
  ↓
User selects color (White/Black/Random)
  ↓
onNewGame callback fires with color
  ↓
Modal closes
```

### Resign Flow
```
User clicks "Resign" (if game active)
  ↓
Confirmation dialog
  ↓
If confirmed:
  ↓
onResign callback fires
```

### Undo Flow
```
User clicks "Undo" (if can undo)
  ↓
onUndo callback fires
  ↓
Game logic undoes moves
  ↓
setCanUndo updates button state
```

### Settings Flow
```
User clicks "Settings"
  ↓
Settings panel opens
  ↓
User changes Elo slider
  ↓
onChange callback fires
  ↓
Value saved to localStorage
  ↓
User toggles preferences
  ↓
Saved to localStorage
  ↓
User clicks X or overlay to close
```

---

## Component States

### DifficultySlider States
- **Elo Value:** 800-3000 (default: 1500)
- **Active Preset:** One of 5 presets or none (custom value)

### GameControls States
- **Game Active:** `boolean` (default: `false`)
  - `true`: Resign button enabled
  - `false`: Resign button disabled

- **Can Undo:** `boolean` (default: `false`)
  - `true`: Undo button enabled
  - `false`: Undo button disabled

- **Show Coordinates:** `boolean` (default: `true`)
  - Persisted in localStorage

- **Sound Enabled:** `boolean` (default: `true`)
  - Persisted in localStorage

---

## Styling

### Custom Styling

Components inject their own styles automatically. To override:

```css
/* Override button colors */
.control-btn {
  background: your-color !important;
}

/* Override slider thumb color */
.elo-slider::-webkit-slider-thumb {
  background: your-color !important;
}

/* Override modal background */
.modal-content {
  background: your-color !important;
}
```

### CSS Variables (Future Enhancement)

For easier theming, consider using CSS custom properties:

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --btn-primary: #4a4e69;
  --btn-hover: #5c6078;
  --accent: #829769;
  --text: #eee;
}
```
