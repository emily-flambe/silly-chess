/**
 * Silly Chess - Main Application
 * 
 * Refactored for server-authoritative game state via Durable Objects.
 * - Game state persists on server (survives refresh)
 * - Moves validated server-side
 * - All moves logged to D1
 * - Stockfish still runs client-side for AI computation
 */

import { Chess } from 'chess.js';
import { FairyStockfishClient } from '../lib/stockfish';
import { ChessBoard } from './components/Board';
import { GameControls } from './components/GameControls';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ExplanationPanel } from './components/ExplanationPanel';
import { PlayerBar, computeCapturesFromSAN } from './components/PlayerBar';
import { GameClient, GameState, GameMode, MoveResult, PlayerColor } from './GameClient';
import { evalToWinPercent, classifyMove, type MoveClassification } from './utils/moveClassification';
import { toWhitePerspective } from './utils/evalPerspective';
import { ThemeManager } from './utils/theme';
import { ChessGrammarClient } from './services/ChessGrammarClient';
import { TacticsPanel } from './components/TacticsPanel';
import { LearnPanel, type MistakeEntry } from './components/LearnPanel';
import { MoveReviewPanel, uciToSanSequence, type MoveAnalysis } from './components/MoveReviewPanel';

interface AppState {
  gameId: string | null;
  gameMode: GameMode;
  playerColor: PlayerColor;
  isGameActive: boolean;
  isThinking: boolean;
  fen: string;
  turn: 'w' | 'b';
  aiElo: number;
  fenHistory: string[]; // FEN after each move (index 0 = after first move)
  sanMoves: string[]; // SAN notation moves for display
  viewingHistoryIndex: number; // -1 = current position, 0+ = viewing historical position
  classifications: (MoveClassification | null)[]; // Move classifications parallel to sanMoves
  evalHistory: (number | string | null)[]; // Eval after each position (from white's perspective)
  moveAnalyses: (MoveAnalysis | null)[]; // Best move + PV for each position (parallel to sanMoves)
}

export class SillyChessApp {
  private board!: ChessBoard;
  private controls!: GameControls;
  private evalBar!: EvalBar;
  private moveList!: MoveList;
  private analysisPanel!: AnalysisPanel;
  private explanationPanel!: ExplanationPanel;
  private stockfish!: FairyStockfishClient;
  private gameClient!: GameClient;
  private postGameAnalysisRunning = false;
  private tacticsPanel!: TacticsPanel;
  private tacticsClient!: ChessGrammarClient;
  private learnPanel!: LearnPanel;
  private moveReviewPanel!: MoveReviewPanel;
  private playerBarTop!: PlayerBar;
  private playerBarBottom!: PlayerBar;
  private themeManager!: ThemeManager;

  private readonly START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  private evalRequestId = 0;
  private tacticsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private state: AppState = {
    gameId: null,
    gameMode: 'vs-ai',
    playerColor: 'white',
    isGameActive: false,
    isThinking: false,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    aiElo: 1500,
    fenHistory: [],
    sanMoves: [],
    viewingHistoryIndex: -1, // -1 means viewing current position
    classifications: [],
    evalHistory: [],
    moveAnalyses: [],
  };

  private readonly containers: {
    board: HTMLElement;
    controls: HTMLElement;
    evalBar: HTMLElement;
    status: HTMLElement;
    difficultyDisplay: HTMLElement;
    moveList: HTMLElement;
    analysis: HTMLElement;
    tactics: HTMLElement;
    playerBarTop: HTMLElement;
    playerBarBottom: HTMLElement;
    explanation: HTMLElement;
    appRoot: HTMLElement;
  };

  constructor() {
    // Get container elements
    const appRoot = document.getElementById('app-root');
    const boardContainer = document.getElementById('board-container');
    const controlsContainer = document.getElementById('controls-container');
    const evalBarContainer = document.getElementById('eval-bar-container');
    const statusContainer = document.getElementById('status-container');
    const difficultyDisplay = document.getElementById('difficulty-display');
    const moveListContainer = document.getElementById('move-list-container');
    const analysisContainer = document.getElementById('analysis-container');
    const tacticsContainer = document.getElementById('tactics-container');
    const playerBarTop = document.getElementById('player-bar-top');
    const playerBarBottom = document.getElementById('player-bar-bottom');
    const explanationContainer = document.getElementById('explanation-container');

    if (!appRoot || !boardContainer || !controlsContainer || !evalBarContainer || !statusContainer || !difficultyDisplay || !moveListContainer || !analysisContainer || !tacticsContainer || !playerBarTop || !playerBarBottom || !explanationContainer) {
      throw new Error('Required container elements not found');
    }

    this.containers = {
      board: boardContainer,
      controls: controlsContainer,
      evalBar: evalBarContainer,
      status: statusContainer,
      difficultyDisplay: difficultyDisplay,
      moveList: moveListContainer,
      analysis: analysisContainer,
      tactics: tacticsContainer,
      playerBarTop: playerBarTop,
      playerBarBottom: playerBarBottom,
      explanation: explanationContainer,
      appRoot: appRoot,
    };

    this.initialize();
  }

  /**
   * Initialize all components
   */
  private async initialize(): Promise<void> {
    this.setStatus('Initializing...');

    // Theme manager (applies stored theme to #app-root and wires topbar toggle)
    this.themeManager = new ThemeManager(this.containers.appRoot);

    // Create game client for server communication
    this.gameClient = new GameClient();
    this.setupGameClientHandlers();

    // Create UI components (board operates on FEN directly now)
    this.controls = new GameControls(this.containers.controls);

    // Player bars (opponent on top, player on bottom). Both default to white
    // until we know the assigned color; updatePlayerBars() fills in the truth.
    this.playerBarTop = new PlayerBar(this.containers.playerBarTop, {
      color: 'black',
      name: 'Opponent',
      clockMs: null,
      activeClock: false,
      captured: [],
      score: 0,
    });
    this.playerBarBottom = new PlayerBar(this.containers.playerBarBottom, {
      color: 'white',
      name: 'You',
      clockMs: null,
      activeClock: false,
      captured: [],
      score: 0,
    });

    this.board = new ChessBoard(this.containers.board, {
      interactive: true,
      showCoordinates: this.controls.getPreferences().showCoordinates,
    });

    this.evalBar = new EvalBar(this.containers.evalBar);
    this.moveList = new MoveList(this.containers.moveList);
    this.analysisPanel = new AnalysisPanel(this.containers.analysis);
    this.tacticsPanel = new TacticsPanel(this.containers.tactics);
    this.tacticsClient = new ChessGrammarClient();
    this.learnPanel = new LearnPanel(this.containers.analysis.parentElement || this.containers.analysis);
    this.learnPanel.onNext(() => this.navigateToCurrentLearnMistake());
    this.learnPanel.onExit(() => this.exitLearnMode());
    this.moveReviewPanel = new MoveReviewPanel(this.containers.analysis.parentElement || this.containers.analysis);

    // Create explanation panel beneath the board so the Explain button and the
    // expanded panel have room to render. (The old status-pill mount clipped
    // everything inside the topbar chip.)
    this.explanationPanel = new ExplanationPanel(this.containers.explanation);
    const explainBtn = this.explanationPanel.createButton();
    this.containers.explanation.appendChild(explainBtn);
    explainBtn.addEventListener('click', () => this.handleExplain());

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
      const hasExistingGame = await this.checkForExistingGame();

      if (!hasExistingGame) {
        this.setStatus('Choose a game mode to start playing');
        this.controls.showModal();
      }
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
   * Rebuild FEN history from SAN moves by replaying them with chess.js
   */
  private rebuildFenHistory(sanMoves: string[]): string[] {
    const fenHistory: string[] = [];
    const chess = new Chess();
    
    for (const san of sanMoves) {
      try {
        chess.move(san);
        fenHistory.push(chess.fen());
      } catch (e) {
        console.error('Failed to replay move for FEN history:', san, e);
        break;
      }
    }
    
    return fenHistory;
  }

  /**
   * Sync local state from server
   */
  private syncFromServer(gameState: GameState): void {
    this.state.gameId = gameState.gameId;
    this.state.gameMode = gameState.gameMode || 'vs-ai';
    this.state.playerColor = gameState.playerColor;
    this.state.fen = gameState.fen;
    this.state.turn = gameState.turn;
    this.state.isGameActive = gameState.status === 'active';
    this.state.viewingHistoryIndex = -1;

    // Rebuild FEN history from SAN moves so back/forward navigation works
    this.state.sanMoves = gameState.moveHistory || [];
    this.state.fenHistory = this.rebuildFenHistory(this.state.sanMoves);

    // Update board
    this.board.setPosition(gameState.fen);
    if (gameState.lastMove) {
      this.board.setLastMove(gameState.lastMove.from, gameState.lastMove.to);
    }

    // Update move list
    this.moveList.updateFromSAN(this.state.sanMoves);
    this.updatePlayerBars();

    // Handle game end
    if (gameState.status !== 'active') {
      this.handleGameEnd(gameState.status, undefined, gameState.result);
    } else if (this.state.gameMode === 'vs-player') {
      // Handle two-player specific states
      if (gameState.waitingForOpponent) {
        const shareUrl = `${window.location.origin}/game/${gameState.gameId}`;
        this.setStatus(`Waiting for opponent... Share: ${shareUrl}`);
        this.board.setInteractive(false);
      } else {
        const currentTurn = gameState.turn === 'w' ? 'white' : 'black';
        const isMyTurn = currentTurn === this.state.playerColor;
        this.board.setInteractive(isMyTurn);
        this.setStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
      }
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

    // Only update if FEN has changed (avoid duplicate updates from race conditions)
    if (this.state.fen === result.fen) {
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
    } else if (this.state.gameMode === 'vs-player') {
      // In two-player mode, enable board when it's our turn
      const currentTurn = result.turn === 'w' ? 'white' : 'black';
      const isMyTurn = currentTurn === this.state.playerColor;
      this.board.setInteractive(isMyTurn);
      this.setStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
    }
  }

  /**
   * View a historical position (without undoing moves)
   * @param moveIndex - Move index: -1 = current, -2 = start position, 0+ = after that move
   */
  private viewHistoricalPosition(moveIndex: number): void {
    if (moveIndex === -1) {
      // View current position
      this.state.viewingHistoryIndex = -1;
      this.board.setPosition(this.state.fen);
      this.board.setInteractive(this.state.isGameActive && !this.state.isThinking);
      this.board.clearBestMove();
      this.setStatus(this.state.isGameActive ? 'Your turn' : 'Game over');
      this.updateEvaluation(this.state.fen);
      this.requestTacticsUpdate(this.state.fen);
      this.updateExplainButtonVisibility();
      this.updateMoveReview(this.state.sanMoves.length - 1);
      return;
    }

    if (moveIndex === -2) {
      // View start position (before any moves)
      this.state.viewingHistoryIndex = -2;
      this.board.setPosition(this.START_FEN);
      this.board.clearLastMove();
      this.board.clearBestMove();
      this.board.setInteractive(false);
      this.setStatus('Start position (use \u2192 to step forward)');
      this.updateEvaluation(this.START_FEN);
      this.requestTacticsUpdate(this.START_FEN);
      this.updateExplainButtonVisibility();
      this.moveReviewPanel.hide();
      return;
    }

    // View historical position after a specific move
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
    this.setStatus(`Viewing move ${moveNum}${isWhiteMove ? '.' : '...'} (use \u2192 to continue)`);
    this.updateEvaluation(historicalFen);
    this.updateAnalysisPanel(historicalFen);
    this.requestTacticsUpdate(historicalFen);
    this.updateExplainButtonVisibility();
    this.updateMoveReview(moveIndex);
  }

  /**
   * Get game ID from URL if present (/game/:id)
   */
  private getGameIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/game\/([a-f0-9-]+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Update URL to reflect current game
   */
  private updateUrlForGame(gameId: string): void {
    const newUrl = `/game/${gameId}`;
    if (window.location.pathname !== newUrl) {
      history.pushState({ gameId }, '', newUrl);
    }
  }

  /**
   * Clear game from URL (go back to home)
   */
  private clearGameUrl(): void {
    if (window.location.pathname !== '/') {
      history.pushState({}, '', '/');
    }
  }

  /**
   * Check for existing game to reconnect or review
   */
  private async checkForExistingGame(): Promise<boolean> {
    // Only restore if URL has a game ID - don't auto-redirect from homepage
    const urlGameId = this.getGameIdFromUrl();
    if (!urlGameId) {
      // On homepage, clear any stale localStorage
      localStorage.removeItem('silly-chess-game-id');
      return false;
    }

    try {
      // First try to get the game state to check if we should join
      const response = await fetch(`/api/games/${urlGameId}`);
      if (!response.ok) throw new Error('Game not found');
      const serverState = await response.json() as GameState & { gameMode?: string; players?: { white: string | null; black: string | null } };

      // Check if this is a vs-player game we need to join
      const isVsPlayer = serverState.gameMode === 'vs-player';
      const savedToken = localStorage.getItem(`silly-chess-token-${urlGameId}`);
      const needsJoin = isVsPlayer && !savedToken && serverState.status === 'active';

      if (needsJoin) {
        // Join the game as the second player
        const { playerColor, gameState: joinState } = await this.gameClient.joinGame(urlGameId);
        // Save token for reconnection
        const token = this.gameClient.getPlayerToken();
        if (token) localStorage.setItem(`silly-chess-token-${urlGameId}`, token);
        localStorage.setItem('silly-chess-game-id', urlGameId);

        this.state.gameMode = 'vs-player';
        this.syncFromServer({ ...joinState, playerColor, gameMode: 'vs-player' });
        this.controls.setGameActive(true);
        if (playerColor === 'black') this.board.flip();
        return true;
      }

      // Reconnect (restore saved token if available)
      if (savedToken) {
        // Manually set the token before connecting
        (this.gameClient as unknown as { playerToken: string | null }).playerToken = savedToken;
        (this.gameClient as unknown as { gameMode: string }).gameMode = 'vs-player';
      }

      const gameState = await this.gameClient.reconnectToGame(urlGameId);

      if (gameState.status === 'active') {
        // Active game - restore for play
        this.syncFromServer(gameState);
        this.controls.setGameActive(true);

        // Flip board if playing as black
        if (gameState.playerColor === 'black') {
          this.board.flip();
        }

        if (this.state.gameMode === 'vs-player') {
          const currentTurn = gameState.turn === 'w' ? 'white' : 'black';
          const isMyTurn = currentTurn === this.state.playerColor;
          this.board.setInteractive(isMyTurn);
          this.setStatus(isMyTurn ? 'Your turn' : "Opponent's turn");
        } else {
          this.board.setInteractive(true);
          this.setStatus('Game restored - Your turn');
          await this.updateEvaluation();
        }
      } else {
        // Completed game - load for review
        this.loadCompletedGame(gameState);
      }
      return true;
    } catch (error) {
      console.log('No existing game to restore');
      localStorage.removeItem('silly-chess-game-id');
      this.clearGameUrl();
      return false;
    }
  }

  /**
   * Load a completed game for review
   */
  private loadCompletedGame(gameState: GameState): void {
    // Sync state from server
    this.state.gameId = gameState.gameId;
    this.state.playerColor = gameState.playerColor;
    this.state.fen = gameState.fen;
    this.state.turn = gameState.turn;
    this.state.isGameActive = false;
    this.state.isThinking = false;
    this.state.viewingHistoryIndex = -1;
    
    // Rebuild FEN history from SAN moves for navigation
    this.state.sanMoves = gameState.moveHistory || [];
    this.state.fenHistory = this.rebuildFenHistory(this.state.sanMoves);

    // Update board
    this.board.setPosition(gameState.fen);
    this.board.setInteractive(false);
    if (gameState.lastMove) {
      this.board.setLastMove(gameState.lastMove.from, gameState.lastMove.to);
    }
    
    // Flip board if played as black
    if (gameState.playerColor === 'black') {
      this.board.flip();
    }

    // Update move list
    this.moveList.updateFromSAN(this.state.sanMoves);
    this.updatePlayerBars();

    // Controls should show game as inactive
    this.controls.setGameActive(false);

    // Clear localStorage (don't auto-restore completed games)
    localStorage.removeItem('silly-chess-game-id');

    // Set appropriate status message
    const statusMessage = this.getCompletedGameStatus(gameState.status, gameState.playerColor);
    this.setStatus(statusMessage);

    // Update evaluation bar for final position
    this.updateEvaluation();

    // Show explain button for completed game review
    this.updateExplainButtonVisibility();
  }

  /**
   * Get a human-readable status message for a completed game
   */
  private getCompletedGameStatus(status: string, playerColor: PlayerColor): string {
    const playerWon = (status === 'checkmate' && 
      ((playerColor === 'white' && this.state.turn === 'b') ||
       (playerColor === 'black' && this.state.turn === 'w')));
    
    switch (status) {
      case 'checkmate':
        if (playerWon) {
          return 'You won by checkmate! Use the arrow keys to review.';
        } else {
          return 'You lost by checkmate. Use the arrow keys to review.';
        }
      case 'stalemate':
        return 'Draw by stalemate. Use the arrow keys to review.';
      case 'draw':
        return 'Game drawn. Use the arrow keys to review.';
      case 'resigned':
        return 'Game ended by resignation. Use the arrow keys to review.';
      default:
        return 'Game over. Use the arrow keys to review.';
    }
  }

  /**
   * Set up event handlers for all components
   */
  private setupEventHandlers(): void {
    // Board move handler
    this.board.onMove((from, to, promotion) => {
      if (this.learnPanel.isActive() && this.learnPanel.isWaitingForMove()) {
        this.handleLearnModeMove(from, to, promotion);
      } else {
        this.handlePlayerMove(from, to, promotion);
      }
    });

    // Control handlers
    this.controls.onNewGame((options) => {
      this.startNewGame(options.color, options.mode);
    });

    this.controls.onResign(() => {
      this.handleResign();
    });

    // Move list position navigation
    this.moveList.onPositionSelect((moveIndex) => {
      this.viewHistoricalPosition(moveIndex);
    });

    // Keyboard navigation for move history (works during game and review)
    document.addEventListener('keydown', (e) => {
      // Disable move history navigation while in learn mode
      if (this.learnPanel.isActive()) return;
      // Allow navigation if there are moves to review
      if (this.state.sanMoves.length === 0) return;
      
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

    this.controls.onCoordinatesChange((show) => {
      this.board.setShowCoordinates(show);
    });

    // Difficulty slider change (settings panel)
    const slider = this.controls.getDifficultySlider();
    if (slider) {
      this.updateDifficultyDisplay(slider.getElo());

      slider.onChange(async (elo) => {
        this.state.aiElo = elo;
        this.updateDifficultyDisplay(elo);
        // Sync modal slider
        const modalSlider = this.controls.getModalDifficultySlider();
        if (modalSlider) modalSlider.setElo(elo);
        if (this.stockfish?.isReady()) {
          await this.stockfish.setElo(elo);
        }
      });
    }

    // Difficulty slider change (modal) — sync to settings slider
    const modalSlider = this.controls.getModalDifficultySlider();
    if (modalSlider) {
      modalSlider.onChange(async (elo) => {
        this.state.aiElo = elo;
        this.updateDifficultyDisplay(elo);
        if (slider) slider.setElo(elo);
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
  private async startNewGame(playerColor: PlayerColor, mode: GameMode = 'vs-ai'): Promise<void> {
    // Read elo from modal slider (user just set it) and sync to settings slider
    if (mode === 'vs-ai') {
      const modalSlider = this.controls.getModalDifficultySlider();
      if (modalSlider) {
        const elo = modalSlider.getElo();
        this.state.aiElo = elo;
        this.updateDifficultyDisplay(elo);
        // Sync settings slider to match
        const settingsSlider = this.controls.getDifficultySlider();
        if (settingsSlider) settingsSlider.setElo(elo);
        if (this.stockfish?.isReady()) {
          await this.stockfish.setElo(elo);
        }
      }
    }

    // Stop any pending analysis
    if (this.stockfish?.isReady()) {
      await this.stockfish.stop();
    }

    // Clear local state
    this.board.clearHint();
    this.board.clearLastMove();
    this.moveList.clear();
    this.updatePlayerBars();
    this.evalBar.reset();
    this.analysisPanel.clear();
    this.postGameAnalysisRunning = false;
    this.tacticsPanel.clear();
    this.tacticsClient.clearCache();
    this.learnPanel.deactivate();
    this.moveReviewPanel.hide();
    this.explanationPanel.removePanel();
    this.explanationPanel.setButtonVisible(false);

    this.setStatus('Creating game...');

    try {
      // Create game on server
      const { gameId, gameState } = await this.gameClient.createGame(playerColor, this.state.aiElo, mode);

      // Update local state
      this.state.gameId = gameId;
      this.state.gameMode = mode;
      this.state.playerColor = playerColor;
      this.state.isGameActive = true;
      this.state.isThinking = false;
      this.state.fen = gameState.fen;
      this.state.turn = gameState.turn;
      this.state.fenHistory = []; // Reset history for new game
      this.state.sanMoves = []; // Reset move list for new game
      this.state.viewingHistoryIndex = -1;
      this.state.classifications = [];
      this.state.evalHistory = [];
      this.state.moveAnalyses = [];

      // Save for reconnection and update URL
      localStorage.setItem('silly-chess-game-id', gameId);
      if (mode === 'vs-player') {
        const token = this.gameClient.getPlayerToken();
        if (token) localStorage.setItem(`silly-chess-token-${gameId}`, token);
      }
      this.updateUrlForGame(gameId);

      // Update UI
      this.controls.setGameActive(true);
      this.board.setInteractive(true);
      this.board.setPosition(gameState.fen);

      // Flip board if playing as black
      if (playerColor === 'black') {
        this.board.flip();
      } else {
        this.board.unflip();
      }

      if (mode === 'vs-player') {
        // Show share link for two-player game
        const shareUrl = `${window.location.origin}/game/${gameId}`;
        this.setStatus(`Waiting for opponent... Share this link: ${shareUrl}`);
        // Disable board until opponent joins
        this.board.setInteractive(false);
      } else {
        this.setStatus(`Game started - You play as ${playerColor}`);

        // If playing as black, let AI make first move
        if (playerColor === 'black') {
          await this.makeAIMove();
        }

        // Run initial evaluation
        await this.updateEvaluation();
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      this.setStatus('Failed to create game');
    }
  }

  /**
   * Handle player move
   */
  private async handlePlayerMove(from: string, to: string, promotion?: string): Promise<void> {
    if (!this.state.isGameActive || this.state.isThinking) {
      return;
    }

    // Don't allow moves when viewing history
    if (this.state.viewingHistoryIndex !== -1) {
      this.setStatus('Return to current position to make a move (forward arrow key)');
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
      const result = await this.gameClient.makeMove(from, to, promotion);

      if (!result.success) {
        this.setStatus('Invalid move');
        return;
      }

      // Update local state
      this.state.fen = result.fen;
      this.state.turn = result.turn;
      this.state.fenHistory.push(result.fen); // Track position history
      
      // Track SAN move and update move list
      if (result.san) {
        this.state.sanMoves.push(result.san);
        this.moveList.updateFromSAN(this.state.sanMoves);
    this.updatePlayerBars();
      }

      // Update board
      this.board.setPosition(result.fen);
      if (result.lastMove) {
        this.board.setLastMove(result.lastMove.from, result.lastMove.to);
      }

      // Check game end
      if (result.isCheckmate || result.isStalemate || result.isDraw) {
        return; // Game end handled in handleMoveResult
      }

      if (this.state.gameMode === 'vs-player') {
        // In two-player mode, wait for opponent's move via WebSocket
        this.board.setInteractive(false);
        this.setStatus("Opponent's turn");
        this.requestTacticsUpdate(result.fen);
      } else {
        // Update evaluation and make AI move
        await this.updateEvaluation();
        this.requestTacticsUpdate(result.fen);
        await this.makeAIMove();
      }
    } catch (error) {
      console.error('Move failed:', error);
      this.setStatus('Move failed - try again');
    }
  }

  /**
   * Make AI move using Stockfish (client-side) and submit to server
   */
  private async makeAIMove(): Promise<void> {
    // Guard against re-entry - if already thinking, don't start another
    if (!this.state.isGameActive || !this.stockfish?.isReady() || this.state.isThinking) {
      return;
    }

    this.state.isThinking = true;
    this.board.setInteractive(false);
    this.board.setThinking(true);
    this.setStatus('AI is thinking...');
    
    // Overall timeout to prevent permanent hangs
    const overallTimeout = setTimeout(() => {
      console.error('makeAIMove: Overall timeout - forcing recovery');
      this.state.isThinking = false;
      this.board.setThinking(false);
      if (this.state.isGameActive) {
        this.board.setInteractive(true);
      }
      this.setStatus('AI timeout - Your turn');
    }, 20000);

    const startTime = Date.now();

    try {
      // Get best move from Stockfish
      const bestMove = await this.stockfish.getBestMove(this.state.fen);

      if (!bestMove || !this.state.isGameActive) {
        // Update status on early return so UI doesn't stay stuck
        this.setStatus(this.state.isGameActive ? 'Your turn' : 'Game over');
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
        // Track SAN move ALWAYS (before FEN guard, since event handler may have already updated FEN)
        if (result.san) {
          this.state.sanMoves.push(result.san);
          this.moveList.updateFromSAN(this.state.sanMoves);
    this.updatePlayerBars();
        }

        // Only update other state if event handler hasn't already (avoid duplicates)
        if (this.state.fen !== result.fen) {
          this.state.fen = result.fen;
          this.state.turn = result.turn;
          this.state.fenHistory.push(result.fen);
          this.board.setPosition(result.fen);
        }
        
        if (result.lastMove) {
          this.board.setLastMove(result.lastMove.from, result.lastMove.to);
        }

        // Check game end
        if (result.isCheckmate || result.isStalemate || result.isDraw) {
          return;
        }

        await this.updateEvaluation();
        this.requestTacticsUpdate(this.state.fen);
        this.setStatus('Your turn');
      }
    } catch (error) {
      console.error('AI move error:', error);
      this.setStatus('AI error - Your turn');
    } finally {
      clearTimeout(overallTimeout);
      this.state.isThinking = false;
      this.board.setThinking(false);
      if (this.state.isGameActive) {
        this.board.setInteractive(true);
      }
      // Safety: ensure status is sensible if still showing "AI is thinking..."
      if (this.containers.status.textContent?.includes('AI is thinking')) {
        this.setStatus(this.state.isGameActive ? 'Your turn' : 'Game over');
      }
    }
  }

  /**
   * Request tactical analysis for a position (debounced to avoid API spam).
   * Skips analysis while the AI is thinking.
   */
  private requestTacticsUpdate(fen: string): void {
    if (this.state.isThinking) return;

    if (this.tacticsDebounceTimer) {
      clearTimeout(this.tacticsDebounceTimer);
    }

    this.tacticsPanel.setLoading();

    this.tacticsDebounceTimer = setTimeout(async () => {
      try {
        const patterns = await this.tacticsClient.detectTactics(fen);
        this.tacticsPanel.setPatterns(patterns);
      } catch {
        this.tacticsPanel.setPatterns([]);
      }
    }, 400);
  }

  /**
   * Update position evaluation
   */
  private async updateEvaluation(fen?: string): Promise<void> {
    if (!this.stockfish?.isReady()) {
      return;
    }

    const fenToAnalyze = fen || this.state.fen;
    const requestId = ++this.evalRequestId;

    try {
      const analysis = await this.stockfish.analyze(fenToAnalyze, { depth: 12 });

      // Discard stale results if the user navigated to a different position
      if (requestId !== this.evalRequestId) return;

      const whiteEval = toWhitePerspective(analysis, fenToAnalyze);

      if (whiteEval.type === 'wdl') {
        this.evalBar.setWDL(whiteEval.win, whiteEval.draw, whiteEval.loss);
      } else if (whiteEval.type === 'mate') {
        this.evalBar.setMate(whiteEval.moves);
      } else {
        this.evalBar.setEvaluation(whiteEval.value);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    }
  }

  /**
   * Show per-move review annotation for the given move index.
   * Only shows when post-game analysis is complete.
   */
  private updateMoveReview(moveIndex: number): void {
    // Only show during post-game review when analysis is done
    if (this.state.isGameActive || this.state.classifications.length === 0) {
      this.moveReviewPanel.hide();
      this.board.clearBestMove();
      return;
    }

    if (moveIndex < 0 || moveIndex >= this.state.classifications.length) {
      this.moveReviewPanel.hide();
      this.board.clearBestMove();
      return;
    }

    const classification = this.state.classifications[moveIndex];
    if (!classification) {
      this.moveReviewPanel.hide();
      this.board.clearBestMove();
      return;
    }

    const isPlayerMove = this.state.playerColor === 'white'
      ? (moveIndex % 2 === 0)
      : (moveIndex % 2 === 1);

    // evalHistory[0] = start position eval, evalHistory[moveIndex] = before this move
    const evalBefore = this.state.evalHistory[moveIndex] ?? null;
    const evalAfter = this.state.evalHistory[moveIndex + 1] ?? null;

    const analysis = this.state.moveAnalyses[moveIndex] ?? null;

    this.moveReviewPanel.show({
      moveSan: this.state.sanMoves[moveIndex],
      moveIndex,
      classification,
      isPlayerMove,
      evalBefore,
      evalAfter,
      analysis,
    });

    // Show best-move highlight on board for player mistakes/blunders
    const isNegative = classification === 'inaccuracy' || classification === 'mistake' || classification === 'blunder';
    if (isNegative && isPlayerMove && analysis) {
      const from = analysis.bestMove.substring(0, 2);
      const to = analysis.bestMove.substring(2, 4);
      this.board.setBestMove(from, to);
    } else {
      this.board.clearBestMove();
    }
  }

  /**
   * Update the analysis panel with MultiPV lines for a position
   */
  private async updateAnalysisPanel(fen: string): Promise<void> {
    if (!this.stockfish?.isReady()) return;

    try {
      const lines = await this.stockfish.analyzeMultiPV(fen, { depth: 12, lines: 3 });
      this.analysisPanel.update(lines, fen);
    } catch (error) {
      console.error('MultiPV analysis error:', error);
    }
  }

  /**
   * Run full post-game analysis: evaluate every position and classify moves
   */
  private async runPostGameAnalysis(): Promise<void> {
    if (!this.stockfish?.isReady() || this.postGameAnalysisRunning) return;
    if (this.state.fenHistory.length === 0) return;

    this.postGameAnalysisRunning = true;
    const totalMoves = this.state.fenHistory.length;

    // We need eval for the starting position plus every position after each move
    // allFens[0] = start, allFens[1] = after move 0, etc.
    const allFens = [this.START_FEN, ...this.state.fenHistory];
    const evals: (number | string)[] = [];
    // Store best move + PV for each position BEFORE a move (indices 0..totalMoves-1)
    const analyses: (MoveAnalysis | null)[] = [];

    this.analysisPanel.setStatus(`Analyzing game... (0/${totalMoves})`);

    try {
      for (let i = 0; i < allFens.length; i++) {
        // Bail out if a new game started
        if (!this.postGameAnalysisRunning) return;

        this.analysisPanel.setStatus(`Analyzing game... (${i}/${totalMoves})`);

        try {
          const analysis = await this.stockfish.analyze(allFens[i], { depth: 16 });
          const isBlackToMove = allFens[i].split(' ')[1] === 'b';

          // Convert to white's perspective
          if (typeof analysis.evaluation === 'string') {
            let isNegative = analysis.evaluation.startsWith('-');
            if (isBlackToMove) isNegative = !isNegative;
            const mateNum = analysis.evaluation.replace(/[^\d]/g, '');
            evals.push(isNegative ? `-M${mateNum}` : `M${mateNum}`);
          } else {
            evals.push(isBlackToMove ? -analysis.evaluation : analysis.evaluation);
          }

          // Store best move analysis for each position before a move
          // (skip the last position — there's no move after it)
          if (i < allFens.length - 1) {
            const pvSan = analysis.pv
              ? uciToSanSequence(analysis.pv, allFens[i])
              : [];
            const bestMoveSan = pvSan.length > 0 ? pvSan[0] : analysis.bestMove;
            analyses.push({
              bestMove: analysis.bestMove,
              bestMoveSan,
              pv: analysis.pv || [],
              pvSan,
            });
          }
        } catch {
          evals.push(0);
          if (i < allFens.length - 1) analyses.push(null);
        }
      }

      // Compute classifications: compare eval before move vs eval after move
      // evals[0] = start position, evals[1] = after move 0, etc.
      const classifications: (MoveClassification | null)[] = [];

      for (let i = 0; i < totalMoves; i++) {
        const evalBefore = evals[i]; // Position before move i
        const evalAfter = evals[i + 1]; // Position after move i

        // Convert to win% from the moving side's perspective
        const isWhiteMove = i % 2 === 0;
        const wpBefore = evalToWinPercent(evalBefore);
        const wpAfter = evalToWinPercent(evalAfter);

        // From the moving side's perspective:
        // White's perspective: wpBefore is already correct
        // Black's perspective: invert (100 - wp)
        const sideBefore = isWhiteMove ? wpBefore : 100 - wpBefore;
        const sideAfter = isWhiteMove ? wpAfter : 100 - wpAfter;

        classifications.push(classifyMove(sideBefore, sideAfter));
      }

      this.state.classifications = classifications;
      this.state.evalHistory = evals;
      this.state.moveAnalyses = analyses;
      this.moveList.setClassifications(classifications);
      this.analysisPanel.setStatus('Analysis complete');
    } catch (error) {
      console.error('Post-game analysis error:', error);
      this.analysisPanel.setStatus('Analysis failed');
    } finally {
      this.postGameAnalysisRunning = false;
    }
  }

  /**
   * Handle game end
   */
  private handleGameEnd(status: string, extraMessage?: string, result?: string): void {
    this.state.isGameActive = false;
    this.state.isThinking = false;
    this.board.setInteractive(false);
    this.controls.setGameActive(false);

    // Clear saved game from localStorage (URL is kept for sharing/review)
    localStorage.removeItem('silly-chess-game-id');

    // Determine outcome and messages
    let outcome: 'win' | 'loss' | 'draw';
    let headline: string;
    let subtitle: string;
    const statusText = 'Use the arrow keys to review the game.';

    switch (status) {
      case 'checkmate': {
        const playerWon = (this.state.playerColor === 'white' && this.state.turn === 'b') ||
                         (this.state.playerColor === 'black' && this.state.turn === 'w');
        outcome = playerWon ? 'win' : 'loss';
        headline = playerWon ? 'You won!' : 'You lost';
        subtitle = 'by checkmate';
        break;
      }
      case 'stalemate':
        outcome = 'draw';
        headline = 'Draw';
        subtitle = 'by stalemate';
        break;
      case 'draw':
        outcome = 'draw';
        headline = 'Draw';
        subtitle = 'by agreement';
        break;
      case 'resigned': {
        // Determine if WE resigned or the opponent did using the game result
        const playerIsWhite = this.state.playerColor === 'white';
        const playerWonResign = (playerIsWhite && result === '1-0') || (!playerIsWhite && result === '0-1');
        if (extraMessage) {
          // Called from handleResign() — we resigned
          outcome = 'loss';
          headline = 'You resigned';
          subtitle = extraMessage;
        } else if (playerWonResign) {
          // Opponent resigned
          outcome = 'win';
          headline = 'You won!';
          subtitle = 'by resignation';
        } else {
          // Fallback (our own resign via server sync, or unknown)
          outcome = 'loss';
          headline = 'You resigned';
          subtitle = 'Better luck next time';
        }
        break;
      }
      default:
        outcome = 'draw';
        headline = 'Game over';
        subtitle = '';
    }

    this.setStatus(statusText);
    this.updateExplainButtonVisibility();
    this.showPostGameModal(outcome, headline, subtitle);

    // Run post-game analysis in the background
    this.updateAnalysisPanel(this.state.fen);
    this.runPostGameAnalysis();
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

    // Reset eval bar but keep move list and board for post-game review
    this.evalBar.reset();
  }

  /**
   * Handle explain - get AI explanation of current position
   */
  private async handleExplain(): Promise<void> {
    // Determine the FEN for the displayed position
    let fen: string;
    if (this.state.viewingHistoryIndex === -1) {
      fen = this.state.fen;
    } else if (this.state.viewingHistoryIndex === -2) {
      fen = this.START_FEN;
    } else {
      fen = this.state.fenHistory[this.state.viewingHistoryIndex] || this.state.fen;
    }

    // Build evaluation string from the eval bar's current value
    const rawEval = this.evalBar.getEvaluation();
    const evalText = typeof rawEval === 'string' ? rawEval : `${(rawEval / 100).toFixed(2)} pawns`;

    // Try to get best move from stockfish for context
    let bestMove: string | undefined;
    if (this.stockfish?.isReady()) {
      try {
        const analysis = await this.stockfish.analyze(fen, { depth: 12 });
        bestMove = analysis.bestMove;
      } catch {
        // Analysis optional for explanation
      }
    }

    await this.explanationPanel.explain({
      fen,
      evaluation: evalText,
      bestMove,
      playerColor: this.state.playerColor,
      moveHistory: this.state.sanMoves,
    });
  }

  /**
   * Update explain button visibility.
   * Show during review (history browsing or game over), hide during active play.
   */
  private updateExplainButtonVisibility(): void {
    const isReviewing = this.state.viewingHistoryIndex !== -1 || !this.state.isGameActive;
    const hasMoves = this.state.sanMoves.length > 0;
    this.explanationPanel.setButtonVisible(isReviewing && hasMoves);
    // Dismiss the panel when switching away from review mode
    if (!isReviewing) {
      this.explanationPanel.removePanel();
    }
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
   * Show post-game modal with result and action buttons
   */
  private showPostGameModal(outcome: 'win' | 'loss' | 'draw', headline: string, subtitle: string): void {
    this.removePostGameModal();
    this.injectPostGameStyles();

    const modal = document.createElement('div');
    modal.className = 'postgame-modal';
    modal.innerHTML = `
      <div class="postgame-overlay"></div>
      <div class="postgame-content">
        <div class="postgame-header postgame-${outcome}">
          <h2 class="postgame-headline">${headline}</h2>
          <p class="postgame-subtitle">${subtitle}</p>
        </div>
        <div class="postgame-actions">
          <button class="postgame-btn postgame-btn-review">Review Game</button>
          <button class="postgame-btn postgame-btn-learn" style="display:none;">Learn From Mistakes</button>
          <button class="postgame-btn postgame-btn-new">New Game</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Show the Learn button once analysis completes (poll for it)
    this.pollForAnalysisComplete(modal);

    modal.querySelector('.postgame-overlay')?.addEventListener('click', () => this.removePostGameModal());
    modal.querySelector('.postgame-btn-review')?.addEventListener('click', () => this.removePostGameModal());
    modal.querySelector('.postgame-btn-learn')?.addEventListener('click', () => {
      this.removePostGameModal();
      this.enterLearnMode();
    });
    modal.querySelector('.postgame-btn-new')?.addEventListener('click', () => {
      this.removePostGameModal();
      this.controls.showModal();
    });
  }

  /**
   * Remove post-game modal if present
   */
  private removePostGameModal(): void {
    document.querySelector('.postgame-modal')?.remove();
  }

  /**
   * Inject post-game modal styles (once)
   */
  private injectPostGameStyles(): void {
    if (document.getElementById('postgame-styles')) return;

    const style = document.createElement('style');
    style.id = 'postgame-styles';
    style.textContent = `
      .postgame-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
      }

      .postgame-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--overlay, rgba(0, 0, 0, 0.55));
        backdrop-filter: blur(4px);
      }

      .postgame-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--panel);
        color: var(--fg);
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        overflow: hidden;
        min-width: 340px;
        max-width: 420px;
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35);
        animation: postgame-pop 0.25s ease-out;
      }

      @keyframes postgame-pop {
        from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
        to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }

      .postgame-header {
        padding: 24px 28px 18px;
        text-align: center;
        border-bottom: 1px solid var(--panel-border);
      }

      .postgame-headline {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--fg);
      }

      .postgame-subtitle {
        margin: 6px 0 0;
        font-size: 14px;
        color: var(--fg-muted);
      }

      .postgame-actions {
        display: flex;
        gap: 10px;
        padding: 18px 24px 22px;
        justify-content: center;
      }

      .postgame-btn {
        flex: 1;
        padding: 10px 16px;
        border: 1px solid var(--btn-border);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        background: var(--btn);
        color: var(--fg);
        font-family: inherit;
      }

      .postgame-btn:hover {
        background: var(--btn-hover);
        transform: translateY(-1px);
      }

      .postgame-btn-new {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
      }

      .postgame-btn-new:hover {
        background: var(--accent);
        filter: brightness(1.05);
      }

      @media (max-width: 500px) {
        .postgame-content {
          min-width: 280px;
          max-width: 90vw;
        }

        .postgame-actions {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Poll for post-game analysis completion and show the Learn button if mistakes exist
   */
  private pollForAnalysisComplete(modal: HTMLElement): void {
    const learnBtn = modal.querySelector('.postgame-btn-learn') as HTMLElement | null;
    if (!learnBtn) return;

    const checkInterval = setInterval(() => {
      // Stop polling if modal was removed
      if (!document.body.contains(modal)) {
        clearInterval(checkInterval);
        return;
      }

      // Check if analysis is done (classifications populated)
      if (this.state.classifications.length > 0 && !this.postGameAnalysisRunning) {
        clearInterval(checkInterval);

        // Check if there are any player mistakes/blunders
        const hasMistakes = this.getPlayerMistakeIndices().length > 0;
        if (hasMistakes) {
          learnBtn.style.display = '';
        }
      }
    }, 500);

    // Stop polling after 60 seconds
    setTimeout(() => clearInterval(checkInterval), 60000);
  }

  /**
   * Get indices of the player's moves that were classified as mistakes or blunders
   */
  private getPlayerMistakeIndices(): number[] {
    const isWhite = this.state.playerColor === 'white';
    const indices: number[] = [];

    for (let i = 0; i < this.state.classifications.length; i++) {
      // Player's moves: even indices if white, odd indices if black
      const isPlayerMove = isWhite ? (i % 2 === 0) : (i % 2 === 1);
      if (!isPlayerMove) continue;

      const cls = this.state.classifications[i];
      if (cls === 'mistake' || cls === 'blunder') {
        indices.push(i);
      }
    }

    return indices;
  }

  /**
   * Enter learn mode: build mistake list, get best moves from Stockfish, navigate to first
   */
  private async enterLearnMode(): Promise<void> {
    const mistakeIndices = this.getPlayerMistakeIndices();
    if (mistakeIndices.length === 0) {
      this.setStatus('No mistakes to review!');
      return;
    }

    this.learnPanel.showLoading('Preparing puzzles...');
    this.board.setInteractive(false);
    this.setStatus('Preparing learn mode...');

    const mistakes: MistakeEntry[] = [];

    for (const idx of mistakeIndices) {
      // fenBefore is the position before the move at index idx
      const fenBefore = idx === 0 ? this.START_FEN : this.state.fenHistory[idx - 1];
      const fenAfter = this.state.fenHistory[idx];
      const playerMove = this.state.sanMoves[idx];
      const classification = this.state.classifications[idx] as string;

      // Eval from the evalHistory (white's perspective)
      const evalBefore = typeof this.state.evalHistory[idx] === 'number'
        ? this.state.evalHistory[idx] as number : 0;
      const evalAfter = typeof this.state.evalHistory[idx + 1] === 'number'
        ? this.state.evalHistory[idx + 1] as number : 0;

      // Get best move from Stockfish for this position
      try {
        const bestMoveUci = await this.stockfish.getBestMove(fenBefore, { depth: 16 });
        if (!bestMoveUci) continue;

        // Convert UCI to SAN using chess.js
        const tempChess = new Chess(fenBefore);
        const from = bestMoveUci.substring(0, 2);
        const to = bestMoveUci.substring(2, 4);
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : undefined;

        let bestMoveSan: string;
        try {
          const moveResult = tempChess.move({ from, to, promotion });
          bestMoveSan = moveResult.san;
        } catch {
          // If chess.js can't parse it, use the UCI notation
          bestMoveSan = bestMoveUci;
        }

        // Get eval after best move
        const bestMoveFen = tempChess.fen();
        let bestMoveEval = evalBefore;
        try {
          const analysis = await this.stockfish.analyze(bestMoveFen, { depth: 16 });
          const isBlackToMove = bestMoveFen.split(' ')[1] === 'b';
          if (typeof analysis.evaluation === 'number') {
            bestMoveEval = isBlackToMove ? -analysis.evaluation : analysis.evaluation;
          }
        } catch {
          // Use evalBefore as fallback
        }

        mistakes.push({
          moveIndex: idx,
          fenBefore,
          fenAfter,
          playerMove,
          bestMove: bestMoveUci,
          bestMoveSan,
          evalBefore,
          evalAfter,
          bestMoveEval,
          classification,
        });
      } catch (e) {
        console.error(`Failed to analyze mistake at index ${idx}:`, e);
      }
    }

    if (mistakes.length === 0) {
      this.setStatus('Could not prepare learn mode');
      return;
    }

    this.learnPanel.activate(mistakes);
    this.navigateToCurrentLearnMistake();
  }

  /**
   * Navigate the board to the current learn mode mistake position
   */
  private navigateToCurrentLearnMistake(): void {
    const mistake = this.learnPanel.getCurrentMistake();
    if (!mistake) return;

    this.board.setPosition(mistake.fenBefore);
    this.board.clearLastMove();
    this.board.setInteractive(true);
    this.updateEvaluation(mistake.fenBefore);
    this.setStatus('Find the best move!');
  }

  /**
   * Handle a player move while in learn mode
   */
  private async handleLearnModeMove(from: string, to: string, promotion?: string): Promise<void> {
    const mistake = this.learnPanel.getCurrentMistake();
    if (!mistake) return;

    // Disable board while checking
    this.board.setInteractive(false);

    // Play the move on a temp chess instance to get the resulting FEN
    const tempChess = new Chess(mistake.fenBefore);
    try {
      tempChess.move({ from, to, promotion });
    } catch {
      // Illegal move
      this.board.setInteractive(true);
      return;
    }

    const attemptedFen = tempChess.fen();

    // Show the attempted move on the board
    this.board.setPosition(attemptedFen);
    this.board.setLastMove(from, to);

    // Get Stockfish eval for the attempted move position
    let attemptedEval: number;
    try {
      const analysis = await this.stockfish.analyze(attemptedFen, { depth: 16 });
      const isBlackToMove = attemptedFen.split(' ')[1] === 'b';
      if (typeof analysis.evaluation === 'number') {
        attemptedEval = isBlackToMove ? -analysis.evaluation : analysis.evaluation;
      } else {
        // Mate score - treat as extreme
        attemptedEval = analysis.evaluation.startsWith('-') ? -10000 : 10000;
        const isBlack = attemptedFen.split(' ')[1] === 'b';
        if (isBlack) attemptedEval = -attemptedEval;
      }
    } catch {
      // Can't evaluate, treat as incorrect
      this.learnPanel.showIncorrect(mistake.bestMoveSan, mistake.bestMoveEval);
      this.showBestMoveOnBoard(mistake);
      return;
    }

    // Compare: is the attempted move within 50cp of the best move's eval?
    // Both evals are from white's perspective.
    // But we need to compare from the player's perspective.
    const isPlayerWhite = this.state.playerColor === 'white';
    const playerAttemptedEval = isPlayerWhite ? attemptedEval : -attemptedEval;
    const playerBestEval = isPlayerWhite ? mistake.bestMoveEval : -mistake.bestMoveEval;

    const evalDiff = playerBestEval - playerAttemptedEval;

    if (evalDiff <= 50) {
      // Correct (within 50cp)
      this.learnPanel.showCorrect(mistake.bestMoveSan, mistake.bestMoveEval);
      this.setStatus('Correct!');
    } else {
      // Incorrect
      this.learnPanel.showIncorrect(mistake.bestMoveSan, mistake.bestMoveEval);
      this.showBestMoveOnBoard(mistake);
      this.setStatus('Not quite - see the best move highlighted');
    }
  }

  /**
   * Show the best move highlighted on the board
   */
  private showBestMoveOnBoard(mistake: MistakeEntry): void {
    // Play the best move on a temp chess to show the resulting position
    const tempChess = new Chess(mistake.fenBefore);
    const from = mistake.bestMove.substring(0, 2);
    const to = mistake.bestMove.substring(2, 4);
    const promotion = mistake.bestMove.length > 4 ? mistake.bestMove[4] : undefined;

    try {
      tempChess.move({ from, to, promotion });
      this.board.setPosition(tempChess.fen());
      this.board.setLastMove(from, to);
    } catch {
      // Fallback: just highlight the squares on the original position
      this.board.setPosition(mistake.fenBefore);
      this.board.showHint(from, to);
    }
  }

  /**
   * Exit learn mode and return to normal post-game review
   */
  private exitLearnMode(): void {
    this.learnPanel.deactivate();
    this.board.setInteractive(false);
    this.board.setPosition(this.state.fen);
    this.board.clearLastMove();
    this.setStatus('Use \u2190 \u2192 to review the game.');
    this.updateEvaluation();
  }

  /**
   * Update status display
   */
  private setStatus(message: string): void {
    this.containers.status.textContent = message;
  }

  /**
   * Recompute captured pieces from the current SAN history and push the
   * totals into the top/bottom player bars. Top bar = opponent, bottom =
   * player; which physical side is "top" depends on the board orientation.
   */
  private updatePlayerBars(): void {
    const caps = computeCapturesFromSAN(this.state.sanMoves);
    const playerIsWhite = this.state.playerColor === 'white';

    // Player color controls which side goes on the bottom — the player is
    // always on the bottom since the board flips to match their color.
    const bottomColor = playerIsWhite ? 'white' : 'black';
    const topColor = playerIsWhite ? 'black' : 'white';

    const bottomCaptured = playerIsWhite ? caps.byWhite : caps.byBlack;
    const bottomScore = playerIsWhite ? caps.scoreWhite : caps.scoreBlack;
    const topCaptured = playerIsWhite ? caps.byBlack : caps.byWhite;
    const topScore = playerIsWhite ? caps.scoreBlack : caps.scoreWhite;

    // Mark whichever clock belongs to the side to move as "active"
    const whiteToMove = this.state.turn === 'w';
    const playerActive = (playerIsWhite && whiteToMove) || (!playerIsWhite && !whiteToMove);

    const opponentName = this.state.gameMode === 'vs-player' ? 'Opponent' : 'CPU';

    this.playerBarBottom.update({
      color: bottomColor,
      name: 'You',
      captured: bottomCaptured,
      score: bottomScore,
      clockMs: null,
      activeClock: this.state.isGameActive && playerActive,
    });

    this.playerBarTop.update({
      color: topColor,
      name: opponentName,
      captured: topCaptured,
      score: topScore,
      clockMs: null,
      activeClock: this.state.isGameActive && !playerActive,
    });
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
