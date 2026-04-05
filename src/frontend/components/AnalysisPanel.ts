/**
 * Analysis Panel Component
 *
 * Shows the top N engine lines (MultiPV) with evaluations and PV moves in SAN notation.
 * Designed to sit below the move list in the right sidebar.
 */

import { Chess } from 'chess.js';

export interface AnalysisLine {
  rank: number;
  evaluation: number | string;
  pv: string[];  // UCI moves
  wdl?: { win: number; draw: number; loss: number };
}

export class AnalysisPanel {
  private container: HTMLElement;
  private panelElement: HTMLElement;
  private contentElement: HTMLElement;
  private statusElement: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.panelElement = this.createPanel();
    this.contentElement = this.panelElement.querySelector('.analysis-lines')!;
    this.statusElement = this.panelElement.querySelector('.analysis-status')!;
    this.container.appendChild(this.panelElement);
    this.applyStyles();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'analysis-panel';
    panel.innerHTML = `
      <div class="analysis-header">Engine Lines</div>
      <div class="analysis-lines"></div>
      <div class="analysis-status"></div>
    `;
    return panel;
  }

  /**
   * Update the panel with MultiPV analysis results.
   * @param lines - Array of analysis lines from analyzeMultiPV
   * @param fen - The FEN of the position being analyzed (used to convert UCI to SAN)
   */
  update(lines: AnalysisLine[], fen: string): void {
    if (lines.length === 0) {
      this.contentElement.innerHTML = '<div class="analysis-empty">No analysis available</div>';
      return;
    }

    let html = '';
    for (const line of lines) {
      const evalText = this.formatEval(line.evaluation);
      const sanMoves = this.uciToSan(line.pv, fen);
      const movesText = sanMoves.slice(0, 8).join(' '); // Show up to 8 moves
      const isBest = line.rank === 1;

      html += `
        <div class="analysis-line ${isBest ? 'analysis-line-best' : ''}">
          <span class="analysis-rank">${line.rank}</span>
          <span class="analysis-eval ${this.evalClass(line.evaluation)}">${evalText}</span>
          <span class="analysis-moves">${movesText}</span>
        </div>
      `;
    }

    this.contentElement.innerHTML = html;
  }

  /**
   * Show a status message (e.g., "Analyzing game... (5/23)")
   */
  setStatus(message: string): void {
    this.statusElement.textContent = message;
  }

  /**
   * Clear the status message
   */
  clearStatus(): void {
    this.statusElement.textContent = '';
  }

  /**
   * Clear the panel
   */
  clear(): void {
    this.contentElement.innerHTML = '';
    this.statusElement.textContent = '';
  }

  /**
   * Format an evaluation for display
   */
  private formatEval(evaluation: number | string): string {
    if (typeof evaluation === 'string') {
      // Mate score (e.g., "M3" or "-M5")
      return evaluation;
    }
    const pawns = evaluation / 100;
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  }

  /**
   * CSS class for eval coloring
   */
  private evalClass(evaluation: number | string): string {
    if (typeof evaluation === 'string') {
      return evaluation.startsWith('-') ? 'eval-negative' : 'eval-positive';
    }
    return evaluation >= 0 ? 'eval-positive' : 'eval-negative';
  }

  /**
   * Convert UCI move sequence to SAN notation by replaying on a chess.js instance
   */
  private uciToSan(uciMoves: string[], fen: string): string[] {
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
      // If replay fails partway, return what we have
    }
    return sanMoves;
  }

  private applyStyles(): void {
    const styleId = 'analysis-panel-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .analysis-panel {
        background: #16213e;
        border-radius: 8px;
        margin-top: 8px;
        overflow: hidden;
      }

      .analysis-header {
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        color: #9a9eb1;
        border-bottom: 1px solid #333;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .analysis-lines {
        padding: 4px 0;
      }

      .analysis-empty {
        color: #7a7e8f;
        font-size: 13px;
        text-align: center;
        padding: 16px;
        font-style: italic;
      }

      .analysis-line {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        font-size: 13px;
        color: #ccc;
        border-left: 3px solid transparent;
      }

      .analysis-line-best {
        border-left-color: #829769;
        background: rgba(130, 151, 105, 0.08);
      }

      .analysis-rank {
        color: #7a7e8f;
        font-size: 11px;
        font-weight: 700;
        min-width: 14px;
      }

      .analysis-eval {
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-weight: 600;
        font-size: 12px;
        min-width: 48px;
        text-align: right;
      }

      .eval-positive {
        color: #eee;
      }

      .eval-negative {
        color: #aaa;
      }

      .analysis-moves {
        font-family: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace;
        font-size: 12px;
        color: #9a9eb1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .analysis-status {
        padding: 0 12px 8px;
        font-size: 12px;
        color: #829769;
        min-height: 4px;
      }
    `;
    document.head.appendChild(style);
  }
}
