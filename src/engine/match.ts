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
  squareOf,
  throneSquare,
} from './board';
import { canCapture, canMove, findCrown, generateMovesForPiece, pieceAt, piecesOf } from './movement';
import { getCard, getCrown, getFaction, getPiece } from './registry';
import { makeRng, shuffle } from './rng';
import {
  AETHER_CAP,
  AETHER_INCOME,
  AETHER_START,
  HAND_SIZE,
  NUM_SQUARES,
  TURN_LIMIT,
  opponentOf,
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
    powerCooldown: 0,
    strideUntilTurn: 0,
    passiveUsedOnTurn: 0,
    pendingStrikes: 0,
  };
}

function spawn(
  state: MatchState,
  pieceId: string,
  owner: Side,
  square: Square,
  crownId?: string,
  /** Starting pieces are battle-ready; anything mustered mid-match is not. */
  sick = false,
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
    sick,
    rooted: 0,
    shielded: 0,
    submerged: 0,
  };
  if (crownId) piece.crownId = crownId;
  state.nextUid += 1;
  state.board[square] = piece;
  return piece;
}

/**
 * Both sides open with their crown on the throne and a rank of three of their
 * faction's own pawns in front of it. The shield matters: the thrones face each
 * other down the same file, so without it a Crown with a queen's reach — the
 * Elf Queen — could take the enemy Crown on turn two. Everything else has to be
 * mustered from hand, which is what gives the opening turns their texture.
 */
export function createMatch({ goldDeck, shadowDeck, seed = Date.now() }: MatchSetup): MatchState {
  const rng = makeRng(seed);

  const state: MatchState = {
    board: new Array<PieceInstance | null>(NUM_SQUARES).fill(null),
    players: {
      gold: makePlayer('gold', goldDeck, rng),
      shadow: makePlayer('shadow', shadowDeck, rng),
    },
    turn: 1,
    active: 'gold',
    movesLeft: 1,
    cardsLeft: 1,
    mustMoveUid: null,
    status: 'active',
    seed,
    log: [],
    nextUid: 1,
  };

  for (const side of ['gold', 'shadow'] as const) {
    const player = state.players[side];
    const throne = throneSquare(side);
    const homeRank = rankOf(throne);
    spawn(state, crownPieceIdFor(player.crownId), side, throne, player.crownId);
    // Each faction fields its own pawn — an Orc Peon, a Dwarf Miner, and so on.
    const pawnId = `${player.factionId}_pawn`;
    const shieldRank = homeRank + forwardOf(side);
    for (const file of [1, 2, 3]) {
      spawn(state, pawnId, side, squareOf(file, shieldRank));
    }
  }

  // Both players are dealt an opening hand up front: the waiting player's hand
  // has to exist before their first turn for the AI (and the UI) to read it.
  drawUp(state.players.gold);
  drawUp(state.players.shadow);

  beginTurn(state);
  return state;
}

/* ------------------------------------------------------------------ */
/* Cloning                                                             */
/* ------------------------------------------------------------------ */

/**
 * Hand-rolled deep clone. The AI copies state thousands of times per move, and
 * this is markedly faster than structuredClone (which Hermes also lacks).
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

function log(state: MatchState, text: string): void {
  state.log.push({ turn: state.turn, side: state.active, text });
}

/* ------------------------------------------------------------------ */
/* Turn structure                                                      */
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

function beginTurn(state: MatchState): void {
  const player = state.players[state.active];

  // Statuses tick down on their owner's turn, so a 1-turn shield covers
  // exactly the opponent's next turn.
  for (const piece of piecesOf(state, state.active)) {
    piece.sick = false;
    if (piece.rooted > 0) piece.rooted -= 1;
    if (piece.shielded > 0) piece.shielded -= 1;
    if (piece.submerged > 0) piece.submerged -= 1;
  }

  if (state.turn > 1) {
    player.aether = Math.min(AETHER_CAP, player.aether + AETHER_INCOME);
  }
  if (player.powerCooldown > 0) player.powerCooldown -= 1;
  player.passiveUsedOnTurn = 0;
  player.pendingStrikes = 0;

  drawUp(player);
  state.movesLeft = 1;
  state.cardsLeft = 1;
  state.mustMoveUid = null;
}

/** Total material a side has on the board, crowns excluded. */
export function materialOf(state: MatchState, side: Side): number {
  return piecesOf(state, side)
    .filter((p) => !p.crownId)
    .reduce((sum, p) => sum + getPiece(p.pieceId).value, 0);
}

function checkTurnLimit(state: MatchState): void {
  if (state.status !== 'active' || state.turn <= TURN_LIMIT) return;
  const gold = materialOf(state, 'gold');
  const shadow = materialOf(state, 'shadow');
  state.status = gold === shadow ? 'draw' : gold > shadow ? 'gold_wins' : 'shadow_wins';
  log(state, `Turn limit reached — material ${gold.toFixed(1)} vs ${shadow.toFixed(1)}.`);
}

function endTurn(state: MatchState): void {
  if (state.status !== 'active') return;
  state.active = opponentOf(state.active);
  state.turn += 1;
  checkTurnLimit(state);
  if (state.status === 'active') beginTurn(state);
}

/* ------------------------------------------------------------------ */
/* Removal, capture and faction passives                               */
/* ------------------------------------------------------------------ */

function emptyMusterSquares(state: MatchState, side: Side): Square[] {
  const squares: Square[] = [];
  for (let square = 0; square < NUM_SQUARES; square += 1) {
    if (!pieceAt(state, square) && isMusterSquare(square, side)) squares.push(square);
  }
  return squares;
}

/** Marks a once-per-turn faction passive as spent, returning false if it already was. */
function claimPassive(state: MatchState, side: Side): boolean {
  const player = state.players[side];
  if (player.passiveUsedOnTurn === state.turn) return false;
  player.passiveUsedOnTurn = state.turn;
  return true;
}

function removePiece(state: MatchState, piece: PieceInstance): void {
  if (state.board[piece.square]?.uid !== piece.uid) return;
  state.board[piece.square] = null;

  if (piece.crownId) {
    state.status = piece.owner === 'gold' ? 'shadow_wins' : 'gold_wins';
    log(state, `${getPiece(piece.pieceId).name} has fallen. The match is over.`);
    return;
  }

  const owner = state.players[piece.owner];
  const def = getPiece(piece.pieceId);
  owner.graveyard.push(piece.pieceId);

  const passive = getFaction(owner.factionId).passive;
  if (passive.kind === 'regrowth') {
    owner.aether = Math.min(AETHER_CAP, owner.aether + passive.amount);
  } else if (passive.kind === 'undying' && def.archetype === 'pawn') {
    // The Barrow Legion does not stay down: the first levy lost each turn
    // claws its way back onto an empty muster square.
    const open = emptyMusterSquares(state, piece.owner);
    if (open.length > 0 && claimPassive(state, piece.owner)) {
      spawn(state, piece.pieceId, piece.owner, open[0] as Square, undefined, true);
      log(state, `${def.name} rises again on ${squareName(open[0] as Square)}.`);
    }
  }
}

/** Destroys a piece and everything around it. Crowns and protected pieces survive. */
function detonate(state: MatchState, centre: Square, radius: 'adjacent' | 'diagonal'): void {
  const target = pieceAt(state, centre);
  const victims: PieceInstance[] = [];
  if (target && !target.crownId) victims.push(target);

  for (const dir of radius === 'adjacent' ? ALL_DIRECTIONS : DIAGONAL) {
    // Direction vectors are orientation-agnostic here — a blast is a blast.
    const square = shift(centre, dir, 'gold');
    if (square === -1) continue;
    const victim = pieceAt(state, square);
    if (!victim) continue;
    if (victim.crownId || victim.shielded > 0 || victim.submerged > 0) continue;
    victims.push(victim);
  }

  for (const victim of victims) removePiece(state, victim);
  log(state, `The blast on ${squareName(centre)} takes ${victims.length} piece(s).`);
}

/** Yellow's signature: every capture cracks the squares diagonal to it. */
function applyCapturePassives(state: MatchState, attacker: PieceInstance, square: Square): void {
  const player = state.players[attacker.owner];
  const passive = getFaction(player.factionId).passive;

  // An extra move is only useful to a piece still standing, so a vengeful
  // trade that killed the attacker earns nothing.
  const survived = state.board[attacker.square]?.uid === attacker.uid;

  // Strikes bought earlier this turn are paid out now, one per capture.
  if (player.pendingStrikes > 0 && state.status === 'active' && survived) {
    player.pendingStrikes -= 1;
    state.movesLeft += 1;
    state.mustMoveUid = attacker.uid;
    log(state, 'The strike lands — move again.');
  }

  if (passive.kind === 'explosive_capture') {
    for (const dir of DIAGONAL) {
      const neighbour = shift(square, dir, 'gold');
      if (neighbour === -1) continue;
      const victim = pieceAt(state, neighbour);
      if (!victim || victim.crownId || victim.shielded > 0 || victim.submerged > 0) continue;
      // The passive spares your own ranks — only the Detonate card, as
      // printed, takes friend and foe alike.
      if (victim.owner === attacker.owner) continue;
      removePiece(state, victim);
    }
    log(state, 'The capture detonates across the diagonals.');
  } else if (passive.kind === 'bloodlust' && state.status === 'active') {
    // The first piece to draw blood each turn gets to swing again.
    if (survived && claimPassive(state, attacker.owner)) {
      state.movesLeft += 1;
      state.mustMoveUid = attacker.uid;
      log(state, 'Bloodlust — the attacker may move again.');
    }
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
  // Traits granted mid-match (Wildgrowth, Stoneform) survive the promotion.
  const granted = piece.traits.filter((t) => !def.traits.includes(t));
  piece.pieceId = promoted.id;
  piece.traits = [...new Set<Trait>([...promoted.traits, ...granted])];
  log(state, `${def.name} rises as ${promoted.name} on ${squareName(piece.square)}.`);
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
      // Nothing reaches a crown, a shielded piece or a bunkered one.
      if (occupant.crownId || occupant.shielded > 0 || occupant.submerged > 0) return false;
      if (effect?.kind === 'destroy_enemy') {
        return getPiece(occupant.pieceId).cost <= effect.maxCost;
      }
      return true;
    }
    case 'empty_muster':
      return !occupant && isMusterSquare(square, side);
    case 'empty_own_half':
      return !occupant && isOwnHalf(square, side);
    case 'empty_square':
      return !occupant;
    default:
      return false;
  }
}

/**
 * Conditions an effect needs beyond its targets — chiefly that a resurrection
 * has something in the graveyard to resurrect.
 */
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
    if (isValidTarget(state, side, slot, square, spec.effect)) options.push(square);
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
  return spec.slots.every((slot, i) => isValidTarget(state, side, slot, targets[i] as Square, spec.effect));
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
        log(state, `${getPiece(target.pieceId).name} on ${squareName(target.square)} is destroyed.`);
        removePiece(state, target);
      }
      break;

    case 'shield_friendly':
      if (target) target.shielded = Math.max(target.shielded, effect.turns);
      break;

    case 'shield_rank':
      if (target) {
        const rank = rankOf(target.square);
        for (const piece of piecesOf(state, side)) {
          if (rankOf(piece.square) === rank) piece.shielded = Math.max(piece.shielded, effect.turns);
        }
        log(state, `A shield wall closes across rank ${rank + 1}.`);
      }
      break;

    case 'root_enemy':
      if (target) target.rooted = Math.max(target.rooted, effect.turns);
      break;

    case 'submerge':
      if (target) {
        target.submerged = Math.max(target.submerged, effect.turns);
        log(state, `${getPiece(target.pieceId).name} digs in on ${squareName(target.square)}.`);
      }
      break;

    case 'grant_trait':
      if (target && !target.traits.includes(effect.trait)) target.traits.push(effect.trait);
      break;

    case 'grant_rule':
      if (target) target.grantedRules.push(effect.rule);
      break;

    case 'extra_move':
      state.movesLeft += effect.count;
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
        spawn(state, pieceId, side, first, undefined, true);
        log(state, `${getPiece(pieceId).name} returns on ${squareName(first)}.`);
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

    case 'summon':
      // One body per chosen square, so a two-slot card raises two levies.
      for (const square of targets) {
        if (!pieceAt(state, square)) spawn(state, effect.pieceId, side, square, undefined, true);
      }
      log(state, `${getPiece(effect.pieceId).name} x${targets.length} musters.`);
      break;

    case 'crown_stride':
      player.strideUntilTurn = state.turn;
      break;

    case 'crown_swap': {
      const crown = findCrown(state, side);
      if (crown && target) {
        const crownSquare = crown.square;
        const otherSquare = target.square;
        crown.square = otherSquare;
        target.square = crownSquare;
        state.board[otherSquare] = crown;
        state.board[crownSquare] = target;
        promoteIfAble(state, target);
      }
      break;
    }

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

export function checkAction(state: MatchState, action: Action): Legality {
  if (state.status !== 'active') return { ok: false, reason: 'The match is over.' };
  const side = state.active;
  const player = state.players[side];

  switch (action.type) {
    case 'endTurn':
      return { ok: true };

    case 'move': {
      if (state.movesLeft <= 0) return { ok: false, reason: 'No move actions left this turn.' };
      const piece = pieceAt(state, action.from);
      if (!piece) return { ok: false, reason: 'No piece on that square.' };
      if (piece.owner !== side) return { ok: false, reason: 'That piece is not yours.' };
      if (state.mustMoveUid !== null && piece.uid !== state.mustMoveUid) {
        return { ok: false, reason: 'Only the piece that just struck may move again.' };
      }
      if (piece.sick) return { ok: false, reason: 'That piece was only just mustered.' };
      if (piece.rooted > 0) return { ok: false, reason: 'That piece is rooted.' };
      if (piece.submerged > 0) return { ok: false, reason: 'That piece is dug in.' };
      const legal = generateMovesForPiece(state, piece).some((m) => m.to === action.to);
      return legal ? { ok: true } : { ok: false, reason: 'That piece cannot reach that square.' };
    }

    case 'deploy': {
      if (state.cardsLeft <= 0) return { ok: false, reason: 'No card actions left this turn.' };
      const cardId = player.hand[action.handIndex];
      if (!cardId) return { ok: false, reason: 'No card in that hand slot.' };
      const card = getCard(cardId);
      if (card.kind !== 'piece') return { ok: false, reason: 'That card is not a piece.' };
      if (player.aether < card.cost) return { ok: false, reason: 'Not enough aether.' };
      if (pieceAt(state, action.to)) return { ok: false, reason: 'That square is occupied.' };
      if (!isMusterSquare(action.to, side)) return { ok: false, reason: 'Deploy inside your muster zone.' };
      return { ok: true };
    }

    case 'cast': {
      if (state.cardsLeft <= 0) return { ok: false, reason: 'No card actions left this turn.' };
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
      if (state.cardsLeft <= 0) return { ok: false, reason: 'No card actions left this turn.' };
      const crown = getCrown(player.crownId);
      if (player.powerCooldown > 0) return { ok: false, reason: `${crown.powerName} is recharging.` };
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
  const side = next.active;
  const player = next.players[side];

  switch (action.type) {
    case 'move': {
      const piece = pieceAt(next, action.from) as PieceInstance;
      const defender = pieceAt(next, action.to);
      let captured = false;

      if (defender && canCapture(next, piece, defender)) {
        const vengeful = defender.traits.includes('vengeful');
        log(
          next,
          `${getPiece(piece.pieceId).name} takes ${getPiece(defender.pieceId).name} on ${squareName(action.to)}.`,
        );
        removePiece(next, defender);
        captured = true;
        if (vengeful) {
          // The attacker is dragged down with it and never occupies the square.
          log(next, `${getPiece(piece.pieceId).name} is dragged down with it.`);
          removePiece(next, piece);
          next.movesLeft -= 1;
          if (next.status === 'active') applyCapturePassives(next, piece, action.to);
          break;
        }
      }

      next.board[action.from] = null;
      piece.square = action.to;
      piece.hasMoved = true;
      next.board[action.to] = piece;
      promoteIfAble(next, piece);
      next.movesLeft -= 1;
      next.mustMoveUid = null;
      if (captured && next.status === 'active') applyCapturePassives(next, piece, action.to);
      break;
    }

    case 'deploy': {
      const card = getCard(player.hand[action.handIndex] as string);
      player.aether -= card.cost;
      cycleCard(player, action.handIndex);
      spawn(next, (card as { pieceId: string }).pieceId, side, action.to, undefined, true);
      log(next, `${card.name} musters on ${squareName(action.to)}.`);
      next.cardsLeft -= 1;
      break;
    }

    case 'cast': {
      const card = getCard(player.hand[action.handIndex] as string);
      player.aether -= card.cost;
      // Cycled before resolving so Chaos Magic does not put the card it is
      // casting back into the hand it just refilled.
      cycleCard(player, action.handIndex);
      log(next, `${card.name} is cast.`);
      if (card.kind === 'effect') resolveEffect(next, side, card.spec, action.targets);
      next.cardsLeft -= 1;
      break;
    }

    case 'power': {
      const crown = getCrown(player.crownId);
      player.aether -= crown.powerCost;
      player.powerCooldown = crown.powerCooldown;
      log(next, `${crown.name} invokes ${crown.powerName}.`);
      resolveEffect(next, side, crown.power, action.targets);
      next.cardsLeft -= 1;
      break;
    }

    case 'endTurn':
      endTurn(next);
      return next;
  }

  // A turn ends on its own once both actions are spent, keeping the pace brisk.
  if (next.status === 'active' && next.movesLeft <= 0 && next.cardsLeft <= 0) {
    endTurn(next);
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Enumeration (used by the AI and by UI affordances)                  */
/* ------------------------------------------------------------------ */

/**
 * Every action the active player could legally take right now, `endTurn`
 * included. Multi-target effects are expanded into one action per combination,
 * which is tractable on a 36-square board.
 */
export function legalActions(state: MatchState): Action[] {
  if (state.status !== 'active') return [];
  const side = state.active;
  const player = state.players[side];
  const actions: Action[] = [{ type: 'endTurn' }];

  if (state.movesLeft > 0) {
    for (const piece of piecesOf(state, side)) {
      if (state.mustMoveUid !== null && piece.uid !== state.mustMoveUid) continue;
      for (const move of generateMovesForPiece(state, piece)) {
        actions.push({ type: 'move', from: move.from, to: move.to });
      }
    }
  }

  if (state.cardsLeft > 0) {
    player.hand.forEach((cardId, handIndex) => {
      const card = getCard(cardId);
      if (player.aether < card.cost) return;

      if (card.kind === 'piece') {
        for (const square of emptyMusterSquares(state, side)) {
          actions.push({ type: 'deploy', handIndex, to: square });
        }
      } else {
        for (const targets of expandTargets(state, side, card.spec)) {
          actions.push({ type: 'cast', handIndex, targets });
        }
      }
    });

    const crown = getCrown(player.crownId);
    if (player.powerCooldown === 0 && player.aether >= crown.powerCost && findCrown(state, side)) {
      for (const targets of expandTargets(state, side, crown.power)) {
        actions.push({ type: 'power', targets });
      }
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
  if (!piece || piece.owner !== state.active || state.movesLeft <= 0) return [];
  if (state.mustMoveUid !== null && piece.uid !== state.mustMoveUid) return [];
  if (!canMove(piece)) return [];
  return generateMovesForPiece(state, piece).map((m) => m.to);
}

/** Squares a piece card in hand could be deployed onto. */
export function deploySquares(state: MatchState, side: Side): Square[] {
  return emptyMusterSquares(state, side);
}
