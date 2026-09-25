import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { MessageService } from '@openng/optimus-ui/api';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { ModelRepresentation, ModelSort, ResultList } from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { CreateModelDialog } from './create-model-dialog';
import { ImportModelDialog } from './import-model-dialog';
import { ModelCard } from './model-card';
import { MODEL_KINDS, ModelKind } from './model-kinds';

const SORTS: ModelSort[] = ['modifiedDesc', 'modifiedAsc', 'nameAsc', 'nameDesc'];
const SORT_LABELS: Record<ModelSort, string> = {
  modifiedDesc: 'MODIFIED-DESC',
  modifiedAsc: 'MODIFIED-ASC',
  nameAsc: 'NAME-ASC',
  nameDesc: 'NAME-DESC',
};

/** Search, sort and sort state is kept per model type for the whole visit, like the original `$rootScope.modelFilter`. */
const savedState = new Map<ModelKind['id'], { sort: ModelSort; text: string }>();

/** The list page of one model type: processes, case models, forms, decision tables/services or apps. */
@Component({
  selector: 'fm-model-library',
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    ModelCard,
    CreateModelDialog,
    ImportModelDialog,
  ],
  templateUrl: './model-library.html',
  styleUrl: './model-library.scss',
})
export class ModelLibrary {
  private readonly api = inject(ModelsApi);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route data `kind`. */
  readonly kindId = input.required<ModelKind['id']>({ alias: 'kind' });
  protected readonly kind = computed(() => MODEL_KINDS[this.kindId()]);
  protected readonly isDecisions = computed(() => this.kind().listI18n === 'DECISIONS-LIST');
  protected readonly decisionTabs = [
    MODEL_KINDS['decision-tables'],
    MODEL_KINDS['decision-services'],
  ];

  protected readonly sorts = SORTS.map((id) => ({ id, label: SORT_LABELS[id] }));
  protected readonly sort = signal<ModelSort>('modifiedDesc');
  protected readonly searchText = signal('');
  private readonly refreshTick = signal(0);

  protected readonly createVisible = signal(false);
  protected readonly importVisible = signal(false);
  protected readonly duplicateSource = signal<ModelRepresentation | null>(null);

  private readonly query = computed(() => ({
    kind: this.kind(),
    sort: this.sort(),
    text: this.searchText().trim(),
    tick: this.refreshTick(),
  }));

  protected readonly loading = signal(true);
  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      distinctUntilChanged(
        (a, b) => a.kind === b.kind && a.sort === b.sort && a.text === b.text && a.tick === b.tick,
      ),
      tap(() => this.loading.set(true)),
      switchMap(({ kind, sort, text }) =>
        this.api
          .list({
            filter: kind.filter,
            modelType: kind.modelType,
            sort,
            filterText: text || undefined,
          })
          .pipe(
            catchError((err: unknown) => {
              this.messages.add({ severity: 'error', summary: errorMessage(err), life: 6000 });
              return of<ResultList<ModelRepresentation>>({ size: 0, total: 0, start: 0, data: [] });
            }),
          ),
      ),
      tap(() => this.loading.set(false)),
    ),
  );

  protected readonly models = computed(() => this.result()?.data ?? []);
  protected readonly total = computed(() => this.result()?.total ?? this.models().length);

  constructor() {
    // Restore the per-type search and sort when switching model types, and remember them on change.
    effect(() => {
      const id = this.kindId();
      const saved = savedState.get(id);
      untracked(() => {
        this.sort.set(saved?.sort ?? 'modifiedDesc');
        this.searchText.set(saved?.text ?? '');
      });
    });
    effect(() => {
      savedState.set(untracked(this.kindId), { sort: this.sort(), text: this.searchText() });
    });
  }

  protected openCreate(): void {
    this.duplicateSource.set(null);
    this.createVisible.set(true);
  }

  protected openDuplicate(model: ModelRepresentation): void {
    this.duplicateSource.set(model);
    this.createVisible.set(true);
  }

  protected onCreated(model: ModelRepresentation): void {
    void this.router.navigate([this.kind().editorRoute, model.id]);
  }

  protected onImported(model: ModelRepresentation): void {
    this.messages.add({ severity: 'success', summary: model.name, life: 3000 });
    void this.router.navigate([this.kind().route, model.id]);
  }

  protected refresh(): void {
    this.refreshTick.update((tick) => tick + 1);
  }
}
