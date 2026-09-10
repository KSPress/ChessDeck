import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, glow, radius, space } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
  /** Small trailing text, e.g. a price or a cooldown. */
  detail?: string;
  /** Glyph shown before the label. */
  glyph?: string;
  style?: ViewStyle;
}

/**
 * A brass plate screwed to the table. It sinks under the finger and springs
 * back — the lip along the bottom edge is what sells it as a physical object
 * rather than a rectangle.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  busy,
  detail,
  glyph,
  style,
}: Props) {
  const inert = disabled || busy;
  const press = useRef(new Animated.Value(0)).current;

  const animate = (to: number) =>
    Animated.spring(press, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: to === 0 ? 12 : 0,
    }).start();

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.965] });
  const lift = press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });

  const large = size === 'lg';
  const onGold = variant === 'primary';

  return (
    <Animated.View style={[{ transform: [{ scale }, { translateY: lift }] }, style]}>
      <Pressable
        onPress={inert ? undefined : onPress}
        onPressIn={() => !inert && animate(1)}
        onPressOut={() => !inert && animate(0)}
        accessibilityRole="button"
        // The glyph is decoration; the label alone is the accessible name.
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityState={{ disabled: !!inert }}
        style={[
          styles.base,
          large ? styles.large : null,
          variantStyles[variant],
          inert ? styles.disabled : null,
        ]}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={['#F0C25F', '#D9A441', '#B07F24']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill as never}
          />
        ) : null}

        {busy ? (
          <ActivityIndicator color={onGold ? '#2A1D06' : colors.text} size="small" />
        ) : (
          <View style={styles.inner}>
            {glyph ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[styles.glyph, large ? styles.glyphLarge : null, onGold ? styles.onGold : null]}
              >
                {glyph}
              </Text>
            ) : null}
            <Text style={[styles.label, large ? styles.labelLarge : null, onGold ? styles.onGold : null]}>
              {label}
            </Text>
            {detail ? (
              <Text style={[styles.detail, onGold ? styles.onGoldDim : null]}>{detail}</Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
    overflow: 'hidden',
    // The lip along the bottom edge that makes it read as a raised plate.
    borderBottomWidth: 3,
  },
  large: { minHeight: 64, borderRadius: radius.lg, borderBottomWidth: 4 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  disabled: { opacity: 0.38 },
  label: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.6,
  },
  labelLarge: { fontSize: 24, letterSpacing: 1.2 },
  glyph: { fontSize: 16, color: colors.text },
  glyphLarge: { fontSize: 24 },
  detail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  onGold: { color: '#2A1D06' },
  onGoldDim: { color: '#5C4310' },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.gold, borderColor: '#F3CE7C', borderBottomColor: '#7A5A20' },
  secondary: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderBright,
    borderBottomColor: '#1A130C',
  },
  ghost: { backgroundColor: glow.ink, borderColor: colors.border, borderBottomColor: '#100C08' },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger, borderBottomColor: '#6E2A16' },
};
