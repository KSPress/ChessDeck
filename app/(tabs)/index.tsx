import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { colors, fonts, radius, space, text } from '@/ui/theme';

const DIFFICULTIES: readonly { value: Difficulty; label: string }[] = [
  { value: 'squire', label: 'Squire' },
  { value: 'knight', label: 'Knight' },
  { value: 'champion', label: 'Champion' },
];

export default function PlayScreen() {
  const router = useRouter();
  const deck = useBattleDeck();
  const begin = useMatch((s) => s.begin);
  const { pveWins, pveLosses } = useProfile();
  const [difficulty, setDifficulty] = useState<Difficulty>('knight');

  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);
  const check = validateDeck(deck);

  const start = (opponent: Deck) => {
    const opponentCrown = getCrown(opponent.crownId);
    begin(deck, opponent, difficulty, opponentCrown.name);
    router.push('/match');
  };

  return (
    <Screen title="Play" subtitle="Test a deck against the five houses" accessory={<CurrencyBar />}>
      <Panel title="Your Crown" hint={`${check.totalCost} / ${check.musterLimit} muster`}>
        <View style={styles.crownRow}>
          <CardFace face={faceOfCrown(crown)} size={124} />
          <View style={styles.crownInfo}>
            <Text style={text.heading}>{deck.name}</Text>
            <Text style={[text.small, { color: faction.paper === '#C7B64A' ? colors.gold : undefined }]}>
              {faction.name} · {faction.theme}
            </Text>
            <Text style={[text.small, styles.passive]}>
              <Text style={{ color: colors.gold, fontWeight: '700' }}>{faction.passiveName}: </Text>
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

      <Panel title="Difficulty">
        <Segmented options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <Text style={text.small}>
          {difficulty === 'squire'
            ? 'Blunders often. Good for learning a new faction.'
            : difficulty === 'knight'
              ? 'Punishes hanging pieces and reads one reply ahead.'
              : 'Searches every opening and never gives away material.'}
        </Text>
      </Panel>

      <Panel title="Trials" hint={`${pveWins}W · ${pveLosses}L`}>
        <Text style={text.small}>
          Each house fields its own starter deck. Beat one to earn coins and trophies.
        </Text>
        {STARTER_DECKS.map((opponent) => (
          <OpponentRow key={opponent.id} deck={opponent} onPress={() => start(opponent)} />
        ))}
      </Panel>
    </Screen>
  );
}

function OpponentRow({ deck, onPress }: { deck: Deck; onPress: () => void }) {
  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.opponent}>
      <View style={[styles.swatch, { backgroundColor: faction.paper }]}>
        <Text style={{ fontSize: 20, color: faction.ink }}>{crown.glyph}</Text>
      </View>
      <View style={styles.opponentText}>
        <Text style={styles.opponentName}>{crown.name}</Text>
        <Text style={text.small} numberOfLines={1}>
          {faction.name} · {deck.name}
        </Text>
      </View>
      <Text style={styles.chevron}>▸</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crownRow: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  crownInfo: { flex: 1, gap: 2 },
  passive: { marginTop: space.xs, lineHeight: 17 },
  opponent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  swatch: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  opponentText: { flex: 1 },
  opponentName: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text },
  chevron: { color: colors.textDim, fontSize: 16 },
});
