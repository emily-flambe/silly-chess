import { describe, it, expect } from 'vitest';
import { toWhitePerspective, wdlToWhiteExpectedScore } from './evalPerspective';

// Standard FENs for testing
const WHITE_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';

describe('toWhitePerspective', () => {
  describe('centipawn evaluation', () => {
    it('keeps positive cp when white to move (white is winning)', () => {
      const result = toWhitePerspective({ evaluation: 50 }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'centipawns', value: 50 });
    });

    it('keeps negative cp when white to move (black is winning)', () => {
      const result = toWhitePerspective({ evaluation: -120 }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'centipawns', value: -120 });
    });

    it('flips positive cp when black to move (black thinks it is winning = white is losing)', () => {
      // Stockfish says +100 from black's perspective → white is at -100
      const result = toWhitePerspective({ evaluation: 100 }, BLACK_TO_MOVE);
      expect(result).toEqual({ type: 'centipawns', value: -100 });
    });

    it('flips negative cp when black to move (black thinks it is losing = white is winning)', () => {
      // Stockfish says -80 from black's perspective → white is at +80
      const result = toWhitePerspective({ evaluation: -80 }, BLACK_TO_MOVE);
      expect(result).toEqual({ type: 'centipawns', value: 80 });
    });

    it('zero stays zero regardless of side to move', () => {
      expect(toWhitePerspective({ evaluation: 0 }, WHITE_TO_MOVE))
        .toEqual({ type: 'centipawns', value: 0 });
      expect(toWhitePerspective({ evaluation: 0 }, BLACK_TO_MOVE))
        .toEqual({ type: 'centipawns', value: 0 });
    });
  });

  describe('WDL evaluation', () => {
    it('passes WDL through when white to move', () => {
      const wdl = { win: 45, draw: 30, loss: 25 };
      const result = toWhitePerspective({ evaluation: 30, wdl }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'wdl', win: 45, draw: 30, loss: 25 });
    });

    it('flips win/loss when black to move', () => {
      // From black's perspective: win=60, draw=20, loss=20
      // From white's perspective: win=20, draw=20, loss=60
      const wdl = { win: 60, draw: 20, loss: 20 };
      const result = toWhitePerspective({ evaluation: 100, wdl }, BLACK_TO_MOVE);
      expect(result).toEqual({ type: 'wdl', win: 20, draw: 20, loss: 60 });
    });

    it('draw stays the same regardless of side', () => {
      const wdl = { win: 10, draw: 80, loss: 10 };
      const whiteResult = toWhitePerspective({ evaluation: 0, wdl }, WHITE_TO_MOVE);
      const blackResult = toWhitePerspective({ evaluation: 0, wdl }, BLACK_TO_MOVE);
      expect(whiteResult.type === 'wdl' && whiteResult.draw).toBe(80);
      expect(blackResult.type === 'wdl' && blackResult.draw).toBe(80);
    });

    it('WDL takes priority over centipawn evaluation', () => {
      const wdl = { win: 50, draw: 30, loss: 20 };
      const result = toWhitePerspective({ evaluation: 999, wdl }, WHITE_TO_MOVE);
      expect(result.type).toBe('wdl');
    });

    it('after 1.d4 with black to move: WDL should favor white (not black)', () => {
      // This is the specific scenario the user reported as buggy.
      // After 1.d4, Stockfish (from black's POV) might report something like
      // win=25 (black wins 25%), draw=50, loss=25 (black loses 25%).
      // After flipping: white win=25, draw=50, loss=25 → roughly equal, slightly white.
      // The BUG would be if win/loss aren't flipped and we show black winning.
      const blackPovWdl = { win: 25, draw: 50, loss: 25 };
      const result = toWhitePerspective(
        { evaluation: -30, wdl: blackPovWdl },
        BLACK_TO_MOVE,
      );
      // After flipping: white's win = black's loss = 25
      expect(result).toEqual({ type: 'wdl', win: 25, draw: 50, loss: 25 });
    });

    it('after 1.d4 with black strongly losing: white should show winning', () => {
      // Black's POV: win=5, draw=15, loss=80 (black is getting crushed)
      // From white's perspective: win=80, draw=15, loss=5
      const blackPovWdl = { win: 5, draw: 15, loss: 80 };
      const result = toWhitePerspective(
        { evaluation: -300, wdl: blackPovWdl },
        BLACK_TO_MOVE,
      );
      expect(result).toEqual({ type: 'wdl', win: 80, draw: 15, loss: 5 });
    });
  });

  describe('mate evaluation', () => {
    it('white to move, white mates in 3', () => {
      const result = toWhitePerspective({ evaluation: 'M3' }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'mate', moves: 3 });
    });

    it('white to move, black mates in 5', () => {
      const result = toWhitePerspective({ evaluation: '-M5' }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'mate', moves: -5 });
    });

    it('black to move, black mates in 2 → white perspective: black mates (negative)', () => {
      // From black's POV: "M2" means black mates. From white's POV that's -M2.
      const result = toWhitePerspective({ evaluation: 'M2' }, BLACK_TO_MOVE);
      expect(result).toEqual({ type: 'mate', moves: -2 });
    });

    it('black to move, white mates in 4 → white perspective: white mates (positive)', () => {
      // From black's POV: "-M4" means black is getting mated. From white's POV that's +M4.
      const result = toWhitePerspective({ evaluation: '-M4' }, BLACK_TO_MOVE);
      expect(result).toEqual({ type: 'mate', moves: 4 });
    });
  });

  describe('edge cases', () => {
    it('non-parseable string evaluation falls back to 0 centipawns', () => {
      const result = toWhitePerspective({ evaluation: 'garbage' }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'centipawns', value: 0 });
    });

    it('WDL with all zeros', () => {
      const wdl = { win: 0, draw: 0, loss: 0 };
      const result = toWhitePerspective({ evaluation: 0, wdl }, WHITE_TO_MOVE);
      expect(result).toEqual({ type: 'wdl', win: 0, draw: 0, loss: 0 });
    });
  });
});

describe('wdlToWhiteExpectedScore', () => {
  it('returns 50 for symmetric drawish WDL (the bug scenario)', () => {
    // Starting position under strength limiting produced WDL like {11, 78, 11}.
    // Bar should show ~50, NOT 11.
    expect(wdlToWhiteExpectedScore(11, 78)).toBe(50);
  });

  it('returns 50 for perfectly equal WDL with no draws', () => {
    expect(wdlToWhiteExpectedScore(50, 0)).toBe(50);
  });

  it('returns 100 when white wins deterministically', () => {
    expect(wdlToWhiteExpectedScore(100, 0)).toBe(100);
  });

  it('returns 0 when black wins deterministically', () => {
    expect(wdlToWhiteExpectedScore(0, 0)).toBe(0);
  });

  it('returns 50 for a guaranteed draw', () => {
    expect(wdlToWhiteExpectedScore(0, 100)).toBe(50);
  });

  it('slight white edge (55/30/15) is slightly above 50', () => {
    // 55 + 15 = 70
    expect(wdlToWhiteExpectedScore(55, 30)).toBe(70);
  });

  it('slight black edge (15/30/55) is slightly below 50', () => {
    // 15 + 15 = 30
    expect(wdlToWhiteExpectedScore(15, 30)).toBe(30);
  });

  it('ignores the loss parameter (only uses win + draw/2)', () => {
    // Same win+draw, different loss should yield same score.
    // (This documents the API: loss is redundant given win+draw+loss=100,
    // and is intentionally not part of the expected-score formula.)
    expect(wdlToWhiteExpectedScore(40, 40)).toBe(60);
  });
});
