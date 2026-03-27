# Silly Chess

## Getting Up to Speed

When resuming work on this project:

1. **Read the README.md** for a quick overview of features and tech stack
2. **Review the .claude/ directory** for detailed technical documentation:
   - `architecture.md` - System design and component relationships
   - `frontend.md` - UI components (Board, GameControls, EvalBar, MoveList)
   - `chess-engine.md` - Chess.js wrapper and move validation
   - `stockfish.md` - Fairy-Stockfish WASM integration
   - `deployment.md` - Cloudflare Workers deployment process
3. **Check recent commits** with `git log --oneline -10` to understand recent changes
4. **Run locally** with `npm run dev` to test at http://localhost:8787
5. **Test the live site** at https://chess.emilycogsdill.com

Key entry points:
- `src/frontend/app.ts` - Main application that wires all components together
- `src/frontend/components/` - UI components (Board, GameControls, EvalBar, MoveList)
- `src/lib/stockfish/index.ts` - FairyStockfishClient for AI moves and analysis

## Project Overview

Silly Chess is a web-based chess application with AI opponent powered by Stockfish. It's designed for extensibility to support custom chess variants in the future.

**Core Function**: Play chess against an AI opponent with adjustable difficulty (Elo 800-3000), real-time position evaluation, and game persistence.

**Tech Stack**:
- Backend: Cloudflare Workers (TypeScript), Hono framework, D1 database
- Frontend: Vanilla TypeScript, CSS
- Chess Logic: chess.js library (wrapped for extensibility)
- AI Engine: Stockfish WASM via Web Worker
- Build: Vite, Wrangler

**Live URL**: https://chess.emilycogsdill.com

## AI Behavior Guidelines

See [.claude/ai-behavior.md](.claude/ai-behavior.md) for communication style and code generation principles.

## Technical Specifications

- **Architecture**: [.claude/architecture.md](.claude/architecture.md) - System design and component relationships
- **Chess Engine**: [.claude/chess-engine.md](.claude/chess-engine.md) - Chess logic wrapper and extensibility patterns
- **Stockfish Integration**: [.claude/stockfish.md](.claude/stockfish.md) - AI opponent implementation
- **Frontend Components**: [.claude/frontend.md](.claude/frontend.md) - UI components and styling
- **API Routes**: [.claude/api.md](.claude/api.md) - Hono API endpoints and D1 database

## Development Guidelines

- **Deployment**: [.claude/deployment.md](.claude/deployment.md) - Wrangler commands and Cloudflare setup
- **Coding Standards**: [.claude/coding-standards.md](.claude/coding-standards.md) - TypeScript patterns and conventions

## Knowledge Graph (Agent-MCP)

After significant changes (new features, architecture decisions, schema changes), save context to Agent-MCP using `update_project_context`. Use the key prefix `silly-chess/` (e.g., `silly-chess/architecture`).

Update existing entries when information changes. Create new keys for new topics. This ensures any agent in any session can retrieve project context via `ask_project_rag`.
