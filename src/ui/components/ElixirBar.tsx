import { Image, View } from 'react-native';

import type { FactionId } from '@/engine';
import { ELIXIR_CAP_RIGHT, ELIXIR_FILL, ELIXIR_MID, elixirCapFor } from '../icons';
import { radius } from '../theme';

/** Native pixel size of each painted slice, so a target height keeps its aspect. */
const CAP_LEFT_ASPECT = 105 / 128;
const CAP_RIGHT_ASPECT = 92 / 128;

interface Props {
  factionId: FactionId;
  /** Current charge, 0 to 1. */
  fraction: number;
  height?: number;
}

/**
 * The elixir gauge: a faction-coloured rivet cap, a plain wood plank, and a
 * plain pointed cap, with the current charge painted across the plank as a
 * warm gradient — the bar that says how close you are to affording the next
 * card, built from the same painted kit a health or cooldown bar would use.
 */
export function ElixirBar({ factionId, fraction, height = 18 }: Props) {
  const fill = Math.max(0, Math.min(1, fraction));
  const capLeftWidth = height * CAP_LEFT_ASPECT;
  const capRightWidth = height * CAP_RIGHT_ASPECT;

  return (
    <View style={{ flexDirection: 'row', height, alignItems: 'stretch' }}>
      <Image
        source={elixirCapFor(factionId)}
        resizeMode="stretch"
        style={{ width: capLeftWidth, height }}
      />
      <View style={{ flex: 1, height, overflow: 'hidden', marginHorizontal: -1 }}>
        <Image source={ELIXIR_MID} resizeMode="stretch" style={{ width: '100%', height: '100%' }} />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${fill * 100}%`,
            overflow: 'hidden',
            borderRadius: radius.sm,
          }}
        >
          <Image
            source={ELIXIR_FILL}
            resizeMode="stretch"
            style={{ width: '100%', height: '100%', opacity: 0.92 }}
          />
        </View>
      </View>
      <Image
        source={ELIXIR_CAP_RIGHT}
        resizeMode="stretch"
        style={{ width: capRightWidth, height }}
      />
    </View>
  );
}
