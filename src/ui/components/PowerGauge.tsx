import { Image, View } from 'react-native';

import { POWER_CAP_LEFT, POWER_CAP_RIGHT, POWER_FILL, POWER_MID } from '../icons';

const CAP_ASPECT = 24 / 64;

interface Props {
  /** How charged the power is, 0 to 1. 1 means ready to invoke. */
  fraction: number;
  height?: number;
}

/** The Crown power's cooldown, painted as a small wood-and-ember gauge. */
export function PowerGauge({ fraction, height = 10 }: Props) {
  const fill = Math.max(0, Math.min(1, fraction));
  const capWidth = height * CAP_ASPECT;

  return (
    <View style={{ flexDirection: 'row', height, alignItems: 'stretch' }}>
      <Image source={POWER_CAP_LEFT} resizeMode="stretch" style={{ width: capWidth, height }} />
      <View style={{ flex: 1, height, overflow: 'hidden', marginHorizontal: -1 }}>
        <Image source={POWER_MID} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${fill * 100}%`,
            overflow: 'hidden',
          }}
        >
          <Image source={POWER_FILL} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
        </View>
      </View>
      <Image source={POWER_CAP_RIGHT} resizeMode="stretch" style={{ width: capWidth, height }} />
    </View>
  );
}
