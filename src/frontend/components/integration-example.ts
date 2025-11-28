/**
 * Integration Example: GameControls + DifficultySlider + Stockfish
 *
 * This example demonstrates how to integrate the game controls
 * with the Stockfish chess engine.
 */

import { GameControls, PlayerColor } from './GameControls';
import { StockfishWorker } from '../../lib/stockfish/StockfishWorker';
import { Chess } from 'chess.js';

export class ChessGame {
  private controls: GameControls;
  private stockfish: StockfishWorker;
  private chess: Chess;
  private playerColor: PlayerColor = 'white';
  private gameActive: boolean = false;
  private moveHistory: string[] = [];

  constructor(controlsContainer: HTMLElement) {
    this.controls = new GameControls(controlsContainer);
    this.stockfish = new StockfishWorker();
    this.chess = new Chess();

    this.initializeStockfish();
    this.setupCallbacks();
  }

  /**
   * Initialize Stockfish and sync with difficulty slider
   */
  private async initializeStockfish(): Promise<void> {
    try {
      await this.stockfish.initialize();
      console.log('Stockfish initialized');

      // Get difficulty slider and sync Elo
      const difficultySlider = this.controls.getDifficultySlider();
      if (difficultySlider) {
        const initialElo = difficultySlider.getElo();
        await this.stockfish.setElo(initialElo);
        console.log('Initial Elo set to:', initialElo);

        // Listen for Elo changes
        difficultySlider.onChange(async (elo) => {
          await this.stockfish.setElo(elo);
          console.log('Elo changed to:', elo);
        });
      }
    } catch (error) {
      console.error('Failed to initialize Stockfish:', error);
      alert('Failed to initialize chess engine. Please refresh the page.');
    }
  }

  /**
   * Setup control callbacks
   */
  private setupCallbacks(): void {
    // New game callback
    this.controls.onNewGame((color) => {
      this.startNewGame(color);
    });

    // Resign callback
    this.controls.onResign(() => {
      this.resign();
    });

    // Undo callback
    this.controls.onUndo(() => {
      this.undoMove();
    });
  }

  /**
   * Start a new game
   */
  private async startNewGame(color: PlayerColor): Promise<void> {
    this.playerColor = color;
    this.chess.reset();
    this.moveHistory = [];
    this.gameActive = true;

    console.log('New game started, playing as:', color);

    // Update controls
    this.controls.setGameActive(true);
    this.controls.setCanUndo(false);

    // If player is black, make AI move first
    if (color === 'black') {
      await this.makeAIMove();
    }
  }

  /**
   * Make a player move
   */
  public async makePlayerMove(from: string, to: string, promotion?: string): Promise<boolean> {
    if (!this.gameActive) {
      console.log('Game not active');
      return false;
    }

    // Validate it's player's turn
    const currentTurn = this.chess.turn();
    const playerTurn = this.playerColor === 'white' ? 'w' : 'b';

    if (currentTurn !== playerTurn) {
      console.log('Not player turn');
      return false;
    }

    // Try to make the move
    try {
      const move = this.chess.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (!move) {
        console.log('Illegal move');
        return false;
      }

      console.log('Player move:', move.san);
      this.moveHistory.push(move.san);

      // Update undo button state
      this.controls.setCanUndo(this.moveHistory.length >= 2);

      // Check for game end
      if (this.checkGameEnd()) {
        return true;
      }

      // Make AI move
      await this.makeAIMove();

      return true;
    } catch (error) {
      console.error('Move error:', error);
      return false;
    }
  }

  /**
   * Make AI move using Stockfish
   */
  private async makeAIMove(): Promise<void> {
    if (!this.gameActive) return;

    try {
      console.log('AI thinking...');

      // Get current position as FEN
      const fen = this.chess.fen();

      // Get best move from Stockfish (1 second think time)
      const bestMove = await this.stockfish.getBestMove(fen, { movetime: 1000 });

      console.log('AI move:', bestMove);

      // Parse move (e.g., "e2e4" or "e7e8q" for promotion)
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;

      // Make the move
      const move = this.chess.move({
        from,
        to,
        promotion,
      });

      if (move) {
        console.log('AI played:', move.san);
        this.moveHistory.push(move.san);

        // Update undo button state
        this.controls.setCanUndo(this.moveHistory.length >= 2);

        // Check for game end
        this.checkGameEnd();
      }
    } catch (error) {
      console.error('AI move error:', error);
      alert('AI failed to make a move. Please try again.');
    }
  }

  /**
   * Check if game has ended
   */
  private checkGameEnd(): boolean {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      console.log('Checkmate!', winner, 'wins');
      alert(`Checkmate! ${winner} wins.`);
      this.endGame();
      return true;
    }

    if (this.chess.isDraw()) {
      console.log('Draw');
      alert('Game ended in a draw.');
      this.endGame();
      return true;
    }

    if (this.chess.isStalemate()) {
      console.log('Stalemate');
      alert('Stalemate! Game is a draw.');
      this.endGame();
      return true;
    }

    if (this.chess.isThreefoldRepetition()) {
      console.log('Threefold repetition');
      alert('Draw by threefold repetition.');
      this.endGame();
      return true;
    }

    if (this.chess.isInsufficientMaterial()) {
      console.log('Insufficient material');
      alert('Draw by insufficient material.');
      this.endGame();
      return true;
    }

    return false;
  }

  /**
   * End the current game
   */
  private endGame(): void {
    this.gameActive = false;
    this.controls.setGameActive(false);
    this.controls.setCanUndo(false);

    console.log('Game ended');
    console.log('Move history:', this.moveHistory);
  }

  /**
   * Resign the game
   */
  private resign(): void {
    if (!this.gameActive) return;

    const winner = this.playerColor === 'white' ? 'Black' : 'White';
    console.log('Player resigned,', winner, 'wins');

    this.endGame();
  }

  /**
   * Undo the last move pair (player move + AI move)
   */
  private undoMove(): void {
    if (!this.gameActive || this.moveHistory.length < 2) {
      console.log('Cannot undo');
      return;
    }

    // Undo AI move
    this.chess.undo();
    this.moveHistory.pop();

    // Undo player move
    this.chess.undo();
    this.moveHistory.pop();

    console.log('Undid last move pair');

    // Update undo button state
    this.controls.setCanUndo(this.moveHistory.length >= 2);
  }

  /**
   * Get current chess position
   */
  public getChess(): Chess {
    return this.chess;
  }

  /**
   * Get player color
   */
  public getPlayerColor(): PlayerColor {
    return this.playerColor;
  }

  /**
   * Check if game is active
   */
  public isGameActive(): boolean {
    return this.gameActive;
  }

  /**
   * Get move history
   */
  public getMoveHistory(): string[] {
    return [...this.moveHistory];
  }

  /**
   * Get game preferences
   */
  public getPreferences() {
    return this.controls.getPreferences();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stockfish.terminate();
  }
}

/**
 * Example Usage:
 *
 * const container = document.getElementById('game-controls');
 * const game = new ChessGame(container);
 *
 * // When user clicks on board to make a move:
 * game.makePlayerMove('e2', 'e4');
 *
 * // When user promotes a pawn:
 * game.makePlayerMove('e7', 'e8', 'q');
 */
