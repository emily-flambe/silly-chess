/**
 * Move List Component
 * Displays game moves in standard chess notation with auto-scroll to latest move.
 * Also shows captured pieces for each side.
 */

import { Chess } from 'chess.js';
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

type PositionSelectCallback = (moveIndex: number) => void;

export class MoveList {
  private container: HTMLElement;
  private listElement: HTMLElement;
  private moves: Move[] = [];
  private positionSelectCallbacks: PositionSelectCallback[] = [];
  private viewingMoveIndex: number = -1; // -1 = viewing current position

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
        <div class="section-header">Captures</div>
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

      .section-header {
        font-size: 14px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
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
        color: #111;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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

      .move-viewing {
        background: rgba(100, 149, 237, 0.3);
        border-radius: 3px;
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
    this.sanMoves = [];
    this.render();
  }

  // Simple SAN storage for server mode
  private sanMoves: string[] = [];

  /**
   * Update from SAN notation array (server mode)
   */
  updateFromSAN(sanMoves: string[]): void {
    this.sanMoves = sanMoves;
    // Clear Move objects - we'll render directly from SAN
    this.moves = [];
    this.renderFromSAN();
  }

  /**
   * Render from SAN array (server mode)
   */
  private renderFromSAN(): void {
    const content = this.listElement.querySelector('.move-list-content');
    if (!content) return;

    // Extract captures by replaying the game with chess.js
    this.renderCapturedPiecesFromSAN();

    if (this.sanMoves.length === 0) {
      content.innerHTML = '<div class="move-list-empty">No moves yet</div>';
      return;
    }

    // Reset viewing index when moves change (always show latest)
    this.viewingMoveIndex = -1;

    let html = '';
    const totalMoves = this.sanMoves.length;
    const viewingIndex = this.viewingMoveIndex === -1 ? totalMoves - 1 : this.viewingMoveIndex;

    // Group moves into pairs (white, black)
    for (let i = 0; i < this.sanMoves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = this.sanMoves[i];
      const blackMove = this.sanMoves[i + 1];

      const isViewingWhite = i === viewingIndex;
      const isViewingBlack = i + 1 === viewingIndex;

      html += `
        <div class="move-row">
          <span class="move-number">${moveNumber}.</span>
          <span class="move-white ${isViewingWhite ? 'move-viewing' : ''}" data-move-index="${i}">${whiteMove || ''}</span>
          <span class="move-black ${isViewingBlack ? 'move-viewing' : ''}" ${blackMove ? `data-move-index="${i + 1}"` : ''}>${blackMove || ''}</span>
        </div>
      `;
    }

    content.innerHTML = html;

    // Add click handlers for move navigation
    content.querySelectorAll('[data-move-index]').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.getAttribute('data-move-index') || '0', 10);
        this.selectPosition(index);
      });
    });

    // Auto-scroll to bottom if viewing latest
    if (this.viewingMoveIndex === -1) {
      content.scrollTop = content.scrollHeight;
    }
  }

  /**
   * Select a position to view (without undoing moves)
   */
  selectPosition(moveIndex: number): void {
    const maxIndex = this.sanMoves.length - 1;
    this.viewingMoveIndex = Math.max(-1, Math.min(moveIndex, maxIndex));
    
    // Update highlighting
    this.updateViewingHighlight();
    
    // Notify listeners
    this.positionSelectCallbacks.forEach(cb => cb(this.viewingMoveIndex));
  }

  /**
   * Update the visual highlight for the currently viewed move
   */
  private updateViewingHighlight(): void {
    const content = this.listElement.querySelector('.move-list-content');
    if (!content) return;

    // Remove all viewing highlights
    content.querySelectorAll('.move-viewing').forEach(el => {
      el.classList.remove('move-viewing');
    });

    // Add highlight to current viewing position
    const viewingIndex = this.viewingMoveIndex === -1 ? this.sanMoves.length - 1 : this.viewingMoveIndex;
    const viewingEl = content.querySelector(`[data-move-index="${viewingIndex}"]`);
    if (viewingEl) {
      viewingEl.classList.add('move-viewing');
    }
  }

  /**
   * Navigate to first position (before any moves)
   */
  goToStart(): void {
    if (this.sanMoves.length === 0) return;
    this.selectPosition(-1); // -1 represents start position
    this.positionSelectCallbacks.forEach(cb => cb(-1));
  }

  /**
   * Navigate to previous position
   */
  goBack(): void {
    if (this.sanMoves.length === 0) return;
    const current = this.viewingMoveIndex === -1 ? this.sanMoves.length - 1 : this.viewingMoveIndex;
    this.selectPosition(current - 1);
  }

  /**
   * Navigate to next position
   */
  goForward(): void {
    if (this.viewingMoveIndex === -1) return; // Already at latest
    this.selectPosition(this.viewingMoveIndex + 1);
  }

  /**
   * Navigate to latest position
   */
  goToEnd(): void {
    this.viewingMoveIndex = -1;
    this.updateViewingHighlight();
    this.positionSelectCallbacks.forEach(cb => cb(-1));
  }

  /**
   * Check if currently viewing a historical position
   */
  isViewingHistory(): boolean {
    return this.viewingMoveIndex !== -1 && this.viewingMoveIndex < this.sanMoves.length - 1;
  }

  /**
   * Get the currently viewed move index (-1 = current position)
   */
  getViewingIndex(): number {
    return this.viewingMoveIndex;
  }

  /**
   * Register callback for position selection
   */
  onPositionSelect(callback: PositionSelectCallback): void {
    this.positionSelectCallbacks.push(callback);
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
   * Render captured pieces by replaying SAN moves with chess.js
   * Used in server mode when we only have SAN notation
   */
  private renderCapturedPiecesFromSAN(): void {
    const whiteCapturesContainer = this.listElement.querySelector('.captured-pieces[data-side="white"]');
    const blackCapturesContainer = this.listElement.querySelector('.captured-pieces[data-side="black"]');

    if (!whiteCapturesContainer || !blackCapturesContainer) return;

    // Collect captured pieces by replaying the game
    const capturedByWhite: PieceType[] = []; // Black pieces captured by white
    const capturedByBlack: PieceType[] = []; // White pieces captured by black

    if (this.sanMoves.length > 0) {
      const chess = new Chess();
      
      for (let i = 0; i < this.sanMoves.length; i++) {
        const san = this.sanMoves[i];
        try {
          const move = chess.move(san);
          if (move && move.captured) {
            // chess.js returns captured piece type in lowercase (e.g., 'p', 'n', 'b', 'r', 'q')
            const capturedPiece = move.captured as PieceType;
            // Even index = white's move, odd index = black's move
            if (i % 2 === 0) {
              capturedByWhite.push(capturedPiece);
            } else {
              capturedByBlack.push(capturedPiece);
            }
          }
        } catch (e) {
          console.error('Failed to replay move:', san, e);
          break;
        }
      }
    }

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
