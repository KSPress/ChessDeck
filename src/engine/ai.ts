import { findCrown, piecesOf, threatenedSquares } from './movement';
import { applyAction, cloneState, legalActions, materialOf } from './match';
import { getPiece } from './registry';
import { makeRng } from './rng';
import { fileOf, rankOf } from './board';
import { BOARD_SIZE, opponentOf, type Action, type MatchState, type Side } from './types';

export type Difficulty = 'squire' | 'knight' | 'champion';

interface Profile {
  /** How many candidate actions get a reply search. 0 means greedy only. */
  width: number;
  /** Probability of taking a deliberately worse action, to feel beatable. */
  blunderChance: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  squire: { width: 0, blunderChance: 0.35 },
  knight: { width: 6, blunderChance: 0.1 },
  champion: { width: 14, blunderChance: 0 },
};

/** Distance from the board edge, peaking in the middle. Centre squares matter. */
function centrality(square: number): number {
  const mid = (BOARD_SIZE - 1) / 2;
  return 2 - (Math.abs(fileOf(square) - mid) + Math.abs(rankOf(square) - mid)) / mid;
}

/**
 * Static evaluation from `side`'s point of view, in "piece value" units.
 * A decided match dominates everything else so the search never trades its own
 * crown for material.
 */
export function evaluate(state: MatchState, side: Side): number {
  if (state.status !== 'active') {
    if (state.status === 'draw') return 0;
    const winner: Side = state.status === 'gold_wins' ? 'gold' : 'shadow';
    return winner === side ? 10_000 : -10_000;
  }

  const foe = opponentOf(side);
  let score = materialOf(state, side) - materialOf(state, foe);

  // Tempo: banked aether and cards in hand are real, if lesser, resources.
  score += (state.players[side].aether - state.players[foe].aether) * 0.15;

  // Board presence, and pushing pawns toward promotion.
  for (const piece of piecesOf(state, side)) {
    if (piece.crownId) continue;
    score += centrality(piece.square) * 0.12;
    if (piece.traits.includes('promotes')) {
      const advanced = side === 'gold' ? rankOf(piece.square) : BOARD_SIZE - 1 - rankOf(piece.square);
      score += advanced * 0.18;
    }
  }

  // Crown safety, weighted heavily — the crown is the only thing that must live.
  const ownCrown = findCrown(state, side);
  const foeCrown = findCrown(state, foe);
  if (ownCrown) {
    const danger = threatenedSquares(state, foe);
    if (danger.has(ownCrown.square)) score -= 8;
    score -= centrality(ownCrown.square) * 0.3;
  }
  if (foeCrown) {
    const pressure = threatenedSquares(state, side);
    if (pressure.has(foeCrown.square)) score += 8;
  }

  return score;
}

/** Cheap ordering heuristic so the reply search looks at forcing moves first. */
function quickScore(state: MatchState, action: Action, side: Side): number {
  try {
    return evaluate(applyAction(state, action), side);
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

/**
 * Picks an action for `state.active`.
 *
 * Deliberately shallow: it scores each legal action, then for the strongest
 * handful plays out the opponent's single best reply. That is enough to punish
 * hanging a piece — which is most of what a PVE opponent needs to do — without
 * the search cost of a real minimax on a 36-square board with card actions.
 */
export function chooseAction(state: MatchState, difficulty: Difficulty = 'knight', seed?: number): Action {
  const side = state.active;
  const profile = PROFILES[difficulty];
  const rng = makeRng(seed ?? state.seed + state.turn);

  const actions = legalActions(state);
  if (actions.length === 0) return { type: 'endTurn' };

  const scored = actions
    .map((action) => ({ action, score: quickScore(state, action, side) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { type: 'endTurn' };

  // Ending the turn while actions remain should be a last resort, not a habit.
  for (const entry of scored) {
    if (entry.action.type === 'endTurn' && scored.length > 1) entry.score -= 0.5;
  }
  scored.sort((a, b) => b.score - a.score);

  if (profile.width > 0) {
    for (const entry of scored.slice(0, profile.width)) {
      const after = applyAction(state, entry.action);
      if (after.status !== 'active' || after.active === side) continue;

      // Assume the opponent takes their single best immediate action.
      let worst = Number.POSITIVE_INFINITY;
      for (const reply of legalActions(after).slice(0, 40)) {
        const value = quickScore(after, reply, side);
        if (Number.isFinite(value) && value < worst) worst = value;
      }
      if (Number.isFinite(worst)) entry.score = worst;
    }
    scored.sort((a, b) => b.score - a.score);
  }

  if (profile.blunderChance > 0 && scored.length > 1 && rng() < profile.blunderChance) {
    const index = 1 + Math.floor(rng() * Math.min(scored.length - 1, 4));
    return (scored[index] ?? scored[0]).action;
  }

  return scored[0].action;
}

/**
 * Plays the AI's whole turn (it may take both a move and a card action),
 * returning the state once control passes back.
 */
export function playAiTurn(state: MatchState, difficulty: Difficulty = 'knight'): MatchState {
  let current = cloneState(state);
  const side = current.active;
  let guard = 0;

  while (current.status === 'active' && current.active === side && guard < 8) {
    const action = chooseAction(current, difficulty, current.seed + current.turn * 31 + guard);
    current = applyAction(current, action);
    guard += 1;
    if (action.type === 'endTurn') break;
  }
  return current;
}
