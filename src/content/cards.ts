import { DIAGONAL, KNIGHT_OFFSETS } from '@/engine/board';
import type { Card, EffectCard, EffectSpec, FactionId, PieceCard, Rarity } from '@/engine/types';
import { PIECES, pieceIdFor } from './pieces';

/** Cheap pieces can stack; bombs are strictly one-of. */
function copiesAllowed(cost: number): number {
  if (cost <= 2) return 3;
  if (cost <= 4) return 2;
  return 1;
}

function rarityFor(cost: number): Rarity {
  if (cost <= 2) return 'common';
  if (cost === 3) return 'rare';
  if (cost === 4) return 'epic';
  return 'legendary';
}

const RARITY_LETTER: Record<Rarity, string> = {
  common: 'C',
  rare: 'R',
  epic: 'E',
  legendary: 'L',
};

/** Every piece in every roster is playable as a card of the same cost. */
export const PIECE_CARDS: PieceCard[] = PIECES.map((piece) => ({
  id: piece.id,
  kind: 'piece',
  name: piece.name,
  factionId: piece.factionId,
  archetype: piece.archetype,
  glyph: piece.glyph,
  cost: piece.cost,
  rarity: rarityFor(piece.cost),
  maxCopies: copiesAllowed(piece.cost),
  pieceId: piece.id,
  code: '',
  blurb: piece.blurb,
}));

interface ActionEntry {
  id: string;
  name: string;
  glyph: string;
  cost: number;
  spec: EffectSpec;
  blurb: string;
}

/**
 * Faction action cards. These compete with pieces for the same eight deck slots
 * and the same muster budget, so each one has to beat simply playing a body.
 */
const ACTIONS: Record<FactionId, ActionEntry[]> = {
  red: [
    {
      id: 'red_double_strike',
      name: 'Double Strike',
      glyph: '⇉',
      cost: 2,
      spec: { effect: { kind: 'strike_on_capture', count: 1 }, slots: [] },
      blurb: 'Move a piece, capture with it, then move again. No capture, no second swing.',
    },
    {
      id: 'red_whirlwind',
      name: 'Whirlwind',
      glyph: '✳',
      cost: 3,
      spec: { effect: { kind: 'detonate', radius: 'adjacent' }, slots: ['friendly_non_crown'] },
      blurb: 'Sacrifice one of your own pieces to destroy everything around it. Crowns are spared.',
    },
    {
      id: 'red_rage',
      name: 'Rage of the Rook',
      glyph: '✷',
      cost: 2,
      spec: {
        effect: { kind: 'grant_rule', rule: { kind: 'slide', dirs: DIAGONAL, range: 1 } },
        slots: ['friendly_non_crown'],
      },
      blurb: 'A friendly piece gains a one-square diagonal step for the rest of the match.',
    },
  ],
  blue: [
    {
      id: 'blue_shield_wall',
      name: 'Shield Wall',
      glyph: '⛨',
      cost: 3,
      spec: { effect: { kind: 'shield_rank', turns: 1 }, slots: ['friendly_piece'] },
      blurb: 'Every friendly piece on that piece’s rank cannot be captured next turn.',
    },
    {
      id: 'blue_stoneform',
      name: 'Stoneform',
      glyph: '⬢',
      cost: 2,
      spec: { effect: { kind: 'shield_friendly', turns: 1 }, slots: ['friendly_piece'] },
      blurb: 'Turn a piece to stone for a turn. It cannot be taken.',
    },
    {
      id: 'blue_bunker',
      name: 'Bunker',
      glyph: '⊟',
      cost: 2,
      spec: { effect: { kind: 'submerge', turns: 2 }, slots: ['friendly_non_crown'] },
      blurb: 'The piece digs in: untouchable and immobile, and no longer blocks a line of sight.',
    },
  ],
  green: [
    {
      id: 'green_restore',
      name: 'Restore',
      glyph: '❈',
      cost: 2,
      spec: { effect: { kind: 'restore_grave' }, slots: ['empty_muster'] },
      blurb: 'Return your longest-dead piece to an empty muster square, free of charge.',
    },
    {
      id: 'green_roots',
      name: 'Roots',
      glyph: '❉',
      cost: 2,
      spec: { effect: { kind: 'root_enemy', turns: 2 }, slots: ['enemy_piece'] },
      blurb: 'Lock an enemy piece down. It cannot move for two of its turns.',
    },
    {
      id: 'green_wildgrowth',
      name: 'Wildgrowth',
      glyph: '❋',
      cost: 2,
      spec: { effect: { kind: 'grant_trait', trait: 'armored' }, slots: ['friendly_piece'] },
      blurb: 'Bark closes over a friendly piece. Chaff can no longer touch it.',
    },
  ],
  yellow: [
    {
      id: 'yellow_lightning',
      name: 'Lightning Strike',
      glyph: '⚡',
      cost: 5,
      spec: { effect: { kind: 'destroy_enemy', maxCost: 3 }, slots: ['enemy_piece'] },
      blurb: 'Instantly remove any enemy piece costing 3 or less, anywhere on the board.',
    },
    {
      id: 'yellow_detonate',
      name: 'Detonate',
      glyph: '❂',
      cost: 4,
      spec: { effect: { kind: 'detonate', radius: 'adjacent' }, slots: ['enemy_piece'] },
      blurb: 'Blow a hole in the board. The target and everything beside it goes — yours included.',
    },
    {
      id: 'yellow_chaos',
      name: 'Chaos Magic',
      glyph: '◈',
      cost: 1,
      spec: { effect: { kind: 'recycle_hand' }, slots: [] },
      blurb: 'Cycle your whole hand to the bottom of the deck and draw fresh.',
    },
  ],
  purple: [
    {
      id: 'purple_grave_leap',
      name: 'Grave Leap',
      glyph: '⇈',
      cost: 1,
      spec: {
        effect: { kind: 'grant_rule', rule: { kind: 'leap', offsets: KNIGHT_OFFSETS } },
        slots: ['friendly_pawn'],
      },
      blurb: 'One of your levies learns the knight’s leap, permanently. Nobody is safe two squares away.',
    },
    {
      id: 'purple_raise',
      name: 'Raise the Levy',
      glyph: '⊕',
      cost: 2,
      spec: {
        effect: { kind: 'summon', pieceId: pieceIdFor('purple', 'pawn') },
        slots: ['empty_muster', 'empty_muster'],
      },
      blurb: 'Two Risen Levies claw up onto empty muster squares.',
    },
    {
      id: 'purple_restless',
      name: 'Restless Dead',
      glyph: '◉',
      cost: 2,
      spec: { effect: { kind: 'restore_grave' }, slots: ['empty_muster'] },
      blurb: 'Your longest-dead piece gets back up on an empty muster square.',
    },
  ],
};

export const EFFECT_CARDS: EffectCard[] = (Object.keys(ACTIONS) as FactionId[]).flatMap((factionId) =>
  (ACTIONS[factionId] as ActionEntry[]).map((entry) => ({
    id: entry.id,
    kind: 'effect' as const,
    name: entry.name,
    factionId,
    glyph: entry.glyph,
    cost: entry.cost,
    rarity: rarityFor(entry.cost),
    maxCopies: copiesAllowed(entry.cost),
    spec: entry.spec,
    code: '',
    blurb: entry.blurb,
  })),
);

export const CARDS: Card[] = [...PIECE_CARDS, ...EFFECT_CARDS];

// Collector codes are printed under the card name, e.g. "2R". They number the
// card within its faction and carry its rarity letter, matching the print run.
const seen: Record<string, number> = {};
for (const card of CARDS) {
  const letter = RARITY_LETTER[card.rarity];
  const key = `${card.factionId}:${letter}`;
  seen[key] = (seen[key] ?? 0) + 1;
  card.code = `${seen[key]}${letter}`;
}

export const cardsOfFaction = (factionId: FactionId): Card[] =>
  CARDS.filter((c) => c.factionId === factionId);

export const cardById = (id: string): Card => {
  const found = CARDS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown card "${id}".`);
  return found;
};
