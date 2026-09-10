import { BOARD_SIZE, fileOf, rankOf, squareOf, type Square } from '@/engine';

/**
 * The isometric camera is a plain 2D affine projection of the flat grid — the
 * classic "2:1 diamond" tile-map trick, not a CSS 3D transform. React Native's
 * `transform` style is purely visual and never moves a view's actual touch
 * target, so a truly rotated board would look right and be untappable. Instead
 * every tile's on-screen position is computed directly by this projection, and
 * a tap is mapped back to a square by inverting the same formula — visuals and
 * hit-testing are one thing, not two things that have to agree by luck.
 *
 * Rank 0 (gold's home) projects to the front/bottom of the diamond, matching
 * where it sits on the flat board — your own side stays closest to you.
 */
export interface IsoProjection {
  tileW: number;
  tileH: number;
  /** Overall bounding box for the whole diamond, in local coordinates. */
  width: number;
  height: number;
  /** Screen-space centre of the tile at (file, rank). */
  toScreen: (square: Square) => { x: number; y: number };
  /** The square under a local-space point, or null when it's off the diamond. */
  fromScreen: (x: number, y: number) => Square | null;
}

export function project(size: number): IsoProjection {
  const tileW = size / BOARD_SIZE;
  const tileH = tileW / 2;

  // "row" runs back-to-front: row 0 is the far edge (shadow's home), row
  // BOARD_SIZE-1 the near edge (gold's home) — the reverse of rank, which
  // counts up away from gold.
  const rowOf = (rank: number) => BOARD_SIZE - 1 - rank;
  const rankOfRow = (row: number) => BOARD_SIZE - 1 - row;

  const centreX = (col: number, row: number) => (col - row) * (tileW / 2);
  const centreY = (col: number, row: number) => (col + row) * (tileH / 2);

  // The diamond's own centres span a known range; pad by one tile's worth so
  // the shapes drawn *around* each centre never clip against the box edge.
  const minX = centreX(0, BOARD_SIZE - 1) - tileW / 2;
  const maxX = centreX(BOARD_SIZE - 1, 0) + tileW / 2;
  const minY = centreY(0, 0) - tileH / 2;
  const maxY = centreY(BOARD_SIZE - 1, BOARD_SIZE - 1) + tileH / 2;

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    tileW,
    tileH,
    width,
    height,
    toScreen: (square) => ({
      x: centreX(fileOf(square), rowOf(rankOf(square))) - minX,
      y: centreY(fileOf(square), rowOf(rankOf(square))) - minY,
    }),
    fromScreen: (x, y) => {
      const u = (x + minX) / (tileW / 2);
      const v = (y + minY) / (tileH / 2);
      const col = Math.round((u + v) / 2);
      const row = Math.round((v - u) / 2);
      if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null;
      return squareOf(col, rankOfRow(row));
    },
  };
}

/** The four corners of one tile's diamond, centred on (0,0), as an SVG points string. */
export function diamondPoints(cx: number, cy: number, tileW: number, tileH: number): string {
  const points = [
    [cx, cy - tileH / 2],
    [cx + tileW / 2, cy],
    [cx, cy + tileH / 2],
    [cx - tileW / 2, cy],
  ];
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}
