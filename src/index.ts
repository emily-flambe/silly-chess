/**
 * Silly Chess - Cloudflare Worker Entry Point
 * Chess application with Stockfish analysis
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env }>();

// Configure CORS
app.use('*', cors({
  origin: ['http://localhost:8787', 'https://chess.emilycogsdill.com'],
  credentials: true,
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Silly Chess API is running'
  });
});

// Placeholder API routes - will be implemented in Phase 5
app.post('/api/user', async (c) => {
  return c.json({ message: 'User endpoint - to be implemented' }, 501);
});

app.get('/api/games', async (c) => {
  return c.json({ message: 'Games list endpoint - to be implemented' }, 501);
});

app.post('/api/games', async (c) => {
  return c.json({ message: 'Create game endpoint - to be implemented' }, 501);
});

app.get('/api/games/:id', async (c) => {
  return c.json({ message: 'Get game endpoint - to be implemented' }, 501);
});

app.put('/api/games/:id', async (c) => {
  return c.json({ message: 'Update game endpoint - to be implemented' }, 501);
});

app.get('/api/preferences', async (c) => {
  return c.json({ message: 'Get preferences endpoint - to be implemented' }, 501);
});

app.put('/api/preferences', async (c) => {
  return c.json({ message: 'Update preferences endpoint - to be implemented' }, 501);
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
