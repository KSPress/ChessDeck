import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CROWNS, STARTER_DECKS } from '@/content';
import { validateDeck } from '@/engine';
import type { Deck } from '@/engine';

interface DecksState {
  decks: Deck[];
  activeDeckId: string;

  setActive: (id: string) => void;
  save: (deck: Deck) => void;
  remove: (id: string) => void;
  /** Creates an empty deck for a crown and returns its id. */
  createBlank: (crownId?: string) => string;
}

function firstStarterId(): string {
  return STARTER_DECKS[0]?.id ?? 'starter_iron';
}

export const useDecks = create<DecksState>()(
  persist(
    (set, get) => ({
      decks: STARTER_DECKS.map((d) => ({ ...d, cards: [...d.cards] })),
      activeDeckId: firstStarterId(),

      setActive: (id) => {
        if (get().decks.some((d) => d.id === id)) set({ activeDeckId: id });
      },

      save: (deck) =>
        set((s) => {
          const index = s.decks.findIndex((d) => d.id === deck.id);
          const decks = [...s.decks];
          if (index === -1) decks.push(deck);
          else decks[index] = deck;
          return { decks };
        }),

      remove: (id) =>
        set((s) => {
          // Never leave the player with nothing to play.
          if (s.decks.length <= 1) return s;
          const decks = s.decks.filter((d) => d.id !== id);
          const activeDeckId = s.activeDeckId === id ? (decks[0] as Deck).id : s.activeDeckId;
          return { decks, activeDeckId };
        }),

      createBlank: (crownId) => {
        const id = `deck_${Date.now().toString(36)}`;
        const deck: Deck = {
          id,
          name: 'New Deck',
          crownId: crownId ?? (CROWNS[0]?.id as string),
          cards: [],
        };
        set((s) => ({ decks: [...s.decks, deck] }));
        return id;
      },
    }),
    {
      name: 'chessdeck.decks.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** The deck the player takes into a match — falls back if the active one is illegal. */
export function useBattleDeck(): Deck {
  const { decks, activeDeckId } = useDecks();
  const active = decks.find((d) => d.id === activeDeckId);
  if (active && validateDeck(active).valid) return active;
  return decks.find((d) => validateDeck(d).valid) ?? (STARTER_DECKS[0] as Deck);
}
