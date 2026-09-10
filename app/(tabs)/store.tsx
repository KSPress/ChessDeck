import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COSMETICS, type Cosmetic, type CosmeticKind } from '@/content';
import { useProfile } from '@/state/profile';
import { CurrencyBar } from '@/ui/components/CurrencyBar';
import { Panel } from '@/ui/components/Panel';
import { Screen } from '@/ui/components/Screen';
import { Segmented } from '@/ui/components/Segmented';
import { colors, fonts, radius, space, text } from '@/ui/theme';

type Filter = 'all' | CosmeticKind;

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'board', label: 'Boards' },
  { value: 'pieceSet', label: 'Pieces' },
  { value: 'banner', label: 'Banners' },
];

export default function StoreScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const { owned, equipped, purchase, equip } = useProfile();
  const [notice, setNotice] = useState<string | null>(null);

  const items = COSMETICS.filter((c) => filter === 'all' || c.kind === filter);

  const onPress = (cosmetic: Cosmetic) => {
    if (owned.includes(cosmetic.id)) {
      equip(cosmetic.id);
      setNotice(null);
      return;
    }
    const result = purchase(cosmetic.id);
    setNotice(result.ok ? `${cosmetic.name} unlocked.` : (result.reason ?? null));
  };

  const isEquipped = (cosmetic: Cosmetic) =>
    equipped.board === cosmetic.id ||
    equipped.pieceSet === cosmetic.id ||
    equipped.banner === cosmetic.id;

  return (
    <Screen title="Store" subtitle="Cosmetics only — never a card" accessory={<CurrencyBar />}>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      {notice ? <Text style={[text.small, { color: colors.gold }]}>{notice}</Text> : null}

      <View style={styles.grid}>
        {items.map((cosmetic) => (
          <StoreCard
            key={cosmetic.id}
            cosmetic={cosmetic}
            owned={owned.includes(cosmetic.id)}
            equipped={isEquipped(cosmetic)}
            onPress={() => onPress(cosmetic)}
          />
        ))}
      </View>

      <Panel title="Fair play">
        <Text style={text.small}>
          Everything in this tab is presentation: boards, piece sets, banners and emotes. Cards and
          Crowns are earned through play, so a purchase never changes what happens on the board.
        </Text>
      </Panel>
    </Screen>
  );
}

function StoreCard({
  cosmetic,
  owned,
  equipped,
  onPress,
}: {
  cosmetic: Cosmetic;
  owned: boolean;
  equipped: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.cardWrap}>
      <View style={[styles.card, { borderColor: equipped ? colors.gold : colors.border }]}>
        <Preview cosmetic={cosmetic} />

        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {cosmetic.name}
          </Text>
          <Text style={[text.tiny, { color: colors.rarity[cosmetic.rarity] }]}>
            {cosmetic.rarity.toUpperCase()}
          </Text>
          <Text style={text.tiny} numberOfLines={2}>
            {cosmetic.blurb}
          </Text>

          <View style={styles.priceRow}>
            {equipped ? (
              <Text style={[styles.price, { color: colors.gold }]}>● Equipped</Text>
            ) : owned ? (
              <Text style={[styles.price, { color: colors.aether }]}>Tap to equip</Text>
            ) : (
              <Text style={styles.price}>
                {cosmetic.price.currency === 'coins' ? '🪙' : '💎'} {cosmetic.price.amount.toLocaleString()}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Board skins preview as an actual mini board; everything else as its mark. */
function Preview({ cosmetic }: { cosmetic: Cosmetic }) {
  if (cosmetic.theme) {
    const cells = [];
    for (let rank = 0; rank < 4; rank += 1) {
      for (let file = 0; file < 4; file += 1) {
        cells.push(
          <View
            key={`${rank}-${file}`}
            style={{
              width: '25%',
              height: '25%',
              backgroundColor: (rank + file) % 2 === 0 ? cosmetic.theme.dark : cosmetic.theme.light,
            }}
          />,
        );
      }
    }
    return (
      <View style={[styles.preview, { backgroundColor: cosmetic.theme.frame }]}>
        <View style={styles.miniBoard}>{cells}</View>
      </View>
    );
  }

  return (
    <View style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={{ fontSize: 34, color: cosmetic.color ?? colors.text }}>
        {cosmetic.glyph ?? '♟'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cardWrap: { flexGrow: 1, flexBasis: '46%' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: { height: 96, alignItems: 'center', justifyContent: 'center' },
  miniBoard: {
    width: 72,
    height: 72,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardBody: { padding: space.md, gap: 2 },
  cardName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text },
  priceRow: { marginTop: space.xs },
  price: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text },
});
