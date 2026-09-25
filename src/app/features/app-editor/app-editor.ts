import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { PopoverModule } from '@openng/optimus-ui/popover';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { firstValueFrom } from 'rxjs';
import { ApiUrls } from '../../core/api/api-urls';
import {
  AppDefinitionRepresentation,
  AppModelReference,
  ModelType,
} from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import {
  APP_THEMES,
  DEFAULT_APP_ICON,
  DEFAULT_APP_THEME,
  PICKER_ICONS,
  appIconClass,
  appThemeBackground,
} from '../../shared/app-look/app-look';
import { AppTile } from '../../shared/app-look/app-tile';
import {
  ModelSaveDialog,
  SaveDialogLabels,
  SaveRequest,
} from '../../shared/editor/model-save-dialog';
import {
  LeaveChoice,
  LeaveConfirmation,
  UnsavedChangesDialog,
} from '../../shared/editor/unsaved-changes-dialog';
import { IncludedModels, IncludedModelsDialog, ModelTab } from './included-models-dialog';

type Definition = AppDefinitionRepresentation['definition'];

@Component({
  selector: 'fm-app-editor',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    PopoverModule,
    SkeletonModule,
    TooltipModule,
    AppTile,
    IncludedModelsDialog,
    ModelSaveDialog,
    UnsavedChangesDialog,
  ],
  templateUrl: './app-editor.html',
  styleUrl: './app-editor.scss',
})
export class AppEditor implements HasUnsavedChanges {
  private readonly api = inject(ModelsApi);
  private readonly urls = inject(ApiUrls);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  /** Route parameter. */
  readonly modelId = input.required<string>();

  protected readonly app = rxResource({
    params: () => this.modelId(),
    stream: ({ params }) => this.api.appDefinition(params),
  });

  protected readonly meta = signal<AppDefinitionRepresentation | null>(null);
  protected readonly def = signal<Definition | null>(null);
  protected readonly tab = signal<ModelTab>('bpmn');

  protected readonly revision = signal(0);
  private readonly snapshot = signal('');
  protected readonly dirty = computed(() => {
    this.revision();
    const def = this.def();
    return !!def && !!this.snapshot() && this.snapshot() !== JSON.stringify(def);
  });

  protected readonly bpmnModels = computed(() => {
    this.revision();
    return this.def()?.models ?? [];
  });
  protected readonly cmmnModels = computed(() => {
    this.revision();
    return this.def()?.cmmnModels ?? [];
  });
  protected readonly shownModels = computed(() =>
    this.tab() === 'bpmn' ? this.bpmnModels() : this.cmmnModels(),
  );
  protected readonly hasModels = computed(
    () => this.bpmnModels().length + this.cmmnModels().length > 0,
  );

  protected readonly icons = PICKER_ICONS;
  protected readonly themes = APP_THEMES;
  protected readonly iconClass = appIconClass;
  protected readonly themeBackground = appThemeBackground;

  protected readonly modelsVisible = signal(false);
  protected readonly included = computed<IncludedModels>(() => ({
    models: this.bpmnModels(),
    cmmnModels: this.cmmnModels(),
  }));

  protected readonly saveVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly leave = new LeaveConfirmation();
  protected readonly saveLabels: SaveDialogLabels = {
    title: 'APP.POPUP.SAVE-APP-TITLE',
    description: 'APP.POPUP.CREATE-DESCRIPTION',
    name: 'APP.NAME',
    key: 'APP.KEY',
    descriptionField: 'APP.DESCRIPTION',
  };
  protected readonly saveInitial = computed(() => {
    const meta = this.meta();
    return { name: meta?.name ?? '', key: meta?.key ?? '', description: meta?.description ?? '' };
  });

  constructor() {
    effect(() => {
      const app = this.app.value();
      if (app) untracked(() => this.load(app));
    });
  }

  private load(app: AppDefinitionRepresentation): void {
    const def: Definition = structuredClone(app.definition ?? {});
    // Same defaults as the original editor.
    def.theme ||= DEFAULT_APP_THEME;
    def.icon ||= DEFAULT_APP_ICON;
    this.meta.set(app);
    this.def.set(def);
    this.tab.set(!def.models?.length && def.cmmnModels?.length ? 'cmmn' : 'bpmn');
    this.snapshot.set(JSON.stringify(def));
  }

  protected touch(): void {
    this.revision.update((r) => r + 1);
  }

  protected setIcon(icon: string): void {
    this.def()!.icon = icon;
    this.touch();
  }

  protected setTheme(theme: string): void {
    this.def()!.theme = theme;
    this.touch();
  }

  protected setAccess(field: 'usersAccess' | 'groupsAccess', value: string): void {
    this.def()![field] = value;
    this.touch();
  }

  protected onModelsChanged(included: IncludedModels): void {
    const def = this.def()!;
    def.models = included.models;
    def.cmmnModels = included.cmmnModels;
    this.touch();
  }

  protected removeModel(model: AppModelReference): void {
    const def = this.def()!;
    if (this.tab() === 'bpmn') def.models = (def.models ?? []).filter((m) => m !== model);
    else def.cmmnModels = (def.cmmnModels ?? []).filter((m) => m !== model);
    this.touch();
  }

  protected thumbnail(model: AppModelReference): string {
    return this.urls.modelThumbnail(model.id, model.lastUpdated);
  }

  protected modelRoute(model: AppModelReference): unknown[] {
    const cmmn = this.tab() === 'cmmn' || model.modelType === ModelType.Cmmn;
    return [cmmn ? '/casemodels' : '/processes', model.id];
  }

  // Saving

  protected openSave(): void {
    this.saveError.set(null);
    this.saveVisible.set(true);
  }

  protected async onSave(request: SaveRequest): Promise<void> {
    if (!(await this.persist(request))) return;
    this.saveVisible.set(false);
    this.messages.add({
      severity: 'success',
      summary: this.translate.instant(
        request.publish ? 'APP.ALERT.PUBLISH-CONFIRM' : 'APP.POPUP.SAVE-APP-SAVE-SUCCESS',
      ),
      life: 2500,
    });
    if (request.close) this.close();
  }

  private async persist(request: Pick<SaveRequest, 'name' | 'key' | 'description' | 'publish'>) {
    const meta = this.meta();
    const def = this.def();
    if (!meta || !def) return false;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const result = await firstValueFrom(
        this.api.saveAppDefinition(meta.id, {
          appDefinition: {
            ...meta,
            name: request.name,
            key: request.key,
            description: request.description,
            definition: structuredClone(def),
          },
          publish: request.publish,
        }),
      );
      if (result.error) {
        this.saveError.set(
          result.errorDescription || this.translate.instant('APP.ALERT.PUBLISH-ERROR'),
        );
        return false;
      }
      const saved = result.appDefinition;
      this.meta.set({ ...meta, ...(saved ?? {}), definition: def });
      this.snapshot.set(JSON.stringify(def));
      this.touch();
      return true;
    } catch (error) {
      this.saveError.set(
        errorMessage(
          error,
          this.translate.instant(request.publish ? 'APP.ALERT.PUBLISH-ERROR' : 'MODEL.SAVE.ERROR'),
        ),
      );
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.router.navigate(['/apps', this.modelId()]);
  }

  // Unsaved changes

  canLeave(): boolean | Promise<boolean> {
    return this.dirty() ? this.leave.ask() : true;
  }

  protected resolveLeave(choice: LeaveChoice): void {
    if (choice !== 'save') {
      this.leave.finish(choice === 'discard');
      return;
    }
    this.persist({ ...this.saveInitial(), publish: false }).then(
      (ok) => ok && this.leave.finish(true),
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}
