import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { boardThemeById, factionById } from '@/content';
import {
  AETHER_CAP,
  getCard,
  getCrown,
  opponentOf,
  timeRemainingMs,
  type MatchState,
  type Side,
  type Square,
} from '@/engine';
import { HUMAN_SIDE, highlightsFor, useMatch } from '@/state/match';
import { useProfile } from '@/state/profile';
import { readCard, readCrown, type CardReadout } from '@/ui/describe';
import type { BoardHit } from '@/ui/boardHit';
import { Board } from '@/ui/components/Board';
import { Button } from '@/ui/components/Button';
import { Candlelight } from '@/ui/components/Candlelight';
import { CardDetail } from '@/ui/components/CardDetail';
import { CardFace, faceOfCardId } from '@/ui/components/CardFace';
import { ElixirBar } from '@/ui/components/ElixirBar';
import { Hand } from '@/ui/components/Hand';
import { PowerGauge } from '@/ui/components/PowerGauge';
import { IsometricBoard, isoHeightFor } from '@/ui/components/IsometricBoard';
import { ICON_BANNER, ICON_COIN, ICON_CURSOR, ICON_LOG, ICON_MEAT, pennantFor } from '@/ui/icons';
import { colors, fonts, glow, radius, space, text } from '@/ui/theme';

type ViewMode = 'flat' | 'iso';

/** "MM:SS" countdown, never negative. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const store = useMatch();
  const { state, thinking, selected, pending, notice, opponentName } = store;
  const equippedBoard = useProfile((s) => s.equipped.board);

  const [viewMode, setViewMode] = useState<ViewMode>('flat');
  const [boardHit, setBoardHit] = useState<BoardHit | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [inspectingIndex, setInspectingIndex] = useState<number | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Reached directly (deep link, reload) with no match in flight.
  useEffect(() => {
    if (!state) router.replace('/');
  }, [state, router]);

  const squareAt = useCallback(
    (pageX: number, pageY: number): Square | null => boardHit?.squareAt(pageX, pageY) ?? null,
    [boardHit],
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
  const crown = getCrown(player.crownId);

  const battle = state.phase === 'battle' && state.status === 'active';
  const targeting = pending.kind !== 'none' && draggingIndex === null;
  const chosen = pending.kind === 'none' ? [] : pending.targets;
  const highlights = highlightsFor(store);

  const chrome = insets.top + insets.bottom + 430;
  const boardWidth = Math.min(width - space.lg * 2, Math.max(220, height - chrome), 420);
  const boardHeight = viewMode === 'iso' ? isoHeightFor(boardWidth) : boardWidth;
  const handCardSize = Math.min(78, (width - space.lg * 2 - 56) / 4 - space.sm);

  const powerReady = battle && player.powerReadyAtMs <= state.clockMs && player.aether >= crown.powerCost;
  const powerCooldownFraction =
    crown.powerCooldownMs > 0
      ? 1 - Math.max(0, player.powerReadyAtMs - state.clockMs) / crown.powerCooldownMs
      : 1;

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
        <Pressable
          onPress={() => setViewMode((m) => (m === 'flat' ? 'iso' : 'flat'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${viewMode === 'flat' ? 'isometric' : 'flat'} view`}
          style={styles.viewToggle}
        >
          <Text style={styles.viewToggleText}>{viewMode === 'flat' ? '◇ Isometric' : '▭ Flat'}</Text>
        </Pressable>
        <Pressable onPress={store.resign} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.danger }]}>Resign</Text>
        </Pressable>
      </View>

      <PlayerStrip state={state} side={opponentOf(HUMAN_SIDE)} label={opponentName} />

      <MatchBanner state={state} thinking={thinking} targeting={targeting} opponentName={opponentName} />

      <View style={[styles.boardWrap, { minHeight: boardHeight + space.lg }]}>
        {viewMode === 'flat' ? (
          <Board
            state={state}
            targets={highlights.targets}
            captures={highlights.captures}
            selected={selected}
            chosen={chosen}
            hovered={hoveredSquare}
            theme={theme}
            size={boardWidth}
            onTapSquare={store.tapSquare}
            onMeasure={setBoardHit}
            humanSide={HUMAN_SIDE}
          />
        ) : (
          <IsometricBoard
            state={state}
            targets={highlights.targets}
            captures={highlights.captures}
            selected={selected}
            chosen={chosen}
            hovered={hoveredSquare}
            theme={theme}
            size={boardWidth}
            onTapSquare={store.tapSquare}
            onMeasure={setBoardHit}
            humanSide={HUMAN_SIDE}
          />
        )}
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
            !powerReady ? styles.powerDisabled : null,
          ]}
        >
          <Text style={styles.powerName} numberOfLines={1}>
            {crown.powerName}
          </Text>
          <Text style={styles.powerMeta}>
            {player.powerReadyAtMs > state.clockMs
              ? `${Math.ceil((player.powerReadyAtMs - state.clockMs) / 1000)}s`
              : `${crown.powerCost} aether`}
          </Text>
          <View style={styles.powerGauge}>
            <PowerGauge fraction={powerCooldownFraction} height={8} />
          </View>
        </Pressable>

        {pending.kind !== 'none' && draggingIndex === null ? (
          <Button label="Cancel" variant="ghost" onPress={store.cancel} style={{ flex: 1 }} />
        ) : null}
      </View>

      <View style={[styles.handSlot, { paddingBottom: insets.bottom + space.sm }]}>
        <Hand
          hand={player.hand}
          nextCardId={player.deck[0] ?? null}
          aether={player.aether}
          canPlay={battle}
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

/**
 * The banner above the board. Placement gets its own instructions; once the
 * battle starts it carries the running match clock instead of a "your turn"
 * call — there is no turn to announce any more.
 */
function MatchBanner({
  state,
  thinking,
  targeting,
  opponentName,
}: {
  state: MatchState;
  thinking: boolean;
  targeting: boolean;
  opponentName: string;
}) {
  let label: string;
  let tint: string = colors.gold;
  let showTapHint = false;

  if (state.status !== 'active') {
    label = 'Match over';
  } else if (state.phase === 'placement') {
    const waiting = state.players[HUMAN_SIDE].crownPlaced;
    label = waiting ? `Waiting for ${opponentName}…` : 'Choose where to stand your Crown';
    showTapHint = !waiting;
  } else if (targeting) {
    label = 'Choose a target';
    showTapHint = true;
  } else {
    label = 'The battle rages';
    tint = colors.text;
  }

  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pop.setValue(0.86);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();
  }, [label, pop]);

  return (
    <View style={styles.banner}>
      <Animated.View style={[styles.bannerRow, { transform: [{ scale: pop }] }]}>
        {showTapHint ? <Image source={ICON_CURSOR} style={styles.bannerIcon} /> : null}
        <Animated.Text style={[styles.bannerText, { color: tint }]} numberOfLines={2}>
          {label}
        </Animated.Text>
      </Animated.View>
      {state.status === 'active' && state.phase === 'battle' ? (
        <View style={styles.clockRow}>
          <Text style={styles.clockText}>{formatClock(timeRemainingMs(state))}</Text>
          {thinking ? <Text style={styles.clockPulse}>{opponentName} moved</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** The aether / hand / graveyard readout carried above and below the board. */
function PlayerStrip({ state, side, label }: { state: MatchState; side: Side; label: string }) {
  const player = state.players[side];
  const crown = getCrown(player.crownId);
  const faction = factionById(player.factionId);
  const fill = Math.max(0, Math.min(1, player.aether / AETHER_CAP));

  return (
    <View style={styles.strip}>
      <View style={styles.stripCrown}>
        <Image source={pennantFor(player.factionId)} resizeMode="stretch" style={StyleSheet.absoluteFill} />
        <Text style={[styles.stripCrownGlyph, { color: faction.ink }]}>{crown.glyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stripName} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.aetherTrack}>
          <ElixirBar factionId={player.factionId} fraction={fill} height={14} />
        </View>
      </View>
      <Stat glyph="✶" value={player.aether.toFixed(1)} tint={colors.aether} />
      <Stat glyph="⊞" value={player.hand.length} tint={colors.textMuted} />
      <Stat glyph="☠" value={player.graveyard.length} tint={colors.textDim} />
    </View>
  );
}

function Stat({ glyph, value, tint }: { glyph: string; value: number | string; tint: string }) {
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
        {won ? <Image source={ICON_BANNER} style={styles.overlayBanner} /> : null}
        <Text style={styles.overlayTitle}>{drawn ? 'A Draw' : won ? 'Victory' : 'Defeat'}</Text>
        <Text style={[text.small, styles.overlayBody]}>
          {drawn
            ? 'The clock ran out with the boards level.'
            : won
              ? 'The enemy Crown has fallen. Coins and trophies have been added to your account.'
              : 'Your Crown has fallen. You still earn a consolation purse.'}
        </Text>
        {won ? (
          <View style={styles.overlayLoot}>
            <Image source={ICON_COIN} style={styles.overlayLootIcon} />
            <Image source={ICON_MEAT} style={styles.overlayLootIcon} />
            <Image source={ICON_LOG} style={styles.overlayLootIcon} />
          </View>
        ) : null}
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
  viewToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
  },
  viewToggleText: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, fontWeight: '700' },
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
    overflow: 'hidden',
  },
  stripCrown: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  stripCrownGlyph: { fontSize: 15, marginTop: 11 },
  stripName: { fontFamily: fonts.display, fontSize: 15, color: colors.text, letterSpacing: 0.3 },
  aetherTrack: { marginTop: 4, width: '80%' },
  stat: { alignItems: 'center', minWidth: 30 },
  statValue: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  banner: { alignItems: 'center', paddingVertical: space.xs, paddingHorizontal: space.xl },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: space.xs },
  bannerIcon: { width: 16, height: 16, marginTop: 4, flexShrink: 0 },
  bannerText: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 1, textAlign: 'center', flexShrink: 1 },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  clockText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  clockPulse: { fontFamily: fonts.body, fontSize: 10, color: colors.shadow },
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
  powerGauge: { marginTop: 6, alignSelf: 'stretch' },
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
  overlayBanner: { width: 40, height: 40, marginBottom: -space.xs },
  overlayTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.gold, letterSpacing: 1 },
  overlayBody: { textAlign: 'center' },
  overlayLoot: { flexDirection: 'row', gap: space.md },
  overlayLootIcon: { width: 28, height: 28 },
  overlayLog: { textAlign: 'center', fontStyle: 'italic' },
});
