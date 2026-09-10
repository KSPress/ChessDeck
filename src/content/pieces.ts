import {
  ALFIL_OFFSETS,
  ALL_DIRECTIONS,
  CAMEL_OFFSETS,
  DABBABA_OFFSETS,
  DIAGONAL,
  FERZ_OFFSETS,
  KNIGHT_OFFSETS,
  MAO_LEAPS,
  NIGHTRIDER_DIRECTIONS,
  ORTHOGONAL,
  WAZIR_OFFSETS,
} from '@/engine/board';
import type { Archetype, FactionId, MoveRule, PieceDef, Trait } from '@/engine/types';

/**
 * Baseline movement, price and cooldown for each of the five classic chess
 * archetypes — this literally *is* the Human roster, since Humans field no
 * fairy pieces and no faction gimmick. Every other faction fields one piece
 * per archetype too, re-priced, renamed and re-worded onto its own movement,
 * but the archetype is what the silhouette badge on the card shows.
 *
 * The queen archetype is deliberately short of a *true* queen — unlimited
 * range in all eight directions stays exclusive to the Elven Queen crown, so
 * that losing her is the only place a true queen's mobility is on the board.
 */
const ARCHETYPE_BASE: Record<
  Exclude<Archetype, 'leader' | 'fairy'>,
  { rules: MoveRule[]; cost: number; value: number; cooldownMs: number; glyph: string }
> = {
  pawn: { rules: [{ kind: 'pawn', range: 1 }], cost: 1, value: 1, cooldownMs: 1400, glyph: '♟' },
  knight: {
    rules: [{ kind: 'leap', offsets: KNIGHT_OFFSETS }],
    cost: 3,
    value: 3.2,
    cooldownMs: 2000,
    glyph: '♞',
  },
  bishop: {
    rules: [{ kind: 'slide', dirs: DIAGONAL, range: 5 }],
    cost: 3,
    value: 3.3,
    cooldownMs: 2000,
    glyph: '♝',
  },
  rook: {
    rules: [{ kind: 'slide', dirs: ORTHOGONAL, range: 5 }],
    cost: 4,
    value: 5,
    cooldownMs: 2600,
    glyph: '♜',
  },
  queen: {
    rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 3 }],
    cost: 5,
    value: 6.5,
    cooldownMs: 3000,
    glyph: '♛',
  },
};

interface Entry {
  archetype: Archetype;
  name: string;
  blurb: string;
  /** Overrides on top of the archetype baseline. */
  rules?: MoveRule[];
  cost?: number;
  value?: number;
  cooldownMs?: number;
  traits?: Trait[];
  glyph?: string;
}

/**
 * Every non-Human faction fields exactly two fairy pieces, named and
 * reflavoured from the design spec's own list. Humans field none — fairy
 * chess is explicitly what the other five factions have and Humans don't.
 */
const ROSTER: Record<FactionId, Entry[]> = {
  /* -------------------------------------------------------------- */
  human: [
    { archetype: 'pawn', name: 'Man-at-Arms', blurb: 'A soldier with no gimmick, and none needed.' },
    { archetype: 'knight', name: 'Knight', blurb: 'The crooked charge, ridden by the book.' },
    { archetype: 'bishop', name: 'Cleric', blurb: 'Walks the diagonal, blessing nothing in particular.' },
    { archetype: 'rook', name: 'Castellan', blurb: 'Holds a rank because that is the job.' },
    { archetype: 'queen', name: 'Consort', blurb: 'Close to a true queen, deliberately not quite one.' },
  ],
  /* -------------------------------------------------------------- */
  red: [
    { archetype: 'pawn', name: 'Orc Peon', blurb: 'Thrown forward in numbers and rarely mourned.' },
    { archetype: 'knight', name: 'Dire Wolf Rider', blurb: 'Leaps the crooked charge and lands snarling.' },
    { archetype: 'bishop', name: 'Blood Shaman', blurb: 'Reads the long diagonals in something still warm.' },
    { archetype: 'rook', name: 'Siege Beast', blurb: 'Holds a rank by standing in it and daring you.' },
    { archetype: 'queen', name: 'Orc Warlord', blurb: 'The sweep of a queen, and the temper to spend it fast.' },
    {
      archetype: 'fairy',
      name: 'Wyvern Rider',
      blurb: 'Rides the knight’s own crooked line again and again — a Nightrider, reined by an orc.',
      rules: NIGHTRIDER_DIRECTIONS.map((offset) => ({ kind: 'rider' as const, offset, range: 3 })),
      cost: 4,
      value: 5.5,
      cooldownMs: 2800,
      glyph: '⚔',
    },
    {
      archetype: 'fairy',
      name: 'Berserker',
      blurb: 'A Mao’s bent leap — orthogonal, then out on the diagonal — and it can be blocked at the elbow.',
      rules: [{ kind: 'bentLeap', leaps: MAO_LEAPS }],
      cost: 2,
      value: 2.6,
      cooldownMs: 1800,
      glyph: '⚡',
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
      archetype: 'fairy',
      name: 'Battering Ram',
      blurb: 'A Dabbaba’s straight two-square jump, plated for the work it is built to do.',
      rules: [{ kind: 'leap', offsets: DABBABA_OFFSETS }],
      traits: ['armored'],
      cost: 2,
      value: 2.4,
      cooldownMs: 2000,
      glyph: '⛊',
    },
    {
      archetype: 'fairy',
      name: 'Shieldbearer',
      blurb: 'A Wazir’s single orthogonal step — cheap, plated, and always in the way.',
      rules: [{ kind: 'leap', offsets: WAZIR_OFFSETS }],
      traits: ['armored'],
      cost: 1,
      value: 1.6,
      cooldownMs: 1400,
      glyph: '◆',
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
      blurb: 'Every direction at once, only ever two squares at a time.',
      rules: [{ kind: 'slide', dirs: ALL_DIRECTIONS, range: 2 }],
      cost: 4,
      value: 4.6,
    },
    {
      archetype: 'fairy',
      name: 'Woodland Archer',
      blurb: 'A Ferz’s single diagonal step. Elegant, short-ranged, never in the wrong place.',
      rules: [{ kind: 'leap', offsets: FERZ_OFFSETS }],
      cost: 1,
      value: 1.6,
      cooldownMs: 1400,
      glyph: '❦',
    },
    {
      archetype: 'fairy',
      name: 'Moon Scout',
      blurb: 'An Alfil’s two-square diagonal leap, out past where the Archer can reach.',
      rules: [{ kind: 'leap', offsets: ALFIL_OFFSETS }],
      cost: 2,
      value: 2.5,
      cooldownMs: 1800,
      glyph: '✧',
    },
  ],
  /* -------------------------------------------------------------- */
  yellow: [
    { archetype: 'pawn', name: 'Cog Servitor', blurb: 'Winds forward one square. Does not ask where.' },
    { archetype: 'knight', name: 'Spring-Leg Automaton', blurb: 'Coils, releases, and lands a knight’s move away.' },
    { archetype: 'bishop', name: 'Arc Coil', blurb: 'Earths itself down the nearest diagonal.' },
    { archetype: 'rook', name: 'Siege Engine', blurb: 'Rolls the length of a rank and flattens the end of it.' },
    { archetype: 'queen', name: 'Doom Contraption', blurb: 'Every direction at once. Nobody is quite sure how far.' },
    {
      archetype: 'fairy',
      name: 'Signal Drone',
      blurb: 'A Grasshopper: rides a line to the first thing in it, then hops the very next square beyond.',
      rules: [{ kind: 'hopper', dirs: ALL_DIRECTIONS, range: 5 }],
      cost: 3,
      value: 3.4,
      cooldownMs: 2200,
      glyph: '⍟',
    },
    {
      archetype: 'fairy',
      name: 'Turret Drone',
      blurb: 'An Alfil’s two-square diagonal leap, bolted on and pointed outward.',
      rules: [{ kind: 'leap', offsets: ALFIL_OFFSETS }],
      cost: 2,
      value: 2.4,
      cooldownMs: 1800,
      glyph: '◉',
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
      archetype: 'fairy',
      name: 'Shambling Corpse',
      blurb: 'A Wazir’s single orthogonal step — slow, cheap, and it keeps getting up.',
      rules: [{ kind: 'leap', offsets: WAZIR_OFFSETS }],
      cost: 1,
      value: 1.5,
      cooldownMs: 1600,
      glyph: '☠',
    },
    {
      archetype: 'fairy',
      name: 'Horseman',
      blurb:
        'A Camel’s long, lopsided leap — and whatever it captures, it may drag an adjacent soul down too. ' +
        'The reach costs it a long rest between charges.',
      rules: [{ kind: 'leap', offsets: CAMEL_OFFSETS }],
      traits: ['reaper'],
      cost: 4,
      value: 4.5,
      cooldownMs: 4200,
      glyph: '⚱',
    },
  ],
};

/** `red_pawn`, `blue_rook`, and so on. Stable ids that decks refer to. */
export const pieceIdFor = (factionId: FactionId, archetype: Archetype): string =>
  `${factionId}_${archetype}`;

function build(factionId: FactionId, entry: Entry, index: number): PieceDef {
  const base = entry.archetype === 'fairy' || entry.archetype === 'leader' ? null : ARCHETYPE_BASE[entry.archetype];

  // Two fairy pieces share one archetype tag, so they need distinguishing ids;
  // every other archetype is one-per-faction and keeps the plain short id.
  const id = entry.archetype === 'fairy' ? `${factionId}_fairy${index}` : pieceIdFor(factionId, entry.archetype);

  const def: PieceDef = {
    id,
    name: entry.name,
    factionId,
    archetype: entry.archetype,
    glyph: entry.glyph ?? base?.glyph ?? '◆',
    cost: entry.cost ?? base?.cost ?? 3,
    rules: entry.rules ?? base?.rules ?? [],
    traits: entry.traits ?? [],
    value: entry.value ?? base?.value ?? 3,
    cooldownMs: entry.cooldownMs ?? base?.cooldownMs ?? 2000,
    blurb: entry.blurb,
  };

  // Pawns promote into their own faction's knight, never a neutral one.
  if (entry.archetype === 'pawn') {
    def.traits = [...def.traits, 'promotes'];
    def.promotesTo = pieceIdFor(factionId, 'knight');
  }
  return def;
}

export const PIECES: PieceDef[] = (Object.keys(ROSTER) as FactionId[]).flatMap((factionId) => {
  let fairyIndex = 0;
  return (ROSTER[factionId] as Entry[]).map((entry) => {
    const index = entry.archetype === 'fairy' ? fairyIndex++ : -1;
    return build(factionId, entry, index);
  });
});

export const piecesOfFaction = (factionId: FactionId): PieceDef[] =>
  PIECES.filter((p) => p.factionId === factionId);

/**
 * Pieces that exist on the board but never as a card in anyone's deck: the
 * plain zombie Harvest raises by default, and the Barricade wall. Registered
 * with the engine like any other piece, but never handed to `PIECE_CARDS`.
 */
export const RUNTIME_PIECES: PieceDef[] = [
  {
    id: 'purple_zombie',
    name: 'Zombie',
    factionId: 'purple',
    archetype: 'pawn',
    glyph: '♟',
    cost: 0,
    rules: [{ kind: 'pawn', range: 1 }],
    traits: ['promotes'],
    promotesTo: 'purple_knight',
    value: 1,
    cooldownMs: 1600,
    blurb: 'What Harvest leaves behind when there was nothing to upgrade it with.',
  },
  {
    id: 'human_barricade_wall',
    name: 'Barricade',
    factionId: 'human',
    archetype: 'fairy',
    glyph: '⛔',
    cost: 0,
    rules: [],
    traits: ['immutable'],
    value: 0,
    cooldownMs: 0,
    blurb: 'Stone and nothing else. It cannot be captured, moved, or moved onto.',
  },
];
