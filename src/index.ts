/**
 * Silly Chess - Cloudflare Worker Entry Point
 * Chess application with Stockfish analysis and D1 database persistence
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env, GameResult, CreateGameRequest, UpdateGameRequest, UserPreferences } from './types';
import {
  createUser,
  getUser,
  updateUserPreferences,
  createGame,
  updateGame,
  getGame,
  listGames,
  endGame,
} from './db/queries';

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>();

// Configure CORS
app.use('*', cors({
  origin: ['http://localhost:8787', 'http://localhost:3000', 'https://chess.emilycogsdill.com'],
  credentials: true,
}));

// Helper to get or create user from cookie
async function getOrCreateUser(c: { env: Env; req: { raw: Request } }, userId?: string): Promise<string> {
  // Try to get user ID from cookie or provided value
  let uid = userId || getCookie(c as Parameters<typeof getCookie>[0], 'silly-chess-user');

  if (uid) {
    // Verify user exists
    const user = await getUser(c.env.DB, uid);
    if (user) {
      return uid;
    }
  }

  // Create new user
  uid = crypto.randomUUID();
  await createUser(c.env.DB, uid);
  return uid;
}

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Silly Chess API is running'
  });
});

// ============================================
// User Endpoints
// ============================================

// Get or create anonymous user
app.post('/api/user', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { display_name?: string };
    const userId = await getOrCreateUser(c);

    // Update display name if provided
    if (body.display_name) {
      await updateUserPreferences(c.env.DB, userId, { display_name: body.display_name });
    }

    const user = await getUser(c.env.DB, userId);

    // Set cookie for future requests
    setCookie(c, 'silly-chess-user', userId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return c.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Get user preferences
app.get('/api/preferences', async (c) => {
  try {
    const userId = getCookie(c, 'silly-chess-user');

    if (!userId) {
      return c.json({ error: 'User not found' }, 404);
    }

    const user = await getUser(c.env.DB, userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      preferred_elo: user.preferred_elo,
      display_name: user.display_name,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return c.json({ error: 'Failed to fetch preferences' }, 500);
  }
});

// Update user preferences
app.put('/api/preferences', async (c) => {
  try {
    const userId = getCookie(c, 'silly-chess-user');

    if (!userId) {
      return c.json({ error: 'User not found' }, 404);
    }

    const body = await c.req.json() as UserPreferences;
    const user = await updateUserPreferences(c.env.DB, userId, body);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      preferred_elo: user.preferred_elo,
      display_name: user.display_name,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

// ============================================
// Game Endpoints
// ============================================

// List user's games
app.get('/api/games', async (c) => {
  try {
    const userId = getCookie(c, 'silly-chess-user');

    if (!userId) {
      return c.json([]);
    }

    const limit = parseInt(c.req.query('limit') || '50', 10);
    const games = await listGames(c.env.DB, userId, limit);

    return c.json(games);
  } catch (error) {
    console.error('Error listing games:', error);
    return c.json({ error: 'Failed to list games' }, 500);
  }
});

// Create new game
app.post('/api/games', async (c) => {
  try {
    const userId = await getOrCreateUser(c);
    const body = await c.req.json() as CreateGameRequest;

    // Set user cookie
    setCookie(c, 'silly-chess-user', userId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 365,
    });

    const gameId = crypto.randomUUID();
    const game = await createGame(c.env.DB, gameId, userId, body.opponent_elo);

    return c.json(game, 201);
  } catch (error) {
    console.error('Error creating game:', error);
    return c.json({ error: 'Failed to create game' }, 500);
  }
});

// Get specific game
app.get('/api/games/:id', async (c) => {
  try {
    const gameId = c.req.param('id');
    const game = await getGame(c.env.DB, gameId);

    if (!game) {
      return c.json({ error: 'Game not found' }, 404);
    }

    return c.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return c.json({ error: 'Failed to fetch game' }, 500);
  }
});

// Update game (save PGN progress)
app.put('/api/games/:id', async (c) => {
  try {
    const gameId = c.req.param('id');
    const body = await c.req.json() as UpdateGameRequest;

    const game = await updateGame(c.env.DB, gameId, body.pgn, body.result);

    if (!game) {
      return c.json({ error: 'Game not found' }, 404);
    }

    return c.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    return c.json({ error: 'Failed to update game' }, 500);
  }
});

// End game with result
app.post('/api/games/:id/end', async (c) => {
  try {
    const gameId = c.req.param('id');
    const body = await c.req.json() as { result: GameResult };

    if (!body.result || body.result === '*') {
      return c.json({ error: 'Invalid result' }, 400);
    }

    const game = await endGame(c.env.DB, gameId, body.result);

    if (!game) {
      return c.json({ error: 'Game not found' }, 404);
    }

    return c.json(game);
  } catch (error) {
    console.error('Error ending game:', error);
    return c.json({ error: 'Failed to end game' }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
