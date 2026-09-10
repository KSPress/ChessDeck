import { create } from 'zustand';

import '@/content';
import {
  applyAction,
  checkAction,
  chooseAction,
  createMatch,
  crownPlacementSquares,
  deploySquares,
  getCard,
  getCrown,
  movesFrom,
  reactionIntervalMs,
  targetOptions,
  advance as advanceMatch,
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
const AI_SIDE = 'shadow' as const;

/** How often the battle clock ticks. Small enough to feel continuous. */
const CLOCK_TICK_MS = 100;
/** How long the AI takes to settle on where to stand its Crown, for feel. */
const PLACEMENT_THINK_MS = 500;

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
  /** Cosmetic only: true right after the AI acts, for a brief UI pulse. */
  thinking: boolean;
  selected: Square | null;
  pending: Pending;
  /** Set once the result has been paid out, so rewards are never doubled. */
  rewarded: boolean;
  notice: string | null;

  begin: (player: Deck, opponent: Deck, difficulty: Difficulty, opponentName: string) => void;
  tapSquare: (square: Square) => void;
  tapCard: (handIndex: number) => void;
  /** Picking a card up: arms it so the board can show where it may land. */
  beginDrag: (handIndex: number) => boolean;
  /** Releasing a card over `square`, or over nothing when it is null. */
  dropCard: (handIndex: number, square: Square | null) => void;
  tapPower: () => void;
  cancel: () => void;
  resign: () => void;
  clear: () => void;
}

// Real-time play has no turn order and no server, so the clock and the AI's
// reactions are driven by timers living outside React's render cycle — a
// setInterval for the battle clock, and a self-rescheduling setTimeout for
// the AI, both cleared and restarted by begin()/resign()/clear() below. Zustand
// stores are singletons for the app's lifetime, so module-level handles are
// the simplest correct place to keep them; there is only ever one live match.
let clockTimer: ReturnType<typeof setInterval> | null = null;
let aiTimer: ReturnType<typeof setTimeout> | null = null;
let placementTimer: ReturnType<typeof setTimeout> | null = null;

function stopTimers(): void {
  if (clockTimer) clearInterval(clockTimer);
  if (aiTimer) clearTimeout(aiTimer);
  if (placementTimer) clearTimeout(placementTimer);
  clockTimer = null;
  aiTimer = null;
  placementTimer = null;
}

export const useMatch = create<MatchStore>()((set, get) => {
  function finish(state: MatchState): void {
    stopTimers();
    if (get().rewarded || get().mode !== 'pve') return;
    useProfile.getState().recordPveResult(state.status === 'gold_wins');
    set({ rewarded: true });
  }

  /** Starts the battle clock and the AI's reaction loop, once both Crowns are down. */
  function startBattleLoops(): void {
    if (clockTimer) return; // already running

    clockTimer = setInterval(() => {
      const live = get().state;
      if (!live || live.status !== 'active' || live.phase !== 'battle') return;
      const next = advanceMatch(live, CLOCK_TICK_MS);
      set({ state: next });
      if (next.status !== 'active') finish(next);
    }, CLOCK_TICK_MS);

    scheduleAiTick();
  }

  function scheduleAiTick(): void {
    if (aiTimer) clearTimeout(aiTimer);
    const difficulty = get().difficulty;
    aiTimer = setTimeout(() => {
      const live = get().state;
      if (live && live.status === 'active' && live.phase === 'battle') {
        const action = chooseAction(live, AI_SIDE, difficulty);
        if (action) {
          try {
            const next = applyAction(live, action);
            set({ state: next, thinking: true });
            setTimeout(() => set({ thinking: false }), 220);
            if (next.status !== 'active') {
              finish(next);
              return;
            }
          } catch {
            // The board moved under it between choosing and applying — skip
            // this tick rather than crash; the next one will see fresh state.
          }
        }
      }
      scheduleAiTick();
    }, reactionIntervalMs(difficulty));
  }

  /** After any placeCrown action, starts the battle once both sides are down. */
  function afterPlacement(next: MatchState): void {
    if (next.phase === 'battle') startBattleLoops();
  }

  /** Commits an action, applying passives/log/etc. through the engine. */
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
    if (action.type === 'placeCrown') afterPlacement(next);
    if (next.status !== 'active') finish(next);
  }

  /** The live state, or null when the match cannot be acted on right now. */
  function playable(): MatchState | null {
    const { state } = get();
    if (!state || state.status !== 'active') return null;
    return state;
  }

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

    begin: (player, opponent, difficulty, opponentName) => {
      stopTimers();
      const state = createMatch({ goldDeck: player, shadowDeck: opponent, seed: Date.now() });
      set({
        state,
        mode: 'pve',
        difficulty,
        opponentName,
        thinking: false,
        selected: null,
        pending: { kind: 'none' },
        rewarded: false,
        notice: null,
      });

      // The AI settles on a Crown square almost at once — placement has no
      // clock pressure, so there's no reason to make the player wait long.
      placementTimer = setTimeout(() => {
        const live = get().state;
        if (!live || live.phase !== 'placement') return;
        const action = chooseAction(live, AI_SIDE, difficulty);
        if (!action) return;
        const next = applyAction(live, action);
        set({ state: next });
        afterPlacement(next);
      }, PLACEMENT_THINK_MS);
    },

    tapCard: (handIndex) => {
      const state = playable();
      if (!state || state.phase !== 'battle') return;
      const pending = get().pending;

      // Tapping the same card again puts it back down.
      if (pending.kind === 'card' && pending.handIndex === handIndex) {
        set({ pending: { kind: 'none' }, notice: null });
        return;
      }

      const cardId = state.players[HUMAN_SIDE].hand[handIndex];
      if (!cardId) return;
      const card = getCard(cardId);

      if (state.players[HUMAN_SIDE].aether < card.cost) {
        set({ notice: `${card.name} costs ${card.cost} aether.` });
        return;
      }

      // Effects with no targets resolve the moment they are tapped.
      if (card.kind === 'effect' && card.spec.slots.length === 0) {
        commit({ type: 'cast', side: HUMAN_SIDE, handIndex, targets: [] });
        return;
      }
      set({ pending: { kind: 'card', handIndex, targets: [] }, selected: null, notice: null });
    },

    tapPower: () => {
      const state = playable();
      if (!state || state.phase !== 'battle') return;
      if (get().pending.kind === 'power') {
        set({ pending: { kind: 'none' } });
        return;
      }

      const player = state.players[HUMAN_SIDE];
      const crown = getCrown(player.crownId);

      if (player.powerReadyAtMs > state.clockMs) {
        const seconds = Math.ceil((player.powerReadyAtMs - state.clockMs) / 1000);
        set({ notice: `${crown.powerName} recharges for ${seconds}s.` });
        return;
      }
      if (player.aether < crown.powerCost) {
        set({ notice: `${crown.powerName} costs ${crown.powerCost} aether.` });
        return;
      }

      if (crown.power.slots.length === 0) {
        commit({ type: 'power', side: HUMAN_SIDE, targets: [] });
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

      // Placement phase: a tap on a legal square stands the Crown there.
      if (state.phase === 'placement') {
        if (state.players[HUMAN_SIDE].crownPlaced) return;
        if (crownPlacementSquares(state, HUMAN_SIDE).includes(square)) {
          commit({ type: 'placeCrown', side: HUMAN_SIDE, square });
        } else {
          set({ notice: 'Stand your Crown in your muster zone, with room for its guard.' });
        }
        return;
      }

      const { pending, selected } = get();

      if (pending.kind === 'card') {
        const cardId = state.players[HUMAN_SIDE].hand[pending.handIndex];
        if (!cardId) return;
        const card = getCard(cardId);

        if (card.kind === 'piece') {
          if (deploySquares(state, HUMAN_SIDE).includes(square)) {
            commit({ type: 'deploy', side: HUMAN_SIDE, handIndex: pending.handIndex, to: square });
          } else {
            set({ notice: 'Deploy onto an empty square in your muster zone.' });
          }
          return;
        }
        advanceTargets(card.spec, pending.targets, square, (targets) =>
          commit({ type: 'cast', side: HUMAN_SIDE, handIndex: pending.handIndex, targets }),
        );
        return;
      }

      if (pending.kind === 'power') {
        const crown = getCrown(state.players[HUMAN_SIDE].crownId);
        advanceTargets(crown.power, pending.targets, square, (targets) =>
          commit({ type: 'power', side: HUMAN_SIDE, targets }),
        );
        return;
      }

      // No card in hand — this is ordinary piece movement.
      if (selected !== null && movesFrom(state, selected).includes(square)) {
        commit({ type: 'move', side: HUMAN_SIDE, from: selected, to: square });
        return;
      }

      const piece = state.board[square];
      if (piece && piece.owner === HUMAN_SIDE) {
        set({ selected: selected === square ? null : square, notice: null });
      } else {
        set({ selected: null });
      }
    },

    beginDrag: (handIndex) => {
      const state = playable();
      if (!state || state.phase !== 'battle') return false;

      const cardId = state.players[HUMAN_SIDE].hand[handIndex];
      if (!cardId) return false;
      const card = getCard(cardId);

      if (state.players[HUMAN_SIDE].aether < card.cost) {
        set({ notice: `${card.name} costs ${card.cost} aether.` });
        return false;
      }

      set({ pending: { kind: 'card', handIndex, targets: [] }, selected: null, notice: null });
      return true;
    },

    dropCard: (handIndex, square) => {
      const state = playable();
      if (!state || state.phase !== 'battle') return;

      if (square === null) {
        set({ pending: { kind: 'none' }, notice: null });
        return;
      }

      const cardId = state.players[HUMAN_SIDE].hand[handIndex];
      if (!cardId) return;
      const card = getCard(cardId);

      if (card.kind === 'piece') {
        if (deploySquares(state, HUMAN_SIDE).includes(square)) {
          commit({ type: 'deploy', side: HUMAN_SIDE, handIndex, to: square });
        } else {
          set({ pending: { kind: 'none' }, notice: 'Drop pieces on an empty square in your muster zone.' });
        }
        return;
      }

      // An effect that needs no target simply resolves where it lands.
      if (card.spec.slots.length === 0) {
        commit({ type: 'cast', side: HUMAN_SIDE, handIndex, targets: [] });
        return;
      }

      // Otherwise the drop supplies the first target; any remaining ones are
      // tapped, so a two-target card stays armed after the drag.
      if (!targetOptions(state, HUMAN_SIDE, card.spec, 0).includes(square)) {
        set({ pending: { kind: 'none' }, notice: 'That is not a legal target for that card.' });
        return;
      }
      if (card.spec.slots.length === 1) {
        commit({ type: 'cast', side: HUMAN_SIDE, handIndex, targets: [square] });
        return;
      }
      set({ pending: { kind: 'card', handIndex, targets: [square] }, notice: null });
    },

    cancel: () => set({ pending: { kind: 'none' }, selected: null, notice: null }),

    resign: () => {
      const state = get().state;
      if (!state || state.status !== 'active') return;
      const conceded: MatchState = { ...state, status: 'shadow_wins', phase: 'over' };
      set({ state: conceded, pending: { kind: 'none' }, selected: null });
      finish(conceded);
    },

    clear: () => {
      stopTimers();
      set({ state: null, selected: null, pending: { kind: 'none' }, thinking: false, notice: null });
    },
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
  if (!state || state.status !== 'active') return NO_HIGHLIGHTS;

  if (state.phase === 'placement') {
    if (state.players[HUMAN_SIDE].crownPlaced) return NO_HIGHLIGHTS;
    return { targets: crownPlacementSquares(state, HUMAN_SIDE), captures: [] };
  }

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
