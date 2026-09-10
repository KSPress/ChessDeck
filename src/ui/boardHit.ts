import type { Square } from '@/engine';

/**
 * What a board reports after laying itself out, so a caller (chiefly the
 * card-drag hit-testing in the match screen) can turn a raw page coordinate
 * into a square without knowing whether it's looking at the flat board or the
 * isometric one — each projects screen space to squares differently, so the
 * board itself is the only thing that can answer this correctly.
 */
export interface BoardHit {
  /** The square under a page-space point, or null when it's off the board. */
  squareAt: (pageX: number, pageY: number) => Square | null;
}
