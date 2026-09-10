import { describe, expect, it } from 'vitest';

import '@/content';
import { STARTER_DECKS } from '@/content';
import { squareOf, throneSquare } from './board';
import { canAddCard, deckCost, validateDeck } from './deck';
import { applyAction, checkAction, createMatch, legalActions, materialOf, movesFrom } from './match';
import { findCrown, generateMovesForPiece, isArmored, pieceAt } from './movement';
import { getCard, getCrown, getFaction, getPiece } from './registry';
import {
  DECK_SIZE,
  HAND_SIZE,
  type Deck,
  type MatchState,
  type PieceInstance,
  type Side,
  type Square,
} from './types';

const deckFor = (id: string): Deck => {
  const found = STARTER_DECKS.find((d) => d.id === id);
  if (!found) throw new Error(`missing test deck ${id}`);
  return found;
};

/** Green on both sides is the quiet control group: its passive only pays aether. */
function newMatch(gold = 'starter_green', shadow = 'starter_green'): MatchState {
  return createMatch({ goldDeck: deckFor(gold), shadowDeck: deckFor(shadow), seed: 12345 });
}

/** Strips a board back to the two crowns so movement tests are unambiguous. */
function bareBoard(state: MatchState): MatchState {
  for (let square = 0; square < state.board.length; square += 1) {
    const piece = state.board[square];
    if (piece && !piece.crownId) state.board[square] = null;
  }
  return state;
}

/** Strips the board to a single crown, so its printed movement is unmasked. */
function soloCrown(state: MatchState, side: Side): PieceInstance {
  for (let square = 0; square < state.board.length; square += 1) {
    const piece = state.board[square];
    if (piece && !(piece.owner === side && piece.crownId)) state.board[square] = null;
  }
  return findCrown(state, side) as PieceInstance;
}

function place(state: MatchState, pieceId: string, owner: Side, square: Square): PieceInstance {
  const def = getPiece(pieceId);
  const piece: PieceInstance = {
    uid: state.nextUid++,
    pieceId,
    owner,
    square,
    traits: [...def.traits],
    grantedRules: [],
    hasMoved: false,
    sick: false,
    rooted: 0,
    shielded: 0,
    submerged: 0,
  };
  state.board[square] = piece;
  return piece;
}

const targetsOf = (state: MatchState, piece: PieceInstance): Square[] =>
  generateMovesForPiece(state, piece).map((m) => m.to).sort((a, b) => a - b);

describe('content registry', () => {
  it('registers every starter deck card, crown and faction', () => {
    for (const deck of STARTER_DECKS) {
      const crown = getCrown(deck.crownId);
      expect(() => getFaction(crown.factionId)).not.toThrow();
      for (const card of deck.cards) expect(() => getCard(card)).not.toThrow();
    }
  });

  it('gives every faction its own version of each archetype', () => {
    for (const faction of ['red', 'blue', 'green', 'yellow', 'purple']) {
      for (const archetype of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'signature']) {
        const piece = getPiece(`${faction}_${archetype}`);
        expect(piece.factionId).toBe(faction);
        expect(piece.archetype).toBe(archetype);
      }
    }
    // The names really are faction-specific, not a shared "Pawn".
    expect(getPiece('red_pawn').name).toBe('Orc Peon');
    expect(getPiece('blue_pawn').name).toBe('Dwarf Miner');
    expect(getPiece('purple_pawn').name).toBe('Risen Levy');
  });

  it('promotes each faction’s pawn into its own knight', () => {
    expect(getPiece('red_pawn').promotesTo).toBe('red_knight');
    expect(getPiece('green_pawn').promotesTo).toBe('green_knight');
  });

  it('throws a helpful error for unknown ids', () => {
    expect(() => getPiece('nonesuch')).toThrow(/Unknown piece/);
  });
});

describe('crown movement matches the printed cards', () => {
  it('Orc Chieftain moves the knight’s crooked charge', () => {
    const state = newMatch('starter_red');
    const crown = soloCrown(state, 'gold');
    // From c1 the knight's move reaches exactly these four squares on a 6x6.
    expect(targetsOf(state, crown)).toEqual(
      [squareOf(1, 2), squareOf(3, 2), squareOf(0, 1), squareOf(4, 1)].sort((a, b) => a - b),
    );
  });

  it('Dwarf Throne only shuffles one square left or right', () => {
    const state = newMatch('starter_blue');
    const crown = soloCrown(state, 'gold');
    expect(targetsOf(state, crown)).toEqual([squareOf(1, 0), squareOf(3, 0)].sort((a, b) => a - b));
  });

  it('Elf Queen rides the full queen’s lines', () => {
    const state = newMatch('starter_green');
    const crown = soloCrown(state, 'gold');
    const targets = targetsOf(state, crown);
    expect(targets).toContain(squareOf(2, 5));
    expect(targets).toContain(squareOf(5, 3));
    expect(targets).toContain(squareOf(0, 0));
    expect(targets.length).toBeGreaterThan(12);
  });

  it('Gnome Engineer takes a single step in any direction', () => {
    const state = newMatch('starter_yellow');
    const crown = soloCrown(state, 'gold');
    expect(targetsOf(state, crown)).toEqual(
      [squareOf(1, 0), squareOf(3, 0), squareOf(1, 1), squareOf(2, 1), squareOf(3, 1)].sort(
        (a, b) => a - b,
      ),
    );
  });
});

describe('deck validation', () => {
  it('accepts every starter deck', () => {
    for (const deck of STARTER_DECKS) {
      const result = validateDeck(deck);
      expect(result.errors).toEqual([]);
      expect(result.totalCost).toBeLessThanOrEqual(result.musterLimit);
    }
  });

  it('gives each faction a starter deck', () => {
    const factions = STARTER_DECKS.map((d) => validateDeck(d).factionId).sort();
    expect(factions).toEqual(['blue', 'green', 'purple', 'red', 'yellow']);
  });

  it('refuses a card from another colour', () => {
    const mixed: Deck = {
      id: 'mixed',
      name: 'Mixed',
      crownId: 'orc_chieftain',
      cards: [...deckFor('starter_red').cards.slice(0, 7), 'blue_rook'],
    };
    const result = validateDeck(mixed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /Stone Bastion is Dwarf, not Orc/.test(e))).toBe(true);
  });

  it('allows the same mixed deck once cross-faction play is switched on', () => {
    const mixed: Deck = {
      id: 'mixed',
      name: 'Mixed',
      crownId: 'orc_chieftain',
      cards: [...deckFor('starter_red').cards.slice(0, 7), 'blue_pawn'],
    };
    expect(validateDeck(mixed).valid).toBe(false);
    expect(validateDeck(mixed, { allowCrossFaction: true }).valid).toBe(true);
  });

  it('rejects a deck that is not exactly eight cards', () => {
    const short = { ...deckFor('starter_red'), cards: ['red_pawn', 'red_pawn'] };
    expect(validateDeck(short).valid).toBe(false);
  });

  it('makes an all-Warlord deck impossible on cost alone', () => {
    const greedy: Deck = {
      id: 'greedy',
      name: 'Greedy',
      crownId: 'orc_chieftain',
      cards: new Array(DECK_SIZE).fill('red_queen'),
    };
    const result = validateDeck(greedy);
    expect(result.valid).toBe(false);
    expect(result.totalCost).toBe(48);
    // Both guards fire: the copy limit and the muster budget.
    expect(result.errors.some((e) => /limit is 1/.test(e))).toBe(true);
    expect(result.errors.some((e) => /exceeds your limit/.test(e))).toBe(true);
  });

  it('enforces per-card copy limits', () => {
    const cards = [
      'red_pawn', 'red_pawn', 'red_pawn', 'red_pawn',
      'red_signature', 'red_signature', 'red_signature', 'red_knight',
    ];
    const result = validateDeck({ id: 'x', name: 'x', crownId: 'orc_chieftain', cards });
    expect(result.errors.some((e) => /Orc Peon/.test(e))).toBe(true);
  });

  it('gives the Dwarf Throne a bigger budget than the other Crowns', () => {
    expect(validateDeck(deckFor('starter_blue')).musterLimit).toBe(22);
    expect(validateDeck(deckFor('starter_green')).musterLimit).toBe(20);
  });

  it('blocks additions that break the budget, the copy limit or the colour', () => {
    expect(canAddCard(['red_queen'], 'orc_chieftain', 'red_queen').ok).toBe(false);
    expect(canAddCard(['red_pawn'], 'orc_chieftain', 'blue_pawn').ok).toBe(false);
    expect(canAddCard(['red_pawn'], 'orc_chieftain', 'red_knight').ok).toBe(true);
    expect(deckCost(['red_pawn', 'red_knight'])).toBe(4);
  });
});

describe('board setup', () => {
  it('opens with a crown shielded by three of that faction’s own pawns', () => {
    const state = createMatch({
      goldDeck: deckFor('starter_red'),
      shadowDeck: deckFor('starter_blue'),
      seed: 1,
    });
    expect(findCrown(state, 'gold')?.square).toBe(throneSquare('gold'));
    expect(state.board.filter((p) => p?.pieceId === 'red_pawn')).toHaveLength(3);
    expect(state.board.filter((p) => p?.pieceId === 'blue_pawn')).toHaveLength(3);
  });

  it('shields the Crown so an Elf Queen cannot snipe it down the open file', () => {
    // The thrones face each other on the c-file; the pawn shield is what stops
    // a full-reach Crown from ending the match on turn two.
    const state = createMatch({
      goldDeck: deckFor('starter_red'),
      shadowDeck: deckFor('starter_green'),
      seed: 4,
    });
    const goldCrown = findCrown(state, 'gold') as PieceInstance;
    const elfQueen = findCrown(state, 'shadow') as PieceInstance;
    expect(generateMovesForPiece(state, elfQueen).map((m) => m.to)).not.toContain(goldCrown.square);
  });

  it('deals both players an opening hand, widened by the Barrow King', () => {
    const state = createMatch({
      goldDeck: deckFor('starter_green'),
      shadowDeck: deckFor('starter_purple'),
      seed: 2,
    });
    expect(state.players.gold.hand).toHaveLength(HAND_SIZE);
    expect(state.players.gold.deck).toHaveLength(DECK_SIZE - HAND_SIZE);
    expect(state.players.shadow.hand).toHaveLength(6);
  });

  it('starts gold with one move action and one card action', () => {
    const state = newMatch();
    expect(state.active).toBe('gold');
    expect(state.movesLeft).toBe(1);
    expect(state.cardsLeft).toBe(1);
  });
});

describe('movement', () => {
  it('moves a pawn one square forward and captures diagonally', () => {
    const state = bareBoard(newMatch());
    const pawn = place(state, 'green_pawn', 'gold', squareOf(2, 2));
    place(state, 'green_signature', 'shadow', squareOf(3, 3));

    const moves = generateMovesForPiece(state, pawn);
    expect(moves.map((m) => m.to).sort((a, b) => a - b)).toEqual(
      [squareOf(2, 3), squareOf(3, 3)].sort((a, b) => a - b),
    );
    expect(moves.find((m) => m.to === squareOf(3, 3))?.capture).not.toBeNull();
  });

  it('sends shadow pawns down the board, not up', () => {
    const state = bareBoard(newMatch());
    const pawn = place(state, 'green_pawn', 'shadow', squareOf(2, 3));
    expect(targetsOf(state, pawn)).toEqual([squareOf(2, 2)]);
  });

  it('blocks a rook behind a friendly piece but lets it take an enemy', () => {
    const state = bareBoard(newMatch());
    const rook = place(state, 'green_rook', 'gold', squareOf(5, 3));
    place(state, 'green_pawn', 'gold', squareOf(5, 5));
    place(state, 'green_signature', 'shadow', squareOf(2, 3));

    const targets = targetsOf(state, rook);
    expect(targets).toContain(squareOf(5, 4));
    expect(targets).not.toContain(squareOf(5, 5));
    expect(targets).toContain(squareOf(4, 3));
    expect(targets).toContain(squareOf(2, 3));
    expect(targets).not.toContain(squareOf(1, 3));
  });

  it('lets the ethereal Lich drift straight through a blocker', () => {
    const state = bareBoard(newMatch());
    const lich = place(state, 'purple_queen', 'gold', squareOf(0, 0));
    place(state, 'purple_pawn', 'gold', squareOf(1, 1));

    const targets = targetsOf(state, lich);
    expect(targets).not.toContain(squareOf(1, 1));
    expect(targets).toContain(squareOf(2, 2));
    expect(targets).toContain(squareOf(3, 3));
  });

  it('leaps a knight over anything in the way', () => {
    const state = bareBoard(newMatch());
    const knight = place(state, 'green_knight', 'gold', squareOf(2, 2));
    for (const s of [squareOf(2, 3), squareOf(3, 2), squareOf(1, 2), squareOf(2, 1)]) {
      place(state, 'green_pawn', 'gold', s);
    }
    expect(targetsOf(state, knight)).toContain(squareOf(3, 4));
  });

  it('refuses to move a rooted piece', () => {
    const state = bareBoard(newMatch());
    const piece = place(state, 'green_signature', 'gold', squareOf(2, 2));
    piece.rooted = 1;
    expect(generateMovesForPiece(state, piece)).toEqual([]);
  });
});

describe('traits', () => {
  it('stops a pawn from capturing an armored piece', () => {
    const state = bareBoard(newMatch());
    const pawn = place(state, 'green_pawn', 'gold', squareOf(2, 2));
    place(state, 'green_rook', 'shadow', squareOf(3, 3)); // Elder Oak is armored
    expect(targetsOf(state, pawn)).not.toContain(squareOf(3, 3));
  });

  it('still lets a heavier piece break through armour', () => {
    const state = bareBoard(newMatch());
    const bishop = place(state, 'green_bishop', 'gold', squareOf(2, 2));
    place(state, 'green_rook', 'shadow', squareOf(3, 3));
    expect(targetsOf(state, bishop)).toContain(squareOf(3, 3));
  });

  it('protects a shielded piece from everything', () => {
    const state = bareBoard(newMatch());
    const queen = place(state, 'yellow_queen', 'gold', squareOf(2, 2));
    const target = place(state, 'green_signature', 'shadow', squareOf(2, 4));
    target.shielded = 1;
    expect(targetsOf(state, queen)).not.toContain(squareOf(2, 4));
  });

  it('drags the attacker down when a vengeful piece is taken', () => {
    const state = bareBoard(newMatch());
    place(state, 'green_bishop', 'gold', squareOf(2, 2));
    place(state, 'purple_signature', 'shadow', squareOf(4, 4)); // Grave Wight is vengeful

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: squareOf(4, 4) });
    expect(pieceAt(after, squareOf(4, 4))).toBeNull();
    expect(pieceAt(after, squareOf(2, 2))).toBeNull();
  });
});

describe('bunkered pieces', () => {
  it('cannot be captured, cannot move, and no longer block a line', () => {
    const state = bareBoard(newMatch());
    const rook = place(state, 'green_rook', 'gold', squareOf(0, 3));
    const digger = place(state, 'green_pawn', 'shadow', squareOf(2, 3));
    place(state, 'green_signature', 'shadow', squareOf(4, 3));
    digger.submerged = 2;

    const targets = targetsOf(state, rook);
    // The rook rides straight over the bunker to reach the piece beyond it...
    expect(targets).toContain(squareOf(1, 3));
    expect(targets).toContain(squareOf(3, 3));
    expect(targets).toContain(squareOf(4, 3));
    // ...but cannot stop on the bunkered square itself.
    expect(targets).not.toContain(squareOf(2, 3));
    expect(generateMovesForPiece(state, digger)).toEqual([]);
  });
});

describe('promotion', () => {
  it('turns a pawn reaching the far rank into its faction’s knight', () => {
    const state = bareBoard(newMatch());
    place(state, 'green_pawn', 'gold', squareOf(0, 4));
    const after = applyAction(state, { type: 'move', from: squareOf(0, 4), to: squareOf(0, 5) });
    expect(pieceAt(after, squareOf(0, 5))?.pieceId).toBe('green_knight');
  });

  it('keeps traits granted mid-match through the promotion', () => {
    const state = bareBoard(newMatch());
    place(state, 'green_pawn', 'gold', squareOf(0, 4)).traits.push('armored');
    const after = applyAction(state, { type: 'move', from: squareOf(0, 4), to: squareOf(0, 5) });
    expect(pieceAt(after, squareOf(0, 5))?.traits).toContain('armored');
  });
});

describe('action economy', () => {
  it('allows one move and one card action, then passes the turn', () => {
    let state = newMatch();
    const handIndex = state.players.gold.hand.findIndex((id) => getCard(id).kind === 'piece');
    expect(handIndex).toBeGreaterThanOrEqual(0);

    const deployTo = squareOf(0, 1);
    state = applyAction(state, { type: 'deploy', handIndex, to: deployTo });
    expect(state.active).toBe('gold');
    expect(state.cardsLeft).toBe(0);
    expect(checkAction(state, { type: 'deploy', handIndex: 0, to: squareOf(0, 0) }).ok).toBe(false);

    // Move one of the pawns that started the match, not the fresh arrival.
    const pawnSquare = squareOf(1, 1);
    const destination = movesFrom(state, pawnSquare)[0] as Square;
    expect(destination).toBeDefined();
    state = applyAction(state, { type: 'move', from: pawnSquare, to: destination });
    expect(state.active).toBe('shadow');
  });

  it('will not let a freshly mustered piece act on the turn it arrives', () => {
    let state = newMatch();
    const handIndex = state.players.gold.hand.findIndex((id) => getCard(id).kind === 'piece');
    const deployTo = squareOf(0, 1);

    state = applyAction(state, { type: 'deploy', handIndex, to: deployTo });
    expect(pieceAt(state, deployTo)?.sick).toBe(true);
    expect(movesFrom(state, deployTo)).toEqual([]);

    // It shakes off the sickness in time for its owner's next turn.
    state = applyAction(state, { type: 'endTurn' });
    state = applyAction(state, { type: 'endTurn' });
    expect(state.active).toBe('gold');
    expect(pieceAt(state, deployTo)?.sick).toBe(false);
    expect(movesFrom(state, deployTo).length).toBeGreaterThan(0);
  });

  it('refills the hand by cycling the played card to the back of the deck', () => {
    const state = newMatch();
    const handIndex = state.players.gold.hand.findIndex((id) => getCard(id).kind === 'piece');
    const played = state.players.gold.hand[handIndex] as string;

    const after = applyAction(state, { type: 'deploy', handIndex, to: squareOf(0, 1) });
    expect(after.players.gold.hand).toHaveLength(HAND_SIZE);
    expect(after.players.gold.deck).toContain(played);
    expect(after.players.gold.deck.length + after.players.gold.hand.length).toBe(DECK_SIZE);
  });

  it('charges aether to deploy and grants income at the start of a turn', () => {
    const state = newMatch();
    const before = state.players.gold.aether;
    const handIndex = state.players.gold.hand.findIndex((id) => getCard(id).kind === 'piece');
    const cost = getCard(state.players.gold.hand[handIndex] as string).cost;

    let after = applyAction(state, { type: 'deploy', handIndex, to: squareOf(0, 1) });
    expect(after.players.gold.aether).toBe(before - cost);

    after = applyAction(after, { type: 'endTurn' });
    after = applyAction(after, { type: 'endTurn' });
    expect(after.active).toBe('gold');
    expect(after.players.gold.aether).toBe(before - cost + 2);
  });

  it('rejects deploying outside the muster zone', () => {
    const state = newMatch();
    const handIndex = state.players.gold.hand.findIndex((id) => getCard(id).kind === 'piece');
    expect(checkAction(state, { type: 'deploy', handIndex, to: squareOf(0, 3) }).ok).toBe(false);
    expect(checkAction(state, { type: 'deploy', handIndex, to: squareOf(0, 1) }).ok).toBe(true);
  });
});

describe('crown safety', () => {
  it('will not let a Crown step onto a square the enemy threatens', () => {
    const state = bareBoard(newMatch('starter_yellow', 'starter_green'));
    const crown = findCrown(state, 'gold') as PieceInstance;
    // A rook on the d-file covers d2, which is one of the Crown's king steps.
    place(state, 'green_rook', 'shadow', squareOf(3, 4));

    const targets = targetsOf(state, crown);
    expect(targets).not.toContain(squareOf(3, 1));
    expect(targets).toContain(squareOf(1, 1));
  });

  it('still allows a Crown to capture an undefended attacker', () => {
    const state = bareBoard(newMatch('starter_yellow', 'starter_green'));
    const crown = findCrown(state, 'gold') as PieceInstance;
    place(state, 'green_pawn', 'shadow', squareOf(1, 1));
    expect(targetsOf(state, crown)).toContain(squareOf(1, 1));
  });
});

describe('win conditions', () => {
  it('ends the match the moment a crown is captured', () => {
    const state = bareBoard(newMatch());
    const shadowCrown = findCrown(state, 'shadow') as PieceInstance;
    place(state, 'yellow_queen', 'gold', squareOf(2, 2));

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: shadowCrown.square });
    expect(after.status).toBe('gold_wins');
    expect(legalActions(after)).toEqual([]);
  });

  it('never lets Lightning Strike reach a crown', () => {
    const state = bareBoard(newMatch('starter_yellow'));
    const shadowCrown = findCrown(state, 'shadow') as PieceInstance;
    state.players.gold.hand = ['yellow_lightning'];
    state.players.gold.aether = 10;
    expect(checkAction(state, { type: 'cast', handIndex: 0, targets: [shadowCrown.square] }).ok).toBe(false);
  });
});

describe('faction passives', () => {
  it('Bloodlust lets the first red capture each turn swing again', () => {
    const state = bareBoard(newMatch('starter_red'));
    place(state, 'red_signature', 'gold', squareOf(2, 2));
    place(state, 'green_pawn', 'shadow', squareOf(3, 3));

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: squareOf(3, 3) });
    // The capture spent a move but Bloodlust handed one straight back.
    expect(after.active).toBe('gold');
    expect(after.movesLeft).toBe(1);
  });

  it('Bloodlust hands the extra move to the striker, not to the whole army', () => {
    const state = bareBoard(newMatch('starter_red'));
    place(state, 'red_signature', 'gold', squareOf(2, 2));
    place(state, 'red_signature', 'gold', squareOf(5, 1));
    place(state, 'green_pawn', 'shadow', squareOf(3, 3));

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: squareOf(3, 3) });
    expect(after.movesLeft).toBe(1);
    expect(after.mustMoveUid).toBe(pieceAt(after, squareOf(3, 3))?.uid);
    // The other Raider cannot borrow the swing that the striker earned.
    expect(checkAction(after, { type: 'move', from: squareOf(5, 1), to: squareOf(4, 2) }).ok).toBe(false);
    expect(movesFrom(after, squareOf(5, 1))).toEqual([]);
    expect(movesFrom(after, squareOf(3, 3)).length).toBeGreaterThan(0);
  });

  it('Explosive Capture spares the gnome’s own ranks', () => {
    const state = bareBoard(newMatch('starter_yellow'));
    place(state, 'yellow_rook', 'gold', squareOf(0, 3));
    place(state, 'green_pawn', 'shadow', squareOf(3, 3));
    place(state, 'green_pawn', 'shadow', squareOf(2, 2));
    place(state, 'yellow_pawn', 'gold', squareOf(4, 4)); // friendly, on a diagonal

    const after = applyAction(state, { type: 'move', from: squareOf(0, 3), to: squareOf(3, 3) });
    expect(pieceAt(after, squareOf(2, 2))).toBeNull();
    expect(pieceAt(after, squareOf(4, 4))).not.toBeNull();
  });

  it('Shieldwall armors a blue piece only while it stands beside a friend', () => {
    const state = bareBoard(newMatch('starter_green', 'starter_blue'));
    const lone = place(state, 'blue_pawn', 'shadow', squareOf(5, 5));
    expect(isArmored(state, lone)).toBe(false);

    place(state, 'blue_pawn', 'shadow', squareOf(4, 5));
    expect(isArmored(state, lone)).toBe(true);

    // And that armour really does turn away a cost-1 attacker.
    const pawn = place(state, 'green_pawn', 'gold', squareOf(4, 4));
    expect(targetsOf(state, pawn)).not.toContain(squareOf(5, 5));
  });

  it('Regrowth pays green two aether for every piece it loses', () => {
    const state = bareBoard(newMatch('starter_yellow', 'starter_green'));
    place(state, 'yellow_bishop', 'gold', squareOf(2, 2));
    place(state, 'green_pawn', 'shadow', squareOf(4, 4));
    const before = state.players.shadow.aether;

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: squareOf(4, 4) });
    expect(after.players.shadow.aether).toBe(before + 2);
    expect(after.players.shadow.graveyard).toContain('green_pawn');
  });

  it('Explosive Capture cracks the diagonals around a yellow capture', () => {
    const state = bareBoard(newMatch('starter_yellow'));
    place(state, 'yellow_rook', 'gold', squareOf(0, 3));
    place(state, 'green_pawn', 'shadow', squareOf(3, 3));
    place(state, 'green_pawn', 'shadow', squareOf(2, 2)); // diagonal to the target
    place(state, 'green_pawn', 'shadow', squareOf(3, 4)); // orthogonal, should survive

    const after = applyAction(state, { type: 'move', from: squareOf(0, 3), to: squareOf(3, 3) });
    expect(pieceAt(after, squareOf(2, 2))).toBeNull();
    expect(pieceAt(after, squareOf(3, 4))).not.toBeNull();
  });

  it('Undying puts the first purple levy lost each turn straight back', () => {
    const state = bareBoard(newMatch('starter_green', 'starter_purple'));
    place(state, 'green_bishop', 'gold', squareOf(2, 2));
    place(state, 'purple_pawn', 'shadow', squareOf(4, 4));

    const after = applyAction(state, { type: 'move', from: squareOf(2, 2), to: squareOf(4, 4) });
    const levies = after.board.filter((p) => p?.pieceId === 'purple_pawn' && p?.owner === 'shadow');
    expect(levies).toHaveLength(1);
    expect(levies[0]?.square).toBeGreaterThanOrEqual(squareOf(0, 4));
  });
});

describe('faction action cards', () => {
  it('Double Strike pays its extra move only when the strike actually lands', () => {
    let state = bareBoard(newMatch('starter_red'));
    place(state, 'red_signature', 'gold', squareOf(0, 1));
    place(state, 'green_pawn', 'shadow', squareOf(2, 3));
    state.players.gold.hand = ['red_double_strike'];
    state.players.gold.aether = 5;

    state = applyAction(state, { type: 'cast', handIndex: 0, targets: [] });
    // Nothing is granted up front — the move count is untouched.
    expect(state.movesLeft).toBe(1);
    expect(state.players.gold.pendingStrikes).toBe(1);

    state = applyAction(state, { type: 'move', from: squareOf(0, 1), to: squareOf(2, 3) });
    expect(state.active).toBe('gold');
    expect(state.players.gold.pendingStrikes).toBe(0);
    // The capture spent one move and paid back two: the strike it was bought
    // for, plus red's own Bloodlust. Stacking them is the point of the faction.
    expect(state.movesLeft).toBe(2);
  });

  it('Double Strike gives nothing away on a quiet move', () => {
    let state = bareBoard(newMatch('starter_red'));
    place(state, 'red_signature', 'gold', squareOf(0, 1));
    state.players.gold.hand = ['red_double_strike'];
    state.players.gold.aether = 5;

    state = applyAction(state, { type: 'cast', handIndex: 0, targets: [] });
    state = applyAction(state, { type: 'move', from: squareOf(0, 1), to: squareOf(1, 2) });
    // A quiet move ends the turn: no capture, no second swing.
    expect(state.active).toBe('shadow');
  });

  it('Bunker digs a piece in for two turns', () => {
    const state = bareBoard(newMatch('starter_blue'));
    place(state, 'blue_knight', 'gold', squareOf(2, 2));
    state.players.gold.hand = ['blue_bunker'];
    state.players.gold.aether = 5;

    const after = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(2, 2)] });
    expect(pieceAt(after, squareOf(2, 2))?.submerged).toBe(2);
  });

  it('Shield Wall protects an entire rank', () => {
    const state = bareBoard(newMatch('starter_blue'));
    place(state, 'blue_pawn', 'gold', squareOf(1, 2));
    place(state, 'blue_pawn', 'gold', squareOf(4, 2));
    place(state, 'blue_pawn', 'gold', squareOf(4, 1));
    state.players.gold.hand = ['blue_shield_wall'];
    state.players.gold.aether = 5;

    const after = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(1, 2)] });
    expect(pieceAt(after, squareOf(4, 2))?.shielded).toBe(1);
    expect(pieceAt(after, squareOf(4, 1))?.shielded).toBe(0);
  });

  it('Restore is unplayable on an empty graveyard and returns the dead once filled', () => {
    const state = bareBoard(newMatch('starter_green'));
    state.players.gold.hand = ['green_restore'];
    state.players.gold.aether = 5;
    expect(checkAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(0, 0)] }).ok).toBe(false);

    state.players.gold.graveyard.push('green_rook');
    const after = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(0, 0)] });
    expect(pieceAt(after, squareOf(0, 0))?.pieceId).toBe('green_rook');
    expect(after.players.gold.graveyard).toHaveLength(0);
  });

  it('Roots holds an enemy piece still for two of its turns', () => {
    let state = bareBoard(newMatch('starter_green'));
    place(state, 'green_pawn', 'shadow', squareOf(2, 4));
    state.players.gold.hand = ['green_roots'];
    state.players.gold.aether = 5;

    state = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(2, 4)] });
    state = applyAction(state, { type: 'endTurn' });
    expect(checkAction(state, { type: 'move', from: squareOf(2, 4), to: squareOf(2, 3) }).ok).toBe(false);
  });

  it('Detonate takes the target and its neighbours but spares crowns', () => {
    const state = bareBoard(newMatch('starter_yellow'));
    const shadowCrown = findCrown(state, 'shadow') as PieceInstance;
    place(state, 'green_pawn', 'shadow', squareOf(2, 3));
    place(state, 'green_pawn', 'shadow', squareOf(3, 3));
    place(state, 'green_pawn', 'shadow', squareOf(2, 4));
    state.players.gold.hand = ['yellow_detonate'];
    state.players.gold.aether = 8;

    const after = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(2, 3)] });
    expect(pieceAt(after, squareOf(2, 3))).toBeNull();
    expect(pieceAt(after, squareOf(3, 3))).toBeNull();
    expect(pieceAt(after, squareOf(2, 4))).toBeNull();
    expect(after.status).toBe('active');
    expect(pieceAt(after, shadowCrown.square)).not.toBeNull();
  });

  it('Grave Leap teaches a levy the knight’s move', () => {
    const state = bareBoard(newMatch('starter_purple'));
    const levy = place(state, 'purple_pawn', 'gold', squareOf(2, 2));
    state.players.gold.hand = ['purple_grave_leap'];
    state.players.gold.aether = 5;

    expect(targetsOf(state, levy)).not.toContain(squareOf(3, 4));
    const after = applyAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(2, 2)] });
    const taught = pieceAt(after, squareOf(2, 2)) as PieceInstance;
    expect(targetsOf(after, taught)).toContain(squareOf(3, 4));
  });

  it('Raise the Levy musters two pawns on two different squares', () => {
    const state = bareBoard(newMatch('starter_purple'));
    state.players.gold.hand = ['purple_raise'];
    state.players.gold.aether = 5;

    const after = applyAction(state, {
      type: 'cast',
      handIndex: 0,
      targets: [squareOf(0, 0), squareOf(5, 0)],
    });
    expect(pieceAt(after, squareOf(0, 0))?.pieceId).toBe('purple_pawn');
    expect(pieceAt(after, squareOf(5, 0))?.pieceId).toBe('purple_pawn');
    // The same square twice is not a legal pair of targets.
    expect(
      checkAction(state, { type: 'cast', handIndex: 0, targets: [squareOf(0, 0), squareOf(0, 0)] }).ok,
    ).toBe(false);
  });
});

describe('crown powers', () => {
  it('Evolve promotes a levy where it stands, no far rank required', () => {
    const state = bareBoard(newMatch('starter_purple'));
    place(state, 'purple_pawn', 'gold', squareOf(2, 2));
    state.players.gold.aether = 10;

    const after = applyAction(state, { type: 'power', targets: [squareOf(2, 2)] });
    expect(pieceAt(after, squareOf(2, 2))?.pieceId).toBe('purple_knight');
  });

  it('puts the power on cooldown and refuses a second use', () => {
    const state = bareBoard(newMatch('starter_blue'));
    place(state, 'blue_knight', 'gold', squareOf(2, 2));
    state.players.gold.aether = 10;

    const after = applyAction(state, { type: 'power', targets: [squareOf(2, 2)] });
    expect(after.players.gold.powerCooldown).toBe(getCrown('dwarf_throne').powerCooldown);
    expect(checkAction(after, { type: 'power', targets: [squareOf(2, 2)] }).ok).toBe(false);
  });
});

describe('legal action enumeration', () => {
  it('always offers a way to end the turn while the match is live', () => {
    expect(legalActions(newMatch()).some((a) => a.type === 'endTurn')).toBe(true);
  });

  it('never proposes an action that checkAction would reject', () => {
    for (const [gold, shadow] of [
      ['starter_red', 'starter_blue'],
      ['starter_green', 'starter_yellow'],
      ['starter_purple', 'starter_red'],
    ]) {
      let state = newMatch(gold, shadow);
      for (let i = 0; i < 40 && state.status === 'active'; i += 1) {
        const actions = legalActions(state);
        for (const action of actions) expect(checkAction(state, action).ok).toBe(true);
        state = applyAction(state, actions[i % actions.length] as never);
      }
    }
  });
});

describe('material scoring', () => {
  it('counts pieces but not crowns', () => {
    const state = newMatch();
    expect(materialOf(state, 'gold')).toBe(3 * getPiece('green_pawn').value);
  });
});
