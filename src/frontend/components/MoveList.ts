/**
 * Move List Component
 * Displays game moves in standard chess notation with auto-scroll to latest move.
 * Also shows captured pieces for each side.
 */

import type { Move, PieceType } from '../../types';

// Unicode chess piece symbols (filled style)
const PIECE_SYMBOLS: Record<PieceType, string> = {
  'k': '\u265A',
  'q': '\u265B',
  'r': '\u265C',
  'b': '\u265D',
  'n': '\u265E',
  'p': '\u265F',
};

// Piece values for sorting captured pieces
const PIECE_VALUES: Record<PieceType, number> = {
  'q': 9,
  'r': 5,
  'b': 3,
  'n': 3,
  'p': 1,
  'k': 0, // King can't be captured
};

export class MoveList {
  private container: HTMLElement;
  private listElement: HTMLElement;
  private moves: Move[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.listElement = this.createListElement();
    this.container.appendChild(this.listElement);
    this.applyStyles();
  }

  /**
   * Create the list container
   */
  private createListElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'move-list-wrapper';
    wrapper.innerHTML = `
      <div class="captured-pieces-section">
        <div class="captured-row captured-by-white">
          <span class="captured-label">W:</span>
          <span class="captured-pieces" data-side="white"></span>
        </div>
        <div class="captured-row captured-by-black">
          <span class="captured-label">B:</span>
          <span class="captured-pieces" data-side="black"></span>
        </div>
      </div>
      <div class="move-list-header">Moves</div>
      <div class="move-list-content"></div>
    `;
    return wrapper;
  }

  /**
   * Apply component styles
   */
  private applyStyles(): void {
    const styleId = 'move-list-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .move-list-wrapper {
        background: #16213e;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 200px;
        max-height: 560px;
      }

      .captured-pieces-section {
        padding: 8px 12px;
        border-bottom: 1px solid #333;
      }

      .captured-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 24px;
      }

      .captured-label {
        font-size: 11px;
        color: #666;
        font-weight: 600;
        min-width: 18px;
      }

      .captured-pieces {
        display: flex;
        flex-wrap: wrap;
        gap: 1px;
        font-size: 18px;
        line-height: 1;
      }

      .captured-piece {
        opacity: 0.9;
      }

      .captured-piece-white {
        color: #fff;
        text-shadow:
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000;
      }

      .captured-piece-black {
        color: #333;
      }

      .move-list-header {
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 600;
        color: #888;
        border-bottom: 1px solid #333;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .move-list-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      .move-list-content::-webkit-scrollbar {
        width: 6px;
      }

      .move-list-content::-webkit-scrollbar-track {
        background: #1a1a2e;
        border-radius: 3px;
      }

      .move-list-content::-webkit-scrollbar-thumb {
        background: #4a4e69;
        border-radius: 3px;
      }

      .move-list-content::-webkit-scrollbar-thumb:hover {
        background: #5c6078;
      }

      .move-row {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .move-row:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .move-number {
        color: #666;
        font-size: 12px;
        min-width: 28px;
        font-variant-numeric: tabular-nums;
      }

      .move-white, .move-black {
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
        font-size: 13px;
        padding: 2px 6px;
        border-radius: 3px;
        min-width: 50px;
      }

      .move-white {
        color: #fff;
        margin-right: 8px;
      }

      .move-black {
        color: #aaa;
      }

      .move-white:not(:empty):hover,
      .move-black:not(:empty):hover {
        background: rgba(130, 151, 105, 0.2);
        cursor: pointer;
      }

      .move-latest {
        background: rgba(130, 151, 105, 0.15);
      }

      .move-empty {
        color: #444;
      }

      .move-list-empty {
        color: #666;
        font-size: 13px;
        text-align: center;
        padding: 24px 16px;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update the move list with new moves
   */
  update(moves: Move[]): void {
    this.moves = moves;
    this.render();
  }

  /**
   * Add a single move (for efficiency when appending)
   */
  addMove(move: Move): void {
    this.moves.push(move);
    this.render();
  }

  /**
   * Clear all moves
   */
  clear(): void {
    this.moves = [];
    this.render();
  }

  /**
   * Render the move list
   */
  private render(): void {
    const content = this.listElement.querySelector('.move-list-content');
    if (!content) return;

    // Render captured pieces
    this.renderCapturedPieces();

    if (this.moves.length === 0) {
      content.innerHTML = '<div class="move-list-empty">No moves yet</div>';
      return;
    }

    let html = '';
    const totalMoves = this.moves.length;

    // Group moves into pairs (white, black)
    for (let i = 0; i < this.moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = this.moves[i];
      const blackMove = this.moves[i + 1];

      const isLatestWhite = i === totalMoves - 1;
      const isLatestBlack = i + 1 === totalMoves - 1;

      html += `
        <div class="move-row">
          <span class="move-number">${moveNumber}.</span>
          <span class="move-white ${isLatestWhite ? 'move-latest' : ''}">${this.formatMove(whiteMove)}</span>
          <span class="move-black ${isLatestBlack ? 'move-latest' : ''}">${blackMove ? this.formatMove(blackMove) : ''}</span>
        </div>
      `;
    }

    content.innerHTML = html;

    // Auto-scroll to bottom
    content.scrollTop = content.scrollHeight;
  }

  /**
   * Format a move for display
   */
  private formatMove(move: Move): string {
    // Use SAN notation if available, otherwise construct from from/to
    let notation = move.san || `${move.from}${move.to}`;

    // Add check/checkmate indicators if not already present
    if (move.flags.isCheckmate && !notation.includes('#')) {
      notation += '#';
    } else if (move.flags.isCheck && !notation.includes('+')) {
      notation += '+';
    }

    return notation;
  }

  /**
   * Render captured pieces for each side
   */
  private renderCapturedPieces(): void {
    const whiteCapturesContainer = this.listElement.querySelector('.captured-pieces[data-side="white"]');
    const blackCapturesContainer = this.listElement.querySelector('.captured-pieces[data-side="black"]');

    if (!whiteCapturesContainer || !blackCapturesContainer) return;

    // Collect captured pieces by side
    const capturedByWhite: PieceType[] = []; // Black pieces captured by white
    const capturedByBlack: PieceType[] = []; // White pieces captured by black

    this.moves.forEach((move, index) => {
      if (move.captured) {
        // Even index = white's move, odd index = black's move
        if (index % 2 === 0) {
          capturedByWhite.push(move.captured);
        } else {
          capturedByBlack.push(move.captured);
        }
      }
    });

    // Sort by value (highest first)
    const sortByValue = (a: PieceType, b: PieceType) => PIECE_VALUES[b] - PIECE_VALUES[a];
    capturedByWhite.sort(sortByValue);
    capturedByBlack.sort(sortByValue);

    // Render captured pieces
    whiteCapturesContainer.innerHTML = capturedByWhite
      .map(p => `<span class="captured-piece captured-piece-black">${PIECE_SYMBOLS[p]}</span>`)
      .join('');

    blackCapturesContainer.innerHTML = capturedByBlack
      .map(p => `<span class="captured-piece captured-piece-white">${PIECE_SYMBOLS[p]}</span>`)
      .join('');
  }

  /**
   * Get current move count
   */
  getMoveCount(): number {
    return this.moves.length;
  }
}
