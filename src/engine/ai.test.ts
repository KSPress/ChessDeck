import { describe, expect, it } from 'vitest';

import '@/content';
import { STARTER_DECKS } from '@/content';
import { chooseAction, playAiTurn, type Difficulty } from './ai';
import { applyAction, createMatch, legalActions } from './match';
import { TURN_LIMIT, type Deck, type MatchStatus, type PieceInstance } from './types';

const deckFor = (id: string): Deck => STARTER_DECKS.find((d) => d.id === id) as Deck;

/** Runs a full AI-vs-AI match and reports how it ended. */
function selfPlay(
  gold: Difficulty,
  shadow: Difficulty,
  seed: number,
  decks: [string, string] = ['starter_red', 'starter_blue'],
): { status: MatchStatus; turns: number } {
  let state = createMatch({
    goldDeck: deckFor(decks[0]),
    shadowDeck: deckFor(decks[1]),
    seed,
  });

  let guard = 0;
  while (state.status === 'active' && guard < TURN_LIMIT + 10) {
    state = playAiTurn(state, state.active === 'gold' ? gold : shadow);
    guard += 1;
  }
  return { status: state.status, turns: state.turn };
}

describe('ai', () => {
  it('always returns an action the rules accept', () => {
    let state = createMatch({
      goldDeck: deckFor('starter_yellow'),
      shadowDeck: deckFor('starter_purple'),
      seed: 42,
    });

    for (let i = 0; i < 60 && state.status === 'active'; i += 1) {
      const action = chooseAction(state, 'champion');
      expect(legalActions(state)).toContainEqual(action);
      state = applyAction(state, action);
    }
  });

  it('plays whole matches to a decisive end without stalling', () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const { status, turns } = selfPlay('knight', 'knight', seed);
      expect(status).not.toBe('active');
      expect(turns).toBeLessThanOrEqual(TURN_LIMIT + 2);
    }
  });

  it('handles every faction pairing without throwing', () => {
    const ids = STARTER_DECKS.map((d) => d.id);
    for (const gold of ids) {
      const shadow = ids[(ids.indexOf(gold) + 1) % ids.length] as string;
      const { status } = selfPlay('knight', 'squire', 17, [gold, shadow]);
      expect(status).not.toBe('active');
    }
  });

  it('takes a free crown capture when one is on offer', () => {
    const state = createMatch({
      goldDeck: deckFor('starter_yellow'),
      shadowDeck: deckFor('starter_blue'),
      seed: 5,
    });
    // Clear the board and hang the shadow crown right in front of a gold queen.
    for (let square = 0; square < state.board.length; square += 1) {
      const piece = state.board[square];
      if (piece && !piece.crownId) state.board[square] = null;
    }
    const shadowCrown = state.board.find((p) => p?.owner === 'shadow' && p?.crownId) as PieceInstance;
    const adjacent = shadowCrown.square - 6;
    state.board[adjacent] = {
      uid: 900,
      pieceId: 'yellow_queen',
      owner: 'gold',
      square: adjacent,
      traits: [],
      grantedRules: [],
      hasMoved: true,
      sick: false,
      rooted: 0,
      shielded: 0,
      submerged: 0,
    };

    const after = applyAction(state, chooseAction(state, 'champion'));
    expect(after.status).toBe('gold_wins');
  });

  it('wins more often as a champion than as a squire', () => {
    let championWins = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      // Champion plays gold; a win for gold is a win for the stronger profile.
      if (selfPlay('champion', 'squire', seed).status === 'gold_wins') championWins += 1;
    }
    expect(championWins).toBeGreaterThan(seeds.length / 2);
  });
});
