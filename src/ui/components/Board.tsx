import { Pressable, StyleSheet, Text, View } from 'react-native';

import { factionById, type BoardTheme } from '@/content';
import {
  BOARD_SIZE,
  fileOf,
  getPiece,
  rankOf,
  squareName,
  squareOf,
  type MatchState,
  type Square,
} from '@/engine';
import { colors, radius } from '../theme';

interface Props {
  state: MatchState;
  /** Squares the current selection can legally act on. */
  targets: readonly Square[];
  /** Subset of `targets` that hold an enemy piece. */
  captures: readonly Square[];
  selected: Square | null;
  /** Squares already chosen for a multi-target effect. */
  chosen?: readonly Square[];
  theme: BoardTheme;
  /** Edge length of the whole board in pixels. */
  size: number;
  onTapSquare: (square: Square) => void;
  /** Whose muster zone to tint. */
  humanSide: 'gold' | 'shadow';
}

const SIDE_RING = { gold: colors.gold, shadow: colors.shadow } as const;

/**
 * The 6x6 field of play. Drawn with the human's home rank at the bottom, so
 * rank 5 is rendered first and rank 0 last.
 */
export function Board({
  state,
  targets,
  captures,
  selected,
  chosen = [],
  theme,
  size,
  onTapSquare,
  humanSide,
}: Props) {
  const cell = size / BOARD_SIZE;

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
      style={[
        styles.board,
        { width: size, height: size, borderColor: theme.frame, borderRadius: radius.md },
      ]}
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
  humanSide,
  onPress,
}: CellProps) {
  const piece = state.board[square] ?? null;
  const dark = (fileOf(square) + rankOf(square)) % 2 === 0;
  // Screen readers announce the square, its occupant and whether it is a legal
  // destination — which also makes the board driveable in UI tests.
  const label = [
    squareName(square),
    piece ? `${piece.owner === humanSide ? 'your' : 'enemy'} ${getPiece(piece.pieceId).name}` : 'empty',
    isTarget ? (isCapture ? 'capture' : 'legal move') : null,
  ]
    .filter(Boolean)
    .join(', ');
  const rank = rankOf(square);
  // Tint the two ranks the human may deploy onto.
  const isMuster = humanSide === 'gold' ? rank < 2 : rank >= BOARD_SIZE - 2;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.cell,
        {
          width: cell,
          height: cell,
          backgroundColor: dark ? theme.dark : theme.light,
        },
      ]}
    >
      {isMuster ? (
        <View style={[styles.musterTint, { borderColor: theme.accent }]} pointerEvents="none" />
      ) : null}

      {isSelected || isChosen ? (
        <View
          style={[styles.selectRing, { borderColor: theme.accent, borderRadius: cell * 0.12 }]}
          pointerEvents="none"
        />
      ) : null}

      {piece ? (
        <PieceChip piece={piece} cell={cell} threatened={isCapture} />
      ) : isTarget ? (
        <View
          style={[
            styles.moveDot,
            { width: cell * 0.26, height: cell * 0.26, borderRadius: cell * 0.13, backgroundColor: theme.accent },
          ]}
          pointerEvents="none"
        />
      ) : null}

      {isTarget && piece ? (
        <View
          style={[styles.captureRing, { borderColor: theme.accent, borderRadius: cell * 0.5 }]}
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
}

function PieceChip({
  piece,
  cell,
  threatened,
}: {
  piece: NonNullable<MatchState['board'][number]>;
  cell: number;
  threatened: boolean;
}) {
  const def = getPiece(piece.pieceId);
  const faction = factionById(def.factionId);
  const chip = cell * 0.78;

  return (
    <View
      style={[
        styles.chip,
        {
          width: chip,
          height: chip,
          borderRadius: chip * 0.28,
          backgroundColor: faction.paper,
          borderColor: SIDE_RING[piece.owner],
          // A bunkered piece is under the board: draw it sunken and faint.
          opacity: piece.submerged > 0 ? 0.45 : 1,
        },
        threatened ? styles.chipThreatened : null,
      ]}
    >
      <Text style={{ fontSize: chip * 0.56, color: faction.ink }} allowFontScaling={false}>
        {def.glyph}
      </Text>

      {piece.shielded > 0 || piece.rooted > 0 || piece.submerged > 0 ? (
        <View style={[styles.status, { bottom: -chip * 0.06 }]}>
          <Text style={{ fontSize: chip * 0.26 }} allowFontScaling={false}>
            {piece.submerged > 0 ? '⛏' : piece.shielded > 0 ? '🛡' : '❈'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderWidth: 3, overflow: 'hidden' },
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
  selectRing: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 2,
  },
  moveDot: { opacity: 0.85 },
  captureRing: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 2.5,
    opacity: 0.9,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  chipThreatened: { borderColor: colors.danger },
  status: { position: 'absolute' },
});
