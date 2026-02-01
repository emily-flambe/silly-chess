/**
 * Silly Chess - Main Application
 * 
 * Refactored for server-authoritative game state via Durable Objects.
 * - Game state persists on server (survives refresh)
 * - Moves validated server-side
 * - All moves logged to D1
 * - Stockfish still runs client-side for AI computation
 */

import { FairyStockfishClient } from '../lib/stockfish';
import { ChessBoard } from './components/Board';
import { GameControls } from './components/GameControls';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { GameClient, GameState, MoveResult, PlayerColor } from './GameClient';

interface AppState {
  gameId: string | null;
  playerColor: PlayerColor;
  isGameActive: boolean;
  isThinking: boolean;
  fen: string;
  turn: 'w' | 'b';
  aiElo: number;
  fenHistory: string[]; // FEN after each move (index 0 = after first move)
  viewingHistoryIndex: number; // -1 = current position, 0+ = viewing historical position
}

export class SillyChessApp {
  private board!: ChessBoard;
  private controls!: GameControls;
  private evalBar!: EvalBar;
  private moveList!: MoveList;
  private stockfish!: FairyStockfishClient;
  private gameClient!: GameClient;

  private readonly START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  private state: AppState = {
    gameId: null,
    playerColor: 'white',
    isGameActive: false,
    isThinking: false,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    aiElo: 1500,
    fenHistory: [],
    viewingHistoryIndex: -1, // -1 means viewing current position
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

    // Create game client for server communication
    this.gameClient = new GameClient();
    this.setupGameClientHandlers();

    // Create UI components (board operates on FEN directly now)
    this.board = new ChessBoard(this.containers.board, {
      interactive: true,
      showCoordinates: true,
    });

    this.controls = new GameControls(this.containers.controls);
    this.evalBar = new EvalBar(this.containers.evalBar);
    this.moveList = new MoveList(this.containers.moveList);

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize Fairy-Stockfish WASM client (still client-side)
    this.setStatus('Loading chess engine...');
    try {
      this.stockfish = new FairyStockfishClient();
      await this.stockfish.initialize();

      // Set initial Elo from controls
      const slider = this.controls.getDifficultySlider();
      if (slider) {
        this.state.aiElo = slider.getElo();
        await this.stockfish.setElo(this.state.aiElo);
      }

      // Check for existing game to reconnect
      await this.checkForExistingGame();

      this.setStatus('Ready - Click "New Game" to start');
    } catch (error) {
      console.error('Failed to initialize Stockfish:', error);
      this.setStatus('Chess engine unavailable - AI opponent disabled');
    }
  }

  /**
   * Set up GameClient event handlers
   */
  private setupGameClientHandlers(): void {
    // Handle game state updates from server
    this.gameClient.on('game_state', (data) => {
      const gameState = data as GameState;
      this.syncFromServer(gameState);
    });

    // Handle move results
    this.gameClient.on('move_result', (data) => {
      const result = data as MoveResult;
      this.handleMoveResult(result);
    });

    // Handle errors
    this.gameClient.on('error', (data) => {
      const error = data as { message: string };
      console.error('Server error:', error.message);
      this.setStatus(`Error: ${error.message}`);
    });

    // Handle connection lost
    this.gameClient.on('connection_lost', () => {
      this.setStatus('Connection lost. Please refresh the page.');
    });
  }

  /**
   * Sync local state from server
   */
  private syncFromServer(gameState: GameState): void {
    this.state.gameId = gameState.gameId;
    this.state.playerColor = gameState.playerColor;
    this.state.fen = gameState.fen;
    this.state.turn = gameState.turn;
    this.state.isGameActive = gameState.status === 'active';
    this.state.viewingHistoryIndex = -1;
    
    // Note: FEN history isn't available from server sync - would need to replay moves
    // For reconnected games, history navigation won't work until new moves are made
    this.state.fenHistory = [];

    // Update board
    this.board.setPosition(gameState.fen);
    if (gameState.lastMove) {
      this.board.setLastMove(gameState.lastMove.from, gameState.lastMove.to);
    }

    // Update move list
    this.moveList.updateFromSAN(gameState.moveHistory);

    // Handle game end
    if (gameState.status !== 'active') {
      this.handleGameEnd(gameState.status);
    }

    // Store game ID for reconnection
    if (gameState.gameId) {
      localStorage.setItem('silly-chess-game-id', gameState.gameId);
    }
  }

  /**
   * Handle move result from server
   */
  private handleMoveResult(result: MoveResult): void {
    if (!result.success) {
      return;
    }

    // Update local state
    this.state.fen = result.fen;
    this.state.turn = result.turn;
    
    // Track FEN history
    this.state.fenHistory.push(result.fen);
    this.state.viewingHistoryIndex = -1; // Reset to viewing current

    // Update board
    this.board.setPosition(result.fen);
    if (result.lastMove) {
      this.board.setLastMove(result.lastMove.from, result.lastMove.to);
    }

    // Check game end
    if (result.isCheckmate || result.isStalemate || result.isDraw) {
      this.state.isGameActive = false;
      
      if (result.isCheckmate) {
        const winner = result.turn === 'w' ? 'Black' : 'White';
        this.handleGameEnd('checkmate', `${winner} wins!`);
      } else if (result.isStalemate) {
        this.handleGameEnd('stalemate');
      } else {
        this.handleGameEnd('draw');
      }
    }
  }

  /**
   * View a historical position (without undoing moves)
   */
  private viewHistoricalPosition(moveIndex: number): void {
    if (moveIndex === -1) {
      // View current position
      this.state.viewingHistoryIndex = -1;
      this.board.setPosition(this.state.fen);
      this.board.setInteractive(this.state.isGameActive && !this.state.isThinking);
      this.setStatus(this.state.isGameActive ? 'Your turn' : 'Game over');
      return;
    }

    // View historical position
    this.state.viewingHistoryIndex = moveIndex;
    
    // Get the FEN for this position
    const historicalFen = moveIndex >= 0 && moveIndex < this.state.fenHistory.length
      ? this.state.fenHistory[moveIndex]
      : this.START_FEN;
    
    this.board.setPosition(historicalFen);
    this.board.clearLastMove();
    this.board.setInteractive(false); // Can't move when viewing history
    
    const moveNum = Math.floor(moveIndex / 2) + 1;
    const isWhiteMove = moveIndex % 2 === 0;
    this.setStatus(`Viewing move ${moveNum}${isWhiteMove ? '.' : '...'} (use → to return)`);
  }

  /**
   * Check for existing game to reconnect
   */
  private async checkForExistingGame(): Promise<void> {
    const savedGameId = localStorage.getItem('silly-chess-game-id');
    if (!savedGameId) return;

    try {
      const gameState = await this.gameClient.reconnectToGame(savedGameId);
      
      if (gameState.status === 'active') {
        this.syncFromServer(gameState);
        this.controls.setGameActive(true);
        this.board.setInteractive(true);
        
        // Flip board if playing as black
        if (gameState.playerColor === 'black') {
          this.board.flip();
        }

        this.setStatus('Game restored - Your turn');
        await this.updateEvaluation();
      } else {
        // Game ended, clear saved ID
        localStorage.removeItem('silly-chess-game-id');
      }
    } catch (error) {
      console.log('No existing game to restore');
      localStorage.removeItem('silly-chess-game-id');
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
      // Navigate back in history instead of undo
      if (this.state.fenHistory.length > 0) {
        this.moveList.goBack();
      }
    });

    // Move list position navigation
    this.moveList.onPositionSelect((moveIndex) => {
      this.viewHistoricalPosition(moveIndex);
    });

    // Keyboard navigation for move history
    document.addEventListener('keydown', (e) => {
      if (!this.state.isGameActive) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.moveList.goBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.moveList.goForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveList.goToStart();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.moveList.goToEnd();
          break;
      }
    });

    this.controls.onHint(() => {
      this.handleHint();
    });

    // Difficulty slider change
    const slider = this.controls.getDifficultySlider();
    if (slider) {
      this.updateDifficultyDisplay(slider.getElo());

      slider.onChange(async (elo) => {
        this.state.aiElo = elo;
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
  private async startNewGame(playerColor: PlayerColor): Promise<void> {
    // Stop any pending analysis
    if (this.stockfish?.isReady()) {
      await this.stockfish.stop();
    }

    // Clear local state
    this.board.clearHint();
    this.board.clearLastMove();
    this.moveList.clear();
    this.evalBar.reset();

    this.setStatus('Creating game...');

    try {
      // Create game on server
      const { gameId, gameState } = await this.gameClient.createGame(playerColor, this.state.aiElo);

      // Update local state
      this.state.gameId = gameId;
      this.state.playerColor = playerColor;
      this.state.isGameActive = true;
      this.state.isThinking = false;
      this.state.fen = gameState.fen;
      this.state.turn = gameState.turn;
      this.state.fenHistory = []; // Reset history for new game
      this.state.viewingHistoryIndex = -1;

      // Save for reconnection
      localStorage.setItem('silly-chess-game-id', gameId);

      // Update UI
      this.controls.setGameActive(true);
      this.controls.setCanUndo(false);
      this.board.setInteractive(true);
      this.board.setPosition(gameState.fen);

      // Flip board if playing as black
      if (playerColor === 'black') {
        this.board.flip();
      } else {
        this.board.unflip();
      }

      this.setStatus(`Game started - You play as ${playerColor}`);

      // If playing as black, let AI make first move
      if (playerColor === 'black') {
        await this.makeAIMove();
      }

      // Run initial evaluation
      await this.updateEvaluation();
    } catch (error) {
      console.error('Failed to create game:', error);
      this.setStatus('Failed to create game');
    }
  }

  /**
   * Handle player move
   */
  private async handlePlayerMove(from: string, to: string): Promise<void> {
    if (!this.state.isGameActive || this.state.isThinking) {
      return;
    }

    // Don't allow moves when viewing history
    if (this.state.viewingHistoryIndex !== -1) {
      this.setStatus('Return to current position to make a move (→ key)');
      return;
    }

    // Check if it's player's turn
    const currentTurn = this.state.turn === 'w' ? 'white' : 'black';
    if (currentTurn !== this.state.playerColor) {
      return;
    }

    // Clear hint
    this.board.clearHint();

    this.setStatus('Making move...');

    try {
      // Send move to server
      const result = await this.gameClient.makeMove(from, to);

      if (!result.success) {
        this.setStatus('Invalid move');
        return;
      }

      // Update local state
      this.state.fen = result.fen;
      this.state.turn = result.turn;
      this.state.fenHistory.push(result.fen); // Track position history

      // Update board
      this.board.setPosition(result.fen);
      if (result.lastMove) {
        this.board.setLastMove(result.lastMove.from, result.lastMove.to);
      }

      // Check game end
      if (result.isCheckmate || result.isStalemate || result.isDraw) {
        return; // Game end handled in handleMoveResult
      }

      // Update evaluation and make AI move
      await this.updateEvaluation();
      await this.makeAIMove();
    } catch (error) {
      console.error('Move failed:', error);
      this.setStatus('Move failed - try again');
    }
  }

  /**
   * Make AI move using Stockfish (client-side) and submit to server
   */
  private async makeAIMove(): Promise<void> {
    if (!this.state.isGameActive || !this.stockfish?.isReady()) {
      return;
    }

    this.state.isThinking = true;
    this.board.setInteractive(false);
    this.setStatus('AI is thinking...');

    const startTime = Date.now();

    try {
      // Get best move from Stockfish
      const bestMove = await this.stockfish.getBestMove(this.state.fen);

      if (!bestMove || !this.state.isGameActive) {
        return;
      }

      const thinkingTime = Date.now() - startTime;

      // Get evaluation for logging
      let evaluation: number | string | undefined;
      try {
        const analysis = await this.stockfish.analyze(this.state.fen, { depth: 12 });
        evaluation = analysis.evaluation;
      } catch {
        // Evaluation optional
      }

      // Submit AI move to server
      const result = await this.gameClient.submitAIMove(bestMove, thinkingTime, evaluation);

      if (result.success) {
        // Update local state
        this.state.fen = result.fen;
        this.state.turn = result.turn;
        this.state.fenHistory.push(result.fen); // Track position history

        // Update board
        this.board.setPosition(result.fen);
        if (result.lastMove) {
          this.board.setLastMove(result.lastMove.from, result.lastMove.to);
        }

        // Check game end
        if (result.isCheckmate || result.isStalemate || result.isDraw) {
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
      const analysis = await this.stockfish.analyze(this.state.fen, { depth: 12 });

      // Stockfish returns evaluation from side-to-move's perspective
      // Convert to white's perspective (positive = white advantage)
      const isBlackToMove = this.state.turn === 'b';

      if (typeof analysis.evaluation === 'string') {
        // Mate score
        const mateMatch = analysis.evaluation.match(/^-?M(\d+)$/);
        if (mateMatch) {
          const moves = parseInt(mateMatch[1], 10);
          let isNegative = analysis.evaluation.startsWith('-');
          if (isBlackToMove) isNegative = !isNegative;
          this.evalBar.setMate(isNegative ? -moves : moves);
        }
      } else {
        // Centipawn score
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
   * Handle game end
   */
  private handleGameEnd(status: string, extraMessage?: string): void {
    this.state.isGameActive = false;
    this.state.isThinking = false;
    this.board.setInteractive(false);
    this.controls.setGameActive(false);

    // Clear saved game
    localStorage.removeItem('silly-chess-game-id');

    let message = '';
    switch (status) {
      case 'checkmate':
        message = extraMessage || 'Checkmate!';
        break;
      case 'stalemate':
        message = 'Stalemate! Game is a draw.';
        break;
      case 'draw':
        message = 'Game is a draw.';
        break;
      case 'resigned':
        message = 'Game resigned.';
        break;
      default:
        message = 'Game over.';
    }

    this.setStatus(message);
  }

  /**
   * Handle resign
   */
  private async handleResign(): Promise<void> {
    if (!this.state.isGameActive) {
      return;
    }

    try {
      await this.gameClient.resign();
      const winner = this.state.playerColor === 'white' ? 'Black' : 'White';
      this.handleGameEnd('resigned', `You resigned. ${winner} wins.`);
    } catch (error) {
      console.error('Resign failed:', error);
    }

    // Reset board display
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

    const currentTurn = this.state.turn === 'w' ? 'white' : 'black';
    if (currentTurn !== this.state.playerColor) {
      return;
    }

    this.setStatus('Calculating best move...');

    try {
      const bestMove = await this.stockfish.getBestMove(this.state.fen);

      if (bestMove && this.state.isGameActive) {
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);

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
    if (this.gameClient) {
      this.gameClient.disconnect();
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
