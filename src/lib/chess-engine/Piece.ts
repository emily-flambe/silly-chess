/**
 * Piece Definitions - Abstract piece and standard chess pieces
 */

import type { PieceDefinition, BoardState, Square, Move, PieceType } from '../../types';

/**
 * Abstract base piece class
 */
export abstract class Piece implements PieceDefinition {
  abstract id: string;
  abstract name: string;
  abstract symbol: string;
  abstract svg: string;

  abstract getMoves(board: BoardState, position: Square): Move[];

  canCapture?(target: PieceDefinition): boolean {
    // Default: can capture any piece except king
    return target.id !== 'k';
  }

  onMove?(move: Move, board: BoardState): void {
    // Default: no special behavior
  }

  abstract getValue(): number;
}

/**
 * Standard Chess Pieces
 */

export class King extends Piece {
  id = 'k' as const;
  name = 'King';
  symbol = 'K';
  svg = '♔'; // Unicode chess symbol

  getMoves(board: BoardState, position: Square): Move[] {
    // King moves are handled by Rules/Board
    // This is a placeholder for the interface
    return [];
  }

  getValue(): number {
    return Infinity; // King is invaluable
  }

  canCapture(target: PieceDefinition): boolean {
    // King cannot capture a protected piece (handled by Rules)
    return target.id !== 'k';
  }
}

export class Queen extends Piece {
  id = 'q' as const;
  name = 'Queen';
  symbol = 'Q';
  svg = '♕';

  getMoves(board: BoardState, position: Square): Move[] {
    return [];
  }

  getValue(): number {
    return 9;
  }
}

export class Rook extends Piece {
  id = 'r' as const;
  name = 'Rook';
  symbol = 'R';
  svg = '♖';

  getMoves(board: BoardState, position: Square): Move[] {
    return [];
  }

  getValue(): number {
    return 5;
  }
}

export class Bishop extends Piece {
  id = 'b' as const;
  name = 'Bishop';
  symbol = 'B';
  svg = '♗';

  getMoves(board: BoardState, position: Square): Move[] {
    return [];
  }

  getValue(): number {
    return 3;
  }
}

export class Knight extends Piece {
  id = 'n' as const;
  name = 'Knight';
  symbol = 'N';
  svg = '♘';

  getMoves(board: BoardState, position: Square): Move[] {
    return [];
  }

  getValue(): number {
    return 3;
  }
}

export class Pawn extends Piece {
  id = 'p' as const;
  name = 'Pawn';
  symbol = 'P';
  svg = '♙';

  getMoves(board: BoardState, position: Square): Move[] {
    return [];
  }

  getValue(): number {
    return 1;
  }
}

/**
 * Piece factory for creating piece instances
 */
export class PieceFactory {
  private static pieces: Map<PieceType, PieceDefinition> = new Map<PieceType, PieceDefinition>([
    ['k' as PieceType, new King()],
    ['q' as PieceType, new Queen()],
    ['r' as PieceType, new Rook()],
    ['b' as PieceType, new Bishop()],
    ['n' as PieceType, new Knight()],
    ['p' as PieceType, new Pawn()]
  ]);

  static getPiece(type: PieceType): PieceDefinition {
    const piece = this.pieces.get(type);
    if (!piece) {
      throw new Error(`Unknown piece type: ${type}`);
    }
    return piece;
  }

  static getAllPieces(): PieceDefinition[] {
    return Array.from(this.pieces.values());
  }

  static registerPiece(type: PieceType, piece: PieceDefinition): void {
    this.pieces.set(type, piece);
  }
}
