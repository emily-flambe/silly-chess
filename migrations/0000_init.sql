-- Silly Chess Database Schema (initial)
-- Version 0.0

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (unixepoch()),
  display_name TEXT,
  preferred_elo INTEGER DEFAULT 1500
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  pgn TEXT NOT NULL,
  result TEXT,
  opponent_elo INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  ended_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
