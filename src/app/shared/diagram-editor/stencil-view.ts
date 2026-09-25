import { Box, Point } from './geometry';
import {
  PathSegment,
  formatPath,
  parsePath,
  pathBBox,
  pathPoints,
  pointInPolygon,
  rescalePath,
} from './svg-path';

export const SVG_NS = 'http://www.w3.org/2000/svg';
const ORYX_NS = 'http://www.b3mn.org/oryx';

/** Font used for labels, and for measuring them when wrapping. */
export const DIAGRAM_FONT = `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif`;

interface Anchors {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

type ShapeKind = 'rect' | 'circle' | 'ellipse' | 'line' | 'poly' | 'path';

interface ViewShape {
  kind: ShapeKind;
  /** Ids of the element and its ancestors (innermost first), for refToView visibility. */
  chain: { id: string | null; hidden: boolean }[];
  /** `fill="none"` and `stroke="none"`: never counts for hit tests. */
  invisible: boolean;
  /** Normalised geometry (the view's upper-left moved to 0,0). */
  box: Box;
  anchors: Anchors;
  resizeH: boolean;
  resizeV: boolean;
  segments?: PathSegment[];
  points?: Point[];
}

interface ViewLabel {
  id: string;
  x: number;
  y: number;
  vAlign: 'top' | 'middle' | 'bottom';
  hAlign: 'left' | 'center' | 'right';
  fitTo: string | null;
  rotate: number;
  anchors: Anchors;
  fontSize: number;
  edgePosition: string | null;
  offsetTop: number;
  offsetBottom: number;
}

export interface Magnet extends Point {
  anchors: Anchors;
  isDefault: boolean;
}

/** A shape element after layout, in node-local coordinates. */
interface LaidOutShape {
  kind: ShapeKind;
  box: Box;
  segments?: PathSegment[];
  points?: Point[];
  visible: boolean;
}

export interface NodeLayout {
  width: number;
  height: number;
  shapes: LaidOutShape[];
  magnets: Magnet[];
  labels: (ViewLabel & { lx: number; ly: number; refWidth: number | null })[];
  toggles: Map<string, boolean>;
}

const SHAPE_TAGS: Record<string, ShapeKind> = {
  rect: 'rect',
  image: 'rect',
  circle: 'circle',
  ellipse: 'ellipse',
  line: 'line',
  polyline: 'poly',
  polygon: 'poly',
  path: 'path',
};

function oryx(el: Element, name: string): string | null {
  return el.getAttributeNS(ORYX_NS, name) ?? el.getAttribute(`oryx:${name}`);
}

function num(el: Element, name: string): number {
  return parseFloat(el.getAttribute(name) ?? '0') || 0;
}

function parseAnchors(value: string | null): Anchors {
  const v = (value ?? '').toLowerCase();
  return {
    left: v.includes('left'),
    right: v.includes('right'),
    top: v.includes('top'),
    bottom: v.includes('bottom'),
  };
}

function parseSize(value: string | null): { w: number; h: number } | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return { w: 1, h: 1 };
  return { w: parts[0], h: parts[1] };
}

/** All descendants of `root` in document order (querySelectorAll is not namespace-safe here). */
function descendants(root: Element): Element[] {
  const out: Element[] = [];
  const visit = (el: Element) => {
    for (const child of Array.from(el.children)) {
      out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

function inheritedFontSize(el: Element, stop: Element): number {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const size = e.getAttribute('font-size');
    if (size) return parseFloat(size) || 12;
    if (e === stop) break;
  }
  return 12;
}

function readGeometry(el: Element, kind: ShapeKind): Pick<ViewShape, 'box' | 'segments' | 'points'> {
  switch (kind) {
    case 'rect':
      return {
        box: { x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height') },
      };
    case 'circle': {
      const r = num(el, 'r');
      return { box: { x: num(el, 'cx') - r, y: num(el, 'cy') - r, w: 2 * r, h: 2 * r } };
    }
    case 'ellipse': {
      const rx = num(el, 'rx');
      const ry = num(el, 'ry');
      return { box: { x: num(el, 'cx') - rx, y: num(el, 'cy') - ry, w: 2 * rx, h: 2 * ry } };
    }
    case 'line': {
      const x1 = num(el, 'x1');
      const y1 = num(el, 'y1');
      const x2 = num(el, 'x2');
      const y2 = num(el, 'y2');
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      return { box: { x, y, w: Math.max(x1, x2) - x, h: Math.max(y1, y2) - y } };
    }
    case 'poly': {
      const values = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      const points: Point[] = [];
      for (let i = 0; i + 1 < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, points };
    }
    case 'path': {
      const segments = parsePath(el.getAttribute('d') ?? '');
      return { box: pathBBox(segments), segments };
    }
  }
}

/**
 * One axis of Oryx's resize rule (Node._update), applied in one step from the natural size `n`
 * to the target size `t`.
 */
function layoutAxis(
  x0: number,
  w0: number,
  n: number,
  t: number,
  resize: boolean,
  anchorLow: boolean,
  anchorHigh: boolean,
): [number, number] {
  const s = n ? t / n : 1;
  let w = resize ? w0 * s : w0;
  let x: number;
  if (anchorHigh) {
    const offset = n - (x0 + w0);
    if (anchorLow) {
      x = x0;
      w = t - x0 - offset;
    } else {
      x = t - (offset + w);
    }
  } else if (!anchorLow) {
    x = x0 * s;
    if (!resize) x += (w * s) / 2 - w / 2;
  } else {
    x = x0;
  }
  return [x, w];
}

/** Moves a point anchored like a magnet or label when the node goes from size `n` to `t`. */
function movePoint(v: number, n: number, t: number, low: boolean, high: boolean): number {
  if (low) return v;
  if (high) return t - (n - v);
  return n ? (v * t) / n : v;
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Text width in px with the diagram font; falls back to an estimate without a canvas. */
export function measureText(text: string, fontSize: number): number {
  if (measureContext === undefined) {
    try {
      measureContext = document.createElement('canvas').getContext('2d');
    } catch {
      measureContext = null;
    }
  }
  if (!measureContext) return text.length * fontSize * 0.55;
  measureContext.font = `${fontSize}px ${DIAGRAM_FONT}`;
  return measureContext.measureText(text).width;
}

/** Oryx's label word wrap: break after a separator, or inside a word when there is none. */
export function wrapLine(line: string, width: number, fontSize: number): string[] {
  if (measureText(line, fontSize) <= width) return [line];
  const out: string[] = [];
  let start = 0;
  let lastSep = 0;
  for (let i = 0; i < line.length; i++) {
    if (measureText(line.substring(start, i), fontSize) > width - 2) {
      const cut = lastSep <= start ? (i === 0 ? 0 : Math.max(start + 1, i - 1)) : lastSep + 1;
      out.push(line.substring(start, cut).trim());
      start = cut;
    } else if (' -.,;:'.includes(line[i])) {
      lastSep = i;
    }
  }
  const rest = line.substring(start).trim();
  if (rest) out.push(rest);
  return out.filter((l, i) => l || i < out.length - 1);
}

export function labelLines(value: unknown): string[] {
  const text = String(value ?? '').replace(/ {2,}/g, ' ');
  const lines = text.split('\n').map((l) => l.trim());
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

/** Lays out one `<text>` element as tspans, following Oryx's `_positionText`. */
export function renderLabel(
  text: Element,
  lines: string[],
  x: number,
  y: number,
  vAlign: ViewLabel['vAlign'],
  hAlign: ViewLabel['hAlign'],
  fontSize: number,
) {
  while (text.firstChild) text.removeChild(text.firstChild);
  const doc = text.ownerDocument;
  const n = lines.length;
  text.setAttribute('x', String(Math.floor(x)));
  text.setAttribute('y', String(Math.floor(y)));
  text.setAttribute('text-anchor', hAlign === 'left' ? 'start' : hAlign === 'right' ? 'end' : 'middle');
  text.setAttribute('font-family', DIAGRAM_FONT);
  text.setAttribute('stroke-width', '0');
  lines.forEach((line, i) => {
    const d =
      vAlign === 'bottom'
        ? -(n - 1 - i) * fontSize
        : vAlign === 'middle'
          ? -(n / 2 - i - 1) * fontSize - 1
          : (i + 1) * fontSize;
    const tspan = doc.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', String(Math.floor(x)));
    tspan.setAttribute('y', String(Math.floor(y)));
    tspan.setAttribute('dy', String(Math.floor(d)));
    tspan.textContent = line;
    text.appendChild(tspan);
  });
}

function parseLabel(el: Element, root: Element, offset: Point): ViewLabel {
  const align = (oryx(el, 'align') ?? '').toLowerCase();
  const rotate = parseFloat(oryx(el, 'rotate') ?? '0') || 0;
  return {
    id: el.getAttribute('id') ?? '',
    x: num(el, 'x') - offset.x,
    y: num(el, 'y') - offset.y,
    vAlign: align.includes('top') ? 'top' : align.includes('middle') ? 'middle' : 'bottom',
    hAlign: align.includes('center') ? 'center' : align.includes('right') ? 'right' : 'left',
    fitTo: oryx(el, 'fittoelem'),
    rotate,
    anchors: parseAnchors(oryx(el, 'anchors')),
    fontSize: inheritedFontSize(el, root),
    edgePosition: oryx(el, 'edgePosition')?.toLowerCase() ?? null,
    offsetTop: parseFloat(oryx(el, 'offsetTop') ?? '') || 8,
    offsetBottom: parseFloat(oryx(el, 'offsetBottom') ?? '') || 8,
  };
}

function parseSvg(view: string): Document {
  return new DOMParser().parseFromString(view, 'image/svg+xml');
}

/** Rewrites ids to be unique per shape, and `url(#id)` references to match. */
function prefixIds(root: Element, prefix: string) {
  const all = [root, ...descendants(root)];
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id) {
      el.setAttribute('data-ref', id);
      el.setAttribute('id', prefix + id);
    }
    for (const attr of ['fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end']) {
      const v = el.getAttribute(attr);
      if (v?.includes('url(#')) el.setAttribute(attr, v.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`));
    }
  }
}

/** Boolean-ish property value as Oryx reads it (`true`, `"true"`). */
export const truthy = (v: unknown) => v === true || v === 'true';

/** Which view elements properties show or hide: element ref → visible. */
export function propertyToggles(
  refs: { key: string; type: string; refToView: string[] }[],
  props: Record<string, unknown>,
): Map<string, boolean> {
  const toggles = new Map<string, boolean>();
  for (const p of refs) {
    if (!p.refToView.length) continue;
    const value = props[p.key];
    if (p.type === 'boolean') {
      for (const ref of p.refToView) toggles.set(ref, truthy(value));
    } else if (p.type === 'flowable-multiinstance' || p.type === 'kisbpm-multiinstance') {
      const v = String(value ?? '').toLowerCase();
      toggles.set('parallel', v === 'parallel');
      toggles.set('sequential', v === 'sequential');
    }
  }
  return toggles;
}

/** A node stencil's view, parsed once, that can be laid out and rendered at any size. */
export class NodeView {
  readonly width: number;
  readonly height: number;
  readonly resizableH: boolean;
  readonly resizableV: boolean;
  readonly minSize: { w: number; h: number } | null;
  readonly maxSize: { w: number; h: number } | null;
  readonly magnets: Magnet[];
  /** Node-local reference point of the node's own docker (boundary, catch and throw events). */
  readonly docker: Point | null;
  private readonly template: Element;
  private readonly shapes: ViewShape[];
  private readonly labels: ViewLabel[];
  private readonly offset: Point;

  constructor(view: string) {
    const doc = parseSvg(view);
    const svg = doc.documentElement;
    const g = Array.from(svg.getElementsByTagNameNS(SVG_NS, 'g'))[0] ?? svg;
    this.template = g;
    const elements = descendants(g);
    const raw = elements
      .filter((el) => SHAPE_TAGS[el.localName])
      .map((el) => {
        const kind = SHAPE_TAGS[el.localName];
        const resize = (oryx(el, 'resize') ?? '').toLowerCase();
        const chain: ViewShape['chain'] = [];
        for (let e: Element | null = el; e && e !== svg; e = e.parentElement) {
          chain.push({ id: e.getAttribute('id'), hidden: e.getAttribute('display') === 'none' });
        }
        return {
          kind,
          chain,
          invisible: el.getAttribute('fill') === 'none' && el.getAttribute('stroke') === 'none',
          ...readGeometry(el, kind),
          anchors: parseAnchors(oryx(el, 'anchors')),
          resizeH: resize.includes('horizontal'),
          resizeV: resize.includes('vertical'),
        };
      });
    const minX = raw.length ? Math.min(...raw.map((s) => s.box.x)) : 0;
    const minY = raw.length ? Math.min(...raw.map((s) => s.box.y)) : 0;
    const maxX = raw.length ? Math.max(...raw.map((s) => s.box.x + s.box.w)) : 1;
    const maxY = raw.length ? Math.max(...raw.map((s) => s.box.y + s.box.h)) : 1;
    this.offset = { x: minX, y: minY };
    this.width = maxX - minX || 1;
    this.height = maxY - minY || 1;
    this.shapes = raw.map((s) => ({
      ...s,
      box: { ...s.box, x: s.box.x - minX, y: s.box.y - minY },
      segments: s.segments && rescalePath(s.segments, { x: 0, y: 0 }, { x: -minX, y: -minY }, 1, 1),
      points: s.points?.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    }));
    this.resizableH = this.shapes.some((s) => s.resizeH || (s.anchors.left && s.anchors.right));
    this.resizableV = this.shapes.some((s) => s.resizeV || (s.anchors.top && s.anchors.bottom));
    this.minSize = parseSize(oryx(g, 'minimumSize'));
    this.maxSize = parseSize(oryx(g, 'maximumSize'));
    this.labels = elements
      .filter((el) => el.localName === 'text')
      .map((el) => parseLabel(el, g, this.offset));

    const magnetEls = Array.from(svg.getElementsByTagNameNS(ORYX_NS, 'magnet'));
    this.magnets = magnetEls.length
      ? magnetEls.map((m) => ({
          x: parseFloat(oryx(m, 'cx') ?? '0') - minX,
          y: parseFloat(oryx(m, 'cy') ?? '0') - minY,
          anchors: parseAnchors(oryx(m, 'anchors')),
          isDefault: oryx(m, 'default') === 'yes',
        }))
      : [
          {
            x: this.width / 2,
            y: this.height / 2,
            anchors: parseAnchors(null),
            isDefault: true,
          },
        ];
    const docker = svg.getElementsByTagNameNS(ORYX_NS, 'docker')[0];
    this.docker = docker
      ? {
          x: parseFloat(oryx(docker, 'cx') ?? '0') - minX,
          y: parseFloat(oryx(docker, 'cy') ?? '0') - minY,
        }
      : null;
  }

  /** The size a node really gets: fixed axes keep the view size, the others are clamped. */
  clampSize(w: number, h: number): { w: number; h: number } {
    let width = this.resizableH ? w : this.width;
    let height = this.resizableV ? h : this.height;
    if (this.minSize) {
      width = Math.max(width, this.minSize.w);
      height = Math.max(height, this.minSize.h);
    }
    if (this.maxSize) {
      width = Math.min(width, this.maxSize.w);
      height = Math.min(height, this.maxSize.h);
    }
    return { w: Math.max(1, width), h: Math.max(1, height) };
  }

  /** The default magnet in node-local coordinates for a node of this size. */
  defaultMagnet(w: number, h: number): Point {
    const m = this.magnets.find((x) => x.isDefault) ?? this.magnets[0];
    return this.placeMagnet(m, w, h);
  }

  placeMagnet(m: Magnet, w: number, h: number): Point {
    return {
      x: movePoint(m.x, this.width, w, m.anchors.left, m.anchors.right),
      y: movePoint(m.y, this.height, h, m.anchors.top, m.anchors.bottom),
    };
  }

  private layoutShape(s: ViewShape, W: number, H: number) {
    const [x, w] = layoutAxis(s.box.x, s.box.w, this.width, W, s.resizeH, s.anchors.left, s.anchors.right);
    const [y, h] = layoutAxis(s.box.y, s.box.h, this.height, H, s.resizeV, s.anchors.top, s.anchors.bottom);
    const box = { x, y, w, h };
    const sx = s.box.w ? w / s.box.w : 0;
    const sy = s.box.h ? h / s.box.h : 0;
    return {
      box,
      segments: s.segments && rescalePath(s.segments, s.box, box, sx, sy),
      points: s.points?.map((p) => ({ x: (p.x - s.box.x) * sx + x, y: (p.y - s.box.y) * sy + y })),
    };
  }

  /** Lays the view out at size w×h with the given properties, without touching the DOM. */
  layout(
    w: number,
    h: number,
    props: Record<string, unknown>,
    refs: { key: string; type: string; refToView: string[] }[],
  ): NodeLayout {
    const toggles = propertyToggles(refs, props);
    const shapes: LaidOutShape[] = this.shapes.map((s) => {
      let visible = true;
      for (const link of s.chain) {
        const toggled = link.id != null ? toggles.get(link.id) : undefined;
        if (toggled === false || (toggled === undefined && link.hidden)) {
          visible = false;
          break;
        }
      }
      return { kind: s.kind, ...this.layoutShape(s, w, h), visible: visible && !s.invisible };
    });
    const ids = this.shapes.map((s) => s.chain[0]?.id ?? null);
    const labels = this.labels.map((label) => {
      const lx = movePoint(label.x, this.width, w, label.anchors.left, label.anchors.right);
      const ly = movePoint(label.y, this.height, h, label.anchors.top, label.anchors.bottom);
      let refWidth: number | null = null;
      if (label.fitTo) {
        const index = ids.indexOf(label.fitTo);
        if (index >= 0) {
          const box = shapes[index].box;
          refWidth = label.rotate % 180 !== 0 ? box.h : box.w;
        }
      }
      return { ...label, lx, ly, refWidth };
    });
    const magnets = this.magnets.map((m) => ({ ...m, ...this.placeMagnet(m, w, h) }));
    return { width: w, height: h, shapes, magnets, labels, toggles };
  }

  /**
   * Renders a laid-out node. `props` fill the labels; ids are prefixed with `prefix` so
   * gradients stay unique on the canvas.
   */
  render(
    layout: NodeLayout,
    props: Record<string, unknown>,
    refs: { key: string; type: string; refToView: string[] }[],
    prefix: string,
  ): SVGGElement {
    const g = document.importNode(this.template, true) as unknown as SVGGElement;
    g.removeAttribute('transform');
    const elements = descendants(g);
    const shapeEls = elements.filter((el) => SHAPE_TAGS[el.localName]);
    layout.shapes.forEach(({ kind, box, segments, points }, i) => {
      const el = shapeEls[i];
      switch (kind) {
        case 'rect':
          el.setAttribute('x', String(box.x));
          el.setAttribute('y', String(box.y));
          el.setAttribute('width', String(Math.max(0, box.w)));
          el.setAttribute('height', String(Math.max(0, box.h)));
          break;
        case 'circle':
          el.setAttribute('r', String(Math.min(box.w, box.h) / 2));
          el.setAttribute('cx', String(box.x + box.w / 2));
          el.setAttribute('cy', String(box.y + box.h / 2));
          break;
        case 'ellipse':
          el.setAttribute('rx', String(box.w / 2));
          el.setAttribute('ry', String(box.h / 2));
          el.setAttribute('cx', String(box.x + box.w / 2));
          el.setAttribute('cy', String(box.y + box.h / 2));
          break;
        case 'line':
          el.setAttribute('x1', String(box.x));
          el.setAttribute('y1', String(box.y));
          el.setAttribute('x2', String(box.x + box.w));
          el.setAttribute('y2', String(box.y + box.h));
          break;
        case 'poly':
          el.setAttribute('points', (points ?? []).map((p) => `${p.x},${p.y}`).join(' '));
          break;
        case 'path':
          el.setAttribute('d', formatPath(segments ?? []));
          break;
      }
    });

    for (const el of [g, ...elements]) {
      const id = el.getAttribute('id');
      const visible = id != null ? layout.toggles.get(id) : undefined;
      if (visible !== undefined) el.setAttribute('display', visible ? 'inherit' : 'none');
    }

    const labelValues = new Map<string, unknown>();
    for (const p of refs) {
      if (p.type === 'boolean' || p.type.includes('multiinstance')) continue;
      for (const ref of p.refToView) labelValues.set(ref, props[p.key]);
    }
    const textEls = elements.filter((el) => el.localName === 'text');
    layout.labels.forEach((label, i) => {
      const el = textEls[i];
      let lines = labelLines(labelValues.get(label.id));
      if (label.refWidth != null) {
        lines = lines.flatMap((l) => wrapLine(l, label.refWidth!, label.fontSize));
      }
      renderLabel(el, lines, label.lx, label.ly, label.vAlign, label.hAlign, label.fontSize);
      if (label.rotate) {
        el.setAttribute(
          'transform',
          `rotate(${label.rotate} ${Math.floor(label.lx)} ${Math.floor(label.ly)})`,
        );
      }
      el.setAttribute('pointer-events', 'none');
    });
    prefixIds(g, prefix);
    return g;
  }

  /** Oryx hit test: inside any visible shape element (node-local point). */
  static contains(layout: NodeLayout, p: Point): boolean {
    if (p.x < 0 || p.y < 0 || p.x > layout.width || p.y > layout.height) return false;
    return layout.shapes.some((s) => {
      if (!s.visible) return false;
      const b = s.box;
      switch (s.kind) {
        case 'rect':
        case 'line':
          return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
        case 'circle': {
          const r = Math.min(b.w, b.h) / 2;
          return Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2)) <= r;
        }
        case 'ellipse': {
          const rx = b.w / 2;
          const ry = b.h / 2;
          if (!rx || !ry) return false;
          const dx = (p.x - (b.x + rx)) / rx;
          const dy = (p.y - (b.y + ry)) / ry;
          return dx * dx + dy * dy <= 1;
        }
        case 'poly':
          return pointInPolygon(p, s.points ?? []);
        case 'path': {
          const poly = pathPoints(s.segments ?? []);
          return poly.length > 2 && pointInPolygon(p, poly);
        }
      }
    });
  }
}

/** An edge stencil's view: markers, the line style and the label. */
export class EdgeView {
  private readonly markers: Element[];
  private readonly paths: Element[];
  private readonly label: ViewLabel | null;
  private readonly labelEl: Element | null;

  constructor(view: string) {
    const doc = parseSvg(view);
    const svg = doc.documentElement;
    const defs = Array.from(svg.children).find((c) => c.localName === 'defs');
    this.markers = defs ? Array.from(defs.children).filter((c) => c.localName === 'marker') : [];
    const g = Array.from(svg.getElementsByTagNameNS(SVG_NS, 'g'))[0] ?? svg;
    this.paths = Array.from(g.children).filter((c) => c.localName === 'path');
    this.labelEl = descendants(g).find((c) => c.localName === 'text') ?? null;
    this.label = this.labelEl ? parseLabel(this.labelEl, g, { x: 0, y: 0 }) : null;
  }

  render(
    points: Point[],
    props: Record<string, unknown>,
    refs: { key: string; type: string; refToView: string[] }[],
    prefix: string,
  ): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g');
    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const m of this.markers) defs.appendChild(document.importNode(m, true));
    g.appendChild(defs);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join(' ');
    const template = this.paths[0];
    if (template) {
      const path = document.importNode(template, false) as Element;
      path.setAttribute('d', d);
      g.appendChild(path);
    }
    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('d', d);
    hit.setAttribute('class', 'edge-hit');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '12');
    hit.setAttribute('fill', 'none');
    g.appendChild(hit);

    const toggles = propertyToggles(refs, props);
    for (const [ref, visible] of toggles) {
      const el = descendants(defs).find((e) => e.getAttribute('id') === ref);
      if (el) el.setAttribute('display', visible ? 'inherit' : 'none');
    }

    if (this.label && this.labelEl && points.length > 1) {
      const nameRef = refs.find((r) => r.refToView.includes(this.label!.id));
      const text = document.importNode(this.labelEl, true) as Element;
      const lines = labelLines(nameRef ? props[nameRef.key] : '');
      if (lines.length) {
        placeEdgeLabel(text, this.label, points, lines);
        text.setAttribute('pointer-events', 'none');
        g.appendChild(text);
      }
    }
    prefixIds(g, prefix);
    return g;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

function angleOf(a: Point, b: Point): number {
  // Degrees, counter-clockwise with screen y pointing up.
  const deg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function placeEdgeLabel(text: Element, label: ViewLabel, points: Point[], lines: string[]) {
  const pos = label.edgePosition ?? 'starttop';
  const offTop = label.offsetTop;
  const offBottom = label.offsetBottom;
  let anchorPoint: Point;
  let angle: number;
  let hAlign: ViewLabel['hAlign'];
  let vAlign: ViewLabel['vAlign'];
  let x: number;
  let y: number;
  let rotate = true;
  const fwdOf = (a: number) => a <= 90 || a > 270;

  const start = () => {
    anchorPoint = points[0];
    angle = angleOf(points[0], points[1]);
  };
  const end = () => {
    anchorPoint = points[points.length - 1];
    angle = angleOf(points[points.length - 2], anchorPoint);
  };

  if (pos.startsWith('mid')) {
    const n = points.length;
    if (n % 2 === 0) {
      const a = points[n / 2 - 1];
      const b = points[n / 2];
      anchorPoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      angle = angleOf(a, b);
      hAlign = 'center';
      if (pos === 'midtop') {
        vAlign = 'bottom';
        x = anchorPoint.x;
        y = anchorPoint.y - offTop;
      } else {
        vAlign = 'top';
        x = anchorPoint.x;
        y = anchorPoint.y + offBottom;
      }
    } else {
      const i = Math.floor(n / 2);
      anchorPoint = points[i];
      angle = angleOf(points[i], points[i + 1] ?? points[i - 1]);
      const fwd = fwdOf(angle);
      if (pos === 'midtop') {
        hAlign = fwd ? 'left' : 'right';
        vAlign = 'bottom';
        x = anchorPoint.x + (fwd ? offTop : -offTop);
        y = anchorPoint.y - offTop;
      } else {
        hAlign = fwd ? 'left' : 'right';
        vAlign = 'top';
        x = anchorPoint.x + (fwd ? offBottom : -offBottom);
        y = anchorPoint.y + offBottom;
        rotate = false;
      }
    }
  } else if (pos.startsWith('end')) {
    end();
    const fwd = fwdOf(angle!);
    if (pos === 'endtop') {
      hAlign = fwd ? 'right' : 'left';
      vAlign = 'bottom';
      x = anchorPoint!.x + (fwd ? -offTop : offTop);
      y = anchorPoint!.y - offTop;
    } else {
      hAlign = fwd ? 'right' : 'left';
      vAlign = 'top';
      x = anchorPoint!.x + (fwd ? -offBottom : offBottom);
      y = anchorPoint!.y + offBottom;
    }
  } else {
    start();
    const fwd = fwdOf(angle!);
    if (pos === 'startmiddle') {
      hAlign = fwd ? 'left' : 'right';
      vAlign = 'bottom';
      x = anchorPoint!.x + (fwd ? 2 : 1);
      y = anchorPoint!.y + 4;
      rotate = false;
    } else if (pos === 'startbottom') {
      hAlign = fwd ? 'left' : 'right';
      vAlign = 'top';
      x = anchorPoint!.x + (fwd ? offBottom : -offBottom);
      y = anchorPoint!.y + offBottom;
    } else {
      hAlign = fwd ? 'left' : 'right';
      vAlign = 'bottom';
      x = anchorPoint!.x + (fwd ? offTop : -offTop);
      y = anchorPoint!.y - offTop;
    }
  }
  renderLabel(text, lines, x!, y!, vAlign!, hAlign!, label.fontSize);
  if (rotate) {
    const fwd = fwdOf(angle!);
    const deg = fwd ? 360 - angle! : 180 - angle!;
    text.setAttribute(
      'transform',
      `rotate(${round(deg % 360)} ${round(anchorPoint!.x)} ${round(anchorPoint!.y)})`,
    );
  }
}
