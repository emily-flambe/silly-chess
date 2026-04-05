/**
 * Silly Chess - Database Query Helpers
 *
 * This module provides typed query functions for D1 database operations.
 * All queries use parameterized statements for security.
 */

import type { User, Game } from '../types';

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
