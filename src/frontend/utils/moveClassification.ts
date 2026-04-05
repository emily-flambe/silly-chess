/**
 * Move Classification Utility
 *
 * Classifies chess moves by comparing win probability before and after each move,
 * using the same formula as Lichess for centipawn-to-win% conversion.
 */

export type MoveClassification = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Convert centipawns to win percentage using the Lichess formula.
 * Returns value from white's perspective (0-100).
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Convert an evaluation (centipawns or mate string) to win percentage.
 * Evaluation should be from white's perspective.
 */
export function evalToWinPercent(evaluation: number | string): number {
  if (typeof evaluation === 'string') {
    // Mate score: "M3" or "-M5"
    const isNegative = evaluation.startsWith('-');
    return isNegative ? 0 : 100;
  }
  return winPercent(evaluation);
}

/**
 * Classify a move based on the drop in win percentage.
 * winPercentBefore and winPercentAfter should be from the moving side's perspective.
 */
export function classifyMove(winPercentBefore: number, winPercentAfter: number): MoveClassification {
  const drop = winPercentBefore - winPercentAfter;
  if (drop >= 30) return 'blunder';
  if (drop >= 20) return 'mistake';
  if (drop >= 10) return 'inaccuracy';
  if (drop >= 5) return 'good';
  if (drop >= 2) return 'excellent';
  return 'best';
}

/**
 * CSS color for each classification tier.
 */
export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  best: '#eee',
  excellent: '#eee',
  good: '#829769',
  inaccuracy: '#f0c040',
  mistake: '#e88430',
  blunder: '#e63946',
};
