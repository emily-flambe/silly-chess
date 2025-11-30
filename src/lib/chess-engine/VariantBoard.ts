/**
 * Variant Board - ffish-based implementation supporting chess variants
 *
 * Uses the ffish WASM library (Fairy-Stockfish based) for variant support.
 * Maintains the same interface as the chess.js-based Board class.
 */

import type { BoardState, Color, PieceType, Square, Move, CastlingRights } from '../../types';
import type { FairyStockfish, Board as FfishBoardType } from 'ffish';

// Use the default export which is the Module factory function
import ffish from 'ffish';

// Global ffish module reference
let ffishModule: FairyStockfish | null = null;
let ffishInitPromise: Promise<FairyStockfish> | null = null;

/**
 * Initialize ffish module (singleton)
 */
export async function initializeFfish(): Promise<FairyStockfish> {
  if (ffishModule) return ffishModule;

  if (ffishInitPromise) return ffishInitPromise;

  ffishInitPromise = ffish().then((module: FairyStockfish) => {
    ffishModule = module;
    return module;
  });

  return ffishInitPromise;
}

/**
 * Get available chess variants
 */
export function getAvailableVariants(): string[] {
  if (!ffishModule) return ['chess'];
  return ffishModule.variants().split(' ');
}

/**
 * Variant Board - supports 50+ chess variants via ffish
 */
export class VariantBoard {
  private board: FfishBoardType | null = null;
  private currentVariant: string;
  private moveHistoryStack: string[] = [];
  private initialized: boolean = false;

  constructor(variant: string = 'chess', _fen?: string) {
    this.currentVariant = variant;
    // Note: Must call initialize() before using the board
  }

  /**
   * Initialize the board (required due to async WASM loading)
   */
  async initialize(variant: string = this.currentVariant, fen?: string): Promise<void> {
    const module = await initializeFfish();

    if (this.board) {
      this.board.delete();
    }

    this.currentVariant = variant;
    // FairyStockfish.Board is a constructor-like interface
    const BoardConstructor = module.Board as unknown as new (variant?: string, fen?: string, is960?: boolean) => FfishBoardType;
    this.board = fen
      ? new BoardConstructor(variant, fen)
      : new BoardConstructor(variant);
    this.moveHistoryStack = [];
    this.initialized = true;
  }

  /**
   * Check if board is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.board !== null;
  }

  /**
   * Get current variant
   */
  getVariant(): string {
    return this.currentVariant;
  }

  /**
   * Get current board state
   */
  getState(): BoardState {
    if (!this.board) throw new Error('Board not initialized');

    const pieces = this.parseFenToPieces(this.board.fen());
    const castlingRights = this.getCastlingRights();

    return {
      pieces,
      turn: this.board.turn() ? 'white' : 'black',
      castlingRights,
      enPassantSquare: this.getEnPassantSquare(),
      halfMoveClock: this.board.halfmoveClock(),
      fullMoveNumber: this.board.fullmoveNumber(),
      moveHistory: this.getMoveHistory()
    };
  }

  /**
   * Make a move on the board
   */
  makeMove(move: { from: Square; to: Square; promotion?: PieceType }): Move | null {
    if (!this.board) throw new Error('Board not initialized');

    const uciMove = move.from + move.to + (move.promotion || '');
    const sanBefore = this.board.sanMove(uciMove);

    if (!this.board.push(uciMove)) {
      return null;
    }

    this.moveHistoryStack.push(uciMove);

    return {
      from: move.from,
      to: move.to,
      piece: this.inferPieceType(move.from),
      promotion: move.promotion,
      san: sanBefore,
      flags: {
        isCapture: this.wasCapture(uciMove),
        isPromotion: !!move.promotion,
        isCastleKingside: this.isCastleKingside(uciMove),
        isCastleQueenside: this.isCastleQueenside(uciMove),
        isEnPassant: false,
        isCheck: this.board.isCheck(),
        isCheckmate: this.isCheckmate()
      }
    };
  }

  /**
   * Undo the last move
   */
  undoMove(): Move | null {
    if (!this.board || this.moveHistoryStack.length === 0) return null;

    const lastMove = this.moveHistoryStack.pop()!;
    this.board.pop();

    return {
      from: lastMove.substring(0, 2) as Square,
      to: lastMove.substring(2, 4) as Square,
      piece: 'p',
      san: lastMove,
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
  }

  /**
   * Get all legal moves for a square
   */
  getLegalMoves(square: Square): Move[] {
    if (!this.board) return [];

    const allMoves = this.board.legalMoves().split(' ').filter(m => m);
    const squareMoves = allMoves.filter(m => m.startsWith(square));

    return squareMoves.map(uci => ({
      from: uci.substring(0, 2) as Square,
      to: uci.substring(2, 4) as Square,
      piece: this.inferPieceType(square),
      promotion: uci.length > 4 ? (uci[4] as PieceType) : undefined,
      san: this.board!.sanMove(uci),
      flags: {
        isCapture: false,
        isPromotion: uci.length > 4,
        isCastleKingside: false,
        isCastleQueenside: false,
        isEnPassant: false,
        isCheck: false,
        isCheckmate: false
      }
    }));
  }

  /**
   * Get all legal moves for current position
   */
  getAllLegalMoves(): Move[] {
    if (!this.board) return [];

    const allMoves = this.board.legalMoves().split(' ').filter(m => m);

    return allMoves.map(uci => ({
      from: uci.substring(0, 2) as Square,
      to: uci.substring(2, 4) as Square,
      piece: this.inferPieceType(uci.substring(0, 2) as Square),
      promotion: uci.length > 4 ? (uci[4] as PieceType) : undefined,
      san: this.board!.sanMove(uci),
      flags: {
        isCapture: false,
        isPromotion: uci.length > 4,
        isCastleKingside: false,
        isCastleQueenside: false,
        isEnPassant: false,
        isCheck: false,
        isCheckmate: false
      }
    }));
  }

  /**
   * Check if position is check
   */
  isCheck(): boolean {
    return this.board?.isCheck() ?? false;
  }

  /**
   * Check if position is checkmate
   */
  isCheckmate(): boolean {
    if (!this.board) return false;
    const result = this.board.result();
    return this.board.isGameOver() && (result.includes('1-0') || result.includes('0-1'));
  }

  /**
   * Check if position is stalemate
   */
  isStalemate(): boolean {
    if (!this.board) return false;
    return this.board.isGameOver() && this.board.result() === '1/2-1/2' && !this.board.isCheck();
  }

  /**
   * Check if position is draw
   */
  isDraw(): boolean {
    if (!this.board) return false;
    return this.board.isGameOver() && this.board.result() === '1/2-1/2';
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.board?.isGameOver() ?? false;
  }

  /**
   * Export position as FEN
   */
  toFEN(): string {
    return this.board?.fen() ?? '';
  }

  /**
   * Load position from FEN
   */
  loadFEN(fen: string): boolean {
    if (!this.board) return false;
    try {
      this.board.setFen(fen);
      this.moveHistoryStack = [];
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset board to initial position for current variant
   */
  reset(): void {
    this.board?.reset();
    this.moveHistoryStack = [];
  }

  /**
   * Get current turn
   */
  getTurn(): Color {
    return this.board?.turn() ? 'white' : 'black';
  }

  /**
   * Get piece at square (from FEN parsing)
   */
  getPiece(square: Square): { piece: PieceType; color: Color } | null {
    const pieces = this.parseFenToPieces(this.board?.fen() ?? '');
    return pieces.get(square) ?? null;
  }

  /**
   * Get ASCII representation of board
   */
  ascii(): string {
    return this.board?.toString() ?? '';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.board) {
      this.board.delete();
      this.board = null;
    }
    this.initialized = false;
  }

  // Private helper methods

  private parseFenToPieces(fen: string): Map<Square, { piece: PieceType; color: Color }> {
    const pieces = new Map<Square, { piece: PieceType; color: Color }>();
    if (!fen) return pieces;

    const position = fen.split(' ')[0];
    const ranks = position.split('/');

    ranks.forEach((rank, rankIndex) => {
      let fileIndex = 0;
      for (const char of rank) {
        if (/[1-8]/.test(char)) {
          fileIndex += parseInt(char, 10);
        } else {
          const file = String.fromCharCode(97 + fileIndex);
          const rankNum = 8 - rankIndex;
          const square = `${file}${rankNum}` as Square;

          const color: Color = char === char.toUpperCase() ? 'white' : 'black';
          const pieceType = char.toLowerCase() as PieceType;

          pieces.set(square, { piece: pieceType, color });
          fileIndex++;
        }
      }
    });

    return pieces;
  }

  private getCastlingRights(): CastlingRights {
    const fen = this.board?.fen() ?? '';
    const castlingPart = fen.split(' ')[2] || '-';

    return {
      whiteKingside: castlingPart.includes('K'),
      whiteQueenside: castlingPart.includes('Q'),
      blackKingside: castlingPart.includes('k'),
      blackQueenside: castlingPart.includes('q')
    };
  }

  private getEnPassantSquare(): Square | null {
    const fen = this.board?.fen() ?? '';
    const epSquare = fen.split(' ')[3];
    return epSquare && epSquare !== '-' ? (epSquare as Square) : null;
  }

  private getMoveHistory(): Move[] {
    return this.moveHistoryStack.map(uci => ({
      from: uci.substring(0, 2) as Square,
      to: uci.substring(2, 4) as Square,
      piece: 'p' as PieceType,
      san: uci,
      flags: {
        isCapture: false,
        isPromotion: uci.length > 4,
        isCastleKingside: false,
        isCastleQueenside: false,
        isEnPassant: false,
        isCheck: false,
        isCheckmate: false
      }
    }));
  }

  private inferPieceType(square: Square): PieceType {
    const piece = this.getPiece(square);
    return piece?.piece ?? 'p';
  }

  private wasCapture(_uciMove: string): boolean {
    return false;
  }

  private isCastleKingside(uciMove: string): boolean {
    return uciMove === 'e1g1' || uciMove === 'e8g8';
  }

  private isCastleQueenside(uciMove: string): boolean {
    return uciMove === 'e1c1' || uciMove === 'e8c8';
  }
}
