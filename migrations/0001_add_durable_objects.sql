-- Migration: Add Durable Objects support and move logging
-- Version: 0001

-- Update games table to support DO-managed games
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well,
-- so we're using nullable columns with defaults

-- Add player_color column
ALTER TABLE games ADD COLUMN player_color TEXT DEFAULT 'white';

-- Add status column for game state
ALTER TABLE games ADD COLUMN status TEXT DEFAULT 'active';

-- Rename opponent_elo to ai_elo for clarity (we'll just add new column)
ALTER TABLE games ADD COLUMN ai_elo INTEGER;

-- Moves table - logs every move in the game
CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  move_uci TEXT NOT NULL,           -- e.g., 'e2e4', 'e7e8q'
  move_san TEXT,                     -- e.g., 'e4', 'Nf3'
  fen_after TEXT NOT NULL,           -- FEN after the move
  eval_cp INTEGER,                   -- Centipawn evaluation (null if not computed)
  eval_mate INTEGER,                 -- Moves to mate (null if not mate)
  thinking_time_ms INTEGER,          -- How long AI took (null for player moves)
  played_by TEXT NOT NULL,           -- 'player' or 'ai'
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Evaluations table for deeper analysis (optional)
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  depth INTEGER,
  nodes INTEGER,
  pv TEXT,                           -- Principal variation (space-separated moves)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_game_number ON moves(game_id, move_number);
CREATE INDEX IF NOT EXISTS idx_evaluations_game ON evaluations(game_id);

-- Update existing games to have ai_elo from opponent_elo
UPDATE games SET ai_elo = opponent_elo WHERE ai_elo IS NULL;
