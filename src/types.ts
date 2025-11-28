/**
 * Silly Chess - TypeScript Type Definitions
 */

// Environment bindings for Cloudflare Worker
export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
}

// Chess Types
export type Color = 'white' | 'black';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type Square = string; // e.g., 'e4', 'a1'

export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

export type DrawReason = 'stalemate' | 'threefold' | 'fifty-move' | 'insufficient' | 'agreement';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

// Board State Interface (for future extensibility)
export interface BoardState {
  pieces: Map<Square, { piece: PieceType; color: Color }>;
  turn: Color;
  castlingRights: CastlingRights;
  enPassantSquare: Square | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: Move[];
}

// Move Interface
export interface Move {
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  flags: MoveFlags;
  san?: string;
}

export interface MoveFlags {
  isCapture: boolean;
  isPromotion: boolean;
  isCastleKingside: boolean;
  isCastleQueenside: boolean;
  isEnPassant: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
}

// Piece Definition Interface (for extensibility)
export interface PieceDefinition {
  id: string;
  name: string;
  symbol: string;
  svg: string;
  getMoves(board: BoardState, position: Square): Move[];
  canCapture?(target: PieceDefinition): boolean;
  onMove?(move: Move, board: BoardState): void;
  getValue(): number;
}

// Rule Set Interface (for variant support)
export interface RuleSet {
  name: string;
  isCheckmate(board: BoardState): Color | null;
  isStalemate(board: BoardState): boolean;
  isDraw(board: BoardState): DrawReason | null;
  isLegalMove(move: Move, board: BoardState): boolean;
  canCastle(board: BoardState, side: 'kingside' | 'queenside', color: Color): boolean;
  getEnPassantTarget(board: BoardState): Square | null;
  getInitialPosition(): BoardState;
  getAvailablePieces(): PieceDefinition[];
}

// Database Models
export interface User {
  id: string;
  created_at: number;
  display_name: string | null;
  preferred_elo: number;
}

export interface Game {
  id: string;
  user_id: string | null;
  pgn: string;
  result: GameResult;
  opponent_elo: number | null;
  created_at: number;
  ended_at: number | null;
}

// Stockfish Types
export interface StockfishOptions {
  elo: number;
  depth?: number;
  movetime?: number;
}

export interface StockfishAnalysis {
  bestMove: string;
  ponder?: string;
  evaluation: number | string; // centipawns or 'M3' for mate
  depth: number;
  nodes: number;
  pv: string[]; // principal variation
}

// API Types
export interface CreateUserRequest {
  display_name?: string;
}

export interface CreateGameRequest {
  user_id?: string;
  opponent_elo: number;
}

export interface UpdateGameRequest {
  pgn: string;
  result?: GameResult;
}

export interface UserPreferences {
  preferred_elo: number;
  display_name?: string;
}
