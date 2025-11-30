/**
 * Fairy-Stockfish Client
 *
 * WASM-based chess engine supporting 50+ variants.
 * Runs entirely in the browser via Web Worker.
 */

export interface FairyStockfishOptions {
  depth?: number;
  variant?: string;
}

export class FairyStockfishClient {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private currentElo: number = 1500;
  private currentVariant: string = 'chess';
  private pendingResolve: ((value: string) => void) | null = null;
  private messageBuffer: string[] = [];

  /**
   * Initialize the Stockfish WASM engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      try {
        // Create worker from the fairy-stockfish package
        this.worker = new Worker(
          new URL('fairy-stockfish-nnue.wasm/stockfish.js', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e) => {
          const message = e.data;
          this.handleMessage(message);
        };

        this.worker.onerror = (e) => {
          console.error('Stockfish worker error:', e);
          reject(e);
        };

        // Wait for engine to be ready
        const readyCheck = (msg: string) => {
          if (msg.includes('Stockfish') || msg.includes('readyok')) {
            this.isInitialized = true;
            // Set initial UCI mode
            this.sendCommand('uci');
            setTimeout(() => {
              this.sendCommand('isready');
              resolve();
            }, 100);
          }
        };

        const originalHandler = this.handleMessage.bind(this);
        this.handleMessage = (msg: string) => {
          readyCheck(msg);
          originalHandler(msg);
        };

        // Trigger initialization
        this.sendCommand('uci');
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the worker
   */
  private handleMessage(message: string): void {
    this.messageBuffer.push(message);

    // Check for bestmove response
    if (message.startsWith('bestmove')) {
      const parts = message.split(' ');
      const move = parts[1];
      if (this.pendingResolve && move) {
        this.pendingResolve(move);
        this.pendingResolve = null;
      }
    }
  }

  /**
   * Send a UCI command to the engine
   */
  private sendCommand(command: string): void {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  /**
   * Set the chess variant
   */
  async setVariant(variant: string): Promise<void> {
    this.currentVariant = variant;
    this.sendCommand(`setoption name UCI_Variant value ${variant}`);
    this.sendCommand('isready');
    await this.waitForReady();
  }

  /**
   * Get current variant
   */
  getVariant(): string {
    return this.currentVariant;
  }

  /**
   * Set Elo rating for AI difficulty
   */
  async setElo(elo: number): Promise<void> {
    this.currentElo = Math.max(800, Math.min(3000, elo));

    // UCI_LimitStrength and UCI_Elo are standard UCI options
    this.sendCommand('setoption name UCI_LimitStrength value true');
    this.sendCommand(`setoption name UCI_Elo value ${this.currentElo}`);
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
    return this.isInitialized;
  }

  /**
   * Map Elo rating to analysis depth (fallback if UCI_Elo not supported)
   */
  private getDepthForElo(): number {
    if (this.currentElo <= 1000) return 4;
    if (this.currentElo <= 1200) return 6;
    if (this.currentElo <= 1400) return 8;
    if (this.currentElo <= 1600) return 10;
    if (this.currentElo <= 1800) return 12;
    if (this.currentElo <= 2000) return 14;
    if (this.currentElo <= 2400) return 16;
    return 18;
  }

  /**
   * Wait for engine to be ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        const lastMessages = this.messageBuffer.slice(-5);
        if (lastMessages.some(m => m.includes('readyok'))) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      this.sendCommand('isready');
      setTimeout(checkReady, 50);
    });
  }

  /**
   * Get best move for a position
   */
  async getBestMove(fen: string, options?: FairyStockfishOptions): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Stockfish not initialized');
    }

    const depth = options?.depth ?? this.getDepthForElo();

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.messageBuffer = [];

      // Set position and search
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          reject(new Error('Stockfish timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Analyze position and return evaluation
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

    return new Promise((resolve, reject) => {
      this.messageBuffer = [];
      let evaluation: number | string = 0;
      let bestMove = '';
      let actualDepth = depth;

      const parseMessages = () => {
        // Parse info lines for evaluation
        for (const msg of this.messageBuffer) {
          if (msg.startsWith('info') && msg.includes('score')) {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            const mateMatch = msg.match(/score mate (-?\d+)/);
            const depthMatch = msg.match(/depth (\d+)/);

            if (mateMatch) {
              const mateIn = parseInt(mateMatch[1], 10);
              evaluation = `M${Math.abs(mateIn)}`;
              if (mateIn < 0) evaluation = `-${evaluation}`;
            } else if (cpMatch) {
              evaluation = parseInt(cpMatch[1], 10);
            }

            if (depthMatch) {
              actualDepth = parseInt(depthMatch[1], 10);
            }
          }

          if (msg.startsWith('bestmove')) {
            bestMove = msg.split(' ')[1];
          }
        }
      };

      this.pendingResolve = (move) => {
        parseMessages();
        const evalNum = typeof evaluation === 'number' ? evaluation : 0;
        const winChance = 50 + (evalNum / 10); // Rough approximation

        resolve({
          bestMove: bestMove || move,
          evaluation,
          depth: actualDepth,
          winChance: Math.max(0, Math.min(100, winChance)),
        });
      };

      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          reject(new Error('Analysis timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Stop current analysis
   */
  async stop(): Promise<void> {
    this.sendCommand('stop');
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.sendCommand('quit');
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get list of supported variants
   */
  static getSupportedVariants(): string[] {
    return [
      'chess',           // Standard chess
      'atomic',          // Pieces explode on capture
      'antichess',       // Lose all pieces to win
      'crazyhouse',      // Captured pieces can be dropped
      'horde',           // Asymmetric: pawns vs pieces
      'kingofthehill',   // Get king to center to win
      'racingkings',     // Race kings to 8th rank
      '3check',          // Give 3 checks to win
      'chess960',        // Fischer Random Chess
      // More variants available in ffish
    ];
  }
}
