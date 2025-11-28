# Architecture

## System Overview

```
+-------------------+     +-------------------+     +-------------------+
|     Frontend      |     |  Cloudflare Worker |     |    D1 Database    |
|  (Browser/Vite)   |<--->|     (Hono API)     |<--->|  (users, games)   |
+-------------------+     +-------------------+     +-------------------+
         |
         v
+-------------------+
|  Stockfish WASM   |
|   (Web Worker)    |
+-------------------+
```

## Component Layers

### Frontend Layer (`src/frontend/`)
- **app.ts**: Main application orchestrator, wires all components
- **components/Board.ts**: Interactive chess board with click-to-move
- **components/GameControls.ts**: New game, resign, undo, settings
- **components/DifficultySlider.ts**: Elo adjustment (800-3000)
- **components/EvalBar.ts**: Position evaluation display
- **index.html**: Application shell and layout
- **styles.css**: Board and component styling

### Core Logic Layer (`src/lib/`)
- **chess-engine/**: Chess logic wrapper around chess.js
  - Extensible interfaces for future variant support
  - Board state, piece definitions, move validation, rules
- **stockfish/**: AI opponent integration
  - Web Worker wrapper for Stockfish WASM
  - UCI protocol implementation
  - Elo-based difficulty adjustment

### API Layer (`src/`)
- **index.ts**: Hono routes for user/game persistence
- **types.ts**: TypeScript interfaces shared across layers
- **db/queries.ts**: D1 database query helpers
- **db/schema.sql**: Database schema (users, games tables)

## Data Flow

### Game Loop
1. User clicks "New Game" -> GameControls emits event
2. App creates ChessEngine instance, resets board
3. If playing black, App calls StockfishWorker.getBestMove()
4. User makes move -> Board emits move event
5. App validates via ChessEngine.move()
6. App updates EvalBar via StockfishWorker.analyze()
7. App triggers AI move via StockfishWorker.getBestMove()
8. Repeat until checkmate/stalemate/resign

### Persistence Flow
1. Game starts -> POST /api/games creates record
2. After each move -> PUT /api/games/:id updates PGN
3. Game ends -> POST /api/games/:id/end sets result

## Key Design Decisions

### Extensibility for Variants
The chess engine uses interfaces (`PieceDefinition`, `RuleSet`, `BoardState`) that can be swapped out for custom variants. Currently wraps chess.js but designed for future custom implementations.

### Stockfish in Web Worker
Stockfish runs in a Web Worker to prevent blocking the UI thread. Communication uses UCI protocol via postMessage.

### Vanilla TypeScript
No React/Vue to keep the bundle small and dependencies minimal. Components use class-based patterns with DOM manipulation.

### D1 for Persistence
Cloudflare D1 provides SQLite at the edge. Simple schema with users and games tables. Anonymous users tracked via cookie.
