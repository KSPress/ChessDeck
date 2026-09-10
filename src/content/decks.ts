import type { Deck } from '@/engine/types';

/**
 * One preset deck per faction. Each is mono-faction, legal under its crown's
 * muster limit, and doubles as the tutorial for what that colour wants to do.
 */
export const STARTER_DECKS: Deck[] = [
  {
    id: 'starter_red',
    name: 'Bloodhorn Charge',
    crownId: 'orc_chieftain',
    cards: [
      'red_pawn',
      'red_pawn',
      'red_signature',
      'red_signature',
      'red_knight',
      'red_knight',
      'red_rook',
      'red_double_strike',
    ],
  },
  {
    id: 'starter_blue',
    name: 'Deephold Wall',
    crownId: 'dwarf_throne',
    cards: [
      'blue_pawn',
      'blue_pawn',
      'blue_signature',
      'blue_signature',
      'blue_rook',
      'blue_knight',
      'blue_shield_wall',
      'blue_bunker',
    ],
  },
  {
    id: 'starter_green',
    name: 'Everroot Cycle',
    crownId: 'elf_queen',
    cards: [
      'green_pawn',
      'green_pawn',
      'green_pawn',
      'green_signature',
      'green_signature',
      'green_queen',
      'green_restore',
      'green_roots',
    ],
  },
  {
    id: 'starter_yellow',
    name: 'Clockwork Detonation',
    crownId: 'gnome_engineer',
    cards: [
      'yellow_pawn',
      'yellow_pawn',
      'yellow_pawn',
      'yellow_signature',
      'yellow_signature',
      'yellow_knight',
      'yellow_chaos',
      'yellow_lightning',
    ],
  },
  {
    id: 'starter_purple',
    name: 'Barrow Tide',
    crownId: 'barrow_king',
    cards: [
      'purple_pawn',
      'purple_pawn',
      'purple_pawn',
      'purple_signature',
      'purple_signature',
      'purple_queen',
      'purple_grave_leap',
      'purple_raise',
    ],
  },
];
