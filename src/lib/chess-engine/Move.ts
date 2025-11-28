/**
 * Move Representation and Validation
 */

import type { Move, Square, PieceType, MoveFlags, BoardState } from '../../types';
import { Board } from './Board';

/**
 * Move validator and utilities
 */
export class MoveValidator {
  private board: Board;

  constructor(board: Board) {
    this.board = board;
  }

  /**
   * Validate if a move is legal
   */
  isLegalMove(from: Square, to: Square, promotion?: PieceType): boolean {
    const legalMoves = this.board.getLegalMoves(from);
    return legalMoves.some(
      move =>
        move.to === to &&
        (promotion === undefined || move.promotion === promotion)
    );
  }

  /**
   * Get legal moves for a square
   */
  getLegalMoves(square: Square): Move[] {
    return this.board.getLegalMoves(square);
  }

  /**
   * Parse algebraic notation to move
   */
  parseAlgebraic(san: string): Move | null {
    // This would require more complex parsing
    // For now, rely on chess.js internal parsing
    // through the Board.makeMove method
    return null;
  }

  /**
   * Convert move to algebraic notation
   */
  toAlgebraic(move: Move): string {
    return move.san || `${move.from}${move.to}`;
  }

  /**
   * Get all legal moves in current position
   */
  getAllLegalMoves(): Move[] {
    return this.board.getAllLegalMoves();
  }
}

/**
 * Move history tracker
 */
export class MoveHistory {
  private moves: Move[] = [];

  add(move: Move): void {
    this.moves.push(move);
  }

  undo(): Move | undefined {
    return this.moves.pop();
  }

  getAll(): Move[] {
    return [...this.moves];
  }

  getLast(): Move | undefined {
    return this.moves[this.moves.length - 1];
  }

  clear(): void {
    this.moves = [];
  }

  count(): number {
    return this.moves.length;
  }

  /**
   * Export as PGN format
   */
  toPGN(): string {
    let pgn = '';
    let moveNumber = 1;

    for (let i = 0; i < this.moves.length; i++) {
      const move = this.moves[i];

      // Add move number for white's moves
      if (i % 2 === 0) {
        pgn += `${moveNumber}. `;
      }

      pgn += move.san || `${move.from}${move.to}`;

      // Add space between moves
      if (i % 2 === 0) {
        pgn += ' ';
      } else {
        pgn += ' ';
        moveNumber++;
      }
    }

    return pgn.trim();
  }

  /**
   * Get move statistics
   */
  getStats(): MoveStats {
    const stats: MoveStats = {
      totalMoves: this.moves.length,
      captures: 0,
      checks: 0,
      castles: 0,
      promotions: 0,
      enPassant: 0
    };

    for (const move of this.moves) {
      if (move.flags.isCapture) stats.captures++;
      if (move.flags.isCheck) stats.checks++;
      if (move.flags.isCastleKingside || move.flags.isCastleQueenside) stats.castles++;
      if (move.flags.isPromotion) stats.promotions++;
      if (move.flags.isEnPassant) stats.enPassant++;
    }

    return stats;
  }
}

export interface MoveStats {
  totalMoves: number;
  captures: number;
  checks: number;
  castles: number;
  promotions: number;
  enPassant: number;
}

/**
 * Move builder for constructing moves
 */
export class MoveBuilder {
  private move: Partial<Move> = {
    flags: {
      isCapture: false,
      isPromotion: false,
      isCastleKingside: false,
      isCastleQueenside: false,
      isEnPassant: false,
      isCheck: false,
      isCheckmate: false
    }
  };

  from(square: Square): this {
    this.move.from = square;
    return this;
  }

  to(square: Square): this {
    this.move.to = square;
    return this;
  }

  piece(type: PieceType): this {
    this.move.piece = type;
    return this;
  }

  captured(type: PieceType): this {
    this.move.captured = type;
    if (this.move.flags) {
      this.move.flags.isCapture = true;
    }
    return this;
  }

  promotion(type: PieceType): this {
    this.move.promotion = type;
    if (this.move.flags) {
      this.move.flags.isPromotion = true;
    }
    return this;
  }

  san(notation: string): this {
    this.move.san = notation;
    return this;
  }

  setFlag(flag: keyof MoveFlags, value: boolean): this {
    if (this.move.flags) {
      this.move.flags[flag] = value;
    }
    return this;
  }

  build(): Move {
    if (!this.move.from || !this.move.to || !this.move.piece || !this.move.flags) {
      throw new Error('Move is incomplete');
    }

    return this.move as Move;
  }
}
