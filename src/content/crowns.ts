import { ALL_DIRECTIONS, KNIGHT_OFFSETS } from '@/engine/board';
import { ALL_DIRECTIONS_RULE, type CrownDef, type PieceDef } from '@/engine/types';

/**
 * The faction leaders. Each is the royal piece — lose it and you lose the match
 * — and each moves exactly as printed on its card. `cooldownMs` is the crown's
 * own resting time after moving; `powerCooldownMs` gates its power separately.
 */
export const CROWNS: CrownDef[] = [
  {
    id: 'human_king',
    name: 'Human King',
    factionId: 'human',
    title: 'No Gimmick, None Needed',
    glyph: '♚',
    // Printed movement: one square in any direction, the plain king's step.
    rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 1 }],
    traits: ['royal'],
    cooldownMs: 1800,
    powerName: 'Rally',
    powerCost: 2,
    powerCooldownMs: 9_000,
    power: { effect: { kind: 'shield_friendly', ms: 4_000 }, slots: ['friendly_piece'] },
    modifiers: {},
    code: '1R',
    blurb:
      'Closest to classic chess of any crown in the game — the baseline every other faction is measured against.',
  },
  {
    id: 'orc_chieftain',
    name: 'Orc Chieftain',
    factionId: 'red',
    title: 'Astride the Flying Beast',
    glyph: '♞',
    // Printed movement: the knight's crooked charge.
    rules: [{ kind: 'leap', offsets: KNIGHT_OFFSETS }],
    traits: ['royal'],
    cooldownMs: 2200,
    powerName: 'Warcry',
    powerCost: 2,
    powerCooldownMs: 9_000,
    power: { effect: { kind: 'strike_on_capture', count: 2 }, slots: [] },
    modifiers: {},
    code: '1R',
    blurb:
      'A crown that hunts. Leaping the knight’s path puts him in reach of things a king should not be near — which is the point. Warcry pays out a cooldown refund on each of the next two captures, so it rewards a line of blood rather than a straight run at the throne.',
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
    cooldownMs: 2000,
    powerName: 'Stoneform',
    powerCost: 2,
    powerCooldownMs: 9_000,
    power: { effect: { kind: 'shield_friendly', ms: 4_000 }, slots: ['friendly_piece'] },
    modifiers: { aetherRate: 1.25 },
    code: '1R',
    blurb:
      'He shuffles along his back rank and no further. In exchange, the hold’s aether flows a quarter faster than anyone else’s — the economic edge his own immobility buys.',
  },
  {
    id: 'elf_queen',
    name: 'Elf Queen',
    factionId: 'green',
    title: 'Lady of the Everroot',
    glyph: '♛',
    // Printed movement: the full queen, unlimited in all eight directions —
    // the one place in the game this movement is still legal.
    rules: [ALL_DIRECTIONS_RULE],
    traits: ['royal'],
    cooldownMs: 3600,
    powerName: 'Restore',
    powerCost: 2,
    powerCooldownMs: 9_000,
    power: { effect: { kind: 'restore_grave' }, slots: ['empty_muster'] },
    modifiers: { aetherRate: 0.85 },
    code: '1R',
    blurb:
      'The only true queen’s movement left standing anywhere in the game — and the most exposed crown for it, since losing her loses the match outright. Everroot’s aether runs a little slower to pay for her reach.',
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
    cooldownMs: 1800,
    powerName: 'Lightning Strike',
    powerCost: 3,
    powerCooldownMs: 12_000,
    power: { effect: { kind: 'destroy_enemy', maxCost: 3 }, slots: ['enemy_piece'] },
    modifiers: { startingAether: 6 },
    code: '2R',
    blurb:
      'The pieces are his clockwork; the actions are his spells. Opens fast on extra aether and removes whatever is inconvenient. Every automaton but the Engineer himself has to be built standing next to him.',
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
    cooldownMs: 2000,
    powerName: 'Evolve',
    powerCost: 2,
    powerCooldownMs: 9_000,
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
  cooldownMs: crown.cooldownMs,
  blurb: crown.blurb,
}));

export const crownById = (id: string): CrownDef => {
  const found = CROWNS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown crown "${id}".`);
  return found;
};
