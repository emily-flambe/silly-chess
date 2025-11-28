/**
 * Chess Engine - Main exports
 *
 * Wraps chess.js with extensible interfaces for future variant support
 */

// Core classes
import { Board } from './Board';
import {
  Piece,
  King,
  Queen,
  Rook,
  Bishop,
  Knight,
  Pawn,
  PieceFactory
} from './Piece';
import {
  MoveValidator,
  MoveHistory,
  MoveBuilder,
  type MoveStats
} from './Move';
import {
  StandardRules,
  RuleValidator,
  type ValidationResult
} from './Rules';

// Re-export everything
export { Board };
export {
  Piece,
  King,
  Queen,
  Rook,
  Bishop,
  Knight,
  Pawn,
  PieceFactory
};
export {
  MoveValidator,
  MoveHistory,
  MoveBuilder,
  type MoveStats
};
export {
  StandardRules,
  RuleValidator,
  type ValidationResult
};

// Re-export types for convenience
export type {
  BoardState,
  Move,
  MoveFlags,
  PieceDefinition,
  RuleSet,
  Color,
  PieceType,
  Square,
  CastlingRights,
  DrawReason,
  GameResult
} from '../../types';

/**
 * Chess Engine Factory - Creates a complete chess game instance
 */
export class ChessEngine {
  public board: Board;
  public rules: StandardRules;
  public moveValidator: MoveValidator;
  public moveHistory: MoveHistory;

  constructor(fen?: string) {
    this.board = new Board(fen);
    this.rules = new StandardRules(this.board);
    this.moveValidator = new MoveValidator(this.board);
    this.moveHistory = new MoveHistory();
  }

  /**
   * Make a move
   */
  move(from: string, to: string, promotion?: string): boolean {
    const result = this.board.makeMove({
      from,
      to,
      promotion: promotion as any
    });

    if (result) {
      this.moveHistory.add(result);
      return true;
    }

    return false;
  }

  /**
   * Undo last move
   */
  undo(): boolean {
    const move = this.board.undoMove();
    if (move) {
      this.moveHistory.undo();
      return true;
    }
    return false;
  }

  /**
   * Get current position state
   */
  getState() {
    return this.board.getState();
  }

  /**
   * Get all legal moves
   */
  getLegalMoves(square?: string) {
    if (square) {
      return this.board.getLegalMoves(square);
    }
    return this.board.getAllLegalMoves();
  }

  /**
   * Check game status
   */
  getStatus() {
    const state = this.board.getState();
    return {
      isCheck: this.board.isCheck(),
      isCheckmate: this.board.isCheckmate(),
      isStalemate: this.board.isStalemate(),
      isDraw: this.board.isDraw(),
      isGameOver: this.board.isGameOver(),
      turn: this.board.getTurn(),
      result: this.rules.getGameResult(state)
    };
  }

  /**
   * Load position from FEN
   */
  loadFEN(fen: string): boolean {
    return this.board.loadFEN(fen);
  }

  /**
   * Export position as FEN
   */
  getFEN(): string {
    return this.board.toFEN();
  }

  /**
   * Load game from PGN
   */
  loadPGN(pgn: string): boolean {
    return this.board.loadPGN(pgn);
  }

  /**
   * Export game as PGN
   */
  getPGN(): string {
    return this.board.toPGN();
  }

  /**
   * Reset to initial position
   */
  reset(): void {
    this.board.reset();
    this.moveHistory.clear();
  }

  /**
   * Get ASCII representation
   */
  ascii(): string {
    return this.board.ascii();
  }
}

/**
 * Quick factory function
 */
export function createChessGame(fen?: string): ChessEngine {
  return new ChessEngine(fen);
}
