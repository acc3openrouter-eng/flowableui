import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { Observable } from 'rxjs';
import { ApiUrls } from '../../../core/api/api-urls';
import { ModelRepresentation, ResultList } from '../../../core/api/api.types';
import { EditorApi } from '../../../core/api/editor-api';
import { Row, complexValue } from './property-editors';

export type ReferenceSource =
  'forms' | 'decision-tables' | 'decision-services' | 'case-models' | 'processes';

/** Picks the form, decision table or decision service a task refers to. */
@Component({
  selector: 'fm-reference-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
  ],
  template: `
    <p-dialog
      [header]="title() | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '52rem' }"
      [breakpoints]="{ '900px': '96vw' }"
      [contentStyle]="{ 'min-height': '20rem' }"
    >
      <p-iconfield class="search">
        <p-inputicon styleClass="pi pi-search" />
        <input
          pInputText
          type="search"
          placeholder="Filter"
          aria-label="Filter"
          [ngModel]="filter()"
          (ngModelChange)="filter.set($event)"
        />
      </p-iconfield>
      @if (error()) {
        <p-message severity="error">{{ error() }}</p-message>
      } @else if (loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <p-skeleton height="8rem" borderRadius="0.75rem" />
          }
        </div>
      } @else {
        <div class="grid" role="listbox">
          @for (m of shown(); track m.id) {
            <button
              type="button"
              class="pick"
              role="option"
              [class.selected]="m.id === selectedId()"
              [attr.aria-selected]="m.id === selectedId()"
              (click)="selectedId.set(m.id === selectedId() ? null : m.id)"
            >
              <span class="thumb">
                <img
                  [src]="thumbnail(m)"
                  alt=""
                  loading="lazy"
                  (error)="$any($event.target).hidden = true"
                />
              </span>
              <span class="info">
                <strong>{{ m.name }}</strong>
                <small>{{ m.key }} · v{{ m.version }}</small>
              </span>
            </button>
          } @empty {
            <p class="empty">No models to show.</p>
          }
        </div>
      }
      <ng-template #footer>
        <p-button
          [label]="'ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="'ACTION.SAVE' | translate" icon="pi pi-check" (onClick)="apply()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .search {
      display: block;
      margin-bottom: 1rem;
    }
    .search input {
      width: 18rem;
      max-width: 100%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      gap: 0.75rem;
    }
    .pick {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      border: 2px solid var(--p-content-border-color);
      border-radius: 0.75rem;
      background: var(--p-content-background);
      color: var(--p-text-color);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .pick:hover {
      border-color: var(--p-primary-300);
    }
    .pick.selected {
      border-color: var(--p-primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 20%, transparent);
    }
    .thumb {
      height: 5.5rem;
      display: grid;
      place-items: center;
      background: var(--p-surface-50);
      border-bottom: 1px solid var(--p-content-border-color);
    }
    .thumb img {
      max-width: 90%;
      max-height: 5rem;
      object-fit: contain;
    }
    .info {
      display: flex;
      flex-direction: column;
      padding: 0.5rem 0.75rem;
      min-width: 0;
    }
    .info strong,
    .info small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .info small {
      color: var(--p-text-muted-color);
    }
    .empty {
      grid-column: 1 / -1;
      text-align: center;
      color: var(--p-text-muted-color);
      padding: 2rem 0;
    }
  `,
})
export class ReferenceDialog {
  private readonly api = inject(EditorApi);
  private readonly urls = inject(ApiUrls);

  readonly visible = model(false);
  readonly title = input('');
  readonly source = input.required<ReferenceSource>();
  readonly value = input<unknown>(null);
  /** The model being edited, left out of the case model list. */
  readonly excludeId = input('');
  readonly save = output<unknown>();

  protected readonly models = signal<ModelRepresentation[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal('');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly shown = computed(() => {
    const text = this.filter().trim().toLowerCase();
    return this.models().filter((m) => !text || `${m.name} ${m.key}`.toLowerCase().includes(text));
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.open());
    });
  }

  private open() {
    const v = complexValue(this.value()) as Row | null;
    this.selectedId.set(v && typeof v === 'object' ? ((v['id'] as string) ?? null) : null);
    this.filter.set('');
    this.loading.set(true);
    this.error.set(null);
    const requests: Record<ReferenceSource, () => Observable<ResultList<ModelRepresentation>>> = {
      forms: () => this.api.formModels(),
      'decision-tables': () => this.api.decisionTableModels(),
      'decision-services': () => this.api.decisionServiceModels(),
      'case-models': () => this.api.caseModels(this.excludeId()),
      processes: () => this.api.processModels(),
    };
    const request = requests[this.source()]();
    request.subscribe({
      next: (r) => {
        this.models.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The models could not be loaded. Try again later.');
        this.loading.set(false);
      },
    });
  }

  protected thumbnail(m: ModelRepresentation) {
    return this.urls.modelThumbnail(m.id, m.lastUpdated);
  }

  protected apply() {
    const m = this.models().find((x) => x.id === this.selectedId());
    this.save.emit(m ? { id: m.id, name: m.name, key: m.key } : null);
    this.visible.set(false);
  }
}
