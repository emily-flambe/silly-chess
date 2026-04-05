# Frontend Components

## Overview

The frontend uses vanilla TypeScript with no framework dependencies. Components are class-based with DOM manipulation.

## Components

### ChessBoard (`src/frontend/components/Board.ts`)

Interactive chess board with click-to-move interaction. Operates in FEN-based server-authoritative mode.

```typescript
const board = new ChessBoard(container, {
  flipped: false,
  interactive: true,
  showCoordinates: true,
});

board.setPosition(fen);    // Set position from FEN string
board.onMove((from, to) => { /* handle move */ });
board.flip();
board.unflip();
board.setInteractive(false);
board.setLastMove(from, to);
board.clearLastMove();
board.showHint(from, to);
board.clearHint();
board.destroy();
```

**Features**:
- 8x8 grid with alternating colors
- Unicode piece symbols
- Click-to-select, click-to-move
- Legal move highlighting (dots for empty, rings for captures)
- Last move highlighting
- Check highlighting with pulse animation
- Pawn promotion picker
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

controls.setGameActive(true);
controls.getDifficultySlider();
controls.getPreferences();
```

**UI Elements**:
- New Game button (opens modal with mode + color choice)
- Resign button (disabled when no game active)
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

### MoveList (`src/frontend/components/MoveList.ts`)

Move list with captured pieces and history navigation.

```typescript
const moveList = new MoveList(container);

moveList.updateFromSAN(['e4', 'e5', 'Nf3']);  // Update from SAN array
moveList.clear();                               // Reset
moveList.onPositionSelect((index) => { });      // History navigation callback
moveList.goBack();
moveList.goForward();
moveList.goToStart();
moveList.goToEnd();
moveList.isViewingHistory();
moveList.getViewingIndex();
```

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
1. Initializes FairyStockfishClient and UI components
2. Creates/joins games via Durable Object API
3. Wires event handlers between components
4. Manages game loop (player move -> server validation -> AI move)
5. Updates evaluation after each move
6. Handles game end conditions
