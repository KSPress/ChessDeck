import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { COSMETICS, DEFAULT_BOARD_ID, cosmeticById } from '@/content';

export interface Equipped {
  board: string;
  pieceSet: string | null;
  banner: string | null;
}

interface ProfileState {
  name: string;
  coins: number;
  gems: number;
  trophies: number;
  pveWins: number;
  pveLosses: number;
  owned: string[];
  equipped: Equipped;

  rename: (name: string) => void;
  purchase: (cosmeticId: string) => { ok: boolean; reason?: string };
  equip: (cosmeticId: string) => void;
  /** Records a finished PVE match and pays out the reward. */
  recordPveResult: (won: boolean) => { coins: number; trophies: number };
}

/** Free cosmetics are owned from the start so the board always has a skin. */
const STARTING_OWNED = COSMETICS.filter((c) => c.price.amount === 0).map((c) => c.id);

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      name: 'Challenger',
      coins: 2500,
      gems: 250,
      trophies: 0,
      pveWins: 0,
      pveLosses: 0,
      owned: STARTING_OWNED,
      equipped: { board: DEFAULT_BOARD_ID, pieceSet: null, banner: null },

      rename: (name) => set({ name: name.trim().slice(0, 20) || 'Challenger' }),

      purchase: (cosmeticId) => {
        const cosmetic = cosmeticById(cosmeticId);
        if (!cosmetic) return { ok: false, reason: 'Unknown item.' };

        const { owned, coins, gems } = get();
        if (owned.includes(cosmeticId)) return { ok: false, reason: 'Already owned.' };

        const balance = cosmetic.price.currency === 'coins' ? coins : gems;
        if (balance < cosmetic.price.amount) {
          return { ok: false, reason: `Not enough ${cosmetic.price.currency}.` };
        }

        set({
          owned: [...owned, cosmeticId],
          ...(cosmetic.price.currency === 'coins'
            ? { coins: coins - cosmetic.price.amount }
            : { gems: gems - cosmetic.price.amount }),
        });
        return { ok: true };
      },

      equip: (cosmeticId) => {
        const cosmetic = cosmeticById(cosmeticId);
        if (!cosmetic || !get().owned.includes(cosmeticId)) return;
        const equipped = { ...get().equipped };

        if (cosmetic.kind === 'board') equipped.board = cosmeticId;
        else if (cosmetic.kind === 'pieceSet') {
          equipped.pieceSet = equipped.pieceSet === cosmeticId ? null : cosmeticId;
        } else if (cosmetic.kind === 'banner') {
          equipped.banner = equipped.banner === cosmeticId ? null : cosmeticId;
        } else return; // Emotes are equipped from the match screen, not here.

        set({ equipped });
      },

      recordPveResult: (won) => {
        const reward = won ? { coins: 120, trophies: 8 } : { coins: 30, trophies: 0 };
        set((s) => ({
          coins: s.coins + reward.coins,
          trophies: s.trophies + reward.trophies,
          pveWins: s.pveWins + (won ? 1 : 0),
          pveLosses: s.pveLosses + (won ? 0 : 1),
        }));
        return reward;
      },
    }),
    {
      name: 'chessdeck.profile.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
