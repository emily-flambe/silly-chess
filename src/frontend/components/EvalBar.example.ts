/**
 * Example Usage of EvalBar Component
 *
 * This file demonstrates how to integrate the EvalBar with Stockfish analysis
 */

import { EvalBar } from './EvalBar';
import { StockfishWorker } from '../../lib/stockfish/StockfishWorker';

// Example 1: Basic setup
function setupEvalBar() {
  // Create container element (e.g., beside the chess board)
  const container = document.createElement('div');
  container.style.height = '600px'; // Match chess board height
  document.body.appendChild(container);

  // Initialize eval bar
  const evalBar = new EvalBar(container);

  return evalBar;
}

// Example 2: Integration with Stockfish analysis
async function analyzePositionWithEvalBar() {
  const evalBar = setupEvalBar();
  const stockfish = new StockfishWorker();

  await stockfish.initialize();

  // Starting position FEN
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Analyze position
  const analysis = await stockfish.analyze(fen, { depth: 15 });

  // Update eval bar with analysis result
  evalBar.setAnalysisEvaluation(analysis.evaluation);

  // Clean up
  stockfish.terminate();
}

// Example 3: Manual evaluation updates
function manualEvalBarUpdates() {
  const evalBar = setupEvalBar();

  // Equal position
  evalBar.setEvaluation(0); // 0.0

  // White slightly better (+1 pawn)
  setTimeout(() => evalBar.setEvaluation(100), 1000); // +1.0

  // White much better (+3 pawns)
  setTimeout(() => evalBar.setEvaluation(300), 2000); // +3.0

  // Black better (-2 pawns)
  setTimeout(() => evalBar.setEvaluation(-200), 3000); // -2.0

  // White mate in 3
  setTimeout(() => evalBar.setMate(3), 4000); // M3

  // Black mate in 5
  setTimeout(() => evalBar.setMate(-5), 5000); // M5

  // Reset to equal
  setTimeout(() => evalBar.reset(), 6000); // 0.0
}

// Example 4: Responsive layout
function setupResponsiveEvalBar() {
  const boardContainer = document.getElementById('chess-board');
  const evalContainer = document.createElement('div');

  // Position eval bar next to board
  evalContainer.style.cssText = `
    position: absolute;
    right: -40px;
    top: 0;
    bottom: 0;
  `;

  boardContainer?.appendChild(evalContainer);

  return new EvalBar(evalContainer);
}

// Example 5: Real-time analysis updates
async function continuousAnalysis() {
  const evalBar = setupEvalBar();
  const stockfish = new StockfishWorker();

  await stockfish.initialize();

  // Function to update evaluation for a position
  const updateEval = async (fen: string) => {
    const analysis = await stockfish.analyze(fen, { depth: 12 });
    evalBar.setAnalysisEvaluation(analysis.evaluation);
  };

  // Update after each move
  // In real usage, this would be called after each chess move
  const positions = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', // e4
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' // e5
  ];

  for (const fen of positions) {
    await updateEval(fen);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  stockfish.terminate();
}

// Export examples for testing
export {
  setupEvalBar,
  analyzePositionWithEvalBar,
  manualEvalBarUpdates,
  setupResponsiveEvalBar,
  continuousAnalysis
};
