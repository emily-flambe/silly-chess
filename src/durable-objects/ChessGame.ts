/**
 * ChessGame Durable Object
 * 
 * Manages a single chess game session with:
 * - Persistent state across page refreshes
 * - WebSocket connection for real-time updates
 * - D1 logging for all moves
 * - Server-authoritative game state
 */

import { Chess } from 'chess.js';

// Game status types
export type GameStatus = 'active' | 'checkmate' | 'stalemate' | 'resigned' | 'draw';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type PlayerColor = 'white' | 'black';

// WebSocket message types
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface MoveMessage extends WSMessage {
  type: 'move';
  from: string;
  to: string;
  promotion?: string;
}

export interface AIMoveMessage extends WSMessage {
  type: 'ai_move';
  move: string;  // UCI format
  thinkingTime?: number;
  evaluation?: number | string;
}

export interface GameStateMessage extends WSMessage {
  type: 'game_state';
  gameId: string;
  gameMode: GameMode;
  fen: string;
  playerColor: PlayerColor;  // Your color (for this connection)
  players: Players;          // Who's playing what
  status: GameStatus;
  moveHistory: string[];
  turn: 'w' | 'b';
  isCheck: boolean;
  lastMove?: { from: string; to: string };
  waitingForOpponent?: boolean;  // True if vs-player and opponent hasn't joined
}

export interface ErrorMessage extends WSMessage {
  type: 'error';
  message: string;
}

export interface MoveResultMessage extends WSMessage {
  type: 'move_result';
  success: boolean;
  fen: string;
  san?: string;
  status: GameStatus;
  turn: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  lastMove?: { from: string; to: string };
}

// Game mode types
export type GameMode = 'vs-ai' | 'vs-player';

// Player tracking for two-player games
export interface Players {
  white: string | null;  // playerToken
  black: string | null;  // playerToken
}

// Stored game state
interface GameState {
  gameId: string;
  gameMode: GameMode;
  players: Players;
  playerColor: PlayerColor;  // Legacy: creator's color for vs-ai mode
  fen: string;
  moveHistory: string[];  // SAN notation
  uciHistory: string[];   // UCI notation for logging
  status: GameStatus;
  result: GameResult;
  aiElo: number;
  createdAt: number;
  updatedAt: number;
}

export class ChessGame {
  private state: DurableObjectState;
  private env: { DB: D1Database };
  private chess: Chess;
  private gameState: GameState | null = null;

  constructor(state: DurableObjectState, env: { DB: D1Database }) {
    this.state = state;
    this.env = env;
    this.chess = new Chess();
  }

  /**
   * Handle incoming HTTP requests (REST or WebSocket upgrade)
   */
  async fetch(request: Request): Promise<Response> {
    // Restore game state from storage if needed (after hibernation wake-up)
    if (!this.gameState) {
      this.gameState = await this.state.storage.get<GameState>('gameState') || null;
      if (this.gameState) {
        this.chess.load(this.gameState.fen);
      }
    }

    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST endpoints
    switch (request.method) {
      case 'POST':
        if (url.pathname.endsWith('/create')) {
          return this.handleCreateGame(request);
        }
        if (url.pathname.endsWith('/join')) {
          return this.handleJoinGame(request);
        }
        if (url.pathname.endsWith('/move')) {
          return this.handleMove(request);
        }
        if (url.pathname.endsWith('/resign')) {
          return this.handleResign();
        }
        if (url.pathname.endsWith('/ai-move')) {
          return this.handleAIMove(request);
        }
        break;
      case 'GET':
        return this.handleGetState();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket upgrade and connection
   */
  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection (hibernation API)
    this.state.acceptWebSocket(server);

    // Send current game state if game exists
    if (this.gameState) {
      this.sendToSocket(server, this.buildGameStateMessage());
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages (called by runtime)
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Restore game state from storage if needed (after hibernation wake-up)
    if (!this.gameState) {
      this.gameState = await this.state.storage.get<GameState>('gameState') || null;
      if (this.gameState) {
        this.chess.load(this.gameState.fen);
      }
    }

    try {
      const data = JSON.parse(message as string) as WSMessage;
      
      switch (data.type) {
        case 'move':
          await this.processMove(ws, data as MoveMessage);
          break;
        case 'ai_move':
          await this.processAIMove(ws, data as AIMoveMessage);
          break;
        case 'resign':
          await this.processResign();
          break;
        case 'get_state':
          this.sendToSocket(ws, this.buildGameStateMessage());
          break;
        default:
          this.sendToSocket(ws, { type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      this.sendToSocket(ws, { type: 'error', message: 'Invalid message format' });
    }
  }

  /**
   * Handle WebSocket open (called after hibernation wake-up)
   */
  async webSocketOpen(ws: WebSocket): Promise<void> {
    // Restore game state from storage if needed
    if (!this.gameState) {
      this.gameState = await this.state.storage.get<GameState>('gameState') || null;
      if (this.gameState) {
        this.chess.load(this.gameState.fen);
      }
    }
    // Send current game state to the reconnected client
    if (this.gameState) {
      this.sendToSocket(ws, this.buildGameStateMessage());
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    // No need to manage sessions manually with hibernation API
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  /**
   * Create a new game
   */
  private async handleCreateGame(request: Request): Promise<Response> {
    const body = await request.json() as { 
      gameId: string; 
      playerColor: PlayerColor;
      aiElo: number;
      userId?: string;
      gameMode?: GameMode;
      playerToken?: string;
    };

    const { gameId, playerColor, aiElo, userId, gameMode = 'vs-ai', playerToken } = body;

    // Initialize chess engine
    this.chess = new Chess();

    // Set up players based on game mode
    const players: Players = { white: null, black: null };
    if (gameMode === 'vs-player' && playerToken) {
      // Creator takes their chosen color
      players[playerColor] = playerToken;
    }

    // Create game state
    this.gameState = {
      gameId,
      gameMode,
      players,
      playerColor,
      fen: this.chess.fen(),
      moveHistory: [],
      uciHistory: [],
      status: 'active',
      result: '*',
      aiElo,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Persist to DO storage
    await this.state.storage.put('gameState', this.gameState);

    // Create D1 record
    await this.env.DB.prepare(`
      INSERT INTO games (id, user_id, pgn, result, ai_elo, player_color, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      gameId,
      userId || null,
      '',
      '*',
      aiElo,
      playerColor,
      'active',
      Math.floor(Date.now() / 1000)
    ).run();

    // Broadcast to all connected clients
    this.broadcast(this.buildGameStateMessage());

    return Response.json({ 
      success: true, 
      gameId,
      gameMode,
      playerColor,
      playerToken,
      gameState: this.gameState 
    });
  }

  /**
   * Join an existing two-player game
   */
  private async handleJoinGame(request: Request): Promise<Response> {
    const body = await request.json() as { 
      playerToken: string;
    };

    const { playerToken } = body;

    if (!this.gameState) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    if (this.gameState.gameMode !== 'vs-player') {
      return Response.json({ error: 'Cannot join AI game' }, { status: 400 });
    }

    // Check if game is full
    if (this.gameState.players.white && this.gameState.players.black) {
      // Check if this player is already in the game (reconnect)
      if (this.gameState.players.white === playerToken) {
        return Response.json({
          success: true,
          gameId: this.gameState.gameId,
          playerColor: 'white' as PlayerColor,
          playerToken,
          gameState: this.gameState
        });
      }
      if (this.gameState.players.black === playerToken) {
        return Response.json({
          success: true,
          gameId: this.gameState.gameId,
          playerColor: 'black' as PlayerColor,
          playerToken,
          gameState: this.gameState
        });
      }
      return Response.json({ error: 'Game is full' }, { status: 400 });
    }

    // Assign the remaining color
    let assignedColor: PlayerColor;
    if (!this.gameState.players.white) {
      this.gameState.players.white = playerToken;
      assignedColor = 'white';
    } else {
      this.gameState.players.black = playerToken;
      assignedColor = 'black';
    }

    this.gameState.updatedAt = Date.now();
    await this.state.storage.put('gameState', this.gameState);

    // Broadcast updated state (opponent joined!)
    this.broadcast(this.buildGameStateMessage());

    return Response.json({
      success: true,
      gameId: this.gameState.gameId,
      playerColor: assignedColor,
      playerToken,
      gameState: this.gameState
    });
  }

  /**
   * Handle player move via REST
   */
  private async handleMove(request: Request): Promise<Response> {
    const body = await request.json() as MoveMessage & { playerToken?: string };
    const result = await this.processPlayerMove(body.from, body.to, body.promotion, body.playerToken);
    
    // Broadcast to all WebSocket clients for real-time updates
    if (result.type === 'move_result' && result.success) {
      this.broadcast(result);
    }
    
    return Response.json(result);
  }

  /**
   * Handle AI move via REST (client sends the AI's computed move)
   */
  private async handleAIMove(request: Request): Promise<Response> {
    const body = await request.json() as AIMoveMessage;
    const result = await this.processAIMoveInternal(body.move, body.thinkingTime, body.evaluation);
    
    // Broadcast to all WebSocket clients for real-time updates
    if (result.type === 'move_result' && result.success) {
      this.broadcast(result);
    }
    
    return Response.json(result);
  }

  /**
   * Handle resign via REST
   */
  private async handleResign(): Promise<Response> {
    await this.processResign();
    return Response.json({ success: true, gameState: this.gameState });
  }

  /**
   * Get current game state
   */
  private async handleGetState(): Promise<Response> {
    // Load from storage if not in memory
    if (!this.gameState) {
      this.gameState = await this.state.storage.get<GameState>('gameState') || null;
      if (this.gameState) {
        this.chess.load(this.gameState.fen);
      }
    }

    if (!this.gameState) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    return Response.json(this.gameState);
  }

  /**
   * Process player move from WebSocket
   */
  private async processMove(ws: WebSocket, data: MoveMessage): Promise<void> {
    const result = await this.processPlayerMove(data.from, data.to, data.promotion);
    // ALWAYS respond to caller first to ensure they get the response even if broadcast fails
    this.sendToSocket(ws, result);
    // Then broadcast to other clients (they may have disconnected, that's ok)
    this.broadcastExcept(ws, result);
  }

  /**
   * Process AI move from WebSocket
   */
  private async processAIMove(ws: WebSocket, data: AIMoveMessage): Promise<void> {
    const result = await this.processAIMoveInternal(data.move, data.thinkingTime, data.evaluation);
    // ALWAYS respond to caller first to ensure they get the response even if broadcast fails
    this.sendToSocket(ws, result);
    // Then broadcast to other clients (they may have disconnected, that's ok)
    this.broadcastExcept(ws, result);
  }

  /**
   * Internal player move processing
   */
  private async processPlayerMove(from: string, to: string, promotion?: string, playerToken?: string): Promise<MoveResultMessage | ErrorMessage> {
    if (!this.gameState || this.gameState.status !== 'active') {
      return { type: 'error', message: 'Game not active' };
    }

    // Load position if needed
    if (this.chess.fen() !== this.gameState.fen) {
      this.chess.load(this.gameState.fen);
    }

    const currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';

    // Turn validation based on game mode
    if (this.gameState.gameMode === 'vs-player') {
      // Two-player mode: validate by playerToken
      if (!playerToken) {
        return { type: 'error', message: 'Player token required for two-player games' };
      }

      // Check that both players have joined
      if (!this.gameState.players.white || !this.gameState.players.black) {
        return { type: 'error', message: 'Waiting for opponent to join' };
      }

      // Verify this player is allowed to move
      const expectedToken = this.gameState.players[currentTurn];
      if (playerToken !== expectedToken) {
        return { type: 'error', message: 'Not your turn' };
      }
    } else {
      // vs-ai mode: legacy behavior - player can only move their color
      if (currentTurn !== this.gameState.playerColor) {
        return { type: 'error', message: 'Not your turn' };
      }
    }

    // Try to make the move
    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) {
        return { type: 'error', message: 'Invalid move' };
      }

      // Update game state
      this.gameState.fen = this.chess.fen();
      this.gameState.moveHistory.push(move.san);
      this.gameState.uciHistory.push(from + to + (promotion || ''));
      this.gameState.updatedAt = Date.now();

      // Check game end conditions
      this.updateGameStatus();

      // Persist state
      await this.state.storage.put('gameState', this.gameState);

      // Log move to D1
      await this.logMove(move.san, from + to + (promotion || ''), 'player');

      // Update D1 game record
      await this.updateD1Game();

      return this.buildMoveResult(move);
    } catch (error) {
      console.error('Move error:', error);
      return { type: 'error', message: 'Invalid move' };
    }
  }

  /**
   * Internal AI move processing
   */
  private async processAIMoveInternal(
    uciMove: string, 
    thinkingTime?: number,
    evaluation?: number | string
  ): Promise<MoveResultMessage | ErrorMessage> {
    if (!this.gameState || this.gameState.status !== 'active') {
      return { type: 'error', message: 'Game not active' };
    }

    // Load position if needed
    if (this.chess.fen() !== this.gameState.fen) {
      this.chess.load(this.gameState.fen);
    }

    // Parse UCI move
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    // Make the move
    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) {
        return { type: 'error', message: 'Invalid AI move' };
      }

      // Update game state
      this.gameState.fen = this.chess.fen();
      this.gameState.moveHistory.push(move.san);
      this.gameState.uciHistory.push(uciMove);
      this.gameState.updatedAt = Date.now();

      // Check game end conditions
      this.updateGameStatus();

      // Persist state
      await this.state.storage.put('gameState', this.gameState);

      // Log move to D1 with evaluation
      await this.logMove(move.san, uciMove, 'ai', thinkingTime, evaluation);

      // Update D1 game record
      await this.updateD1Game();

      return this.buildMoveResult(move);
    } catch (error) {
      console.error('AI move error:', error);
      return { type: 'error', message: 'Invalid AI move' };
    }
  }

  /**
   * Process resignation
   */
  private async processResign(): Promise<void> {
    if (!this.gameState) return;

    this.gameState.status = 'resigned';
    this.gameState.result = this.gameState.playerColor === 'white' ? '0-1' : '1-0';
    this.gameState.updatedAt = Date.now();

    await this.state.storage.put('gameState', this.gameState);
    await this.updateD1Game();

    this.broadcast(this.buildGameStateMessage());
  }

  /**
   * Update game status based on position
   */
  private updateGameStatus(): void {
    if (!this.gameState) return;

    if (this.chess.isCheckmate()) {
      this.gameState.status = 'checkmate';
      // Winner is the side that just moved
      const winner = this.chess.turn() === 'w' ? 'black' : 'white';
      this.gameState.result = winner === 'white' ? '1-0' : '0-1';
    } else if (this.chess.isStalemate()) {
      this.gameState.status = 'stalemate';
      this.gameState.result = '1/2-1/2';
    } else if (this.chess.isDraw()) {
      this.gameState.status = 'draw';
      this.gameState.result = '1/2-1/2';
    }
  }

  /**
   * Log move to D1 database
   */
  private async logMove(
    san: string, 
    uci: string, 
    playedBy: 'player' | 'ai',
    thinkingTime?: number,
    evaluation?: number | string
  ): Promise<void> {
    if (!this.gameState) return;

    const moveNumber = Math.ceil(this.gameState.moveHistory.length / 2);
    
    let evalCp: number | null = null;
    let evalMate: number | null = null;
    
    if (evaluation !== undefined) {
      if (typeof evaluation === 'string' && evaluation.includes('M')) {
        const match = evaluation.match(/-?M(\d+)/);
        if (match) {
          evalMate = parseInt(match[1], 10);
          if (evaluation.startsWith('-')) evalMate = -evalMate;
        }
      } else if (typeof evaluation === 'number') {
        evalCp = evaluation;
      }
    }

    try {
      await this.env.DB.prepare(`
        INSERT INTO moves (game_id, move_number, move_uci, move_san, fen_after, eval_cp, eval_mate, thinking_time_ms, played_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        this.gameState.gameId,
        moveNumber,
        uci,
        san,
        this.gameState.fen,
        evalCp,
        evalMate,
        thinkingTime || null,
        playedBy,
        Math.floor(Date.now() / 1000)
      ).run();
    } catch (error) {
      console.error('Failed to log move:', error);
    }
  }

  /**
   * Update D1 game record
   */
  private async updateD1Game(): Promise<void> {
    if (!this.gameState) return;

    // Generate PGN from move history
    const pgn = this.chess.pgn();

    try {
      const updates: string[] = ['pgn = ?', 'result = ?', 'status = ?'];
      const values: (string | number | null)[] = [pgn, this.gameState.result, this.gameState.status];

      if (this.gameState.status !== 'active') {
        updates.push('ended_at = ?');
        values.push(Math.floor(Date.now() / 1000));
      }

      values.push(this.gameState.gameId);

      await this.env.DB.prepare(`
        UPDATE games SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run();
    } catch (error) {
      console.error('Failed to update D1 game:', error);
    }
  }

  /**
   * Build game state message
   * @param forPlayerToken - If provided, sets playerColor to this player's color
   */
  private buildGameStateMessage(forPlayerToken?: string): GameStateMessage {
    if (!this.gameState) {
      throw new Error('No game state');
    }

    const lastMove = this.gameState.uciHistory.length > 0 
      ? {
          from: this.gameState.uciHistory.at(-1)!.substring(0, 2),
          to: this.gameState.uciHistory.at(-1)!.substring(2, 4),
        }
      : undefined;

    // Determine the player's color for this message
    let playerColor = this.gameState.playerColor;
    if (this.gameState.gameMode === 'vs-player' && forPlayerToken) {
      if (this.gameState.players.white === forPlayerToken) {
        playerColor = 'white';
      } else if (this.gameState.players.black === forPlayerToken) {
        playerColor = 'black';
      }
    }

    // Check if waiting for opponent in two-player mode
    const waitingForOpponent = this.gameState.gameMode === 'vs-player' && 
      (!this.gameState.players.white || !this.gameState.players.black);

    return {
      type: 'game_state',
      gameId: this.gameState.gameId,
      gameMode: this.gameState.gameMode,
      fen: this.gameState.fen,
      playerColor,
      players: this.gameState.players,
      status: this.gameState.status,
      moveHistory: this.gameState.moveHistory,
      turn: this.chess.turn(),
      isCheck: this.chess.isCheck(),
      lastMove,
      waitingForOpponent,
    };
  }

  /**
   * Build move result message
   */
  private buildMoveResult(move: { san: string; from: string; to: string }): MoveResultMessage {
    return {
      type: 'move_result',
      success: true,
      fen: this.chess.fen(),
      san: move.san,
      status: this.gameState?.status || 'active',
      turn: this.chess.turn(),
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      lastMove: { from: move.from, to: move.to },
    };
  }

  /**
   * Send message to a specific socket
   */
  private sendToSocket(ws: WebSocket, message: WSMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send to socket:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    // Use getWebSockets() for hibernation compatibility
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(data);
      } catch (error) {
        // Socket will be cleaned up by webSocketClose/webSocketError
      }
    }
  }

  /**
   * Broadcast message to all connected clients except one
   */
  private broadcastExcept(excludeWs: WebSocket, message: WSMessage): void {
    const data = JSON.stringify(message);
    // Use getWebSockets() for hibernation compatibility
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      if (ws === excludeWs) continue;
      try {
        ws.send(data);
      } catch (error) {
        // Socket will be cleaned up by webSocketClose/webSocketError
      }
    }
  }
}
