/**
 * Rule Engine - Standard chess rules implementation
 */

import type { RuleSet, BoardState, Color, Move, Square, DrawReason, PieceDefinition } from '../../types';
import { Board } from './Board';
import { PieceFactory } from './Piece';

/**
 * Standard chess rules
 */
export class StandardRules implements RuleSet {
  name = 'Standard Chess';
  private board: Board;

  constructor(board?: Board) {
    this.board = board || new Board();
  }

  /**
   * Check if position is checkmate
   */
  isCheckmate(board: BoardState): Color | null {
    // Use internal board state
    const isCheckmate = this.board.isCheckmate();
    if (!isCheckmate) return null;

    // Return the color that is checkmated (opposite of current turn)
    return board.turn === 'white' ? 'black' : 'white';
  }

  /**
   * Check if position is stalemate
   */
  isStalemate(board: BoardState): boolean {
    return this.board.isStalemate();
  }

  /**
   * Check if position is a draw
   */
  isDraw(board: BoardState): DrawReason | null {
    if (this.board.isStalemate()) {
      return 'stalemate';
    }

    if (this.board.isThreefoldRepetition()) {
      return 'threefold';
    }

    if (this.board.isInsufficientMaterial()) {
      return 'insufficient';
    }

    // Check fifty-move rule
    if (board.halfMoveClock >= 100) {
      return 'fifty-move';
    }

    return null;
  }

  /**
   * Check if a move is legal
   */
  isLegalMove(move: Move, board: BoardState): boolean {
    const legalMoves = this.board.getLegalMoves(move.from);
    return legalMoves.some(
      m =>
        m.to === move.to &&
        (move.promotion === undefined || m.promotion === move.promotion)
    );
  }

  /**
   * Check if castling is possible
   */
  canCastle(board: BoardState, side: 'kingside' | 'queenside', color: Color): boolean {
    // Check castling rights
    const rights = board.castlingRights;
    let hasRight = false;

    if (color === 'white') {
      hasRight = side === 'kingside' ? rights.whiteKingside : rights.whiteQueenside;
    } else {
      hasRight = side === 'kingside' ? rights.blackKingside : rights.blackQueenside;
    }

    if (!hasRight) return false;

    // Check if king is in check (can't castle out of check)
    if (this.board.isCheck()) return false;

    // Additional checks are handled by chess.js internally
    const kingSquare = this.findKing(board, color);
    if (!kingSquare) return false;

    const targetSquare = this.getCastleTargetSquare(kingSquare, side);
    const legalMoves = this.board.getLegalMoves(kingSquare);

    return legalMoves.some(m => m.to === targetSquare);
  }

  /**
   * Get en passant target square
   */
  getEnPassantTarget(board: BoardState): Square | null {
    return board.enPassantSquare;
  }

  /**
   * Get initial chess position
   */
  getInitialPosition(): BoardState {
    const board = new Board();
    return board.getState();
  }

  /**
   * Get all available piece types
   */
  getAvailablePieces(): PieceDefinition[] {
    return PieceFactory.getAllPieces();
  }

  /**
   * Check if king is in check
   */
  isCheck(board: BoardState): boolean {
    return this.board.isCheck();
  }

  /**
   * Get all legal moves for current position
   */
  getAllLegalMoves(board: BoardState): Move[] {
    return this.board.getAllLegalMoves();
  }

  /**
   * Get legal moves for a specific square
   */
  getLegalMovesForSquare(board: BoardState, square: Square): Move[] {
    return this.board.getLegalMoves(square);
  }

  /**
   * Check if game is over
   */
  isGameOver(board: BoardState): boolean {
    return this.board.isGameOver();
  }

  /**
   * Get game result
   */
  getGameResult(board: BoardState): string {
    if (!this.isGameOver(board)) {
      return '*'; // Game in progress
    }

    const checkmated = this.isCheckmate(board);
    if (checkmated) {
      return checkmated === 'white' ? '0-1' : '1-0';
    }

    if (this.isDraw(board)) {
      return '1/2-1/2';
    }

    return '*';
  }

  // Private helper methods

  private findKing(board: BoardState, color: Color): Square | null {
    for (const [square, piece] of board.pieces.entries()) {
      if (piece.piece === 'k' && piece.color === color) {
        return square;
      }
    }
    return null;
  }

  private getCastleTargetSquare(kingSquare: Square, side: 'kingside' | 'queenside'): Square {
    const rank = kingSquare[1];
    const file = side === 'kingside' ? 'g' : 'c';
    return `${file}${rank}` as Square;
  }
}

/**
 * Rule validator for checking move legality
 */
export class RuleValidator {
  private rules: RuleSet;

  constructor(rules: RuleSet) {
    this.rules = rules;
  }

  /**
   * Validate move against rule set
   */
  validateMove(move: Move, board: BoardState): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: []
    };

    // Check if move is legal according to rules
    if (!this.rules.isLegalMove(move, board)) {
      result.valid = false;
      result.errors.push('Move is not legal');
      return result;
    }

    // Additional validation checks can be added here

    return result;
  }

  /**
   * Get all violations in current position
   */
  getViolations(board: BoardState): string[] {
    const violations: string[] = [];

    // Check for basic rule violations
    // This is a placeholder for custom rule validation

    return violations;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
