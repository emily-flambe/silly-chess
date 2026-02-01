/**
 * Chess Board Component
 *
 * Interactive chess board with piece movement support.
 * Supports click-to-move and displays legal moves.
 * Can operate with ChessEngine (legacy) or FEN-based positioning (server mode).
 */

import type { ChessEngine } from '../../lib/chess-engine';
import type { Color } from '../../types';

export interface BoardOptions {
  flipped?: boolean;
  interactive?: boolean;
  showCoordinates?: boolean;
}

type MoveCallback = (from: string, to: string) => void;

// Use the same filled symbols for both colors - we'll style with CSS
const PIECE_SYMBOLS: Record<string, string> = {
  'K': '\u265A', // King (filled)
  'Q': '\u265B', // Queen (filled)
  'R': '\u265C', // Rook (filled)
  'B': '\u265D', // Bishop (filled)
  'N': '\u265E', // Knight (filled)
  'P': '\u265F', // Pawn (filled)
};

// Piece info parsed from FEN
interface PieceInfo {
  piece: string;
  color: Color;
}

export class ChessBoard {
  private container: HTMLElement;
  private boardElement: HTMLElement;
  private engine: ChessEngine | null = null;
  private options: Required<BoardOptions>;
  private selectedSquare: string | null = null;
  private legalMoves: string[] = [];
  private lastMove: { from: string; to: string } | null = null;
  private moveCallbacks: MoveCallback[] = [];
  private highlightedSquares: Map<string, string> = new Map();
  
  // FEN-based state (for server-authoritative mode)
  private currentFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  private fenPieces: Map<string, PieceInfo> = new Map();
  private fenTurn: Color = 'white';

  constructor(container: HTMLElement, options: BoardOptions = {}) {
    this.container = container;
    this.options = {
      flipped: options.flipped ?? false,
      interactive: options.interactive ?? true,
      showCoordinates: options.showCoordinates ?? true
    };

    // Clear container before adding board
    this.container.innerHTML = '';
    this.boardElement = this.createBoardElement();
    this.container.appendChild(this.boardElement);
    this.render();
  }

  /**
   * Create the board DOM structure
   */
  private createBoardElement(): HTMLElement {
    const board = document.createElement('div');
    board.className = 'chess-board';
    if (this.options.flipped) {
      board.classList.add('flipped');
    }

    // Create 64 squares
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = this.createSquare(file, rank);
        board.appendChild(square);
      }
    }

    // Add coordinate labels if enabled
    if (this.options.showCoordinates) {
      this.addCoordinates(board);
    }

    return board;
  }

  /**
   * Create a single square element
   */
  private createSquare(file: number, rank: number): HTMLElement {
    const square = document.createElement('div');
    const squareName = this.getSquareName(file, rank);
    const isLight = (file + rank) % 2 === 1;

    square.className = `square ${isLight ? 'light' : 'dark'}`;
    square.dataset.square = squareName;
    square.dataset.file = String(file);
    square.dataset.rank = String(rank);

    // Always add event listeners - interactivity is checked in the handler
    square.addEventListener('click', () => this.handleSquareClick(squareName));
    square.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleSquareClick(squareName);
    });

    return square;
  }

  /**
   * Add coordinate labels to the board
   */
  private addCoordinates(board: HTMLElement): void {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    // Add file labels (a-h) at bottom
    files.forEach((file, index) => {
      const label = document.createElement('div');
      label.className = 'coordinate file-coord';
      label.textContent = file;
      label.style.gridColumn = String(index + 1);
      label.style.gridRow = '9';
      board.appendChild(label);
    });

    // Add rank labels (1-8) on right side
    ranks.forEach((rank, index) => {
      const label = document.createElement('div');
      label.className = 'coordinate rank-coord';
      label.textContent = rank;
      label.style.gridColumn = '9';
      label.style.gridRow = String(8 - index);
      board.appendChild(label);
    });
  }

  /**
   * Get square name from file and rank indices
   */
  private getSquareName(file: number, rank: number): string {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return files[file] + (rank + 1);
  }

  /**
   * Handle square click
   */
  private handleSquareClick(square: string): void {
    if (!this.options.interactive) return;
    
    // In FEN mode (no engine), allow piece selection and move attempts
    const hasPieces = this.engine || this.fenPieces.size > 0;
    if (!hasPieces) return;

    // If no square selected, try to select this square
    if (!this.selectedSquare) {
      this.selectSquare(square);
    } else {
      // If clicking the same square, deselect it
      if (this.selectedSquare === square) {
        this.deselectSquare();
      } else if (this.engine && this.legalMoves.includes(square)) {
        // If we have engine and this is a legal move, make the move
        this.makeMove(this.selectedSquare, square);
      } else if (!this.engine) {
        // In FEN mode, always attempt the move (server validates)
        this.makeMove(this.selectedSquare, square);
      } else {
        // Otherwise, try to select the new square
        this.deselectSquare();
        this.selectSquare(square);
      }
    }
  }

  /**
   * Select a square and show legal moves
   */
  private selectSquare(square: string): void {
    // Check if there's a piece on this square
    const piece = this.getPieceAt(square);
    if (!piece) return;

    // If we have engine, use it for legal moves
    if (this.engine) {
      const moves = this.engine.getLegalMoves(square);
      if (moves.length === 0) return;
      this.legalMoves = moves.map(m => m.to);
    } else {
      // In FEN mode, we don't know legal moves - server validates
      this.legalMoves = [];
    }

    this.selectedSquare = square;

    // Highlight selected square
    const squareElement = this.getSquareElement(square);
    if (squareElement) {
      squareElement.classList.add('selected');
    }

    // Show legal move indicators (only if we have engine)
    if (this.engine) {
      this.legalMoves.forEach(move => {
        const targetSquare = this.getSquareElement(move);
        if (targetSquare) {
          const targetPiece = this.getPieceAt(move);
          if (targetPiece) {
            targetSquare.classList.add('legal-capture');
          } else {
            targetSquare.classList.add('legal-move');
          }
        }
      });
    }
  }

  /**
   * Deselect current square and clear legal move highlights
   */
  private deselectSquare(): void {
    if (this.selectedSquare) {
      const squareElement = this.getSquareElement(this.selectedSquare);
      if (squareElement) {
        squareElement.classList.remove('selected');
      }
    }

    // Clear legal move highlights
    this.legalMoves.forEach(move => {
      const targetSquare = this.getSquareElement(move);
      if (targetSquare) {
        targetSquare.classList.remove('legal-move', 'legal-capture');
      }
    });

    this.selectedSquare = null;
    this.legalMoves = [];
  }

  /**
   * Make a move
   */
  private makeMove(from: string, to: string): void {
    this.deselectSquare();

    // Clear any previous move highlight - highlighting is only for selection preview
    this.lastMove = null;

    // Notify listeners
    this.moveCallbacks.forEach(callback => callback(from, to));

    this.render();
  }

  /**
   * Get square element by name
   */
  private getSquareElement(square: string): HTMLElement | null {
    return this.boardElement.querySelector(`[data-square="${square}"]`);
  }

  /**
   * Get piece at square from engine or FEN state
   */
  private getPieceAt(square: string): { piece: string; color: Color } | null {
    if (this.engine) {
      const state = this.engine.getState();
      return state.pieces.get(square) || null;
    }
    
    // FEN-based mode
    return this.fenPieces.get(square) || null;
  }

  /**
   * Render the board based on current engine state or FEN
   */
  private render(): void {
    // Clear all pieces and highlights
    this.clearBoard();

    // Get pieces from engine or FEN state
    const pieces = this.engine 
      ? this.engine.getState().pieces 
      : this.fenPieces;

    // Place pieces
    pieces.forEach((pieceInfo, square) => {
      const squareElement = this.getSquareElement(square);
      if (squareElement) {
        const pieceElement = document.createElement('div');
        pieceElement.className = `piece piece-${pieceInfo.color}`;
        const pieceKey = pieceInfo.piece.toUpperCase();
        pieceElement.textContent = PIECE_SYMBOLS[pieceKey] || pieceInfo.piece;
        squareElement.appendChild(pieceElement);
      }
    });

    // Highlight last move
    if (this.lastMove) {
      const fromSquare = this.getSquareElement(this.lastMove.from);
      const toSquare = this.getSquareElement(this.lastMove.to);
      if (fromSquare) fromSquare.classList.add('last-move');
      if (toSquare) toSquare.classList.add('last-move');
    }

    // Highlight check (only if we have engine with status)
    if (this.engine) {
      const status = this.engine.getStatus();
      if (status.isCheck) {
        const state = this.engine.getState();
        const kingSquare = this.findKingSquare(state.turn);
        if (kingSquare) {
          const squareElement = this.getSquareElement(kingSquare);
          if (squareElement) {
            squareElement.classList.add('in-check');
          }
        }
      }
    }

    // Apply custom highlights
    this.highlightedSquares.forEach((color, square) => {
      const squareElement = this.getSquareElement(square);
      if (squareElement) {
        squareElement.style.backgroundColor = color;
      }
    });
  }

  /**
   * Find the king square for a given color
   */
  private findKingSquare(color: Color): string | null {
    if (!this.engine) return null;

    const state = this.engine.getState();
    for (const [square, piece] of state.pieces.entries()) {
      if (piece.piece === 'k' && piece.color === color) {
        return square;
      }
    }
    return null;
  }

  /**
   * Clear all pieces from the board
   */
  private clearBoard(): void {
    const squares = this.boardElement.querySelectorAll('.square');
    squares.forEach(square => {
      square.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'in-check');
      const piece = square.querySelector('.piece');
      if (piece) {
        piece.remove();
      }
    });
  }

  /**
   * Parse FEN string and update internal piece map
   */
  private parseFen(fen: string): void {
    this.currentFen = fen;
    this.fenPieces.clear();

    const parts = fen.split(' ');
    const position = parts[0];
    const turn = parts[1] || 'w';

    this.fenTurn = turn === 'w' ? 'white' : 'black';

    const ranks = position.split('/');
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    ranks.forEach((rank, rankIndex) => {
      const actualRank = 8 - rankIndex;
      let fileIndex = 0;

      for (const char of rank) {
        if (char >= '1' && char <= '8') {
          fileIndex += parseInt(char, 10);
        } else {
          const square = files[fileIndex] + actualRank;
          const isWhite = char === char.toUpperCase();
          const piece = char.toLowerCase();

          this.fenPieces.set(square, {
            piece,
            color: isWhite ? 'white' : 'black',
          });

          fileIndex++;
        }
      }
    });
  }

  /**
   * Set the position from a FEN string or ChessEngine instance
   */
  setPosition(engineOrFen: ChessEngine | string): void {
    if (typeof engineOrFen === 'string') {
      // FEN string mode - parse and render
      this.parseFen(engineOrFen);
      this.engine = null; // Clear engine reference in FEN mode
      this.render();
    } else {
      // ChessEngine mode (legacy)
      this.engine = engineOrFen;
      this.render();
    }
  }

  /**
   * Set the last move highlight
   */
  setLastMove(from: string, to: string): void {
    this.lastMove = { from, to };
    this.render();
  }

  /**
   * Unflip the board (set to white's perspective)
   */
  unflip(): void {
    if (this.options.flipped) {
      this.options.flipped = false;
      this.boardElement.classList.remove('flipped');
    }
  }

  /**
   * Set the chess engine
   */
  setEngine(engine: ChessEngine): void {
    this.engine = engine;
    this.render();
  }

  /**
   * Flip the board
   */
  flip(): void {
    this.options.flipped = !this.options.flipped;
    this.boardElement.classList.toggle('flipped');
  }

  /**
   * Register a move callback
   */
  onMove(callback: MoveCallback): void {
    this.moveCallbacks.push(callback);
  }

  /**
   * Highlight specific squares
   */
  highlightSquares(squares: string[], color: string): void {
    squares.forEach(square => {
      this.highlightedSquares.set(square, color);
    });
    this.render();
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.highlightedSquares.clear();
    this.render();
  }

  /**
   * Show hint by highlighting from and to squares
   */
  showHint(from: string, to: string): void {
    const fromSquare = this.getSquareElement(from);
    const toSquare = this.getSquareElement(to);
    if (fromSquare) fromSquare.classList.add('hint');
    if (toSquare) toSquare.classList.add('hint');
  }

  /**
   * Clear hint highlight
   */
  clearHint(): void {
    const hintSquares = this.boardElement.querySelectorAll('.hint');
    hintSquares.forEach(sq => sq.classList.remove('hint'));
  }

  /**
   * Clear the last move highlight
   */
  clearLastMove(): void {
    this.lastMove = null;
    this.render();
  }

  /**
   * Enable or disable interactivity
   */
  setInteractive(enabled: boolean): void {
    this.options.interactive = enabled;
    if (!enabled) {
      this.deselectSquare();
    }
  }

  /**
   * Update the board display (re-render from engine state)
   */
  update(): void {
    this.render();
  }

  /**
   * Destroy the board and clean up
   */
  destroy(): void {
    this.boardElement.remove();
    this.moveCallbacks = [];
    this.engine = null;
  }
}
