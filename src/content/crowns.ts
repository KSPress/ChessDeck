import { ALL_DIRECTIONS, KNIGHT_OFFSETS } from '@/engine/board';
import type { CrownDef, PieceDef } from '@/engine/types';

/**
 * The faction leaders. Each is the royal piece — lose it and you lose the match
 * — and each moves exactly as printed on its card.
 */
export const CROWNS: CrownDef[] = [
  {
    id: 'orc_chieftain',
    name: 'Orc Chieftain',
    factionId: 'red',
    title: 'Astride the Flying Beast',
    glyph: '♞',
    // Printed movement: the knight's crooked charge.
    rules: [{ kind: 'leap', offsets: KNIGHT_OFFSETS }],
    traits: ['royal'],
    powerName: 'Warcry',
    powerCost: 2,
    powerCooldown: 3,
    power: { effect: { kind: 'strike_on_capture', count: 2 }, slots: [] },
    modifiers: {},
    code: '1R',
    blurb:
      'A crown that hunts. Leaping the knight’s path puts him in reach of things a king should not be near — which is the point. Warcry pays out an extra move on each of the next two captures, so it rewards a line of blood rather than a straight run at the throne.',
  },
  {
    id: 'dwarf_throne',
    name: 'Dwarf Throne',
    factionId: 'blue',
    title: 'The Seat That Does Not Move',
    glyph: '⛩',
    // Printed movement: one square left or right. Nothing else.
    rules: [
      {
        kind: 'slide',
        dirs: [
          { df: 1, dr: 0 },
          { df: -1, dr: 0 },
        ],
        range: 1,
      },
    ],
    // Plated as well as immobile: he can barely step aside, so chaff must not
    // be able to topple him.
    traits: ['royal', 'armored'],
    powerName: 'Stoneform',
    powerCost: 2,
    powerCooldown: 3,
    power: { effect: { kind: 'shield_friendly', turns: 1 }, slots: ['friendly_piece'] },
    modifiers: { musterLimit: 22 },
    code: '1R',
    blurb:
      'He shuffles along his back rank and no further. In exchange the hold musters heavier than anyone else can afford.',
  },
  {
    id: 'elf_queen',
    name: 'Elf Queen',
    factionId: 'green',
    title: 'Lady of the Everroot',
    glyph: '♛',
    // Printed movement: the full queen, unlimited in all eight directions.
    rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 5 }],
    traits: ['royal'],
    powerName: 'Restore',
    powerCost: 2,
    powerCooldown: 3,
    power: { effect: { kind: 'restore_grave' }, slots: ['empty_muster'] },
    modifiers: { musterLimit: 20 },
    code: '1R',
    blurb:
      'The most mobile crown in the game — and the most exposed, since losing her loses the match. She fights, and she brings the fallen back to do it again.',
  },
  {
    id: 'gnome_engineer',
    name: 'Gnome Engineer',
    factionId: 'yellow',
    title: 'The Mad Tinkerer',
    glyph: '⚙',
    // Printed movement: one square in any direction.
    rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 1 }],
    traits: ['royal'],
    powerName: 'Lightning Strike',
    powerCost: 3,
    powerCooldown: 4,
    power: { effect: { kind: 'destroy_enemy', maxCost: 3 }, slots: ['enemy_piece'] },
    modifiers: { startingAether: 5 },
    code: '2R',
    blurb:
      'The pieces are his clockwork; the actions are his spells. Opens fast on extra aether and removes whatever is inconvenient.',
  },
  {
    id: 'barrow_king',
    name: 'Barrow King',
    factionId: 'purple',
    title: 'He Who Counts the Risen',
    glyph: '☗',
    // King steps, plus the slow forward shamble of the horde he leads.
    rules: [
      { kind: 'slide', dirs: ALL_DIRECTIONS, range: 1 },
      { kind: 'leap', offsets: [{ df: 0, dr: 2 }] },
    ],
    traits: ['royal'],
    powerName: 'Evolve',
    powerCost: 2,
    powerCooldown: 3,
    power: { effect: { kind: 'evolve_pawn' }, slots: ['friendly_pawn'] },
    modifiers: { handSize: 5 },
    code: '1R',
    blurb:
      'Holds a wider hand than anyone — five cards where everyone else holds four — and spends it on levies. Evolve promotes a pawn where it stands, no far rank required.',
  },
];

/**
 * Crowns sit on the board as ordinary piece instances so that movement
 * generation, capture rules and rendering need no special-casing. Each crown
 * therefore contributes a synthetic PieceDef under a namespaced id.
 */
export const crownPieceId = (crownId: string): string => `crown:${crownId}`;

export const CROWN_PIECES: PieceDef[] = CROWNS.map((crown) => ({
  id: crownPieceId(crown.id),
  name: crown.name,
  factionId: crown.factionId,
  archetype: 'leader',
  glyph: crown.glyph,
  cost: 0,
  rules: crown.rules,
  traits: crown.traits,
  // Weighted far above any other piece: losing it ends the match outright.
  value: 1000,
  blurb: crown.blurb,
}));

export const crownById = (id: string): CrownDef => {
  const found = CROWNS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown crown "${id}".`);
  return found;
};
