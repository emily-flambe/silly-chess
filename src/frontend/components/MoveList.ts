/**
 * Move List Component
 * Displays game moves in standard chess notation with auto-scroll to latest move.
 * Also shows captured pieces for each side.
 */

import { Chess } from 'chess.js';
import type { PieceType } from '../../types';
import type { MoveClassification } from '../utils/moveClassification';
import { CLASSIFICATION_COLORS } from '../utils/moveClassification';

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
      <div class="move-nav-bar">
        <button class="nav-btn nav-first" title="First (↑)">⏮</button>
        <button class="nav-btn nav-back" title="Back (←)">◀</button>
        <button class="nav-btn nav-forward" title="Forward (→)">▶</button>
        <button class="nav-btn nav-last" title="Current (↓)">⏭</button>
      </div>
    `;

    // Attach navigation event listeners
    setTimeout(() => this.attachNavListeners(), 0);

    return wrapper;
  }

  /**
   * Attach navigation button listeners
   */
  private attachNavListeners(): void {
    const firstBtn = this.listElement.querySelector('.nav-first');
    const backBtn = this.listElement.querySelector('.nav-back');
    const forwardBtn = this.listElement.querySelector('.nav-forward');
    const lastBtn = this.listElement.querySelector('.nav-last');

    firstBtn?.addEventListener('click', () => this.goToStart());
    backBtn?.addEventListener('click', () => this.goBack());
    forwardBtn?.addEventListener('click', () => this.goForward());
    lastBtn?.addEventListener('click', () => this.goToEnd());
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
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 200px;
        overflow: hidden;
      }

      .captured-pieces-section {
        padding: 10px 14px;
        border-bottom: 1px solid var(--panel-border);
      }

      .section-header {
        font-size: 11px;
        font-weight: 600;
        color: var(--fg-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }

      .captured-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 28px;
        margin-bottom: 2px;
      }

      .captured-label {
        font-size: 11px;
        color: var(--fg-muted);
        font-weight: 600;
        min-width: 18px;
      }

      .captured-pieces {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        font-size: 22px;
        line-height: 1;
        color: var(--fg);
      }

      .captured-piece {
        opacity: 0.95;
      }

      .captured-piece-white {
        color: var(--fg);
      }

      .captured-piece-black {
        color: var(--fg);
      }

      .move-list-header {
        padding: 10px 14px;
        font-size: 11px;
        font-weight: 600;
        color: var(--fg-muted);
        border-bottom: 1px solid var(--panel-border);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .move-list-content {
        flex: 1;
        overflow-y: auto;
        padding: 6px 0;
        font-variant-numeric: tabular-nums;
        font-size: 13.5px;
      }

      .move-list-content::-webkit-scrollbar {
        width: 6px;
      }

      .move-list-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .move-list-content::-webkit-scrollbar-thumb {
        background: var(--panel-border);
        border-radius: 3px;
      }

      .move-list-content .move-row {
        display: grid;
        grid-template-columns: 36px 1fr 1fr;
        align-items: center;
        padding: 3px 14px;
        gap: 6px;
        border-radius: 0;
      }

      .move-list-content .move-row:nth-child(odd) {
        background: var(--accent-soft);
      }

      .move-list-content .move-row:hover {
        background: var(--accent-soft);
      }

      .move-number {
        color: var(--fg-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      .move-white, .move-black {
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 13px;
        padding: 2px 6px;
        border-radius: 3px;
        color: var(--fg);
        font-weight: 500;
      }

      .move-white {
        margin-right: 0;
      }

      .move-white:not(:empty):hover,
      .move-black:not(:empty):hover {
        background: var(--accent-soft);
        cursor: pointer;
      }

      .move-viewing {
        background: var(--accent) !important;
        color: var(--accent-contrast) !important;
        font-weight: 700;
      }

      .move-list-empty {
        color: var(--fg-muted);
        font-size: 13px;
        text-align: center;
        padding: 14px;
        font-style: italic;
      }

      .move-nav-bar {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        border-top: 1px solid var(--panel-border);
        background: var(--bg-2);
      }

      .nav-btn {
        width: 36px;
        height: 28px;
        background: var(--btn);
        color: var(--fg);
        border: 1px solid var(--btn-border);
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
      }

      .nav-btn:hover:not(:disabled) {
        background: var(--btn-hover);
      }

      .nav-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Clear all moves
   */
  clear(): void {
    this.sanMoves = [];
    this.classifications = [];
    this.renderFromSAN();
  }

  /**
   * Set move classifications and re-render with color coding
   */
  setClassifications(classifications: (MoveClassification | null)[]): void {
    this.classifications = classifications;
    this.renderFromSAN();
  }

  // Simple SAN storage for server mode
  private sanMoves: string[] = [];
  private classifications: (MoveClassification | null)[] = [];

  /**
   * Update from SAN notation array (server mode)
   */
  updateFromSAN(sanMoves: string[]): void {
    this.sanMoves = sanMoves;
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

      const whiteClass = this.classifications[i] || null;
      const blackClass = this.classifications[i + 1] || null;
      const whiteStyle = whiteClass ? ` style="color: ${CLASSIFICATION_COLORS[whiteClass]}"` : '';
      const blackStyle = blackClass ? ` style="color: ${CLASSIFICATION_COLORS[blackClass]}"` : '';
      const whiteCssClass = whiteClass ? ` move-${whiteClass}` : '';
      const blackCssClass = blackClass ? ` move-${blackClass}` : '';

      html += `
        <div class="move-row">
          <span class="move-number">${moveNumber}.</span>
          <span class="move-white${whiteCssClass} ${isViewingWhite ? 'move-viewing' : ''}" data-move-index="${i}"${whiteStyle}>${whiteMove || ''}</span>
          <span class="move-black${blackCssClass} ${isViewingBlack ? 'move-viewing' : ''}" ${blackMove ? `data-move-index="${i + 1}"` : ''}${blackStyle}>${blackMove || ''}</span>
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

    // Update navigation button states
    this.updateNavButtons();
  }

  /**
   * Select a position to view (without undoing moves)
   * @param moveIndex - Move index (0-based), -1 for current, -2 for start position
   */
  selectPosition(moveIndex: number): void {
    const maxIndex = this.sanMoves.length - 1;
    // Clamp to valid range: -2 (start) to maxIndex, or -1 (current)
    if (moveIndex >= this.sanMoves.length) {
      this.viewingMoveIndex = -1; // Go to current
    } else {
      this.viewingMoveIndex = Math.max(-2, Math.min(moveIndex, maxIndex));
    }

    // Update highlighting
    this.updateViewingHighlight();
    this.updateNavButtons();

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

    // Don't highlight anything if at start position (-2) or no moves
    if (this.viewingMoveIndex === -2 || this.sanMoves.length === 0) {
      return;
    }

    // Add highlight to current viewing position
    // -1 means current/latest position
    const viewingIndex = this.viewingMoveIndex === -1 ? this.sanMoves.length - 1 : this.viewingMoveIndex;
    const viewingEl = content.querySelector(`[data-move-index="${viewingIndex}"]`);
    if (viewingEl) {
      viewingEl.classList.add('move-viewing');
    }
  }

  /**
   * Navigate to first position (before any moves)
   * Uses special index -2 to represent "start position"
   */
  goToStart(): void {
    this.viewingMoveIndex = -2; // Special value for start position
    this.updateViewingHighlight();
    this.updateNavButtons();
    this.positionSelectCallbacks.forEach(cb => cb(-2));
  }

  /**
   * Navigate to previous position
   */
  goBack(): void {
    if (this.sanMoves.length === 0) return;

    // If at current (-1), go to the second-to-last move (one step back from current)
    // Note: -1 and (length-1) are the same visual position, so we need to go to length-2
    if (this.viewingMoveIndex === -1) {
      if (this.sanMoves.length === 1) {
        // Only one move - go to start position
        this.goToStart();
      } else {
        // Go to second-to-last move (one step back)
        this.selectPosition(this.sanMoves.length - 2);
      }
    }
    // If at start (-2), do nothing
    else if (this.viewingMoveIndex === -2) {
      return;
    }
    // If at first move (0), go to start
    else if (this.viewingMoveIndex === 0) {
      this.goToStart();
    }
    // Otherwise go back one move
    else {
      this.selectPosition(this.viewingMoveIndex - 1);
    }
  }

  /**
   * Navigate to next position
   */
  goForward(): void {
    if (this.sanMoves.length === 0) return;

    // If at start position, go to first move
    if (this.viewingMoveIndex === -2) {
      this.selectPosition(0);
    }
    // If at last move, go to current
    else if (this.viewingMoveIndex === this.sanMoves.length - 1) {
      this.goToEnd();
    }
    // If already at current, do nothing
    else if (this.viewingMoveIndex === -1) {
      return;
    }
    // Otherwise go forward one move
    else {
      this.selectPosition(this.viewingMoveIndex + 1);
    }
  }

  /**
   * Navigate to latest position (current)
   */
  goToEnd(): void {
    this.viewingMoveIndex = -1; // -1 = current/latest position
    this.updateViewingHighlight();
    this.updateNavButtons();
    this.positionSelectCallbacks.forEach(cb => cb(-1));
  }

  /**
   * Update navigation button states
   */
  private updateNavButtons(): void {
    const firstBtn = this.listElement.querySelector('.nav-first') as HTMLButtonElement;
    const backBtn = this.listElement.querySelector('.nav-back') as HTMLButtonElement;
    const forwardBtn = this.listElement.querySelector('.nav-forward') as HTMLButtonElement;
    const lastBtn = this.listElement.querySelector('.nav-last') as HTMLButtonElement;

    if (!firstBtn || !backBtn || !forwardBtn || !lastBtn) return;

    const atStart = this.viewingMoveIndex === -2;
    const atCurrent = this.viewingMoveIndex === -1;
    const noMoves = this.sanMoves.length === 0;

    firstBtn.disabled = atStart || noMoves;
    backBtn.disabled = atStart || noMoves;
    forwardBtn.disabled = atCurrent || noMoves;
    lastBtn.disabled = atCurrent || noMoves;
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
}
