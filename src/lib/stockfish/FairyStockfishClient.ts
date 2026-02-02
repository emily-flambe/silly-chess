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
  private pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isOperationPending: boolean = false;

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
        const resolve = this.pendingResolve;
        const reject = this.pendingReject;
        
        // Clear pending state BEFORE resolving to prevent race conditions
        this.clearPending();
        
        if (resolve && move && move !== '(none)') {
          resolve(move);
        } else if (reject) {
          reject(new Error('No legal move found'));
        }
      }
    });
    
    // Handle worker errors during gameplay (not just initialization)
    this.worker.addEventListener('error', (error: ErrorEvent) => {
      console.error('Stockfish worker error:', error.message);
      const reject = this.pendingReject;
      
      // Clear pending state BEFORE rejecting
      this.clearPending();
      
      if (reject) {
        reject(new Error(`Stockfish worker error: ${error.message}`));
      }
      // Mark as not initialized to prevent further use
      this.isInitialized = false;
    });
  }

  /**
   * Clear all pending operation state
   */
  private clearPending(): void {
    if (this.pendingTimeoutId) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }
    this.pendingResolve = null;
    this.pendingReject = null;
    this.isOperationPending = false;
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
   * Uses moderate depth - UCI_LimitStrength handles difficulty scaling
   * Lower depth prevents WASM timeouts on complex positions
   */
  private getDepthForElo(): number {
    // Use moderate depth to prevent timeouts with WASM
    // UCI_LimitStrength + UCI_Elo handle the actual difficulty
    // Depth 12 is sufficient for good play while avoiding timeouts
    return 12;
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

    // Guard against concurrent calls - reject if operation already pending
    if (this.isOperationPending) {
      throw new Error('Operation already in progress');
    }

    const depth = options?.depth ?? this.getDepthForElo();

    return new Promise((resolve, reject) => {
      this.isOperationPending = true;
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      // Set position and search
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);

      // Timeout after 15 seconds (reduced from 30 for faster failure detection)
      this.pendingTimeoutId = setTimeout(() => {
        if (this.pendingResolve) {
          this.clearPending();
          reject(new Error('Stockfish timeout'));
        }
      }, 15000);
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
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.worker?.removeEventListener('message', analyzeHandler);
      };

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
          if (settled) return;
          settled = true;
          cleanup();
          
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

      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Analysis timeout'));
      }, 5000); // Reduced from 30s - evaluation is optional
    });
  }

  /**
   * Stop current analysis and wait for engine to be ready
   */
  async stop(): Promise<void> {
    // Clear any pending operations first
    const reject = this.pendingReject;
    this.clearPending();
    
    // Reject the pending promise so callers know it was cancelled
    if (reject) {
      reject(new Error('Operation cancelled'));
    }
    
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
