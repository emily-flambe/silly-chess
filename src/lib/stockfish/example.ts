/**
 * Stockfish Usage Example
 *
 * Demonstrates how to use StockfishWorker for chess AI and analysis.
 */

import { StockfishWorker } from './StockfishWorker';

async function exampleUsage() {
  const stockfish = new StockfishWorker();

  try {
    // 1. Initialize Stockfish
    console.log('Initializing Stockfish...');
    await stockfish.initialize();
    console.log('Stockfish ready!');

    // 2. Set difficulty level (1200 Elo - club player)
    console.log('Setting Elo to 1200...');
    await stockfish.setElo(1200);

    // 3. Get best move for starting position
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    console.log('Getting best move...');
    const move = await stockfish.getBestMove(startingFen, { movetime: 1000 });
    console.log('Best move:', move); // e.g., 'e2e4'

    // 4. Analyze position with detailed evaluation
    console.log('Analyzing position...');
    const analysis = await stockfish.analyze(startingFen, { depth: 15 });
    console.log('Analysis:', {
      bestMove: analysis.bestMove,
      evaluation: analysis.evaluation, // centipawns or 'M3' for mate
      depth: analysis.depth,
      nodes: analysis.nodes,
      principalVariation: analysis.pv.slice(0, 5) // First 5 moves
    });

    // 5. Example: Get move after 1.e4
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const response = await stockfish.getBestMove(afterE4, { depth: 12 });
    console.log('Black\'s response to e4:', response); // likely 'e7e5' or 'c7c5'

    // 6. Example: Analyze endgame position
    const endgame = '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1';
    const endgameAnalysis = await stockfish.analyze(endgame, { depth: 20 });
    console.log('Endgame evaluation:', endgameAnalysis.evaluation);

    // 7. Stop analysis if needed (interrupt long-running calculation)
    // await stockfish.stop();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // 8. Clean up when done
    stockfish.terminate();
    console.log('Stockfish terminated');
  }
}

// Example: React/UI integration pattern
export class ChessAI {
  private stockfish: StockfishWorker;
  private initialized = false;

  constructor() {
    this.stockfish = new StockfishWorker();
  }

  async initialize(elo: number = 1500): Promise<void> {
    if (!this.initialized) {
      await this.stockfish.initialize();
      await this.stockfish.setElo(elo);
      this.initialized = true;
    }
  }

  async getAIMove(fen: string, thinkingTime: number = 1000): Promise<string> {
    if (!this.initialized) {
      throw new Error('AI not initialized');
    }
    return this.stockfish.getBestMove(fen, { movetime: thinkingTime });
  }

  async setDifficulty(elo: number): Promise<void> {
    if (!this.initialized) {
      throw new Error('AI not initialized');
    }
    await this.stockfish.setElo(elo);
  }

  cleanup(): void {
    this.stockfish.terminate();
    this.initialized = false;
  }
}

// Example: Game flow
async function playAgainstAI() {
  const ai = new ChessAI();

  // Initialize with beginner difficulty
  await ai.initialize(1000);

  // Get AI's move
  const startingFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const aiMove = await ai.getAIMove(startingFen, 2000);
  console.log('AI plays:', aiMove);

  // Increase difficulty mid-game
  await ai.setDifficulty(1500);

  // Clean up when game ends
  ai.cleanup();
}

// Run examples (uncomment to test)
// exampleUsage();
// playAgainstAI();
