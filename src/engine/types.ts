/**
 * ChessDeck rules engine — core types.
 *
 * This module (and everything else under src/engine) is deliberately free of
 * React, React Native and any I/O. It is a pure state machine: given a
 * MatchState and an Action it returns a new MatchState. That keeps it fully
 * unit-testable and lets the exact same code run server-side later to referee
 * authoritative PVP matches.
 */

export const BOARD_SIZE = 6;
export const NUM_SQUARES = BOARD_SIZE * BOARD_SIZE;

/** Deck construction limits. Both are tuning knobs for balance passes. */
export const DECK_SIZE = 8;
export const HAND_SIZE = 4;

/**
 * Aether is the continuously regenerating resource that pays for deployments.
 * It replaces per-turn income: matches are real-time, so the pool fills on a
 * clock and the only thing gating a piece is its own cooldown.
 */
export const AETHER_START = 3;
export const AETHER_CAP = 10;
/** Milliseconds to regenerate one point of aether. */
export const AETHER_MS_PER_POINT = 1400;

/** Hard cap on a match. Most end well inside this on a crown capture. */
export const MATCH_LENGTH_MS = 300_000;
/** Aether regenerates twice as fast past this mark, to force a conclusion. */
export const DOUBLE_AETHER_AT_MS = 180_000;

/** Every piece is unavailable for this long after being mustered. */
export const DEPLOY_COOLDOWN_MULTIPLIER = 1.25;

export type Side = 'gold' | 'shadow';
export const SIDES: readonly Side[] = ['gold', 'shadow'] as const;

export function opponentOf(side: Side): Side {
  return side === 'gold' ? 'shadow' : 'gold';
}

/** Squares are indexed 0..35 as `rank * 6 + file`, with rank 0 as gold's home. */
export type Square = number;

export interface Vec {
  /** File delta, positive is toward higher files. */
  df: number;
  /** Rank delta, positive is "forward" for gold. */
  dr: number;
}

/* ------------------------------------------------------------------ */
/* Factions & archetypes                                               */
/* ------------------------------------------------------------------ */

export type FactionId = 'human' | 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export const FACTION_IDS: readonly FactionId[] = ['human', 'red', 'blue', 'green', 'yellow', 'purple'] as const;

/**
 * Every faction fields its own version of each chess archetype — red's `pawn`
 * is an Orc Peon, blue's is a Dwarf Miner. The archetype drives the silhouette
 * badge printed on the card and the piece's baseline movement.
 */
export type Archetype = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'fairy' | 'leader';

/** What a faction does for free, all match long. */
export type FactionPassive =
  /** Humans: no gimmick. The baseline, closest to classic chess. */
  | { kind: 'none' }
  /** Red: a piece that captures has its cooldown refunded and can strike on. */
  | { kind: 'bloodlust' }
  /** Blue: your pieces standing beside another friendly piece are armored. */
  | { kind: 'shieldwall' }
  /** Green: gain aether whenever one of your own pieces is captured. */
  | { kind: 'regrowth'; amount: number }
  /** Yellow: your captures detonate, destroying pieces diagonal to the target. */
  | { kind: 'explosive_capture' }
  /**
   * Purple: an Undead piece's capture doesn't just remove the loser — it
   * rises again as a zombie under Undead control, facing the way it used to.
   */
  | { kind: 'harvest' };

export interface FactionDef {
  id: FactionId;
  /** The people, e.g. "Orc". */
  people: string;
  /** The banner name, e.g. "Bloodhorn Clans". */
  name: string;
  /** One-word strategic identity, e.g. "Aggressive". */
  theme: string;
  /** Card face colours, sampled from the printed cards. */
  paper: string;
  ink: string;
  crownId: CrownId;
  passive: FactionPassive;
  passiveName: string;
  passiveBlurb: string;
  /**
   * True only for the Gnome Engineer: this faction's pieces muster adjacent
   * to their own Crown instead of anywhere in the muster zone — automatons
   * built around their tinkerer rather than an army along a back rank.
   */
  deployNearCrown?: boolean;
  blurb: string;
}

/* ------------------------------------------------------------------ */
/* Movement                                                            */
/* ------------------------------------------------------------------ */

/**
 * Movement is expressed as a list of rules so that a single piece can combine
 * behaviours (e.g. a leader that steps like a king *and* leaps diagonally).
 */
export type MoveRule =
  /** Rides along each direction until blocked, up to `range` squares. */
  | { kind: 'slide'; dirs: Vec[]; range: number }
  /** Jumps directly to each offset, ignoring anything in between. */
  | { kind: 'leap'; offsets: Vec[] }
  /** Chess pawn behaviour: steps forward quietly, captures forward-diagonally. */
  | { kind: 'pawn'; range: number }
  /**
   * The Nightrider: repeats the same leap offset over and over in one
   * direction, like a rook riding — except each step is a knight-shaped jump
   * rather than a slide. Blocked only by what it would land ON, never by
   * anything "between" two leaps (there is no between).
   */
  | { kind: 'rider'; offset: Vec; range: number }
  /**
   * The Mao: steps one square orthogonally, then one square outward on the
   * diagonal — but unlike a knight, the orthogonal "leg" square must be empty
   * or the move is blocked there, same as a real Chinese-chess horse. One rule
   * carries the piece's whole set of (leg, offset) pairs.
   */
  | { kind: 'bentLeap'; leaps: { leg: Vec; offset: Vec }[] }
  /**
   * The Grasshopper: slides along a queen-line until it meets the first piece
   * in that direction (its "hurdle"), then must land on the very next square
   * beyond it — a quiet move if that square is empty, a capture if an enemy
   * sits there, and no move at all in that direction otherwise.
   */
  | { kind: 'hopper'; dirs: Vec[]; range: number };

export type Trait =
  /** Losing this piece loses the match. Only ever on a crown. */
  | 'royal'
  /** Becomes a stronger piece on reaching the far rank. */
  | 'promotes'
  /** Cannot be captured by cheap chaff (pieces costing <= ARMOR_PIERCE_COST). */
  | 'armored'
  /** Slides are not blocked by intervening pieces. */
  | 'ethereal'
  /** Whatever captures this piece is destroyed along with it. */
  | 'vengeful'
  /** Can never be captured or destroyed by anything, ever. A permanent wall. */
  | 'immutable'
  /**
   * Orcish final stand: when this piece is captured, the capture square (now
   * held by its killer) detonates, taking the killer and anything adjacent.
   */
  | 'explosive'
  /**
   * The Undead Horseman: on a Harvest capture, also has a chance to convert
   * one adjacent enemy pawn into a zombie of its own.
   */
  | 'reaper';

/**
 * The true queen's movement: unlimited range in all eight directions. Kept
 * exclusive to the Elven Queen crown — every faction's `queen` archetype card
 * uses a shorter-ranged rule instead, so this one stays worth being royalty.
 */
export const ALL_DIRECTIONS_RULE: MoveRule = {
  kind: 'slide',
  dirs: [
    { df: 1, dr: 0 },
    { df: -1, dr: 0 },
    { df: 0, dr: 1 },
    { df: 0, dr: -1 },
    { df: 1, dr: 1 },
    { df: 1, dr: -1 },
    { df: -1, dr: 1 },
    { df: -1, dr: -1 },
  ],
  range: 5,
};

/** Pieces at or below this cost cannot capture an `armored` piece. */
export const ARMOR_PIERCE_COST = 1;

export type PieceId = string;
export type CrownId = string;
export type CardId = string;

export interface PieceDef {
  id: PieceId;
  name: string;
  factionId: FactionId;
  archetype: Archetype;
  /** Single character used by the board renderer. */
  glyph: string;
  /** Aether cost to deploy, and the deck-budget cost of its card. */
  cost: number;
  rules: MoveRule[];
  traits: Trait[];
  /** What a `promotes` piece becomes on reaching the enemy back rank. */
  promotesTo?: PieceId;
  /** Material weight used by the AI evaluator. */
  value: number;
  /**
   * How long this piece must rest after moving. This — not a turn clock — is
   * what paces the match: heavy pieces hit hard but commit you for longer.
   */
  cooldownMs: number;
  blurb: string;
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

/** What a caster must pick before an effect can resolve. */
export type TargetSlot =
  | 'friendly_piece'
  | 'friendly_non_crown'
  | 'friendly_pawn'
  | 'enemy_piece'
  | 'empty_muster'
  | 'empty_own_half'
  | 'empty_square'
  /** Empty, and not adjacent to any enemy piece — Burrow's landing rule. */
  | 'empty_safe_square'
  /** Only valid for Blink: any square the previously-chosen piece could reach if nothing blocked it. */
  | 'blink_destination';

export type Effect =
  | { kind: 'gain_aether'; amount: number }
  /** Destroys an enemy piece, but only one cheap enough to be smitten. */
  | { kind: 'destroy_enemy'; maxCost: number }
  | { kind: 'shield_friendly'; ms: number }
  | { kind: 'root_enemy'; ms: number }
  | { kind: 'grant_trait'; trait: Trait }
  /** Clears a friendly piece's cooldown so it can act again at once. */
  | { kind: 'refund_cooldown' }
  /**
   * Banks charges that refund the cooldown of whichever piece captures next —
   * "capture, then strike again". In real time a cooldown refund *is* the
   * extra move.
   */
  | { kind: 'strike_on_capture'; count: number }
  /** Moves a friendly piece to any empty square in the caster's own half. */
  | { kind: 'teleport_friendly' }
  /** Deploys a piece for free onto each chosen empty muster square. */
  | { kind: 'summon'; pieceId: PieceId }
  /**
   * Elven Blink: relocates a friendly piece to any square along its own
   * movement lines, ignoring blockers along the way — it just can't land on
   * one. The destination is validated against that piece's own rules, not a
   * fixed slot, so its legal squares are computed specially by the engine.
   */
  | { kind: 'blink' }
  /**
   * Elven Vanish: untargetable for a moment, at the cost of being unable to
   * capture during that same window — evasion, not aggression.
   */
  | { kind: 'vanish'; ms: number }
  /**
   * Undead Harvest (the ability, not the standing passive): the next capture
   * this piece's side lands yields a full undead version of whatever was
   * taken, rather than the usual plain zombie.
   */
  | { kind: 'grant_harvest' }
  /** Replaces the rest of the hand by cycling it to the back of the deck. */
  | { kind: 'recycle_hand' }
  /** Green: returns the longest-dead piece in your graveyard to the board. */
  | { kind: 'restore_grave' }
  /** Purple: promotes one of your pawns where it stands. */
  | { kind: 'evolve_pawn' }
  /** Blue: the piece digs in — untouchable and immobile, and stops blocking. */
  | { kind: 'submerge'; ms: number }
  /** Grants a piece an extra movement rule for the rest of the match. */
  | { kind: 'grant_rule'; rule: MoveRule }
  /** Destroys the targeted piece and everything around it. Crowns are spared. */
  | { kind: 'detonate'; radius: 'adjacent' | 'diagonal' }
  /** Shields every friendly piece sharing a rank with the target. */
  | { kind: 'shield_rank'; ms: number };

export interface EffectSpec {
  effect: Effect;
  /** Ordered list of targets the player must supply, may be empty. */
  slots: TargetSlot[];
}

/* ------------------------------------------------------------------ */
/* Cards & crowns                                                      */
/* ------------------------------------------------------------------ */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface CardBase {
  id: CardId;
  name: string;
  factionId: FactionId;
  glyph: string;
  /** Deck-budget cost *and* the aether cost to play it. */
  cost: number;
  rarity: Rarity;
  /** Copies allowed in one deck. Cheap chaff can be doubled up, bombs cannot. */
  maxCopies: number;
  /** Collector code printed under the name, e.g. "1R". */
  code: string;
  blurb: string;
}

export interface PieceCard extends CardBase {
  kind: 'piece';
  pieceId: PieceId;
  archetype: Archetype;
}

export interface EffectCard extends CardBase {
  kind: 'effect';
  spec: EffectSpec;
}

export type Card = PieceCard | EffectCard;

export interface CrownDef {
  id: CrownId;
  name: string;
  factionId: FactionId;
  glyph: string;
  title: string;
  rules: MoveRule[];
  traits: Trait[];
  /** Aether the crown's power costs on top of its cooldown. */
  powerCost: number;
  powerName: string;
  power: EffectSpec;
  /** Per-crown adjustments applied at match start. */
  modifiers: {
    startingAether?: number;
    handSize?: number;
    /** Multiplies this faction's aether regeneration rate. */
    aetherRate?: number;
  };
  /** How long the crown rests after moving. */
  cooldownMs: number;
  /** Seconds between activations of the crown power. */
  powerCooldownMs: number;
  code: string;
  blurb: string;
}

/* ------------------------------------------------------------------ */
/* Match state                                                         */
/* ------------------------------------------------------------------ */

export interface PieceInstance {
  uid: number;
  pieceId: PieceId;
  owner: Side;
  square: Square;
  /** Base traits plus anything granted mid-match. */
  traits: Trait[];
  /** Movement rules granted mid-match, on top of the piece definition's. */
  grantedRules: MoveRule[];
  /** Present only on the royal piece. */
  crownId?: CrownId;
  hasMoved: boolean;
  /**
   * Clock time at which this piece may next move. Set when it is mustered and
   * again after every move, this is the game's core pacing mechanism.
   */
  readyAtMs: number;
  /** Clock time until which this piece cannot move at all. */
  rootedUntilMs: number;
  /** Clock time until which this piece cannot be captured. */
  shieldedUntilMs: number;
  /** Clock time until which this piece may move, but never capture. */
  noCaptureUntilMs: number;
  /**
   * True for an Undead zombie: it plays for its new owner but keeps the
   * *original* owner's forward direction — "facing the opposite direction",
   * as printed. Movement code treats a reversed piece as if it belonged to
   * the opposing side for orientation purposes only.
   */
  reversed: boolean;
  /**
   * Dug in until this time: untouchable and immobile, and — unlike a shield —
   * it stops blocking line of sight, so pieces slide straight over it.
   */
  submergedUntilMs: number;
}

export interface PlayerState {
  side: Side;
  crownId: CrownId;
  factionId: FactionId;
  aether: number;
  /** Draw queue. Played cards return to the back, so an 8-card deck cycles. */
  deck: CardId[];
  hand: CardId[];
  handSize: number;
  /** Pieces of yours that have died on the board, oldest first. */
  graveyard: PieceId[];
  /** Clock time at which the crown power becomes available again. */
  powerReadyAtMs: number;
  /** Multiplier on this player's aether regeneration. */
  aetherRate: number;
  /** Cooldown refunds owed to whichever piece captures next. */
  pendingStrikes: number;
  /** Undead: the next capture yields a full undead version of the casualty
   *  instead of a plain zombie. Spent by the first capture that follows. */
  harvestCharges: number;
  /** False until this player has chosen where their crown stands. */
  crownPlaced: boolean;
}

export type MatchStatus = 'active' | 'gold_wins' | 'shadow_wins' | 'draw';

/** Placement happens before the clock starts; the battle runs in real time. */
export type MatchPhase = 'placement' | 'battle' | 'over';

export interface LogEntry {
  atMs: number;
  side: Side;
  text: string;
}

export interface MatchState {
  /** Length NUM_SQUARES; null means empty. */
  board: (PieceInstance | null)[];
  players: Record<Side, PlayerState>;
  /** Milliseconds of battle elapsed. Zero until both crowns are placed. */
  clockMs: number;
  phase: MatchPhase;
  status: MatchStatus;
  seed: number;
  log: LogEntry[];
  nextUid: number;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every action names its side: with no turn order, both players may act at any
 * moment their aether and cooldowns allow.
 */
export type Action =
  | { type: 'placeCrown'; side: Side; square: Square }
  | { type: 'move'; side: Side; from: Square; to: Square }
  | { type: 'deploy'; side: Side; handIndex: number; to: Square }
  | { type: 'cast'; side: Side; handIndex: number; targets: Square[] }
  | { type: 'power'; side: Side; targets: Square[] };

export interface Deck {
  id: string;
  name: string;
  crownId: CrownId;
  /** Exactly DECK_SIZE card ids; duplicates allowed up to each card's maxCopies. */
  cards: CardId[];
}
