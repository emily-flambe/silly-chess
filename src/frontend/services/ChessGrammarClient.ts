/**
 * ChessGrammar API Client
 *
 * Detects tactical patterns (forks, pins, skewers, etc.) in chess positions
 * using the ChessGrammar API. Requests are proxied through the Cloudflare Worker
 * to avoid CORS issues.
 *
 * API docs: https://chessgrammar.com/docs/api-reference
 * Rate limit: 30 req/min on free tier
 */

/** A single target in a tactic (piece on a square) */
export interface TacticTarget {
  square: string;
  piece: string;       // e.g. 'K', 'Q', 'R'
  piece_name: string;  // e.g. 'king', 'queen'
  color: string;       // 'white' | 'black'
}

/** A detected tactical pattern from the API */
export interface TacticalPattern {
  pattern: string;         // 'fork', 'pin', 'skewer', etc.
  color: string;           // attacking color
  keySquares: string[];
  targetSquares: string[];
  targets: TacticTarget[];
  gain: number;            // centipawns
  gainConfirmed: boolean;
  isMate: boolean;
  triggerMove?: string;    // UCI move, e.g. 'd4e2'
  description: string;     // human-readable summary
}

/** Raw API response tactic object */
interface ApiTactic {
  pattern: string;
  color: string;
  key_squares: string[];
  target_squares: string[];
  targets: TacticTarget[];
  gain: number;
  gain_confirmed: boolean;
  is_mate: boolean;
  trigger_move?: string;
  sequence?: string[];
  fen?: string;
}

/** Raw API response */
interface ApiResponse {
  tactics: ApiTactic[];
  count: number;
  depth: string;
  performance_ms: number;
  fen: string;
}

/** Pattern display names */
const PATTERN_NAMES: Record<string, string> = {
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discovered_attack: 'Discovered Attack',
  double_check: 'Double Check',
  back_rank_mate: 'Back Rank Mate',
  smothered_mate: 'Smothered Mate',
  deflection: 'Deflection',
  interference: 'Interference',
  trapped_piece: 'Trapped Piece',
};

/** Pattern icons */
const PATTERN_ICONS: Record<string, string> = {
  fork: '\u2694\uFE0F',
  pin: '\uD83D\uDCCC',
  skewer: '\uD83C\uDFF9',
  discovered_attack: '\uD83D\uDCA5',
  double_check: '\u2757\u2757',
  back_rank_mate: '\uD83D\uDC80',
  smothered_mate: '\uD83E\uDEE3',
  deflection: '\u21AA\uFE0F',
  interference: '\uD83D\uDEAB',
  trapped_piece: '\uD83E\uDEA4',
};

export class ChessGrammarClient {
  private rateLimitDelay = 2100; // ~30/min = 1 per 2s, with margin
  private lastRequestTime = 0;
  private cache = new Map<string, { tactics: TacticalPattern[]; timestamp: number }>();
  private cacheMaxAge = 60_000; // 1 minute

  /**
   * Detect tactical patterns in the given FEN position.
   * Uses the proxy at /api/tactics to avoid CORS issues.
   * Returns empty array on any error.
   */
  async detectTactics(fen: string): Promise<TacticalPattern[]> {
    // Check cache first
    const cached = this.cache.get(fen);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.tactics;
    }

    // Rate limiting: wait if we've sent a request too recently
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(`/api/tactics?fen=${encodeURIComponent(fen)}`);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('ChessGrammar: rate limit exceeded, backing off');
          this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 10_000);
        }
        console.error(`ChessGrammar API error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as ApiResponse;
      const tactics = (data.tactics || []).map((t) => this.mapTactic(t));

      // Cache result
      this.cache.set(fen, { tactics, timestamp: Date.now() });

      return tactics;
    } catch (error) {
      console.error('ChessGrammar request failed:', error);
      return [];
    }
  }

  /** Map raw API tactic to our interface with a human-readable description */
  private mapTactic(raw: ApiTactic): TacticalPattern {
    const patternName = PATTERN_NAMES[raw.pattern] || raw.pattern;
    const icon = PATTERN_ICONS[raw.pattern] || '\u2699\uFE0F';

    // Build description
    let description = `${icon} ${patternName}`;
    if (raw.targets && raw.targets.length > 0) {
      const targetList = raw.targets
        .map((t) => `${t.piece_name} on ${t.square}`)
        .join(' and ');
      description += ` \u2014 attacks ${targetList}`;
    }
    if (raw.is_mate) {
      description += ' (leads to checkmate)';
    } else if (raw.gain > 0) {
      const pawns = (raw.gain / 100).toFixed(1);
      description += ` (+${pawns} pawns)`;
    }

    return {
      pattern: raw.pattern,
      color: raw.color,
      keySquares: raw.key_squares || [],
      targetSquares: raw.target_squares || [],
      targets: raw.targets || [],
      gain: raw.gain,
      gainConfirmed: raw.gain_confirmed,
      isMate: raw.is_mate,
      triggerMove: raw.trigger_move,
      description,
    };
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
  }
}
