import { getCard, getCrown, getFaction } from './registry';
import { DECK_SIZE, HAND_SIZE, type CardId, type CrownId, type Deck, type FactionId } from './types';

export interface DeckRules {
  /**
   * Off by default: a deck may only carry cards of its leader's colour.
   * Rainbow mode turns this on to allow cross-faction decks.
   */
  allowCrossFaction?: boolean;
}

export interface DeckValidation {
  valid: boolean;
  errors: string[];
  /** Sum of the cost of every card, shown as a curve rather than a budget. */
  totalCost: number;
  /** Average deploy cost — the number that actually matters for pacing. */
  averageCost: number;
  /** The colour this deck must (normally) be built from. */
  factionId: FactionId;
}

/** A deck's colour follows its leader — you pick the Crown, you pick the faction. */
export function factionOfDeck(crownId: CrownId): FactionId {
  return getCrown(crownId).factionId;
}

export function deckCost(cards: readonly CardId[]): number {
  return cards.reduce((sum, id) => sum + getCard(id).cost, 0);
}

/**
 * Deck legality.
 *
 * There is deliberately no point budget: with a continuously regenerating
 * resource, an expensive deck already pays for itself in slower deployment, so
 * a hard cap would be taxing the same cost twice. What remains is the colour
 * rule, the copy limits, and enough cards to keep a hand full.
 */
export function validateDeck(deck: Deck, rules: DeckRules = {}): DeckValidation {
  const errors: string[] = [];
  const factionId = factionOfDeck(deck.crownId);

  if (deck.cards.length > DECK_SIZE) {
    errors.push(`A deck holds at most ${DECK_SIZE} cards (this one has ${deck.cards.length}).`);
  }
  if (deck.cards.length < HAND_SIZE) {
    errors.push(`A deck needs at least ${HAND_SIZE} cards to fill a hand.`);
  }

  if (!rules.allowCrossFaction) {
    const strays = [...new Set(deck.cards.filter((id) => getCard(id).factionId !== factionId))];
    for (const id of strays) {
      const card = getCard(id);
      errors.push(
        `${card.name} is ${getFaction(card.factionId).people}, not ${getFaction(factionId).people}.`,
      );
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
  return {
    valid: errors.length === 0,
    errors,
    totalCost,
    averageCost: deck.cards.length ? totalCost / deck.cards.length : 0,
    factionId,
  };
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
  return { ok: true };
}
