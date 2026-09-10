import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARDS, CROWNS, factionById } from '@/content';
import { canAddCard, getCrown, validateDeck, type Card, type Deck } from '@/engine';
import { useDecks } from '@/state/decks';
import { Button } from '@/ui/components/Button';
import { CardDetail } from '@/ui/components/CardDetail';
import { CardFace, faceOfCardId, faceOfCrown } from '@/ui/components/CardFace';
import { readCard, readCrown } from '@/ui/describe';
import { Panel } from '@/ui/components/Panel';
import { colors, fonts, radius, space, text } from '@/ui/theme';

const POOL_CARD_SIZE = 104;
const SLOT_CARD_SIZE = 86;

export default function DeckEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { decks, save, remove, setActive, activeDeckId } = useDecks();
  const [notice, setNotice] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);

  const deck = decks.find((d) => d.id === id);
  if (!deck) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
        <Text style={text.body}>That deck no longer exists.</Text>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const crown = getCrown(deck.crownId);
  const faction = factionById(crown.factionId);
  const check = validateDeck(deck);

  const pool = useMemo(
    () => CARDS.filter((c) => c.factionId === crown.factionId).sort((a, b) => a.cost - b.cost),
    [crown.factionId],
  );

  const update = (patch: Partial<Deck>) => save({ ...deck, ...patch });

  const pickCrown = (crownId: string) => {
    if (crownId === deck.crownId) return;
    const nextFaction = getCrown(crownId).factionId;
    if (nextFaction === crown.factionId) {
      update({ crownId });
      return;
    }
    // Decks are mono-faction, so switching colour empties the list.
    update({ crownId, cards: [] });
    setNotice(`Switched to ${factionById(nextFaction).name} — the deck was cleared.`);
  };

  const addCard = (card: Card) => {
    const allowed = canAddCard(deck.cards, deck.crownId, card.id);
    if (!allowed.ok) {
      setNotice(allowed.reason ?? 'Cannot add that card.');
      return;
    }
    setNotice(null);
    update({ cards: [...deck.cards, card.id] });
  };

  const removeAt = (index: number) => {
    setNotice(null);
    update({ cards: deck.cards.filter((_, i) => i !== index) });
  };

  const slots = [...deck.cards, ...Array(Math.max(0, 8 - deck.cards.length)).fill(null)];

  const readout = inspecting
    ? inspecting.startsWith('crown:')
      ? readCrown(getCrown(inspecting.slice('crown:'.length)))
      : readCard(CARDS.find((c) => c.id === inspecting) as Card)
    : null;

  return (
    <View style={styles.root}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>‹ Decks</Text>
        </Pressable>
        <Button
          label={activeDeckId === deck.id ? 'Equipped' : 'Equip'}
          variant={activeDeckId === deck.id ? 'ghost' : 'primary'}
          disabled={!check.valid || activeDeckId === deck.id}
          onPress={() => setActive(deck.id)}
        />
      </View>

      <TextInput
        value={deck.name}
        onChangeText={(name) => update({ name })}
        style={styles.nameInput}
        placeholder="Deck name"
        placeholderTextColor={colors.textDim}
        maxLength={24}
        accessibilityLabel="Deck name"
      />

      <Panel title="Crown" hint={`${faction.theme} · muster ${check.musterLimit}`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crownRow}>
          {CROWNS.map((option) => (
            <CardFace
              key={option.id}
              face={faceOfCrown(option)}
              size={106}
              selected={option.id === deck.crownId}
              dimmed={option.id !== deck.crownId}
              onPress={() => pickCrown(option.id)}
              onLongPress={() => setInspecting(`crown:${option.id}`)}
              onHoverIn={() => setInspecting(`crown:${option.id}`)}
              onHoverOut={() => setInspecting(null)}
            />
          ))}
        </ScrollView>
        <Text style={text.small}>
          <Text style={{ color: colors.gold, fontWeight: '700' }}>{crown.powerName}: </Text>
          {crown.blurb}
        </Text>
        <Text style={text.small}>
          <Text style={{ color: colors.gold, fontWeight: '700' }}>{faction.passiveName}: </Text>
          {faction.passiveBlurb}
        </Text>
      </Panel>

      <Panel title="Deck" hint={`${deck.cards.length}/8 · muster ${check.totalCost}/${check.musterLimit}`}>
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${Math.min(100, (check.totalCost / check.musterLimit) * 100)}%`,
                backgroundColor: check.totalCost > check.musterLimit ? colors.danger : faction.paper,
              },
            ]}
          />
        </View>

        <View style={styles.slots}>
          {slots.map((cardId: string | null, index) =>
            cardId ? (
              <CardFace
                key={`${cardId}-${index}`}
                face={faceOfCardId(cardId)}
                size={SLOT_CARD_SIZE}
                onPress={() => removeAt(index)}
                onLongPress={() => setInspecting(cardId)}
                onHoverIn={() => setInspecting(cardId)}
                onHoverOut={() => setInspecting(null)}
              />
            ) : (
              <View
                key={`empty-${index}`}
                style={[styles.emptySlot, { width: SLOT_CARD_SIZE, height: SLOT_CARD_SIZE }]}
              >
                <Text style={styles.emptyMark}>+</Text>
              </View>
            ),
          )}
        </View>
        <Text style={text.tiny}>Tap a card in the deck to take it back out.</Text>

        {notice ? <Text style={[text.small, { color: colors.danger }]}>{notice}</Text> : null}
        {check.errors.map((error) => (
          <Text key={error} style={[text.small, { color: colors.danger }]}>
            • {error}
          </Text>
        ))}
        {check.valid ? (
          <Text style={[text.small, { color: colors.success }]}>● Legal deck, ready to play.</Text>
        ) : null}
      </Panel>

      <Panel title={`${faction.people} Cards`} hint={`${pool.length} available`}>
        <View style={styles.pool}>
          {pool.map((card) => {
            const copies = deck.cards.filter((c) => c === card.id).length;
            const allowed = canAddCard(deck.cards, deck.crownId, card.id);
            return (
              <CardFace
                key={card.id}
                face={faceOfCardId(card.id)}
                size={POOL_CARD_SIZE}
                onPress={() => addCard(card)}
                onLongPress={() => setInspecting(card.id)}
                onHoverIn={() => setInspecting(card.id)}
                onHoverOut={() => setInspecting(null)}
                dimmed={!allowed.ok}
                tag={copies > 0 ? `${copies}/${card.maxCopies}` : undefined}
              />
            );
          })}
        </View>
      </Panel>

      <Button label="Delete deck" variant="danger" onPress={() => { remove(deck.id); router.back(); }} />
    </ScrollView>

    {readout ? (
      <View style={[styles.readout, { bottom: insets.bottom + space.lg }]} pointerEvents="none">
        <CardDetail readout={readout} hint="Tap to add · hold to read" />
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  nameInput: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: space.sm,
  },
  crownRow: { gap: space.sm, paddingVertical: space.xs },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  emptySlot: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMark: { fontSize: 22, color: colors.textDim },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  readout: { position: 'absolute', left: space.lg, right: space.lg },
});
