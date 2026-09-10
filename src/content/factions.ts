import type { FactionDef } from '@/engine/types';

/**
 * The six factions.
 *
 * `paper` and `ink` are sampled straight from the printed card art (Humans
 * have no printed reference yet, so theirs is an original steel-and-parchment
 * palette that keeps them visually distinct from all five colour factions).
 * Every faction fields its own version of each chess archetype — the pawn you
 * meet across the board is an Orc Peon or a Dwarf Miner, never a generic pawn
 * — and, Humans excepted, exactly two fairy pieces drawn from real fairy-chess
 * tradition.
 *
 * Economy is a second axis of identity, on top of the crown: Dwarves buy a
 * faster flow of aether with a crown that barely moves; Elves buy the only
 * true queen left in the game with a slower one. Orcs stay cheap card-by-card
 * rather than through their regen rate. Undead run on a different axis
 * altogether — Harvest, not aether, is their economy.
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'human',
    people: 'Human',
    name: 'Freehold Banners',
    theme: 'Balanced',
    paper: '#7A6A52',
    ink: '#F5EFE0',
    crownId: 'human_king',
    passive: { kind: 'none' },
    passiveName: 'No Gimmick',
    passiveBlurb: 'No faction passive, no fairy pieces. The baseline every other colour is measured against.',
    blurb:
      'Closest to classic chess of anyone at the table. Nothing here surprises you — which is the whole appeal in Normal Play.',
  },
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
    passiveBlurb: 'Any capture refunds that piece’s cooldown at once — strike, and be ready to strike again.',
    blurb:
      'High-risk, high-reward. Red trades pieces cheerfully and turns every capture into another swing, deck built cheap so there is always another body to throw.',
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
      'Slow, plated and immovable. The Throne barely moves, but the hold’s aether runs a quarter faster to make up for it.',
  },
  {
    id: 'green',
    people: 'Elf',
    name: 'Everroot Court',
    theme: 'Precision',
    paper: '#4B795B',
    ink: '#FFFFFF',
    crownId: 'elf_queen',
    passive: { kind: 'regrowth', amount: 2 },
    passiveName: 'Regrowth',
    passiveBlurb: 'Gain 2 aether whenever one of your pieces is captured, and it joins your graveyard.',
    blurb:
      'The only true queen left in the game, paid for with a slower flow of aether. Precise, evasive, and one bad trade from losing everything.',
  },
  {
    id: 'yellow',
    people: 'Gnome',
    name: 'Clockwork Consortium',
    theme: 'Spellcraft',
    paper: '#C7B64A',
    ink: '#454545',
    crownId: 'gnome_engineer',
    passive: { kind: 'explosive_capture' },
    passiveName: 'Explosive Capture',
    passiveBlurb: 'When one of your pieces captures, enemy pieces diagonally beside the target are destroyed too.',
    deployNearCrown: true,
    blurb:
      'Fewer pieces, louder ones. Every automaton but the Engineer himself has to be built standing next to him — this is a workshop, not an army.',
  },
  {
    id: 'purple',
    people: 'Undead',
    name: 'Barrow Legion',
    theme: 'Conversion',
    paper: '#6B4B79',
    ink: '#FFFFFF',
    crownId: 'barrow_king',
    passive: { kind: 'harvest' },
    passiveName: 'Harvest',
    passiveBlurb:
      'A piece your Undead capture doesn’t die — it rises as a zombie under your control, still facing the way it used to.',
    blurb:
      'Runs on a different economy entirely: not aether income, but every capture turned into another body on your own side of the line.',
  },
];

export const factionById = (id: string): FactionDef => {
  const found = FACTIONS.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown faction "${id}".`);
  return found;
};
