import type { FactionDef } from '@/engine/types';

/**
 * The five faction colours.
 *
 * `paper` and `ink` are sampled straight from the printed card art so the
 * in-app card face matches the physical deck. Every faction fields its own
 * version of each chess archetype — the pawn you meet across the board is an
 * Orc Peon or a Dwarf Miner, never a generic pawn.
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'red',
    people: 'Orc',
    name: 'Bloodhorn Clans',
    theme: 'Aggressive',
    paper: '#8F4E39',
    ink: '#FFFFFF',
    crownId: 'orc_chieftain',
    passive: { kind: 'bloodlust' },
    passiveName: 'Bloodlust',
    passiveBlurb: 'The first of your pieces to capture each turn may immediately move again.',
    blurb:
      'High-risk, high-reward. Red trades pieces cheerfully and turns every capture into another swing.',
  },
  {
    id: 'blue',
    people: 'Dwarf',
    name: 'Deephold Kin',
    theme: 'Defensive',
    paper: '#4B5B79',
    ink: '#FFFFFF',
    crownId: 'dwarf_throne',
    passive: { kind: 'shieldwall' },
    passiveName: 'Shieldwall',
    passiveBlurb: 'Any of your pieces standing beside another friendly piece is armored.',
    blurb:
      'Slow, plated and immovable. Blue wins by making every exchange cost the enemy more than it costs them.',
  },
  {
    id: 'green',
    people: 'Elf',
    name: 'Everroot Court',
    theme: 'Regenerative',
    paper: '#4B795B',
    ink: '#FFFFFF',
    crownId: 'elf_queen',
    passive: { kind: 'regrowth', amount: 2 },
    passiveName: 'Regrowth',
    passiveBlurb: 'Gain 2 aether whenever one of your pieces is captured, and it joins your graveyard.',
    blurb:
      'Nothing green loses is gone for long. Bodies return from the graveyard and losses fund the next play.',
  },
  {
    id: 'yellow',
    people: 'Gnome',
    name: 'Clockwork Consortium',
    theme: 'Explosive',
    paper: '#C7B64A',
    ink: '#454545',
    crownId: 'gnome_engineer',
    passive: { kind: 'explosive_capture' },
    passiveName: 'Explosive Capture',
    passiveBlurb: 'When one of your pieces captures, enemy pieces diagonally beside the target are destroyed too.',
    blurb:
      'Fewer pieces, louder ones. Yellow turns a single capture into a crater — and does not always mind who is standing in it.',
  },
  {
    id: 'purple',
    people: 'Undead',
    name: 'Barrow Legion',
    theme: 'Swarm',
    paper: '#6B4B79',
    ink: '#FFFFFF',
    crownId: 'barrow_king',
    passive: { kind: 'undying' },
    passiveName: 'Undying',
    passiveBlurb: 'The first pawn you lose each turn claws its way back onto your muster row.',
    blurb:
      'A tide of cheap bodies that refuses to stay down. Purple wins on numbers and on pawns that stop being pawns.',
  },
];

export const factionById = (id: string): FactionDef => {
  const found = FACTIONS.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown faction "${id}".`);
  return found;
};
