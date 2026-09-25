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
import { forkJoin } from 'rxjs';
import { ApiUrls } from '../../core/api/api-urls';
import { AppModelReference, ModelRepresentation } from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';

export type ModelTab = 'bpmn' | 'cmmn';

export interface IncludedModels {
  models: AppModelReference[];
  cmmnModels: AppModelReference[];
}

/** The summary the original editor stored for each included model. */
export function toAppModelReference(model: ModelRepresentation & { stencilSet?: number }) {
  return {
    id: model.id,
    name: model.name,
    version: model.version,
    modelType: model.modelType,
    description: model.description,
    stencilSetId: model.stencilSet ?? null,
    createdBy: model.createdBy,
    lastUpdatedBy: model.lastUpdatedBy,
    lastUpdated: model.lastUpdated,
  } satisfies AppModelReference;
}

/** Pick the process and case models the app bundles ("Edit included models"). */
@Component({
  selector: 'fm-included-models-dialog',
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
      [header]="'APP.POPUP.INCLUDE-MODELS-TITLE' | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '56rem' }"
      [breakpoints]="{ '960px': '95vw' }"
      [contentStyle]="{ 'min-height': '24rem' }"
    >
      <div class="bar">
        <nav class="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            [class.active]="tab() === 'bpmn'"
            [attr.aria-selected]="tab() === 'bpmn'"
            (click)="tab.set('bpmn')"
          >
            <i class="pi pi-sitemap"></i> {{ 'GENERAL.NAVIGATION.PROCESSES' | translate }}
            <span class="badge">{{ selectedBpmn().size }}</span>
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="tab() === 'cmmn'"
            [attr.aria-selected]="tab() === 'cmmn'"
            (click)="tab.set('cmmn')"
          >
            <i class="pi pi-briefcase"></i> {{ 'GENERAL.NAVIGATION.CASEMODELS' | translate }}
            <span class="badge">{{ selectedCmmn().size }}</span>
          </button>
        </nav>
        <p-iconfield class="search">
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            type="search"
            placeholder="Filter"
            [ngModel]="filter()"
            (ngModelChange)="filter.set($event)"
            aria-label="Filter models"
          />
        </p-iconfield>
      </div>

      @if (error()) {
        <p-message severity="error">{{ error() }}</p-message>
      } @else if (loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <p-skeleton height="9rem" borderRadius="0.75rem" />
          }
        </div>
      } @else if (visibleModels().length === 0) {
        <p class="empty">No models to show.</p>
      } @else {
        <div class="grid" role="listbox" aria-multiselectable="true">
          @for (m of visibleModels(); track m.id) {
            @let selected = isSelected(m.id);
            <button
              type="button"
              class="pick"
              role="option"
              [class.selected]="selected"
              [attr.aria-selected]="selected"
              (click)="toggle(m)"
            >
              <span class="thumb">
                <img
                  [src]="thumbnail(m)"
                  alt=""
                  loading="lazy"
                  (error)="$any($event.target).hidden = true"
                />
              </span>
              <span class="check" aria-hidden="true"><i class="pi pi-check"></i></span>
              <span class="info">
                <strong>{{ m.name }}</strong>
                <small>{{ m.key }} · v{{ m.version }}</small>
              </span>
            </button>
          }
        </div>
      }

      <ng-template #footer>
        <span class="summary">{{ selectedBpmn().size + selectedCmmn().size }} selected</span>
        <p-button
          [label]="'GENERAL.ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="'ACTION.OK' | translate" icon="pi pi-check" (onClick)="apply()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .search input {
      width: 16rem;
      max-width: 100%;
    }
    .segmented {
      display: inline-flex;
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: var(--p-border-radius-lg);
      background: var(--p-surface-100);
    }
    :host-context(.app-dark) .segmented {
      background: var(--p-surface-800);
    }
    .segmented button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      border: 0;
      border-radius: var(--p-border-radius-md);
      background: none;
      color: var(--p-text-muted-color);
      font: inherit;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .segmented button.active {
      background: var(--p-content-background);
      color: var(--p-text-color);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
    }
    .badge {
      min-width: 1.25rem;
      padding: 0 0.375rem;
      border-radius: 999px;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-size: 0.75rem;
      line-height: 1.25rem;
      text-align: center;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.75rem;
    }
    .empty {
      text-align: center;
      color: var(--p-text-muted-color);
      padding: 3rem 0;
    }
    .pick {
      position: relative;
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
      transition:
        border-color 0.12s,
        box-shadow 0.12s;
    }
    .pick:hover {
      border-color: var(--p-primary-300);
    }
    .pick.selected {
      border-color: var(--p-primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 20%, transparent);
    }
    .thumb {
      height: 6rem;
      display: grid;
      place-items: center;
      background: var(--p-surface-50);
      border-bottom: 1px solid var(--p-content-border-color);
    }
    :host-context(.app-dark) .thumb {
      background: var(--p-surface-900);
    }
    :host-context(.app-dark) .thumb img {
      filter: invert(0.9) hue-rotate(180deg);
    }
    .thumb img {
      max-width: 90%;
      max-height: 5.25rem;
      object-fit: contain;
    }
    .check {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 1.5rem;
      height: 1.5rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 2px solid var(--p-content-border-color);
      background: var(--p-content-background);
      color: transparent;
      font-size: 0.75rem;
    }
    .pick.selected .check {
      border-color: var(--p-primary-color);
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.625rem 0.75rem;
      min-width: 0;
    }
    .info strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .info small {
      color: var(--p-text-muted-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .summary {
      margin-right: auto;
      align-self: center;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
  `,
})
export class IncludedModelsDialog {
  private readonly api = inject(ModelsApi);
  private readonly urls = inject(ApiUrls);

  readonly visible = model(false);
  readonly current = input.required<IncludedModels>();
  readonly initialTab = input<ModelTab>('bpmn');
  readonly changed = output<IncludedModels>();

  protected readonly tab = signal<ModelTab>('bpmn');
  protected readonly filter = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly bpmn = signal<ModelRepresentation[]>([]);
  private readonly cmmn = signal<ModelRepresentation[]>([]);
  protected readonly selectedBpmn = signal(new Set<string>());
  protected readonly selectedCmmn = signal(new Set<string>());

  protected readonly visibleModels = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const list = this.tab() === 'bpmn' ? this.bpmn() : this.cmmn();
    return text ? list.filter((m) => `${m.name} ${m.key}`.toLowerCase().includes(text)) : list;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.open());
    });
  }

  private open(): void {
    const current = this.current();
    this.tab.set(this.initialTab());
    this.filter.set('');
    this.selectedBpmn.set(new Set((current.models ?? []).map((m) => m.id)));
    this.selectedCmmn.set(new Set((current.cmmnModels ?? []).map((m) => m.id)));
    this.loading.set(true);
    this.error.set(null);
    forkJoin([this.api.modelsForAppDefinition(), this.api.cmmnModelsForAppDefinition()]).subscribe({
      next: ([bpmn, cmmn]) => {
        this.bpmn.set(bpmn.data ?? []);
        this.cmmn.set(cmmn.data ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err, 'Could not load the models.'));
        this.loading.set(false);
      },
    });
  }

  protected thumbnail(m: ModelRepresentation): string {
    return this.urls.modelThumbnail(m.id, m.lastUpdated);
  }

  protected isSelected(id: string): boolean {
    return (this.tab() === 'bpmn' ? this.selectedBpmn() : this.selectedCmmn()).has(id);
  }

  protected toggle(m: ModelRepresentation): void {
    const target = this.tab() === 'bpmn' ? this.selectedBpmn : this.selectedCmmn;
    target.update((set) => {
      const next = new Set(set);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  protected apply(): void {
    const current = this.current();
    // Fresh summaries for the picked models, like the original; included models that are no
    // longer listed stay as stored, so opening this dialog never drops them silently.
    const pick = (
      all: ModelRepresentation[],
      selected: Set<string>,
      existing: AppModelReference[] | undefined,
    ): AppModelReference[] => {
      const listed = all.filter((m) => selected.has(m.id)).map(toAppModelReference);
      const unlisted = (existing ?? []).filter(
        (m) => selected.has(m.id) && !all.some((a) => a.id === m.id),
      );
      return [...listed, ...unlisted];
    };
    this.changed.emit({
      models: pick(this.bpmn(), this.selectedBpmn(), current.models),
      cmmnModels: pick(this.cmmn(), this.selectedCmmn(), current.cmmnModels),
    });
    this.visible.set(false);
  }
}
