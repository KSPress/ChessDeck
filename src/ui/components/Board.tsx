import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { factionById, type BoardTheme } from '@/content';
import {
  BOARD_SIZE,
  cooldownProgress,
  fileOf,
  getPiece,
  rankOf,
  squareName,
  squareOf,
  type MatchState,
  type PieceInstance,
  type Square,
} from '@/engine';
import type { BoardHit } from '../boardHit';
import { ICON_SHIELD } from '../icons';
import { colors, radius } from '../theme';

interface Props {
  state: MatchState;
  /** Squares the current selection or dragged card can legally act on. */
  targets: readonly Square[];
  /** Subset of `targets` that hold an enemy piece. */
  captures: readonly Square[];
  selected: Square | null;
  /** Squares already chosen for a multi-target effect. */
  chosen?: readonly Square[];
  /** Square the finger is currently over while dragging a card. */
  hovered?: Square | null;
  theme: BoardTheme;
  /** Edge length of the whole board in pixels. */
  size: number;
  onTapSquare: (square: Square) => void;
  /** Reports how to turn a page-space point into a square, for drop hit-testing. */
  onMeasure?: (hit: BoardHit) => void;
  /** Whose muster zone to tint. */
  humanSide: 'gold' | 'shadow';
}

const SIDE_RING = { gold: colors.gold, shadow: colors.shadow } as const;

/**
 * React Native lays out with border-box sizing, so a container's own
 * `borderWidth` eats into the space available to its children — the outer
 * `size` passed in is the box the layout budgeted for, not the content area.
 * Cells are sized against the space left after the frame, so the 6x6 grid
 * fills the frame exactly instead of overflowing it by 2x this and getting
 * clipped by `overflow: hidden`.
 */
const BOARD_FRAME_WIDTH = 5;

/**
 * The 6x6 field of play, drawn with the human's home rank at the bottom.
 *
 * Pieces remember where they were last frame, so a move slides from the old
 * square instead of teleporting, and a freshly mustered piece drops in.
 */
export function Board({
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
  const cell = (size - BOARD_FRAME_WIDTH * 2) / BOARD_SIZE;
  const container = useRef<View>(null);

  // uid -> the square it occupied on the previous render.
  const previous = useRef(new Map<number, Square>());
  const priorSquares = new Map(previous.current);

  useEffect(() => {
    const next = new Map<number, Square>();
    for (const piece of state.board) if (piece) next.set(piece.uid, piece.square);
    previous.current = next;
  });

  const measure = () => {
    container.current?.measureInWindow((x, y, width) => {
      onMeasure?.({
        squareAt: (pageX, pageY) => {
          const fx = (pageX - x) / width;
          const fy = (pageY - y) / width;
          if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null;
          const file = Math.floor(fx * BOARD_SIZE);
          // Rank 0 is drawn along the bottom edge.
          const rank = BOARD_SIZE - 1 - Math.floor(fy * BOARD_SIZE);
          return squareOf(file, rank);
        },
      });
    });
  };

  const rows = [];
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank -= 1) {
    const squares = [];
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const square = squareOf(file, rank);
      squares.push(
        <SquareCell
          key={square}
          square={square}
          state={state}
          cell={cell}
          theme={theme}
          isTarget={targets.includes(square)}
          isCapture={captures.includes(square)}
          isSelected={selected === square}
          isChosen={chosen.includes(square)}
          isHovered={hovered === square}
          priorSquare={priorSquares}
          humanSide={humanSide}
          onPress={() => onTapSquare(square)}
        />,
      );
    }
    rows.push(
      <View key={rank} style={styles.row}>
        {squares}
      </View>,
    );
  }

  return (
    <View
      ref={container}
      onLayout={measure}
      style={[styles.board, { width: size, height: size, borderColor: theme.frame }]}
    >
      {rows}
    </View>
  );
}

interface CellProps {
  square: Square;
  state: MatchState;
  cell: number;
  theme: BoardTheme;
  isTarget: boolean;
  isCapture: boolean;
  isSelected: boolean;
  isChosen: boolean;
  isHovered: boolean;
  priorSquare: Map<number, Square>;
  humanSide: 'gold' | 'shadow';
  onPress: () => void;
}

function SquareCell({
  square,
  state,
  cell,
  theme,
  isTarget,
  isCapture,
  isSelected,
  isChosen,
  isHovered,
  priorSquare,
  humanSide,
  onPress,
}: CellProps) {
  const piece = state.board[square] ?? null;
  const file = fileOf(square);
  const rank = rankOf(square);
  const dark = (file + rank) % 2 === 0;
  const isMuster = humanSide === 'gold' ? rank < 2 : rank >= BOARD_SIZE - 2;
  // Coordinate ink sits opposite the square's own shade, the way it's inked on
  // a real carved board so it stays legible on either colour.
  const labelColor = dark ? theme.light : theme.dark;

  // Screen readers announce the square, its occupant and whether it is a legal
  // destination — which also makes the board driveable in UI tests.
  const label = [
    squareName(square),
    piece ? `${piece.owner === humanSide ? 'your' : 'enemy'} ${getPiece(piece.pieceId).name}` : 'empty',
    isTarget ? (isCapture ? 'capture' : 'legal move') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={[styles.cell, { width: cell, height: cell, backgroundColor: dark ? theme.dark : theme.light }]}
    >
      {isMuster ? (
        <View style={[styles.musterTint, { borderColor: theme.accent }]} pointerEvents="none" />
      ) : null}

      {isHovered ? (
        <View
          style={[styles.hoverFill, { backgroundColor: theme.accent, borderRadius: cell * 0.1 }]}
          pointerEvents="none"
        />
      ) : null}

      {isSelected || isChosen ? (
        <View
          style={[styles.selectRing, { borderColor: theme.accent, borderRadius: cell * 0.12 }]}
          pointerEvents="none"
        />
      ) : null}

      {piece ? (
        <PieceChip piece={piece} cell={cell} threatened={isCapture} priorSquare={priorSquare} state={state} />
      ) : isTarget ? (
        <TargetDot cell={cell} color={theme.accent} />
      ) : null}

      {isTarget && piece ? (
        <View
          style={[styles.captureRing, { borderColor: theme.accent, borderRadius: cell * 0.5 }]}
          pointerEvents="none"
        />
      ) : null}

      {rank === 0 ? (
        <Text
          style={[styles.fileLabel, { color: labelColor, fontSize: cell * 0.16 }]}
          pointerEvents="none"
          allowFontScaling={false}
        >
          {String.fromCharCode(97 + file)}
        </Text>
      ) : null}
      {file === 0 ? (
        <Text
          style={[styles.rankLabel, { color: labelColor, fontSize: cell * 0.16 }]}
          pointerEvents="none"
          allowFontScaling={false}
        >
          {rank + 1}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A legal destination, breathing gently so it reads as live. */
function TargetDot({ cell, color }: { cell: number; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: cell * 0.26,
        height: cell * 0.26,
        borderRadius: cell * 0.13,
        backgroundColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
      }}
    />
  );
}

function PieceChip({
  piece,
  cell,
  threatened,
  priorSquare,
  state,
}: {
  piece: PieceInstance;
  cell: number;
  threatened: boolean;
  priorSquare: Map<number, Square>;
  state: MatchState;
}) {
  const def = getPiece(piece.pieceId);
  const faction = factionById(def.factionId);
  const chip = cell * 0.8;
  const now = state.clockMs;
  const submerged = piece.submergedUntilMs > now;
  const shielded = piece.shieldedUntilMs > now;
  const rooted = piece.rootedUntilMs > now;
  // How much of its rest this piece still has left, 1 = just moved, 0 = ready.
  const resting = cooldownProgress(state, piece);

  // Slide in from wherever this piece stood last frame; a piece with no history
  // has just been mustered, so it drops onto the board instead.
  const from = priorSquare.get(piece.uid);
  const enter = useRef(new Animated.Value(0)).current;
  const offset = useRef({ x: 0, y: 0, fresh: from === undefined });

  if (from !== undefined && from !== piece.square) {
    offset.current = {
      x: (fileOf(from) - fileOf(piece.square)) * cell,
      // Rank 0 is drawn at the bottom, so a rank increase moves up the screen.
      y: (rankOf(piece.square) - rankOf(from)) * cell,
      fresh: false,
    };
    enter.setValue(0);
  }

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [enter, piece.square, piece.uid]);

  const { x, y, fresh } = offset.current;
  const transform = fresh
    ? [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]
    : [
        { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) },
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
      ];

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          width: chip,
          height: chip,
          borderRadius: chip * 0.28,
          backgroundColor: faction.paper,
          borderColor: SIDE_RING[piece.owner],
          // A bunkered piece is under the board: draw it sunken and faint.
          opacity: submerged ? 0.45 : 1,
          transform,
        },
        threatened ? styles.chipThreatened : null,
      ]}
    >
      <Text style={{ fontSize: chip * 0.56, color: faction.ink }} allowFontScaling={false}>
        {def.glyph}
      </Text>

      {resting > 0 ? <CooldownRing size={chip} progress={resting} color={faction.ink} /> : null}

      {shielded ? (
        <Image source={ICON_SHIELD} style={[styles.status, { bottom: -chip * 0.06, width: chip * 0.32, height: chip * 0.32 }]} />
      ) : rooted || submerged ? (
        <View style={[styles.status, { bottom: -chip * 0.06 }]}>
          <Text style={{ fontSize: chip * 0.26 }} allowFontScaling={false}>
            {submerged ? '⊟' : '❉'}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * A thin ring around a resting piece that fills in as its cooldown runs out —
 * the same "ability ready" read as Clash Royale's radial fills, so a glance
 * at the board tells you which of your pieces are about to be free.
 */
function CooldownRing({ size, progress, color }: { size: number; progress: number; color: string }) {
  const stroke = Math.max(1.5, size * 0.05);
  const ringRadius = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * ringRadius;

  return (
    <Svg
      width={size}
      height={size}
      style={{ position: 'absolute' }}
      pointerEvents="none"
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={ringRadius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        opacity={0.85}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * progress}
        strokeLinecap="round"
        // Starts the fill at 12 o'clock rather than 3 o'clock. An SVG
        // transform string, not the rotation/origin props — those get
        // converted to a `transform-origin` style on web, which React DOM
        // then flags as an unknown/miscased DOM property.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  board: {
    borderWidth: BOARD_FRAME_WIDTH,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  musterTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    opacity: 0.18,
  },
  hoverFill: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    opacity: 0.3,
  },
  selectRing: { position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderWidth: 2 },
  captureRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 2.5,
    opacity: 0.9,
  },
  fileLabel: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontWeight: '700',
    opacity: 0.65,
  },
  rankLabel: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontWeight: '700',
    opacity: 0.65,
  },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  chipThreatened: { borderColor: colors.danger },
  status: { position: 'absolute' },
});
