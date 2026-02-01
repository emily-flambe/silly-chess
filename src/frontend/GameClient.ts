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

export interface GameState {
  gameId: string;
  fen: string;
  playerColor: PlayerColor;
  status: GameStatus;
  moveHistory: string[];
  turn: 'w' | 'b';
  isCheck: boolean;
  lastMove?: { from: string; to: string };
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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private pendingMoveResolve: ((result: MoveResult) => void) | null = null;
  private pendingMoveReject: ((error: Error) => void) | null = null;

  /**
   * Create a new game on the server
   */
  async createGame(playerColor: PlayerColor, aiElo: number): Promise<{ gameId: string; gameState: GameState }> {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_color: playerColor, ai_elo: aiElo }),
    });

    if (!response.ok) {
      throw new Error('Failed to create game');
    }

    const data = await response.json() as { id: string; gameState?: GameState };
    this.gameId = data.id;

    // Connect WebSocket
    await this.connect(data.id);

    return {
      gameId: data.id,
      gameState: data.gameState || {
        gameId: data.id,
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
      const wsUrl = `${protocol}//${window.location.host}/api/games/${gameId}/ws`;

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
        if (this.pendingMoveResolve && message.type === 'move_result') {
          this.pendingMoveResolve(message as unknown as MoveResult);
          this.pendingMoveResolve = null;
          this.pendingMoveReject = null;
        } else if (this.pendingMoveReject && message.type === 'error') {
          const errorMsg = (message as unknown as { message: string }).message || 'Unknown error';
          this.pendingMoveReject(new Error(errorMsg));
          this.pendingMoveResolve = null;
          this.pendingMoveReject = null;
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
    // Try WebSocket first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this.pendingMoveResolve = resolve;
        this.pendingMoveReject = reject;

        this.send({
          type: 'move',
          from,
          to,
          promotion,
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.pendingMoveResolve) {
            this.pendingMoveReject = null;
            this.pendingMoveResolve = null;
            reject(new Error('Move timeout'));
          }
        }, 10000);
      });
    }

    // Fall back to REST
    const response = await fetch(`/api/games/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, promotion }),
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
    // Try WebSocket first
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this.pendingMoveResolve = resolve;
        this.pendingMoveReject = reject;

        this.send({
          type: 'ai_move',
          move,
          thinkingTime,
          evaluation,
        });

        setTimeout(() => {
          if (this.pendingMoveResolve) {
            this.pendingMoveReject = null;
            this.pendingMoveResolve = null;
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
      this.send({ type: 'resign' });
      return;
    }

    await fetch(`/api/games/${this.gameId}/resign`, {
      method: 'POST',
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
