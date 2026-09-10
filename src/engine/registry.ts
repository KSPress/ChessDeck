import type { Card, CardId, CrownDef, CrownId, FactionDef, FactionId, PieceDef, PieceId } from './types';

/**
 * Static content lookup.
 *
 * Content lives in src/content and registers itself here on import, which keeps
 * the engine data-driven without threading a registry argument through every
 * function. Lookups throw rather than returning undefined so that a missing
 * registration fails loudly at the call site instead of corrupting match state.
 */
const pieces = new Map<PieceId, PieceDef>();
const cards = new Map<CardId, Card>();
const crowns = new Map<CrownId, CrownDef>();
const factions = new Map<FactionId, FactionDef>();

export function registerPieces(defs: PieceDef[]): void {
  for (const def of defs) pieces.set(def.id, def);
}

export function registerCards(defs: Card[]): void {
  for (const def of defs) cards.set(def.id, def);
}

export function registerCrowns(defs: CrownDef[]): void {
  for (const def of defs) crowns.set(def.id, def);
}

export function registerFactions(defs: FactionDef[]): void {
  for (const def of defs) factions.set(def.id, def);
}

function need<T>(map: Map<string, T>, id: string, what: string): T {
  const found = map.get(id);
  if (!found) {
    throw new Error(
      `Unknown ${what} "${id}". Did you forget to import "@/content" before using the engine?`,
    );
  }
  return found;
}

export const getPiece = (id: PieceId): PieceDef => need(pieces, id, 'piece');
export const getCard = (id: CardId): Card => need(cards, id, 'card');
export const getCrown = (id: CrownId): CrownDef => need(crowns, id, 'crown');
export const getFaction = (id: FactionId): FactionDef => need(factions, id, 'faction');

/** The faction a crown belongs to — a deck's colour follows its leader. */
export const factionOfCrown = (id: CrownId): FactionDef => getFaction(getCrown(id).factionId);

export const allPieces = (): PieceDef[] => [...pieces.values()];
export const allCards = (): Card[] => [...cards.values()];
export const allCrowns = (): CrownDef[] => [...crowns.values()];
export const allFactions = (): FactionDef[] => [...factions.values()];

/** Test helper: wipes every registration. */
export function resetRegistry(): void {
  pieces.clear();
  cards.clear();
  crowns.clear();
  factions.clear();
}
