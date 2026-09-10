import type { ImageSourcePropType } from 'react-native';

import type { Archetype, FactionId, Side } from '@/engine';

/**
 * Hand-painted UI art, laid over the app's own glyph-and-colour chrome rather
 * than replacing it wholesale — a few well-chosen spots (the elixir gauge,
 * tab icons, a selection reticle) read far better as real art than as another
 * unicode character.
 */

/** Selection reticle — four corner brackets around a square target. */
export const RETICLE = require('../../assets/ui/reticle.png');

/** A card is about to cycle back into the deck. */
export const ICON_CYCLE = require('../../assets/ui/icon-cycle.png');
/** Tap instruction. */
export const ICON_CURSOR = require('../../assets/ui/icon-cursor.png');
/** Drag instruction. */
export const ICON_HAND = require('../../assets/ui/icon-hand.png');

export const ICON_HAMMER = require('../../assets/ui/icon-hammer.png');
export const ICON_LOG = require('../../assets/ui/icon-log.png');
export const ICON_MEAT = require('../../assets/ui/icon-meat.png');
export const ICON_COIN = require('../../assets/ui/icon-coin.png');
export const ICON_SHIELD = require('../../assets/ui/icon-shield.png');
export const ICON_SWORDS = require('../../assets/ui/icon-swords.png');
export const ICON_BANNER = require('../../assets/ui/icon-banner.png');

/** The Crown power's cooldown gauge: a plain wood pill, three slices. */
export const POWER_CAP_LEFT = require('../../assets/ui/power-cap-left.png');
export const POWER_MID = require('../../assets/ui/power-mid.png');
export const POWER_CAP_RIGHT = require('../../assets/ui/power-cap-right.png');
export const POWER_FILL = require('../../assets/ui/power-fill.png');

/** The thin ornamental rule printed under every panel heading. */
export const DIVIDER_CAP_LEFT = require('../../assets/ui/divider-cap-left.png');
export const DIVIDER_MID = require('../../assets/ui/divider-mid.png');
export const DIVIDER_CAP_RIGHT = require('../../assets/ui/divider-cap-right.png');

/** The elixir gauge's fill — a warm gradient that reads as "charge". */
export const ELIXIR_FILL = require('../../assets/ui/elixir-fill.png');
/** The elixir gauge's frame: a faction-coloured rivet cap, a plain wood
 *  plank (shared by every faction), and a plain pointed cap (also shared). */
export const ELIXIR_MID = require('../../assets/ui/elixir-mid.png');
export const ELIXIR_CAP_RIGHT = require('../../assets/ui/elixir-cap-right.png');

const ELIXIR_CAPS = [
  require('../../assets/ui/elixir-cap-0.png'),
  require('../../assets/ui/elixir-cap-1.png'),
  require('../../assets/ui/elixir-cap-2.png'),
  require('../../assets/ui/elixir-cap-3.png'),
  require('../../assets/ui/elixir-cap-4.png'),
];

/**
 * Which painted rivet cap a faction's elixir gauge wears. Only five colours
 * were painted, so the closest reads (not a literal palette match) carry the
 * rest: Everroot's forest green reads closest to the teal cap of anything on
 * offer. Humans wear the plain wood cap from the power gauge instead of a
 * colour — fitting for the one faction built to have no gimmick.
 */
const ELIXIR_CAP_BY_FACTION: Partial<Record<FactionId, ImageSourcePropType>> = {
  green: ELIXIR_CAPS[0],
  red: ELIXIR_CAPS[1],
  yellow: ELIXIR_CAPS[2],
  purple: ELIXIR_CAPS[3],
  blue: ELIXIR_CAPS[4],
};

export function elixirCapFor(factionId: FactionId): ImageSourcePropType {
  return ELIXIR_CAP_BY_FACTION[factionId] ?? POWER_CAP_LEFT;
}

/**
 * The small hanging pennant behind a player's Crown badge — a scrap of
 * parchment scroll with a coloured flag hanging from it, one colour per
 * faction. Humans fly the same shape desaturated to black-and-white
 * parchment, since no gimmick means no colour.
 */
const PENNANT_BY_FACTION: Record<FactionId, ImageSourcePropType> = {
  human: require('../../assets/ui/banners/small-human.png'),
  red: require('../../assets/ui/banners/small-red.png'),
  blue: require('../../assets/ui/banners/small-blue.png'),
  green: require('../../assets/ui/banners/small-green.png'),
  yellow: require('../../assets/ui/banners/small-yellow.png'),
  purple: require('../../assets/ui/banners/small-purple.png'),
};

export function pennantFor(factionId: FactionId): ImageSourcePropType {
  return PENNANT_BY_FACTION[factionId];
}

/**
 * Painted chess-piece figures, one per classic archetype in each side's
 * colour — light for gold, dark for shadow. Every faction's pawn, knight,
 * bishop, rook and queen share the same base silhouette on the printed
 * cards too, so standing figures in just two tones (rather than one per
 * faction) reads as the board, not the deck. Crowns fly the king figure,
 * since whatever a faction calls it, it is the piece that ends the match.
 * Fairy pieces (Nightrider, Mao, Grasshopper…) have no classic silhouette,
 * so they keep their own printed glyph.
 */
const PIECE_ART: Partial<Record<Archetype, Record<Side, ImageSourcePropType>>> = {
  pawn: {
    gold: require('../../assets/ui/pieces/pawn-light.png'),
    shadow: require('../../assets/ui/pieces/pawn-dark.png'),
  },
  knight: {
    gold: require('../../assets/ui/pieces/knight-light.png'),
    shadow: require('../../assets/ui/pieces/knight-dark.png'),
  },
  bishop: {
    gold: require('../../assets/ui/pieces/bishop-light.png'),
    shadow: require('../../assets/ui/pieces/bishop-dark.png'),
  },
  rook: {
    gold: require('../../assets/ui/pieces/rook-light.png'),
    shadow: require('../../assets/ui/pieces/rook-dark.png'),
  },
  queen: {
    gold: require('../../assets/ui/pieces/queen-light.png'),
    shadow: require('../../assets/ui/pieces/queen-dark.png'),
  },
  leader: {
    gold: require('../../assets/ui/pieces/king-light.png'),
    shadow: require('../../assets/ui/pieces/king-dark.png'),
  },
};

/** The native pixel size every piece figure was painted at — 1:2, standing tall. */
export const PIECE_ART_ASPECT = 16 / 32;

/** The figure for this archetype and side, or null for a fairy piece (glyph only). */
export function pieceArtFor(archetype: Archetype, side: Side): ImageSourcePropType | null {
  return PIECE_ART[archetype]?.[side] ?? null;
}
