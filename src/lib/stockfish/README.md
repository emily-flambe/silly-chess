# Stockfish Integration

Web Worker wrapper for Stockfish chess engine with UCI protocol support.

## Features

- **Web Worker Architecture**: Runs Stockfish in background thread to prevent UI blocking
- **UCI Protocol**: Standard Universal Chess Interface for engine communication
- **Configurable Elo**: Adjustable difficulty from 800 to 3000
- **Position Analysis**: Get evaluations, principal variations, and best moves
- **Timeout Protection**: Automatic timeouts prevent hanging operations
- **Error Handling**: Comprehensive error handling for initialization and analysis

## Usage

### Basic Setup

```typescript
import { StockfishWorker } from '@/lib/stockfish';

const stockfish = new StockfishWorker();

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

## API Reference

### `initialize(): Promise<void>`
Initialize Stockfish Web Worker and configure UCI protocol. Must be called before any other operations.

### `setElo(elo: number): Promise<void>`
Set AI difficulty level.
- **elo**: Rating between 800 and 3000
- Values outside range are clamped automatically

### `getBestMove(fen: string, options?): Promise<string>`
Get best move for a position.
- **fen**: FEN string representing the position
- **options.movetime**: Time limit in milliseconds
- **options.depth**: Search depth in plies
- **Returns**: UCI move notation (e.g., 'e2e4', 'e7e8q')

### `analyze(fen: string, options?): Promise<StockfishAnalysis>`
Analyze position and return comprehensive evaluation.
- **fen**: FEN string representing the position
- **options.depth**: Search depth in plies (default: 15)
- **Returns**: StockfishAnalysis object with evaluation details

### `stop(): Promise<void>`
Stop current analysis immediately.

### `terminate(): void`
Terminate Web Worker and clean up resources.

### `getElo(): number`
Get current Elo rating.

### `isReady(): boolean`
Check if engine is initialized and ready.

## UCI Protocol Details

### Elo Limiting
Stockfish uses UCI options to limit strength:
```
setoption name UCI_LimitStrength value true
setoption name UCI_Elo value 1200
```

### Position Setup
```
position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

### Search Commands
```
go movetime 1000      // Search for 1 second
go depth 15           // Search to depth 15
```

### Response Parsing
```
info depth 15 score cp 35 nodes 12345 pv e2e4 e7e5 g1f3
bestmove e2e4 ponder e7e5
```

## Error Handling

All methods throw errors for:
- Worker initialization failures
- Timeout after 30 seconds
- Invalid positions (no legal moves)
- Operations before initialization

Example:
```typescript
try {
  const move = await stockfish.getBestMove(invalidFen);
} catch (error) {
  console.error('Failed to get move:', error.message);
}
```

## Performance Considerations

- **Web Worker**: Prevents UI blocking during analysis
- **Timeout Protection**: Automatic 30-second timeout for all operations
- **Stop Capability**: Can interrupt long-running analysis
- **Resource Cleanup**: Terminate worker when done to free memory

## Integration Notes

- Currently loads Stockfish from unpkg CDN
- For production, consider self-hosting WASM files
- Worker initialization takes 1-3 seconds
- Analysis time depends on position complexity and search parameters

## Elo Difficulty Guide

- **800-1000**: Beginner (makes frequent mistakes)
- **1000-1400**: Casual player
- **1400-1800**: Club player
- **1800-2200**: Advanced player
- **2200-2600**: Master level
- **2600-3000**: Super GM / Engine strength
