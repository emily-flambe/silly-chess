/**
 * Silly Chess - Cloudflare Worker Entry Point
 * Chess application with Durable Objects for game sessions and D1 persistence
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env, GameResult, UpdateGameRequest, UserPreferences } from './types';
import {
  createUser,
  getUser,
  updateUserPreferences,
  getGame,
  listGames,
  endGame,
} from './db/queries';

// Re-export the Durable Object class
export { ChessGame } from './durable-objects/ChessGame';

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
// Game Endpoints (Durable Object-based)
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

// Create new game via Durable Object
app.post('/api/games', async (c) => {
  try {
    const userId = await getOrCreateUser(c);
    const body = await c.req.json() as { 
      player_color?: 'white' | 'black';
      ai_elo?: number;
      mode?: 'vs-ai' | 'vs-player';
    };

    // Set user cookie
    setCookie(c, 'silly-chess-user', userId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 365,
    });

    const gameId = crypto.randomUUID();
    const playerColor = body.player_color || 'white';
    const aiElo = body.ai_elo || 1500;
    const gameMode = body.mode || 'vs-ai';
    
    // Generate player token for two-player games
    const playerToken = gameMode === 'vs-player' ? crypto.randomUUID() : undefined;

    // Create Durable Object instance for this game
    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    // Initialize the game in the DO
    const response = await stub.fetch(new Request('https://do/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        playerColor,
        aiElo,
        userId,
        gameMode,
        playerToken,
      }),
    }));

    const result = await response.json() as Record<string, unknown>;

    return c.json({ 
      id: gameId,
      player_color: playerColor,
      ai_elo: aiElo,
      mode: gameMode,
      player_token: playerToken,
      ...result,
    }, 201);
  } catch (error) {
    console.error('Error creating game:', error);
    return c.json({ error: 'Failed to create game' }, 500);
  }
});

// Join an existing two-player game
app.post('/api/games/:id/join', async (c) => {
  try {
    const gameId = c.req.param('id');
    
    // Generate a unique token for this player
    const playerToken = crypto.randomUUID();

    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    const response = await stub.fetch(new Request('https://do/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerToken }),
    }));

    const result = await response.json() as Record<string, unknown>;
    
    if (!response.ok) {
      return c.json(result, response.status as 400 | 404);
    }

    return c.json({
      id: gameId,
      player_token: playerToken,
      ...result,
    });
  } catch (error) {
    console.error('Error joining game:', error);
    return c.json({ error: 'Failed to join game' }, 500);
  }
});

// WebSocket connection to game
app.get('/api/games/:id/ws', async (c) => {
  const gameId = c.req.param('id');
  
  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  // Get DO stub and forward the WebSocket request
  const doId = c.env.CHESS_GAME.idFromName(gameId);
  const stub = c.env.CHESS_GAME.get(doId);

  // Forward the request to the DO
  return stub.fetch(c.req.raw);
});

// Get game state from DO
app.get('/api/games/:id', async (c) => {
  try {
    const gameId = c.req.param('id');

    // First try to get from DO
    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    const response = await stub.fetch(new Request('https://do/state', {
      method: 'GET',
    }));

    if (response.ok) {
      const state = await response.json();
      return c.json(state);
    }

    // Fall back to D1 for historical games
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

// Make a move via REST (alternative to WebSocket)
app.post('/api/games/:id/move', async (c) => {
  try {
    const gameId = c.req.param('id');
    const body = await c.req.json() as { 
      from: string; 
      to: string; 
      promotion?: string;
      player_token?: string;  // Required for two-player games
    };

    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    const response = await stub.fetch(new Request('https://do/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: body.from,
        to: body.to,
        promotion: body.promotion,
        playerToken: body.player_token,
      }),
    }));

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Error making move:', error);
    return c.json({ error: 'Failed to make move' }, 500);
  }
});

// Submit AI move (client-computed Stockfish move)
app.post('/api/games/:id/ai-move', async (c) => {
  try {
    const gameId = c.req.param('id');
    const body = await c.req.json() as { 
      move: string; 
      thinkingTime?: number;
      evaluation?: number | string;
    };

    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    const response = await stub.fetch(new Request('https://do/ai-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Error submitting AI move:', error);
    return c.json({ error: 'Failed to submit AI move' }, 500);
  }
});

// Resign game
app.post('/api/games/:id/resign', async (c) => {
  try {
    const gameId = c.req.param('id');

    const doId = c.env.CHESS_GAME.idFromName(gameId);
    const stub = c.env.CHESS_GAME.get(doId);

    const response = await stub.fetch(new Request('https://do/resign', {
      method: 'POST',
    }));

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    console.error('Error resigning game:', error);
    return c.json({ error: 'Failed to resign' }, 500);
  }
});

// End game with result (legacy endpoint for compatibility)
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

// SPA fallback for client-side routing (e.g., /game/:id)
app.get('/game/*', async (c) => {
  // Serve index.html for game routes so client-side router can handle them
  const response = await c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)));
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});

// 404 handler for API routes
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
