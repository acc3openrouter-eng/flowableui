export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export const inBox = (p: Point, b: Box, pad = 0) =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

export const boxInside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

export function boxOfPoints(points: Point[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance from p to the segment a-b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Where the segment from `inside` to `outside` leaves a shape, found by bisection like Oryx's
 * `getIntersectionPoint`. Returns null when both points are on the same side.
 */
export function clipToOutline(a: Point, b: Point, contains: (p: Point) => boolean): Point | null {
  const aIn = contains(a);
  const bIn = contains(b);
  if (aIn === bIn) return null;
  let inside = aIn ? a : b;
  let outside = aIn ? b : a;
  for (let i = 0; i < 40 && distance(inside, outside) > 0.5; i++) {
    const mid = { x: (inside.x + outside.x) / 2, y: (inside.y + outside.y) / 2 };
    if (contains(mid)) inside = mid;
    else outside = mid;
  }
  return outside;
}
