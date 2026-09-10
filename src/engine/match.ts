import {
  ALL_DIRECTIONS,
  DIAGONAL,
  forwardOf,
  isMusterSquare,
  isOwnHalf,
  promotionRank,
  rankOf,
  shift,
  squareName,
} from './board';
import {
  blinkDestinations,
  canCapture,
  canMove,
  findCrown,
  generateMovesForPiece,
  pieceAt,
  piecesOf,
} from './movement';
import { getCard, getCrown, getFaction, getPiece } from './registry';
import { makeRng, shuffle } from './rng';
import {
  AETHER_CAP,
  AETHER_MS_PER_POINT,
  AETHER_START,
  DEPLOY_COOLDOWN_MULTIPLIER,
  DOUBLE_AETHER_AT_MS,
  HAND_SIZE,
  MATCH_LENGTH_MS,
  NUM_SQUARES,
  opponentOf,
  SIDES,
  type Action,
  type Deck,
  type Effect,
  type EffectSpec,
  type MatchState,
  type PieceInstance,
  type PlayerState,
  type Side,
  type Square,
  type TargetSlot,
  type Trait,
} from './types';


const crownPieceIdFor = (crownId: string) => `crown:${crownId}`;

export interface MatchSetup {
  goldDeck: Deck;
  shadowDeck: Deck;
  seed?: number;
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

function makePlayer(side: Side, deck: Deck, rng: () => number): PlayerState {
  const crown = getCrown(deck.crownId);
  return {
    side,
    crownId: deck.crownId,
    factionId: crown.factionId,
    aether: crown.modifiers.startingAether ?? AETHER_START,
    deck: shuffle(deck.cards, rng),
    hand: [],
    handSize: crown.modifiers.handSize ?? HAND_SIZE,
    graveyard: [],
    powerReadyAtMs: 0,
    aetherRate: crown.modifiers.aetherRate ?? 1,
    pendingStrikes: 0,
    harvestCharges: 0,
    crownPlaced: false,
  };
}

function spawn(
  state: MatchState,
  pieceId: string,
  owner: Side,
  square: Square,
  crownId?: string,
  /** Pieces mustered mid-match rest before they can act; starting ones do not. */
  restFor = 0,
  /** Undead zombies keep their original owner's facing — see PieceInstance.reversed. */
  reversed = false,
): PieceInstance {
  const def = getPiece(pieceId);
  const piece: PieceInstance = {
    uid: state.nextUid,
    pieceId,
    owner,
    square,
    traits: [...def.traits],
    grantedRules: [],
    hasMoved: false,
    readyAtMs: state.clockMs + restFor,
    rootedUntilMs: 0,
    shieldedUntilMs: 0,
    submergedUntilMs: 0,
    noCaptureUntilMs: 0,
    reversed,
  };
  if (crownId) piece.crownId = crownId;
  state.nextUid += 1;
  state.board[square] = piece;
  return piece;
}

/**
 * A match opens in the placement phase with an empty board: each player chooses
 * where their Crown stands before the clock starts. Nothing else is on the
 * board — a single pawn arrives in front of the Crown as it is placed, and
 * everything after that is mustered from hand.
 */
export function createMatch({ goldDeck, shadowDeck, seed = Date.now() }: MatchSetup): MatchState {
  const rng = makeRng(seed);

  const state: MatchState = {
    board: new Array<PieceInstance | null>(NUM_SQUARES).fill(null),
    players: {
      gold: makePlayer('gold', goldDeck, rng),
      shadow: makePlayer('shadow', shadowDeck, rng),
    },
    clockMs: 0,
    phase: 'placement',
    status: 'active',
    seed,
    log: [],
    nextUid: 1,
  };

  drawUp(state.players.gold);
  drawUp(state.players.shadow);
  return state;
}

/* ------------------------------------------------------------------ */
/* Cloning                                                             */
/* ------------------------------------------------------------------ */

/**
 * Hand-rolled deep clone. The AI copies state thousands of times per decision,
 * and this is markedly faster than structuredClone (which Hermes also lacks).
 */
export function cloneState(state: MatchState): MatchState {
  const board = new Array<PieceInstance | null>(NUM_SQUARES);
  for (let i = 0; i < NUM_SQUARES; i += 1) {
    const piece = state.board[i];
    board[i] = piece
      ? { ...piece, traits: [...piece.traits], grantedRules: [...piece.grantedRules] }
      : null;
  }
  const clonePlayer = (p: PlayerState): PlayerState => ({
    ...p,
    deck: [...p.deck],
    hand: [...p.hand],
    graveyard: [...p.graveyard],
  });
  return {
    ...state,
    board,
    players: { gold: clonePlayer(state.players.gold), shadow: clonePlayer(state.players.shadow) },
    log: [...state.log],
  };
}

function log(state: MatchState, side: Side, text: string): void {
  state.log.push({ atMs: state.clockMs, side, text });
}

/* ------------------------------------------------------------------ */
/* The clock                                                           */
/* ------------------------------------------------------------------ */

function drawUp(player: PlayerState): void {
  while (player.hand.length < player.handSize && player.deck.length > 0) {
    player.hand.push(player.deck.shift() as string);
  }
}

/** Played cards go to the back of the draw queue, so an 8-card deck cycles. */
function cycleCard(player: PlayerState, handIndex: number): string {
  const [cardId] = player.hand.splice(handIndex, 1);
  player.deck.push(cardId as string);
  drawUp(player);
  return cardId as string;
}

/** Total material a side has on the board, crowns excluded. */
export function materialOf(state: MatchState, side: Side): number {
  return piecesOf(state, side)
    .filter((p) => !p.crownId)
    .reduce((sum, p) => sum + getPiece(p.pieceId).value, 0);
}

function finish(state: MatchState, status: MatchState['status'], reason: string): void {
  state.status = status;
  state.phase = 'over';
  log(state, 'gold', reason);
}

/**
 * Advances the battle clock. This is the only thing that moves the match
 * forward on its own: aether regenerates against it, cooldowns and statuses are
 * stored as timestamps measured against it, and it decides the match if neither
 * Crown falls.
 *
 * Returns a new state; callers drive it from a frame loop or, in tests, in
 * exact steps.
 */
export function advance(state: MatchState, deltaMs: number): MatchState {
  if (state.phase !== 'battle' || deltaMs <= 0) return state;

  const next = cloneState(state);
  next.clockMs += deltaMs;

  // Past the halfway mark aether flows twice as fast, which is what stops two
  // cautious players from stalling out to the time limit.
  const surge = next.clockMs >= DOUBLE_AETHER_AT_MS ? 2 : 1;
  for (const side of SIDES) {
    const player = next.players[side];
    const gained = (deltaMs / AETHER_MS_PER_POINT) * player.aetherRate * surge;
    player.aether = Math.min(AETHER_CAP, player.aether + gained);
  }

  if (next.clockMs >= MATCH_LENGTH_MS) {
    const gold = materialOf(next, 'gold');
    const shadow = materialOf(next, 'shadow');
    finish(
      next,
      gold === shadow ? 'draw' : gold > shadow ? 'gold_wins' : 'shadow_wins',
      `Time. Material ${gold.toFixed(1)} against ${shadow.toFixed(1)}.`,
    );
  }
  return next;
}

/** Seconds left on the match clock, for the UI. */
export function timeRemainingMs(state: MatchState): number {
  return Math.max(0, MATCH_LENGTH_MS - state.clockMs);
}

/* ------------------------------------------------------------------ */
/* Removal, capture and faction passives                               */
/* ------------------------------------------------------------------ */

/**
 * Every square a piece could currently be deployed onto. Delegates to
 * isValidTarget's 'empty_muster' case so this and every effect that targets
 * `empty_muster` (Restore, Raise the Levy, the Barrow King's power…) share one
 * definition of "muster zone" — including the Gnome Engineer's override,
 * which musters only in the squares adjacent to itself rather than a back rank.
 */
function emptyMusterSquares(state: MatchState, side: Side): Square[] {
  const squares: Square[] = [];
  for (let square = 0; square < NUM_SQUARES; square += 1) {
    if (isValidTarget(state, side, 'empty_muster', square)) squares.push(square);
  }
  return squares;
}

/** How often the Horseman's reap also claims an adjacent enemy pawn. */
const REAPER_CHANCE = 0.35;

/**
 * Undead's "full version of whatever it was": the same archetype, but from
 * the Barrow Legion's own roster. A captured fairy piece or something else
 * with no direct counterpart rises as Undead's own knight-equivalent instead
 * — there's no clean 1:1 mapping for something bespoke.
 */
function undeadVersionOf(factionId: string, captured: { archetype: string }): string {
  const archetype = captured.archetype;
  if (archetype === 'pawn' || archetype === 'knight' || archetype === 'bishop' || archetype === 'rook' || archetype === 'queen') {
    return `${factionId}_${archetype}`;
  }
  return `${factionId}_knight`;
}

function removePiece(
  state: MatchState,
  piece: PieceInstance,
  /** Set when Harvest is about to raise this piece instead of burying it. */
  harvested = false,
): void {
  if (state.board[piece.square]?.uid !== piece.uid) return;
  state.board[piece.square] = null;

  if (piece.crownId) {
    finish(
      state,
      piece.owner === 'gold' ? 'shadow_wins' : 'gold_wins',
      `${getPiece(piece.pieceId).name} has fallen. The match is over.`,
    );
    return;
  }

  // A harvested piece never reaches its owner's graveyard at all — Undead
  // raises it a moment from now instead. See applyCapturePassives.
  if (harvested) return;

  const owner = state.players[piece.owner];
  owner.graveyard.push(piece.pieceId);

  const passive = getFaction(owner.factionId).passive;
  if (passive.kind === 'regrowth') {
    owner.aether = Math.min(AETHER_CAP, owner.aether + passive.amount);
  }
}

/** Destroys a piece and everything around it. Crowns and protected pieces survive. */
function detonate(state: MatchState, centre: Square, radius: 'adjacent' | 'diagonal'): void {
  const target = pieceAt(state, centre);
  const victims: PieceInstance[] = [];
  if (target && !target.crownId) victims.push(target);

  for (const dir of radius === 'adjacent' ? ALL_DIRECTIONS : DIAGONAL) {
    const square = shift(centre, dir, 'gold');
    if (square === -1) continue;
    const victim = pieceAt(state, square);
    if (!victim || victim.crownId || isProtected(state, victim)) continue;
    victims.push(victim);
  }

  for (const victim of victims) removePiece(state, victim);
  log(state, 'gold', `The blast on ${squareName(centre)} takes ${victims.length} piece(s).`);
}

/** Shielded or bunkered: nothing may remove it. */
export function isProtected(state: MatchState, piece: PieceInstance): boolean {
  return piece.shieldedUntilMs > state.clockMs || piece.submergedUntilMs > state.clockMs;
}

/** Everything about the piece a move just captured, for passives that key off it. */
interface CaptureInfo {
  pieceId: string;
  name: string;
  archetype: string;
  explosive: boolean;
}

/** What happens to the attacker and the board the instant a capture lands. */
function applyCapturePassives(
  state: MatchState,
  attacker: PieceInstance,
  square: Square,
  originSquare: Square,
  captured: CaptureInfo | null,
): void {
  const player = state.players[attacker.owner];
  const passive = getFaction(player.factionId).passive;

  if (passive.kind === 'explosive_capture') {
    for (const dir of DIAGONAL) {
      const neighbour = shift(square, dir, 'gold');
      if (neighbour === -1) continue;
      const victim = pieceAt(state, neighbour);
      if (!victim || victim.crownId || isProtected(state, victim)) continue;
      // The passive spares your own ranks — only the Detonate card, as
      // printed, takes friend and foe alike.
      if (victim.owner === attacker.owner) continue;
      removePiece(state, victim);
    }
    log(state, attacker.owner, 'The capture detonates across the diagonals.');
  }

  // Orcish final stand: whatever now stands where the explosive piece fell —
  // normally its killer — goes with it, along with anything adjacent.
  if (captured?.explosive && state.status === 'active') {
    detonate(state, square, 'adjacent');
  }

  const survived = state.status === 'active' && state.board[attacker.square]?.uid === attacker.uid;

  // Undead Harvest: the casualty doesn't reach a graveyard at all — it rises
  // again on the square its captor just vacated, fighting for its new side
  // while still facing the way it always has.
  if (passive.kind === 'harvest' && captured && survived && !pieceAt(state, originSquare)) {
    const upgrade = player.harvestCharges > 0;
    if (upgrade) player.harvestCharges -= 1;
    const zombieId = upgrade
      ? undeadVersionOf(player.factionId, captured)
      : `${player.factionId}_zombie`;
    const zombie = getPiece(zombieId);
    spawn(state, zombieId, attacker.owner, originSquare, undefined, zombie.cooldownMs, true);
    log(
      state,
      attacker.owner,
      `${captured.name} rises as ${zombie.name}${upgrade ? ', fully undead' : ''}.`,
    );

    // The Horseman's reap: a seeded roll, so replaying the same match from
    // the same seed always makes the same call.
    if (attacker.traits.includes('reaper')) {
      const roll = makeRng(state.seed ^ state.nextUid)();
      if (roll < REAPER_CHANCE) {
        for (const dir of ALL_DIRECTIONS) {
          const adjacent = shift(square, dir, 'gold');
          if (adjacent === -1) continue;
          const victim = pieceAt(state, adjacent);
          if (!victim || victim.owner === attacker.owner || victim.crownId) continue;
          if (getPiece(victim.pieceId).archetype !== 'pawn') continue;
          if (isProtected(state, victim)) continue;
          state.board[adjacent] = null;
          const reapedId = `${player.factionId}_zombie`;
          const reaped = getPiece(reapedId);
          spawn(state, reapedId, attacker.owner, adjacent, undefined, reaped.cooldownMs, true);
          log(state, attacker.owner, `The Horseman’s reach claims a second soul on ${squareName(adjacent)}.`);
          break;
        }
      }
    }
  }

  if (!survived) return;

  // A cooldown refund is what "move again after capturing" means in real time.
  if (passive.kind === 'bloodlust') {
    attacker.readyAtMs = state.clockMs;
    log(state, attacker.owner, 'Bloodlust — the striker is ready again at once.');
  } else if (player.pendingStrikes > 0) {
    player.pendingStrikes -= 1;
    attacker.readyAtMs = state.clockMs;
    log(state, attacker.owner, 'The strike lands — ready again at once.');
  }
}

function promoteIfAble(state: MatchState, piece: PieceInstance): void {
  const def = getPiece(piece.pieceId);
  if (!piece.traits.includes('promotes') || !def.promotesTo) return;
  if (rankOf(piece.square) !== promotionRank(piece.owner)) return;
  promoteInPlace(state, piece);
}

/** Promotion proper, also reachable via the Barrow King's Evolve. */
function promoteInPlace(state: MatchState, piece: PieceInstance): void {
  const def = getPiece(piece.pieceId);
  if (!def.promotesTo) return;
  const promoted = getPiece(def.promotesTo);
  // Traits granted mid-match survive the promotion.
  const granted = piece.traits.filter((t) => !def.traits.includes(t));
  piece.pieceId = promoted.id;
  piece.traits = [...new Set<Trait>([...promoted.traits, ...granted])];
  log(state, piece.owner, `${def.name} rises as ${promoted.name} on ${squareName(piece.square)}.`);
}

/* ------------------------------------------------------------------ */
/* Target validation                                                   */
/* ------------------------------------------------------------------ */

export function isValidTarget(
  state: MatchState,
  side: Side,
  slot: TargetSlot,
  square: Square,
  effect?: Effect,
  /** Squares already picked for earlier slots of the same effect. */
  chosen: readonly Square[] = [],
): boolean {
  if (square < 0 || square >= NUM_SQUARES) return false;
  const occupant = pieceAt(state, square);

  switch (slot) {
    case 'friendly_piece':
      return !!occupant && occupant.owner === side;
    case 'friendly_non_crown':
      return !!occupant && occupant.owner === side && !occupant.crownId;
    case 'friendly_pawn':
      return (
        !!occupant &&
        occupant.owner === side &&
        !occupant.crownId &&
        getPiece(occupant.pieceId).archetype === 'pawn'
      );
    case 'enemy_piece': {
      if (!occupant || occupant.owner === side) return false;
      if (occupant.crownId || isProtected(state, occupant)) return false;
      if (effect?.kind === 'destroy_enemy') {
        return getPiece(occupant.pieceId).cost <= effect.maxCost;
      }
      return true;
    }
    case 'empty_muster': {
      if (occupant) return false;
      // The Gnome Engineer's automatons are built around himself, not
      // mustered along a back rank like everyone else's army.
      const faction = getFaction(state.players[side].factionId);
      if (faction.deployNearCrown) {
        const crown = findCrown(state, side);
        return !!crown && ALL_DIRECTIONS.some((dir) => shift(crown.square, dir, 'gold') === square);
      }
      return isMusterSquare(square, side);
    }
    case 'empty_own_half':
      return !occupant && isOwnHalf(square, side);
    case 'empty_square':
      return !occupant;
    case 'empty_safe_square':
      // Burrow's landing rule: empty, and nothing enemy stands beside it.
      if (occupant) return false;
      return !ALL_DIRECTIONS.some((dir) => {
        const adjacent = shift(square, dir, 'gold');
        if (adjacent === -1) return false;
        const neighbour = pieceAt(state, adjacent);
        return !!neighbour && neighbour.owner !== side;
      });
    case 'blink_destination': {
      // Only meaningful once slot 0 (the piece to move) has been chosen.
      const originSquare = chosen[0];
      if (originSquare === undefined || occupant) return false;
      const piece = pieceAt(state, originSquare);
      if (!piece || piece.owner !== side) return false;
      return blinkDestinations(state, piece).includes(square);
    }
    default:
      return false;
  }
}

/** Conditions an effect needs beyond its targets. */
export function effectIsAvailable(state: MatchState, side: Side, effect: Effect): boolean {
  if (effect.kind === 'restore_grave') return state.players[side].graveyard.length > 0;
  return true;
}

/** Every square that could legally fill `slotIndex` of a pending effect. */
export function targetOptions(
  state: MatchState,
  side: Side,
  spec: EffectSpec,
  slotIndex: number,
  chosen: readonly Square[] = [],
): Square[] {
  const slot = spec.slots[slotIndex];
  if (!slot || !effectIsAvailable(state, side, spec.effect)) return [];
  const options: Square[] = [];
  for (let square = 0; square < NUM_SQUARES; square += 1) {
    if (chosen.includes(square)) continue;
    if (isValidTarget(state, side, slot, square, spec.effect, chosen)) options.push(square);
  }
  return options;
}

function targetsSatisfy(
  state: MatchState,
  side: Side,
  spec: EffectSpec,
  targets: readonly Square[],
): boolean {
  if (targets.length !== spec.slots.length) return false;
  if (new Set(targets).size !== targets.length) return false;
  if (!effectIsAvailable(state, side, spec.effect)) return false;
  return spec.slots.every((slot, i) =>
    isValidTarget(state, side, slot, targets[i] as Square, spec.effect, targets.slice(0, i)),
  );
}

/* ------------------------------------------------------------------ */
/* Effect resolution                                                   */
/* ------------------------------------------------------------------ */

function resolveEffect(
  state: MatchState,
  side: Side,
  spec: EffectSpec,
  targets: readonly Square[],
): void {
  const player = state.players[side];
  const effect = spec.effect;
  const first = targets[0] as Square | undefined;
  const target = first === undefined ? null : pieceAt(state, first);

  switch (effect.kind) {
    case 'gain_aether':
      player.aether = Math.min(AETHER_CAP, player.aether + effect.amount);
      break;

    case 'destroy_enemy':
      if (target) {
        log(state, side, `${getPiece(target.pieceId).name} on ${squareName(target.square)} is destroyed.`);
        removePiece(state, target);
      }
      break;

    case 'shield_friendly':
      if (target) {
        target.shieldedUntilMs = Math.max(target.shieldedUntilMs, state.clockMs + effect.ms);
      }
      break;

    case 'shield_rank':
      if (target) {
        const rank = rankOf(target.square);
        for (const piece of piecesOf(state, side)) {
          if (rankOf(piece.square) === rank) {
            piece.shieldedUntilMs = Math.max(piece.shieldedUntilMs, state.clockMs + effect.ms);
          }
        }
        log(state, side, `A shield wall closes across rank ${rank + 1}.`);
      }
      break;

    case 'root_enemy':
      if (target) {
        target.rootedUntilMs = Math.max(target.rootedUntilMs, state.clockMs + effect.ms);
      }
      break;

    case 'submerge':
      if (target) {
        target.submergedUntilMs = Math.max(target.submergedUntilMs, state.clockMs + effect.ms);
        log(state, side, `${getPiece(target.pieceId).name} digs in on ${squareName(target.square)}.`);
      }
      break;

    case 'grant_trait':
      if (target && !target.traits.includes(effect.trait)) target.traits.push(effect.trait);
      break;

    case 'grant_rule':
      if (target) target.grantedRules.push(effect.rule);
      break;

    case 'refund_cooldown':
      if (target) target.readyAtMs = state.clockMs;
      break;

    case 'strike_on_capture':
      player.pendingStrikes += effect.count;
      break;

    case 'detonate':
      if (first !== undefined) detonate(state, first, effect.radius);
      break;

    case 'evolve_pawn':
      if (target) promoteInPlace(state, target);
      break;

    case 'restore_grave': {
      const pieceId = player.graveyard.shift();
      if (pieceId && first !== undefined) {
        spawn(state, pieceId, side, first, undefined, getPiece(pieceId).cooldownMs);
        log(state, side, `${getPiece(pieceId).name} returns on ${squareName(first)}.`);
      }
      break;
    }

    case 'teleport_friendly': {
      const destination = targets[1] as Square | undefined;
      if (target && destination !== undefined) {
        state.board[target.square] = null;
        target.square = destination;
        state.board[destination] = target;
        promoteIfAble(state, target);
      }
      break;
    }

    case 'blink': {
      // Same relocation as teleport_friendly, just reached via the piece's
      // own movement lines rather than a fixed half of the board.
      const destination = targets[1] as Square | undefined;
      if (target && destination !== undefined) {
        state.board[target.square] = null;
        target.square = destination;
        state.board[destination] = target;
        promoteIfAble(state, target);
        log(state, side, `${getPiece(target.pieceId).name} blinks to ${squareName(destination)}.`);
      }
      break;
    }

    case 'vanish':
      if (target) {
        target.shieldedUntilMs = Math.max(target.shieldedUntilMs, state.clockMs + effect.ms);
        target.noCaptureUntilMs = Math.max(target.noCaptureUntilMs, state.clockMs + effect.ms);
        log(state, side, `${getPiece(target.pieceId).name} slips out of reach.`);
      }
      break;

    case 'grant_harvest':
      player.harvestCharges += 1;
      break;

    case 'summon':
      for (const square of targets) {
        if (!pieceAt(state, square)) {
          spawn(state, effect.pieceId, side, square, undefined, getPiece(effect.pieceId).cooldownMs);
        }
      }
      log(state, side, `${getPiece(effect.pieceId).name} x${targets.length} musters.`);
      break;

    case 'recycle_hand': {
      player.deck.push(...player.hand);
      player.hand = [];
      drawUp(player);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Action legality                                                     */
/* ------------------------------------------------------------------ */

export interface Legality {
  ok: boolean;
  reason?: string;
}

/** Where a side may stand its Crown at the start of the match. */
export function crownPlacementSquares(state: MatchState, side: Side): Square[] {
  const squares: Square[] = [];
  for (let square = 0; square < NUM_SQUARES; square += 1) {
    if (pieceAt(state, square)) continue;
    if (!isMusterSquare(square, side)) continue;
    // The Crown needs the square in front of it free for its guard pawn.
    const guard = shift(square, { df: 0, dr: 1 }, side);
    if (guard === -1 || pieceAt(state, guard)) continue;
    squares.push(square);
  }
  return squares;
}

export function checkAction(state: MatchState, action: Action): Legality {
  if (state.status !== 'active') return { ok: false, reason: 'The match is over.' };
  const side = action.side;
  const player = state.players[side];

  if (action.type === 'placeCrown') {
    if (state.phase !== 'placement') return { ok: false, reason: 'The battle has already begun.' };
    if (player.crownPlaced) return { ok: false, reason: 'Your Crown is already placed.' };
    return crownPlacementSquares(state, side).includes(action.square)
      ? { ok: true }
      : { ok: false, reason: 'Stand your Crown in your muster zone, with room for its guard.' };
  }

  if (state.phase !== 'battle') return { ok: false, reason: 'Place your Crown first.' };

  switch (action.type) {
    case 'move': {
      const piece = pieceAt(state, action.from);
      if (!piece) return { ok: false, reason: 'No piece on that square.' };
      if (piece.owner !== side) return { ok: false, reason: 'That piece is not yours.' };
      if (piece.readyAtMs > state.clockMs) return { ok: false, reason: 'That piece is still resting.' };
      if (piece.rootedUntilMs > state.clockMs) return { ok: false, reason: 'That piece is rooted.' };
      if (piece.submergedUntilMs > state.clockMs) return { ok: false, reason: 'That piece is dug in.' };
      const legal = generateMovesForPiece(state, piece).some((m) => m.to === action.to);
      return legal ? { ok: true } : { ok: false, reason: 'That piece cannot reach that square.' };
    }

    case 'deploy': {
      const cardId = player.hand[action.handIndex];
      if (!cardId) return { ok: false, reason: 'No card in that hand slot.' };
      const card = getCard(cardId);
      if (card.kind !== 'piece') return { ok: false, reason: 'That card is not a piece.' };
      if (player.aether < card.cost) return { ok: false, reason: 'Not enough aether.' };
      if (!isValidTarget(state, side, 'empty_muster', action.to)) {
        const faction = getFaction(player.factionId);
        return {
          ok: false,
          reason: faction.deployNearCrown
            ? 'Gnome automatons must be built beside the Engineer.'
            : 'Deploy inside your muster zone.',
        };
      }
      return { ok: true };
    }

    case 'cast': {
      const cardId = player.hand[action.handIndex];
      if (!cardId) return { ok: false, reason: 'No card in that hand slot.' };
      const card = getCard(cardId);
      if (card.kind !== 'effect') return { ok: false, reason: 'That card is not an effect.' };
      if (player.aether < card.cost) return { ok: false, reason: 'Not enough aether.' };
      if (!effectIsAvailable(state, side, card.spec.effect)) {
        return { ok: false, reason: 'Your graveyard is empty.' };
      }
      if (!targetsSatisfy(state, side, card.spec, action.targets)) {
        return { ok: false, reason: 'Invalid targets for that card.' };
      }
      return { ok: true };
    }

    case 'power': {
      const crown = getCrown(player.crownId);
      if (player.powerReadyAtMs > state.clockMs) {
        return { ok: false, reason: `${crown.powerName} is recharging.` };
      }
      if (player.aether < crown.powerCost) return { ok: false, reason: 'Not enough aether.' };
      if (!findCrown(state, side)) return { ok: false, reason: 'Your crown has fallen.' };
      if (!effectIsAvailable(state, side, crown.power.effect)) {
        return { ok: false, reason: 'Your graveyard is empty.' };
      }
      if (!targetsSatisfy(state, side, crown.power, action.targets)) {
        return { ok: false, reason: 'Invalid targets for that power.' };
      }
      return { ok: true };
    }

    default:
      return { ok: false, reason: 'Unknown action.' };
  }
}

/* ------------------------------------------------------------------ */
/* Applying actions                                                    */
/* ------------------------------------------------------------------ */

/**
 * The single entry point for mutating a match. Returns a new state and never
 * touches the one passed in, so callers can keep history for free.
 */
export function applyAction(state: MatchState, action: Action): MatchState {
  const legality = checkAction(state, action);
  if (!legality.ok) throw new Error(legality.reason ?? 'Illegal action.');

  const next = cloneState(state);
  const side = action.side;
  const player = next.players[side];

  switch (action.type) {
    case 'placeCrown': {
      spawn(next, crownPieceIdFor(player.crownId), side, action.square, player.crownId);
      // A pawn stands in front of the Crown as its first line of defence.
      const guard = shift(action.square, { df: 0, dr: forwardOf(side) > 0 ? 1 : 1 }, side);
      if (guard !== -1 && !pieceAt(next, guard)) {
        spawn(next, `${player.factionId}_pawn`, side, guard);
      }
      player.crownPlaced = true;
      log(next, side, `${getCrown(player.crownId).name} takes the field on ${squareName(action.square)}.`);

      if (next.players.gold.crownPlaced && next.players.shadow.crownPlaced) {
        next.phase = 'battle';
        log(next, side, 'The battle begins.');
      }
      break;
    }

    case 'move': {
      const piece = pieceAt(next, action.from) as PieceInstance;
      const defender = pieceAt(next, action.to);
      let captured = false;
      let capturedInfo: CaptureInfo | null = null;

      if (defender && canCapture(next, piece, defender)) {
        const vengeful = defender.traits.includes('vengeful');
        const attackerFaction = getFaction(next.players[side].factionId);
        // A vengeful defender takes the attacker down with it, so there is no
        // "captor's square" left for Harvest to raise anything on.
        const harvesting = attackerFaction.passive.kind === 'harvest' && !vengeful;
        const defenderDef = getPiece(defender.pieceId);
        capturedInfo = {
          pieceId: defender.pieceId,
          name: defenderDef.name,
          archetype: defenderDef.archetype,
          explosive: defender.traits.includes('explosive'),
        };

        log(
          next,
          side,
          `${getPiece(piece.pieceId).name} takes ${defenderDef.name} on ${squareName(action.to)}.`,
        );
        removePiece(next, defender, harvesting);
        captured = true;
        if (vengeful) {
          log(next, side, `${getPiece(piece.pieceId).name} is dragged down with it.`);
          removePiece(next, piece);
          if (next.status === 'active') {
            applyCapturePassives(next, piece, action.to, action.from, capturedInfo);
          }
          break;
        }
      }

      next.board[action.from] = null;
      piece.square = action.to;
      piece.hasMoved = true;
      piece.readyAtMs = next.clockMs + getPiece(piece.pieceId).cooldownMs;
      next.board[action.to] = piece;
      promoteIfAble(next, piece);
      if (captured && next.status === 'active') {
        applyCapturePassives(next, piece, action.to, action.from, capturedInfo);
      }
      break;
    }

    case 'deploy': {
      const card = getCard(player.hand[action.handIndex] as string);
      const pieceId = (card as { pieceId: string }).pieceId;
      player.aether -= card.cost;
      cycleCard(player, action.handIndex);
      spawn(
        next,
        pieceId,
        side,
        action.to,
        undefined,
        getPiece(pieceId).cooldownMs * DEPLOY_COOLDOWN_MULTIPLIER,
      );
      log(next, side, `${card.name} musters on ${squareName(action.to)}.`);
      break;
    }

    case 'cast': {
      const card = getCard(player.hand[action.handIndex] as string);
      player.aether -= card.cost;
      // Cycled before resolving so a hand-recycling card does not put itself
      // back into the hand it just refilled.
      cycleCard(player, action.handIndex);
      log(next, side, `${card.name} is cast.`);
      if (card.kind === 'effect') resolveEffect(next, side, card.spec, action.targets);
      break;
    }

    case 'power': {
      const crown = getCrown(player.crownId);
      player.aether -= crown.powerCost;
      player.powerReadyAtMs = next.clockMs + crown.powerCooldownMs;
      log(next, side, `${crown.name} invokes ${crown.powerName}.`);
      resolveEffect(next, side, crown.power, action.targets);
      break;
    }
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Enumeration (used by the AI and by UI affordances)                  */
/* ------------------------------------------------------------------ */

/**
 * Everything `side` could legally do at this instant. With no turn order this
 * is a snapshot of one player's options right now, not a turn's worth of them.
 */
export function legalActions(state: MatchState, side: Side): Action[] {
  if (state.status !== 'active') return [];
  const player = state.players[side];
  const actions: Action[] = [];

  if (state.phase === 'placement') {
    if (player.crownPlaced) return [];
    return crownPlacementSquares(state, side).map((square) => ({
      type: 'placeCrown' as const,
      side,
      square,
    }));
  }

  for (const piece of piecesOf(state, side)) {
    if (!canMove(state, piece)) continue;
    for (const move of generateMovesForPiece(state, piece)) {
      actions.push({ type: 'move', side, from: move.from, to: move.to });
    }
  }

  player.hand.forEach((cardId, handIndex) => {
    const card = getCard(cardId);
    if (player.aether < card.cost) return;

    if (card.kind === 'piece') {
      for (const square of emptyMusterSquares(state, side)) {
        actions.push({ type: 'deploy', side, handIndex, to: square });
      }
    } else {
      for (const targets of expandTargets(state, side, card.spec)) {
        actions.push({ type: 'cast', side, handIndex, targets });
      }
    }
  });

  const crown = getCrown(player.crownId);
  if (player.powerReadyAtMs <= state.clockMs && player.aether >= crown.powerCost && findCrown(state, side)) {
    for (const targets of expandTargets(state, side, crown.power)) {
      actions.push({ type: 'power', side, targets });
    }
  }

  return actions;
}

function expandTargets(state: MatchState, side: Side, spec: EffectSpec): Square[][] {
  if (!effectIsAvailable(state, side, spec.effect)) return [];
  if (spec.slots.length === 0) return [[]];

  let combos: Square[][] = [[]];
  for (let slot = 0; slot < spec.slots.length; slot += 1) {
    const next: Square[][] = [];
    for (const combo of combos) {
      for (const option of targetOptions(state, side, spec, slot, combo)) {
        next.push([...combo, option]);
      }
    }
    combos = next;
    if (combos.length === 0) break;
  }
  return combos;
}

/** Convenience for UIs: which squares this piece may move to right now. */
export function movesFrom(state: MatchState, square: Square): Square[] {
  const piece = pieceAt(state, square);
  if (!piece || state.phase !== 'battle') return [];
  if (!canMove(state, piece)) return [];
  return generateMovesForPiece(state, piece).map((m) => m.to);
}

/** Squares a piece card in hand could be deployed onto. */
export function deploySquares(state: MatchState, side: Side): Square[] {
  return state.phase === 'battle' ? emptyMusterSquares(state, side) : [];
}

/** Fraction of a piece's cooldown still to run, 0 when ready. */
export function cooldownProgress(state: MatchState, piece: PieceInstance): number {
  const total = getPiece(piece.pieceId).cooldownMs;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (piece.readyAtMs - state.clockMs) / total));
}
