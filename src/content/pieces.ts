import { ALL_DIRECTIONS, DIAGONAL, KNIGHT_OFFSETS, LEAP_TWO_OFFSETS, ORTHOGONAL } from '@/engine/board';
import type { Archetype, FactionId, MoveRule, PieceDef, Trait } from '@/engine/types';

/**
 * Baseline movement and price for each chess archetype. Every faction fields
 * one piece per archetype; the faction may re-price it, rename it and bend its
 * movement, but the archetype is what the silhouette badge on the card shows.
 */
const ARCHETYPE_BASE: Record<
  Exclude<Archetype, 'leader' | 'signature'>,
  { rules: MoveRule[]; cost: number; value: number; glyph: string }
> = {
  pawn: { rules: [{ kind: 'pawn', range: 1 }], cost: 1, value: 1, glyph: '♟' },
  knight: { rules: [{ kind: 'leap', offsets: KNIGHT_OFFSETS }], cost: 3, value: 3.2, glyph: '♞' },
  bishop: { rules: [{ kind: 'slide', dirs: DIAGONAL, range: 5 }], cost: 3, value: 3.3, glyph: '♝' },
  rook: { rules: [{ kind: 'slide', dirs: ORTHOGONAL, range: 5 }], cost: 4, value: 5, glyph: '♜' },
  queen: { rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 5 }], cost: 6, value: 9, glyph: '♛' },
};

interface Entry {
  archetype: Archetype;
  name: string;
  blurb: string;
  /** Overrides on top of the archetype baseline. */
  rules?: MoveRule[];
  cost?: number;
  value?: number;
  traits?: Trait[];
  glyph?: string;
}

const ROSTER: Record<FactionId, Entry[]> = {
  /* -------------------------------------------------------------- */
  red: [
    { archetype: 'pawn', name: 'Orc Peon', blurb: 'Thrown forward in numbers and rarely mourned.' },
    { archetype: 'knight', name: 'Dire Wolf Rider', blurb: 'Leaps the crooked charge and lands snarling.' },
    { archetype: 'bishop', name: 'Blood Shaman', blurb: 'Reads the long diagonals in something still warm.' },
    { archetype: 'rook', name: 'Siege Beast', blurb: 'Holds a rank by standing in it and daring you.' },
    { archetype: 'queen', name: 'Orc Warlord', blurb: 'The full sweep, and the temperament to use all of it.' },
    {
      archetype: 'signature',
      name: 'Blood Raider',
      blurb: 'Two squares along any diagonal. Built to reach something this turn.',
      rules: [{ kind: 'slide', dirs: DIAGONAL, range: 2 }],
      cost: 2,
      value: 2.5,
      glyph: '⚔',
    },
  ],
  /* -------------------------------------------------------------- */
  blue: [
    { archetype: 'pawn', name: 'Dwarf Miner', blurb: 'Advances one square at a time and expects to be there tomorrow.' },
    { archetype: 'knight', name: 'Ram Rider', blurb: 'A mountain ram takes the crooked charge in its stride.' },
    { archetype: 'bishop', name: 'Runesmith', blurb: 'Cuts a line of runes clean across the diagonal.' },
    {
      archetype: 'rook',
      name: 'Stone Bastion',
      blurb: 'Plated as well as immovable. Costs more because it survives more.',
      cost: 5,
      value: 5.6,
      traits: ['armored'],
    },
    { archetype: 'queen', name: 'Forge Matron', blurb: 'Rules the hold and every line leading into it.' },
    {
      archetype: 'signature',
      name: 'Anvil Guard',
      blurb: 'One step in any direction, plated, and whatever fells it dies under the rubble.',
      rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 1 }],
      cost: 3,
      value: 3.4,
      traits: ['armored', 'vengeful'],
      glyph: '⛊',
    },
  ],
  /* -------------------------------------------------------------- */
  green: [
    { archetype: 'pawn', name: 'Sapling', blurb: 'Given time and a far rank, it becomes something with antlers.' },
    { archetype: 'knight', name: 'Stag Rider', blurb: 'Clears the undergrowth and everything standing in it.' },
    { archetype: 'bishop', name: 'Wildseer', blurb: 'Sees down the diagonal further than the diagonal goes.' },
    {
      archetype: 'rook',
      name: 'Elder Oak',
      blurb: 'Roots across a whole rank. Chaff cannot bite through the bark.',
      traits: ['armored'],
      value: 5.2,
    },
    {
      archetype: 'queen',
      name: 'Druid',
      blurb: 'A queen’s freedom, two squares at a time — and half a queen’s price.',
      rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 2 }],
      cost: 4,
      value: 4.6,
    },
    {
      archetype: 'signature',
      name: 'Thornling',
      blurb: 'Cheap, quick along the diagonals, and no great loss when it goes.',
      rules: [{ kind: 'slide', dirs: DIAGONAL, range: 2 }],
      cost: 2,
      value: 2.4,
      glyph: '❦',
    },
  ],
  /* -------------------------------------------------------------- */
  yellow: [
    { archetype: 'pawn', name: 'Cog Servitor', blurb: 'Winds forward one square. Does not ask where.' },
    { archetype: 'knight', name: 'Spring-Leg Automaton', blurb: 'Coils, releases, and lands a knight’s move away.' },
    { archetype: 'bishop', name: 'Arc Coil', blurb: 'Earths itself down the nearest diagonal.' },
    { archetype: 'rook', name: 'Siege Engine', blurb: 'Rolls the length of a rank and flattens the end of it.' },
    { archetype: 'queen', name: 'Doom Contraption', blurb: 'Every direction at once. Nobody is quite sure how.' },
    {
      archetype: 'signature',
      name: 'Tesla Sentinel',
      blurb: 'Blinks exactly two squares in a straight line, over anything in the way.',
      rules: [{ kind: 'leap', offsets: LEAP_TWO_OFFSETS }],
      cost: 3,
      value: 3,
      glyph: '⍟',
    },
  ],
  /* -------------------------------------------------------------- */
  purple: [
    { archetype: 'pawn', name: 'Risen Levy', blurb: 'The whole point of the Barrow Legion. There are always more.' },
    { archetype: 'knight', name: 'Bone Hound', blurb: 'Still hunts on the crooked path it learned in life.' },
    { archetype: 'bishop', name: 'Necromancer', blurb: 'Works the diagonals, and the ground beneath them.' },
    {
      archetype: 'rook',
      name: 'Crypt Wall',
      blurb: 'A rank of stacked dead. Nothing cheap gets through it.',
      traits: ['armored'],
      value: 5.2,
    },
    {
      archetype: 'queen',
      name: 'Lich',
      blurb: 'Drifts three squares in any direction, straight through the living.',
      rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 3 }],
      cost: 5,
      value: 6,
      traits: ['ethereal'],
    },
    {
      archetype: 'signature',
      name: 'Grave Wight',
      blurb: 'One step in any direction, and it takes its killer with it.',
      rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 1 }],
      cost: 2,
      value: 2.6,
      traits: ['vengeful'],
      glyph: '☠',
    },
  ],
};

/** `red_pawn`, `blue_rook`, and so on. Stable ids that decks refer to. */
export const pieceIdFor = (factionId: FactionId, archetype: Archetype): string =>
  `${factionId}_${archetype}`;

function build(factionId: FactionId, entry: Entry): PieceDef {
  const base =
    entry.archetype === 'signature' || entry.archetype === 'leader'
      ? null
      : ARCHETYPE_BASE[entry.archetype];

  const def: PieceDef = {
    id: pieceIdFor(factionId, entry.archetype),
    name: entry.name,
    factionId,
    archetype: entry.archetype,
    glyph: entry.glyph ?? base?.glyph ?? '◆',
    cost: entry.cost ?? base?.cost ?? 3,
    rules: entry.rules ?? base?.rules ?? [],
    traits: entry.traits ?? [],
    value: entry.value ?? base?.value ?? 3,
    blurb: entry.blurb,
  };

  // Pawns promote into their own faction's knight, never a neutral one.
  if (entry.archetype === 'pawn') {
    def.traits = [...def.traits, 'promotes'];
    def.promotesTo = pieceIdFor(factionId, 'knight');
  }
  return def;
}

export const PIECES: PieceDef[] = (Object.keys(ROSTER) as FactionId[]).flatMap((factionId) =>
  (ROSTER[factionId] as Entry[]).map((entry) => build(factionId, entry)),
);

export const piecesOfFaction = (factionId: FactionId): PieceDef[] =>
  PIECES.filter((p) => p.factionId === factionId);
