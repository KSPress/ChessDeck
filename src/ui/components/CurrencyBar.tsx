import { StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/state/profile';
import { colors, fonts, radius, space } from '../theme';

/** The coins / gems / trophies readout carried in every dashboard header. */
export function CurrencyBar() {
  const { coins, gems, trophies } = useProfile();
  return (
    <View style={styles.row}>
      <Pill glyph="🪙" value={coins} tint={colors.gold} />
      <Pill glyph="💎" value={gems} tint={colors.aether} />
      <Pill glyph="🏆" value={trophies} tint={colors.shadow} />
    </View>
  );
}

function Pill({ glyph, value, tint }: { glyph: string; value: number; tint: string }) {
  return (
    <View style={[styles.pill, { borderColor: tint }]}>
      <Text style={styles.glyph}>{glyph}</Text>
      <Text style={[styles.value, { color: tint }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  glyph: { fontSize: 10 },
  value: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
});
