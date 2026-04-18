/**
 * PlayerBar Component
 *
 * Displays a player's identity (name, avatar), pieces they've captured,
 * material score advantage, and optional chess clock. One instance is
 * rendered above the board (for the opponent) and one below (for the
 * player) — the "side" prop is just used to pick which king SVG to
 * show as the avatar.
 */

import { Chess } from 'chess.js';
import type { Color } from '../../types';

type PieceType = 'Q' | 'R' | 'B' | 'N' | 'P';

export interface PlayerBarState {
  /** Which side of the board this bar represents. */
  color: Color;
  /** Display name ('You', 'CPU', 'Opponent', etc.) */
  name: string;
  /** Remaining time in ms, or null to hide the clock. */
  clockMs: number | null;
  /** True when this side's clock is actively ticking. */
  activeClock: boolean;
  /** Pieces captured BY this side (opponent's lost pieces). */
  captured: PieceType[];
  /** Material advantage for this side (0 if not ahead). */
  score: number;
}

const PIECE_VALUES: Record<PieceType, number> = {
  Q: 9,
  R: 5,
  B: 3,
  N: 3,
  P: 1,
};

const PIECE_ORDER: PieceType[] = ['Q', 'R', 'B', 'N', 'P'];

/**
 * Compute captured pieces and material score from a list of SAN moves.
 * Returns pieces captured BY white (black's lost pieces) and BY black.
 */
export function computeCapturesFromSAN(sanMoves: string[]): {
  byWhite: PieceType[];
  byBlack: PieceType[];
  scoreWhite: number;
  scoreBlack: number;
} {
  const byWhite: PieceType[] = [];
  const byBlack: PieceType[] = [];

  if (sanMoves.length === 0) {
    return { byWhite, byBlack, scoreWhite: 0, scoreBlack: 0 };
  }

  const chess = new Chess();
  for (let i = 0; i < sanMoves.length; i++) {
    try {
      const move = chess.move(sanMoves[i]);
      if (move && move.captured) {
        const captured = move.captured.toUpperCase() as PieceType;
        if (i % 2 === 0) {
          byWhite.push(captured);
        } else {
          byBlack.push(captured);
        }
      }
    } catch {
      break;
    }
  }

  const valueWhite = byWhite.reduce((sum, p) => sum + PIECE_VALUES[p], 0);
  const valueBlack = byBlack.reduce((sum, p) => sum + PIECE_VALUES[p], 0);

  return {
    byWhite,
    byBlack,
    scoreWhite: Math.max(0, valueWhite - valueBlack),
    scoreBlack: Math.max(0, valueBlack - valueWhite),
  };
}

export class PlayerBar {
  private container: HTMLElement;
  private state: PlayerBarState;

  constructor(container: HTMLElement, initial: PlayerBarState) {
    this.container = container;
    this.state = initial;
    this.render();
  }

  /**
   * Update the bar with new state. Re-renders only when state changed.
   */
  update(partial: Partial<PlayerBarState>): void {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  private render(): void {
    const { color, name, clockMs, activeClock, captured, score } = this.state;
    const colorLabel = color === 'white' ? 'White' : 'Black';
    const avatarPrefix = color === 'white' ? 'w' : 'b';
    // Captured pieces are from the opposite side (we show their lost pieces).
    const oppPrefix = color === 'white' ? 'b' : 'w';

    // Group captured pieces for display (highest value first).
    const grouped = new Map<PieceType, number>();
    for (const p of captured) {
      grouped.set(p, (grouped.get(p) || 0) + 1);
    }

    const groupsHtml = PIECE_ORDER
      .map(t => {
        const n = grouped.get(t) || 0;
        if (!n) return '';
        const imgs = Array.from({ length: n })
          .map(() => `<span class="cap-piece" style="background-image: url('/pieces/${oppPrefix}${t}.svg');" aria-label="${t}"></span>`)
          .join('');
        return `<span class="pb-group">${imgs}</span>`;
      })
      .filter(Boolean)
      .join('');

    const scoreHtml = score > 0 ? `<span class="pb-score">+${score}</span>` : '';

    const clockHtml = clockMs != null
      ? `<div class="pb-clock ${activeClock ? 'active' : ''} ${clockMs < 30000 ? 'low' : ''}">${formatClock(clockMs)}</div>`
      : `<div class="pb-clock hidden"></div>`;

    this.container.innerHTML = `
      <div class="player-id">
        <span class="player-avatar" style="background-image: url('/pieces/${avatarPrefix}K.svg');" aria-hidden="true"></span>
        <span class="player-name">${escapeHtml(name)} &middot; ${colorLabel}</span>
      </div>
      <div class="player-cap">${groupsHtml}${scoreHtml}</div>
      ${clockHtml}
    `;
  }
}

function formatClock(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
