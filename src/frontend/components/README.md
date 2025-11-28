# Game Controls Components

Frontend UI components for Silly Chess game controls and settings.

## Components

### DifficultySlider

Elo difficulty slider component (800-3000) with preset buttons and localStorage persistence.

**Usage:**

```typescript
import { DifficultySlider } from './components/DifficultySlider';

const container = document.getElementById('difficulty-container');
const slider = new DifficultySlider(container);

// Get current Elo
const elo = slider.getElo();

// Set Elo programmatically
slider.setElo(1800);

// Listen for changes
slider.onChange((newElo) => {
  console.log('Difficulty changed to:', newElo);
  // Update Stockfish Elo here
});
```

**Features:**
- Range slider from 800 to 3000 Elo
- Preset buttons: Beginner (800), Casual (1200), Club (1500), Advanced (1800), Expert (2200)
- Active preset button highlighting
- Automatic localStorage persistence
- Real-time value display

**localStorage Key:**
- `silly-chess-elo`: Stores current Elo rating

---

### GameControls

Main control panel component with game actions, new game modal, and settings panel.

**Usage:**

```typescript
import { GameControls } from './components/GameControls';

const container = document.getElementById('controls-container');
const controls = new GameControls(container);

// Register callbacks
controls.onNewGame((color) => {
  console.log('New game as:', color);
  // Start new game with chosen color
});

controls.onResign(() => {
  console.log('Player resigned');
  // Handle resignation
});

controls.onUndo(() => {
  console.log('Undo requested');
  // Undo last move pair
});

// Update button states
controls.setGameActive(true);
controls.setCanUndo(true);

// Access difficulty slider
const difficultySlider = controls.getDifficultySlider();
if (difficultySlider) {
  difficultySlider.onChange((elo) => {
    // Handle Elo change
  });
}

// Get preferences
const prefs = controls.getPreferences();
console.log('Show coordinates:', prefs.showCoordinates);
console.log('Sound enabled:', prefs.soundEnabled);
```

**Features:**
- New Game button with color selection modal (White/Black/Random)
- Resign button (disabled when no game active)
- Undo button (takes back last move pair)
- Settings button with settings panel
- Integrated DifficultySlider in settings
- Sound and coordinate display toggles
- Automatic preference persistence

**localStorage Keys:**
- `silly-chess-show-coords`: Show/hide board coordinates
- `silly-chess-sound`: Sound effects enabled/disabled

---

## Integration Example

```typescript
import { GameControls } from './components/GameControls';
import { StockfishWorker } from '../lib/stockfish/StockfishWorker';

// Initialize components
const controlsContainer = document.getElementById('game-controls');
const controls = new GameControls(controlsContainer);

// Initialize Stockfish
const stockfish = new StockfishWorker();
await stockfish.initialize();

// Access difficulty slider and sync with Stockfish
const difficultySlider = controls.getDifficultySlider();
if (difficultySlider) {
  // Set initial Elo
  await stockfish.setElo(difficultySlider.getElo());

  // Update Stockfish when Elo changes
  difficultySlider.onChange(async (elo) => {
    await stockfish.setElo(elo);
  });
}

// Handle new game
controls.onNewGame((color) => {
  const playerIsWhite = color === 'white';
  startNewGame(playerIsWhite);
  controls.setGameActive(true);
  controls.setCanUndo(false);
});

// Handle resign
controls.onResign(() => {
  endGame('resigned');
  controls.setGameActive(false);
});

// Handle undo
controls.onUndo(() => {
  if (canTakeBackMoves()) {
    undoLastMovePair();
    updateUndoState();
  }
});
```

---

## Styling

Components use a dark theme with these colors:
- Background: `#1a1a2e`
- Panel background: `#16213e`
- Button primary: `#4a4e69`
- Button hover: `#5c6078`
- Text: `#eee`
- Accent: `#829769`
- Slider track: `#333`

All styles are injected automatically and scoped to components.

---

## API Reference

### DifficultySlider

```typescript
class DifficultySlider {
  constructor(container: HTMLElement);
  getElo(): number;
  setElo(elo: number): void;
  onChange(callback: (elo: number) => void): void;
}

interface DifficultyPreset {
  label: string;
  elo: number;
}
```

### GameControls

```typescript
class GameControls {
  constructor(container: HTMLElement);

  // Callbacks
  onNewGame(callback: (color: PlayerColor) => void): void;
  onResign(callback: () => void): void;
  onUndo(callback: () => void): void;

  // State management
  setGameActive(active: boolean): void;
  setCanUndo(canUndo: boolean): void;

  // Access sub-components
  getDifficultySlider(): DifficultySlider | null;
  getPreferences(): { showCoordinates: boolean; soundEnabled: boolean };
}

type PlayerColor = 'white' | 'black';
```

---

### ChessBoard

Interactive chess board component with piece movement and visual feedback.

**Usage:**

```typescript
import { ChessBoard } from './components/Board';
import { ChessEngine } from '../../lib/chess-engine';

// Create chess engine
const engine = new ChessEngine();

// Create board
const container = document.getElementById('board-container');
const board = new ChessBoard(container, {
  flipped: false,
  interactive: true,
  showCoordinates: true
});

// Connect the engine
board.setEngine(engine);

// Handle moves
board.onMove((from, to) => {
  const success = engine.move(from, to);
  if (success) {
    board.setEngine(engine); // Update display
  }
});

// Flip board
board.flip();

// Highlight squares
board.highlightSquares(['e4', 'e5'], '#ffff00');
board.clearHighlights();

// Enable/disable interaction
board.setInteractive(false);
```

**Features:**
- 8x8 grid with alternating light and dark squares
- Unicode chess piece rendering
- Click-to-move interaction (select piece, then destination)
- Legal move highlighting (dots for empty squares, borders for captures)
- Last move highlighting
- Check highlighting with pulse animation
- Board flipping (play as black)
- Coordinate labels (a-h, 1-8)
- Responsive design (desktop and mobile)
- Touch device support
- Accessibility features (keyboard navigation, high contrast mode)

**Visual States:**
- Selected piece: Green (#829769)
- Last move: Yellow (#ced26b)
- Legal move: Semi-transparent dot
- Legal capture: Semi-transparent border
- Check: Red (#e74c3c) with pulse animation

**Color Scheme (Lichess-inspired):**
- Light square: #f0d9b5
- Dark square: #b58863

**API Reference:**

```typescript
class ChessBoard {
  constructor(container: HTMLElement, options?: BoardOptions);
  setEngine(engine: ChessEngine): void;
  flip(): void;
  onMove(callback: (from: string, to: string) => void): void;
  highlightSquares(squares: string[], color: string): void;
  clearHighlights(): void;
  setInteractive(enabled: boolean): void;
  destroy(): void;
}

interface BoardOptions {
  flipped?: boolean;        // Start with board flipped (play as black)
  interactive?: boolean;    // Enable piece movement
  showCoordinates?: boolean; // Show a-h and 1-8 labels
}
```
