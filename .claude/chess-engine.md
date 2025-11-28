# Chess Engine

## Overview

The chess engine (`src/lib/chess-engine/`) wraps chess.js with extensible interfaces designed for future variant support.

## Key Files

| File | Purpose |
|------|---------|
| `Board.ts` | Board state management, FEN/PGN import/export |
| `Piece.ts` | Piece definitions (King, Queen, Rook, Bishop, Knight, Pawn) |
| `Move.ts` | Move validation, history tracking |
| `Rules.ts` | Game rules (check, checkmate, stalemate, draw conditions) |
| `index.ts` | ChessEngine class and module exports |

## ChessEngine API

```typescript
import { ChessEngine, createChessGame } from './lib/chess-engine';

// Create new game
const engine = createChessGame();

// Make moves
engine.move('e2', 'e4');           // Returns Move object or null
engine.move('e7', 'e8', 'q');      // Promotion to queen

// Query state
engine.getStatus();                 // { turn, isCheck, isCheckmate, isStalemate, isDraw }
engine.getLegalMoves('e2');         // Array of legal moves for piece
engine.getState();                  // Full BoardState object

// Undo
engine.undo();                      // Returns undone Move or null

// Import/Export
engine.loadFEN('rnbqkbnr/...');
engine.getFEN();
engine.loadPGN('1. e4 e5 2. Nf3...');
engine.getPGN();

// Reset
engine.reset();

// Debug
engine.ascii();                     // ASCII board representation
```

## Extensibility Interfaces

### PieceDefinition
```typescript
interface PieceDefinition {
  id: string;
  name: string;
  symbol: string;
  svg: string;
  getMoves(board: BoardState, position: Square): Move[];
  canCapture?(target: PieceDefinition): boolean;
  onMove?(move: Move, board: BoardState): void;
  getValue(): number;
}
```

### RuleSet
```typescript
interface RuleSet {
  name: string;
  isCheckmate(board: BoardState): Color | null;
  isStalemate(board: BoardState): boolean;
  isDraw(board: BoardState): DrawReason | null;
  isLegalMove(move: Move, board: BoardState): boolean;
  canCastle(board: BoardState, side: 'kingside' | 'queenside', color: Color): boolean;
  getEnPassantTarget(board: BoardState): Square | null;
  getInitialPosition(): BoardState;
  getAvailablePieces(): PieceDefinition[];
}
```

## Adding Custom Variants (Future)

1. Create new piece classes implementing `PieceDefinition`
2. Create new rule set implementing `RuleSet`
3. Register with ChessEngine factory

Example:
```typescript
// Custom piece
class Empress implements PieceDefinition {
  // Combines Rook + Knight movement
  getMoves(board, position) { ... }
}

// Custom rules
class CapablancaRules implements RuleSet {
  getAvailablePieces() {
    return [...standardPieces, new Empress(), new Princess()];
  }
}
```

## chess.js Integration

Currently, the engine delegates to chess.js for:
- Move generation and validation
- Check/checkmate/stalemate detection
- FEN/PGN parsing
- En passant, castling, promotion rules

The wrapper allows swapping chess.js for custom implementations without changing the public API.
