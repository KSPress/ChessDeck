/**
 * Importing this module registers all static game content with the engine.
 * Anything that touches the engine should import from here (not from
 * @/engine directly) so the registry is guaranteed to be populated.
 */
import { registerCards, registerCrowns, registerFactions, registerPieces } from '@/engine/registry';
import { CARDS } from './cards';
import { CROWNS, CROWN_PIECES } from './crowns';
import { FACTIONS } from './factions';
import { PIECES } from './pieces';

registerFactions(FACTIONS);
registerPieces([...PIECES, ...CROWN_PIECES]);
registerCards(CARDS);
registerCrowns(CROWNS);

export { FACTIONS, factionById } from './factions';
export { PIECES, piecesOfFaction, pieceIdFor } from './pieces';
export { CROWNS, CROWN_PIECES, crownPieceId, crownById } from './crowns';
export { CARDS, PIECE_CARDS, EFFECT_CARDS, cardsOfFaction, cardById } from './cards';
export { STARTER_DECKS } from './decks';
export * from './cosmetics';
