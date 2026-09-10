import type { Deck } from '@/engine/types';

/**
 * One preset deck per faction. Each is mono-faction and doubles as the
 * tutorial for what that colour wants to do. There is no deck-wide cost cap —
 * a heavier deck already pays for itself in slower aether-funded deployment —
 * so these lean into each faction's identity rather than hitting a budget.
 */
export const STARTER_DECKS: Deck[] = [
  {
    id: 'starter_human',
    name: 'Freehold Muster',
    crownId: 'human_king',
    cards: [
      'human_pawn',
      'human_pawn',
      'human_pawn',
      'human_knight',
      'human_knight',
      'human_rook',
      'human_queen',
      'human_barricade',
    ],
  },
  {
    id: 'starter_red',
    name: 'Bloodhorn Charge',
    crownId: 'orc_chieftain',
    cards: [
      'red_pawn',
      'red_pawn',
      'red_fairy0',
      'red_fairy1',
      'red_fairy1',
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
      'blue_fairy1',
      'blue_fairy1',
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
      'green_fairy0',
      'green_knight',
      'green_rook',
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
      'yellow_fairy1',
      'yellow_fairy1',
      'yellow_rook',
      'yellow_knight',
      'yellow_detonate',
      'yellow_chaos',
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
      'purple_fairy0',
      'purple_queen',
      'purple_harvest',
      'purple_grave_leap',
      'purple_restless',
    ],
  },
];
