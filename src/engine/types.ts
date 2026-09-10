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
export const DEFAULT_MUSTER_LIMIT = 20;
export const HAND_SIZE = 5;

/** Aether is the per-match resource that pays for deploys, spells and powers. */
export const AETHER_START = 3;
export const AETHER_INCOME = 2;
export const AETHER_CAP = 12;

/** Safety valve so a stalled match still resolves. Counted in player turns. */
export const TURN_LIMIT = 100;

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

export type FactionId = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export const FACTION_IDS: readonly FactionId[] = ['red', 'blue', 'green', 'yellow', 'purple'] as const;

/**
 * Every faction fields its own version of each chess archetype — red's `pawn`
 * is an Orc Peon, blue's is a Dwarf Miner. The archetype drives the silhouette
 * badge printed on the card and the piece's baseline movement.
 */
export type Archetype = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'signature' | 'leader';

/** What a faction does for free, all match long. */
export type FactionPassive =
  /** Red: after one of your pieces captures, it may move again (once per turn). */
  | { kind: 'bloodlust' }
  /** Blue: your pieces standing beside another friendly piece are armored. */
  | { kind: 'shieldwall' }
  /** Green: gain aether whenever one of your own pieces is captured. */
  | { kind: 'regrowth'; amount: number }
  /** Yellow: your captures detonate, destroying pieces diagonal to the target. */
  | { kind: 'explosive_capture' }
  /** Purple: a captured pawn is replaced on your muster row (once per turn). */
  | { kind: 'undying' };

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
  | { kind: 'pawn'; range: number };

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
  | 'vengeful';

/** A queen's movement, used by Regal Stride and as the `queen` archetype base. */
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
  | 'empty_square';

export type Effect =
  | { kind: 'gain_aether'; amount: number }
  /** Destroys an enemy piece, but only one cheap enough to be smitten. */
  | { kind: 'destroy_enemy'; maxCost: number }
  | { kind: 'shield_friendly'; turns: number }
  | { kind: 'root_enemy'; turns: number }
  | { kind: 'grant_trait'; trait: Trait }
  | { kind: 'extra_move'; count: number }
  /** Moves a friendly piece to any empty square in the caster's own half. */
  | { kind: 'teleport_friendly' }
  /** Deploys a piece for free onto each chosen empty muster square. */
  | { kind: 'summon'; pieceId: PieceId }
  /** The crown moves as a queen for the rest of this turn. */
  | { kind: 'crown_stride' }
  /** The crown swaps places with any friendly piece. */
  | { kind: 'crown_swap' }
  /** Replaces the rest of the hand by cycling it to the back of the deck. */
  | { kind: 'recycle_hand' }
  /** Green: returns the oldest piece in your graveyard to a muster square. */
  | { kind: 'restore_grave' }
  /** Purple: promotes one of your pawns where it stands. */
  | { kind: 'evolve_pawn' }
  /** Blue: the piece digs in — untouchable and immobile, and stops blocking. */
  | { kind: 'submerge'; turns: number }
  /** Grants a piece an extra movement rule for the rest of the match. */
  | { kind: 'grant_rule'; rule: MoveRule }
  /** Destroys the targeted piece and everything around it. Crowns are spared. */
  | { kind: 'detonate'; radius: 'adjacent' | 'diagonal' }
  /** Shields every friendly piece sharing a rank with the target. */
  | { kind: 'shield_rank'; turns: number };

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
  /** Turns that must elapse between activations. */
  powerCooldown: number;
  powerName: string;
  power: EffectSpec;
  /** Per-crown adjustments applied at match start / deck validation. */
  modifiers: {
    startingAether?: number;
    musterLimit?: number;
    handSize?: number;
  };
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
  /** Turns remaining during which this piece cannot move. */
  rooted: number;
  /** Turns remaining during which this piece cannot be captured. */
  shielded: number;
  /**
   * Turns remaining dug in: untouchable and immobile, and — unlike a shield —
   * it stops blocking line of sight, so pieces slide straight over it.
   */
  submerged: number;
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
  /** Turns remaining before the crown power is available again. */
  powerCooldown: number;
  /** While >= the current turn, this player's crown moves as a queen. */
  strideUntilTurn: number;
  /** Once-per-turn faction passives that have already fired this turn. */
  passiveUsedOnTurn: number;
}

export type MatchStatus = 'active' | 'gold_wins' | 'shadow_wins' | 'draw';

export interface LogEntry {
  turn: number;
  side: Side;
  text: string;
}

export interface MatchState {
  /** Length NUM_SQUARES; null means empty. */
  board: (PieceInstance | null)[];
  players: Record<Side, PlayerState>;
  /** 1-based count of player turns taken so far, including the current one. */
  turn: number;
  active: Side;
  /** Each turn allows one move action and one card action. */
  movesLeft: number;
  cardsLeft: number;
  status: MatchStatus;
  seed: number;
  log: LogEntry[];
  nextUid: number;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'move'; from: Square; to: Square }
  | { type: 'deploy'; handIndex: number; to: Square }
  | { type: 'cast'; handIndex: number; targets: Square[] }
  | { type: 'power'; targets: Square[] }
  | { type: 'endTurn' };

export interface Deck {
  id: string;
  name: string;
  crownId: CrownId;
  /** Exactly DECK_SIZE card ids; duplicates allowed up to each card's maxCopies. */
  cards: CardId[];
}
