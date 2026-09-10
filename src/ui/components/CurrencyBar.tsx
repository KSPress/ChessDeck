import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { useProfile } from '@/state/profile';
import { ICON_COIN } from '../icons';
import { colors, fonts, radius, space } from '../theme';

/** The coins / gems / trophies readout carried in every dashboard header. */
export function CurrencyBar() {
  const { coins, gems, trophies } = useProfile();
  return (
    <View style={styles.row}>
      <Pill icon={ICON_COIN} value={coins} tint={colors.gold} />
      <Pill glyph="💎" value={gems} tint={colors.aether} />
      <Pill glyph="🏆" value={trophies} tint={colors.shadow} />
    </View>
  );
}

function Pill({
  glyph,
  icon,
  value,
  tint,
}: {
  glyph?: string;
  icon?: ImageSourcePropType;
  value: number;
  tint: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: tint }]}>
      {icon ? <Image source={icon} style={styles.icon} /> : <Text style={styles.glyph}>{glyph}</Text>}
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
  icon: { width: 12, height: 12 },
  value: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
});
