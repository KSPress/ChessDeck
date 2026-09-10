import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  /** Small trailing text, e.g. a price or a cooldown. */
  detail?: string;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, busy, detail, style }: Props) {
  const inert = disabled || busy;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !inert ? styles.pressed : null,
        inert ? styles.disabled : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.text} size="small" />
      ) : (
        <View style={styles.inner}>
          <Text style={[styles.label, variant === 'primary' ? styles.labelOnGold : null]}>{label}</Text>
          {detail ? (
            <Text style={[styles.detail, variant === 'primary' ? styles.labelOnGold : null]}>{detail}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
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
    minHeight: 46,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text },
  labelOnGold: { color: '#1A1405' },
  detail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.gold, borderColor: colors.gold },
  secondary: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderBright },
  ghost: { backgroundColor: 'transparent', borderColor: colors.border },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger },
};
