import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { getCard, type CardId } from '@/engine';
import { colors, fonts, radius, space } from '../theme';
import { CardFace, faceOfCardId } from './CardFace';

/** Movement past this many pixels turns a hold into a drag. */
const DRAG_THRESHOLD = 6;
/** Slots the responder pool covers; no crown grants a bigger hand than this. */
const MAX_SLOTS = 6;

interface Props {
  hand: readonly CardId[];
  /** Top of the draw queue — what arrives at the start of your next turn. */
  nextCardId: CardId | null;
  aether: number;
  /** False while it is not your turn, or your card action is spent. */
  canPlay: boolean;
  cardSize: number;
  draggingIndex: number | null;
  inspectingIndex: number | null;
  onInspect: (index: number | null) => void;
  onGrab: (index: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  /** Called with the release point, in page coordinates. */
  onDrop: (index: number, pageX: number, pageY: number) => void;
  onCancelDrag: () => void;
}

/**
 * The cards in your hand, plus the one waiting behind them.
 *
 * Cards are *dragged* onto the board rather than tapped, so the board tells you
 * where a card can legally land while you are still deciding. A press without
 * movement — or a mouse hovering — opens the readout instead of playing
 * anything, which is how you find out what a card does.
 */
export function Hand({
  hand,
  nextCardId,
  aether,
  canPlay,
  cardSize,
  draggingIndex,
  inspectingIndex,
  onInspect,
  onGrab,
  onDragMove,
  onDrop,
  onCancelDrag,
}: Props) {
  // Callbacks live in a ref so the responder pool can be built once; rebuilding
  // responders mid-gesture drops the drag.
  const cb = useRef({ canPlay, onInspect, onGrab, onDragMove, onDrop, onCancelDrag });
  cb.current = { canPlay, onInspect, onGrab, onDragMove, onDrop, onCancelDrag };

  const dragging = useRef(false);

  const responders = useMemo(
    () =>
      Array.from({ length: MAX_SLOTS }, (_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            dragging.current = false;
            // Touching a card always reads it, whether or not you play it.
            cb.current.onInspect(index);
          },
          onPanResponderMove: (_event, gesture) => {
            const moved = Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD;
            if (!dragging.current && moved && cb.current.canPlay) {
              dragging.current = true;
              cb.current.onGrab(index);
            }
            if (dragging.current) cb.current.onDragMove(gesture.moveX, gesture.moveY);
          },
          onPanResponderRelease: (_event, gesture) => {
            if (dragging.current) cb.current.onDrop(index, gesture.moveX, gesture.moveY);
            dragging.current = false;
            cb.current.onInspect(null);
          },
          onPanResponderTerminate: () => {
            if (dragging.current) cb.current.onCancelDrag();
            dragging.current = false;
            cb.current.onInspect(null);
          },
        }),
      ),
    [],
  );

  return (
    <View style={styles.row}>
      <View style={styles.nextSlot}>
        <Text style={styles.nextLabel}>Next</Text>
        {nextCardId ? (
          <CardFace face={faceOfCardId(nextCardId)} size={cardSize * 0.62} dimmed />
        ) : (
          <View style={[styles.nextEmpty, { width: cardSize * 0.62, height: cardSize * 0.62 }]} />
        )}
      </View>

      <View style={styles.cards}>
        {hand.map((cardId, index) => {
          const card = getCard(cardId);
          const affordable = aether >= card.cost;
          return (
            <View
              key={`${cardId}-${index}`}
              {...responders[index]?.panHandlers}
              // Pointer events give mouse users the readout on hover, without
              // disturbing the touch drag.
              onPointerEnter={() => onInspect(index)}
              onPointerLeave={() => onInspect(null)}
              accessibilityRole="button"
              accessibilityLabel={`Hand ${index + 1}: ${card.name}, ${card.cost} aether`}
            >
              <CardFace
                face={faceOfCardId(cardId)}
                size={cardSize}
                animateIn
                lifted={draggingIndex === index || inspectingIndex === index}
                dimmed={!affordable || !canPlay}
                selected={draggingIndex === index}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  nextSlot: { alignItems: 'center', gap: 3 },
  nextLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: colors.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  nextEmpty: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  cards: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end' },
});
