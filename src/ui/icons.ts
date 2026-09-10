import type { ImageSourcePropType } from 'react-native';

import type { FactionId } from '@/engine';

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
