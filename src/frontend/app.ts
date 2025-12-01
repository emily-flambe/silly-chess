/**
 * Silly Chess - Main Application
 * Wires together all components: Board, Controls, EvalBar, ChessEngine, Stockfish
 */

import { ChessEngine } from '../lib/chess-engine';
import { FairyStockfishClient } from '../lib/stockfish';
import { ChessBoard } from './components/Board';
import { GameControls } from './components/GameControls';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';

export interface GameState {
  engine: ChessEngine;
  playerColor: 'white' | 'black';
  isGameActive: boolean;
  isThinking: boolean;
}

export class SillyChessApp {
  private board!: ChessBoard;
  private controls!: GameControls;
  private evalBar!: EvalBar;
  private moveList!: MoveList;
  private stockfish!: FairyStockfishClient;
  private engine!: ChessEngine;

  private state: GameState = {
    engine: null as unknown as ChessEngine,
    playerColor: 'white',
    isGameActive: false,
    isThinking: false,
  };

  private readonly containers: {
    board: HTMLElement;
    controls: HTMLElement;
    evalBar: HTMLElement;
    status: HTMLElement;
    difficultyDisplay: HTMLElement;
    moveList: HTMLElement;
  };

  constructor() {
    // Get container elements
    const boardContainer = document.getElementById('board-container');
    const controlsContainer = document.getElementById('controls-container');
    const evalBarContainer = document.getElementById('eval-bar-container');
    const statusContainer = document.getElementById('status-container');
    const difficultyDisplay = document.getElementById('difficulty-display');
    const moveListContainer = document.getElementById('move-list-container');

    if (!boardContainer || !controlsContainer || !evalBarContainer || !statusContainer || !difficultyDisplay || !moveListContainer) {
      throw new Error('Required container elements not found');
    }

    this.containers = {
      board: boardContainer,
      controls: controlsContainer,
      evalBar: evalBarContainer,
      status: statusContainer,
      difficultyDisplay: difficultyDisplay,
      moveList: moveListContainer,
    };

    this.initialize();
  }

  /**
   * Initialize all components
   */
  private async initialize(): Promise<void> {
    this.setStatus('Initializing...');

    // Create chess engine
    this.engine = new ChessEngine();
    this.state.engine = this.engine;

    // Create UI components
    this.board = new ChessBoard(this.containers.board, {
      interactive: true,
      showCoordinates: true,
    });
    this.board.setEngine(this.engine);

    this.controls = new GameControls(this.containers.controls);
    this.evalBar = new EvalBar(this.containers.evalBar);
    this.moveList = new MoveList(this.containers.moveList);

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize Fairy-Stockfish WASM client
    this.setStatus('Loading chess engine...');
    try {
      this.stockfish = new FairyStockfishClient();
      await this.stockfish.initialize();

      // Set initial Elo from controls
      const slider = this.controls.getDifficultySlider();
      if (slider) {
        await this.stockfish.setElo(slider.getElo());
      }

      this.setStatus('Ready - Click "New Game" to start');
    } catch (error) {
      console.error('Failed to initialize Stockfish:', error);
      this.setStatus('Chess engine unavailable - AI opponent disabled');
    }
  }

  /**
   * Set up event handlers for all components
   */
  private setupEventHandlers(): void {
    // Board move handler
    this.board.onMove((from, to) => {
      this.handlePlayerMove(from, to);
    });

    // Control handlers
    this.controls.onNewGame((color) => {
      this.startNewGame(color);
    });

    this.controls.onResign(() => {
      this.handleResign();
    });

    this.controls.onUndo(() => {
      this.handleUndo();
    });

    this.controls.onHint(() => {
      this.handleHint();
    });

    // Difficulty slider change
    const slider = this.controls.getDifficultySlider();
    if (slider) {
      // Set initial difficulty display
      this.updateDifficultyDisplay(slider.getElo());

      slider.onChange(async (elo) => {
        this.updateDifficultyDisplay(elo);
        if (this.stockfish?.isReady()) {
          await this.stockfish.setElo(elo);
        }
      });
    }
  }

  /**
   * Update the difficulty display above the board
   */
  private updateDifficultyDisplay(elo: number): void {
    const label = this.getDifficultyLabel(elo);
    this.containers.difficultyDisplay.textContent = `${label} (${elo})`;
  }

  /**
   * Get human-readable difficulty label for Elo
   */
  private getDifficultyLabel(elo: number): string {
    if (elo <= 900) return 'Beginner';
    if (elo <= 1100) return 'Novice';
    if (elo <= 1300) return 'Casual';
    if (elo <= 1500) return 'Club';
    if (elo <= 1700) return 'Intermediate';
    if (elo <= 1900) return 'Advanced';
    if (elo <= 2100) return 'Strong';
    if (elo <= 2400) return 'Expert';
    if (elo <= 2700) return 'Master';
    return 'Maximum';
  }

  /**
   * Start a new game
   */
  private async startNewGame(playerColor: 'white' | 'black'): Promise<void> {
    // Reset engine and clear board highlights
    this.engine.reset();
    this.board.clearLastMove();
    this.moveList.clear();

    // Update state
    this.state.playerColor = playerColor;
    this.state.isGameActive = true;
    this.state.isThinking = false;

    // Update UI
    this.controls.setGameActive(true);
    this.controls.setCanUndo(false);
    this.board.setInteractive(true);
    this.evalBar.reset();

    // Flip board if playing as black
    if (playerColor === 'black') {
      this.board.flip();
    }

    this.setStatus(`Game started - You play as ${playerColor}`);

    // If playing as black, let AI make first move
    if (playerColor === 'black') {
      await this.makeAIMove();
    }

    // Run initial evaluation
    await this.updateEvaluation();
  }

  /**
   * Handle player move
   */
  private async handlePlayerMove(from: string, to: string): Promise<void> {
    if (!this.state.isGameActive || this.state.isThinking) {
      return;
    }

    // Check if it's player's turn
    const turn = this.engine.getStatus().turn;
    if (turn !== this.state.playerColor) {
      return;
    }

    // Clear any hint highlight when player makes a move
    this.board.clearHint();

    // Try to make the move
    const move = this.engine.move(from, to);
    if (!move) {
      return; // Invalid move
    }

    // Update move list
    this.moveList.update(this.engine.getState().moveHistory);

    // Update can undo state
    this.controls.setCanUndo(true);

    // Check game end conditions
    if (this.checkGameEnd()) {
      return;
    }

    // Update evaluation and make AI move
    await this.updateEvaluation();
    await this.makeAIMove();
  }

  /**
   * Make AI move using Chess API
   */
  private async makeAIMove(): Promise<void> {
    if (!this.state.isGameActive || !this.stockfish?.isReady()) {
      return;
    }

    this.state.isThinking = true;
    this.board.setInteractive(false);
    this.setStatus('AI is thinking...');

    try {
      const fen = this.engine.getFEN();

      const bestMove = await this.stockfish.getBestMove(fen);

      if (bestMove && this.state.isGameActive) {
        // Parse UCI move format (e.g., "e2e4" or "e7e8q" for promotion)
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

        this.engine.move(from, to, promotion);
        this.board.update(); // Re-render board with AI's move
        this.moveList.update(this.engine.getState().moveHistory);
        this.controls.setCanUndo(true);

        // Check game end conditions
        if (this.checkGameEnd()) {
          return;
        }

        await this.updateEvaluation();
        this.setStatus('Your turn');
      }
    } catch (error) {
      console.error('AI move error:', error);
      this.setStatus('AI error - Your turn');
    } finally {
      this.state.isThinking = false;
      if (this.state.isGameActive) {
        this.board.setInteractive(true);
      }
    }
  }

  /**
   * Update position evaluation
   */
  private async updateEvaluation(): Promise<void> {
    if (!this.stockfish?.isReady()) {
      return;
    }

    try {
      const fen = this.engine.getFEN();
      const analysis = await this.stockfish.analyze(fen, { depth: 12 });

      // Stockfish returns evaluation from the side-to-move's perspective
      // We need to convert to white's perspective (positive = white advantage)
      const isBlackToMove = this.engine.getStatus().turn === 'black';

      if (typeof analysis.evaluation === 'string') {
        // Mate score
        const mateMatch = analysis.evaluation.match(/^-?M(\d+)$/);
        if (mateMatch) {
          const moves = parseInt(mateMatch[1], 10);
          let isNegative = analysis.evaluation.startsWith('-');
          // Flip sign if it's black's turn (convert to white's perspective)
          if (isBlackToMove) isNegative = !isNegative;
          this.evalBar.setMate(isNegative ? -moves : moves);
        }
      } else {
        // Centipawn score - flip sign if black to move
        const evalFromWhitePerspective = isBlackToMove
          ? -analysis.evaluation
          : analysis.evaluation;
        this.evalBar.setEvaluation(evalFromWhitePerspective);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    }
  }

  /**
   * Check if game has ended
   */
  private checkGameEnd(): boolean {
    const status = this.engine.getStatus();

    if (status.isCheckmate) {
      const winner = status.turn === 'white' ? 'Black' : 'White';
      this.endGame(`Checkmate! ${winner} wins.`);
      return true;
    }

    if (status.isStalemate) {
      this.endGame('Stalemate! Game is a draw.');
      return true;
    }

    if (status.isDraw) {
      this.endGame('Game is a draw.');
      return true;
    }

    return false;
  }

  /**
   * End the current game
   */
  private endGame(message: string): void {
    this.state.isGameActive = false;
    this.state.isThinking = false;
    this.board.setInteractive(false);
    this.controls.setGameActive(false);
    this.setStatus(message);
  }

  /**
   * Handle resign
   */
  private handleResign(): void {
    if (!this.state.isGameActive) {
      return;
    }

    const winner = this.state.playerColor === 'white' ? 'Black' : 'White';
    this.endGame(`You resigned. ${winner} wins.`);

    // Reset board to starting position and clear highlights
    this.engine.reset();
    this.board.clearLastMove();
    this.moveList.clear();
    this.evalBar.reset();
  }

  /**
   * Handle hint - show best move from Stockfish
   */
  private async handleHint(): Promise<void> {
    if (!this.state.isGameActive || this.state.isThinking || !this.stockfish?.isReady()) {
      return;
    }

    // Check if it's player's turn
    const turn = this.engine.getStatus().turn;
    if (turn !== this.state.playerColor) {
      return;
    }

    this.setStatus('Calculating best move...');

    try {
      const fen = this.engine.getFEN();
      const bestMove = await this.stockfish.getBestMove(fen);

      if (bestMove && this.state.isGameActive) {
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);

        // Clear any previous hint and show the new one
        this.board.clearHint();
        this.board.showHint(from, to);

        this.setStatus('Your turn');
      }
    } catch (error) {
      console.error('Hint error:', error);
      this.setStatus('Could not calculate hint');
    }
  }

  /**
   * Handle undo (takes back last move pair)
   */
  private handleUndo(): void {
    if (!this.state.isGameActive || this.state.isThinking) {
      return;
    }

    // Undo AI's move
    this.engine.undo();
    // Undo player's move
    this.engine.undo();

    // Update move list
    this.moveList.update(this.engine.getState().moveHistory);

    // Check if more moves can be undone
    const history = this.engine.getState().moveHistory;
    this.controls.setCanUndo(history.length >= 2);

    this.setStatus('Moves undone - Your turn');
    this.updateEvaluation();
  }

  /**
   * Update status display
   */
  private setStatus(message: string): void {
    this.containers.status.textContent = message;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.stockfish) {
      this.stockfish.terminate();
    }
    if (this.board) {
      this.board.destroy();
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new SillyChessApp();

    // Expose for debugging
    (window as unknown as { sillyChess: SillyChessApp }).sillyChess = app;
  } catch (error) {
    console.error('Failed to initialize Silly Chess:', error);
    const status = document.getElementById('status-container');
    if (status) {
      status.textContent = 'Failed to initialize application';
    }
  }
});
