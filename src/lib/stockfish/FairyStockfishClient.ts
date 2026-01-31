/**
 * Fairy-Stockfish Client
 *
 * WASM-based chess engine supporting 50+ variants.
 * Runs entirely in the browser via Web Worker.
 * Uses blob URL approach for reliable cross-browser loading.
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
  private pendingReject: ((error: Error) => void) | null = null;

  /**
   * Initialize the Stockfish WASM engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load stockfish-lite-single.js directly as a Worker (it's self-contained)
    // This version doesn't require SharedArrayBuffer
    // Use original filename - the JS automatically looks for matching .wasm
    const workerUrl = '/wasm/stockfish-17.1-lite-single-03e3232.js';

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(workerUrl);

        let uciOk = false;
        let readyOk = false;

        const initHandler = (event: MessageEvent) => {
          const message = String(event.data);

          // Handle multi-line responses
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.includes('uciok')) {
              uciOk = true;
              this.sendCommand('isready');
            } else if (line.includes('readyok')) {
              readyOk = true;
            }
          }

          if (uciOk && readyOk) {
            this.worker?.removeEventListener('message', initHandler);
            this.isInitialized = true;
            this.setupMessageHandler();

            // Set default Elo
            this.setElo(this.currentElo).then(() => {
              resolve();
            }).catch(reject);
          }
        };

        this.worker.addEventListener('message', initHandler);
        this.worker.addEventListener('error', (error) => {
          reject(new Error(`Stockfish worker failed to initialize: ${error.message}`));
        });

        // Start UCI initialization
        this.sendCommand('uci');

        // Timeout after 15 seconds
        setTimeout(() => {
          if (!this.isInitialized) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 15000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup persistent message handler for bestmove responses
   */
  private setupMessageHandler(): void {
    if (!this.worker) return;

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const message = String(event.data);

      if (message.startsWith('bestmove')) {
        const parts = message.split(' ');
        const move = parts[1];
        if (this.pendingResolve && move && move !== '(none)') {
          this.pendingResolve(move);
          this.pendingResolve = null;
          this.pendingReject = null;
        } else if (this.pendingReject) {
          this.pendingReject(new Error('No legal move found'));
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      }
    });
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
   * At max Elo (3000), disables strength limiting for full power
   */
  async setElo(elo: number): Promise<void> {
    this.currentElo = Math.max(800, Math.min(3000, elo));

    // At max difficulty, disable strength limiting for full engine power
    if (this.currentElo >= 3000) {
      this.sendCommand('setoption name UCI_LimitStrength value false');
    } else {
      // UCI_LimitStrength and UCI_Elo are standard UCI options
      this.sendCommand('setoption name UCI_LimitStrength value true');
      this.sendCommand(`setoption name UCI_Elo value ${this.currentElo}`);
    }
    this.sendCommand('isready');
    await this.waitForReady();
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
   * Get search depth for move calculation
   * Uses consistent depth - UCI_LimitStrength handles difficulty scaling
   */
  private getDepthForElo(): number {
    // Use a reasonable depth for all levels
    // UCI_LimitStrength + UCI_Elo handle the actual difficulty
    // Higher depth just means better move quality at each Elo level
    return 20;
  }

  /**
   * Wait for engine to be ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve();
        return;
      }

      const readyHandler = (event: MessageEvent) => {
        if (String(event.data).includes('readyok')) {
          this.worker?.removeEventListener('message', readyHandler);
          resolve();
        }
      };

      this.worker.addEventListener('message', readyHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.worker?.removeEventListener('message', readyHandler);
        resolve();
      }, 5000);
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
      this.pendingReject = reject;

      // Set position and search
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingResolve) {
          this.pendingResolve = null;
          this.pendingReject = null;
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
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      let evaluation: number | string = 0;
      let bestMove = '';
      let actualDepth = depth;

      const analyzeHandler = (event: MessageEvent) => {
        const msg = String(event.data);

        // Parse info lines for evaluation
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
          this.worker?.removeEventListener('message', analyzeHandler);
          bestMove = msg.split(' ')[1] || '';

          const evalNum = typeof evaluation === 'number' ? evaluation : 0;
          const winChance = 50 + (evalNum / 10); // Rough approximation

          resolve({
            bestMove,
            evaluation,
            depth: actualDepth,
            winChance: Math.max(0, Math.min(100, winChance)),
          });
        }
      };

      this.worker.addEventListener('message', analyzeHandler);

      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      setTimeout(() => {
        this.worker?.removeEventListener('message', analyzeHandler);
        reject(new Error('Analysis timeout'));
      }, 30000);
    });
  }

  /**
   * Stop current analysis and wait for engine to be ready
   */
  async stop(): Promise<void> {
    this.sendCommand('stop');
    this.sendCommand('isready');
    await this.waitForReady();
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
