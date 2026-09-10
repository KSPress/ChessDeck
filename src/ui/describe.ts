import { factionById } from '@/content';
import { getPiece, type Card, type CrownDef, type Effect, type MoveRule, type Trait } from '@/engine';

/** "4500" -> "4.5s", "3000" -> "3s". */
function seconds(ms: number): string {
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
}

/** Plain-language description of a movement rule, for the card readout. */
export function describeMovement(rules: readonly MoveRule[]): string {
  const parts = rules.map((rule) => {
    if (rule.kind === 'pawn') {
      return `Steps ${rule.range} forward, captures forward-diagonally`;
    }
    if (rule.kind === 'leap') {
      const knightish = rule.offsets.some((o) => Math.abs(o.df) + Math.abs(o.dr) === 3);
      const camelish = rule.offsets.some((o) => Math.abs(o.df) + Math.abs(o.dr) === 4 && Math.abs(o.df) !== Math.abs(o.dr));
      if (knightish) return 'Leaps the knight’s move, over anything';
      if (camelish) return 'Leaps a long, lopsided line, over anything';
      const spread = Math.max(...rule.offsets.map((o) => Math.max(Math.abs(o.df), Math.abs(o.dr))));
      return spread >= 2 ? `Leaps ${spread} squares, over anything` : 'Leaps one square, over anything';
    }
    if (rule.kind === 'rider') {
      return `Rides the knight’s move again and again, up to ${rule.range} hops`;
    }
    if (rule.kind === 'bentLeap') {
      return 'Steps one square, then angles outward — blocked at the elbow';
    }
    if (rule.kind === 'hopper') {
      return 'Rides to the first piece in a line, then hops just past it';
    }
    const dirs = rule.dirs.length;
    const shape =
      dirs === 8
        ? 'any direction'
        : dirs === 4 && rule.dirs.every((d) => d.df === 0 || d.dr === 0)
          ? 'ranks and files'
          : dirs === 4
            ? 'diagonals'
            : dirs === 2
              ? 'left and right'
              : `${dirs} directions`;
    const reach = rule.range >= 5 ? 'Unlimited' : `Up to ${rule.range}`;
    return `${reach} along ${shape}`;
  });
  return parts.join(' · ');
}

const TRAIT_TEXT: Record<Trait, string> = {
  royal: 'Royal — lose this and you lose the match',
  promotes: 'Promotes to your faction’s knight on the far rank',
  armored: 'Armored — cannot be captured by cost-1 pieces',
  ethereal: 'Ethereal — slides straight through blockers',
  vengeful: 'Vengeful — whatever captures it dies too',
  immutable: 'Immutable — can never be captured, moved, or moved onto',
  explosive: 'Explosive — its killer, and anything beside it, goes with it',
  reaper: 'Reaper — a chance to also convert an adjacent enemy pawn on capture',
};

export const describeTrait = (trait: Trait): string => TRAIT_TEXT[trait];

/** Plain-language description of what an action card or crown power does. */
export function describeEffect(effect: Effect): string {
  switch (effect.kind) {
    case 'gain_aether':
      return `Gain ${effect.amount} aether`;
    case 'destroy_enemy':
      return `Destroy an enemy piece costing ${effect.maxCost} or less`;
    case 'shield_friendly':
      return `A friendly piece cannot be captured for ${seconds(effect.ms)}`;
    case 'shield_rank':
      return `Every friendly piece on that rank is shielded for ${seconds(effect.ms)}`;
    case 'root_enemy':
      return `An enemy piece cannot move for ${seconds(effect.ms)}`;
    case 'submerge':
      return `Dig in for ${seconds(effect.ms)}: untouchable, immobile, and no longer blocking`;
    case 'grant_trait':
      return `Grants ${effect.trait} for the rest of the match`;
    case 'grant_rule':
      return `Teaches a new way to move: ${describeMovement([effect.rule])}`;
    case 'refund_cooldown':
      return 'That piece is ready to act again at once';
    case 'strike_on_capture':
      return `Your next ${effect.count} capture(s) let that piece act again at once`;
    case 'detonate':
      return 'Destroys the target and everything around it — Crowns are spared';
    case 'evolve_pawn':
      return 'Promotes one of your pawns where it stands';
    case 'restore_grave':
      return 'Returns your longest-dead piece to an empty muster square';
    case 'teleport_friendly':
      return 'Relocates a friendly piece to a square you choose';
    case 'blink':
      return 'Moves a piece anywhere along its own lines, straight through blockers';
    case 'vanish':
      return `Untargetable for ${seconds(effect.ms)} — but cannot capture while hidden`;
    case 'summon':
      return `Musters ${getPiece(effect.pieceId).name} for free`;
    case 'grant_harvest':
      return 'Your next capture rises as a full undead version of what it takes';
    case 'recycle_hand':
      return 'Cycle your hand to the bottom of the deck and draw fresh';
    default:
      return '';
  }
}

export interface CardReadout {
  name: string;
  /** e.g. "Orc · Knight" or "Orc · Action". */
  kicker: string;
  cost: number | null;
  /** The mechanical lines — movement, traits, effect. */
  lines: string[];
  /** The flavour line printed on the card. */
  blurb: string;
  /** How many targets the player must pick after playing it. */
  targetCount: number;
  factionId: string;
}

const ARCHETYPE_LABEL: Record<string, string> = {
  pawn: 'Pawn',
  knight: 'Knight',
  bishop: 'Bishop',
  rook: 'Rook',
  queen: 'Queen',
  fairy: 'Fairy',
  leader: 'Crown',
};

export function readCard(card: Card): CardReadout {
  const faction = factionById(card.factionId);

  if (card.kind === 'piece') {
    const piece = getPiece(card.pieceId);
    return {
      name: card.name,
      kicker: `${faction.people} · ${ARCHETYPE_LABEL[card.archetype] ?? 'Piece'}`,
      cost: card.cost,
      lines: [describeMovement(piece.rules), ...piece.traits.map(describeTrait)],
      blurb: card.blurb,
      targetCount: 0,
      factionId: card.factionId,
    };
  }

  return {
    name: card.name,
    kicker: `${faction.people} · Action`,
    cost: card.cost,
    lines: [describeEffect(card.spec.effect)],
    blurb: card.blurb,
    targetCount: card.spec.slots.length,
    factionId: card.factionId,
  };
}

export function readCrown(crown: CrownDef): CardReadout {
  const faction = factionById(crown.factionId);
  return {
    name: crown.name,
    kicker: `${faction.people} · Crown`,
    cost: null,
    lines: [
      describeMovement(crown.rules),
      ...crown.traits.filter((t) => t !== 'royal').map(describeTrait),
      `${crown.powerName} (${crown.powerCost} aether, ${seconds(crown.powerCooldownMs)} cooldown): ${describeEffect(crown.power.effect)}`,
    ],
    blurb: crown.blurb,
    targetCount: crown.power.slots.length,
    factionId: crown.factionId,
  };
}
