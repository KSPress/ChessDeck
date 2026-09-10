import { Pressable, StyleSheet, Text, View } from 'react-native';

import { factionById } from '@/content';
import { getCard, getPiece } from '@/engine';
import type { Archetype, Card, CrownDef, MoveRule, PieceDef } from '@/engine';
import { fonts, radius } from '../theme';
import { MovementGrid } from './MovementGrid';

/** Everything the card face needs, whether it came from a card, piece or crown. */
export interface CardFaceData {
  name: string;
  factionId: string;
  /** The big central mark. */
  glyph: string;
  /** Collector code printed under the name, e.g. "2R". */
  code: string;
  /** Aether cost, or null for a leader (which is never deployed). */
  cost: number | null;
  /** The silhouette shown in the top-right badge. */
  badge: string;
  /** Movement rules for the printed grid; null for action cards. */
  rules: readonly MoveRule[] | null;
  isLeader: boolean;
}

/** The silhouette printed in the badge, one per chess archetype. */
const ARCHETYPE_BADGE: Record<Archetype, string> = {
  pawn: '♟',
  knight: '♞',
  bishop: '♝',
  rook: '♜',
  queen: '♛',
  signature: '◆',
  leader: '♚',
};

export function faceOfCard(card: Card, piece?: PieceDef): CardFaceData {
  return {
    name: card.name,
    factionId: card.factionId,
    glyph: card.glyph,
    code: card.code,
    cost: card.cost,
    badge: card.kind === 'piece' ? (ARCHETYPE_BADGE[card.archetype] ?? '◆') : '✦',
    rules: card.kind === 'piece' ? (piece?.rules ?? null) : null,
    isLeader: false,
  };
}

/** Convenience for the many places that hold a card id rather than the card. */
export function faceOfCardId(cardId: string): CardFaceData {
  const card = getCard(cardId);
  return faceOfCard(card, card.kind === 'piece' ? getPiece(card.pieceId) : undefined);
}

export function faceOfCrown(crown: CrownDef): CardFaceData {
  return {
    name: crown.name,
    factionId: crown.factionId,
    glyph: crown.glyph,
    code: crown.code,
    cost: null,
    badge: ARCHETYPE_BADGE.leader,
    rules: crown.rules,
    isLeader: true,
  };
}

interface Props {
  face: CardFaceData;
  /** Card edge length; cards are square, as printed. */
  size: number;
  onPress?: () => void;
  selected?: boolean;
  /** Renders the card greyed out, e.g. when it cannot be afforded. */
  dimmed?: boolean;
  /** Small badge in the corner, e.g. "x2" for deck copies. */
  tag?: string;
  /** Overrides the screen-reader label, e.g. to mark a card as being in hand. */
  a11yLabel?: string;
}

/**
 * The ChessDeck card face, following the printed design: faction colour
 * full-bleed, movement grid top-left, archetype silhouette top-right, the
 * crown mark above the name on leader cards, and the collector code set as a
 * superscript after the name.
 *
 * The cost pip at bottom-left is the one addition the digital game needs —
 * the physical cards carry cost on the reference sheet instead.
 */
export function CardFace({ face, size, onPress, selected, dimmed, tag, a11yLabel }: Props) {
  const faction = factionById(face.factionId);
  const { paper, ink } = faction;

  // Below this the grid and badge stop being legible, so the card simplifies
  // down to cost, mark and name — the three things a hand needs at a glance.
  const compact = size < 118;
  const inset = size * 0.05;

  const body = (
    <View
      style={[
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: paper,
          borderRadius: size * 0.07,
          borderColor: selected ? '#FFFFFF' : 'rgba(0,0,0,0.35)',
          borderWidth: selected ? 2 : 1,
        },
        dimmed ? styles.dimmed : null,
      ]}
    >
      {/* The thin inner rule the printed cards carry inside their rough frame. */}
      <View
        style={[
          styles.rule,
          {
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderColor: ink,
            borderRadius: size * 0.045,
          },
        ]}
      />

      {!compact && face.rules ? (
        <View style={{ position: 'absolute', top: size * 0.075, left: size * 0.075 }}>
          <MovementGrid rules={face.rules} size={size * 0.3} color={ink} />
        </View>
      ) : null}

      {!compact ? (
        <View
          style={[
            styles.badge,
            {
              top: size * 0.075,
              right: size * 0.075,
              width: size * 0.15,
              height: size * 0.19,
              borderRadius: size * 0.02,
            },
          ]}
        >
          <Text style={{ fontSize: size * 0.11, color: '#3A3A3A' }}>{face.badge}</Text>
        </View>
      ) : null}

      <View style={styles.centre} pointerEvents="none">
        <Text style={{ fontSize: size * (compact ? 0.3 : 0.34), color: ink }}>{face.glyph}</Text>
      </View>

      <View style={[styles.footer, { paddingHorizontal: size * 0.1, paddingBottom: size * 0.075 }]}>
        {face.isLeader && !compact ? (
          <Text style={{ fontSize: size * 0.09, color: ink, marginBottom: -size * 0.02 }}>♕</Text>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fonts.display,
            fontSize: size * (compact ? 0.11 : 0.115),
            fontWeight: '700',
            color: ink,
            textAlign: 'center',
          }}
        >
          {face.name}
          {!compact && face.code ? (
            <Text style={{ fontSize: size * 0.07 }}>{`  ${face.code}`}</Text>
          ) : null}
        </Text>
      </View>

      {face.cost !== null ? (
        <View
          style={[
            styles.cost,
            compact
              ? { top: size * 0.05, left: size * 0.05 }
              : { bottom: size * 0.05, left: size * 0.05 },
            {
              width: size * 0.2,
              height: size * 0.2,
              borderRadius: size * 0.1,
              backgroundColor: ink,
            },
          ]}
        >
          <Text style={{ fontSize: size * 0.115, fontWeight: '900', color: paper }}>{face.cost}</Text>
        </View>
      ) : null}

      {tag ? (
        <View style={[styles.tag, { bottom: size * 0.05, right: size * 0.05 }]}>
          <Text style={{ fontSize: size * 0.09, fontWeight: '800', color: paper }}>{tag}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel ?? face.name}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', justifyContent: 'flex-end' },
  rule: { position: 'absolute', borderWidth: 1, opacity: 0.55 },
  badge: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { alignItems: 'center' },
  dimmed: { opacity: 0.42 },
  cost: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tag: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
});
