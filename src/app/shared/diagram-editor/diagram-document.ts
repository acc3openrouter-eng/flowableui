import { computed, signal } from '@angular/core';
import {
  DiagramEdge,
  DiagramElement,
  DiagramNode,
  DiagramState,
  ModelJson,
  loadDiagram,
  newResourceId,
  placeOnHost,
  saveDiagram,
  withDefaults,
} from './diagram-model';
import { Box, Point, center, clipToOutline, inBox } from './geometry';
import { Stencil, StencilSet } from './stencil-set';
import { EdgeView, NodeLayout, NodeView } from './stencil-view';

const HISTORY_LIMIT = 200;
/** Distance from an activity's border within which a boundary event attaches (Oryx BORDER_OFFSET). */
export const ATTACH_DISTANCE = 14;
/** Gap between a shape and the one the quick menu adds after it. */
export const QUICK_ADD_GAP = 45;
/** Offset of pasted shapes. */
export const PASTE_OFFSET = 30;

/** The diagram being edited: stencil set, views, state, selection and undo history. */
export class DiagramDocument {
  private readonly nodeViews = new Map<string, NodeView>();
  private readonly edgeViews = new Map<string, EdgeView>();
  private readonly layouts = new Map<string, { key: string; layout: NodeLayout }>();

  /** Committed state. */
  private readonly committed = signal<DiagramState>(emptyState());
  /** Transient state while dragging; rendered instead of the committed one. */
  private readonly preview = signal<DiagramState | null>(null);
  readonly state = computed(() => this.preview() ?? this.committed());

  private readonly undoStack = signal<DiagramState[]>([]);
  private readonly redoStack = signal<DiagramState[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /** Bumped on every commit, undo and redo; `savedRevision` marks the last save. */
  private readonly revision = signal(0);
  private readonly savedRevision = signal(0);
  private readonly savedJson = signal('');
  readonly dirty = computed(() => {
    if (this.revision() === this.savedRevision()) return false;
    return this.serialize() !== this.savedJson();
  });

  readonly selection = signal<string[]>([]);
  readonly selectedElements = computed(() => {
    const s = this.state();
    return this.selection()
      .map((id): DiagramElement | undefined => s.nodes[id] ?? s.edges[id])
      .filter((e): e is DiagramElement => !!e);
  });

  private clipboard: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null = null;
  readonly canPaste = signal(false);

  constructor(
    readonly stencils: StencilSet,
    readonly modelId: string,
    private readonly stencilsetUrl?: string,
  ) {}

  // Views and geometry

  nodeView(stencil: string): NodeView {
    let view = this.nodeViews.get(stencil);
    if (!view) {
      view = new NodeView(this.stencils.stencil(stencil)?.view ?? '<svg/>');
      this.nodeViews.set(stencil, view);
    }
    return view;
  }

  edgeView(stencil: string): EdgeView {
    let view = this.edgeViews.get(stencil);
    if (!view) {
      view = new EdgeView(this.stencils.stencil(stencil)?.view ?? '<svg/>');
      this.edgeViews.set(stencil, view);
    }
    return view;
  }

  /** Properties that change a stencil's view (refToView). */
  viewRefs(stencil: string) {
    return (this.stencils.stencil(stencil)?.properties ?? []).filter((p) => p.refToView.length);
  }

  hasDocker(stencil: string): boolean {
    return !!this.nodeView(stencil).docker;
  }

  layoutOf(node: DiagramNode): NodeLayout {
    const refs = this.viewRefs(node.stencil);
    const key = JSON.stringify([
      node.stencil,
      node.bounds.w,
      node.bounds.h,
      refs.map((r) => (r.type === 'boolean' || r.type.includes('multi') ? node.properties[r.key] : 0)),
    ]);
    const cached = this.layouts.get(node.id);
    if (cached?.key === key) return cached.layout;
    const layout = this.nodeView(node.stencil).layout(
      node.bounds.w,
      node.bounds.h,
      node.properties,
      refs,
    );
    this.layouts.set(node.id, { key, layout });
    return layout;
  }

  /** Is the absolute point inside the node's visible outline? */
  containsPoint(node: DiagramNode, p: Point): boolean {
    return NodeView.contains(this.layoutOf(node), { x: p.x - node.bounds.x, y: p.y - node.bounds.y });
  }

  /** The rendered polyline of an edge: bends plus both ends clipped to the docked outlines. */
  route(edge: DiagramEdge, state: DiagramState = this.state()): Point[] {
    const source = edge.source && state.nodes[edge.source.id];
    const target = edge.target && state.nodes[edge.target.id];
    const a = source ? abs(source, edge.source!.ref) : edge.start;
    const b = target ? abs(target, edge.target!.ref) : edge.end;
    const startNeighbour = edge.bends[0] ?? b;
    const endNeighbour = edge.bends[edge.bends.length - 1] ?? a;
    const start = source
      ? (clipToOutline(a, startNeighbour, (p) => this.containsPoint(source, p)) ?? a)
      : a;
    const end = target
      ? (clipToOutline(b, endNeighbour, (p) => this.containsPoint(target, p)) ?? b)
      : b;
    return [start, ...edge.bends, end];
  }

  // Loading and saving

  load(json: ModelJson) {
    const state = loadDiagram(json, this.stencils, (stencil, w, h) =>
      this.nodeView(stencil).clampSize(w, h),
    );
    this.committed.set(state);
    this.preview.set(null);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.selection.set([]);
    this.markSaved();
  }

  toJson(): ModelJson {
    const root = this.stencils.rootStencil;
    return saveDiagram(
      this.committed(),
      {
        modelId: this.modelId,
        stencilId: root.id,
        namespace: this.stencils.namespace,
        url: this.stencilsetUrl,
      },
      (edge) => this.route(edge, this.committed()),
      (stencil) => this.hasDocker(stencil),
    );
  }

  private serialize(): string {
    const s = this.committed();
    return JSON.stringify([s.properties, s.nodes, s.edges, s.roots, s.edgeOrder]);
  }

  markSaved() {
    this.savedRevision.set(this.revision());
    this.savedJson.set(this.serialize());
  }

  // Undo

  /** Applies a change to a copy of the state and records the previous state for undo. */
  update(change: (draft: DiagramState) => void): void {
    const before = this.committed();
    const draft = structuredClone(before);
    change(draft);
    this.preview.set(null);
    this.committed.set(draft);
    this.undoStack.update((s) => [...s.slice(-HISTORY_LIMIT + 1), before]);
    this.redoStack.set([]);
    this.revision.update((r) => r + 1);
    this.pruneSelection();
  }

  /** Shows a change without committing it (used while dragging). */
  showPreview(change: ((draft: DiagramState) => void) | null) {
    if (!change) {
      this.preview.set(null);
      return;
    }
    const draft = structuredClone(this.committed());
    change(draft);
    this.preview.set(draft);
  }

  undo() {
    const stack = this.undoStack();
    if (!stack.length) return;
    this.redoStack.update((s) => [...s, this.committed()]);
    this.committed.set(stack[stack.length - 1]);
    this.undoStack.set(stack.slice(0, -1));
    this.preview.set(null);
    this.revision.update((r) => r + 1);
    this.pruneSelection();
  }

  redo() {
    const stack = this.redoStack();
    if (!stack.length) return;
    this.undoStack.update((s) => [...s, this.committed()]);
    this.committed.set(stack[stack.length - 1]);
    this.redoStack.set(stack.slice(0, -1));
    this.preview.set(null);
    this.revision.update((r) => r + 1);
    this.pruneSelection();
  }

  private pruneSelection() {
    const s = this.committed();
    const kept = this.selection().filter((id) => s.nodes[id] || s.edges[id]);
    if (kept.length !== this.selection().length) this.selection.set(kept);
  }

  // Queries

  stencilOf(el: DiagramElement): Stencil | undefined {
    return this.stencils.stencil(el.stencil);
  }

  /** Nodes in paint order: parents before children. */
  paintOrder(state: DiagramState = this.state()): DiagramNode[] {
    const out: DiagramNode[] = [];
    const visit = (id: string) => {
      const node = state.nodes[id];
      if (!node) return;
      out.push(node);
      node.children.forEach(visit);
    };
    state.roots.forEach(visit);
    return out;
  }

  /** The topmost node containing the point, skipping `exclude` and their descendants. */
  nodeAt(p: Point, exclude: Set<string> = new Set(), state = this.state()): DiagramNode | null {
    const order = this.paintOrder(state);
    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      if (exclude.has(node.id) || this.hasAncestorIn(node, exclude, state)) continue;
      if (inBox(p, node.bounds)) return node;
    }
    return null;
  }

  hasAncestorIn(node: DiagramNode, ids: Set<string>, state = this.state()): boolean {
    for (let p = node.parent; p; p = state.nodes[p]?.parent ?? null) if (ids.has(p)) return true;
    return false;
  }

  /** May a node of `stencil` be placed in `parent` (null: the canvas)? */
  canPlace(stencil: Stencil, parent: DiagramNode | null): boolean {
    const parentStencil = parent ? this.stencilOf(parent) : this.stencils.rootStencil;
    return !!parentStencil && this.stencils.canContain(parentStencil, stencil);
  }

  /** Where a node dropped at `p` goes: its parent, or a host to attach to. */
  dropTarget(
    stencil: Stencil,
    p: Point,
    exclude: Set<string> = new Set(),
  ): { parent: DiagramNode | null; host: DiagramNode | null } | null {
    let under = this.nodeAt(p, exclude);
    if (this.stencils.isBoundaryEvent(stencil)) {
      for (let n = under; n; n = n.parent ? this.state().nodes[n.parent] : null) {
        const s = this.stencilOf(n);
        if (s && this.stencils.canAttach(s, stencil)) {
          return { parent: n.parent ? this.state().nodes[n.parent] : null, host: n };
        }
      }
    }
    // Walk up until a container accepts the shape (Oryx checks the shape under the pointer).
    while (under) {
      if (this.canPlace(stencil, under)) return { parent: under, host: null };
      under = under.parent ? this.state().nodes[under.parent] : null;
    }
    return this.canPlace(stencil, null) ? { parent: null, host: null } : null;
  }

  // Edits (each is one undo step)

  addNode(stencilId: string, at: Point, parentId: string | null, hostId: string | null = null) {
    const id = newResourceId();
    this.update((draft) => {
      createNode(this, draft, id, stencilId, at, parentId);
      if (hostId) attach(draft, draft.nodes[id], draft.nodes[hostId], at);
      if (stencilId === 'Pool') addLane(this, draft, id);
      if (stencilId === 'Lane' && parentId && draft.nodes[parentId]?.stencil === 'Pool') {
        layoutPool(draft, parentId);
      }
    });
    this.selection.set([id]);
    return id;
  }

  /** Quick menu: adds a shape east of `sourceId` and connects the two. */
  appendNode(sourceId: string, stencilId: string, at?: Point): string | null {
    const state = this.committed();
    const source = state.nodes[sourceId];
    const sourceStencil = source && this.stencilOf(source);
    const targetStencil = this.stencils.stencil(stencilId);
    if (!source || !sourceStencil || !targetStencil) return null;
    const edge = this.stencils.connectingEdge(sourceStencil, targetStencil);
    if (!edge) return null;
    const size = this.nodeView(stencilId).clampSize(
      this.nodeView(stencilId).width,
      this.nodeView(stencilId).height,
    );
    const c = center(source.bounds);
    const point = at ?? { x: c.x + source.bounds.w / 2 + QUICK_ADD_GAP + size.w / 2, y: c.y };
    const parent = source.host ? state.nodes[source.host.id]?.parent : source.parent;
    const id = newResourceId();
    this.update((draft) => {
      createNode(this, draft, id, stencilId, point, parent ?? null);
      connectNodes(this, draft, edge.id, sourceId, id);
    });
    this.selection.set([id]);
    return id;
  }

  connect(sourceId: string, targetId: string, targetRef?: Point): string | null {
    const state = this.committed();
    const s = state.nodes[sourceId] && this.stencilOf(state.nodes[sourceId]);
    const t = state.nodes[targetId] && this.stencilOf(state.nodes[targetId]);
    if (!s || !t) return null;
    const edge = this.stencils.connectingEdge(s, t);
    if (!edge) return null;
    let id: string | null = null;
    this.update((draft) => {
      id = connectNodes(this, draft, edge.id, sourceId, targetId, targetRef);
    });
    if (id) this.selection.set([id]);
    return id;
  }

  setProperty(elementId: string | null, key: string, value: unknown) {
    this.update((draft) => {
      const target = elementId
        ? (draft.nodes[elementId]?.properties ?? draft.edges[elementId]?.properties)
        : draft.properties;
      if (!target) return;
      target[key] = value;
      // Only one default flow per source (the original clears the others).
      const edge = elementId ? draft.edges[elementId] : null;
      if (edge && key === 'defaultflow' && (value === true || value === 'true') && edge.source) {
        for (const other of Object.values(draft.edges)) {
          if (other.id !== edge.id && other.source?.id === edge.source.id) {
            other.properties['defaultflow'] = false;
          }
        }
      }
    });
  }

  deleteSelection() {
    const ids = this.selection();
    if (!ids.length) return;
    this.update((draft) => deleteElements(draft, new Set(ids)));
    this.selection.set([]);
  }

  moveSelection(dx: number, dy: number) {
    const ids = this.selection();
    if (!ids.length) return;
    this.update((draft) => moveElements(this, draft, ids, dx, dy));
  }

  selectAll() {
    const s = this.committed();
    this.selection.set([...Object.keys(s.nodes), ...s.edgeOrder]);
  }

  copy(cut = false) {
    const state = this.committed();
    const ids = new Set(this.selection());
    const nodes = new Set<string>();
    const add = (id: string) => {
      const n = state.nodes[id];
      if (!n || nodes.has(id)) return;
      nodes.add(id);
      n.children.forEach(add);
      Object.values(state.nodes)
        .filter((b) => b.host?.id === id)
        .forEach((b) => add(b.id));
    };
    ids.forEach(add);
    if (!nodes.size) return;
    const edges = state.edgeOrder
      .map((id) => state.edges[id])
      .filter(
        (e) =>
          (!e.source || nodes.has(e.source.id)) &&
          (!e.target || nodes.has(e.target.id)) &&
          (e.source || e.target),
      );
    this.clipboard = structuredClone({
      nodes: [...nodes].map((id) => state.nodes[id]),
      edges,
    });
    this.canPaste.set(true);
    if (cut) this.deleteSelection();
  }

  paste() {
    const clip = this.clipboard;
    if (!clip) return;
    const ids = new Map<string, string>();
    clip.nodes.forEach((n) => ids.set(n.id, newResourceId()));
    clip.edges.forEach((e) => ids.set(e.id, newResourceId()));
    const pasted: string[] = [];
    this.update((draft) => {
      const inClip = new Set(clip.nodes.map((n) => n.id));
      for (const n of clip.nodes) {
        const copy = structuredClone(n);
        copy.id = ids.get(n.id)!;
        copy.bounds = { ...copy.bounds, x: copy.bounds.x + PASTE_OFFSET, y: copy.bounds.y + PASTE_OFFSET };
        copy.children = n.children.filter((c) => ids.has(c)).map((c) => ids.get(c)!);
        // Top-level copies go on the canvas, like Oryx.
        copy.parent = n.parent && inClip.has(n.parent) ? ids.get(n.parent)! : null;
        if (copy.host) copy.host = inClip.has(copy.host.id) ? { ...copy.host, id: ids.get(copy.host.id)! } : null;
        if (!copy.host && n.host) {
          // A boundary event copied without its activity cannot stand alone.
          continue;
        }
        if (typeof copy.properties['overrideid'] === 'string') copy.properties['overrideid'] = '';
        draft.nodes[copy.id] = copy;
        if (!copy.parent) draft.roots.push(copy.id);
        pasted.push(copy.id);
      }
      for (const e of clip.edges) {
        const copy = structuredClone(e);
        copy.id = ids.get(e.id)!;
        if (copy.source) copy.source = { ...copy.source, id: ids.get(copy.source.id)! };
        if (copy.target) copy.target = { ...copy.target, id: ids.get(copy.target.id)! };
        if ((copy.source && !draft.nodes[copy.source.id]) || (copy.target && !draft.nodes[copy.target.id])) {
          continue;
        }
        copy.bends = copy.bends.map((b) => ({ x: b.x + PASTE_OFFSET, y: b.y + PASTE_OFFSET }));
        copy.start = { x: copy.start.x + PASTE_OFFSET, y: copy.start.y + PASTE_OFFSET };
        copy.end = { x: copy.end.x + PASTE_OFFSET, y: copy.end.y + PASTE_OFFSET };
        if (typeof copy.properties['overrideid'] === 'string') copy.properties['overrideid'] = '';
        draft.edges[copy.id] = copy;
        draft.edgeOrder.push(copy.id);
        pasted.push(copy.id);
      }
      // Shift the clipboard so the next paste lands further away.
      for (const n of clip.nodes) n.bounds = { ...n.bounds, x: n.bounds.x + PASTE_OFFSET, y: n.bounds.y + PASTE_OFFSET };
      for (const e of clip.edges) {
        e.bends = e.bends.map((b) => ({ x: b.x + PASTE_OFFSET, y: b.y + PASTE_OFFSET }));
      }
    });
    this.selection.set(pasted);
  }

  /** Align the selected nodes' centres (vertical: same x, horizontal: same y) or sizes. */
  align(mode: 'vertical' | 'horizontal' | 'size') {
    const state = this.committed();
    const nodes = this.selection()
      .map((id) => state.nodes[id])
      .filter((n): n is DiagramNode => !!n && !n.host);
    if (nodes.length < 2) return;
    this.update((draft) => {
      const drafts = nodes.map((n) => draft.nodes[n.id]);
      if (mode === 'size') {
        const w = Math.max(...drafts.map((n) => n.bounds.w));
        const h = Math.max(...drafts.map((n) => n.bounds.h));
        for (const n of drafts) {
          const size = this.nodeView(n.stencil).clampSize(w, h);
          const c = center(n.bounds);
          resizeNode(this, draft, n.id, { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h });
        }
        return;
      }
      const centres = drafts.map((n) => center(n.bounds));
      const target =
        mode === 'vertical'
          ? (Math.min(...centres.map((c) => c.x)) + Math.max(...centres.map((c) => c.x))) / 2
          : (Math.min(...centres.map((c) => c.y)) + Math.max(...centres.map((c) => c.y))) / 2;
      drafts.forEach((n, i) => {
        const dx = mode === 'vertical' ? target - centres[i].x : 0;
        const dy = mode === 'horizontal' ? target - centres[i].y : 0;
        moveElements(this, draft, [n.id], dx, dy);
      });
    });
  }

  /** Change a shape into another stencil of the same family, keeping its id and values. */
  morph(id: string, stencilId: string) {
    const target = this.stencils.stencil(stencilId);
    const node = this.committed().nodes[id];
    if (!target || !node) return;
    const rule = this.stencils.morphRule(target);
    this.update((draft) => {
      const n = draft.nodes[id];
      const view = this.nodeView(stencilId);
      const old = { ...n.bounds };
      const size = rule?.preserveBounds
        ? view.clampSize(old.w, old.h)
        : view.clampSize(view.width, view.height);
      const c = center(old);
      n.stencil = stencilId;
      n.properties = withDefaults(target, n.properties);
      n.bounds = rule?.preserveBounds
        ? { x: old.x, y: old.y, w: size.w, h: size.h }
        : { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h };
      scaleDocks(draft, id, old, n.bounds);
    });
  }

  resize(id: string, box: Box) {
    this.update((draft) => resizeNode(this, draft, id, box));
  }
}

function emptyState(): DiagramState {
  return { properties: {}, nodes: {}, edges: {}, roots: [], edgeOrder: [] };
}

export const abs = (node: DiagramNode, ref: Point): Point => ({
  x: node.bounds.x + ref.x,
  y: node.bounds.y + ref.y,
});

// Draft operations, shared by the document methods and the canvas (for drag previews).

export function createNode(
  doc: DiagramDocument,
  draft: DiagramState,
  id: string,
  stencilId: string,
  at: Point,
  parentId: string | null,
): DiagramNode {
  const stencil = doc.stencils.stencil(stencilId);
  const view = doc.nodeView(stencilId);
  const size = view.clampSize(view.width, view.height);
  const node: DiagramNode = {
    kind: 'node',
    id,
    stencil: stencilId,
    properties: stencil ? doc.stencils.defaultProperties(stencil) : {},
    bounds: { x: Math.max(0, at.x - size.w / 2), y: Math.max(0, at.y - size.h / 2), w: size.w, h: size.h },
    parent: parentId,
    children: [],
    host: null,
    extra: {},
  };
  draft.nodes[id] = node;
  if (parentId && draft.nodes[parentId]) draft.nodes[parentId].children.push(id);
  else {
    node.parent = null;
    draft.roots.push(id);
  }
  return node;
}

/** Docks a boundary event on the host's border, at the point nearest to `p`. */
export function attach(draft: DiagramState, event: DiagramNode, host: DiagramNode, p: Point) {
  const b = host.bounds;
  let x = Math.min(Math.max(p.x, b.x), b.x + b.w);
  let y = Math.min(Math.max(p.y, b.y), b.y + b.h);
  const distances = [x - b.x, b.x + b.w - x, y - b.y, b.y + b.h - y];
  const nearest = distances.indexOf(Math.min(...distances));
  if (nearest === 0) x = b.x;
  else if (nearest === 1) x = b.x + b.w;
  else if (nearest === 2) y = b.y;
  else y = b.y + b.h;
  event.host = { id: host.id, ref: { x: x - b.x, y: y - b.y } };
  placeOnHost(draft, event);
  // A boundary event lives next to its activity, not inside it.
  setParent(draft, event.id, host.parent);
}

/** Is `p` within the attach band along the host's border? */
export function nearBorder(host: DiagramNode, p: Point): boolean {
  const b = host.bounds;
  const inner = { x: b.x + ATTACH_DISTANCE, y: b.y + ATTACH_DISTANCE, w: b.w - 2 * ATTACH_DISTANCE, h: b.h - 2 * ATTACH_DISTANCE };
  return inBox(p, b, ATTACH_DISTANCE) && !(inner.w > 0 && inner.h > 0 && inBox(p, inner));
}

export function setParent(draft: DiagramState, id: string, parentId: string | null) {
  const node = draft.nodes[id];
  if (!node || node.parent === parentId) return;
  if (node.parent) {
    const old = draft.nodes[node.parent];
    if (old) old.children = old.children.filter((c) => c !== id);
  } else {
    draft.roots = draft.roots.filter((r) => r !== id);
  }
  node.parent = parentId && draft.nodes[parentId] ? parentId : null;
  if (node.parent) draft.nodes[node.parent].children.push(id);
  else draft.roots.push(id);
}

export function connectNodes(
  doc: DiagramDocument,
  draft: DiagramState,
  edgeStencil: string,
  sourceId: string,
  targetId: string,
  targetRef?: Point,
): string {
  const source = draft.nodes[sourceId];
  const target = draft.nodes[targetId];
  const id = newResourceId();
  const stencil = doc.stencils.stencil(edgeStencil);
  const sourceRef = doc.nodeView(source.stencil).defaultMagnet(source.bounds.w, source.bounds.h);
  const tRef =
    targetRef ??
    (target.stencil === 'TextAnnotation'
      ? { x: 0, y: target.bounds.h / 2 }
      : doc.nodeView(target.stencil).defaultMagnet(target.bounds.w, target.bounds.h));
  draft.edges[id] = {
    kind: 'edge',
    id,
    stencil: edgeStencil,
    properties: stencil ? doc.stencils.defaultProperties(stencil) : {},
    source: { id: sourceId, ref: sourceRef },
    target: { id: targetId, ref: tRef },
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
    bends: [],
    extra: {},
  };
  draft.edgeOrder.push(id);
  return id;
}

/** Moves nodes (with their children and boundary events) and edges' bend points. */
export function moveElements(
  doc: DiagramDocument,
  draft: DiagramState,
  ids: string[],
  dx: number,
  dy: number,
) {
  const moved = new Set<string>();
  const addNode = (id: string) => {
    const n = draft.nodes[id];
    if (!n || moved.has(id)) return;
    moved.add(id);
    n.children.forEach(addNode);
    for (const b of Object.values(draft.nodes)) if (b.host?.id === id) addNode(b.id);
  };
  const edgeIds = new Set<string>();
  for (const id of ids) {
    if (draft.nodes[id]) addNode(id);
    else if (draft.edges[id]) edgeIds.add(id);
  }
  // A boundary event moved on its own slides along its host (handled by the canvas); here it
  // moves with the selection only when its host moves too.
  for (const id of moved) {
    const n = draft.nodes[id];
    n.bounds = { ...n.bounds, x: n.bounds.x + dx, y: n.bounds.y + dy };
  }
  for (const edge of Object.values(draft.edges)) {
    const sourceMoved = !edge.source || moved.has(edge.source.id);
    const targetMoved = !edge.target || moved.has(edge.target.id);
    const inside = (edge.source || edge.target) && sourceMoved && targetMoved;
    if (edgeIds.has(edge.id) || inside) {
      edge.bends = edge.bends.map((b) => ({ x: b.x + dx, y: b.y + dy }));
      if (!edge.source) edge.start = { x: edge.start.x + dx, y: edge.start.y + dy };
      if (!edge.target) edge.end = { x: edge.end.x + dx, y: edge.end.y + dy };
    }
  }
  const pools = new Set<string>();
  for (const id of moved) {
    const n = draft.nodes[id];
    if (n.stencil === 'Lane' && n.parent && !moved.has(n.parent)) pools.add(n.parent);
  }
  pools.forEach((p) => layoutPool(draft, p));
  void doc;
}

/** Scales the dock points of edges and boundary events on a node that changed size. */
export function scaleDocks(draft: DiagramState, id: string, from: Box, to: Box) {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  for (const edge of Object.values(draft.edges)) {
    if (edge.source?.id === id) edge.source.ref = { x: edge.source.ref.x * sx, y: edge.source.ref.y * sy };
    if (edge.target?.id === id) edge.target.ref = { x: edge.target.ref.x * sx, y: edge.target.ref.y * sy };
  }
  for (const n of Object.values(draft.nodes)) {
    if (n.host?.id === id) {
      n.host.ref = { x: n.host.ref.x * sx, y: n.host.ref.y * sy };
      placeOnHost(draft, n);
    }
  }
}

export function resizeNode(doc: DiagramDocument, draft: DiagramState, id: string, box: Box) {
  const n = draft.nodes[id];
  if (!n) return;
  const size = doc.nodeView(n.stencil).clampSize(box.w, box.h);
  const old = { ...n.bounds };
  n.bounds = { x: box.x, y: box.y, w: size.w, h: size.h };
  scaleDocks(draft, id, old, n.bounds);
  if (n.stencil === 'Pool') layoutPool(draft, id, old);
  if (n.stencil === 'Lane' && n.parent && draft.nodes[n.parent]?.stencil === 'Pool') {
    layoutPool(draft, n.parent);
  }
}

/** Deletes elements with their children, boundary events and connected edges. */
export function deleteElements(draft: DiagramState, ids: Set<string>) {
  const nodes = new Set<string>();
  const add = (id: string) => {
    const n = draft.nodes[id];
    if (!n || nodes.has(id)) return;
    nodes.add(id);
    n.children.forEach(add);
    for (const b of Object.values(draft.nodes)) if (b.host?.id === id) add(b.id);
  };
  ids.forEach(add);
  const pools = new Set<string>();
  for (const id of nodes) {
    const n = draft.nodes[id];
    if (n.stencil === 'Lane' && n.parent && !nodes.has(n.parent)) pools.add(n.parent);
    if (n.parent && draft.nodes[n.parent]) {
      const p = draft.nodes[n.parent];
      p.children = p.children.filter((c) => c !== id);
    }
    delete draft.nodes[id];
  }
  draft.roots = draft.roots.filter((r) => !nodes.has(r));
  for (const edge of Object.values(draft.edges)) {
    if (
      ids.has(edge.id) ||
      (edge.source && nodes.has(edge.source.id)) ||
      (edge.target && nodes.has(edge.target.id))
    ) {
      delete draft.edges[edge.id];
    }
  }
  draft.edgeOrder = draft.edgeOrder.filter((e) => draft.edges[e]);
  // Sequence flow order lists may point at deleted flows.
  pools.forEach((p) => layoutPool(draft, p));
}

const POOL_CAPTION = 30;

function addLane(doc: DiagramDocument, draft: DiagramState, poolId: string) {
  const pool = draft.nodes[poolId];
  const id = newResourceId();
  createNode(doc, draft, id, 'Lane', center(pool.bounds), poolId);
  const lane = draft.nodes[id];
  lane.bounds = { x: pool.bounds.x + POOL_CAPTION, y: pool.bounds.y, w: pool.bounds.w - POOL_CAPTION, h: pool.bounds.h };
}

/** Stacks a pool's lanes to the right of its caption; the pool takes their total height. */
export function layoutPool(draft: DiagramState, poolId: string, previous?: Box) {
  const pool = draft.nodes[poolId];
  if (!pool) return;
  const lanes = pool.children.map((c) => draft.nodes[c]).filter((n) => n?.stencil === 'Lane');
  if (!lanes.length) return;
  lanes.sort((a, b) => a.bounds.y - b.bounds.y);
  const total = lanes.reduce((sum, l) => sum + l.bounds.h, 0);
  // When the pool itself was resized, share the new height out proportionally.
  const scale = previous && previous.h !== pool.bounds.h && total ? pool.bounds.h / total : 1;
  let y = pool.bounds.y;
  for (const lane of lanes) {
    const h = Math.max(30, lane.bounds.h * scale);
    const dx = pool.bounds.x + POOL_CAPTION - lane.bounds.x;
    const dy = y - lane.bounds.y;
    const old = { ...lane.bounds };
    lane.bounds = { x: pool.bounds.x + POOL_CAPTION, y, w: pool.bounds.w - POOL_CAPTION, h };
    if (dx || dy) shiftDescendants(draft, lane.id, dx, dy);
    if (old.w !== lane.bounds.w || old.h !== lane.bounds.h) scaleDocks(draft, lane.id, old, lane.bounds);
    y += h;
  }
  pool.bounds = { ...pool.bounds, h: y - pool.bounds.y };
}

function shiftDescendants(draft: DiagramState, id: string, dx: number, dy: number) {
  for (const c of draft.nodes[id]?.children ?? []) {
    const n = draft.nodes[c];
    n.bounds = { ...n.bounds, x: n.bounds.x + dx, y: n.bounds.y + dy };
    shiftDescendants(draft, c, dx, dy);
  }
}
