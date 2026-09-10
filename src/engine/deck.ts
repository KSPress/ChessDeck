import { getCard, getCrown, getFaction } from './registry';
import {
  DECK_SIZE,
  DEFAULT_MUSTER_LIMIT,
  type CardId,
  type CrownId,
  type Deck,
  type FactionId,
} from './types';

export interface DeckRules {
  /**
   * Off by default: a deck may only carry cards of its leader's colour.
   * The planned Rainbow game mode turns this on to allow cross-faction decks.
   */
  allowCrossFaction?: boolean;
}

export interface DeckValidation {
  valid: boolean;
  errors: string[];
  /** Sum of the cost of every card in the deck. */
  totalCost: number;
  /** The budget this deck must fit inside, after crown modifiers. */
  musterLimit: number;
  /** The colour this deck must (normally) be built from. */
  factionId: FactionId;
}

/** A deck's colour follows its leader — you pick the Crown, you pick the faction. */
export function factionOfDeck(crownId: CrownId): FactionId {
  return getCrown(crownId).factionId;
}

/** A crown may raise (or lower) the deck budget as its identity perk. */
export function musterLimitFor(crownId: CrownId): number {
  return getCrown(crownId).modifiers.musterLimit ?? DEFAULT_MUSTER_LIMIT;
}

export function deckCost(cards: readonly CardId[]): number {
  return cards.reduce((sum, id) => sum + getCard(id).cost, 0);
}

/**
 * The whole balance of deck construction lives here: exactly DECK_SIZE cards,
 * all of your leader's colour, within that crown's muster budget, respecting
 * per-card copy limits. The budget is what makes "eight Warlords" impossible
 * rather than merely unwise.
 */
export function validateDeck(deck: Deck, rules: DeckRules = {}): DeckValidation {
  const errors: string[] = [];
  const musterLimit = musterLimitFor(deck.crownId);
  const factionId = factionOfDeck(deck.crownId);

  if (deck.cards.length !== DECK_SIZE) {
    errors.push(`A deck must hold exactly ${DECK_SIZE} cards (this one has ${deck.cards.length}).`);
  }

  if (!rules.allowCrossFaction) {
    const strays = [...new Set(deck.cards.filter((id) => getCard(id).factionId !== factionId))];
    for (const id of strays) {
      const card = getCard(id);
      errors.push(`${card.name} is ${getFaction(card.factionId).people}, not ${getFaction(factionId).people}.`);
    }
  }

  const counts = new Map<CardId, number>();
  for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const [id, count] of counts) {
    const card = getCard(id);
    if (count > card.maxCopies) {
      errors.push(`${card.name}: ${count} copies, limit is ${card.maxCopies}.`);
    }
  }

  const totalCost = deckCost(deck.cards);
  if (totalCost > musterLimit) {
    errors.push(`Muster ${totalCost} exceeds your limit of ${musterLimit}.`);
  }

  return { valid: errors.length === 0, errors, totalCost, musterLimit, factionId };
}

/** Whether one more copy of `cardId` could be added to a partial deck. */
export function canAddCard(
  cards: readonly CardId[],
  crownId: CrownId,
  cardId: CardId,
  rules: DeckRules = {},
): { ok: boolean; reason?: string } {
  const card = getCard(cardId);
  if (cards.length >= DECK_SIZE) return { ok: false, reason: `Deck is already ${DECK_SIZE} cards.` };

  if (!rules.allowCrossFaction && card.factionId !== factionOfDeck(crownId)) {
    return { ok: false, reason: 'Wrong faction for this Crown.' };
  }

  const copies = cards.filter((id) => id === cardId).length;
  if (copies >= card.maxCopies) {
    return { ok: false, reason: `Limit ${card.maxCopies} cop${card.maxCopies === 1 ? 'y' : 'ies'}.` };
  }

  const limit = musterLimitFor(crownId);
  if (deckCost(cards) + card.cost > limit) {
    return { ok: false, reason: `Would exceed muster limit of ${limit}.` };
  }

  return { ok: true };
}
