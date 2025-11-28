# Chess Engine

Extensible chess logic wrapper around chess.js with support for future variants.

## Overview

This module provides a clean, extensible API for chess game logic while internally using chess.js for move validation and game state management. The architecture is designed to support custom chess variants in the future.

## Core Components

### Board (`Board.ts`)
- Board state management wrapping chess.js
- Move execution and validation
- FEN/PGN import/export
- Game state queries (check, checkmate, stalemate, draw)

### Pieces (`Piece.ts`)
- Abstract `Piece` class implementing `PieceDefinition` interface
- Standard chess pieces: King, Queen, Rook, Bishop, Knight, Pawn
- `PieceFactory` for piece creation and management
- Extensible for custom piece types

### Moves (`Move.ts`)
- `MoveValidator` for move legality checking
- `MoveHistory` for tracking game moves
- `MoveBuilder` for constructing move objects
- Move statistics and analysis

### Rules (`Rules.ts`)
- `StandardRules` implementing `RuleSet` interface
- Check/checkmate detection
- Draw condition detection (stalemate, threefold, fifty-move, insufficient material)
- Castling validation
- Extensible for variant rules

## Quick Start

```typescript
import { createChessGame } from './lib/chess-engine';

// Create a new game
const game = createChessGame();

// Make moves
game.move('e2', 'e4');
game.move('e7', 'e5');

// Get legal moves
const moves = game.getLegalMoves('g1'); // Returns legal moves for knight

// Check game status
const status = game.getStatus();
console.log(status.isCheck);      // false
console.log(status.isCheckmate);  // false
console.log(status.turn);         // 'white'

// Export/import FEN
const fen = game.getFEN();
const newGame = createChessGame(fen);

// Export PGN
const pgn = game.getPGN();
```

## API Reference

### ChessEngine

Main game controller combining all components.

#### Methods

- `move(from: string, to: string, promotion?: string): boolean` - Make a move
- `undo(): boolean` - Undo last move
- `getState(): BoardState` - Get current board state
- `getLegalMoves(square?: string): Move[]` - Get legal moves
- `getStatus()` - Get game status (check, checkmate, etc.)
- `loadFEN(fen: string): boolean` - Load position from FEN
- `getFEN(): string` - Export position as FEN
- `loadPGN(pgn: string): boolean` - Load game from PGN
- `getPGN(): string` - Export game as PGN
- `reset(): void` - Reset to initial position
- `ascii(): string` - Get ASCII board representation

### Board

Low-level board state management.

#### Methods

- `getState(): BoardState` - Get complete board state
- `makeMove(move): Move | null` - Execute move
- `undoMove(): Move | null` - Undo last move
- `getLegalMoves(square): Move[]` - Get legal moves for square
- `getAllLegalMoves(): Move[]` - Get all legal moves
- `isCheck(): boolean` - Check detection
- `isCheckmate(): boolean` - Checkmate detection
- `isStalemate(): boolean` - Stalemate detection
- `isDraw(): boolean` - Draw detection
- `toFEN(): string` - Export FEN
- `loadFEN(fen): boolean` - Import FEN
- `toPGN(): string` - Export PGN
- `loadPGN(pgn): boolean` - Import PGN

### StandardRules

Chess rule implementation.

#### Methods

- `isCheckmate(board): Color | null` - Returns color that is checkmated
- `isStalemate(board): boolean` - Stalemate detection
- `isDraw(board): DrawReason | null` - Draw detection with reason
- `isLegalMove(move, board): boolean` - Move validation
- `canCastle(board, side, color): boolean` - Castling validation
- `getEnPassantTarget(board): Square | null` - En passant square
- `getInitialPosition(): BoardState` - Initial board state
- `getAvailablePieces(): PieceDefinition[]` - All piece types

## Architecture

The engine is built with extensibility in mind:

1. **Interface-based design** - All core components implement interfaces from `types.ts`
2. **Wrapper pattern** - chess.js is wrapped internally, making it swappable
3. **Factory pattern** - `PieceFactory` allows custom piece registration
4. **Strategy pattern** - `RuleSet` interface enables variant rules

## Future Extensions

This architecture supports:

- Custom piece types (e.g., Amazon, Chancellor, Archbishop)
- Variant rules (e.g., Chess960, Atomic, Crazyhouse)
- Custom board sizes and shapes
- Special move types and conditions

## Testing

Run the test suite:

```bash
npx tsx test-chess-engine.ts
```

Type checking:

```bash
npm run typecheck
```

## Dependencies

- `chess.js` (^1.0.0-beta.8) - Core chess logic and move validation
