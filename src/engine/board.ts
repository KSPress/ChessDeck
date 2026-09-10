import { BOARD_SIZE, NUM_SQUARES, type Side, type Square, type Vec } from './types';

/** How many ranks deep each player's deployment zone reaches. */
export const MUSTER_DEPTH = 2;

export const ORTHOGONAL: Vec[] = [
  { df: 1, dr: 0 },
  { df: -1, dr: 0 },
  { df: 0, dr: 1 },
  { df: 0, dr: -1 },
];

export const DIAGONAL: Vec[] = [
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
  { df: -1, dr: 1 },
  { df: -1, dr: -1 },
];

export const ALL_DIRECTIONS: Vec[] = [...ORTHOGONAL, ...DIAGONAL];

export const KNIGHT_OFFSETS: Vec[] = [
  { df: 1, dr: 2 },
  { df: 2, dr: 1 },
  { df: -1, dr: 2 },
  { df: -2, dr: 1 },
  { df: 1, dr: -2 },
  { df: 2, dr: -1 },
  { df: -1, dr: -2 },
  { df: -2, dr: -1 },
];

/** Every square exactly two steps away in a straight line, jumped over. */
export const LEAP_TWO_OFFSETS: Vec[] = ALL_DIRECTIONS.map((v) => ({ df: v.df * 2, dr: v.dr * 2 }));

export function squareOf(file: number, rank: number): Square {
  return rank * BOARD_SIZE + file;
}

export function fileOf(square: Square): number {
  return square % BOARD_SIZE;
}

export function rankOf(square: Square): number {
  return Math.floor(square / BOARD_SIZE);
}

export function isOnBoard(square: Square): boolean {
  return Number.isInteger(square) && square >= 0 && square < NUM_SQUARES;
}

/** Rank deltas are written from gold's point of view and flipped for shadow. */
export function forwardOf(side: Side): number {
  return side === 'gold' ? 1 : -1;
}

/**
 * Applies a direction vector from `square`, oriented for `side`.
 * Returns -1 when the result falls off the board.
 */
export function shift(square: Square, vec: Vec, side: Side): Square {
  const forward = forwardOf(side);
  const file = fileOf(square) + vec.df * forward;
  const rank = rankOf(square) + vec.dr * forward;
  if (file < 0 || file >= BOARD_SIZE || rank < 0 || rank >= BOARD_SIZE) return -1;
  return squareOf(file, rank);
}

/** The two ranks a player may deploy new pieces onto. */
export function isMusterSquare(square: Square, side: Side): boolean {
  const rank = rankOf(square);
  return side === 'gold' ? rank < MUSTER_DEPTH : rank >= BOARD_SIZE - MUSTER_DEPTH;
}

/** A player's own three ranks, used to bound teleport effects. */
export function isOwnHalf(square: Square, side: Side): boolean {
  const rank = rankOf(square);
  return side === 'gold' ? rank < BOARD_SIZE / 2 : rank >= BOARD_SIZE / 2;
}

/** The rank a promoting piece must reach. */
export function promotionRank(side: Side): number {
  return side === 'gold' ? BOARD_SIZE - 1 : 0;
}

/** Where each side's crown begins the match. */
export function throneSquare(side: Side): Square {
  return side === 'gold' ? squareOf(2, 0) : squareOf(2, BOARD_SIZE - 1);
}

/** Human-readable square name, e.g. c1. Files are a-f, ranks 1-6. */
export function squareName(square: Square): string {
  return `${String.fromCharCode(97 + fileOf(square))}${rankOf(square) + 1}`;
}
