import { useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { factionById, type BoardTheme } from '@/content';
import {
  cooldownProgress,
  fileOf,
  getPiece,
  rankOf,
  squareName,
  type MatchState,
  type Square,
} from '@/engine';
import type { BoardHit } from '../boardHit';
import { ICON_SHIELD, PIECE_ART_ASPECT, pieceArtFor } from '../icons';
import { diamondPoints, project } from '../isometric';
import { colors } from '../theme';

interface Props {
  state: MatchState;
  targets: readonly Square[];
  captures: readonly Square[];
  selected: Square | null;
  chosen?: readonly Square[];
  hovered?: Square | null;
  theme: BoardTheme;
  /** Width budget in pixels; the diamond renders half as tall as this. */
  size: number;
  onTapSquare: (square: Square) => void;
  onMeasure?: (hit: BoardHit) => void;
  humanSide: 'gold' | 'shadow';
}

const SIDE_RING = { gold: colors.gold, shadow: colors.shadow } as const;

/** How tall the isometric board renders for a given width budget. */
export function isoHeightFor(size: number): number {
  return project(size).height;
}

/**
 * An alternate camera on the same 6x6 grid, tilted into a 2D isometric
 * diamond rather than the flat top-down view. Purely a different way to look
 * at the identical `MatchState` — every square, piece and highlight the flat
 * board shows, this shows too, just projected differently and hit-tested
 * through the inverse of that same projection (see `isometric.ts`).
 */
export function IsometricBoard({
  state,
  targets,
  captures,
  selected,
  chosen = [],
  hovered,
  theme,
  size,
  onTapSquare,
  onMeasure,
  humanSide,
}: Props) {
  const proj = useMemo(() => project(size), [size]);
  const container = useRef<View>(null);

  const measure = () => {
    container.current?.measureInWindow((x, y) => {
      onMeasure?.({
        squareAt: (pageX, pageY) => proj.fromScreen(pageX - x, pageY - y),
      });
    });
  };

  const onPress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const square = proj.fromScreen(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    if (square !== null) onTapSquare(square);
  };

  const tiles: React.ReactNode[] = [];
  const overlays: React.ReactNode[] = [];

  for (let square = 0; square < state.board.length; square += 1) {
    const { x, y } = proj.toScreen(square);
    const dark = (fileOf(square) + rankOf(square)) % 2 === 0;
    const rank = rankOf(square);
    const isMuster = humanSide === 'gold' ? rank < 2 : rank >= 6 - 2;
    const isTarget = targets.includes(square);
    const isCapture = captures.includes(square);
    const isSelected = selected === square || chosen.includes(square);
    const isHovered = hovered === square;

    tiles.push(
      <Polygon
        key={`tile-${square}`}
        points={diamondPoints(x, y, proj.tileW, proj.tileH)}
        fill={dark ? theme.dark : theme.light}
        stroke={theme.frame}
        strokeWidth={0.5}
        opacity={0.98}
      />,
    );

    if (isMuster) {
      overlays.push(
        <Polygon
          key={`muster-${square}`}
          points={diamondPoints(x, y, proj.tileW * 0.92, proj.tileH * 0.92)}
          fill="none"
          stroke={theme.accent}
          strokeWidth={1}
          opacity={0.22}
        />,
      );
    }
    if (isHovered) {
      overlays.push(
        <Polygon
          key={`hover-${square}`}
          points={diamondPoints(x, y, proj.tileW * 0.88, proj.tileH * 0.88)}
          fill={theme.accent}
          opacity={0.3}
        />,
      );
    }
    if (isSelected) {
      overlays.push(
        <Polygon
          key={`sel-${square}`}
          points={diamondPoints(x, y, proj.tileW * 0.9, proj.tileH * 0.9)}
          fill="none"
          stroke={theme.accent}
          strokeWidth={2}
          opacity={0.9}
        />,
      );
    }
    if (isTarget && !state.board[square]) {
      overlays.push(
        <Circle key={`dot-${square}`} cx={x} cy={y} r={proj.tileH * 0.22} fill={theme.accent} opacity={0.85} />,
      );
    }
    if (isTarget && state.board[square]) {
      overlays.push(
        <Polygon
          key={`cap-${square}`}
          points={diamondPoints(x, y, proj.tileW * 0.82, proj.tileH * 0.82)}
          fill="none"
          stroke={theme.accent}
          strokeWidth={2.5}
          opacity={0.9}
        />,
      );
    }
  }

  return (
    <Pressable
      ref={container}
      onLayout={measure}
      onPress={onPress}
      accessibilityRole="none"
      style={{ width: proj.width, height: proj.height }}
    >
      <Svg width={proj.width} height={proj.height} style={StyleSheet.absoluteFill as never}>
        {tiles}
        {overlays}
      </Svg>

      {state.board.map((piece, square) => {
        if (!piece) return null;
        const { x, y } = proj.toScreen(square);
        return (
          <IsoPiece
            key={piece.uid}
            square={square}
            x={x}
            y={y}
            chip={proj.tileH * 1.5}
            threatened={captures.includes(square)}
            state={state}
          />
        );
      })}
    </Pressable>
  );
}

function IsoPiece({
  square,
  x,
  y,
  chip,
  threatened,
  state,
}: {
  square: Square;
  x: number;
  y: number;
  chip: number;
  threatened: boolean;
  state: MatchState;
}) {
  const piece = state.board[square];
  if (!piece) return null;
  const def = getPiece(piece.pieceId);
  const faction = factionById(def.factionId);
  const art = pieceArtFor(def.archetype, piece.owner);
  const now = state.clockMs;
  const submerged = piece.submergedUntilMs > now;
  const shielded = piece.shieldedUntilMs > now;
  const rooted = piece.rootedUntilMs > now;
  const resting = cooldownProgress(state, piece);
  const ring = { borderColor: threatened ? colors.danger : SIDE_RING[piece.owner] };

  // A standing figure reads best on a tilted board: a small footprint plate
  // sits where the flat view's chip would, and the figure rises straight up
  // from it — the same trick every isometric board game uses to keep pieces
  // legible while the ground beneath them recedes.
  if (art) {
    const figureHeight = chip * 1.05;
    const figureWidth = figureHeight * PIECE_ART_ASPECT;
    const baseWidth = chip * 0.6;
    const baseHeight = chip * 0.3;
    const boxHeight = figureHeight + baseHeight * 0.6;

    return (
      <View
        pointerEvents="none"
        accessibilityLabel={squareName(square)}
        style={{ position: 'absolute', left: x - chip / 2, top: y - boxHeight, width: chip, height: boxHeight }}
      >
        <View
          style={[
            styles.base,
            ring,
            {
              width: baseWidth,
              height: baseHeight,
              borderRadius: baseHeight / 2,
              backgroundColor: faction.paper,
              left: (chip - baseWidth) / 2,
              opacity: submerged ? 0.5 : 1,
            },
          ]}
        />
        <Image
          source={art}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: (chip - figureWidth) / 2,
            top: 0,
            width: figureWidth,
            height: figureHeight,
            opacity: submerged ? 0.45 : 1,
          }}
        />
        {resting > 0 ? (
          <View
            style={[
              styles.pip,
              { right: chip / 2 - baseWidth / 2 - 2, backgroundColor: colors.aether, opacity: 0.5 + resting * 0.5 },
            ]}
          />
        ) : null}
        {shielded ? (
          <Image
            source={ICON_SHIELD}
            style={[styles.status, { width: chip * 0.3, height: chip * 0.3, left: (chip - chip * 0.3) / 2 }]}
          />
        ) : rooted || submerged ? (
          <View style={[styles.status, { left: chip / 2 - chip * 0.12 }]}>
            <Text style={{ fontSize: chip * 0.24 }} allowFontScaling={false}>
              {submerged ? '⊟' : '❉'}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  // Fairy pieces have no painted figure, so they keep the original badge.
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={squareName(square)}
      style={[
        styles.chip,
        ring,
        {
          left: x - chip / 2,
          top: y - chip * 0.86,
          width: chip,
          height: chip,
          borderRadius: chip * 0.26,
          backgroundColor: faction.paper,
          opacity: submerged ? 0.45 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: chip * 0.52, color: faction.ink }} allowFontScaling={false}>
        {def.glyph}
      </Text>
      {resting > 0 ? (
        <View style={[styles.pip, { backgroundColor: colors.aether, opacity: 0.5 + resting * 0.5 }]} />
      ) : null}
      {shielded ? (
        <Image source={ICON_SHIELD} style={[styles.status, { width: chip * 0.3, height: chip * 0.3 }]} />
      ) : rooted || submerged ? (
        <View style={styles.status}>
          <Text style={{ fontSize: chip * 0.24 }} allowFontScaling={false}>
            {submerged ? '⊟' : '❉'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  base: {
    position: 'absolute',
    bottom: 0,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  status: { position: 'absolute', bottom: -2 },
  pip: { position: 'absolute', top: 0, width: 6, height: 6, borderRadius: 3 },
});
