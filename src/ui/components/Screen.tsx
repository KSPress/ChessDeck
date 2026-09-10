import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, text } from '../theme';
import { Candlelight } from './Candlelight';

interface Props {
  title: string;
  subtitle?: string;
  /** Rendered at the top-right of the header, e.g. a currency bar. */
  accessory?: ReactNode;
  children: ReactNode;
  /** Set false for screens that manage their own layout (the match board). */
  scroll?: boolean;
}

export function Screen({ title, subtitle, accessory, children, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Candlelight />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={text.title}>{title}</Text>
          {subtitle ? <Text style={[text.small, styles.subtitle]}>{subtitle}</Text> : null}
        </View>
        {accessory}
      </View>
      <Body
        style={styles.body}
        {...(scroll
          ? { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false }
          : {})}
      >
        {children}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: 2 },
  body: { flex: 1 },
  scrollContent: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
});
