/**
 * GameClient - WebSocket client for server-authoritative chess games
 * 
 * Handles:
 * - WebSocket connection to Durable Object
 * - Reconnection on disconnect
 * - State synchronization
 * - Move submission
 */

export type GameStatus = 'active' | 'checkmate' | 'stalemate' | 'resigned' | 'draw';
export type PlayerColor = 'white' | 'black';
export type GameMode = 'vs-ai' | 'vs-player';

export interface GameState {
  gameId: string;
  gameMode?: GameMode;
  fen: string;
  playerColor: PlayerColor;
  status: GameStatus;
  moveHistory: string[];
  turn: 'w' | 'b';
  isCheck: boolean;
  lastMove?: { from: string; to: string };
  waitingForOpponent?: boolean;
}

export interface MoveResult {
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

type MessageHandler = (data: unknown) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private playerToken: string | null = null;
  private gameMode: GameMode = 'vs-ai';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private pendingMoveResolve: ((result: MoveResult) => void) | null = null;
  private pendingMoveReject: ((error: Error) => void) | null = null;
  private pendingMoveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isMovePending: boolean = false;

  /**
   * Clear pending move state
   */
  private clearPendingMove(): void {
    if (this.pendingMoveTimeoutId) {
      clearTimeout(this.pendingMoveTimeoutId);
      this.pendingMoveTimeoutId = null;
    }
    this.pendingMoveResolve = null;
    this.pendingMoveReject = null;
    this.isMovePending = false;
  }

  /**
   * Create a new game on the server
   */
  async createGame(playerColor: PlayerColor, aiElo: number, mode: GameMode = 'vs-ai'): Promise<{ gameId: string; gameState: GameState; playerToken?: string }> {
    this.gameMode = mode;

    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_color: playerColor, ai_elo: aiElo, mode }),
    });

    if (!response.ok) {
      throw new Error('Failed to create game');
    }

    const data = await response.json() as { id: string; player_token?: string; gameState?: GameState };
    this.gameId = data.id;
    this.playerToken = data.player_token || null;

    // Connect WebSocket (with token for player identification)
    await this.connect(data.id);

    return {
      gameId: data.id,
      playerToken: data.player_token,
      gameState: data.gameState || {
        gameId: data.id,
        gameMode: mode,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        playerColor,
        status: 'active',
        moveHistory: [],
        turn: 'w',
        isCheck: false,
      },
    };
  }

  /**
   * Join an existing two-player game
   */
  async joinGame(gameId: string): Promise<{ playerColor: PlayerColor; gameState: GameState }> {
    this.gameMode = 'vs-player';

    const response = await fetch(`/api/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json() as { error?: string };
      throw new Error(err.error || 'Failed to join game');
    }

    const data = await response.json() as { id: string; player_token: string; playerColor: PlayerColor; gameState: GameState };
    this.gameId = data.id;
    this.playerToken = data.player_token;

    // Connect WebSocket with token
    await this.connect(data.id);

    return {
      playerColor: data.playerColor,
      gameState: data.gameState,
    };
  }

  /**
   * Reconnect to an existing game
   */
  async reconnectToGame(gameId: string): Promise<GameState> {
    this.gameId = gameId;

    // First, get current state via REST
    const response = await fetch(`/api/games/${gameId}`);
    if (!response.ok) {
      throw new Error('Game not found');
    }

    const state = await response.json() as GameState;

    // Then connect WebSocket
    await this.connect(gameId);

    return state;
  }

  /**
   * Connect WebSocket to game
   */
  private async connect(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/api/games/${gameId}/ws`;
      if (this.playerToken) {
        wsUrl += `?token=${encodeURIComponent(this.playerToken)}`;
      }

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as { type: string; [key: string]: unknown };

      // Handle move result for pending promise
      if (message.type === 'move_result' || message.type === 'error') {
        const resolve = this.pendingMoveResolve;
        const reject = this.pendingMoveReject;
        
        // Clear pending state BEFORE resolving to prevent race conditions
        this.clearPendingMove();
        
        if (resolve && message.type === 'move_result') {
          resolve(message as unknown as MoveResult);
        } else if (reject && message.type === 'error') {
          const errorMsg = (message as unknown as { message: string }).message || 'Unknown error';
          reject(new Error(errorMsg));
        }
      }

      // Dispatch to registered handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Also dispatch to 'all' handlers
      const allHandlers = this.messageHandlers.get('all');
      if (allHandlers) {
        allHandlers.forEach(handler => handler(message));
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(): void {
    // Reject any pending move promises immediately so UI doesn't hang
    const reject = this.pendingMoveReject;
    this.clearPendingMove();
    
    if (reject) {
      reject(new Error('Connection lost'));
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts && this.gameId) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        if (this.gameId) {
          this.connect(this.gameId).catch(console.error);
        }
      }, delay);
    } else {
      this.emit('connection_lost', {});
    }
  }

  /**
   * Send message through WebSocket
   */
  private send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  /**
   * Make a move
   */
  async makeMove(from: string, to: string, promotion?: string): Promise<MoveResult> {
    // Guard against concurrent move requests
    if (this.isMovePending) {
      throw new Error('Move already in progress');
    }

    // Try WebSocket first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this.isMovePending = true;
        this.pendingMoveResolve = resolve;
        this.pendingMoveReject = reject;

        this.send({
          type: 'move',
          from,
          to,
          promotion,
          ...(this.playerToken ? { playerToken: this.playerToken } : {}),
        });

        // Timeout after 10 seconds
        this.pendingMoveTimeoutId = setTimeout(() => {
          if (this.pendingMoveResolve) {
            this.clearPendingMove();
            reject(new Error('Move timeout'));
          }
        }, 10000);
      });
    }

    // Fall back to REST
    const response = await fetch(`/api/games/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, promotion, player_token: this.playerToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to make move');
    }

    return response.json() as Promise<MoveResult>;
  }

  /**
   * Submit AI move (client-computed)
   */
  async submitAIMove(move: string, thinkingTime?: number, evaluation?: number | string): Promise<MoveResult> {
    // Guard against concurrent move requests
    if (this.isMovePending) {
      throw new Error('Move already in progress');
    }

    // Try WebSocket first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this.isMovePending = true;
        this.pendingMoveResolve = resolve;
        this.pendingMoveReject = reject;

        this.send({
          type: 'ai_move',
          move,
          thinkingTime,
          evaluation,
        });

        this.pendingMoveTimeoutId = setTimeout(() => {
          if (this.pendingMoveResolve) {
            this.clearPendingMove();
            reject(new Error('AI move timeout'));
          }
        }, 10000);
      });
    }

    // Fall back to REST
    const response = await fetch(`/api/games/${this.gameId}/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, thinkingTime, evaluation }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit AI move');
    }

    return response.json() as Promise<MoveResult>;
  }

  /**
   * Resign the game
   */
  async resign(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'resign', ...(this.playerToken ? { playerToken: this.playerToken } : {}) });
      return;
    }

    await fetch(`/api/games/${this.gameId}/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerToken: this.playerToken }),
    });
  }

  /**
   * Request current game state
   */
  requestState(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'get_state' });
    }
  }

  /**
   * Register message handler
   */
  on(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }

  /**
   * Remove message handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(type: string, data: unknown): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Get current game ID
   */
  getGameId(): string | null {
    return this.gameId;
  }

  /**
   * Get current game mode
   */
  getGameMode(): GameMode {
    return this.gameMode;
  }

  /**
   * Get player token (for two-player games)
   */
  getPlayerToken(): string | null {
    return this.playerToken;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.gameId = null;
    this.reconnectAttempts = 0;
  }
}
