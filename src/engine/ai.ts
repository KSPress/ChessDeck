import { fileOf, rankOf } from './board';
import { applyAction, cloneState, crownPlacementSquares, legalActions, materialOf } from './match';
import { findCrown, piecesOf, threatenedSquares } from './movement';
import { makeRng } from './rng';
import { BOARD_SIZE, opponentOf, type Action, type MatchState, type Side } from './types';

export type Difficulty = 'squire' | 'knight' | 'champion';

interface Profile {
  /** How many candidate actions get a one-ply reply search. 0 means greedy only. */
  width: number;
  /** Probability of taking a deliberately worse action, to feel beatable. */
  blunderChance: number;
  /**
   * Roughly how often, in milliseconds, this difficulty reconsiders the
   * board. There is no turn to wait for any more — the driving loop (see
   * `state/match.ts`) polls `chooseAction` on this cadence, so a squire feels
   * a beat slow to react and a champion looks like it never blinks.
   */
  reactionMs: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  squire: { width: 0, blunderChance: 0.35, reactionMs: 1100 },
  knight: { width: 6, blunderChance: 0.12, reactionMs: 650 },
  champion: { width: 14, blunderChance: 0, reactionMs: 320 },
};

/** How often (ms) a difficulty polls the board for its next move. */
export function reactionIntervalMs(difficulty: Difficulty): number {
  return PROFILES[difficulty].reactionMs;
}

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
  if (state.phase !== 'battle') return 0;

  const foe = opponentOf(side);
  let score = materialOf(state, side) - materialOf(state, foe);

  // Tempo: banked aether is a real, if lesser, resource — and in real time it
  // is also a rough proxy for how many cooldowns are about to come free.
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
    // Leaving the crown attacked loses outright the moment cooldowns allow,
    // so weight it far above any amount of material it could trade for.
    if (danger.has(ownCrown.square)) score -= 40;

    // Marching the crown upfield is how most losses actually happen: a card
    // can conjure a threat the current danger map cannot see, and the crown is
    // the one piece that cannot be traded. Keep it near home.
    const homeRank = side === 'gold' ? 0 : BOARD_SIZE - 1;
    score -= Math.abs(rankOf(ownCrown.square) - homeRank) * 1.2;
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

/** Picks where to stand the Crown before the clock starts: closest to centre. */
function choosePlacement(state: MatchState, side: Side): Action | null {
  const squares = crownPlacementSquares(state, side);
  if (squares.length === 0) return null;
  const centre = (BOARD_SIZE - 1) / 2;
  squares.sort((a, b) => Math.abs(fileOf(a) - centre) - Math.abs(fileOf(b) - centre));
  return { type: 'placeCrown', side, square: squares[0] as number };
}

/**
 * Picks the single best action `side` could take right now, or `null` when
 * there is nothing worth doing (including "nothing legal at all", which is
 * the normal state of things between cooldowns).
 *
 * Deliberately shallow: it scores each legal action, then for the strongest
 * handful plays out the opponent's single best immediate reply. That is
 * enough to punish hanging a piece — which is most of what a PVE opponent
 * needs to do — without the cost of a real minimax on a 36-square board.
 */
export function chooseAction(
  state: MatchState,
  side: Side,
  difficulty: Difficulty = 'knight',
  seed?: number,
): Action | null {
  if (state.status !== 'active') return null;
  if (state.phase === 'placement') return choosePlacement(state, side);

  const profile = PROFILES[difficulty];
  const rng = makeRng(seed ?? (state.seed ^ Math.floor(state.clockMs)) + (side === 'gold' ? 1 : 2));

  const actions = legalActions(state, side);
  if (actions.length === 0) return null;

  const scored = actions
    .map((action) => ({ action, score: quickScore(state, action, side) }))
    .filter((entry) => Number.isFinite(entry.score));
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);

  if (profile.width > 0) {
    const foe = opponentOf(side);
    for (const entry of scored.slice(0, profile.width)) {
      const after = applyAction(state, entry.action);
      if (after.status !== 'active') continue;

      // Assume the opponent takes their single best reply at this same
      // instant — the clock only advances between ticks, not within one.
      //
      // Every move reply is scored, never a truncated sample: a crown can
      // only be taken by a move, so dropping any of them would let the AI
      // hang its own crown to a capture it was capable of seeing. Card
      // replies are sampled instead — there can be hundreds once
      // multi-target effects are expanded, and none end the match outright.
      const replies = legalActions(after, foe);
      const considered = [
        ...replies.filter((r) => r.type === 'move'),
        ...replies.filter((r) => r.type !== 'move').slice(0, 20),
      ];

      let worst = Number.POSITIVE_INFINITY;
      for (const reply of considered) {
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
 * Advances `side`'s AI by exactly one decision: choose, then apply. This is
 * the real-time replacement for the old "play a whole turn" loop — there is
 * no turn any more, just one reaction at a time, called on whatever cadence
 * `reactionIntervalMs` suggests. Returns `state` unchanged if there was
 * nothing worth doing.
 */
export function playAiTick(state: MatchState, side: Side, difficulty: Difficulty = 'knight'): MatchState {
  const action = chooseAction(cloneState(state), side, difficulty);
  return action ? applyAction(state, action) : state;
}
