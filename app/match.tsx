import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { boardThemeById, factionById } from '@/content';
import {
  BOARD_SIZE,
  getCard,
  getCrown,
  opponentOf,
  squareOf,
  type MatchState,
  type Side,
  type Square,
} from '@/engine';
import { HUMAN_SIDE, highlightsFor, useMatch } from '@/state/match';
import { useProfile } from '@/state/profile';
import { readCard, readCrown, type CardReadout } from '@/ui/describe';
import { Board, type BoardRect } from '@/ui/components/Board';
import { Button } from '@/ui/components/Button';
import { Candlelight } from '@/ui/components/Candlelight';
import { CardDetail } from '@/ui/components/CardDetail';
import { CardFace, faceOfCardId } from '@/ui/components/CardFace';
import { Hand } from '@/ui/components/Hand';
import { colors, fonts, glow, radius, space, text } from '@/ui/theme';

export default function MatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const store = useMatch();
  const { state, thinking, selected, pending, notice, opponentName } = store;
  const equippedBoard = useProfile((s) => s.equipped.board);

  const [boardRect, setBoardRect] = useState<BoardRect | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [inspectingIndex, setInspectingIndex] = useState<number | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Reached directly (deep link, reload) with no match in flight.
  useEffect(() => {
    if (!state) router.replace('/');
  }, [state, router]);

  /** Page coordinates to a board square, or null when outside the board. */
  const squareAt = useCallback(
    (pageX: number, pageY: number): Square | null => {
      if (!boardRect) return null;
      const fx = (pageX - boardRect.x) / boardRect.size;
      const fy = (pageY - boardRect.y) / boardRect.size;
      if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null;
      const file = Math.floor(fx * BOARD_SIZE);
      // Rank 0 is drawn along the bottom edge.
      const rank = BOARD_SIZE - 1 - Math.floor(fy * BOARD_SIZE);
      return squareOf(file, rank);
    },
    [boardRect],
  );

  const onGrab = useCallback(
    (index: number) => {
      if (store.beginDrag(index)) setDraggingIndex(index);
    },
    [store],
  );

  const onDragMove = useCallback(
    (pageX: number, pageY: number) => {
      dragPos.setValue({ x: pageX, y: pageY });
      const square = squareAt(pageX, pageY);
      // Only re-render when the finger crosses into a different square.
      setHoveredSquare((current) => (current === square ? current : square));
    },
    [dragPos, squareAt],
  );

  const onDrop = useCallback(
    (index: number, pageX: number, pageY: number) => {
      store.dropCard(index, squareAt(pageX, pageY));
      setDraggingIndex(null);
      setHoveredSquare(null);
    },
    [store, squareAt],
  );

  const onCancelDrag = useCallback(() => {
    store.cancel();
    setDraggingIndex(null);
    setHoveredSquare(null);
  }, [store]);

  if (!state) return <View style={styles.root} />;

  const theme = boardThemeById(equippedBoard);
  const player = state.players[HUMAN_SIDE];
  const foe = state.players[opponentOf(HUMAN_SIDE)];
  const crown = getCrown(player.crownId);

  const yourTurn = state.active === HUMAN_SIDE && state.status === 'active' && !thinking;
  const chosen = pending.kind === 'none' ? [] : pending.targets;
  const highlights = highlightsFor(store);

  const chrome = insets.top + insets.bottom + 430;
  const boardSize = Math.min(width - space.lg * 2, Math.max(220, height - chrome), 420);
  const handCardSize = Math.min(78, (width - space.lg * 2 - 56) / 4 - space.sm);

  const powerReady =
    player.powerCooldown === 0 && player.aether >= crown.powerCost && state.cardsLeft > 0;

  // The readout follows whatever the player is touching, and falls back to the
  // Crown so the panel is never an empty hole in the layout.
  const activeIndex = draggingIndex ?? inspectingIndex;
  const activeCardId = activeIndex === null ? null : player.hand[activeIndex];
  const readout: CardReadout | null = activeCardId
    ? readCard(getCard(activeCardId))
    : pending.kind === 'power'
      ? readCrown(crown)
      : null;

  const hint = readout
    ? draggingIndex !== null
      ? readout.targetCount > 1
        ? 'Drop on the first target, then tap the rest'
        : 'Drop it on a lit square'
      : 'Drag it onto the board to play it'
    : undefined;

  return (
    <View style={styles.root}>
      <Candlelight />

      <View style={[styles.header, { marginTop: insets.top }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Leave</Text>
        </Pressable>
        <Text style={styles.turnCount}>Turn {state.turn}</Text>
        <Pressable onPress={store.resign} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.danger }]}>Resign</Text>
        </Pressable>
      </View>

      <PlayerStrip state={state} side={opponentOf(HUMAN_SIDE)} label={opponentName} />

      <TurnBanner
        status={state.status}
        thinking={thinking}
        yourTurn={yourTurn}
        targeting={pending.kind !== 'none' && draggingIndex === null}
        opponentName={opponentName}
        movesLeft={state.movesLeft}
        cardsLeft={state.cardsLeft}
      />

      <View style={styles.boardWrap}>
        <Board
          state={state}
          targets={highlights.targets}
          captures={highlights.captures}
          selected={selected}
          chosen={chosen}
          hovered={hoveredSquare}
          theme={theme}
          size={boardSize}
          onTapSquare={store.tapSquare}
          onMeasure={setBoardRect}
          humanSide={HUMAN_SIDE}
        />
      </View>

      <PlayerStrip state={state} side={HUMAN_SIDE} label="You" />

      <View style={styles.readoutSlot}>
        {readout ? (
          <CardDetail readout={readout} hint={hint} />
        ) : notice ? (
          <Text style={styles.notice}>{notice}</Text>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={store.tapPower}
          accessibilityRole="button"
          style={[
            styles.power,
            pending.kind === 'power' ? styles.powerActive : null,
            !powerReady || !yourTurn ? styles.powerDisabled : null,
          ]}
        >
          <Text style={styles.powerName} numberOfLines={1}>
            {crown.powerName}
          </Text>
          <Text style={styles.powerMeta}>
            {player.powerCooldown > 0 ? `${player.powerCooldown} turn(s)` : `${crown.powerCost} aether`}
          </Text>
        </Pressable>

        {pending.kind !== 'none' && draggingIndex === null ? (
          <Button label="Cancel" variant="ghost" onPress={store.cancel} style={{ flex: 1 }} />
        ) : (
          <Button
            label="End turn"
            variant="secondary"
            onPress={store.endTurn}
            disabled={!yourTurn}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <View style={[styles.handSlot, { paddingBottom: insets.bottom + space.sm }]}>
        <Hand
          hand={player.hand}
          nextCardId={player.deck[0] ?? null}
          aether={player.aether}
          canPlay={yourTurn && state.cardsLeft > 0}
          cardSize={handCardSize}
          draggingIndex={draggingIndex}
          inspectingIndex={inspectingIndex}
          onInspect={setInspectingIndex}
          onGrab={onGrab}
          onDragMove={onDragMove}
          onDrop={onDrop}
          onCancelDrag={onCancelDrag}
        />
      </View>

      {draggingIndex !== null && activeCardId ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              transform: [
                { translateX: Animated.subtract(dragPos.x, handCardSize * 0.7) },
                { translateY: Animated.subtract(dragPos.y, handCardSize * 1.5) },
              ],
            },
          ]}
        >
          <CardFace face={faceOfCardId(activeCardId)} size={handCardSize * 1.4} lifted />
        </Animated.View>
      ) : null}

      {state.status !== 'active' ? <GameOver state={state} /> : null}
    </View>
  );
}

/** The "Your turn" call, which snaps in whenever the state behind it changes. */
function TurnBanner({
  status,
  thinking,
  yourTurn,
  targeting,
  opponentName,
  movesLeft,
  cardsLeft,
}: {
  status: MatchState['status'];
  thinking: boolean;
  yourTurn: boolean;
  targeting: boolean;
  opponentName: string;
  movesLeft: number;
  cardsLeft: number;
}) {
  const label =
    status !== 'active'
      ? 'Match over'
      : thinking
        ? `${opponentName} is thinking…`
        : yourTurn
          ? targeting
            ? 'Choose a target'
            : 'Your turn'
          : 'Opponent’s turn';

  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pop.setValue(0.86);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();
  }, [label, pop]);

  return (
    <View style={styles.banner}>
      <Animated.Text
        style={[
          styles.bannerText,
          { color: yourTurn ? colors.gold : colors.shadow, transform: [{ scale: pop }] },
        ]}
      >
        {label}
      </Animated.Text>
      {status === 'active' ? (
        <Text style={styles.actionPips}>
          {movesLeft > 0 ? '◆' : '◇'} move · {cardsLeft > 0 ? '◆' : '◇'} card
        </Text>
      ) : null}
    </View>
  );
}

/** The aether / hand / graveyard readout carried above and below the board. */
function PlayerStrip({ state, side, label }: { state: MatchState; side: Side; label: string }) {
  const player = state.players[side];
  const crown = getCrown(player.crownId);
  const faction = factionById(player.factionId);
  const active = state.active === side && state.status === 'active';

  return (
    <View style={[styles.strip, active ? styles.stripActive : null]}>
      <View style={[styles.stripCrown, { backgroundColor: faction.paper }]}>
        <Text style={{ fontSize: 17, color: faction.ink }}>{crown.glyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stripName} numberOfLines={1}>
          {label}
        </Text>
        <Text style={text.tiny} numberOfLines={1}>
          {faction.name}
        </Text>
      </View>
      <Stat glyph="✶" value={player.aether} tint={colors.aether} />
      <Stat glyph="⊞" value={player.hand.length} tint={colors.textMuted} />
      <Stat glyph="☠" value={player.graveyard.length} tint={colors.textDim} />
    </View>
  );
}

function Stat({ glyph, value, tint }: { glyph: string; value: number; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontSize: 11, color: tint }}>{glyph}</Text>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function GameOver({ state }: { state: MatchState }) {
  const router = useRouter();
  const clear = useMatch((s) => s.clear);
  const won = state.status === 'gold_wins';
  const drawn = state.status === 'draw';

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }).start();
  }, [enter]);

  const leave = () => {
    clear();
    router.replace('/');
  };

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.overlayCard,
          {
            opacity: enter,
            transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
          },
        ]}
      >
        <Text style={styles.overlayTitle}>{drawn ? 'A Draw' : won ? 'Victory' : 'Defeat'}</Text>
        <Text style={[text.small, styles.overlayBody]}>
          {drawn
            ? 'The turn limit ran out with the boards level.'
            : won
              ? 'The enemy Crown has fallen. Coins and trophies have been added to your account.'
              : 'Your Crown has fallen. You still earn a consolation purse.'}
        </Text>
        {state.log.length > 0 ? (
          <Text style={[text.tiny, styles.overlayLog]}>{state.log[state.log.length - 1]?.text}</Text>
        ) : null}
        <Button label="Back to the table" onPress={leave} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  back: { fontFamily: fonts.display, fontSize: 15, color: colors.textMuted, letterSpacing: 0.4 },
  turnCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stripActive: { borderColor: colors.gold, backgroundColor: colors.surfaceAlt },
  stripCrown: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripName: { fontFamily: fonts.display, fontSize: 15, color: colors.text, letterSpacing: 0.3 },
  stat: { alignItems: 'center', minWidth: 26 },
  statValue: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  banner: { alignItems: 'center', paddingVertical: space.xs },
  bannerText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1 },
  actionPips: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim, marginTop: 1 },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs },
  readoutSlot: { minHeight: 96, justifyContent: 'center', paddingHorizontal: space.lg, paddingTop: space.sm },
  notice: { fontFamily: fonts.body, fontSize: 12, color: colors.gold, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  power: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: colors.borderBright,
    borderBottomColor: '#1A130C',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    minHeight: 48,
  },
  powerActive: { borderColor: colors.gold, backgroundColor: glow.brass },
  powerDisabled: { opacity: 0.38 },
  powerName: { fontFamily: fonts.display, fontSize: 15, color: colors.text, letterSpacing: 0.3 },
  powerMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  handSlot: { paddingHorizontal: space.lg, paddingTop: space.md },
  ghost: { position: 'absolute', top: 0, left: 0 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,8,5,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBright,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  overlayTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.gold, letterSpacing: 1 },
  overlayBody: { textAlign: 'center' },
  overlayLog: { textAlign: 'center', fontStyle: 'italic' },
});
