# EvalBar Component

Visual evaluation bar component for displaying chess position advantage based on Stockfish analysis.

## Features

- Vertical bar showing position evaluation
- White advantage from top, black advantage from bottom
- Smooth CSS transitions (400ms ease-out)
- Support for centipawn and mate evaluations
- Responsive design (30px width, matches board height)
- No external dependencies

## Usage

### Basic Setup

```typescript
import { EvalBar } from './components/EvalBar';

// Create container
const container = document.getElementById('eval-container');

// Initialize eval bar
const evalBar = new EvalBar(container);
```

### With Stockfish Analysis

```typescript
import { EvalBar } from './components/EvalBar';
import { StockfishWorker } from '../lib/stockfish/StockfishWorker';

const evalBar = new EvalBar(container);
const stockfish = new StockfishWorker();

await stockfish.initialize();

// Analyze position
const analysis = await stockfish.analyze(fen, { depth: 15 });

// Update eval bar (handles both number and string formats)
evalBar.setAnalysisEvaluation(analysis.evaluation);
```

## API

### Constructor

```typescript
new EvalBar(container: HTMLElement)
```

Creates an evaluation bar in the specified container.

### Methods

#### setEvaluation(value: number): void

Set evaluation in centipawns. Positive values = white advantage, negative = black advantage.

```typescript
evalBar.setEvaluation(0);    // Equal position (0.0)
evalBar.setEvaluation(100);  // White +1 pawn (+1.0)
evalBar.setEvaluation(-250); // Black +2.5 pawns (-2.5)
```

#### setMate(moves: number): void

Set mate evaluation. Positive = white mates, negative = black mates.

```typescript
evalBar.setMate(3);   // White mate in 3 (M3)
evalBar.setMate(-5);  // Black mate in 5 (M5)
```

#### setAnalysisEvaluation(evaluation: number | string): void

Handle evaluation from Stockfish analysis. Automatically detects format.

```typescript
// Handles centipawn numbers
evalBar.setAnalysisEvaluation(150);

// Handles mate strings
evalBar.setAnalysisEvaluation("M3");
```

#### reset(): void

Reset to equal position (0.0).

```typescript
evalBar.reset();
```

#### setVisible(visible: boolean): void

Show or hide the evaluation bar.

```typescript
evalBar.setVisible(true);  // Show
evalBar.setVisible(false); // Hide
```

#### getEvaluation(): number | string

Get current evaluation value.

```typescript
const current = evalBar.getEvaluation();
```

#### destroy(): void

Remove the component from DOM and clean up.

```typescript
evalBar.destroy();
```

## Scaling Function

The bar uses a sigmoid-like scaling function for smooth gradient:

```typescript
function evalToPercent(centipawns: number): number {
  const maxEval = 700; // centipawns for ~90% display
  const clamped = Math.max(-maxEval, Math.min(maxEval, centipawns));
  return 50 + (clamped / maxEval) * 40;
}
```

### Scaling Examples

| Centipawns | Display |
|-----------|---------|
| 0 | 50% white, 50% black |
| +100 (+1 pawn) | ~55% white |
| +300 (+3 pawns) | ~70% white |
| +500 (+5 pawns) | ~85% white |
| +700+ | ~90% white (capped) |
| Mate | 95% winning side |

## Styling

### Colors

- White section: `#f0f0f0`
- Black section: `#2a2a2a`
- Border: `#555`
- Text color: Dynamic (contrasts with background)
- Text shadow: Double shadow for readability

### Dimensions

- Width: 30px
- Height: Inherits from container (should match board)
- Border radius: 4px
- Border: 1px solid

### Animation

- Transition: `height 400ms ease-out`
- Applied to both white and black sections
- Text updates instantly

## Layout Example

Position the eval bar next to the chess board:

```typescript
const boardContainer = document.getElementById('chess-board');
const evalContainer = document.createElement('div');

evalContainer.style.cssText = `
  position: absolute;
  right: -40px;
  top: 0;
  bottom: 0;
`;

boardContainer.appendChild(evalContainer);
const evalBar = new EvalBar(evalContainer);
```

## Implementation Notes

- Built with vanilla TypeScript/JavaScript
- No framework dependencies (React, Vue, etc.)
- CSS transitions for smooth animations
- Text shadow ensures readability on any background
- Handles edge cases (mate, extreme evaluations)
- Responsive to evaluation changes

## Examples

See `EvalBar.example.ts` for complete usage examples including:
- Basic setup
- Stockfish integration
- Manual updates
- Responsive layout
- Real-time continuous analysis
