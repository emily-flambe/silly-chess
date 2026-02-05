# Silly Chess

Web-based chess application with Stockfish AI opponent. Designed for extensibility to support custom chess variants.

## Tech Stack

- **Backend**: Cloudflare Workers (TypeScript), Hono framework, D1 database
- **Frontend**: Vanilla TypeScript, CSS (no framework)
- **Chess Logic**: chess.js (wrapped for extensibility)
- **AI Engine**: Stockfish WASM via Web Worker
- **Build**: Vite, Wrangler
- **Testing**: Playwright (e2e)

## Project Structure

```
src/
  index.ts              # Worker entry point (Hono API)
  types.ts              # Shared TypeScript types
  frontend/
    app.ts              # Main app (wires components together)
    index.html          # Entry HTML
    components/         # UI: Board, GameControls, EvalBar, MoveList
  lib/
    chess-engine/       # Chess.js wrapper (Board, Move, Piece, Rules)
    stockfish/          # FairyStockfishClient, Web Worker integration
  db/
    schema.sql          # D1 database schema
    queries.ts          # Database operations
tests/
  ai-move.spec.ts       # Playwright e2e tests
```

## Essential Commands

```bash
# Development
npm run dev              # Start local server at http://localhost:8787
npm run build            # TypeScript + Vite build to dist/
npm run typecheck        # TypeScript type checking

# Testing
npx playwright test      # Run e2e tests (starts dev server automatically)

# Database
npm run db:migrate:local # Apply schema to local D1
npm run db:migrate       # Apply schema to remote D1

# Deployment
npm run deploy           # Deploy to Cloudflare Workers
```

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://chess.emilycogsdill.com |
| Local Dev | http://localhost:8787 |

## Key Entry Points

- `src/frontend/app.ts` - Main application (SillyChessApp class)
- `src/frontend/components/Board.ts` - Chess board rendering and interaction
- `src/lib/stockfish/index.ts` - FairyStockfishClient for AI moves
- `src/index.ts` - API routes (Hono)

## Detailed Documentation

See `.claude/` directory for in-depth documentation:
- `architecture.md` - System design and component relationships
- `frontend.md` - UI components
- `chess-engine.md` - Chess logic wrapper
- `stockfish.md` - Stockfish WASM integration
- `api.md` - API endpoints and D1 database
- `deployment.md` - Cloudflare deployment details
- `coding-standards.md` - TypeScript patterns
