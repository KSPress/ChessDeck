import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, space, text } from '../theme';

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
        <View style={styles.head}>
          <Text style={text.heading}>{title}</Text>
          {hint ? <Text style={text.small}>{hint}</Text> : null}
        </View>
      ) : null}
      {children}
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
});
