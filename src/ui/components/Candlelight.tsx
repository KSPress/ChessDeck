import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/**
 * The warm pool of lamplight every screen sits in. Two soft washes — one from
 * the top, one from the floor — so the panelling never reads as flat black.
 */
export function Candlelight() {
  return (
    <View style={StyleSheet.absoluteFill as never} pointerEvents="none">
      <LinearGradient
        colors={['rgba(217,164,65,0.10)', 'rgba(217,164,65,0.02)', 'transparent']}
        locations={[0, 0.35, 1]}
        style={styles.wash}
      />
      <LinearGradient
        colors={['transparent', 'rgba(201,85,46,0.07)']}
        locations={[0.55, 1]}
        style={styles.wash}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
