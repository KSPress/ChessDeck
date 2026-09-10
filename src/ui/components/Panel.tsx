import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { DIVIDER_CAP_LEFT, DIVIDER_CAP_RIGHT, DIVIDER_MID } from '../icons';
import { colors, radius, space, text } from '../theme';

const DIVIDER_HEIGHT = 8;
const DIVIDER_CAP_ASPECT = 15 / 64;

interface Props {
  title?: string;
  hint?: string;
  children?: ReactNode;
  style?: ViewStyle;
}

/** The standard bordered container every dashboard section sits in. */
export function Panel({ title, hint, children, style }: Props) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <View>
          <View style={styles.head}>
            <Text style={text.heading}>{title}</Text>
            {hint ? <Text style={text.small}>{hint}</Text> : null}
          </View>
          <Divider />
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** The thin ornamental rule printed under a panel's heading, cap to cap. */
function Divider() {
  const capWidth = DIVIDER_HEIGHT * DIVIDER_CAP_ASPECT;
  return (
    <View style={styles.divider}>
      <Image source={DIVIDER_CAP_LEFT} resizeMode="stretch" style={{ width: capWidth, height: DIVIDER_HEIGHT }} />
      <Image source={DIVIDER_MID} resizeMode="stretch" style={{ flex: 1, height: DIVIDER_HEIGHT }} />
      <Image source={DIVIDER_CAP_RIGHT} resizeMode="stretch" style={{ width: capWidth, height: DIVIDER_HEIGHT }} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs, opacity: 0.75 },
});
