/**
 * Move Review Panel
 *
 * Shows per-move feedback during post-game review: classification,
 * what was played, what was best, and eval change. Appears when
 * stepping through moves after a game ends and analysis completes.
 */

import { Chess } from 'chess.js';
import type { MoveClassification } from '../utils/moveClassification';
import { CLASSIFICATION_COLORS } from '../utils/moveClassification';

export interface MoveAnalysis {
  bestMove: string;      // UCI (e.g., "e2e4")
  bestMoveSan: string;   // SAN (e.g., "e4")
  pv: string[];          // principal variation in UCI
  pvSan: string[];       // principal variation in SAN (first few moves)
}

const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  best: 'Best move',
  excellent: 'Excellent',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

const CLASSIFICATION_ICONS: Record<MoveClassification, string> = {
  best: '\u2713',      // checkmark
  excellent: '\u2713',
  good: '\u2713',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

export class MoveReviewPanel {
  private container: HTMLElement;
  private panelEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'move-review-panel';
    this.panelEl.style.display = 'none';
    this.container.appendChild(this.panelEl);
    this.injectStyles();
  }

  /**
   * Show review info for a specific move.
   */
  show(params: {
    moveSan: string;
    moveIndex: number;
    classification: MoveClassification;
    isPlayerMove: boolean;
    evalBefore: number | string | null;
    evalAfter: number | string | null;
    analysis: MoveAnalysis | null;
  }): void {
    const { moveSan, moveIndex, classification, isPlayerMove, evalBefore, evalAfter, analysis } = params;

    const moveNum = Math.floor(moveIndex / 2) + 1;
    const isWhite = moveIndex % 2 === 0;
    const moveLabel = `${moveNum}${isWhite ? '.' : '...'} ${moveSan}`;

    const color = CLASSIFICATION_COLORS[classification];
    const label = CLASSIFICATION_LABELS[classification];
    const icon = CLASSIFICATION_ICONS[classification];

    const isNegative = classification === 'inaccuracy' || classification === 'mistake' || classification === 'blunder';
    const showBestMove = isNegative && analysis && isPlayerMove;

    // Build eval change text
    let evalChangeHtml = '';
    if (evalBefore !== null && evalAfter !== null) {
      const beforeStr = this.formatEval(evalBefore);
      const afterStr = this.formatEval(evalAfter);
      evalChangeHtml = `<span class="review-eval-change">${beforeStr} \u2192 ${afterStr}</span>`;
    }

    // Build best move section
    let bestMoveHtml = '';
    if (showBestMove && analysis) {
      const pvText = analysis.pvSan.length > 0
        ? analysis.pvSan.slice(0, 5).join(' ')
        : analysis.bestMoveSan;

      bestMoveHtml = `
        <div class="review-best-move">
          <span class="review-best-label">Best was</span>
          <span class="review-best-san">${analysis.bestMoveSan}</span>
          <span class="review-best-line">${pvText}</span>
        </div>
      `;
    }

    // Build positive feedback for good moves
    let positiveFeedback = '';
    if (!isNegative && isPlayerMove) {
      if (classification === 'best') {
        positiveFeedback = '<div class="review-positive">Top engine choice</div>';
      } else if (classification === 'excellent') {
        positiveFeedback = '<div class="review-positive">Nearly perfect</div>';
      }
    }

    this.panelEl.innerHTML = `
      <div class="review-header">
        <span class="review-badge" style="background: ${color}; color: ${this.contrastColor(color)}">${icon}</span>
        <span class="review-move-label">${moveLabel}</span>
        <span class="review-class-label" style="color: ${color}">${label}</span>
      </div>
      <div class="review-body">
        ${evalChangeHtml}
        ${positiveFeedback}
        ${bestMoveHtml}
      </div>
    `;

    this.panelEl.style.display = 'block';
  }

  /**
   * Hide the panel.
   */
  hide(): void {
    this.panelEl.style.display = 'none';
  }

  private formatEval(evaluation: number | string): string {
    if (typeof evaluation === 'string') {
      // Mate score
      return evaluation.startsWith('-') ? evaluation : `+${evaluation}`;
    }
    const pawns = evaluation / 100;
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  }

  private contrastColor(hex: string): string {
    // Simple luminance check for badge text
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a2e' : '#fff';
  }

  private injectStyles(): void {
    if (document.getElementById('move-review-styles')) return;

    const style = document.createElement('style');
    style.id = 'move-review-styles';
    style.textContent = `
      .move-review-panel {
        background: #16213e;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        margin-top: 8px;
      }

      .review-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #1a1a2e;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .review-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .review-move-label {
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-size: 14px;
        font-weight: 600;
        color: #eee;
      }

      .review-class-label {
        font-size: 13px;
        font-weight: 600;
        margin-left: auto;
      }

      .review-body {
        padding: 10px 12px;
      }

      .review-eval-change {
        display: block;
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-size: 12px;
        color: #9a9eb1;
        margin-bottom: 6px;
      }

      .review-positive {
        font-size: 13px;
        color: #829769;
      }

      .review-best-move {
        background: rgba(232, 132, 48, 0.1);
        border: 1px solid rgba(232, 132, 48, 0.2);
        border-radius: 6px;
        padding: 8px 10px;
      }

      .review-best-label {
        font-size: 12px;
        color: #aaa;
      }

      .review-best-san {
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-size: 14px;
        font-weight: 600;
        color: #829769;
        margin-left: 4px;
      }

      .review-best-line {
        display: block;
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-size: 12px;
        color: #9a9eb1;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Convert a UCI move sequence to SAN using chess.js.
 */
export function uciToSanSequence(uciMoves: string[], fen: string): string[] {
  const sanMoves: string[] = [];
  try {
    const chess = new Chess(fen);
    for (const uci of uciMoves) {
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion });
      if (!move) break;
      sanMoves.push(move.san);
    }
  } catch {
    // Return what we have
  }
  return sanMoves;
}
