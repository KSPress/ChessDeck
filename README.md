# ChessDeck

A fantasy chess-based competitive card game for mobile. You pick a **Crown**,
build a deck of **8 cards** in that Crown's colour, and fight a fast match on a
**6×6 board** where capturing the enemy Crown wins outright.

Every faction fields its own version of each chess archetype — red's pawn is an
Orc Peon, blue's is a Dwarf Miner — so the pieces you meet tell you who you are
fighting before you read a single card.

<!-- The rules in full live in docs/RULES.md. -->

## Running it

```bash
npm install
npm start          # Expo dev server — press i / a, or scan the QR code
npm run web        # or run it in a browser
```

Other scripts:

```bash
npm test           # engine test suite (fast, no emulator needed)
npm run typecheck  # tsc --noEmit
npm run balance    # faction balance probe — see "Tuning" below
```

## The five factions

| Colour | House | People | Identity | Passive |
| --- | --- | --- | --- | --- |
| Red | Bloodhorn Clans | Orc | Aggressive | **Bloodlust** — the first piece to capture each turn may move again |
| Blue | Deephold Kin | Dwarf | Defensive | **Shieldwall** — pieces standing beside a friendly piece are armored |
| Green | Everroot Court | Elf | Regenerative | **Regrowth** — gain 2 aether whenever you lose a piece |
| Yellow | Clockwork Consortium | Gnome | Explosive | **Explosive Capture** — your captures destroy enemies on the target's diagonals |
| Purple | Barrow Legion | Undead | Swarm | **Undying** — the first pawn you lose each turn returns to your muster row |

Decks are **mono-faction**: your Crown sets your colour and all 8 cards must
match it. `validateDeck(deck, { allowCrossFaction: true })` relaxes that, which
is the hook for the planned Rainbow mode.

## Layout

```
app/                    expo-router routes
  (tabs)/               Store · Decks · Play · Arena · Guild
  deck/[id].tsx         deck builder
  match.tsx             the match screen
src/
  engine/               the rules, as pure TypeScript — no React, no I/O
  content/              factions, pieces, crowns, cards, cosmetics (data only)
  state/                zustand stores (profile, decks, live match)
  ui/                   theme, card face, board, shared components
  tools/                the balance probe
```

The engine is deliberately framework-free and fully deterministic: it takes a
`MatchState` and an `Action` and returns a new `MatchState`. That is what lets
the same code referee an authoritative PVP match server-side later, rather than
maintaining a second implementation that has to agree with this one.

Content registers itself into `src/engine/registry.ts` on import, so anything
touching the engine should `import '@/content'` first. Lookups throw a named
error rather than returning `undefined`, so a missing registration fails at the
call site instead of corrupting a match.

## What is playable, and what is not

**Playable now:** the full rules engine, deck building against real legality
rules, PVE against a heuristic AI at three difficulties, the cosmetic store,
and the Arena's Mirror Duel (your deck against itself).

**Not built:** ranked matchmaking and guilds. Both need accounts and a server;
those two tabs ship as the designed shells and say so on screen rather than
pretending to work. Nothing in them is fake data presented as real.

## Tuning

Balance levers are deliberately concentrated in data, not logic:

- Card and piece costs, and the per-card copy limits, in `src/content/`
- The deck budget (`DEFAULT_MUSTER_LIMIT`) and each Crown's `modifiers`
- Economy constants (`AETHER_START`, `AETHER_INCOME`, `AETHER_CAP`) and
  `HAND_SIZE`, all in `src/engine/types.ts`

`npm run balance` plays all twenty faction pairings across eight seeds and
reports win rates and match length. Most recent run:

```
160 games · average 39.8 turns · 16 decided by turn 6 (10%) · 0 draws
  barrow_king       67%      elf_queen         30%
  dwarf_throne      38%      gnome_engineer    47%
  orc_chieftain     69%
```

Red and purple are ahead and green is behind; that spread wants human
playtesting rather than more AI self-play, but the probe makes any change
measurable instead of guessed at.
