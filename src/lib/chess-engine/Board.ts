/**
 * Board State Management - Wraps chess.js for extensibility
 */

import { Chess } from 'chess.js';
import type { BoardState, Color, PieceType, Square, Move, CastlingRights } from '../../types';

export class Board {
  private game: Chess;

  constructor(fen?: string) {
    this.game = fen ? new Chess(fen) : new Chess();
  }

  /**
   * Get current board state matching BoardState interface
   */
  getState(): BoardState {
    const board = this.game.board();
    const pieces = new Map<Square, { piece: PieceType; color: Color }>();

    // Build pieces map from chess.js board representation
    board.forEach((row, rankIndex) => {
      row.forEach((square, fileIndex) => {
        if (square !== null) {
          const file = String.fromCharCode(97 + fileIndex); // a-h
          const rank = 8 - rankIndex; // 1-8
          const squareName = `${file}${rank}` as Square;

          pieces.set(squareName, {
            piece: square.type as PieceType,
            color: square.color === 'w' ? 'white' : 'black'
          });
        }
      });
    });

    // Extract castling rights
    const castlingRights = this.getCastlingRights();

    // Get en passant square
    const epSquare = this.game.history({ verbose: true }).slice(-1)[0];
    const enPassantSquare = epSquare?.flags.includes('e')
      ? this.calculateEnPassantSquare(epSquare)
      : null;

    return {
      pieces,
      turn: this.game.turn() === 'w' ? 'white' : 'black',
      castlingRights,
      enPassantSquare,
      halfMoveClock: this.getHalfMoveClock(),
      fullMoveNumber: this.getFullMoveNumber(),
      moveHistory: this.getMoveHistory()
    };
  }

  /**
   * Make a move on the board
   */
  makeMove(move: { from: Square; to: Square; promotion?: PieceType }): Move | null {
    try {
      const result = this.game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion
      });

      if (!result) return null;

      return this.convertMove(result);
    } catch {
      return null;
    }
  }

  /**
   * Undo the last move
   */
  undoMove(): Move | null {
    const result = this.game.undo();
    if (!result) return null;
    return this.convertMove(result);
  }

  /**
   * Get all legal moves for a square
   */
  getLegalMoves(square: Square): Move[] {
    const moves = this.game.moves({ square: square as any, verbose: true });
    return moves.map(m => this.convertMove(m));
  }

  /**
   * Get all legal moves for current position
   */
  getAllLegalMoves(): Move[] {
    const moves = this.game.moves({ verbose: true });
    return moves.map(m => this.convertMove(m));
  }

  /**
   * Check if position is check
   */
  isCheck(): boolean {
    return this.game.isCheck();
  }

  /**
   * Check if position is checkmate
   */
  isCheckmate(): boolean {
    return this.game.isCheckmate();
  }

  /**
   * Check if position is stalemate
   */
  isStalemate(): boolean {
    return this.game.isStalemate();
  }

  /**
   * Check if position is draw
   */
  isDraw(): boolean {
    return this.game.isDraw();
  }

  /**
   * Check if position is insufficient material
   */
  isInsufficientMaterial(): boolean {
    return this.game.isInsufficientMaterial();
  }

  /**
   * Check if position is threefold repetition
   */
  isThreefoldRepetition(): boolean {
    return this.game.isThreefoldRepetition();
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  /**
   * Export position as FEN
   */
  toFEN(): string {
    return this.game.fen();
  }

  /**
   * Load position from FEN
   */
  loadFEN(fen: string): boolean {
    try {
      this.game.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export game as PGN
   */
  toPGN(): string {
    return this.game.pgn();
  }

  /**
   * Load game from PGN
   */
  loadPGN(pgn: string): boolean {
    try {
      this.game.loadPgn(pgn);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset board to initial position
   */
  reset(): void {
    this.game.reset();
  }

  /**
   * Get current turn
   */
  getTurn(): Color {
    return this.game.turn() === 'w' ? 'white' : 'black';
  }

  /**
   * Get piece at square
   */
  getPiece(square: Square): { piece: PieceType; color: Color } | null {
    const piece = this.game.get(square as any);
    if (!piece) return null;

    return {
      piece: piece.type as PieceType,
      color: piece.color === 'w' ? 'white' : 'black'
    };
  }

  /**
   * Get ASCII representation of board
   */
  ascii(): string {
    return this.game.ascii();
  }

  // Private helper methods

  private getCastlingRights(): CastlingRights {
    const fen = this.game.fen();
    const castlingPart = fen.split(' ')[2];

    return {
      whiteKingside: castlingPart.includes('K'),
      whiteQueenside: castlingPart.includes('Q'),
      blackKingside: castlingPart.includes('k'),
      blackQueenside: castlingPart.includes('q')
    };
  }

  private getHalfMoveClock(): number {
    const fen = this.game.fen();
    return parseInt(fen.split(' ')[4], 10);
  }

  private getFullMoveNumber(): number {
    const fen = this.game.fen();
    return parseInt(fen.split(' ')[5], 10);
  }

  private getMoveHistory(): Move[] {
    const history = this.game.history({ verbose: true });
    return history.map(m => this.convertMove(m));
  }

  private calculateEnPassantSquare(move: any): Square | null {
    // If last move was a pawn double push, calculate en passant square
    if (move.piece === 'p' && Math.abs(parseInt(move.to[1]) - parseInt(move.from[1])) === 2) {
      const file = move.from[0];
      const rank = move.color === 'w' ? '3' : '6';
      return `${file}${rank}` as Square;
    }
    return null;
  }

  private convertMove(chessJsMove: any): Move {
    return {
      from: chessJsMove.from,
      to: chessJsMove.to,
      piece: chessJsMove.piece as PieceType,
      captured: chessJsMove.captured as PieceType | undefined,
      promotion: chessJsMove.promotion as PieceType | undefined,
      san: chessJsMove.san,
      flags: {
        isCapture: chessJsMove.flags.includes('c') || chessJsMove.flags.includes('e'),
        isPromotion: chessJsMove.flags.includes('p'),
        isCastleKingside: chessJsMove.flags.includes('k'),
        isCastleQueenside: chessJsMove.flags.includes('q'),
        isEnPassant: chessJsMove.flags.includes('e'),
        isCheck: this.game.isCheck(),
        isCheckmate: this.game.isCheckmate()
      }
    };
  }
}
