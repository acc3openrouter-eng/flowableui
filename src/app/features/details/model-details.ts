import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MenuItem, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { MenuModule } from '@openng/optimus-ui/menu';
import { MessageModule } from '@openng/optimus-ui/message';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TagModule } from '@openng/optimus-ui/tag';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { Observable, forkJoin, map, of } from 'rxjs';
import { ApiUrls } from '../../core/api/api-urls';
import {
  AppDefinitionRepresentation,
  DecisionTableRepresentation,
  FormRepresentation,
  ModelRepresentation,
} from '../../core/api/api.types';
import { DisplayModel } from '../../shared/diagram-viewer/display-model';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { DiagramViewer } from '../../shared/diagram-viewer/diagram-viewer';
import { ModelFormDialog, ModelFormMode } from '../library/model-form-dialog';
import { MODEL_KINDS, ModelKind, modelKindForType } from '../library/model-kinds';
import { AppPreview } from './app-preview';
import { DecisionTablePreview } from './decision-table-preview';
import { FormPreview } from './form-preview';

interface PreviewData {
  diagram?: DisplayModel;
  form?: FormRepresentation;
  table?: DecisionTableRepresentation;
  app?: AppDefinitionRepresentation;
}

/** Details of one model (or one historic version of it): metadata, preview, versions and actions. */
@Component({
  selector: 'fm-model-details',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    MenuModule,
    MessageModule,
    SkeletonModule,
    TagModule,
    TextareaModule,
    TooltipModule,
    DiagramViewer,
    FormPreview,
    DecisionTablePreview,
    AppPreview,
    ModelFormDialog,
  ],
  templateUrl: './model-details.html',
  styleUrl: './model-details.scss',
})
export class ModelDetails {
  private readonly api = inject(ModelsApi);
  private readonly urls = inject(ApiUrls);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  /** Route data `kind` and route params. */
  readonly kindId = input.required<ModelKind['id']>({ alias: 'kind' });
  readonly modelId = input.required<string>();
  readonly modelHistoryId = input<string>();

  protected readonly kind = computed(() => MODEL_KINDS[this.kindId()]);
  private readonly reloadTick = signal(0);

  /** The model (or historic version) plus its full version list. */
  protected readonly data = rxResource({
    params: () => ({
      id: this.modelId(),
      historyId: this.modelHistoryId(),
      tick: this.reloadTick(),
    }),
    stream: ({ params }) =>
      forkJoin({
        model: params.historyId
          ? this.api.historyVersion(params.id, params.historyId)
          : this.api.get(params.id),
        latest: params.historyId ? this.api.get(params.id) : of(null),
        history: this.api.history(params.id, true).pipe(map((r) => r.data ?? [])),
      }),
  });

  protected readonly model = computed(() => this.data.value()?.model ?? null);
  protected readonly isLatest = computed(() => !this.modelHistoryId());
  protected readonly versions = computed(() => {
    const data = this.data.value();
    if (!data) return [];
    const latest = data.latest ?? data.model;
    const older = data.history.filter((v) => v.id !== latest.id);
    return [latest, ...older].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  });

  /** The kind-specific preview payload. */
  protected readonly preview = rxResource<
    PreviewData,
    { kind: ModelKind; id: string; historyId?: string }
  >({
    params: () => ({ kind: this.kind(), id: this.modelId(), historyId: this.modelHistoryId() }),
    stream: ({ params }): Observable<PreviewData> => {
      switch (params.kind.preview) {
        case 'diagram':
          return this.api
            .displayJson(params.id, params.historyId)
            .pipe(map((v) => ({ diagram: v })));
        case 'form':
          return this.api.form(params.id, params.historyId).pipe(map((v) => ({ form: v })));
        case 'decision-table':
          return this.api
            .decisionTable(params.id, params.historyId)
            .pipe(map((v) => ({ table: v })));
        case 'app':
          return this.api.appDefinition(params.id, params.historyId).pipe(map((v) => ({ app: v })));
      }
    },
  });

  protected readonly exportItems = computed<MenuItem[]>(() =>
    this.kind().exports.map((e) => ({
      label: this.translate.instant(e.label),
      icon: 'pi pi-download',
      url: e.url(this.urls, this.modelId(), this.modelHistoryId()),
      target: '_self',
    })),
  );

  protected readonly formMode = signal<ModelFormMode>('edit');
  protected readonly formVisible = signal(false);
  protected readonly restoreVisible = signal(false);
  protected readonly publishVisible = signal(false);
  protected comment = '';
  protected readonly busy = signal(false);
  protected readonly dialogError = signal<string | null>(null);

  protected openForm(mode: ModelFormMode): void {
    this.formMode.set(mode);
    this.formVisible.set(true);
  }

  protected onSaved(saved: ModelRepresentation): void {
    if (this.formMode() === 'duplicate') {
      void this.router.navigate([this.kind().editorRoute, saved.id]);
    } else {
      this.messages.add({
        severity: 'success',
        summary: this.translate.instant('PROCESS.ALERT.EDIT-CONFIRM'),
        life: 3000,
      });
      this.reloadTick.update((t) => t + 1);
    }
  }

  protected versionLink(version: ModelRepresentation): unknown[] {
    const latestId = this.modelId();
    return version.id === latestId || version.latestVersion
      ? [this.kind().route, latestId]
      : [this.kind().route, latestId, 'history', version.id];
  }

  protected isCurrent(version: ModelRepresentation): boolean {
    return (
      (this.modelHistoryId() ?? this.modelId()) === version.id ||
      (!this.modelHistoryId() && !!version.latestVersion)
    );
  }

  /** Loads the models that use this one, then asks for confirmation before deleting. */
  protected confirmDelete(): void {
    const model = this.model();
    if (!model) return;
    this.api.parentRelations(model.id).subscribe({
      next: (relations) => this.askDelete(model, relations),
      error: () => this.askDelete(model, []),
    });
  }

  private askDelete(model: ModelRepresentation, relations: ModelRepresentation[]): void {
    const item = this.kind().itemI18n;
    const safe = { ...model, name: escapeHtml(model.name) };
    if (relations.length) {
      // Like the original, a model that other models use cannot be deleted.
      this.confirmation.confirm({
        header: this.translate.instant(`${item}.POPUP.DELETE-TITLE`),
        message: `<p>${this.translate.instant('PROCESS.POPUP.DELETE-RELATIONS-DESCRIPTION')}</p><ul>${relations
          .map((r) => `<li>${escapeHtml(r.name)} (${escapeHtml(modelKindName(r))})</li>`)
          .join('')}</ul>`,
        icon: 'pi pi-info-circle',
        acceptLabel: this.translate.instant('GENERAL.ACTION.CLOSE'),
        rejectVisible: false,
      });
      return;
    }
    this.confirmation.confirm({
      header: this.translate.instant(`${item}.POPUP.DELETE-TITLE`),
      message: this.translate.instant(`${item}.POPUP.DELETE-DESCRIPTION`, safe),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant(`${item}.ACTION.DELETE-CONFIRM`),
      rejectLabel: this.translate.instant('GENERAL.ACTION.CANCEL'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.api.delete(model.id).subscribe({
          next: () => void this.router.navigate([this.kind().route]),
          error: (err: unknown) =>
            this.messages.add({ severity: 'error', summary: errorMessage(err), life: 6000 }),
        }),
    });
  }

  /** Model types without their own "use as new version" texts reuse the process ones. */
  protected readonly restoreTexts = computed(() =>
    ['PROCESS', 'CASE', 'FORM', 'DECISION-TABLE'].includes(this.kind().itemI18n)
      ? this.kind().itemI18n
      : 'PROCESS',
  );

  protected openRestore(): void {
    this.comment = '';
    this.dialogError.set(null);
    this.restoreVisible.set(true);
  }

  protected restore(): void {
    const historyId = this.modelHistoryId();
    if (!historyId) return;
    this.busy.set(true);
    this.api.useAsNewVersion(this.modelId(), historyId, this.comment).subscribe({
      next: (result) => {
        this.busy.set(false);
        const unresolved = result?.unresolvedModels ?? [];
        if (unresolved.length) {
          this.dialogError.set(
            `${this.translate.instant('PROCESS.POPUP.USE-AS-NEW-UNRESOLVED-MODELS-ERROR')} ${unresolved
              .map((m) => m.unresolvedModelName)
              .join(', ')}`,
          );
          return;
        }
        this.restoreVisible.set(false);
        void this.router.navigate([this.kind().route, this.modelId()]);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.dialogError.set(errorMessage(err));
      },
    });
  }

  protected openPublish(): void {
    this.comment = '';
    this.dialogError.set(null);
    this.publishVisible.set(true);
  }

  protected publish(force = false): void {
    this.busy.set(true);
    this.dialogError.set(null);
    this.api.publishApp(this.modelId(), this.comment, force).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result?.error) {
          this.dialogError.set(
            result.errorDescription ?? this.translate.instant('APP.ALERT.PUBLISH-ERROR'),
          );
          return;
        }
        this.publishVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.translate.instant('APP.ALERT.PUBLISH-CONFIRM'),
          life: 4000,
        });
        this.reloadTick.update((t) => t + 1);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.dialogError.set(errorMessage(err, this.translate.instant('APP.ALERT.PUBLISH-ERROR')));
      },
    });
  }
}

function modelKindName(model: ModelRepresentation): string {
  return modelKindForType(model.modelType)?.id.replace('-', ' ') ?? 'model';
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
