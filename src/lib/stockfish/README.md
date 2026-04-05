# Stockfish Integration

WASM-based chess engine integration using Fairy-Stockfish, supporting standard chess and 50+ variants. Runs entirely in the browser via Web Worker.

## Features

- **Fairy-Stockfish WASM**: Runs in browser via Web Worker, no server needed
- **Variant Support**: Standard chess plus 50+ variants (Chess960, Crazyhouse, etc.)
- **Configurable Elo**: Adjustable difficulty from 800 to 3000
- **Position Analysis**: Get evaluations, principal variations, and best moves
- **Timeout Protection**: Automatic timeouts prevent hanging operations

## Usage

### Basic Setup

```typescript
import { FairyStockfishClient } from '@/lib/stockfish';

const stockfish = new FairyStockfishClient();

// Initialize engine
await stockfish.initialize();

// Set difficulty level
await stockfish.setElo(1200);
```

### Get Best Move

```typescript
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Quick move (1 second)
const move = await stockfish.getBestMove(fen, { movetime: 1000 });
console.log(move); // 'e2e4'

// Deep analysis (15 ply)
const move = await stockfish.getBestMove(fen, { depth: 15 });
```

### Position Analysis

```typescript
const analysis = await stockfish.analyze(fen, { depth: 15 });

console.log(analysis);
// {
//   bestMove: 'e2e4',
//   ponder: 'e7e5',
//   evaluation: 35,           // centipawns (or 'M3' for mate in 3)
//   depth: 15,
//   nodes: 123456,
//   pv: ['e2e4', 'e7e5', 'g1f3', ...]  // principal variation
// }
```

### Cleanup

```typescript
// Stop current analysis
await stockfish.stop();

// Terminate worker when done
stockfish.terminate();
```

## Elo Difficulty Guide

- **800-1000**: Beginner (makes frequent mistakes)
- **1000-1400**: Casual player
- **1400-1800**: Club player
- **1800-2200**: Advanced player
- **2200-2600**: Master level
- **2600-3000**: Super GM / Engine strength
