import { ALL_DIRECTIONS, promotionRank, rankOf, shift } from './board';
import { getFaction, getPiece } from './registry';
import {
  ALL_DIRECTIONS_RULE,
  ARMOR_PIERCE_COST,
  type MatchState,
  type MoveRule,
  type PieceInstance,
  type Side,
  type Square,
} from './types';

export interface MoveOption {
  from: Square;
  to: Square;
  /** The piece that would be taken, or null for a quiet move. */
  capture: PieceInstance | null;
  /** True when this move promotes the mover. */
  promotes: boolean;
}

export function pieceAt(state: MatchState, square: Square): PieceInstance | null {
  if (!Number.isInteger(square) || square < 0 || square >= state.board.length) return null;
  return state.board[square] ?? null;
}

/** Crowns have no deploy cost, so they always count as heavy enough to pierce armour. */
export function attackCostOf(piece: PieceInstance): number {
  return piece.crownId ? Number.POSITIVE_INFINITY : getPiece(piece.pieceId).cost;
}

/** Whether any friendly piece stands on one of the eight adjacent squares. */
export function hasFriendlyNeighbour(state: MatchState, piece: PieceInstance): boolean {
  for (const dir of ALL_DIRECTIONS) {
    const square = shift(piece.square, dir, piece.owner);
    if (square === -1) continue;
    const neighbour = pieceAt(state, square);
    if (neighbour && neighbour.owner === piece.owner) return true;
  }
  return false;
}

/**
 * Armour can be innate, granted mid-match, or — for the Deephold Kin — earned
 * simply by standing next to a friend. Computing it from the live board keeps
 * Shieldwall exact as pieces shuffle around, rather than baking a stale trait.
 */
export function isArmored(state: MatchState, piece: PieceInstance): boolean {
  if (piece.traits.includes('armored')) return true;
  const passive = getFaction(state.players[piece.owner].factionId).passive;
  return passive.kind === 'shieldwall' && hasFriendlyNeighbour(state, piece);
}

/**
 * Whether `attacker` is allowed to take `defender`, accounting for shields,
 * bunkers and armour. Ownership is checked here too so callers cannot forget it.
 */
export function canCapture(
  state: MatchState,
  attacker: PieceInstance,
  defender: PieceInstance,
): boolean {
  if (defender.owner === attacker.owner) return false;
  if (defender.shielded > 0) return false;
  // A bunkered piece is under the board — there is nothing there to take.
  if (defender.submerged > 0) return false;
  if (isArmored(state, defender) && attackCostOf(attacker) <= ARMOR_PIERCE_COST) return false;
  return true;
}

export function effectiveRules(state: MatchState, piece: PieceInstance): MoveRule[] {
  // Regal Stride temporarily replaces the crown's movement with a queen's.
  if (piece.crownId && state.players[piece.owner].strideUntilTurn >= state.turn) {
    return [ALL_DIRECTIONS_RULE];
  }
  const base = getPiece(piece.pieceId).rules;
  return piece.grantedRules.length > 0 ? [...base, ...piece.grantedRules] : base;
}

/** Freshly mustered, rooted and bunkered pieces all stay put. */
export function canMove(piece: PieceInstance): boolean {
  return !piece.sick && piece.rooted <= 0 && piece.submerged <= 0;
}

function wouldPromote(piece: PieceInstance, to: Square): boolean {
  return piece.traits.includes('promotes') && rankOf(to) === promotionRank(piece.owner);
}

/**
 * Every legal move for one piece. A piece with several movement rules
 * contributes the union of them.
 *
 * A Crown may never step onto a square the enemy threatens — chess's rule
 * against moving into check. Losing the Crown loses the match outright and
 * there is no check warning, so without this a single mistimed tap ends the
 * game; with it, you can still lose your Crown by failing to answer a threat,
 * which keeps Crown capture a live win condition.
 */
export function generateMovesForPiece(state: MatchState, piece: PieceInstance): MoveOption[] {
  if (state.status !== 'active') return [];
  if (!canMove(piece)) return [];

  const moves: MoveOption[] = [];
  const seen = new Set<Square>();
  const ethereal = piece.traits.includes('ethereal');
  const forbidden = piece.crownId
    ? threatenedSquares(state, piece.owner === 'gold' ? 'shadow' : 'gold')
    : null;

  const add = (to: Square, capture: PieceInstance | null) => {
    if (seen.has(to)) return;
    if (forbidden?.has(to)) return;
    seen.add(to);
    moves.push({ from: piece.square, to, capture, promotes: wouldPromote(piece, to) });
  };

  for (const rule of effectiveRules(state, piece)) {
    if (rule.kind === 'slide') {
      for (const dir of rule.dirs) {
        let current = piece.square;
        for (let step = 0; step < rule.range; step += 1) {
          current = shift(current, dir, piece.owner);
          if (current === -1) break;
          const occupant = pieceAt(state, current);
          if (!occupant) {
            add(current, null);
            continue;
          }
          // A bunkered piece is beneath the board: it neither blocks the ride
          // nor offers a square to land on.
          if (occupant.submerged > 0) continue;
          if (canCapture(state, piece, occupant)) add(current, occupant);
          if (!ethereal) break;
        }
      }
    } else if (rule.kind === 'leap') {
      for (const offset of rule.offsets) {
        const target = shift(piece.square, offset, piece.owner);
        if (target === -1) continue;
        const occupant = pieceAt(state, target);
        if (!occupant) add(target, null);
        else if (canCapture(state, piece, occupant)) add(target, occupant);
      }
    } else {
      // Pawn: quiet steps straight ahead, captures only forward-diagonally.
      let current = piece.square;
      for (let step = 0; step < rule.range; step += 1) {
        current = shift(current, { df: 0, dr: 1 }, piece.owner);
        if (current === -1 || pieceAt(state, current)) break;
        add(current, null);
      }
      for (const df of [-1, 1]) {
        const target = shift(piece.square, { df, dr: 1 }, piece.owner);
        if (target === -1) continue;
        const occupant = pieceAt(state, target);
        if (occupant && canCapture(state, piece, occupant)) add(target, occupant);
      }
    }
  }

  return moves;
}

export function piecesOf(state: MatchState, side: Side): PieceInstance[] {
  return state.board.filter((p): p is PieceInstance => p !== null && p.owner === side);
}

export function generateAllMoves(state: MatchState, side: Side): MoveOption[] {
  return piecesOf(state, side).flatMap((piece) => generateMovesForPiece(state, piece));
}

export function findCrown(state: MatchState, side: Side): PieceInstance | null {
  return (
    state.board.find((p): p is PieceInstance => p !== null && p.owner === side && !!p.crownId) ?? null
  );
}

/**
 * Whether a piece will be free to move once its owner's next turn begins.
 *
 * This is deliberately *not* `canMove`. Summoning sickness always clears at the
 * owner's turn start, and rooting ticks down by one, so a piece that cannot
 * move right now may well be able to move by the time it matters. Judging
 * danger with `canMove` makes freshly mustered enemies look harmless and
 * invites you to park your Crown right next to one.
 */
function willBeFreeNextTurn(piece: PieceInstance): boolean {
  return piece.rooted <= 1 && piece.submerged <= 1;
}

/**
 * Squares a side will threaten on its next turn, ignoring whether a capture
 * there is currently legal. Used to score danger, not to validate moves.
 */
export function threatenedSquares(state: MatchState, side: Side): Set<Square> {
  const threatened = new Set<Square>();
  for (const piece of piecesOf(state, side)) {
    if (!willBeFreeNextTurn(piece)) continue;
    for (const rule of effectiveRules(state, piece)) {
      if (rule.kind === 'pawn') {
        for (const df of [-1, 1]) {
          const target = shift(piece.square, { df, dr: 1 }, piece.owner);
          if (target !== -1) threatened.add(target);
        }
      } else if (rule.kind === 'leap') {
        for (const offset of rule.offsets) {
          const target = shift(piece.square, offset, piece.owner);
          if (target !== -1) threatened.add(target);
        }
      } else {
        for (const dir of rule.dirs) {
          let current = piece.square;
          for (let step = 0; step < rule.range; step += 1) {
            current = shift(current, dir, piece.owner);
            if (current === -1) break;
            threatened.add(current);
            const occupant = pieceAt(state, current);
            if (occupant && occupant.submerged <= 0 && !piece.traits.includes('ethereal')) break;
          }
        }
      }
    }
  }
  return threatened;
}
