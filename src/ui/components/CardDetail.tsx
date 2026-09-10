import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { factionById } from '@/content';
import type { CardReadout } from '../describe';
import { colors, fonts, radius, space } from '../theme';

interface Props {
  readout: CardReadout | null;
  /** Extra hint shown at the foot, e.g. "Drag onto your muster zone". */
  hint?: string;
}

/**
 * The readout that appears while a card is held or hovered — a scrap of
 * parchment held up to the lamp. Light-on-dark everywhere else, so this reads
 * as a separate physical object rather than another panel.
 */
export function CardDetail({ readout, hint }: Props) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: readout ? 1 : 0,
      useNativeDriver: true,
      speed: 26,
      bounciness: readout ? 8 : 0,
    }).start();
  }, [readout, enter]);

  if (!readout) return null;
  const faction = factionById(readout.factionId);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sheet,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <View style={[styles.spine, { backgroundColor: faction.paper }]} />

      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.name} numberOfLines={1}>
            {readout.name}
          </Text>
          {readout.cost !== null ? (
            <View style={[styles.cost, { backgroundColor: faction.paper }]}>
              <Text style={[styles.costText, { color: faction.ink }]}>{readout.cost}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.kicker}>{readout.kicker}</Text>

        {readout.lines.filter(Boolean).map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}

        <Text style={styles.blurb}>{readout.blurb}</Text>

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flexDirection: 'row',
    backgroundColor: '#EFE2C4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#C8B78F',
    overflow: 'hidden',
    // Sits above the hand without pushing the board around.
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  spine: { width: 5 },
  body: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: '#2B2316', letterSpacing: 0.3 },
  cost: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  costText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  kicker: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: '#7A6A4C',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  line: { fontFamily: fonts.body, fontSize: 12.5, color: '#3A3020', lineHeight: 17 },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: '#6B5C42',
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 2,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.goldDim,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 3,
  },
});
