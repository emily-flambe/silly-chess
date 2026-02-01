# Silly Chess: Durable Objects + D1 Logging Refactor

## Context

You're refactoring a chess web app that uses Fairy-Stockfish (WASM) for AI. Currently everything is client-side state in a single `SillyChessApp` class. The app is deployed on Cloudflare Workers with a D1 database already configured.

**Repo:** `C:\Users\emily\Documents\Github\silly-chess` (or wherever you cloned it)
**Live:** https://chess.emilycogsdill.com
**Stack:** TypeScript, Vite, Cloudflare Workers, D1, Fairy-Stockfish WASM

## Current Problem

The AI gets stuck on "AI is thinking..." — likely a race condition in the Stockfish client. But the deeper issue is architectural: game state is ephemeral client-side JS with no persistence, logging, or isolation.

## Desired Architecture

### 1. Cloudflare Durable Object per Game Session

Each game should be a Durable Object instance with:
- **Unique game ID** (UUID or nanoid)
- **Persistent state:** player color, current FEN, move history, game status, timestamps
- **WebSocket connection** to the client for real-time updates
- **Isolated Stockfish instance** (or shared, but requests scoped to game ID)

```typescript
// Conceptual structure
export class ChessGame implements DurableObject {
  state: DurableObjectState;
  
  // Game state
  gameId: string;
  playerColor: 'white' | 'black';
  fen: string;
  moveHistory: string[];
  status: 'active' | 'checkmate' | 'stalemate' | 'resigned' | 'draw';
  createdAt: number;
  
  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade or REST calls
  }
  
  async handleMove(move: string): Promise<GameUpdate> {
    // Validate move, update state, log to D1, get AI response
  }
}
```

### 2. D1 Logging

Every game should log to D1. Schema suggestion:

```sql
-- Games table
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  player_color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  result TEXT, -- 'white_wins', 'black_wins', 'draw', null if active
  ai_elo INTEGER,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

-- Moves table  
CREATE TABLE moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  move_uci TEXT NOT NULL, -- e.g., 'e2e4'
  move_san TEXT, -- e.g., 'e4'
  fen_after TEXT NOT NULL,
  eval_cp INTEGER, -- centipawns, null if not computed
  eval_mate INTEGER, -- moves to mate, null if not mate
  thinking_time_ms INTEGER,
  played_by TEXT NOT NULL, -- 'player' or 'ai'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Optional: evaluations table for deeper analysis
CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  depth INTEGER,
  nodes INTEGER,
  pv TEXT, -- principal variation
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id)
);
```

### 3. Client Changes

The frontend should:
- Request a new game from the Worker (gets back game ID)
- Connect via WebSocket to the Durable Object
- Send moves, receive AI responses and state updates
- Handle reconnection (state lives on server, not client)

### 4. Key Files to Modify/Create

**New:**
- `src/durable-objects/ChessGame.ts` — the Durable Object class
- `src/api/games.ts` — REST endpoints for creating/listing games
- `migrations/0001_create_tables.sql` — D1 schema

**Modify:**
- `src/index.ts` — route to Durable Objects, handle WebSocket upgrades
- `src/frontend/app.ts` — connect via WebSocket instead of local state
- `wrangler.toml` — add Durable Object binding

**Maybe remove:**
- A lot of the client-side game state management (moves to server)

## Constraints

1. **Fairy-Stockfish stays WASM** — it runs in the Worker/DO, not a separate service
2. **Keep it simple** — this is a toy project, don't over-engineer
3. **Preserve the UI** — the board, controls, eval bar should all still work
4. **Games should survive refresh** — that's the whole point

## Gotchas I've Found

- Stockfish WASM initialization can be slow; consider lazy-loading or warming
- The `FairyStockfishClient` has some async race conditions (see recent bugfix commits)
- The current `engine.undo()` flow is fragile — server-authoritative state will help
- D1 binding is already in `wrangler.toml` as `DB`

## Testing

After refactor:
1. Start a game → should get a game ID, persist to D1
2. Make moves → each logged to D1 with eval
3. Refresh page → game state should restore
4. Resign/checkmate → game marked complete in D1
5. New game → new Durable Object instance

## Success Criteria

- [ ] Each game is a Durable Object with unique ID
- [ ] Game state persists across page refresh
- [ ] All moves logged to D1 with timestamps
- [ ] AI responses work reliably (no more stuck "thinking")
- [ ] Can query D1 to see game history
- [ ] Existing UI still works

Good luck! 🎯
