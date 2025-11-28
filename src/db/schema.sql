-- Silly Chess Database Schema
-- Version 1.0

-- Users table (anonymous users tracked by cookie)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER DEFAULT (unixepoch()),
  display_name TEXT,
  preferred_elo INTEGER DEFAULT 1500
);

-- Games table for storing game history
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  pgn TEXT NOT NULL,
  result TEXT, -- '1-0', '0-1', '1/2-1/2', '*' (in progress)
  opponent_elo INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  ended_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
