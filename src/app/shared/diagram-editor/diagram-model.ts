import { Box, Point, boxOfPoints } from './geometry';
import { Stencil, StencilSet } from './stencil-set';

/** An end of an edge, docked at `ref` relative to the shape's upper-left corner. */
export interface Dock {
  id: string;
  ref: Point;
}

export interface DiagramNode {
  kind: 'node';
  id: string;
  stencil: string;
  properties: Record<string, unknown>;
  /** Absolute canvas coordinates. */
  bounds: Box;
  parent: string | null;
  children: string[];
  /** Boundary events: the activity they sit on. */
  host: Dock | null;
  /** Keys of the loaded JSON this editor does not manage (kept as they were). */
  extra: Record<string, unknown>;
}

export interface DiagramEdge {
  kind: 'edge';
  id: string;
  stencil: string;
  properties: Record<string, unknown>;
  source: Dock | null;
  target: Dock | null;
  /** Absolute position of a free (undocked) start or end. */
  start: Point;
  end: Point;
  /** Absolute bend points. */
  bends: Point[];
  extra: Record<string, unknown>;
}

export type DiagramElement = DiagramNode | DiagramEdge;

/** Everything that changes while editing; plain data so it can be snapshotted for undo. */
export interface DiagramState {
  properties: Record<string, unknown>;
  nodes: Record<string, DiagramNode>;
  edges: Record<string, DiagramEdge>;
  /** Top-level node ids in z-order. */
  roots: string[];
  /** Edge ids in z-order. */
  edgeOrder: string[];
}

/** Editor JSON of one shape, as stored by the Modeler. */
export interface ShapeJson {
  resourceId: string;
  properties?: Record<string, unknown>;
  stencil: { id: string };
  childShapes?: ShapeJson[];
  outgoing?: { resourceId: string }[] | null;
  bounds?: { upperLeft: Point; lowerRight: Point } | null;
  dockers?: Point[] | null;
  target?: { resourceId: string } | null;
  [key: string]: unknown;
}

export interface ModelJson {
  bounds?: { upperLeft: Point; lowerRight: Point };
  properties?: Record<string, unknown>;
  childShapes?: ShapeJson[];
  stencil?: { id: string };
  stencilset?: { namespace: string; url?: string };
  [key: string]: unknown;
}

const MANAGED_KEYS = new Set([
  'resourceId',
  'properties',
  'stencil',
  'childShapes',
  'outgoing',
  'bounds',
  'dockers',
  'target',
]);

export const CANVAS_MIN = { w: 1200, h: 1050 };

/** Oryx `provideId`: "sid-" plus an upper-case UUID v4. */
export function newResourceId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  return `sid-${uuid.toUpperCase()}`;
}

const toBox = (b: ShapeJson['bounds'], origin: Point): Box =>
  b
    ? {
        x: origin.x + b.upperLeft.x,
        y: origin.y + b.upperLeft.y,
        w: b.lowerRight.x - b.upperLeft.x,
        h: b.lowerRight.y - b.upperLeft.y,
      }
    : { x: origin.x, y: origin.y, w: 0, h: 0 };

const extraKeys = (json: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(json).filter(([k]) => !MANAGED_KEYS.has(k)));

/**
 * Stencil properties with defaults filled in, like Oryx does when it creates a shape. Values the
 * JSON already has win, and keys the stencil does not know are kept.
 */
export function withDefaults(stencil: Stencil | undefined, props: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const p of stencil?.properties ?? []) {
    out[p.key] = p.key in props ? props[p.key] : structuredClone(p.defaultValue);
  }
  for (const [k, v] of Object.entries(props)) if (!(k in out)) out[k] = v;
  return out;
}

/** Clamps a size to what a stencil allows (fixed-size stencils keep their view size). */
export type SizeClamp = (stencil: string, w: number, h: number) => { w: number; h: number };

/** Builds the editing state from the stored editor JSON. */
export function loadDiagram(json: ModelJson, set: StencilSet, clamp: SizeClamp): DiagramState {
  const state: DiagramState = {
    properties: withDefaults(set.rootStencil, json.properties ?? {}),
    nodes: {},
    edges: {},
    roots: [],
    edgeOrder: [],
  };
  const edgeJson: ShapeJson[] = [];
  const outgoing = new Map<string, string[]>();
  const dockers = new Map<string, Point[]>();

  const visit = (shapes: ShapeJson[], parent: DiagramNode | null) => {
    const origin = parent ? { x: parent.bounds.x, y: parent.bounds.y } : { x: 0, y: 0 };
    for (const shape of shapes ?? []) {
      const stencil = set.stencil(shape.stencil?.id);
      if (stencil?.type === 'edge') {
        edgeJson.push(shape);
        continue;
      }
      const box = toBox(shape.bounds, origin);
      const size = clamp(shape.stencil.id, box.w, box.h);
      const node: DiagramNode = {
        kind: 'node',
        id: shape.resourceId,
        stencil: shape.stencil.id,
        properties: withDefaults(stencil, shape.properties ?? {}),
        bounds: { x: box.x, y: box.y, w: size.w, h: size.h },
        parent: parent?.id ?? null,
        children: [],
        host: null,
        extra: extraKeys(shape),
      };
      state.nodes[node.id] = node;
      if (parent) parent.children.push(node.id);
      else state.roots.push(node.id);
      outgoing.set(node.id, (shape.outgoing ?? []).map((o) => o.resourceId));
      if (shape.dockers?.length) dockers.set(node.id, shape.dockers);
      // Collapsed sub-processes keep their children in their own canvas: leave them as data.
      if (shape.stencil.id === 'CollapsedSubProcess') {
        node.extra['childShapes'] = shape.childShapes ?? [];
      } else {
        visit(shape.childShapes ?? [], node);
      }
    }
  };
  visit(json.childShapes ?? [], null);

  // Sources come from the nodes' `outgoing` lists; boundary events are listed there too.
  const sourceOf = new Map<string, string>();
  for (const [nodeId, targets] of outgoing) {
    for (const t of targets) {
      const attached = state.nodes[t];
      const tStencil = attached && set.stencil(attached.stencil);
      if (attached && tStencil && set.isBoundaryEvent(tStencil)) {
        const host = state.nodes[nodeId];
        const ref = dockers.get(t)?.[0] ?? {
          x: attached.bounds.x + attached.bounds.w / 2 - host.bounds.x,
          y: attached.bounds.y + attached.bounds.h / 2 - host.bounds.y,
        };
        attached.host = { id: nodeId, ref: { x: ref.x, y: ref.y } };
        placeOnHost(state, attached);
      } else {
        sourceOf.set(t, nodeId);
      }
    }
  }
  // Free nodes that carry a docker (catch and throw events) are positioned by it.
  for (const [id, points] of dockers) {
    const node = state.nodes[id];
    if (!node || node.host || points.length !== 1) continue;
    const parent = node.parent ? state.nodes[node.parent] : null;
    const cx = (parent?.bounds.x ?? 0) + points[0].x;
    const cy = (parent?.bounds.y ?? 0) + points[0].y;
    node.bounds = { ...node.bounds, x: cx - node.bounds.w / 2, y: cy - node.bounds.h / 2 };
  }

  for (const shape of edgeJson) {
    const points = (shape.dockers ?? []).map((p) => ({ x: p.x, y: p.y }));
    const sourceId = sourceOf.get(shape.resourceId);
    const targetId = shape.target?.resourceId ?? shape.outgoing?.[0]?.resourceId;
    const source = sourceId && state.nodes[sourceId] ? sourceId : null;
    const target = targetId && state.nodes[targetId] ? targetId : null;
    const first = points[0] ?? { x: 0, y: 0 };
    const last = points[points.length - 1] ?? first;
    const center = (id: string) => ({
      x: state.nodes[id].bounds.w / 2,
      y: state.nodes[id].bounds.h / 2,
    });
    const edge: DiagramEdge = {
      kind: 'edge',
      id: shape.resourceId,
      stencil: shape.stencil.id,
      properties: withDefaults(set.stencil(shape.stencil.id), shape.properties ?? {}),
      source: source ? { id: source, ref: points.length ? first : center(source) } : null,
      target: target ? { id: target, ref: points.length > 1 ? last : center(target) } : null,
      start: source ? { x: 0, y: 0 } : first,
      end: target ? { x: 0, y: 0 } : last,
      bends: points.slice(1, -1),
      extra: extraKeys(shape),
    };
    state.edges[edge.id] = edge;
    state.edgeOrder.push(edge.id);
  }
  return state;
}

/** Puts a boundary event's centre on its docking point. */
export function placeOnHost(state: DiagramState, node: DiagramNode) {
  if (!node.host) return;
  const host = state.nodes[node.host.id];
  if (!host) return;
  node.bounds = {
    ...node.bounds,
    x: host.bounds.x + node.host.ref.x - node.bounds.w / 2,
    y: host.bounds.y + node.host.ref.y - node.bounds.h / 2,
  };
}

/** Rendered polyline of an edge; `clip` trims docked ends to the shape outline. */
export type EdgeRouter = (edge: DiagramEdge) => Point[];

/** Serialises the state back to the editor JSON the server stores (Oryx `toJSON`). */
export function saveDiagram(
  state: DiagramState,
  base: { modelId: string; stencilId: string; namespace: string; url?: string },
  route: EdgeRouter,
  hasDocker: (stencil: string) => boolean,
): ModelJson {
  const nodeJson = (node: DiagramNode, origin: Point): ShapeJson => {
    const out: ShapeJson = {
      resourceId: node.id,
      properties: node.properties,
      stencil: { id: node.stencil },
      childShapes:
        node.stencil === 'CollapsedSubProcess' && Array.isArray(node.extra['childShapes'])
          ? (node.extra['childShapes'] as ShapeJson[])
          : node.children.map((c) => nodeJson(state.nodes[c], node.bounds)),
      outgoing: [
        ...state.edgeOrder.filter((e) => state.edges[e].source?.id === node.id),
        ...Object.values(state.nodes)
          .filter((n) => n.host?.id === node.id)
          .map((n) => n.id),
      ].map((resourceId) => ({ resourceId })),
      bounds: {
        lowerRight: {
          x: node.bounds.x - origin.x + node.bounds.w,
          y: node.bounds.y - origin.y + node.bounds.h,
        },
        upperLeft: { x: node.bounds.x - origin.x, y: node.bounds.y - origin.y },
      },
      dockers: node.host
        ? [{ ...node.host.ref }]
        : hasDocker(node.stencil)
          ? [
              {
                x: node.bounds.x - origin.x + node.bounds.w / 2,
                y: node.bounds.y - origin.y + node.bounds.h / 2,
              },
            ]
          : [],
    };
    for (const [k, v] of Object.entries(node.extra)) if (k !== 'childShapes') out[k] = v;
    return out;
  };

  const edgeJson = (edge: DiagramEdge): ShapeJson => {
    const points = route(edge);
    const box = boxOfPoints(points.length ? points : [edge.start]);
    const out: ShapeJson = {
      resourceId: edge.id,
      properties: edge.properties,
      stencil: { id: edge.stencil },
      childShapes: [],
      outgoing: edge.target ? [{ resourceId: edge.target.id }] : [],
      bounds: {
        lowerRight: { x: box.x + box.w, y: box.y + box.h },
        upperLeft: { x: box.x, y: box.y },
      },
      dockers: [
        edge.source ? { ...edge.source.ref } : { ...edge.start },
        ...edge.bends.map((b) => ({ ...b })),
        edge.target ? { ...edge.target.ref } : { ...edge.end },
      ],
    };
    if (edge.target) out.target = { resourceId: edge.target.id };
    for (const [k, v] of Object.entries(edge.extra)) out[k] = v;
    return out;
  };

  const origin = { x: 0, y: 0 };
  const size = canvasSize(state);
  return {
    modelId: base.modelId,
    bounds: { lowerRight: { x: size.w, y: size.h }, upperLeft: { x: 0, y: 0 } },
    properties: state.properties,
    childShapes: [
      ...state.roots.map((id) => nodeJson(state.nodes[id], origin)),
      ...state.edgeOrder.map((id) => edgeJson(state.edges[id])),
    ],
    stencil: { id: base.stencilId },
    stencilset: { namespace: base.namespace, url: base.url },
  };
}

/** Canvas size: at least 1200×1050, and 100px beyond the lowest-right shape. */
export function canvasSize(state: DiagramState): { w: number; h: number } {
  let w = CANVAS_MIN.w;
  let h = CANVAS_MIN.h;
  for (const n of Object.values(state.nodes)) {
    w = Math.max(w, n.bounds.x + n.bounds.w + 100);
    h = Math.max(h, n.bounds.y + n.bounds.h + 100);
  }
  for (const e of Object.values(state.edges)) {
    for (const p of [...e.bends, e.start, e.end]) {
      w = Math.max(w, p.x + 100);
      h = Math.max(h, p.y + 100);
    }
  }
  return { w, h };
}
