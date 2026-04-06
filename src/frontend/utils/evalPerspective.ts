/**
 * Eval Perspective Utilities
 *
 * Stockfish returns evaluations from the side-to-move's perspective.
 * These utilities convert to white's perspective for consistent display.
 */

export interface StockfishAnalysis {
  evaluation: number | string;
  wdl?: { win: number; draw: number; loss: number };
}

/**
 * Result of converting a Stockfish analysis to white's perspective.
 * Exactly one of `wdl`, `mate`, or `centipawns` will be set.
 */
export type WhitePerspectiveEval =
  | { type: 'wdl'; win: number; draw: number; loss: number }
  | { type: 'mate'; moves: number }  // positive = white mates, negative = black mates
  | { type: 'centipawns'; value: number };  // positive = white advantage

/**
 * Convert a Stockfish analysis result from side-to-move perspective
 * to white's perspective.
 *
 * @param analysis - Raw Stockfish analysis (eval from side-to-move's POV)
 * @param fen - The FEN that was analyzed (used to determine side to move)
 */
export function toWhitePerspective(analysis: StockfishAnalysis, fen: string): WhitePerspectiveEval {
  const isBlackToMove = fen.split(' ')[1] === 'b';

  // WDL takes priority when available
  if (analysis.wdl) {
    // WDL is from side-to-move's perspective; flip for black
    const win = isBlackToMove ? analysis.wdl.loss : analysis.wdl.win;
    const draw = analysis.wdl.draw;
    const loss = isBlackToMove ? analysis.wdl.win : analysis.wdl.loss;
    return { type: 'wdl', win, draw, loss };
  }

  // Mate score
  if (typeof analysis.evaluation === 'string') {
    const mateMatch = analysis.evaluation.match(/^-?M(\d+)$/);
    if (mateMatch) {
      const moves = parseInt(mateMatch[1], 10);
      let isNegative = analysis.evaluation.startsWith('-');
      if (isBlackToMove) isNegative = !isNegative;
      return { type: 'mate', moves: isNegative ? -moves : moves };
    }
  }

  // Centipawn score
  const cp = typeof analysis.evaluation === 'number' ? analysis.evaluation : 0;
  const evalFromWhitePerspective = isBlackToMove ? -cp : cp;
  return { type: 'centipawns', value: evalFromWhitePerspective || 0 };
}
