import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import {
  DisplayElement,
  DisplayFlow,
  DisplayModel,
  DisplayPoint,
  ShapeKind,
  modelBounds,
  shapeKind,
  wrapText,
} from './display-model';

interface Shape {
  el: DisplayElement;
  kind: ShapeKind;
  lines: string[];
  icon: string | null;
}

interface Edge {
  flow: DisplayFlow;
  points: string;
  dashed: boolean;
  arrow: boolean;
  label: DisplayPoint | null;
}

/** Largest zoom used when fitting a diagram to the view. */
const MAX_FIT_SCALE = 1.25;

const TASK_ICONS: Record<string, string> = {
  UserTask: 'user',
  HumanTask: 'user',
  ManualTask: 'hand',
  ServiceTask: 'gear',
  ScriptTask: 'script',
  ScriptServiceTask: 'script',
  BusinessRuleTask: 'table',
  DecisionTask: 'table',
  SendTask: 'mail',
  ReceiveTask: 'mail',
  SendEventServiceTask: 'mail',
  HttpServiceTask: 'http',
  ExternalWorkerServiceTask: 'gear',
  CaseTask: 'case',
  ProcessTask: 'process',
};

const TASK_TYPE_ICONS: Record<string, string> = {
  mail: 'mail',
  http: 'http',
  dmn: 'table',
  shell: 'script',
  camel: 'gear',
  mule: 'gear',
  send_event: 'mail',
};

const EVENT_GLYPHS: Record<string, string> = {
  timer: '◷',
  message: '✉',
  signal: '△',
  error: 'ϟ',
  escalation: '⇑',
  conditional: '≡',
  compensation: '«',
  cancel: '✕',
  terminate: '●',
  eventRegistry: '⚡',
  variable: '𝑥',
};

/** Read-only SVG rendering of a model's display JSON, with fit-to-view, zoom and pan. */
@Component({
  selector: 'fm-diagram-viewer',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './diagram-viewer.html',
  styleUrl: './diagram-viewer.scss',
})
export class DiagramViewer {
  readonly model = input.required<DisplayModel>();

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  protected readonly zoom = signal(1);
  protected readonly pan = signal<DisplayPoint>({ x: 0, y: 0 });
  private dragStart: { x: number; y: number; pan: DisplayPoint } | null = null;

  /** Rendered size of the SVG in CSS pixels, kept current by a ResizeObserver. */
  private readonly size = signal({ width: 0, height: 0 });

  /**
   * Model bounds, grown so a small diagram is never scaled above {@link MAX_FIT_SCALE}
   * (otherwise a three-shape process fills the screen with giant text).
   */
  protected readonly bounds = computed(() => {
    const b = modelBounds(this.model());
    const { width, height } = this.size();
    if (!width || !height) return b;
    const minWidth = width / MAX_FIT_SCALE;
    const minHeight = height / MAX_FIT_SCALE;
    const w = Math.max(b.width, minWidth);
    const h = Math.max(b.height, minHeight);
    return { x: b.x - (w - b.width) / 2, y: b.y - (h - b.height) / 2, width: w, height: h };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const svg = this.svg()?.nativeElement;
      if (!svg || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) =>
        this.size.set({ width: entry.contentRect.width, height: entry.contentRect.height }),
      );
      observer.observe(svg);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** The visible window in model coordinates, derived from the fitted bounds, zoom and pan. */
  protected readonly viewBox = computed(() => {
    const b = this.bounds();
    const z = this.zoom();
    const p = this.pan();
    const w = b.width / z;
    const h = b.height / z;
    const x = b.x + (b.width - w) / 2 - p.x;
    const y = b.y + (b.height - h) / 2 - p.y;
    return `${x} ${y} ${w} ${h}`;
  });

  protected readonly pools = computed(() => this.model().pools ?? []);

  /** Containers first (largest behind), then the rest, so nested shapes stay visible. */
  protected readonly shapes = computed<Shape[]>(() => {
    const shapes = (this.model().elements ?? []).map((el) => {
      const kind = shapeKind(el.type);
      const labelWidth =
        kind === 'task' || kind === 'decision' ? el.width - 12 : Math.max(el.width, 120);
      return {
        el,
        kind,
        lines: el.name ? wrapText(el.name, labelWidth, kind === 'task' ? 4 : 3) : [],
        icon: TASK_TYPE_ICONS[el.taskType ?? ''] ?? TASK_ICONS[el.type] ?? null,
      };
    });
    const area = (s: Shape) => s.el.width * s.el.height;
    return [
      ...shapes.filter((s) => s.kind === 'container').sort((a, b) => area(b) - area(a)),
      ...shapes.filter((s) => s.kind !== 'container'),
    ];
  });

  protected readonly edges = computed<Edge[]>(() =>
    (this.model().flows ?? [])
      .filter((flow) => (flow.waypoints?.length ?? 0) > 1)
      .map((flow) => {
        const wp = flow.waypoints;
        const mid = wp[Math.floor((wp.length - 1) / 2)];
        const next = wp[Math.floor((wp.length - 1) / 2) + 1];
        const association = flow.type.toLowerCase() === 'association';
        return {
          flow,
          points: wp.map((p) => `${p.x},${p.y}`).join(' '),
          dashed: association,
          arrow: !association,
          label: flow.name ? { x: (mid.x + next.x) / 2, y: (mid.y + next.y) / 2 - 6 } : null,
        };
      }),
  );

  protected glyph(el: DisplayElement): string {
    return EVENT_GLYPHS[el.eventDefinition?.type ?? ''] ?? '';
  }

  protected isEnd(el: DisplayElement): boolean {
    return el.type === 'EndEvent';
  }

  protected isIntermediate(el: DisplayElement): boolean {
    return (
      el.type === 'BoundaryEvent' ||
      el.type === 'ThrowEvent' ||
      el.type === 'IntermediateCatchEvent' ||
      el.type.endsWith('EventListener')
    );
  }

  protected nonInterrupting(el: DisplayElement): boolean {
    return el.interrupting === false || el.cancelActivity === false;
  }

  protected gatewayMarker(type: string): string {
    switch (type) {
      case 'ExclusiveGateway':
        return 'x';
      case 'ParallelGateway':
        return '+';
      case 'InclusiveGateway':
        return 'o';
      case 'EventGateway':
        return 'e';
      default:
        return '';
    }
  }

  protected diamond(el: DisplayElement): string {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
  }

  protected zoomBy(factor: number): void {
    this.zoom.update((z) => Math.min(8, Math.max(0.2, z * factor)));
  }

  protected fit(): void {
    this.zoom.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  protected onPointerDown(event: PointerEvent): void {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.dragStart = { x: event.clientX, y: event.clientY, pan: this.pan() };
  }

  protected onPointerMove(event: PointerEvent): void {
    const start = this.dragStart;
    const svg = this.svg()?.nativeElement;
    if (!start || !svg) return;
    // Convert screen pixels to model units for the current zoom.
    const scale = this.bounds().width / this.zoom() / svg.clientWidth;
    const ratio = Math.max(scale, this.bounds().height / this.zoom() / svg.clientHeight);
    this.pan.set({
      x: start.pan.x + (event.clientX - start.x) * ratio,
      y: start.pan.y + (event.clientY - start.y) * ratio,
    });
  }

  protected onPointerUp(): void {
    this.dragStart = null;
  }
}
