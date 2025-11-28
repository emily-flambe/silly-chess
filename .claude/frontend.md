# Frontend Components

## Overview

The frontend uses vanilla TypeScript with no framework dependencies. Components are class-based with DOM manipulation.

## Components

### ChessBoard (`src/frontend/components/Board.ts`)

Interactive chess board with click-to-move interaction.

```typescript
const board = new ChessBoard(container, {
  flipped: false,
  interactive: true,
  showCoordinates: true,
});

board.setEngine(engine);
board.onMove((from, to) => { /* handle move */ });
board.flip();
board.setInteractive(false);
board.highlightSquares(['e4', 'e5'], '#ff0000');
board.clearHighlights();
board.destroy();
```

**Features**:
- 8x8 grid with alternating colors
- Unicode piece symbols
- Click-to-select, click-to-move
- Legal move highlighting (dots for empty, rings for captures)
- Last move highlighting
- Check highlighting with pulse animation
- Touch support for mobile

**Colors** (Lichess-inspired):
- Light square: `#f0d9b5`
- Dark square: `#b58863`
- Selected: `#829769`
- Last move: `#ced26b`
- Check: `#e74c3c`

### GameControls (`src/frontend/components/GameControls.ts`)

Control panel with game actions and settings.

```typescript
const controls = new GameControls(container);

controls.onNewGame((color) => { /* 'white' | 'black' */ });
controls.onResign(() => { /* handle resign */ });
controls.onUndo(() => { /* handle undo */ });

controls.setGameActive(true);
controls.setCanUndo(true);
controls.getDifficultySlider();
controls.getPreferences();
```

**UI Elements**:
- New Game button (opens modal with color choice)
- Resign button (disabled when no game active)
- Undo button (disabled when no moves to undo)
- Settings button (opens settings panel)

### DifficultySlider (`src/frontend/components/DifficultySlider.ts`)

Elo difficulty adjustment with presets.

```typescript
const slider = new DifficultySlider(container);

slider.getElo();
slider.setElo(1500);
slider.onChange((elo) => { /* handle change */ });
```

**Presets**:
- Beginner: 800
- Casual: 1200
- Club: 1500
- Advanced: 1800
- Expert: 2200

**localStorage**: `silly-chess-elo`

### EvalBar (`src/frontend/components/EvalBar.ts`)

Position evaluation display.

```typescript
const evalBar = new EvalBar(container);

evalBar.setEvaluation(150);      // +1.5 pawns for white
evalBar.setEvaluation(-300);     // +3.0 pawns for black
evalBar.setMate(3);              // White mates in 3
evalBar.setMate(-5);             // Black mates in 5
evalBar.reset();                 // 50/50
evalBar.setVisible(true);
```

**Visual Design**:
- Vertical bar (30px wide)
- White section on top, black on bottom
- Numeric display: `+2.5`, `-1.3`, `M3`
- Smooth CSS transitions (400ms)
- Sigmoid scaling (capped at ~90% for extreme advantages)

## Styling (`src/frontend/styles.css`)

Global styles for chess board and components.

**Color Scheme**:
- Background: `#1a1a2e`
- Panel: `#16213e`
- Button: `#4a4e69`
- Text: `#eee`
- Accent: `#829769`

**Responsive Breakpoints**:
- Desktop: Board 560px max
- Tablet (900px): Controls below board
- Mobile (500px): Board 350px, compact layout

## Main Application (`src/frontend/app.ts`)

Orchestrates all components:
1. Initializes ChessEngine, StockfishWorker, UI components
2. Wires event handlers between components
3. Manages game loop (player move -> AI move)
4. Updates evaluation after each move
5. Handles game end conditions
