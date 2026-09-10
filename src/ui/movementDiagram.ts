import type { MoveRule, Vec } from '@/engine';

/** The printed movement grid is 5x5 with the piece on the centre square. */
export const DIAGRAM_SIZE = 5;
export const DIAGRAM_RADIUS = 2;

export interface MovementDiagram {
  /** Reachable cells as [col, row] pairs, row 0 at the top of the card. */
  cells: Array<[number, number]>;
  /** Directions that continue past the edge of the grid, drawn as arrows. */
  arrows: Vec[];
}

/**
 * Converts a piece's movement rules into the diagram printed on its card:
 * dots for the squares it can reach, and an arrow on any direction that runs
 * further than the grid can show.
 *
 * Rank deltas are written with "forward" as positive, and the diagram is drawn
 * from the piece's own point of view, so forward is up — row = 2 - dr.
 */
export function movementDiagram(rules: readonly MoveRule[]): MovementDiagram {
  const seen = new Set<string>();
  const cells: Array<[number, number]> = [];
  const arrows: Vec[] = [];

  const mark = (df: number, dr: number) => {
    if (Math.abs(df) > DIAGRAM_RADIUS || Math.abs(dr) > DIAGRAM_RADIUS) return;
    if (df === 0 && dr === 0) return;
    const col = DIAGRAM_RADIUS + df;
    const row = DIAGRAM_RADIUS - dr;
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push([col, row]);
  };

  const addArrow = (vec: Vec) => {
    if (!arrows.some((a) => a.df === vec.df && a.dr === vec.dr)) arrows.push(vec);
  };

  for (const rule of rules) {
    if (rule.kind === 'slide') {
      for (const dir of rule.dirs) {
        for (let step = 1; step <= Math.min(rule.range, DIAGRAM_RADIUS); step += 1) {
          mark(dir.df * step, dir.dr * step);
        }
        // Anything reaching past the grid gets the "and onward" arrow.
        if (rule.range > DIAGRAM_RADIUS) addArrow(dir);
      }
    } else if (rule.kind === 'leap') {
      for (const offset of rule.offsets) mark(offset.df, offset.dr);
    } else if (rule.kind === 'rider') {
      // A rider is a repeated leap: the first hop always fits the grid, and
      // anything past that gets the same "onward" arrow a slide would.
      mark(rule.offset.df, rule.offset.dr);
      if (rule.range > 1) addArrow(rule.offset);
    } else if (rule.kind === 'bentLeap') {
      // The diagram shows only where it can land, not the leg that can block it.
      for (const { offset } of rule.leaps) mark(offset.df, offset.dr);
    } else if (rule.kind === 'hopper') {
      // The real landing square depends on where the hurdle sits, but two
      // squares out is the shortest possible hop and reads clearly on a card.
      for (const dir of rule.dirs) mark(dir.df * 2, dir.dr * 2);
    } else {
      for (let step = 1; step <= Math.min(rule.range, DIAGRAM_RADIUS); step += 1) mark(0, step);
      // Pawns strike on the forward diagonals, which the diagram shows too.
      mark(-1, 1);
      mark(1, 1);
    }
  }

  return { cells, arrows };
}
