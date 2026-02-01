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
```

### Running Tests

**macOS/Linux:**
```bash
# Start dev server and run tests
npm run dev &
npx playwright test
```

**Windows (Workaround):**

There's a known issue with Wrangler's dev proxy on Windows where port 8787 doesn't respond. Use the internal worker port instead:

```powershell
# 1. Start dev server with debug logging
$env:WRANGLER_LOG = "debug"
npm run dev

# 2. Find the internal port in the output (look for "userWorkerUrl"):
#    "userWorkerUrl":{"protocol":"http:","hostname":"127.0.0.1","port":"XXXXX"}

# 3. In a new terminal, run tests with that port:
$env:TEST_PORT = "XXXXX"
npx playwright test
```

### Architecture

The app uses **server-authoritative game state**:

- **Durable Objects** manage persistent game sessions
- **WebSocket** for real-time state sync
- **D1 Database** logs all moves for analysis
- **Stockfish** runs client-side for AI computation
- Game state survives page refresh

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
