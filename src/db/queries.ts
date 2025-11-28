/**
 * Silly Chess - Database Query Helpers
 *
 * This module provides typed query functions for D1 database operations.
 * All queries use parameterized statements for security.
 */

import type { User, Game, GameResult } from '../types';

// User Query Functions

/**
 * Create a new anonymous user
 * @param db D1Database instance
 * @param userId Unique user identifier (UUID)
 * @param displayName Optional display name for the user
 * @returns The created user object
 */
export async function createUser(
  db: D1Database,
  userId: string,
  displayName?: string
): Promise<User> {
  const now = Math.floor(Date.now() / 1000);
  const defaultElo = 1500;

  const result = await db.prepare(
    'INSERT INTO users (id, created_at, display_name, preferred_elo) VALUES (?, ?, ?, ?)'
  ).bind(userId, now, displayName || null, defaultElo).run();

  if (!result.success) {
    throw new Error('Failed to create user');
  }

  return {
    id: userId,
    created_at: now,
    display_name: displayName || null,
    preferred_elo: defaultElo
  };
}

/**
 * Get user by ID
 * @param db D1Database instance
 * @param userId User identifier
 * @returns User object or null if not found
 */
export async function getUser(
  db: D1Database,
  userId: string
): Promise<User | null> {
  const user = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first<User>();

  return user || null;
}

/**
 * Update user preferences
 * @param db D1Database instance
 * @param userId User identifier
 * @param prefs Preferences to update (preferred_elo and/or display_name)
 * @returns Updated user object or null if user not found
 */
export async function updateUserPreferences(
  db: D1Database,
  userId: string,
  prefs: { preferred_elo?: number; display_name?: string }
): Promise<User | null> {
  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (prefs.preferred_elo !== undefined) {
    updates.push('preferred_elo = ?');
    values.push(prefs.preferred_elo);
  }

  if (prefs.display_name !== undefined) {
    updates.push('display_name = ?');
    values.push(prefs.display_name);
  }

  if (updates.length === 0) {
    // No updates provided, just return the existing user
    return getUser(db, userId);
  }

  // Add userId for WHERE clause
  values.push(userId);

  const result = await db.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (result.meta.changes === 0) {
    return null;
  }

  // Fetch and return the updated user
  return getUser(db, userId);
}

// Game Query Functions

/**
 * Create a new game
 * @param db D1Database instance
 * @param gameId Unique game identifier (UUID)
 * @param userId User identifier (can be null for anonymous)
 * @param opponentElo Opponent's ELO rating
 * @returns The created game object
 */
export async function createGame(
  db: D1Database,
  gameId: string,
  userId: string | null,
  opponentElo: number
): Promise<Game> {
  const now = Math.floor(Date.now() / 1000);
  const initialPgn = ''; // Empty PGN for new game
  const inProgressResult: GameResult = '*';

  const result = await db.prepare(
    'INSERT INTO games (id, user_id, pgn, result, opponent_elo, created_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(gameId, userId, initialPgn, inProgressResult, opponentElo, now, null).run();

  if (!result.success) {
    throw new Error('Failed to create game');
  }

  return {
    id: gameId,
    user_id: userId,
    pgn: initialPgn,
    result: inProgressResult,
    opponent_elo: opponentElo,
    created_at: now,
    ended_at: null
  };
}

/**
 * Update game state (PGN and optionally result)
 * @param db D1Database instance
 * @param gameId Game identifier
 * @param pgn Updated PGN string
 * @param result Optional game result
 * @returns Updated game object or null if game not found
 */
export async function updateGame(
  db: D1Database,
  gameId: string,
  pgn: string,
  result?: GameResult
): Promise<Game | null> {
  const updates: string[] = ['pgn = ?'];
  const values: (string | number)[] = [pgn];

  if (result !== undefined) {
    updates.push('result = ?');
    values.push(result);

    // If result is not in progress, set ended_at
    if (result !== '*') {
      updates.push('ended_at = ?');
      values.push(Math.floor(Date.now() / 1000));
    }
  }

  // Add gameId for WHERE clause
  values.push(gameId);

  const updateResult = await db.prepare(
    `UPDATE games SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (updateResult.meta.changes === 0) {
    return null;
  }

  // Fetch and return the updated game
  return getGame(db, gameId);
}

/**
 * Get game by ID
 * @param db D1Database instance
 * @param gameId Game identifier
 * @returns Game object or null if not found
 */
export async function getGame(
  db: D1Database,
  gameId: string
): Promise<Game | null> {
  const game = await db.prepare(
    'SELECT * FROM games WHERE id = ?'
  ).bind(gameId).first<Game>();

  return game || null;
}

/**
 * List games for a user
 * @param db D1Database instance
 * @param userId User identifier
 * @param limit Maximum number of games to return (default: 50)
 * @returns Array of game objects
 */
export async function listGames(
  db: D1Database,
  userId: string,
  limit: number = 50
): Promise<Game[]> {
  const { results } = await db.prepare(
    'SELECT * FROM games WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(userId, limit).all<Game>();

  return results || [];
}

/**
 * End a game with a final result
 * @param db D1Database instance
 * @param gameId Game identifier
 * @param result Final game result ('1-0', '0-1', '1/2-1/2')
 * @returns Updated game object or null if game not found
 */
export async function endGame(
  db: D1Database,
  gameId: string,
  result: GameResult
): Promise<Game | null> {
  if (result === '*') {
    throw new Error('Cannot end game with in-progress result');
  }

  const now = Math.floor(Date.now() / 1000);

  const updateResult = await db.prepare(
    'UPDATE games SET result = ?, ended_at = ? WHERE id = ?'
  ).bind(result, now, gameId).run();

  if (updateResult.meta.changes === 0) {
    return null;
  }

  // Fetch and return the updated game
  return getGame(db, gameId);
}
