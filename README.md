# Silly Chess

A web-based chess application with an AI opponent powered by Stockfish WASM.

## Live Demo

**https://chess.emilycogsdill.com**

## Features

- Play chess against Stockfish AI with adjustable difficulty (Elo 800-3000)
- Real-time position evaluation bar
- Move list with standard algebraic notation
- Captured pieces display
- Hint button to see the best move
- Undo moves
- Responsive design

## Tech Stack

- **Backend**: Cloudflare Workers (TypeScript), Hono framework, D1 database
- **Frontend**: Vanilla TypeScript, CSS
- **Chess Logic**: chess.js (wrapped for future variant extensibility)
- **AI Engine**: Fairy-Stockfish WASM via ffish library
- **Build**: Vite, Wrangler

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy

# Run E2E tests
npx playwright test
```

## Project Structure

```
src/
  frontend/           # UI components and styling
    components/       # Board, GameControls, EvalBar, MoveList
    app.ts           # Main application wiring
    styles.css       # Global styles
  lib/
    chess-engine/    # Chess.js wrapper for move validation
    stockfish/       # Fairy-Stockfish WASM integration
  worker/            # Cloudflare Worker entry point
  types/             # TypeScript type definitions
```

## License

MIT
