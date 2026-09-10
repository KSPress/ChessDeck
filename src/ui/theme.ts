import { Platform } from 'react-native';

/**
 * ChessDeck is meant to look like a game you'd find on a table in a tavern:
 * dark stained oak, brass fittings, parchment cards and candlelight. The
 * neutrals are all warm — brown-biased rather than grey — so nothing on screen
 * reads as a generic dark-mode app.
 */
export const colors = {
  /** Soot-blackened timber, the ground everything sits on. */
  bg: '#14100B',
  /** Stained oak panelling. */
  surface: '#221A12',
  /** A raised board or a lighter plank. */
  surfaceAlt: '#2E2318',
  border: '#3B2C1E',
  borderBright: '#57402A',

  /** Parchment, and the candlelight falling off it. */
  text: '#F2E6CC',
  textMuted: '#B69C74',
  textDim: '#867054',

  /** Brass — lamp fittings, coin, the accent that carries the whole app. */
  gold: '#D9A441',
  goldDim: '#7A5A20',
  /** The colour of whatever is sitting across the table from you. */
  shadow: '#9B7BD4',
  shadowDim: '#4C3A6B',

  success: '#8FB662',
  danger: '#C9552E',
  /** Aether reads cold against all that warmth, which is the point. */
  aether: '#6ECBE0',

  rarity: {
    common: '#B69C74',
    rare: '#6ECBE0',
    epic: '#9B7BD4',
    legendary: '#D9A441',
  },
} as const;

/** Warm translucent washes used for glows and pressed states. */
export const glow = {
  brass: 'rgba(217, 164, 65, 0.22)',
  brassStrong: 'rgba(217, 164, 65, 0.45)',
  ember: 'rgba(201, 85, 46, 0.28)',
  ink: 'rgba(0, 0, 0, 0.45)',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** The display face the player supplied; loaded in app/_layout.tsx. */
export const DISPLAY_FONT = 'Minera';

export const fonts = {
  /** Every title, heading, button and card name. */
  display: DISPLAY_FONT,
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }),
} as const;

export const text = {
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    letterSpacing: 0.4,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 21,
    color: colors.text,
    letterSpacing: 0.3,
  },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  tiny: { fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
  /** Small caps-ish label for stat rows and section markers. */
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    fontWeight: '700' as const,
  },
} as const;

/** Side colours, used for pieces, banners and turn indicators. */
export function sideColor(side: 'gold' | 'shadow'): string {
  return side === 'gold' ? colors.gold : colors.shadow;
}
