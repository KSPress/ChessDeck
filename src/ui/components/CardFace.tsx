import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { factionById } from '@/content';
import { getCard, getPiece } from '@/engine';
import type { Archetype, Card, CrownDef, MoveRule, PieceDef } from '@/engine';
import { PIECE_ART_ASPECT, RETICLE, pieceArtFor } from '../icons';
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
  /** Null for action cards, which have no standing figure to paint. */
  archetype: Archetype | null;
}

/** The silhouette printed in the badge, one per chess archetype. */
const ARCHETYPE_BADGE: Record<Archetype, string> = {
  pawn: '♟',
  knight: '♞',
  bishop: '♝',
  rook: '♜',
  queen: '♛',
  fairy: '◆',
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
    archetype: card.kind === 'piece' ? card.archetype : null,
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
    archetype: 'leader',
  };
}

interface Props {
  face: CardFaceData;
  /** Card edge length; cards are square, as printed. */
  size: number;
  onPress?: () => void;
  /** Held down — used to open the card readout on touch devices. */
  onLongPress?: () => void;
  /** Mouse hover, for the same readout on desktop. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  selected?: boolean;
  /** Renders the card greyed out, e.g. when it cannot be afforded. */
  dimmed?: boolean;
  /** Small badge in the corner, e.g. "x2" for deck copies. */
  tag?: string;
  /** Overrides the screen-reader label, e.g. to mark a card as being in hand. */
  a11yLabel?: string;
  /** Raised off the table — held, hovered, or mid-drag. */
  lifted?: boolean;
  /** Plays a deal-in animation on mount, for cards arriving in hand. */
  animateIn?: boolean;
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
export function CardFace({
  face,
  size,
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut,
  selected,
  dimmed,
  tag,
  a11yLabel,
  lifted,
  animateIn,
}: Props) {
  const faction = factionById(face.factionId);
  const { paper, ink } = faction;

  // A card that has just been dealt slides up onto the table; a held one lifts
  // off it. Both run on the native driver so a drag never stutters.
  const dealt = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const raise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.spring(dealt, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
  }, [animateIn, dealt]);

  useEffect(() => {
    Animated.spring(raise, {
      toValue: lifted ? 1 : 0,
      useNativeDriver: true,
      speed: 30,
      bounciness: lifted ? 10 : 0,
    }).start();
  }, [lifted, raise]);

  const scale = Animated.multiply(
    dealt.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
    raise.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }),
  );
  const translateY = Animated.add(
    dealt.interpolate({ inputRange: [0, 1], outputRange: [size * 0.35, 0] }),
    raise.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.1] }),
  );

  // Below this the grid and badge stop being legible, so the card simplifies
  // down to cost, mark and name — the three things a hand needs at a glance.
  const compact = size < 118;
  const inset = size * 0.05;

  // A card always shows its own side's colours, whoever ends up playing it —
  // there is no "shadow" version of a card in a binder or a hand.
  const figureArt = face.archetype ? pieceArtFor(face.archetype, 'gold') : null;
  const figureHeight = size * (compact ? 0.56 : 0.62);

  const body = (
    <Animated.View
      style={[
        styles.card,
        {
          width: size,
          height: size,
          backgroundColor: paper,
          borderRadius: size * 0.07,
          borderColor: selected ? '#F3CE7C' : 'rgba(0,0,0,0.4)',
          borderWidth: selected ? 2 : 1,
          opacity: dealt,
          transform: [{ scale }, { translateY }],
          shadowOpacity: lifted ? 0.55 : 0.3,
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
        {figureArt ? (
          <Image
            source={figureArt}
            resizeMode="contain"
            style={{ width: figureHeight * PIECE_ART_ASPECT, height: figureHeight }}
          />
        ) : (
          <Text style={{ fontSize: size * (compact ? 0.3 : 0.34), color: ink }}>{face.glyph}</Text>
        )}
      </View>

      <View style={[styles.footer, { paddingHorizontal: size * 0.1, paddingBottom: size * 0.075 }]}>
        {face.isLeader && !compact ? (
          <Text style={{ fontSize: size * 0.09, color: ink, marginBottom: -size * 0.02 }}>♕</Text>
        ) : null}
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.display,
            fontSize: size * 0.1,
            lineHeight: size * 0.108,
            color: ink,
            textAlign: 'center',
          }}
        >
          {face.name}
        </Text>
        {!compact && face.code ? (
          <Text style={{ fontFamily: fonts.body, fontSize: size * 0.062, color: ink, opacity: 0.75 }}>
            {face.code}
          </Text>
        ) : null}
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

      {/* A held or dragging card gets a targeting reticle, not just a border. */}
      {selected ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={RETICLE} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
    </Animated.View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onPointerEnter={onHoverIn}
      onPointerLeave={onHoverOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? face.name}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
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
