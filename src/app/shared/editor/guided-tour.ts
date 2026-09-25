import {
  Component,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';

export interface TourStep {
  /** CSS selector of the element the step points at; none for a centered step. */
  target?: string;
  /** Translation keys (or plain text). */
  title: string;
  content: string;
  params?: Record<string, unknown>;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 12;
const CARD_WIDTH = 360;

/** A step-by-step tour that highlights parts of the page, like the original editor's bootstrap-tour. */
@Component({
  selector: 'fm-guided-tour',
  imports: [TranslatePipe, ButtonModule],
  template: `
    @if (visible()) {
      @let s = step();
      @let r = spot();
      <div class="backdrop" (click)="close()"></div>
      @if (r) {
        <div
          class="spot"
          [style.left.px]="r.x - 6"
          [style.top.px]="r.y - 6"
          [style.width.px]="r.w + 12"
          [style.height.px]="r.h + 12"
        ></div>
      } @else {
        <div class="shade"></div>
      }
      <section
        #card
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-content"
        tabindex="-1"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
      >
        <p class="count">Step {{ index() + 1 }} of {{ steps().length }}</p>
        <h2 id="tour-title">{{ s.title | translate: s.params }}</h2>
        <p id="tour-content" [innerHTML]="s.content | translate: s.params"></p>
        <footer>
          <p-button label="End tour" severity="secondary" [text]="true" (onClick)="close()" />
          <span class="grow"></span>
          @if (index() > 0) {
            <p-button
              label="Back"
              severity="secondary"
              [outlined]="true"
              (onClick)="go(index() - 1)"
            />
          }
          @if (index() < steps().length - 1) {
            <p-button label="Next" (onClick)="go(index() + 1)" />
          } @else {
            <p-button label="Got it!" (onClick)="close()" />
          }
        </footer>
      </section>
    }
  `,
  styles: `
    .backdrop,
    .shade {
      position: fixed;
      inset: 0;
      z-index: 1100;
    }
    .shade {
      background: rgb(15 23 42 / 45%);
      pointer-events: none;
    }
    .spot {
      position: fixed;
      z-index: 1100;
      border-radius: 0.75rem;
      box-shadow: 0 0 0 9999px rgb(15 23 42 / 45%);
      outline: 2px solid var(--p-primary-color);
      pointer-events: none;
      transition: all 0.2s ease;
    }
    .card {
      position: fixed;
      z-index: 1101;
      width: min(${CARD_WIDTH}px, calc(100vw - 2rem));
      padding: 1rem 1.25rem 0.75rem;
      background: var(--p-content-background);
      color: var(--p-text-color);
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.875rem;
      box-shadow: 0 12px 32px rgb(15 23 42 / 25%);
      outline: none;
    }
    .count {
      margin: 0 0 0.25rem;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.05rem;
    }
    #tour-content {
      margin: 0 0 0.75rem;
      line-height: 1.5;
    }
    footer {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .grow {
      flex: 1;
    }
  `,
})
export class GuidedTour {
  readonly steps = input.required<TourStep[]>();
  readonly visible = model(false);

  protected readonly index = signal(0);
  protected readonly step = computed(() => this.steps()[this.index()] ?? this.steps()[0]);
  /** The highlighted element's box in viewport coordinates. */
  protected readonly spot = signal<Rect | null>(null);
  private readonly cardSize = signal({ w: CARD_WIDTH, h: 200 });
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private returnFocus: HTMLElement | null = null;

  /** Places the card beside the highlighted element where it fits, else centered. */
  protected readonly position = computed(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { w, h } = this.cardSize();
    const r = this.spot();
    const clamp = (v: number, max: number) => Math.max(GAP, Math.min(v, max - GAP));
    if (!r) return { x: (vw - w) / 2, y: Math.max(GAP, (vh - h) / 3) };
    if (r.x + r.w + GAP + w <= vw) return { x: r.x + r.w + GAP, y: clamp(r.y, vh - h) };
    if (r.x - GAP - w >= 0) return { x: r.x - GAP - w, y: clamp(r.y, vh - h) };
    if (r.y + r.h + GAP + h <= vh) return { x: clamp(r.x, vw - w), y: r.y + r.h + GAP };
    if (r.y - GAP - h >= 0) return { x: clamp(r.x, vw - w), y: r.y - GAP - h };
    return { x: (vw - w) / 2, y: Math.max(GAP, (vh - h) / 2) };
  });

  constructor() {
    afterRenderEffect(() => {
      if (!this.visible()) return;
      this.step();
      this.measure();
    });
  }

  start() {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.index.set(0);
    this.visible.set(true);
    setTimeout(() => this.card()?.nativeElement.focus());
  }

  protected go(i: number) {
    this.index.set(Math.max(0, Math.min(i, this.steps().length - 1)));
    this.card()?.nativeElement.focus();
  }

  protected close() {
    this.visible.set(false);
    this.spot.set(null);
    this.returnFocus?.focus();
  }

  private measure() {
    const target = this.step().target;
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    const box = el?.getBoundingClientRect();
    const spot =
      box && box.width && box.height ? { x: box.x, y: box.y, w: box.width, h: box.height } : null;
    const prev = this.spot();
    if (JSON.stringify(prev) !== JSON.stringify(spot)) this.spot.set(spot);
    const card = this.card()?.nativeElement;
    if (card) {
      const size = { w: card.offsetWidth, h: card.offsetHeight };
      const was = this.cardSize();
      if (was.w !== size.w || was.h !== size.h) this.cardSize.set(size);
    }
  }

  @HostListener('window:resize')
  protected onResize() {
    if (this.visible()) this.measure();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent) {
    if (!this.visible()) return;
    if (event.key === 'Escape') this.close();
    else if (event.key === 'ArrowRight') this.go(this.index() + 1);
    else if (event.key === 'ArrowLeft') this.go(this.index() - 1);
    else if (event.key === 'Tab') {
      // Keep focus inside the tour card.
      const card = this.card()?.nativeElement;
      const items = card ? [...card.querySelectorAll<HTMLElement>('button')] : [];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) {
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
      } else return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }
}
