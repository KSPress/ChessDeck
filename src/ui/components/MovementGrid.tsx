import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';

import { DIAGRAM_SIZE, movementDiagram } from '../movementDiagram';
import type { MoveRule } from '@/engine';

interface Props {
  rules: readonly MoveRule[];
  /** Overall width/height of the diagram in pixels, arrows included. */
  size: number;
  /** Ink colour, matching the card's foreground. */
  color: string;
}

/**
 * The movement diagram printed in the top-left of every ChessDeck card: a 5x5
 * grid, an open ring on the piece's own square, filled dots on the squares it
 * can reach, and arrows *outside* the grid on any line that runs further than
 * five squares can show.
 */
export function MovementGrid({ rules, size, color }: Props) {
  const { cells, arrows } = movementDiagram(rules);

  // The arrows live in a margin around the grid, so the grid itself is inset.
  const pad = size * 0.12;
  const grid = size - pad * 2;
  const cell = grid / DIAGRAM_SIZE;
  const dot = cell * 0.34;
  const centre = size / 2;
  const at = (index: number) => pad + index * cell + cell / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: DIAGRAM_SIZE + 1 }, (_, i) => (
        <Line
          key={`h${i}`}
          x1={pad}
          y1={pad + i * cell}
          x2={pad + grid}
          y2={pad + i * cell}
          stroke={color}
          strokeWidth={0.6}
          opacity={0.45}
        />
      ))}
      {Array.from({ length: DIAGRAM_SIZE + 1 }, (_, i) => (
        <Line
          key={`v${i}`}
          x1={pad + i * cell}
          y1={pad}
          x2={pad + i * cell}
          y2={pad + grid}
          stroke={color}
          strokeWidth={0.6}
          opacity={0.45}
        />
      ))}

      <Rect
        x={pad}
        y={pad}
        width={grid}
        height={grid}
        fill="none"
        stroke={color}
        strokeWidth={0.9}
        opacity={0.7}
      />

      {cells.map(([col, row]) => (
        <Circle key={`${col}-${row}`} cx={at(col)} cy={at(row)} r={dot} fill={color} />
      ))}

      {/* The piece itself: an open ring on the centre square. */}
      <Circle cx={centre} cy={centre} r={dot * 0.82} fill="none" stroke={color} strokeWidth={1.1} />

      {arrows.map((vec, i) => {
        // Normalising by the longer component puts diagonal arrows on the
        // corners and orthogonal ones on the edge midpoints.
        const scale = Math.max(Math.abs(vec.df), Math.abs(vec.dr)) || 1;
        const reach = grid / 2 + pad * 0.62;
        const tipX = centre + (vec.df / scale) * reach;
        const tipY = centre - (vec.dr / scale) * reach;
        const angle = Math.atan2(-vec.dr, vec.df);
        const wing = pad * 0.85;
        const points = [
          [tipX, tipY],
          [tipX - wing * Math.cos(angle - 0.5), tipY - wing * Math.sin(angle - 0.5)],
          [tipX - wing * Math.cos(angle + 0.5), tipY - wing * Math.sin(angle + 0.5)],
        ]
          .map(([x, y]) => `${x},${y}`)
          .join(' ');
        return <Polygon key={`a${i}`} points={points} fill={color} opacity={0.9} />;
      })}
    </Svg>
  );
}
