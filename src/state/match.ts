import { create } from 'zustand';

import '@/content';
import {
  applyAction,
  checkAction,
  createMatch,
  deploySquares,
  getCard,
  getCrown,
  movesFrom,
  playAiTurn,
  targetOptions,
  type Action,
  type Deck,
  type Difficulty,
  type EffectSpec,
  type MatchState,
  type Square,
} from '@/engine';
import { useProfile } from './profile';

/** The human always plays gold; the AI or a remote opponent plays shadow. */
export const HUMAN_SIDE = 'gold' as const;

/** What the player is part-way through doing, if anything. */
export type Pending =
  | { kind: 'none' }
  | { kind: 'card'; handIndex: number; targets: Square[] }
  | { kind: 'power'; targets: Square[] };

interface MatchStore {
  state: MatchState | null;
  mode: 'pve' | 'pvp';
  difficulty: Difficulty;
  opponentName: string;
  /** True while the AI is taking its turn, so taps are ignored. */
  thinking: boolean;
  selected: Square | null;
  pending: Pending;
  /** Set once the result has been paid out, so rewards are never doubled. */
  rewarded: boolean;
  notice: string | null;

  begin: (player: Deck, opponent: Deck, difficulty: Difficulty, opponentName: string) => void;
  tapSquare: (square: Square) => void;
  tapCard: (handIndex: number) => void;
  tapPower: () => void;
  cancel: () => void;
  endTurn: () => void;
  resign: () => void;
  clear: () => void;
}

/** How long the AI appears to think, so its turn is readable rather than instant. */
const AI_DELAY_MS = 600;

export const useMatch = create<MatchStore>()((set, get) => {
  /**
   * Adds one target to a partially-filled effect and fires it once every slot
   * has a legal square.
   */
  function advanceTargets(
    spec: EffectSpec,
    chosen: readonly Square[],
    square: Square,
    fire: (targets: Square[]) => void,
  ): void {
    const state = get().state;
    if (!state) return;

    if (!targetOptions(state, HUMAN_SIDE, spec, chosen.length, chosen).includes(square)) {
      set({ notice: 'That is not a legal target.' });
      return;
    }

    const targets = [...chosen, square];
    if (targets.length === spec.slots.length) {
      fire(targets);
      return;
    }
    const pending = get().pending;
    if (pending.kind !== 'none') set({ pending: { ...pending, targets } });
  }

  function finish(state: MatchState): void {
    if (get().rewarded || get().mode !== 'pve') return;
    useProfile.getState().recordPveResult(state.status === 'gold_wins');
    set({ rewarded: true, thinking: false });
  }

  function settle(state: MatchState): void {
    if (state.status !== 'active') {
      finish(state);
      return;
    }
    if (state.active === HUMAN_SIDE) return;

    set({ thinking: true });
    setTimeout(() => {
      const live = get().state;
      // Guard against the match being cleared or reset while the AI "thought".
      if (!live || live.active === HUMAN_SIDE || live.status !== 'active') {
        set({ thinking: false });
        return;
      }
      const after = playAiTurn(live, get().difficulty);
      set({ state: after, thinking: false });
      if (after.status !== 'active') finish(after);
    }, AI_DELAY_MS);
  }

  /** Commits an action, then hands over to the AI if the turn has passed. */
  function commit(action: Action): void {
    const current = get().state;
    if (!current) return;

    const legality = checkAction(current, action);
    if (!legality.ok) {
      set({ notice: legality.reason ?? 'That is not a legal action.' });
      return;
    }

    const next = applyAction(current, action);
    set({ state: next, selected: null, pending: { kind: 'none' }, notice: null });
    settle(next);
  }

  /** Whether the human may act at all right now. */
  function playable(): MatchState | null {
    const { state, thinking } = get();
    if (!state || thinking) return null;
    if (state.status !== 'active' || state.active !== HUMAN_SIDE) return null;
    return state;
  }

  return {
    state: null,
    mode: 'pve',
    difficulty: 'knight',
    opponentName: 'Opponent',
    thinking: false,
    selected: null,
    pending: { kind: 'none' },
    rewarded: false,
    notice: null,

    begin: (player, opponent, difficulty, opponentName) =>
      set({
        state: createMatch({ goldDeck: player, shadowDeck: opponent, seed: Date.now() }),
        mode: 'pve',
        difficulty,
        opponentName,
        thinking: false,
        selected: null,
        pending: { kind: 'none' },
        rewarded: false,
        notice: null,
      }),

    tapCard: (handIndex) => {
      const state = playable();
      if (!state) return;
      const pending = get().pending;

      // Tapping the same card again puts it back down.
      if (pending.kind === 'card' && pending.handIndex === handIndex) {
        set({ pending: { kind: 'none' }, notice: null });
        return;
      }

      const cardId = state.players[HUMAN_SIDE].hand[handIndex];
      if (!cardId) return;
      const card = getCard(cardId);

      if (state.cardsLeft <= 0) {
        set({ notice: 'You have already played a card this turn.' });
        return;
      }
      if (state.players[HUMAN_SIDE].aether < card.cost) {
        set({ notice: `${card.name} costs ${card.cost} aether.` });
        return;
      }

      // Effects with no targets resolve the moment they are tapped.
      if (card.kind === 'effect' && card.spec.slots.length === 0) {
        commit({ type: 'cast', handIndex, targets: [] });
        return;
      }
      set({ pending: { kind: 'card', handIndex, targets: [] }, selected: null, notice: null });
    },

    tapPower: () => {
      const state = playable();
      if (!state) return;
      if (get().pending.kind === 'power') {
        set({ pending: { kind: 'none' } });
        return;
      }

      const player = state.players[HUMAN_SIDE];
      const crown = getCrown(player.crownId);

      if (state.cardsLeft <= 0) {
        set({ notice: 'You have already used your card action this turn.' });
        return;
      }
      if (player.powerCooldown > 0) {
        set({ notice: `${crown.powerName} recharges in ${player.powerCooldown} turn(s).` });
        return;
      }
      if (player.aether < crown.powerCost) {
        set({ notice: `${crown.powerName} costs ${crown.powerCost} aether.` });
        return;
      }

      if (crown.power.slots.length === 0) {
        commit({ type: 'power', targets: [] });
        return;
      }
      if (targetOptions(state, HUMAN_SIDE, crown.power, 0).length === 0) {
        set({ notice: `Nothing to target with ${crown.powerName}.` });
        return;
      }
      set({ pending: { kind: 'power', targets: [] }, selected: null, notice: null });
    },

    tapSquare: (square) => {
      const state = playable();
      if (!state) return;
      const { pending, selected } = get();

      if (pending.kind === 'card') {
        const cardId = state.players[HUMAN_SIDE].hand[pending.handIndex];
        if (!cardId) return;
        const card = getCard(cardId);

        if (card.kind === 'piece') {
          if (deploySquares(state, HUMAN_SIDE).includes(square)) {
            commit({ type: 'deploy', handIndex: pending.handIndex, to: square });
          } else {
            set({ notice: 'Deploy onto an empty square in your muster zone.' });
          }
          return;
        }
        advanceTargets(card.spec, pending.targets, square, (targets) =>
          commit({ type: 'cast', handIndex: pending.handIndex, targets }),
        );
        return;
      }

      if (pending.kind === 'power') {
        const crown = getCrown(state.players[HUMAN_SIDE].crownId);
        advanceTargets(crown.power, pending.targets, square, (targets) =>
          commit({ type: 'power', targets }),
        );
        return;
      }

      // No card in hand — this is ordinary piece movement.
      if (selected !== null && movesFrom(state, selected).includes(square)) {
        commit({ type: 'move', from: selected, to: square });
        return;
      }

      const piece = state.board[square];
      if (piece && piece.owner === HUMAN_SIDE) {
        set({ selected: selected === square ? null : square, notice: null });
      } else {
        set({ selected: null });
      }
    },

    cancel: () => set({ pending: { kind: 'none' }, selected: null, notice: null }),
    endTurn: () => commit({ type: 'endTurn' }),

    resign: () => {
      const state = get().state;
      if (!state || state.status !== 'active') return;
      const conceded: MatchState = { ...state, status: 'shadow_wins' };
      set({ state: conceded, pending: { kind: 'none' }, selected: null });
      finish(conceded);
    },

    clear: () =>
      set({ state: null, selected: null, pending: { kind: 'none' }, thinking: false, notice: null }),
  };
});

/* ------------------------------------------------------------------ */
/* Selectors used by the board renderer                                */
/* ------------------------------------------------------------------ */

export interface Highlights {
  /** Squares the current tap could legally act on. */
  targets: Square[];
  /** Squares among those that hold an enemy piece. */
  captures: Square[];
}

const NO_HIGHLIGHTS: Highlights = { targets: [], captures: [] };

export function highlightsFor(store: {
  state: MatchState | null;
  pending: Pending;
  selected: Square | null;
}): Highlights {
  const { state, pending, selected } = store;
  if (!state || state.status !== 'active' || state.active !== HUMAN_SIDE) return NO_HIGHLIGHTS;

  if (pending.kind === 'card') {
    const cardId = state.players[HUMAN_SIDE].hand[pending.handIndex];
    if (!cardId) return NO_HIGHLIGHTS;
    const card = getCard(cardId);
    if (card.kind === 'piece') return { targets: deploySquares(state, HUMAN_SIDE), captures: [] };
    return {
      targets: targetOptions(state, HUMAN_SIDE, card.spec, pending.targets.length, pending.targets),
      captures: [],
    };
  }

  if (pending.kind === 'power') {
    const crown = getCrown(state.players[HUMAN_SIDE].crownId);
    return {
      targets: targetOptions(state, HUMAN_SIDE, crown.power, pending.targets.length, pending.targets),
      captures: [],
    };
  }

  if (selected === null) return NO_HIGHLIGHTS;
  const targets = movesFrom(state, selected);
  return { targets, captures: targets.filter((t) => !!state.board[t]) };
}
