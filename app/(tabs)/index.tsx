import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { STARTER_DECKS, factionById } from '@/content';
import { getCrown, validateDeck, type Deck, type Difficulty } from '@/engine';
import { useBattleDeck } from '@/state/decks';
import { useMatch } from '@/state/match';
import { useProfile } from '@/state/profile';
import { Button } from '@/ui/components/Button';
import { CardFace, faceOfCrown } from '@/ui/components/CardFace';
import { CurrencyBar } from '@/ui/components/CurrencyBar';
import { Panel } from '@/ui/components/Panel';
import { Screen } from '@/ui/components/Screen';
import { Segmented } from '@/ui/components/Segmented';
import { colors, fonts, glow, radius, space, text } from '@/ui/theme';

const DIFFICULTIES: readonly { value: Difficulty; label: string }[] = [
  { value: 'squire', label: 'Squire' },
  { value: 'knight', label: 'Knight' },
  { value: 'champion', label: 'Champion' },
];

const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  squire: 'Blunders often. Good for learning a new faction.',
  knight: 'Punishes hanging pieces and reads one reply ahead.',
  champion: 'Searches every opening and never gives away material.',
};

export default function PlayScreen() {
  const router = useRouter();
  const deck = useBattleDeck();
  const begin = useMatch((s) => s.begin);
  const { pveWins, pveLosses } = useProfile();

  const [difficulty, setDifficulty] = useState<Difficulty>('knight');
  const [opponentId, setOpponentId] = useState<string>(
    STARTER_DECKS.find((d) => d.crownId !== deck.crownId)?.id ?? (STARTER_DECKS[0] as Deck).id,
  );

  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);
  const check = validateDeck(deck);

  const opponent = STARTER_DECKS.find((d) => d.id === opponentId) ?? (STARTER_DECKS[0] as Deck);
  const opponentCrown = getCrown(opponent.crownId);
  const opponentFaction = factionById(opponentCrown.factionId);

  const play = () => {
    begin(deck, opponent, difficulty, opponentCrown.name);
    router.push('/match');
  };

  return (
    <Screen title="The Table" subtitle="Sit down against one of the five houses" accessory={<CurrencyBar />}>
      <Panel title="Your Crown" hint={`${check.totalCost} / ${check.musterLimit} muster`}>
        <View style={styles.crownRow}>
          <CardFace face={faceOfCrown(crown)} size={118} />
          <View style={styles.crownInfo}>
            <Text style={text.heading}>{deck.name}</Text>
            <Text style={text.small}>
              {faction.name} · {faction.theme}
            </Text>
            <Text style={[text.small, styles.passive]}>
              <Text style={styles.passiveName}>{faction.passiveName}: </Text>
              {faction.passiveBlurb}
            </Text>
            <Button
              label="Change deck"
              variant="ghost"
              onPress={() => router.push('/decks')}
              style={{ marginTop: space.sm }}
            />
          </View>
        </View>
      </Panel>

      <Panel title="Your Opponent" hint={`${pveWins}W · ${pveLosses}L`}>
        <View style={styles.crests}>
          {STARTER_DECKS.map((option) => (
            <Crest
              key={option.id}
              deck={option}
              selected={option.id === opponentId}
              onPress={() => setOpponentId(option.id)}
            />
          ))}
        </View>
        <Text style={text.small}>
          <Text style={styles.passiveName}>{opponentCrown.name} · </Text>
          {opponentFaction.name}. {opponentFaction.passiveName}: {opponentFaction.passiveBlurb}
        </Text>
      </Panel>

      <Panel title="Difficulty">
        <Segmented options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <Text style={text.small}>{DIFFICULTY_BLURB[difficulty]}</Text>
      </Panel>

      <Button
        label="Play"
        glyph="⚔"
        size="lg"
        onPress={play}
        disabled={!check.valid}
        detail={check.valid ? undefined : 'Fix your deck first'}
      />
    </Screen>
  );
}

/** A faction crest you pick before committing to the match. */
function Crest({ deck, selected, onPress }: { deck: Deck; selected: boolean; onPress: () => void }) {
  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 10,
    }).start();
  }, [selected, lift]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${crown.name}, ${faction.name}`}
      style={styles.crestSlot}
    >
      <Animated.View
        style={[
          styles.crest,
          {
            backgroundColor: faction.paper,
            borderColor: selected ? colors.gold : 'rgba(0,0,0,0.45)',
            transform: [
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: 26, color: faction.ink }}>{crown.glyph}</Text>
      </Animated.View>
      <Text style={[styles.crestName, selected ? styles.crestNameOn : null]} numberOfLines={1}>
        {faction.people}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crownRow: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  crownInfo: { flex: 1, gap: 2 },
  passive: { marginTop: space.xs },
  passiveName: { color: colors.gold, fontWeight: '700' },
  crests: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  crestSlot: { alignItems: 'center', gap: 5, flex: 1 },
  crest: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  crestName: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  crestNameOn: { color: colors.gold },
});
