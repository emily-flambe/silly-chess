/**
 * Chess Board Component
 *
 * Interactive chess board with piece movement support.
 * Supports click-to-move and displays legal moves.
 * Operates with FEN-based positioning (server mode).
 */

import { Chess } from 'chess.js';
import type { Color } from '../../types';

export interface BoardOptions {
  flipped?: boolean;
  interactive?: boolean;
  showCoordinates?: boolean;
}

type MoveCallback = (from: string, to: string, promotion?: string) => void;

// Piece data-attribute map. Actual images come from styles.css
// which points each `data-piece` at the corresponding SVG under /pieces/.
const PIECE_CODE: Record<string, string> = {
  'K': 'K',
  'Q': 'Q',
  'R': 'R',
  'B': 'B',
  'N': 'N',
  'P': 'P',
};

// Piece info parsed from FEN
interface PieceInfo {
  piece: string;
  color: Color;
}

export class ChessBoard {
  private container: HTMLElement;
  private boardElement: HTMLElement;
  private options: Required<BoardOptions>;
  private selectedSquare: string | null = null;
  private legalMoves: string[] = [];
  private lastMove: { from: string; to: string } | null = null;
  private bestMoveArrow: { from: string; to: string } | null = null;
  private moveCallbacks: MoveCallback[] = [];

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

    // Parse and render the default starting position
    this.parseFen(this.currentFen);
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
      board.classList.add('with-coords');
      this.addCoordinates(board);
    }

    return board;
  }

  /**
   * Refresh in-square coord labels (.coord.file on bottom rank,
   * .coord.rank on left file). Called on every render so flips update.
   */
  private refreshInSquareCoords(): void {
    if (!this.options.showCoordinates) return;
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const flipped = this.options.flipped;
    // Clear existing in-square coord overlays
    this.boardElement.querySelectorAll('.coord').forEach(el => el.remove());

    // File labels go on the bottom-most rank (rank 1 normally, rank 8 when flipped)
    const bottomRank = flipped ? 8 : 1;
    for (let f = 0; f < 8; f++) {
      const sq = files[f] + bottomRank;
      const el = this.getSquareElement(sq);
      if (!el) continue;
      const span = document.createElement('span');
      span.className = 'coord file';
      span.textContent = files[f];
      el.appendChild(span);
    }

    // Rank labels go on the left-most file (file a normally, file h when flipped)
    const leftFile = flipped ? 'h' : 'a';
    for (let r = 1; r <= 8; r++) {
      const sq = leftFile + r;
      const el = this.getSquareElement(sq);
      if (!el) continue;
      const span = document.createElement('span');
      span.className = 'coord rank';
      span.textContent = String(r);
      el.appendChild(span);
    }
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
   * Add coordinate labels to the board. Coord labels are drawn inside
   * the bottom-rank squares (files) and left-file squares (ranks) as
   * overlay spans, per the new design. Actual placement is done by
   * refreshInSquareCoords() so it re-runs after flips/renders.
   */
  private addCoordinates(_board: HTMLElement): void {
    // no-op; populated by refreshInSquareCoords() during render()
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

    if (this.fenPieces.size === 0) return;

    // If no square selected, try to select this square
    if (!this.selectedSquare) {
      this.selectSquare(square);
    } else {
      // If clicking the same square, deselect it
      if (this.selectedSquare === square) {
        this.deselectSquare();
      } else {
        // Always attempt the move (server validates)
        this.makeMove(this.selectedSquare, square);
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

    // Compute legal moves using chess.js
    try {
      const chess = new Chess(this.currentFen);
      const moves = chess.moves({ square: square as any, verbose: true });
      if (moves.length === 0) return;
      this.legalMoves = moves.map(m => m.to);
    } catch {
      this.legalMoves = [];
    }

    this.selectedSquare = square;

    // Highlight selected square
    const squareElement = this.getSquareElement(square);
    if (squareElement) {
      squareElement.classList.add('selected');
    }

    // Show legal move indicators
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
   * Make a move (detects promotion and shows picker if needed)
   */
  private makeMove(from: string, to: string): void {
    this.deselectSquare();

    // Clear any previous move highlight - highlighting is only for selection preview
    this.lastMove = null;

    // Check if this is a pawn promotion
    const piece = this.fenPieces.get(from);
    if (piece && piece.piece === 'p') {
      const toRank = to[1];
      const isPromotion = (piece.color === 'white' && toRank === '8') ||
                          (piece.color === 'black' && toRank === '1');
      if (isPromotion) {
        this.showPromotionPicker(from, to, piece.color);
        return;
      }
    }

    // Notify listeners
    this.moveCallbacks.forEach(callback => callback(from, to));

    this.render();
  }

  /**
   * Show promotion piece picker overlay on the target square
   */
  private showPromotionPicker(from: string, to: string, color: Color): void {
    // Remove any existing picker
    this.removePromotionPicker();

    const overlay = document.createElement('div');
    overlay.className = 'promotion-overlay';
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePromotionPicker();
      this.render();
    });

    const picker = document.createElement('div');
    picker.className = 'promotion-picker';

    const pieces = [
      { key: 'q', code: 'Q' },
      { key: 'r', code: 'R' },
      { key: 'b', code: 'B' },
      { key: 'n', code: 'N' },
    ];
    const prefix = color === 'white' ? 'w' : 'b';

    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = `promotion-piece piece piece-${color}`;
      btn.dataset.piece = `${prefix}${p.code}`;
      btn.setAttribute('aria-label', `Promote to ${color} ${p.code}`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removePromotionPicker();
        this.moveCallbacks.forEach(callback => callback(from, to, p.key));
        this.render();
      });
      picker.appendChild(btn);
    }

    // Position the picker near the target square
    const targetSquare = this.getSquareElement(to);
    if (targetSquare) {
      const rect = targetSquare.getBoundingClientRect();
      const boardRect = this.boardElement.getBoundingClientRect();
      const left = rect.left - boardRect.left;
      const isTopHalf = rect.top - boardRect.top < boardRect.height / 2;
      picker.style.left = `${left}px`;
      if (isTopHalf) {
        picker.style.top = `${rect.top - boardRect.top}px`;
      } else {
        picker.style.bottom = `${boardRect.bottom - rect.bottom}px`;
      }
    }

    overlay.appendChild(picker);
    this.boardElement.style.position = 'relative';
    this.boardElement.appendChild(overlay);
  }

  /**
   * Remove promotion picker if present
   */
  private removePromotionPicker(): void {
    const existing = this.boardElement.querySelector('.promotion-overlay');
    if (existing) existing.remove();
  }

  /**
   * Get square element by name
   */
  private getSquareElement(square: string): HTMLElement | null {
    return this.boardElement.querySelector(`[data-square="${square}"]`);
  }

  /**
   * Get piece at square from FEN state
   */
  private getPieceAt(square: string): { piece: string; color: Color } | null {
    return this.fenPieces.get(square) || null;
  }

  /**
   * Render the board based on current FEN state
   */
  private render(): void {
    // Clear all pieces and highlights
    this.clearBoard();

    // Refresh in-square coord overlays (respects flipped state)
    this.refreshInSquareCoords();

    // Place pieces as DOM elements with a data-piece attribute; the
    // corresponding SVG is loaded by CSS background-image.
    this.fenPieces.forEach((pieceInfo, square) => {
      const squareElement = this.getSquareElement(square);
      if (squareElement) {
        const pieceElement = document.createElement('div');
        pieceElement.className = `piece piece-${pieceInfo.color}`;
        const prefix = pieceInfo.color === 'white' ? 'w' : 'b';
        const code = PIECE_CODE[pieceInfo.piece.toUpperCase()] || pieceInfo.piece.toUpperCase();
        pieceElement.dataset.piece = `${prefix}${code}`;
        // Accessibility: expose the piece type in the DOM for screen readers
        pieceElement.setAttribute('role', 'img');
        pieceElement.setAttribute('aria-label', `${pieceInfo.color} ${code}`);
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

    // Show best move arrow
    if (this.bestMoveArrow) {
      const fromSquare = this.getSquareElement(this.bestMoveArrow.from);
      const toSquare = this.getSquareElement(this.bestMoveArrow.to);
      if (fromSquare) fromSquare.classList.add('best-move-from');
      if (toSquare) toSquare.classList.add('best-move-to');
    }

    // Highlight check using chess.js
    try {
      const chess = new Chess(this.currentFen);
      if (chess.isCheck()) {
        const turn: Color = chess.turn() === 'w' ? 'white' : 'black';
        for (const [square, piece] of this.fenPieces.entries()) {
          if (piece.piece === 'k' && piece.color === turn) {
            const squareElement = this.getSquareElement(square);
            if (squareElement) {
              squareElement.classList.add('in-check');
            }
            break;
          }
        }
      }
    } catch {
      // Invalid FEN, skip check detection
    }
  }

  /**
   * Clear all pieces (and coord overlays) from the board
   */
  private clearBoard(): void {
    const squares = this.boardElement.querySelectorAll('.square');
    squares.forEach(square => {
      square.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'in-check', 'best-move-from', 'best-move-to');
      const piece = square.querySelector('.piece');
      if (piece) piece.remove();
      const coords = square.querySelectorAll('.coord');
      coords.forEach(c => c.remove());
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
   * Set the position from a FEN string
   */
  setPosition(fen: string): void {
    this.parseFen(fen);
    this.render();
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
   * Show a best-move highlight on the board (green squares)
   */
  setBestMove(from: string, to: string): void {
    this.bestMoveArrow = { from, to };
    this.render();
  }

  /**
   * Clear the best-move highlight
   */
  clearBestMove(): void {
    this.bestMoveArrow = null;
    this.render();
  }

  /**
   * Show or hide board coordinates
   */
  setShowCoordinates(show: boolean): void {
    if (this.options.showCoordinates === show) return;
    this.options.showCoordinates = show;

    this.boardElement.classList.toggle('with-coords', show);
    // Remove any in-square coord overlays; render() will re-populate.
    this.boardElement.querySelectorAll('.coord').forEach(el => el.remove());
    this.render();
  }

  /**
   * Show or hide the AI-thinking indicator (pulsing border glow)
   */
  setThinking(thinking: boolean): void {
    this.boardElement.classList.toggle('ai-thinking', thinking);
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
   * Destroy the board and clean up
   */
  destroy(): void {
    this.boardElement.remove();
    this.moveCallbacks = [];
  }
}
