/**
 * Faction balance probe.
 *
 * Not a pass/fail test — it plays every starter deck against every other at a
 * range of seeds and reports win rates and match lengths, so a balance change
 * can be measured instead of guessed at. Skipped by default because it takes
 * far longer than the real suite.
 *
 *     npm run balance
 */
import { describe, it } from 'vitest';

import '@/content';
import { STARTER_DECKS } from '@/content';
import { playAiTurn } from '@/engine/ai';
import { validateDeck } from '@/engine/deck';
import { createMatch } from '@/engine/match';
import { TURN_LIMIT, type Deck } from '@/engine/types';
import type { Difficulty } from '@/engine/ai';

const SEEDS = [11, 23, 37, 59, 71, 97, 131, 157];
const DIFFICULTY: Difficulty = 'knight';

describe.runIf(process.env.BALANCE === '1')('balance probe', () => {
  it(
    'reports win rates across every faction pairing',
    () => {
      for (const deck of STARTER_DECKS) {
        const check = validateDeck(deck);
        console.log(
          `deck  ${deck.name.padEnd(22)} ${String(check.totalCost).padStart(2)}/${check.musterLimit} muster` +
            `${check.valid ? '' : '  INVALID: ' + check.errors.join('; ')}`,
        );
      }

      const wins: Record<string, number> = {};
      const plays: Record<string, number> = {};
      let turns = 0;
      let games = 0;
      let quick = 0;
      let draws = 0;

      for (const gold of STARTER_DECKS) {
        for (const shadow of STARTER_DECKS) {
          if (gold.id === shadow.id) continue;
          for (const seed of SEEDS) {
            let state = createMatch({ goldDeck: gold as Deck, shadowDeck: shadow as Deck, seed });
            let guard = 0;
            while (state.status === 'active' && guard < TURN_LIMIT + 5) {
              state = playAiTurn(state, DIFFICULTY);
              guard += 1;
            }

            for (const id of [gold.crownId, shadow.crownId]) plays[id] = (plays[id] ?? 0) + 1;
            if (state.status === 'gold_wins') wins[gold.crownId] = (wins[gold.crownId] ?? 0) + 1;
            if (state.status === 'shadow_wins') wins[shadow.crownId] = (wins[shadow.crownId] ?? 0) + 1;
            if (state.status === 'draw') draws += 1;

            turns += state.turn;
            games += 1;
            // Anything this short was decided by a rush or a blunder, not play.
            if (state.turn <= 6) quick += 1;
          }
        }
      }

      console.log(
        `\n${games} games · average ${(turns / games).toFixed(1)} turns · ` +
          `${quick} decided by turn 6 (${((quick / games) * 100).toFixed(0)}%) · ${draws} draws`,
      );
      for (const crown of Object.keys(plays).sort()) {
        const rate = ((wins[crown] ?? 0) / (plays[crown] as number)) * 100;
        console.log(`  ${crown.padEnd(16)} ${rate.toFixed(0).padStart(3)}% of ${plays[crown]} games`);
      }
    },
    600_000,
  );
});
