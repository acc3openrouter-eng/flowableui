import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import {
  DiagramDocument,
  attach,
  moveElements,
  nearBorder,
  resizeNode,
  setParent,
} from './diagram-document';
import { DiagramEdge, DiagramNode, canvasSize } from './diagram-model';
import { DiagramRenderer } from './diagram-renderer';
import { Box, Point, boxInside, center, distance, distanceToSegment } from './geometry';
import { Stencil } from './stencil-set';
import { StencilIcon } from './stencil-icon';
import { DIAGRAM_FONT } from './stencil-view';

/** The stencil being dragged from the palette or the quick menu (HTML drag and drop). */
export const paletteDrag = signal<{ stencil: string; from?: string } | null>(null);

type Handle = 'nw' | 'ne' | 'sw' | 'se';

type Drag =
  | { kind: 'move'; start: Point; ids: string[]; moved: boolean; anchor: DiagramNode | null }
  | { kind: 'resize'; start: Point; id: string; handle: Handle; box: Box }
  | { kind: 'marquee'; start: Point; additive: boolean }
  | { kind: 'end'; id: string; which: 'source' | 'target' }
  | { kind: 'bend'; id: string; index: number }
  | { kind: 'connect'; from: string }
  | { kind: 'pan'; start: Point; scroll: Point };

const MAGNET_SNAP = 8;
const GUIDE_SNAP = 6;
const MIN_DRAG = 3;

@Component({
  selector: 'fm-diagram-canvas',
  imports: [TranslatePipe, TooltipModule, StencilIcon],
  templateUrl: './diagram-canvas.html',
  styleUrl: './diagram-canvas.scss',
  host: {
    '(keydown)': 'onKey($event)',
  },
})
export class DiagramCanvas {
  readonly doc = input.required<DiagramDocument>();
  readonly zoom = input(1);
  readonly zoomChange = output<number>();
  /** Asks the host to open the "change type" menu for a shape. */
  readonly morphRequested = output<{ id: string; anchor: HTMLElement }>();

  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly content = viewChild.required<ElementRef<SVGGElement>>('content');
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  protected readonly font = DIAGRAM_FONT;
  protected readonly quickStencils = computed(() => this.doc().stencils.profile.quickMenu);
  private renderer: DiagramRenderer | null = null;
  protected readonly routes = signal(new Map<string, Point[]>());

  protected readonly size = computed(() => canvasSize(this.doc().state()));

  private drag: Drag | null = null;
  protected readonly marquee = signal<Box | null>(null);
  protected readonly guides = signal<{ x: number | null; y: number | null }>({ x: null, y: null });
  protected readonly connectLine = signal<{ from: Point; to: Point } | null>(null);
  /** Shape highlighted as a drop or connection target; `ok` is false for a forbidden one. */
  protected readonly highlight = signal<{ box: Box; ok: boolean } | null>(null);
  protected readonly editing = signal<{ id: string; box: Box; value: string; key: string } | null>(
    null,
  );
  protected readonly dragging = signal(false);

  protected readonly selectedNodes = computed(() => {
    const s = this.doc().state();
    return this.doc()
      .selection()
      .map((id) => s.nodes[id])
      .filter((n): n is DiagramNode => !!n);
  });

  protected readonly selectedEdge = computed(() => {
    const ids = this.doc().selection();
    if (ids.length !== 1) return null;
    const edge = this.doc().state().edges[ids[0]];
    if (!edge) return null;
    return { edge, points: this.routes().get(edge.id) ?? this.doc().route(edge) };
  });

  /** The one selected node, when the quick menu and resize handles apply. */
  protected readonly single = computed(() => {
    const nodes = this.selectedNodes();
    if (nodes.length !== 1 || this.doc().selection().length !== 1 || this.dragging()) return null;
    const node = nodes[0];
    const stencil = this.doc().stencilOf(node);
    if (!stencil) return null;
    const view = this.doc().nodeView(node.stencil);
    return {
      node,
      stencil,
      resizable: view.resizableH || view.resizableV,
      quick: this.doc().stencils.profile.hasQuickMenu(stencil),
      morph: this.doc().stencils.morphOptions(stencil).length > 0,
    };
  });

  constructor() {
    afterRenderEffect(() => {
      const state = this.doc().state();
      untracked(() => {
        if (!this.renderer)
          this.renderer = new DiagramRenderer(this.doc(), this.content().nativeElement);
        this.routes.set(this.renderer.render(state));
      });
    });
    inject(DestroyRef).onDestroy(() => paletteDrag.set(null));
  }

  // Coordinates

  private toModel(event: { clientX: number; clientY: number }): Point {
    const rect = this.svg().nativeElement.getBoundingClientRect();
    const z = this.zoom();
    return { x: (event.clientX - rect.left) / z, y: (event.clientY - rect.top) / z };
  }

  private elementAt(target: EventTarget | null): string | null {
    const el = (target as Element | null)?.closest?.('[data-id]');
    return el?.getAttribute('data-id') ?? null;
  }

  // Pointer interaction

  protected onPointerDown(event: PointerEvent) {
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      const el = this.scroller().nativeElement;
      this.drag = {
        kind: 'pan',
        start: { x: event.clientX, y: event.clientY },
        scroll: { x: el.scrollLeft, y: el.scrollTop },
      };
      this.capture(event);
      return;
    }
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest?.('.inline-edit')) return;
    if (target.closest?.('.quick, .shape-actions') && !target.closest?.('[data-handle]')) return;
    this.scroller().nativeElement.focus({ preventScroll: true });
    this.commitEdit();
    const handle = target.closest?.('[data-handle]')?.getAttribute('data-handle');
    const p = this.toModel(event);
    const doc = this.doc();

    if (handle) {
      event.preventDefault();
      const [kind, arg] = handle.split(':');
      const single = this.single();
      const edge = this.selectedEdge();
      if (kind === 'resize' && single) {
        this.drag = {
          kind: 'resize',
          start: p,
          id: single.node.id,
          handle: arg as Handle,
          box: single.node.bounds,
        };
      } else if (kind === 'end' && edge) {
        this.drag = { kind: 'end', id: edge.edge.id, which: arg as 'source' | 'target' };
      } else if (kind === 'bend' && edge) {
        this.drag = { kind: 'bend', id: edge.edge.id, index: Number(arg) };
      } else if (kind === 'mid' && edge) {
        // Dragging a segment's midpoint inserts a bend point there.
        const index = Number(arg);
        doc.update((draft) => {
          draft.edges[edge.edge.id].bends.splice(index, 0, p);
        });
        this.drag = { kind: 'bend', id: edge.edge.id, index };
      } else if (kind === 'connect' && single) {
        this.drag = { kind: 'connect', from: single.node.id };
        this.connectLine.set({ from: center(single.node.bounds), to: p });
      }
      this.capture(event);
      return;
    }

    const id = this.elementAt(target);
    if (id) {
      const selected = doc.selection();
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        doc.selection.set(
          selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
        );
      } else if (!selected.includes(id)) {
        doc.selection.set([id]);
      }
      const node = doc.state().nodes[id];
      this.drag = {
        kind: 'move',
        start: p,
        ids: doc.selection(),
        moved: false,
        anchor: doc.selection().length === 1 ? (node ?? null) : null,
      };
    } else {
      if (!event.shiftKey) doc.selection.set([]);
      this.drag = { kind: 'marquee', start: p, additive: event.shiftKey };
    }
    this.capture(event);
  }

  private capture(event: PointerEvent) {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent) {
    const drag = this.drag;
    if (!drag) return;
    const doc = this.doc();
    const p = this.toModel(event);
    switch (drag.kind) {
      case 'pan': {
        const el = this.scroller().nativeElement;
        el.scrollLeft = drag.scroll.x - (event.clientX - drag.start.x);
        el.scrollTop = drag.scroll.y - (event.clientY - drag.start.y);
        break;
      }
      case 'move': {
        let dx = p.x - drag.start.x;
        let dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) * this.zoom() < MIN_DRAG) return;
        drag.moved = true;
        this.dragging.set(true);
        const guide = { x: null as number | null, y: null as number | null };
        if (drag.anchor && !event.shiftKey) {
          const c = center(drag.anchor.bounds);
          const moving = new Set(drag.ids);
          for (const other of Object.values(doc.state().nodes)) {
            if (moving.has(other.id) || other.id === drag.anchor.parent) continue;
            const oc = center(other.bounds);
            if (guide.x == null && Math.abs(c.x + dx - oc.x) < GUIDE_SNAP / this.zoom()) {
              dx = oc.x - c.x;
              guide.x = oc.x;
            }
            if (guide.y == null && Math.abs(c.y + dy - oc.y) < GUIDE_SNAP / this.zoom()) {
              dy = oc.y - c.y;
              guide.y = oc.y;
            }
          }
        }
        this.guides.set(guide);
        const single = drag.anchor ? doc.stencilOf(drag.anchor) : null;
        if (single && doc.stencils.isBoundaryEvent(single)) {
          // A boundary event follows the pointer and snaps onto an activity's border.
          const host = this.attachHost(single, p, drag.anchor!.id);
          doc.showPreview((draft) => {
            const n = draft.nodes[drag.anchor!.id];
            if (host) attach(draft, n, draft.nodes[host.id], p);
            else {
              n.host = null;
              n.bounds = { ...n.bounds, x: p.x - n.bounds.w / 2, y: p.y - n.bounds.h / 2 };
            }
          });
          this.highlight.set(host ? { box: host.bounds, ok: true } : null);
        } else {
          doc.showPreview((draft) => moveElements(doc, draft, drag.ids, dx, dy));
          const target =
            drag.anchor && single ? doc.dropTarget(single, p, new Set(drag.ids)) : undefined;
          this.highlight.set(
            target === undefined
              ? null
              : target?.parent
                ? { box: target.parent.bounds, ok: true }
                : target === null
                  ? {
                      box: {
                        ...drag.anchor!.bounds,
                        x: drag.anchor!.bounds.x + dx,
                        y: drag.anchor!.bounds.y + dy,
                      },
                      ok: false,
                    }
                  : null,
          );
        }
        break;
      }
      case 'resize': {
        const b = drag.box;
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        let { x, y, w, h } = b;
        if (drag.handle.includes('w')) {
          x = b.x + dx;
          w = b.w - dx;
        } else w = b.w + dx;
        if (drag.handle.includes('n')) {
          y = b.y + dy;
          h = b.h - dy;
        } else h = b.h + dy;
        const size = doc.nodeView(doc.state().nodes[drag.id]?.stencil ?? '').clampSize(w, h);
        if (drag.handle.includes('w')) x = b.x + b.w - size.w;
        if (drag.handle.includes('n')) y = b.y + b.h - size.h;
        this.dragging.set(true);
        doc.showPreview((draft) => resizeNode(doc, draft, drag.id, { x, y, w: size.w, h: size.h }));
        break;
      }
      case 'marquee': {
        const x = Math.min(p.x, drag.start.x);
        const y = Math.min(p.y, drag.start.y);
        this.marquee.set({
          x,
          y,
          w: Math.abs(p.x - drag.start.x),
          h: Math.abs(p.y - drag.start.y),
        });
        break;
      }
      case 'end': {
        this.dragging.set(true);
        const target = this.connectTarget(drag.id, drag.which, p);
        doc.showPreview((draft) => {
          const edge = draft.edges[drag.id];
          if (drag.which === 'source') {
            edge.source = null;
            edge.start = p;
          } else {
            edge.target = null;
            edge.end = p;
          }
        });
        this.highlight.set(target ? { box: target.node.bounds, ok: target.ok } : null);
        break;
      }
      case 'bend': {
        this.dragging.set(true);
        doc.showPreview((draft) => {
          draft.edges[drag.id].bends[drag.index] = p;
        });
        break;
      }
      case 'connect': {
        this.connectLine.update((l) => (l ? { ...l, to: p } : l));
        const node = doc.nodeAt(p, new Set([drag.from]));
        const source = doc.state().nodes[drag.from];
        if (node && source) {
          const ok = !!doc.stencils.connectingEdge(doc.stencilOf(source)!, doc.stencilOf(node)!);
          this.highlight.set({ box: node.bounds, ok });
        } else this.highlight.set(null);
        break;
      }
    }
  }

  protected onPointerUp(event: PointerEvent) {
    const drag = this.drag;
    this.drag = null;
    this.dragging.set(false);
    this.guides.set({ x: null, y: null });
    this.highlight.set(null);
    if (!drag) return;
    const doc = this.doc();
    const p = this.toModel(event);
    switch (drag.kind) {
      case 'move': {
        if (!drag.moved) {
          doc.showPreview(null);
          return;
        }
        const preview = doc.state();
        doc.showPreview(null);
        const single = drag.anchor ? doc.stencilOf(drag.anchor) : null;
        if (single && doc.stencils.isBoundaryEvent(single)) {
          const host = this.attachHost(single, p, drag.anchor!.id);
          if (host)
            doc.update((draft) =>
              attach(draft, draft.nodes[drag.anchor!.id], draft.nodes[host.id], p),
            );
          return;
        }
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        // Use the snapped offset the preview showed.
        const anchor = drag.anchor ? preview.nodes[drag.anchor.id] : null;
        const sdx = anchor && drag.anchor ? anchor.bounds.x - drag.anchor.bounds.x : dx;
        const sdy = anchor && drag.anchor ? anchor.bounds.y - drag.anchor.bounds.y : dy;
        let newParent: string | null | undefined;
        if (drag.anchor && single) {
          const target = doc.dropTarget(single, p, new Set(drag.ids));
          if (target === null) return; // not allowed here: snap back
          newParent = target.parent?.id ?? null;
        }
        doc.update((draft) => {
          moveElements(doc, draft, drag.ids, sdx, sdy);
          if (
            newParent !== undefined &&
            drag.anchor &&
            draft.nodes[drag.anchor.id].parent !== newParent
          ) {
            setParent(draft, drag.anchor.id, newParent);
          }
        });
        return;
      }
      case 'resize': {
        const preview = doc.state();
        doc.showPreview(null);
        const node = preview.nodes[drag.id];
        if (node) doc.resize(drag.id, node.bounds);
        return;
      }
      case 'marquee': {
        const box = this.marquee();
        this.marquee.set(null);
        if (!box || box.w < 2 || box.h < 2) return;
        const state = doc.state();
        const ids = Object.values(state.nodes)
          .filter((n) => boxInside(n.bounds, box))
          .map((n) => n.id);
        for (const id of state.edgeOrder) {
          const points = this.routes().get(id) ?? [];
          if (points.length && points.every((q) => boxInside({ ...q, w: 0, h: 0 }, box)))
            ids.push(id);
        }
        doc.selection.set(drag.additive ? [...new Set([...doc.selection(), ...ids])] : ids);
        return;
      }
      case 'end': {
        doc.showPreview(null);
        const target = this.connectTarget(drag.id, drag.which, p);
        if (!target?.ok) return;
        const ref = this.snapRef(target.node, p);
        doc.update((draft) => {
          const edge = draft.edges[drag.id];
          edge[drag.which] = { id: target.node.id, ref };
        });
        return;
      }
      case 'bend': {
        const preview = doc.state();
        doc.showPreview(null);
        const bend = preview.edges[drag.id]?.bends[drag.index];
        if (!bend) return;
        doc.update((draft) => {
          const edge = draft.edges[drag.id];
          edge.bends[drag.index] = bend;
          removeStraightBends(edge, this.doc().route(edge, draft));
        });
        return;
      }
      case 'connect': {
        this.connectLine.set(null);
        const node = doc.nodeAt(p, new Set([drag.from]));
        if (node) doc.connect(drag.from, node.id, this.snapRef(node, p, true));
        return;
      }
      case 'pan':
        return;
    }
  }

  /** Where a dragged flow end would dock, and whether the rules allow it. */
  private connectTarget(edgeId: string, which: 'source' | 'target', p: Point) {
    const doc = this.doc();
    const state = doc.state();
    const edge = state.edges[edgeId];
    if (!edge) return null;
    const node = doc.nodeAt(p);
    if (!node) return null;
    const edgeStencil = doc.stencils.stencil(edge.stencil)!;
    const other = which === 'source' ? edge.target : edge.source;
    const otherStencil = other ? doc.stencilOf(state.nodes[other.id]) : undefined;
    const stencil = doc.stencilOf(node)!;
    const ok =
      which === 'source'
        ? doc.stencils.canConnect(edgeStencil, stencil, otherStencil)
        : doc.stencils.canConnect(edgeStencil, otherStencil, stencil);
    return { node, ok };
  }

  /** Dock point for a drop on `node`: a magnet within reach, else the centre or the drop point. */
  private snapRef(node: DiagramNode, p: Point, preferCenter = false): Point {
    const view = this.doc().nodeView(node.stencil);
    const local = { x: p.x - node.bounds.x, y: p.y - node.bounds.y };
    for (const m of view.magnets) {
      const placed = view.placeMagnet(m, node.bounds.w, node.bounds.h);
      if (distance(placed, local) <= MAGNET_SNAP / this.zoom()) return placed;
    }
    if (preferCenter) {
      return node.stencil === 'TextAnnotation'
        ? { x: 0, y: node.bounds.h / 2 }
        : view.defaultMagnet(node.bounds.w, node.bounds.h);
    }
    return local;
  }

  /** The activity a boundary event would attach to at `p`. */
  private attachHost(event: Stencil, p: Point, exclude: string): DiagramNode | null {
    const doc = this.doc();
    const nodes = doc.paintOrder();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.id === exclude) continue;
      const s = doc.stencilOf(n);
      if (s && doc.stencils.canAttach(s, event) && nearBorder(n, p)) return n;
    }
    return null;
  }

  // Double click: rename in place, or remove a bend point

  protected onDoubleClick(event: MouseEvent) {
    const handle = (event.target as Element)
      .closest?.('[data-handle]')
      ?.getAttribute('data-handle');
    const edge = this.selectedEdge();
    if (handle?.startsWith('bend:') && edge) {
      const index = Number(handle.split(':')[1]);
      this.doc().update((draft) => {
        draft.edges[edge.edge.id].bends.splice(index, 1);
      });
      return;
    }
    const id = this.elementAt(event.target);
    if (id) this.startEdit(id);
  }

  startEdit(id: string) {
    const doc = this.doc();
    const state = doc.state();
    const node = state.nodes[id];
    const edge = state.edges[id];
    const el = node ?? edge;
    if (!el) return;
    const key = doc.stencils.profile.labelKey(el.stencil);
    if (!(doc.stencilOf(el)?.properties ?? []).some((p) => p.key === key)) return;
    let box: Box;
    if (node) {
      const small = node.bounds.w < 80;
      box = small
        ? { x: center(node.bounds).x - 60, y: node.bounds.y + node.bounds.h + 4, w: 120, h: 44 }
        : node.bounds.h > 120
          ? {
              x: node.bounds.x + 4,
              y: node.bounds.y + 4,
              w: Math.min(node.bounds.w - 8, 220),
              h: 44,
            }
          : {
              x: node.bounds.x + 4,
              y: node.bounds.y + 4,
              w: node.bounds.w - 8,
              h: node.bounds.h - 8,
            };
    } else {
      const points = this.routes().get(id) ?? doc.route(edge!);
      const mid = points[Math.floor((points.length - 1) / 2)];
      box = { x: mid.x - 60, y: mid.y - 22, w: 120, h: 44 };
    }
    this.editing.set({ id, box, value: String(el.properties[key] ?? ''), key });
    queueMicrotask(() =>
      (
        this.scroller().nativeElement.querySelector('.inline-edit') as HTMLTextAreaElement | null
      )?.select(),
    );
  }

  protected commitEdit() {
    const edit = this.editing();
    if (!edit) return;
    this.editing.set(null);
    const el = this.doc().state().nodes[edit.id] ?? this.doc().state().edges[edit.id];
    if (el && String(el.properties[edit.key] ?? '') !== edit.value) {
      this.doc().setProperty(edit.id, edit.key, edit.value);
    }
    this.scroller().nativeElement.focus({ preventScroll: true });
  }

  protected onEditKey(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      this.editing.set(null);
      this.scroller().nativeElement.focus({ preventScroll: true });
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.commitEdit();
    }
  }

  protected setEditValue(value: string) {
    this.editing.update((e) => (e ? { ...e, value } : e));
  }

  // Keyboard

  protected onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    const doc = this.doc();
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let handled = true;
    if (mod && key === 'z' && !event.shiftKey) doc.undo();
    else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) doc.redo();
    else if (mod && key === 'c') doc.copy();
    else if (mod && key === 'x') doc.copy(true);
    else if (mod && key === 'v') doc.paste();
    else if (mod && key === 'a') doc.selectAll();
    else if (key === 'delete' || key === 'backspace') doc.deleteSelection();
    else if (key === 'f2' && doc.selection().length === 1) this.startEdit(doc.selection()[0]);
    else if (key.startsWith('arrow') && doc.selection().length) {
      const step = mod ? 5 : 20;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      doc.moveSelection(dx, dy);
    } else if (key === 'escape') doc.selection.set([]);
    else handled = false;
    if (handled) event.preventDefault();
  }

  protected onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomChange.emit(Math.min(2.5, Math.max(0.1, this.zoom() * factor)));
  }

  // Palette and quick menu drag and drop

  protected onDragOver(event: DragEvent) {
    const drag = paletteDrag();
    if (!drag) return;
    const stencil = this.doc().stencils.stencil(drag.stencil);
    if (!stencil) return;
    const p = this.toModel(event);
    const target = this.doc().dropTarget(stencil, p);
    if (target) {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
    }
    const box = target?.host?.bounds ?? target?.parent?.bounds;
    this.highlight.set(box ? { box, ok: true } : target ? null : this.forbiddenAt(p));
  }

  private forbiddenAt(p: Point): { box: Box; ok: boolean } | null {
    const node = this.doc().nodeAt(p);
    return node ? { box: node.bounds, ok: false } : null;
  }

  protected onDragLeave() {
    this.highlight.set(null);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.highlight.set(null);
    const drag = paletteDrag();
    paletteDrag.set(null);
    if (!drag) return;
    const doc = this.doc();
    const stencil = doc.stencils.stencil(drag.stencil);
    if (!stencil) return;
    const p = this.toModel(event);
    if (drag.from) {
      doc.appendNode(drag.from, drag.stencil, p);
    } else {
      const target = doc.dropTarget(stencil, p);
      if (!target) return;
      doc.addNode(drag.stencil, p, target.parent?.id ?? null, target.host?.id ?? null);
    }
    this.scroller().nativeElement.focus({ preventScroll: true });
  }

  protected quickDragStart(event: DragEvent, stencil: string, from: string) {
    paletteDrag.set({ stencil, from });
    event.dataTransfer?.setData('text/plain', stencil);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  protected quickAdd(stencil: string, from: string) {
    this.doc().appendNode(from, stencil);
  }

  protected dragEnd() {
    paletteDrag.set(null);
    this.highlight.set(null);
  }

  protected openMorph(event: MouseEvent, id: string) {
    this.morphRequested.emit({ id, anchor: event.currentTarget as HTMLElement });
  }

  protected stencilTitle(id: string): string {
    return this.doc().stencils.stencil(id)?.title ?? id;
  }

  /** Handles for a selected flow: both ends, the bend points and segment midpoints. */
  protected edgeHandles(points: Point[]) {
    const mids = points.slice(1).map((p, i) => ({
      x: (points[i].x + p.x) / 2,
      y: (points[i].y + p.y) / 2,
      index: i,
    }));
    return {
      start: points[0],
      end: points[points.length - 1],
      bends: points.slice(1, -1),
      mids: mids.filter((m, i) => distance(points[i], points[i + 1]) > 30 && m),
    };
  }

  protected polyline(points: Point[]): string {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

  /** Scrolls so that a shape is visible and selects it (used by validation results). */
  reveal(id: string) {
    const state = this.doc().state();
    const node = state.nodes[id];
    const edge = state.edges[id];
    const box = node?.bounds ?? (edge ? boxOfRoute(this.routes().get(id) ?? []) : null);
    this.doc().selection.set([id]);
    if (!box) return;
    const el = this.scroller().nativeElement;
    const z = this.zoom();
    el.scrollTo({
      left: Math.max(0, (box.x + box.w / 2) * z - el.clientWidth / 2),
      top: Math.max(0, (box.y + box.h / 2) * z - el.clientHeight / 2),
      behavior: 'smooth',
    });
  }

  /** Size of the visible area in model units, for zoom to fit. */
  viewport(): { w: number; h: number } {
    const el = this.scroller().nativeElement;
    return { w: el.clientWidth, h: el.clientHeight };
  }

  /** Model point in the middle of the visible area. */
  visibleCenter(): Point {
    const el = this.scroller().nativeElement;
    const z = this.zoom();
    const size = this.size();
    return {
      x: Math.min(size.w - 60, (el.scrollLeft + el.clientWidth / 2) / z),
      y: Math.min(size.h - 60, (el.scrollTop + el.clientHeight / 2) / z),
    };
  }

  scrollToPoint(p: Point) {
    const el = this.scroller().nativeElement;
    el.scrollTo({ left: p.x, top: p.y });
  }

  focus() {
    this.scroller().nativeElement.focus({ preventScroll: true });
  }
}

function boxOfRoute(points: Point[]): Box | null {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

/** Oryx `removeUnusedDockers`: drops bends lying on the straight line between their neighbours. */
function removeStraightBends(edge: DiagramEdge, points: Point[]) {
  const keep: Point[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = i === 1 ? points[0] : (keep[keep.length - 1] ?? points[0]);
    if (distanceToSegment(points[i], prev, points[i + 1]) > 1) keep.push(points[i]);
  }
  edge.bends = keep;
}
