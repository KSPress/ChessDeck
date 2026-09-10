import { Platform } from 'react-native';

/** One dark fantasy palette, used by every screen. */
export const colors = {
  bg: '#0B0A14',
  surface: '#16142A',
  surfaceAlt: '#1E1B38',
  border: '#2A2545',
  borderBright: '#3B3466',

  text: '#EDE9F5',
  textMuted: '#9A93B8',
  textDim: '#6B6590',

  gold: '#F0B429',
  goldDim: '#8A6716',
  shadow: '#B47CFF',
  shadowDim: '#5A3A8A',

  success: '#5CD68A',
  danger: '#FF6B6B',
  aether: '#6FD3FF',

  rarity: {
    common: '#9A93B8',
    rare: '#6FD3FF',
    epic: '#B47CFF',
    legendary: '#F0B429',
  },
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

/** A serif-ish face for headings keeps the fantasy register without a font file. */
export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, sans-serif' }),
} as const;

export const text = {
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700' as const, color: colors.text },
  heading: { fontFamily: fonts.display, fontSize: 19, fontWeight: '700' as const, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  tiny: { fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
} as const;

/** Side colours, used for pieces, banners and turn indicators. */
export function sideColor(side: 'gold' | 'shadow'): string {
  return side === 'gold' ? colors.gold : colors.shadow;
}
