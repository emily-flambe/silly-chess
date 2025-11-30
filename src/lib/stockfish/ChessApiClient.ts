/**
 * Chess API Client
 *
 * Simple REST API client for chess-api.com which provides Stockfish analysis.
 * Much simpler than running Stockfish in a Web Worker.
 */

export interface ChessApiResponse {
  type: 'bestmove' | 'info' | 'error';
  move?: string;
  eval?: number;
  centipawns?: number;
  mate?: number | null;
  depth?: number;
  winChance?: number;
  text?: string;
  error?: string;
  continuationArr?: string[];
}

export interface ChessApiOptions {
  depth?: number;
  maxThinkingTime?: number;
}

export class ChessApiClient {
  private readonly apiUrl = 'https://chess-api.com/v1';
  private currentElo: number = 1500;

  /**
   * Initialize the client (no-op for API, but maintains interface compatibility)
   */
  async initialize(): Promise<void> {
    // No initialization needed for REST API
    return Promise.resolve();
  }

  /**
   * Set Elo rating for AI difficulty
   * Maps Elo to analysis depth (lower Elo = lower depth = weaker play)
   * @param elo Elo rating between 800 and 3000
   */
  async setElo(elo: number): Promise<void> {
    this.currentElo = Math.max(800, Math.min(3000, elo));
    return Promise.resolve();
  }

  /**
   * Get current Elo rating
   */
  getElo(): number {
    return this.currentElo;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return true; // Always ready since it's just HTTP calls
  }

  /**
   * Map Elo rating to analysis depth
   * Lower Elo = shallower search = weaker play
   */
  private getDepthForElo(): number {
    // Depth 4 = ~1000 Elo, Depth 12 = ~2350 Elo, Depth 18 = ~2750 Elo
    if (this.currentElo <= 1000) return 4;
    if (this.currentElo <= 1200) return 6;
    if (this.currentElo <= 1400) return 8;
    if (this.currentElo <= 1600) return 10;
    if (this.currentElo <= 1800) return 12;
    if (this.currentElo <= 2000) return 14;
    if (this.currentElo <= 2400) return 16;
    return 18; // Max depth for 2400+
  }

  /**
   * Get best move for a position
   * @param fen FEN string representing the position
   * @param options Optional parameters (depth, maxThinkingTime)
   */
  async getBestMove(
    fen: string,
    options?: ChessApiOptions
  ): Promise<string> {
    const depth = options?.depth ?? this.getDepthForElo();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen,
        depth,
        maxThinkingTime: options?.maxThinkingTime ?? 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chess API request failed: ${response.status}`);
    }

    const data: ChessApiResponse = await response.json();

    if (data.type === 'error') {
      throw new Error(data.error || 'Chess API error');
    }

    if (!data.move) {
      throw new Error('No move returned from Chess API');
    }

    return data.move;
  }

  /**
   * Analyze position and return evaluation
   * @param fen FEN string representing the position
   * @param options Optional parameters
   */
  async analyze(
    fen: string,
    options?: { depth?: number }
  ): Promise<{
    bestMove: string;
    evaluation: number | string;
    depth: number;
    winChance: number;
  }> {
    const depth = options?.depth ?? 12;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen,
        depth,
        maxThinkingTime: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chess API request failed: ${response.status}`);
    }

    const data: ChessApiResponse = await response.json();

    if (data.type === 'error') {
      throw new Error(data.error || 'Chess API error');
    }

    return {
      bestMove: data.move || '',
      evaluation: data.mate !== null && data.mate !== undefined
        ? `M${Math.abs(data.mate)}`
        : (data.centipawns ?? 0),
      depth: data.depth ?? depth,
      winChance: data.winChance ?? 50,
    };
  }

  /**
   * Stop current analysis (no-op for REST API)
   */
  async stop(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Terminate client (no-op for REST API)
   */
  terminate(): void {
    // Nothing to clean up
  }
}
