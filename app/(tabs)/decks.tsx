import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { factionById } from '@/content';
import { DECK_SIZE, getCrown, validateDeck, type Deck } from '@/engine';
import { useDecks } from '@/state/decks';
import { Button } from '@/ui/components/Button';
import { CardFace, faceOfCrown } from '@/ui/components/CardFace';
import { CurrencyBar } from '@/ui/components/CurrencyBar';
import { Panel } from '@/ui/components/Panel';
import { Screen } from '@/ui/components/Screen';
import { colors, fonts, radius, space, text } from '@/ui/theme';

export default function DecksScreen() {
  const router = useRouter();
  const { decks, activeDeckId, setActive, createBlank } = useDecks();

  return (
    <Screen
      title="Decks"
      subtitle="Eight cards, one colour, one Crown"
      accessory={<CurrencyBar />}
    >
      <Panel>
        <Text style={text.small}>
          Your Crown sets your faction, and every card must share it. There's no point cap — a
          costlier deck simply deploys slower, so the trade-off is already built into the cards.
        </Text>
        <Button
          label="Build a new deck"
          onPress={() => router.push(`/deck/${createBlank()}`)}
        />
      </Panel>

      {decks.map((deck) => (
        <DeckRow
          key={deck.id}
          deck={deck}
          active={deck.id === activeDeckId}
          onEdit={() => router.push(`/deck/${deck.id}`)}
          onEquip={() => setActive(deck.id)}
        />
      ))}
    </Screen>
  );
}

function DeckRow({
  deck,
  active,
  onEdit,
  onEquip,
}: {
  deck: Deck;
  active: boolean;
  onEdit: () => void;
  onEquip: () => void;
}) {
  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);
  const check = validateDeck(deck);

  return (
    <Pressable onPress={onEdit} accessibilityRole="button">
      <View style={[styles.row, active ? { borderColor: colors.gold } : null]}>
        <CardFace face={faceOfCrown(crown)} size={92} />

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {deck.name}
          </Text>
          <Text style={text.small} numberOfLines={1}>
            {faction.name}
          </Text>

          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(100, (deck.cards.length / DECK_SIZE) * 100)}%`,
                  backgroundColor: check.valid ? faction.paper : colors.danger,
                },
              ]}
            />
          </View>
          <Text style={text.tiny}>
            {deck.cards.length}/{DECK_SIZE} cards · avg cost {check.averageCost.toFixed(1)}
          </Text>

          {check.valid ? (
            active ? (
              <Text style={[text.tiny, { color: colors.gold, fontWeight: '700' }]}>● Equipped</Text>
            ) : (
              <Pressable onPress={onEquip} hitSlop={8} accessibilityRole="button">
                <Text style={[text.tiny, { color: colors.aether, fontWeight: '700' }]}>Equip deck</Text>
              </Pressable>
            )
          ) : (
            <Text style={[text.tiny, { color: colors.danger }]} numberOfLines={2}>
              {check.errors[0]}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  info: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.text },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 4,
  },
  meterFill: { height: 6, borderRadius: 3 },
});
