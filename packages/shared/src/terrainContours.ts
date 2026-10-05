import { CELL } from "./terrainGrid";

type Point = { x: number; y: number };
type Edge = { a: Point; b: Point; direction: number; used: boolean };

// Remove grid stair steps within one cell. Physics always keeps the original
// occupancy; this is a bounded visual approximation shared by canvas and previews.
function simplify(points: Point[], tolerance = CELL * 0.75): Point[] {
  if (points.length <= 2) return points;
  const a = points[0],
    b = points[points.length - 1];
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let furthest = tolerance * tolerance,
    split = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    const distance = (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
    if (distance > furthest) {
      furthest = distance;
      split = i;
    }
  }
  if (split < 0) return [a, b];
  return [
    ...simplify(points.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(split), tolerance),
  ];
}

/** Clockwise outer loops and counterclockwise cave loops, solid on the right. */
export function terrainContours(rows: string[]): Point[][] {
  const edges: Edge[] = [];
  const outgoing = new Map<string, Edge[]>();
  const key = (p: Point) => `${p.x},${p.y}`;
  const add = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    direction: number,
  ) => {
    const edge = {
      a: { x: x * CELL, y: y * CELL },
      b: { x: (x + dx) * CELL, y: (y + dy) * CELL },
      direction,
      used: false,
    };
    edges.push(edge);
    const at = key(edge.a);
    const list = outgoing.get(at) ?? [];
    list.push(edge);
    outgoing.set(at, list);
  };
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y].charAt(x) !== "1") continue;
      if (y === 0 || rows[y - 1].charAt(x) !== "1") add(x, y, 1, 0, 0);
      if (rows[y].charAt(x + 1) !== "1") add(x + 1, y, 0, 1, 1);
      if (y + 1 === rows.length || rows[y + 1].charAt(x) !== "1")
        add(x + 1, y + 1, -1, 0, 2);
      if (rows[y].charAt(x - 1) !== "1") add(x, y + 1, 0, -1, 3);
    }
  const loops: Point[][] = [];
  for (const first of edges) {
    if (first.used) continue;
    const points: Point[] = [];
    let edge: Edge | undefined = first;
    while (edge && !edge.used) {
      edge.used = true;
      points.push(edge.a);
      const direction: number = edge.direction;
      // Turn right at diagonal contacts so disjoint islands never get bridged.
      const next: Edge[] = (outgoing.get(key(edge.b)) ?? []).filter(
        (e) => !e.used,
      );
      edge =
        next.find((e) => (e.direction - direction + 4) % 4 === 1) ??
        (next.length ? next[0] : undefined);
    }
    if (points.length < 4) continue;
    // Split the closed loop at its farthest point to avoid a zero-length baseline.
    let split = 1;
    for (let i = 2; i < points.length; i++)
      if (
        Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y) >
        Math.hypot(points[split].x - points[0].x, points[split].y - points[0].y)
      )
        split = i;
    const simplified = [
      ...simplify(points.slice(0, split + 1)).slice(0, -1),
      ...simplify([...points.slice(split), points[0]]).slice(0, -1),
    ];
    // A single-cell fragment can collapse to a diagonal under the tolerance.
    // Keep its boundary so destructible debris never becomes invisible collision.
    loops.push(simplified.length >= 3 ? simplified : points);
  }
  return loops;
}

/** Small rounded joins remove sharp corners without rounding entire platforms. */
export function contourPaths(contours: Point[][]): {
  land: string;
  rim: string;
} {
  let land = "",
    rim = "";
  const format = (p: Point) => `${+p.x.toFixed(2)} ${+p.y.toFixed(2)}`;
  for (const points of contours) {
    const joins = points.map((p, i) => {
      const prev = points[(i + points.length - 1) % points.length];
      const next = points[(i + 1) % points.length];
      const before = Math.hypot(prev.x - p.x, prev.y - p.y);
      const after = Math.hypot(next.x - p.x, next.y - p.y);
      const radius = Math.min(CELL, before / 3, after / 3);
      return {
        entry: {
          x: p.x + ((prev.x - p.x) * radius) / before,
          y: p.y + ((prev.y - p.y) * radius) / before,
        },
        exit: {
          x: p.x + ((next.x - p.x) * radius) / after,
          y: p.y + ((next.y - p.y) * radius) / after,
        },
      };
    });
    land += `M${format(joins[0].entry)}`;
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      land += `Q${format(points[i])} ${format(joins[i].exit)}L${format(joins[next].entry)}`;
      const dx = points[next].x - points[i].x,
        dy = points[next].y - points[i].y;
      if (dx > Math.abs(dy) * 0.6)
        rim += `M${format(joins[i].entry)}Q${format(points[i])} ${format(joins[i].exit)}L${format(joins[next].entry)}Q${format(points[next])} ${format(joins[next].exit)}`;
    }
    land += "Z";
  }
  return { land, rim };
}
