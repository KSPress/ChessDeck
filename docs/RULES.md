# ChessDeck — rules

Constants named in brackets live in `src/engine/types.ts` and are the intended
balance knobs.

## Winning

Capture the enemy **Crown**. That is the only way to win outright — there is no
check, no checkmate and no castling.

Two things follow from that, and they matter:

- **A Crown may never move onto a square the enemy threatens.** This is chess's
  rule against moving into check. Without it a single mistimed tap ends the
  match, which is unreasonable on a phone. You can still *lose* your Crown by
  failing to answer a threat, so Crown capture stays a live win condition.
- If neither Crown falls within [`TURN_LIMIT`] = 100 player turns, the side with
  more material on the board wins; equal material is a draw.

## The board

6×6 [`BOARD_SIZE`]. Squares are named a1–f6 with rank 1 as your home rank. Your
**muster zone** is your own back two ranks [`MUSTER_DEPTH`] — the only squares
you may deploy onto.

Both players open with their Crown on its throne (c1 / c6) and three of their
faction's own pawns on the rank in front of it. The pawn shield is load-bearing:
the thrones face each other down the same file, so without it a Crown with a
queen's reach could take the enemy Crown on turn two.

## A turn

Each turn you get **one move action and one card action**, in either order, and
both are optional. Spending both ends your turn automatically.

At the start of your turn: your statuses tick down, you gain
[`AETHER_INCOME`] = 2 aether (capped at [`AETHER_CAP`] = 12), your Crown power
cools down by one, and you draw back up to your hand size.

**Aether** pays for deploying pieces, casting action cards and using your Crown
power. You start on [`AETHER_START`] = 3, before Crown modifiers.

## Deck and hand

A deck is exactly [`DECK_SIZE`] = 8 cards, all of your Crown's colour, within
that Crown's **muster limit** ([`DEFAULT_MUSTER_LIMIT`] = 20, modified per
Crown). Each card also has its own copy limit — 3 for cheap cards, 2 for
mid-cost, 1 for the most expensive.

The muster limit is what makes a deck of eight queens impossible rather than
merely unwise: eight Orc Warlords costs 48 against a budget of 20, and the copy
limit stops it before that.

Your deck **cycles**: a card you play returns to the back of the draw queue and
you draw back up to [`HAND_SIZE`] = 5. You never run out, and you always know
roughly what is coming.

## Pieces

A piece **deployed this turn cannot move this turn**. Without that rule you
could muster a long-reaching piece into your own back rank and snipe the enemy
Crown the same turn.

Pawns promote into **their own faction's knight** on reaching the far rank, and
keep any traits granted mid-match.

### Archetypes

Every faction fields one piece per archetype. The archetype sets the baseline
movement and the silhouette badge printed on the card; the faction may re-price
it, rename it and bend its movement.

| Archetype | Movement | Baseline cost |
| --- | --- | --- |
| Pawn | One square forward, captures forward-diagonally, promotes | 1 |
| Knight | The crooked leap, over anything | 3 |
| Bishop | Unlimited diagonals | 3 |
| Rook | Unlimited ranks and files | 4 |
| Queen | Unlimited in all eight directions | 6 |
| Signature | One unique piece per faction | varies |

### Traits

| Trait | Effect |
| --- | --- |
| `royal` | Losing this piece loses the match. Crowns only. |
| `promotes` | Becomes its faction's knight on the far rank. |
| `armored` | Cannot be captured by pieces costing [`ARMOR_PIERCE_COST`] = 1 or less. |
| `ethereal` | Slides straight through blockers. |
| `vengeful` | Whatever captures it is destroyed alongside it. |

### Statuses

| Status | Effect |
| --- | --- |
| Shielded | Cannot be captured or destroyed. |
| Rooted | Cannot move. |
| Bunkered | Cannot be captured *and* cannot move — and stops blocking line of sight, so pieces slide straight over it. |

Statuses tick down at the start of their owner's turn, so a one-turn shield
covers exactly the opponent's next turn.

## Crowns

Your Crown is your royal piece and your deck's identity. Each moves exactly as
printed on its card.

| Crown | Faction | Moves | Power | Modifier |
| --- | --- | --- | --- | --- |
| Orc Chieftain | Red | The knight's leap | **Warcry** — the next two captures this turn each pay an extra move | — |
| Dwarf Throne | Blue | One square left or right, and nothing else. Armored. | **Stoneform** — a friendly piece cannot be captured next turn | Muster limit 22 |
| Elf Queen | Green | The full queen's lines | **Restore** — return your longest-dead piece to a muster square | — |
| Gnome Engineer | Yellow | One square in any direction | **Lightning Strike** — destroy an enemy piece costing 3 or less | Starts on 5 aether |
| Barrow King | Purple | One square in any direction, or a two-square shamble forward | **Evolve** — promote one of your pawns where it stands | Hand of 6 |

Using a power costs aether *and* your card action for the turn, then goes on
cooldown.

## Extra moves

Several effects grant another move. All of them are **conditional on a capture**
and belong to **the piece that struck** — "move a piece, capture, then move *it*
again". Unconditional extra moves let a leaping Crown rush the enemy throne on
turn three, which is why the rule reads this way.

## Removal and the graveyard

Pieces you lose go to your **graveyard**, which green and purple cards return
from. Crowns never enter a graveyard — the match is over.

Nothing removes a Crown except a capture: `destroy_enemy` and `detonate` both
skip Crowns, shielded pieces and bunkered pieces.
