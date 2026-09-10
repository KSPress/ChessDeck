export type CosmeticKind = 'board' | 'pieceSet' | 'banner' | 'emote';
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Currency = 'coins' | 'gems';

export interface BoardTheme {
  light: string;
  dark: string;
  /** Highlight used for legal-move dots and selection rings. */
  accent: string;
  /** Board border / frame colour. */
  frame: string;
}

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  rarity: CosmeticRarity;
  price: { currency: Currency; amount: number };
  /** Board skins carry real colours so the store preview is the actual board. */
  theme?: BoardTheme;
  /** Banners and emotes just need a glyph and a colour to render. */
  glyph?: string;
  color?: string;
}

export const DEFAULT_BOARD_ID = 'board_obsidian';

export const COSMETICS: Cosmetic[] = [
  {
    id: DEFAULT_BOARD_ID,
    kind: 'board',
    name: 'Obsidian Court',
    blurb: 'The default field of play. Cold stone, warm gold.',
    rarity: 'common',
    price: { currency: 'coins', amount: 0 },
    theme: { light: '#2E2A44', dark: '#211E33', accent: '#F0B429', frame: '#0B0A14' },
  },
  {
    id: 'board_verdant',
    kind: 'board',
    name: 'Verdant Hollow',
    blurb: 'Moss over old stone, lit by something under the roots.',
    rarity: 'rare',
    price: { currency: 'coins', amount: 1200 },
    theme: { light: '#27402F', dark: '#1B2E22', accent: '#7BE38A', frame: '#0A140D' },
  },
  {
    id: 'board_ember',
    kind: 'board',
    name: 'Emberforge',
    blurb: 'Cut from a cooling anvil. The squares still glow at the seams.',
    rarity: 'epic',
    price: { currency: 'gems', amount: 480 },
    theme: { light: '#46251F', dark: '#331A16', accent: '#FF7A45', frame: '#170A08' },
  },
  {
    id: 'board_astral',
    kind: 'board',
    name: 'Astral Lattice',
    blurb: 'A board that is mostly a suggestion of a board.',
    rarity: 'legendary',
    price: { currency: 'gems', amount: 900 },
    theme: { light: '#2B2B5C', dark: '#1C1B40', accent: '#8FB8FF', frame: '#0A0A1F' },
  },
  {
    id: 'pieces_bone',
    kind: 'pieceSet',
    name: 'Bonewrought Host',
    blurb: 'Every piece carved from something that used to argue.',
    rarity: 'epic',
    price: { currency: 'gems', amount: 520 },
    color: '#E8E0CF',
  },
  {
    id: 'pieces_gilded',
    kind: 'pieceSet',
    name: 'Gilded Regalia',
    blurb: 'Ostentatious. Intentionally so.',
    rarity: 'rare',
    price: { currency: 'coins', amount: 1500 },
    color: '#F0B429',
  },
  {
    id: 'banner_wolf',
    kind: 'banner',
    name: 'Banner of the Grey Wolf',
    blurb: 'Flown by players who take the long game.',
    rarity: 'rare',
    price: { currency: 'coins', amount: 800 },
    glyph: '🐺',
    color: '#8894A8',
  },
  {
    id: 'banner_crown',
    kind: 'banner',
    name: 'Banner of the Broken Crown',
    blurb: 'Awarded for a Crown capture on the opening five turns.',
    rarity: 'legendary',
    price: { currency: 'gems', amount: 1100 },
    glyph: '👑',
    color: '#F0B429',
  },
  {
    id: 'emote_bow',
    kind: 'emote',
    name: 'Courtly Bow',
    blurb: 'For when you win and want to be gracious about it.',
    rarity: 'common',
    price: { currency: 'coins', amount: 300 },
    glyph: '🎩',
    color: '#B9A7FF',
  },
  {
    id: 'emote_hourglass',
    kind: 'emote',
    name: 'Hurry Along',
    blurb: 'For when you win and do not want to be gracious about it.',
    rarity: 'common',
    price: { currency: 'coins', amount: 300 },
    glyph: '⏳',
    color: '#FF7A45',
  },
];

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export function boardThemeById(id: string): BoardTheme {
  const found = cosmeticById(id)?.theme;
  if (found) return found;
  // Falls back to the default board so an unowned/renamed skin never blanks the field.
  return cosmeticById(DEFAULT_BOARD_ID)!.theme!;
}
