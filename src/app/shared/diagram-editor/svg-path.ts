/** A path command with its numeric arguments, as written in the `d` attribute. */
export interface PathSegment {
  cmd: string;
  args: number[];
}

const ARG_COUNT: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

/** Parses an SVG path `d` attribute. Repeated argument groups become separate segments. */
export function parsePath(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const tokens = d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      cmd = token;
      i++;
      if (cmd.toLowerCase() === 'z') {
        segments.push({ cmd, args: [] });
        continue;
      }
    }
    const count = ARG_COUNT[cmd.toLowerCase()];
    if (!count) {
      i++;
      continue;
    }
    const args = tokens.slice(i, i + count).map(Number);
    if (args.length < count) break;
    segments.push({ cmd, args });
    i += count;
    // Extra coordinate pairs after a moveto are implicit linetos.
    if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
  }
  return segments;
}

export function formatPath(segments: PathSegment[]): string {
  return segments.map((s) => s.cmd + s.args.map((n) => round(n)).join(' ')).join(' ');
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Walks a path in absolute coordinates. `onPoint` gets every end point (`end: true`) and every
 * curve control point (`end: false`), like Oryx's MinMaxPathHandler / PointsPathHandler.
 */
function walk(segments: PathSegment[], onPoint: (x: number, y: number, end: boolean) => void) {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const { cmd, args } of segments) {
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toLowerCase()) {
      case 'm':
        x = ox + args[0];
        y = oy + args[1];
        startX = x;
        startY = y;
        onPoint(x, y, true);
        break;
      case 'l':
      case 't':
        x = ox + args[0];
        y = oy + args[1];
        onPoint(x, y, true);
        break;
      case 'h':
        x = ox + args[0];
        onPoint(x, y, true);
        break;
      case 'v':
        y = oy + args[0];
        onPoint(x, y, true);
        break;
      case 'c':
        onPoint(ox + args[0], oy + args[1], false);
        onPoint(ox + args[2], oy + args[3], false);
        x = ox + args[4];
        y = oy + args[5];
        onPoint(x, y, true);
        break;
      case 's':
      case 'q':
        onPoint(ox + args[0], oy + args[1], false);
        x = ox + args[2];
        y = oy + args[3];
        onPoint(x, y, true);
        break;
      case 'a':
        x = ox + args[5];
        y = oy + args[6];
        onPoint(x, y, true);
        break;
      case 'z':
        x = startX;
        y = startY;
        break;
    }
  }
}

/** Bounding box of end points and control points (arcs use their end points only). */
export function pathBBox(segments: PathSegment[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  walk(segments, (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** The end points of a path, used as a polygon for hit tests. */
export function pathPoints(segments: PathSegment[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  walk(segments, (x, y, end) => end && points.push({ x, y }));
  return points;
}

/**
 * Rescales a path from its old box to a new one: absolute points map with
 * `(p - old) * scale + new`, relative offsets and arc radii with `p * scale`.
 */
export function rescalePath(
  segments: PathSegment[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  sx: number,
  sy: number,
): PathSegment[] {
  const ax = (v: number) => (v - from.x) * sx + to.x;
  const ay = (v: number) => (v - from.y) * sy + to.y;
  const rx = (v: number) => v * sx;
  const ry = (v: number) => v * sy;
  return segments.map(({ cmd, args }) => {
    const rel = cmd === cmd.toLowerCase();
    const X = rel ? rx : ax;
    const Y = rel ? ry : ay;
    switch (cmd.toLowerCase()) {
      case 'h':
        return { cmd, args: [X(args[0])] };
      case 'v':
        return { cmd, args: [Y(args[0])] };
      case 'a':
        return {
          cmd,
          args: [rx(args[0]), ry(args[1]), args[2], args[3], args[4], X(args[5]), Y(args[6])],
        };
      case 'z':
        return { cmd, args: [] };
      default:
        return { cmd, args: args.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))) };
    }
  });
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
