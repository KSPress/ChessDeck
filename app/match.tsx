import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { boardThemeById, factionById } from '@/content';
import { getCard, getCrown, opponentOf, type MatchState, type Side } from '@/engine';
import { HUMAN_SIDE, highlightsFor, useMatch } from '@/state/match';
import { useProfile } from '@/state/profile';
import { Board } from '@/ui/components/Board';
import { Button } from '@/ui/components/Button';
import { CardFace, faceOfCardId } from '@/ui/components/CardFace';
import { colors, fonts, radius, space, text } from '@/ui/theme';

const HAND_CARD_SIZE = 76;

export default function MatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const store = useMatch();
  const { state, thinking, selected, pending, notice, opponentName } = store;
  const equippedBoard = useProfile((s) => s.equipped.board);

  // Reached directly (deep link, reload) with no match in flight.
  useEffect(() => {
    if (!state) router.replace('/');
  }, [state, router]);

  if (!state) return <View style={styles.root} />;

  const theme = boardThemeById(equippedBoard);
  // Bounded by both axes: the strips, controls and hand need the rest of the screen.
  const boardSize = Math.min(width - space.lg * 2, height * 0.46, 420);
  const highlights = highlightsFor(store);
  const player = state.players[HUMAN_SIDE];
  const foe = state.players[opponentOf(HUMAN_SIDE)];
  const crown = getCrown(player.crownId);

  const yourTurn = state.active === HUMAN_SIDE && state.status === 'active' && !thinking;
  const chosen = pending.kind === 'none' ? [] : pending.targets;

  const powerReady =
    player.powerCooldown === 0 && player.aether >= crown.powerCost && state.cardsLeft > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Leave</Text>
        </Pressable>
        <Text style={styles.turnCount}>Turn {state.turn}</Text>
        <Pressable onPress={store.resign} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.back, { color: colors.danger }]}>Resign</Text>
        </Pressable>
      </View>

      <PlayerStrip state={state} side={opponentOf(HUMAN_SIDE)} label={opponentName} />

      <View style={styles.banner}>
        <Text style={[styles.bannerText, { color: yourTurn ? colors.gold : colors.shadow }]}>
          {state.status !== 'active'
            ? 'Match over'
            : thinking
              ? `${opponentName} is thinking…`
              : yourTurn
                ? pending.kind !== 'none'
                  ? 'Choose a target'
                  : 'Your turn'
                : 'Opponent’s turn'}
        </Text>
        {state.status === 'active' ? (
          <Text style={styles.actionPips}>
            {state.movesLeft > 0 ? '◆' : '◇'} move · {state.cardsLeft > 0 ? '◆' : '◇'} card
          </Text>
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.boardWrap}>
        <Board
          state={state}
          targets={highlights.targets}
          captures={highlights.captures}
          selected={selected}
          chosen={chosen}
          theme={theme}
          size={boardSize}
          onTapSquare={store.tapSquare}
          humanSide={HUMAN_SIDE}
        />
      </View>

      <PlayerStrip state={state} side={HUMAN_SIDE} label="You" />

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <View style={styles.spacer} />

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

        {pending.kind !== 'none' ? (
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.hand, { paddingBottom: insets.bottom + space.sm }]}
      >
        {player.hand.map((cardId, index) => {
          const card = getCard(cardId);
          const affordable = player.aether >= card.cost && state.cardsLeft > 0;
          return (
            <CardFace
              key={`${cardId}-${index}`}
              face={faceOfCardId(cardId)}
              size={HAND_CARD_SIZE}
              onPress={() => store.tapCard(index)}
              a11yLabel={`Hand ${index + 1}: ${card.name}, ${card.cost} aether`}
              selected={pending.kind === 'card' && pending.handIndex === index}
              dimmed={!affordable || !yourTurn}
            />
          );
        })}
      </ScrollView>

      {state.status !== 'active' ? <GameOver state={state} /> : null}
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
    <View style={[styles.strip, active ? { borderColor: colors.gold } : null]}>
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
      <Text style={{ fontSize: 11 }}>{glyph}</Text>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function GameOver({ state }: { state: MatchState }) {
  const router = useRouter();
  const clear = useMatch((s) => s.clear);
  const won = state.status === 'gold_wins';
  const drawn = state.status === 'draw';

  const leave = () => {
    clear();
    router.replace('/');
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>
          {drawn ? 'A Draw' : won ? 'Victory' : 'Defeat'}
        </Text>
        <Text style={[text.small, styles.overlayBody]}>
          {drawn
            ? 'The turn limit ran out with the boards level.'
            : won
              ? 'The enemy Crown has fallen. Coins and trophies have been added to your account.'
              : 'Your Crown has fallen. You still earn a consolation purse.'}
        </Text>
        {state.log.length > 0 ? (
          <Text style={[text.tiny, styles.overlayLog]}>
            {state.log[state.log.length - 1]?.text}
          </Text>
        ) : null}
        <Button label="Back to Play" onPress={leave} />
      </View>
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
  back: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textMuted },
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
  stripCrown: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  stripName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text },
  stat: { alignItems: 'center', minWidth: 26 },
  statValue: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  banner: { alignItems: 'center', paddingVertical: space.xs },
  bannerText: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  actionPips: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim, marginTop: 1 },
  boardWrap: { alignItems: 'center', paddingVertical: space.xs },
  spacer: { flex: 1, minHeight: space.sm },
  notice: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  power: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    minHeight: 46,
  },
  powerActive: { borderColor: colors.gold, backgroundColor: colors.goldDim },
  powerDisabled: { opacity: 0.4 },
  powerName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text },
  powerMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  hand: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,10,20,0.9)',
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
  overlayTitle: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.gold },
  overlayBody: { textAlign: 'center' },
  overlayLog: { textAlign: 'center', fontStyle: 'italic' },
});
