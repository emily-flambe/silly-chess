/**
 * Backend tests for Hono API routes
 *
 * Tests the worker's HTTP endpoints end-to-end using the exports helper.
 * These tests exercise the full request path: Hono routing → DO interaction → D1 persistence.
 */

import { env, exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

// Helper: make a request to the worker
async function request(
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  return exports.default.fetch(
    new Request(`http://localhost${path}`, opts)
  );
}

// Helper: make a JSON POST request
async function jsonPost(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ============================================
// Health Check
// ============================================

describe("Health Check", () => {
  it("returns 200 with status ok", async () => {
    const res = await request("/api/health");
    expect(res.status).toBe(200);

    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeTruthy();
  });
});

// ============================================
// Game Creation via API
// ============================================

describe("POST /api/games", () => {
  it("creates a vs-ai game", async () => {
    const res = await jsonPost("/api/games", {
      player_color: "white",
      ai_elo: 1200,
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.id).toBeTruthy();
    expect(data.player_color).toBe("white");
    expect(data.ai_elo).toBe(1200);
    expect(data.mode).toBe("vs-ai");
    expect(data.success).toBe(true);
  });

  it("creates a vs-player game with token", async () => {
    const res = await jsonPost("/api/games", {
      player_color: "black",
      mode: "vs-player",
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.mode).toBe("vs-player");
    expect(data.player_token).toBeTruthy(); // Auto-generated token
  });

  it("defaults to white and 1500 elo", async () => {
    const res = await jsonPost("/api/games", {});

    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.player_color).toBe("white");
    expect(data.ai_elo).toBe(1500);
  });
});

// ============================================
// Game State Retrieval
// ============================================

describe("GET /api/games/:id", () => {
  it("returns game state for an active game", async () => {
    // Create a game first
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    // Fetch the game
    const res = await request(`/api/games/${gameId}`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as Record<string, unknown>;
    expect(data.gameId).toBe(gameId);
    expect(data.status).toBe("active");
    expect(data.fen).toBeTruthy();
  });

  it("returns 404 for non-existent game", async () => {
    const res = await request("/api/games/non-existent-id");
    expect(res.status).toBe(404);
  });
});

// ============================================
// Move Submission via REST
// ============================================

describe("POST /api/games/:id/move", () => {
  it("makes a valid move", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    const moveRes = await jsonPost(`/api/games/${gameId}/move`, {
      from: "e2",
      to: "e4",
    });

    expect(moveRes.status).toBe(200);
    const data = (await moveRes.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.san).toBe("e4");
  });

  it("rejects an invalid move", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    const moveRes = await jsonPost(`/api/games/${gameId}/move`, {
      from: "e2",
      to: "e5",
    });

    expect(moveRes.status).toBe(200); // DO returns 200 with error in body
    const data = (await moveRes.json()) as Record<string, unknown>;
    expect(data.type).toBe("error");
  });
});

// ============================================
// AI Move Submission
// ============================================

describe("POST /api/games/:id/ai-move", () => {
  it("accepts an AI move after player moves", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    // Player move first
    await jsonPost(`/api/games/${gameId}/move`, {
      from: "e2",
      to: "e4",
    });

    // AI move
    const aiRes = await jsonPost(`/api/games/${gameId}/ai-move`, {
      move: "e7e5",
    });

    expect(aiRes.status).toBe(200);
    const data = (await aiRes.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.san).toBe("e5");
  });
});

// ============================================
// Resign
// ============================================

describe("POST /api/games/:id/resign", () => {
  it("resigns an active game", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    const resignRes = await jsonPost(`/api/games/${gameId}/resign`, {});

    expect(resignRes.status).toBe(200);
    const data = (await resignRes.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    const gs = data.gameState as Record<string, unknown>;
    expect(gs.status).toBe("resigned");
  });
});

// ============================================
// Two-Player Join
// ============================================

describe("POST /api/games/:id/join", () => {
  it("allows joining a two-player game", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
      mode: "vs-player",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    const joinRes = await jsonPost(`/api/games/${gameId}/join`, {});

    expect(joinRes.status).toBe(200);
    const data = (await joinRes.json()) as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.player_token).toBeTruthy();
    expect(data.playerColor).toBe("black");
  });

  it("rejects joining a vs-ai game", async () => {
    const createRes = await jsonPost("/api/games", {
      player_color: "white",
      mode: "vs-ai",
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    const gameId = createData.id as string;

    const joinRes = await jsonPost(`/api/games/${gameId}/join`, {});

    expect(joinRes.status).toBe(400);
  });
});

// ============================================
// 404 Handling
// ============================================

describe("404 Handling", () => {
  it("returns 404 for unknown API routes", async () => {
    const res = await request("/api/nonexistent");
    expect(res.status).toBe(404);
  });
});
