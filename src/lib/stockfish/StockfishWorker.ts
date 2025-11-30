/**
 * Stockfish Web Worker Wrapper
 *
 * Provides UCI protocol interface to Stockfish chess engine running in a Web Worker.
 * Supports configurable Elo rating (800-3000) for difficulty adjustment.
 */

import type { StockfishOptions, StockfishAnalysis } from '../../types';

interface UCIMessage {
  type: 'uci' | 'isready' | 'position' | 'go' | 'stop' | 'setoption';
  value?: string;
}

interface UCIResponse {
  type: 'bestmove' | 'info' | 'readyok' | 'uciok';
  data: string;
}

export class StockfishWorker {
  private worker: Worker | null = null;
  private currentElo: number = 1500;
  private messageQueue: Array<(value: any) => void> = [];
  private isInitialized = false;
  private pendingAnalysis = false;

  /**
   * Initialize Stockfish Web Worker and configure UCI protocol
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Fetch stockfish.js and create a blob URL to avoid CORS issues
    const stockfishUrl = 'https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish-nnue-16-single.js';

    let stockfishCode: string;
    try {
      const response = await fetch(stockfishUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Stockfish: ${response.status}`);
      }
      stockfishCode = await response.text();
    } catch (fetchError) {
      throw new Error(`Could not load Stockfish engine: ${fetchError}`);
    }

    const blob = new Blob([stockfishCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(blobUrl);
        URL.revokeObjectURL(blobUrl); // Clean up blob URL

        let uciOk = false;
        let readyOk = false;

        const initHandler = (event: MessageEvent) => {
          const message = event.data;

          if (message.includes('uciok')) {
            uciOk = true;
            // Send isready after receiving uciok
            this.sendCommand('isready');
          } else if (message.includes('readyok')) {
            readyOk = true;
          }

          // Both confirmations received
          if (uciOk && readyOk) {
            this.worker?.removeEventListener('message', initHandler);
            this.isInitialized = true;

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

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isInitialized) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set Elo rating for AI difficulty
   * @param elo Elo rating between 800 and 3000
   */
  async setElo(elo: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Stockfish not initialized. Call initialize() first.');
    }

    // Clamp Elo to valid range
    const clampedElo = Math.max(800, Math.min(3000, elo));
    this.currentElo = clampedElo;

    return new Promise((resolve) => {
      // Enable Elo limiting
      this.sendCommand('setoption name UCI_LimitStrength value true');

      // Set Elo value
      this.sendCommand(`setoption name UCI_Elo value ${clampedElo}`);

      // Wait for commands to process
      this.sendCommand('isready');

      const readyHandler = (event: MessageEvent) => {
        if (event.data.includes('readyok')) {
          this.worker?.removeEventListener('message', readyHandler);
          resolve();
        }
      };

      this.worker?.addEventListener('message', readyHandler);
    });
  }

  /**
   * Get best move for a position
   * @param fen FEN string representing the position
   * @param options Optional search parameters (movetime in ms, depth in plies)
   */
  async getBestMove(
    fen: string,
    options?: { movetime?: number; depth?: number }
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Stockfish not initialized. Call initialize() first.');
    }

    if (this.pendingAnalysis) {
      await this.stop();
    }

    this.pendingAnalysis = true;

    return new Promise((resolve, reject) => {
      let bestMove = '';

      const moveHandler = (event: MessageEvent) => {
        const message = event.data;

        if (message.startsWith('bestmove')) {
          this.worker?.removeEventListener('message', moveHandler);
          this.pendingAnalysis = false;

          // Parse: "bestmove e2e4 ponder e7e5"
          const parts = message.split(' ');
          bestMove = parts[1];

          if (bestMove && bestMove !== '(none)') {
            resolve(bestMove);
          } else {
            reject(new Error('No legal move found'));
          }
        }
      };

      this.worker?.addEventListener('message', moveHandler);

      // Set position
      this.sendCommand(`position fen ${fen}`);

      // Start search
      const searchParams = [];
      if (options?.movetime !== undefined) {
        searchParams.push(`movetime ${options.movetime}`);
      }
      if (options?.depth !== undefined) {
        searchParams.push(`depth ${options.depth}`);
      }

      // Default to 1 second if no parameters specified
      const goCommand = searchParams.length > 0
        ? `go ${searchParams.join(' ')}`
        : 'go movetime 1000';

      this.sendCommand(goCommand);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingAnalysis) {
          this.worker?.removeEventListener('message', moveHandler);
          this.pendingAnalysis = false;
          reject(new Error('Analysis timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Analyze position and return evaluation with principal variation
   * @param fen FEN string representing the position
   * @param options Optional search parameters (depth in plies)
   */
  async analyze(
    fen: string,
    options?: { depth?: number }
  ): Promise<StockfishAnalysis> {
    if (!this.isInitialized) {
      throw new Error('Stockfish not initialized. Call initialize() first.');
    }

    if (this.pendingAnalysis) {
      await this.stop();
    }

    this.pendingAnalysis = true;

    return new Promise((resolve, reject) => {
      let analysis: Partial<StockfishAnalysis> = {
        bestMove: '',
        evaluation: 0,
        depth: 0,
        nodes: 0,
        pv: []
      };

      const analyzeHandler = (event: MessageEvent) => {
        const message = event.data;

        // Parse info lines for evaluation data
        if (message.startsWith('info') && message.includes('depth')) {
          const info = this.parseInfoLine(message);

          // Update analysis with latest info
          if (info.depth !== undefined) analysis.depth = info.depth;
          if (info.nodes !== undefined) analysis.nodes = info.nodes;
          if (info.evaluation !== undefined) analysis.evaluation = info.evaluation;
          if (info.pv) analysis.pv = info.pv;
        }

        // Parse bestmove
        if (message.startsWith('bestmove')) {
          this.worker?.removeEventListener('message', analyzeHandler);
          this.pendingAnalysis = false;

          // Parse: "bestmove e2e4 ponder e7e5"
          const parts = message.split(' ');
          analysis.bestMove = parts[1] || '';
          analysis.ponder = parts[3];

          if (analysis.bestMove && analysis.bestMove !== '(none)') {
            resolve(analysis as StockfishAnalysis);
          } else {
            reject(new Error('No legal move found'));
          }
        }
      };

      this.worker?.addEventListener('message', analyzeHandler);

      // Set position
      this.sendCommand(`position fen ${fen}`);

      // Start analysis
      const depth = options?.depth ?? 15;
      this.sendCommand(`go depth ${depth}`);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingAnalysis) {
          this.worker?.removeEventListener('message', analyzeHandler);
          this.pendingAnalysis = false;
          reject(new Error('Analysis timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Stop current analysis
   */
  async stop(): Promise<void> {
    if (!this.pendingAnalysis) {
      return;
    }

    this.sendCommand('stop');

    // Wait briefly for stop to process
    await new Promise(resolve => setTimeout(resolve, 100));
    this.pendingAnalysis = false;
  }

  /**
   * Terminate Web Worker and clean up
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.pendingAnalysis = false;
    }
  }

  /**
   * Send UCI command to Stockfish
   */
  private sendCommand(command: string): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    this.worker.postMessage(command);
  }

  /**
   * Parse UCI info line to extract evaluation and other data
   * Example: "info depth 15 score cp 35 nodes 12345 pv e2e4 e7e5 g1f3"
   */
  private parseInfoLine(line: string): Partial<StockfishAnalysis> {
    const result: Partial<StockfishAnalysis> = {};

    // Extract depth
    const depthMatch = line.match(/depth (\d+)/);
    if (depthMatch) {
      result.depth = parseInt(depthMatch[1], 10);
    }

    // Extract nodes
    const nodesMatch = line.match(/nodes (\d+)/);
    if (nodesMatch) {
      result.nodes = parseInt(nodesMatch[1], 10);
    }

    // Extract evaluation
    // Can be "score cp 35" (centipawns) or "score mate 3" (mate in 3)
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);

    if (cpMatch) {
      result.evaluation = parseInt(cpMatch[1], 10);
    } else if (mateMatch) {
      const mateIn = parseInt(mateMatch[1], 10);
      result.evaluation = `M${Math.abs(mateIn)}`;
    }

    // Extract principal variation (PV)
    const pvMatch = line.match(/pv (.+)$/);
    if (pvMatch) {
      result.pv = pvMatch[1].split(' ');
    }

    return result;
  }

  /**
   * Get current Elo rating
   */
  getElo(): number {
    return this.currentElo;
  }

  /**
   * Check if Stockfish is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
