import { ALL_DIRECTIONS, promotionRank, rankOf, shift } from './board';
import { getFaction, getPiece } from './registry';
import {
  ARMOR_PIERCE_COST,
  opponentOf,
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
 * The side used to orient this piece's own movement. Normally its owner, but
 * an Undead zombie is "reversed" — it fights for its new owner while still
 * facing the way it did in its old life, so its forward direction is its
 * *former* owner's, which is exactly the opposing side from its current one.
 */
export function orientSideOf(piece: PieceInstance): Side {
  return piece.reversed ? opponentOf(piece.owner) : piece.owner;
}

/**
 * Whether `attacker` is allowed to take `defender`, accounting for shields,
 * bunkers, armour, an evading attacker, and permanent walls.
 */
export function canCapture(
  state: MatchState,
  attacker: PieceInstance,
  defender: PieceInstance,
): boolean {
  if (defender.owner === attacker.owner) return false;
  // A wall (Barricade) can never be taken, by anything, ever.
  if (defender.traits.includes('immutable')) return false;
  if (defender.shieldedUntilMs > state.clockMs) return false;
  // A bunkered piece is under the board — there is nothing there to take.
  if (defender.submergedUntilMs > state.clockMs) return false;
  // Vanish trades the ability to strike for a moment of safety.
  if (attacker.noCaptureUntilMs > state.clockMs) return false;
  if (isArmored(state, defender) && attackCostOf(attacker) <= ARMOR_PIERCE_COST) return false;
  return true;
}

export function effectiveRules(_state: MatchState, piece: PieceInstance): MoveRule[] {
  const base = getPiece(piece.pieceId).rules;
  return piece.grantedRules.length > 0 ? [...base, ...piece.grantedRules] : base;
}

/**
 * Whether a piece may move at this instant. Cooldown is the game's pacing
 * lever: a piece that has just moved, or has just been mustered, is resting.
 */
export function canMove(state: MatchState, piece: PieceInstance): boolean {
  return (
    piece.readyAtMs <= state.clockMs &&
    piece.rootedUntilMs <= state.clockMs &&
    piece.submergedUntilMs <= state.clockMs
  );
}

function wouldPromote(piece: PieceInstance, to: Square): boolean {
  return piece.traits.includes('promotes') && rankOf(to) === promotionRank(orientSideOf(piece));
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
  if (state.status !== 'active' || state.phase !== 'battle') return [];
  if (!canMove(state, piece)) return [];

  const moves: MoveOption[] = [];
  const seen = new Set<Square>();
  const ethereal = piece.traits.includes('ethereal');
  const orient = orientSideOf(piece);
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
          current = shift(current, dir, orient);
          if (current === -1) break;
          const occupant = pieceAt(state, current);
          if (!occupant) {
            add(current, null);
            continue;
          }
          // A bunkered piece is beneath the board: it neither blocks the ride
          // nor offers a square to land on.
          if (occupant.submergedUntilMs > state.clockMs) continue;
          if (canCapture(state, piece, occupant)) add(current, occupant);
          if (!ethereal) break;
        }
      }
    } else if (rule.kind === 'leap') {
      for (const offset of rule.offsets) {
        const target = shift(piece.square, offset, orient);
        if (target === -1) continue;
        const occupant = pieceAt(state, target);
        if (!occupant) add(target, null);
        else if (canCapture(state, piece, occupant)) add(target, occupant);
      }
    } else if (rule.kind === 'rider') {
      // A Nightrider: the same knight-shaped hop, ridden repeatedly like a
      // rook rides single steps — blocked by what it would land on, nothing
      // else, since there is no "between" two leaps.
      let current = piece.square;
      for (let step = 0; step < rule.range; step += 1) {
        current = shift(current, rule.offset, orient);
        if (current === -1) break;
        const occupant = pieceAt(state, current);
        if (!occupant) {
          add(current, null);
          continue;
        }
        if (occupant.submergedUntilMs > state.clockMs) continue;
        if (canCapture(state, piece, occupant)) add(current, occupant);
        if (!ethereal) break;
      }
    } else if (rule.kind === 'bentLeap') {
      // A Mao: one orthogonal step (which can block the move) then one
      // diagonal step outward from there.
      for (const { leg, offset } of rule.leaps) {
        const legSquare = shift(piece.square, leg, orient);
        if (legSquare === -1 || pieceAt(state, legSquare)) continue;
        const target = shift(piece.square, offset, orient);
        if (target === -1) continue;
        const occupant = pieceAt(state, target);
        if (!occupant) add(target, null);
        else if (canCapture(state, piece, occupant)) add(target, occupant);
      }
    } else if (rule.kind === 'hopper') {
      // A Grasshopper: rides to the first piece in a line (the hurdle), then
      // must land on the very next square beyond it.
      for (const dir of rule.dirs) {
        let current = piece.square;
        let hurdle: Square | null = null;
        for (let step = 0; step < rule.range; step += 1) {
          current = shift(current, dir, orient);
          if (current === -1) break;
          if (pieceAt(state, current)) {
            hurdle = current;
            break;
          }
        }
        if (hurdle === null) continue;
        const landing = shift(hurdle, dir, orient);
        if (landing === -1) continue;
        const occupant = pieceAt(state, landing);
        if (!occupant) add(landing, null);
        else if (canCapture(state, piece, occupant)) add(landing, occupant);
      }
    } else {
      // Pawn: quiet steps straight ahead, captures only forward-diagonally.
      let current = piece.square;
      for (let step = 0; step < rule.range; step += 1) {
        current = shift(current, { df: 0, dr: 1 }, orient);
        if (current === -1 || pieceAt(state, current)) break;
        add(current, null);
      }
      for (const df of [-1, 1]) {
        const target = shift(piece.square, { df, dr: 1 }, orient);
        if (target === -1) continue;
        const occupant = pieceAt(state, target);
        if (occupant && canCapture(state, piece, occupant)) add(target, occupant);
      }
    }
  }

  return moves;
}

/**
 * Every empty square a piece could reach along its own movement lines if
 * nothing were in the way — Elven Blink's destination set. It still can't
 * land ON a blocker, only skip past one.
 */
export function blinkDestinations(state: MatchState, piece: PieceInstance): Square[] {
  const orient = orientSideOf(piece);
  const found = new Set<Square>();

  for (const rule of effectiveRules(state, piece)) {
    if (rule.kind === 'slide') {
      for (const dir of rule.dirs) {
        let current = piece.square;
        for (let step = 0; step < rule.range; step += 1) {
          current = shift(current, dir, orient);
          if (current === -1) break;
          if (!pieceAt(state, current)) found.add(current);
        }
      }
    } else if (rule.kind === 'leap') {
      for (const offset of rule.offsets) {
        const target = shift(piece.square, offset, orient);
        if (target !== -1 && !pieceAt(state, target)) found.add(target);
      }
    } else if (rule.kind === 'rider') {
      let current = piece.square;
      for (let step = 0; step < rule.range; step += 1) {
        current = shift(current, rule.offset, orient);
        if (current === -1) break;
        if (!pieceAt(state, current)) found.add(current);
      }
    } else if (rule.kind === 'bentLeap') {
      // Blinking skips past the leg-blocker too — it is a pure teleport.
      for (const { offset } of rule.leaps) {
        const target = shift(piece.square, offset, orient);
        if (target !== -1 && !pieceAt(state, target)) found.add(target);
      }
    } else if (rule.kind === 'pawn') {
      let current = piece.square;
      for (let step = 0; step < rule.range; step += 1) {
        current = shift(current, { df: 0, dr: 1 }, orient);
        if (current === -1) break;
        if (!pieceAt(state, current)) found.add(current);
      }
    }
    // Grasshopper lines depend on a hurdle that Blink has no business
    // reasoning about, so hopper rules simply contribute nothing here.
  }

  found.delete(piece.square);
  return [...found];
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
 * How far ahead danger is judged. A piece on cooldown is not harmless — it is
 * about to be free — so threat is measured against where the board will be a
 * moment from now, not where it is this instant.
 */
export const THREAT_HORIZON_MS = 2_500;

/**
 * Squares a side will threaten within the next breath, ignoring whether a
 * capture there is currently legal. Used to score danger, not to validate
 * moves: judging it with `canMove` makes resting enemies look safe and invites
 * you to park your Crown beside one.
 */
export function threatenedSquares(state: MatchState, side: Side): Set<Square> {
  const horizon = state.clockMs + THREAT_HORIZON_MS;
  const threatened = new Set<Square>();
  for (const piece of piecesOf(state, side)) {
    if (piece.rootedUntilMs > horizon || piece.submergedUntilMs > horizon) continue;
    const orient = orientSideOf(piece);
    for (const rule of effectiveRules(state, piece)) {
      if (rule.kind === 'pawn') {
        for (const df of [-1, 1]) {
          const target = shift(piece.square, { df, dr: 1 }, orient);
          if (target !== -1) threatened.add(target);
        }
      } else if (rule.kind === 'leap') {
        for (const offset of rule.offsets) {
          const target = shift(piece.square, offset, orient);
          if (target !== -1) threatened.add(target);
        }
      } else if (rule.kind === 'bentLeap') {
        for (const { leg, offset } of rule.leaps) {
          const legSquare = shift(piece.square, leg, orient);
          if (legSquare !== -1 && !pieceAt(state, legSquare)) {
            const target = shift(piece.square, offset, orient);
            if (target !== -1) threatened.add(target);
          }
        }
      } else if (rule.kind === 'rider') {
        let current = piece.square;
        for (let step = 0; step < rule.range; step += 1) {
          current = shift(current, rule.offset, orient);
          if (current === -1) break;
          threatened.add(current);
          const occupant = pieceAt(state, current);
          if (occupant && occupant.submergedUntilMs <= state.clockMs && !piece.traits.includes('ethereal')) break;
        }
      } else if (rule.kind === 'hopper') {
        for (const dir of rule.dirs) {
          let current = piece.square;
          let hurdle: Square | null = null;
          for (let step = 0; step < rule.range; step += 1) {
            current = shift(current, dir, orient);
            if (current === -1) break;
            if (pieceAt(state, current)) {
              hurdle = current;
              break;
            }
          }
          if (hurdle === null) continue;
          const landing = shift(hurdle, dir, orient);
          if (landing !== -1) threatened.add(landing);
        }
      } else {
        for (const dir of rule.dirs) {
          let current = piece.square;
          for (let step = 0; step < rule.range; step += 1) {
            current = shift(current, dir, orient);
            if (current === -1) break;
            threatened.add(current);
            const occupant = pieceAt(state, current);
            if (occupant && occupant.submergedUntilMs <= state.clockMs && !piece.traits.includes('ethereal')) break;
          }
        }
      }
    }
  }
  return threatened;
}
