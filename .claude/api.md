# API Routes

## Overview

The API uses Hono framework on Cloudflare Workers with D1 database for persistence.

**Base URLs**:
- Production: `https://chess.emilycogsdill.com/api`
- Workers.dev: `https://silly-chess.emily-cogsdill.workers.dev/api`

## Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-28T22:00:00.000Z",
  "message": "Silly Chess API is running"
}
```

### User Management

#### Create/Get User
```
POST /api/user
```

Request (optional):
```json
{
  "display_name": "Player1"
}
```

Response:
```json
{
  "id": "uuid",
  "created_at": 1732838400,
  "display_name": "Player1",
  "preferred_elo": 1500
}
```

Sets `silly-chess-user` cookie for session tracking.

#### Get Preferences
```
GET /api/preferences
```

Response:
```json
{
  "preferred_elo": 1500,
  "display_name": "Player1"
}
```

#### Update Preferences
```
PUT /api/preferences
```

Request:
```json
{
  "preferred_elo": 1800,
  "display_name": "ChessMaster"
}
```

### Game Management

#### List Games
```
GET /api/games?limit=50
```

Response:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "pgn": "1. e4 e5 2. Nf3...",
    "result": "1-0",
    "opponent_elo": 1500,
    "created_at": 1732838400,
    "ended_at": 1732842000
  }
]
```

#### Create Game
```
POST /api/games
```

Request:
```json
{
  "opponent_elo": 1500
}
```

Response:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "pgn": "",
  "result": "*",
  "opponent_elo": 1500,
  "created_at": 1732838400,
  "ended_at": null
}
```

#### Get Game
```
GET /api/games/:id
```

#### Update Game (Save Progress)
```
PUT /api/games/:id
```

Request:
```json
{
  "pgn": "1. e4 e5 2. Nf3 Nc6",
  "result": "*"
}
```

#### End Game
```
POST /api/games/:id/end
```

Request:
```json
{
  "result": "1-0"
}
```

Valid results: `"1-0"` (white wins), `"0-1"` (black wins), `"1/2-1/2"` (draw)

## Database Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (unixepoch()),
  display_name TEXT,
  preferred_elo INTEGER DEFAULT 1500
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  pgn TEXT NOT NULL,
  result TEXT,
  opponent_elo INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  ended_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Query Helpers (`src/db/queries.ts`)

```typescript
// User operations
createUser(db, userId, displayName?)
getUser(db, userId)
updateUserPreferences(db, userId, { preferred_elo?, display_name? })

// Game operations
createGame(db, gameId, userId, opponentElo)
updateGame(db, gameId, pgn, result?)
getGame(db, gameId)
listGames(db, userId, limit?)
endGame(db, gameId, result)
```

## Authentication

Anonymous users tracked via `silly-chess-user` cookie:
- HttpOnly, Secure, SameSite=Strict
- 1 year expiration
- Created on first API call
- UUID stored in D1 users table
