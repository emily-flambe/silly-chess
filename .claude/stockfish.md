# Stockfish Integration

## Overview

Stockfish runs in a Web Worker (`src/lib/stockfish/StockfishWorker.ts`) to provide AI opponent and position analysis without blocking the UI.

## StockfishWorker API

```typescript
import { StockfishWorker } from './lib/stockfish';

const ai = new StockfishWorker();

// Initialize (loads WASM, takes 1-3 seconds)
await ai.initialize();

// Set difficulty (800-3000 Elo)
await ai.setElo(1500);

// Get best move for position
const move = await ai.getBestMove(fen, { movetime: 1000 });  // 'e2e4'
const move = await ai.getBestMove(fen, { depth: 15 });       // Search to depth 15

// Analyze position
const analysis = await ai.analyze(fen, { depth: 12 });
// Returns: { bestMove, ponder, evaluation, depth, nodes, pv }

// Stop current analysis
await ai.stop();

// Clean up
ai.terminate();

// Query state
ai.getElo();      // Current Elo setting
ai.isReady();     // Initialization status
```

## UCI Protocol

Communication with Stockfish uses UCI (Universal Chess Interface):

```
// Initialize
uci                              -> uciok
isready                          -> readyok

// Set options
setoption name UCI_LimitStrength value true
setoption name UCI_Elo value 1500

// Analyze position
position fen [fen-string]
go movetime 1000                 -> bestmove e2e4 ponder e7e5
go depth 15                      -> info score cp 35 depth 15 pv e2e4 e7e5 ...

// Stop analysis
stop                             -> bestmove [current-best]
```

## Elo Difficulty

| Elo Range | Skill Level |
|-----------|-------------|
| 800-1000 | Beginner - Makes frequent mistakes |
| 1000-1400 | Casual - Basic tactics, occasional blunders |
| 1400-1800 | Club - Solid tactical awareness |
| 1800-2200 | Advanced - Strong positional play |
| 2200-2600 | Master - Near-perfect tactics |
| 2600-3000 | Engine - Superhuman accuracy |

Stockfish implements Elo limiting via `UCI_LimitStrength` and `UCI_Elo` options. Lower Elo means the engine intentionally plays weaker moves.

## Evaluation Format

The `analyze()` method returns evaluation in two formats:

**Centipawns** (number): Position advantage in hundredths of a pawn
- `+150` = White is ahead by 1.5 pawns
- `-300` = Black is ahead by 3 pawns

**Mate Score** (string): Forced checkmate detected
- `'M3'` = White can force mate in 3 moves
- `'-M5'` = Black can force mate in 5 moves

## Loading Stockfish

Currently loads from CDN (unpkg). For production, consider:
- Self-hosting WASM files for reliability
- Using the "lite" version (~7MB) for faster loads
- Lazy loading after initial page render

## Error Handling

```typescript
try {
  await ai.initialize();
} catch (error) {
  // Handle: Network error, WASM load failure, timeout
  console.error('Stockfish failed to load');
}

try {
  const move = await ai.getBestMove(fen, { movetime: 1000 });
} catch (error) {
  // Handle: Invalid FEN, analysis timeout (30s)
}
```
