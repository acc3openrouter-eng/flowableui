import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
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
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TagModule } from '@openng/optimus-ui/tag';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { firstValueFrom } from 'rxjs';
import { FormRepresentation } from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { FieldPreview } from './field-preview';
import { FieldProperties } from './field-properties';
import {
  EditorField,
  PALETTE,
  PaletteItem,
  deriveFieldId,
  newField,
  paletteItem,
  stripPrivate,
  toEditorFields,
  toSavedFields,
} from './form-field-types';
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
import { renderFormThumbnail } from './form-thumbnail';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';

type Tab = 'design' | 'outcomes';

@Component({
  selector: 'fm-form-editor',
  imports: [
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    RadioButtonModule,
    SkeletonModule,
    TagModule,
    TooltipModule,
    FieldPreview,
    FieldProperties,
    ModelSaveDialog,
    UnsavedChangesDialog,
  ],
  templateUrl: './form-editor.html',
  styleUrl: './form-editor.scss',
})
export class FormEditor implements HasUnsavedChanges {
  private readonly api = inject(ModelsApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  /** Route parameter. */
  readonly modelId = input.required<string>();

  protected readonly palette = PALETTE;
  protected readonly paletteItem = paletteItem;
  protected readonly form = rxResource({
    params: () => this.modelId(),
    stream: ({ params }) => this.api.form(params),
  });

  /** The loaded form's metadata, refreshed after each save. */
  protected readonly meta = signal<FormRepresentation | null>(null);
  protected readonly tab = signal<Tab>('design');
  protected readonly fields = signal<EditorField[]>([]);
  protected readonly selectedGuid = signal<string | null>(null);
  protected readonly selectedIndex = computed(() =>
    this.fields().findIndex((f) => f._guid === this.selectedGuid()),
  );
  protected readonly selected = computed(() => this.fields()[this.selectedIndex()] ?? null);
  protected useOutcomes = false;
  protected outcomes: { name: string }[] = [];

  /** Bumped on every in-place edit so previews and the dirty flag refresh. */
  protected readonly revision = signal(0);
  private readonly snapshot = signal('');
  protected readonly dirty = computed(() => {
    this.revision();
    this.fields();
    const snapshot = this.snapshot();
    return !!snapshot && snapshot !== this.serialize();
  });

  protected saveVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly leave = new LeaveConfirmation();
  protected readonly saveLabels: SaveDialogLabels = {
    title: 'FORM.POPUP.SAVE-FORM-TITLE',
    name: 'FORM.NAME',
    key: 'FORM.KEY',
    descriptionField: 'FORM.DESCRIPTION',
  };

  protected readonly saveInitial = computed(() => {
    const form = this.meta();
    return {
      name: form?.name ?? '',
      key: form?.key ?? '',
      description: form?.description ?? '',
    };
  });

  constructor() {
    effect(() => {
      const form = this.form.value();
      if (form) untracked(() => this.load(form));
    });
  }

  private load(form: FormRepresentation): void {
    this.meta.set(form);
    this.fields.set(toEditorFields(form.formDefinition?.fields));
    this.outcomes = structuredClone(form.formDefinition?.outcomes ?? []);
    this.useOutcomes = this.outcomes.length > 0;
    this.selectedGuid.set(null);
    this.snapshot.set(this.serialize());
  }

  private savedOutcomes(): { name: string }[] {
    return this.useOutcomes ? this.outcomes.filter((o) => o.name?.trim()) : [];
  }

  private serialize(): string {
    return JSON.stringify({ fields: toSavedFields(this.fields()), outcomes: this.savedOutcomes() });
  }

  protected touch(): void {
    this.revision.update((r) => r + 1);
  }

  /** Ids used by more than one field; the runtime form would mix up their values. */
  protected readonly duplicateIds = computed(() => {
    this.revision();
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    this.fields().forEach((field, index) => {
      const id = this.displayId(field, index);
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    });
    return duplicates;
  });

  protected displayId(field: EditorField, index: number): string {
    return field.overrideId ? field.id : deriveFieldId(field.name, index);
  }

  // Palette and canvas

  protected readonly noEnter = () => false;

  protected add(item: PaletteItem, index = this.fields().length): void {
    const field = newField(item.type, (key) => this.translate.instant(key));
    this.fields.update((fields) => {
      const next = [...fields];
      next.splice(index, 0, field);
      return next;
    });
    this.selectedGuid.set(field._guid);
    this.tab.set('design');
  }

  protected addAfterSelection(item: PaletteItem): void {
    const index = this.selectedIndex();
    this.add(item, index >= 0 ? index + 1 : this.fields().length);
  }

  protected drop(event: CdkDragDrop<EditorField[], unknown, PaletteItem | EditorField>): void {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      this.fields.update((fields) => {
        const next = [...fields];
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        return next;
      });
    } else {
      this.add(event.item.data as PaletteItem, event.currentIndex);
    }
  }

  protected move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.fields().length) return;
    this.fields.update((fields) => {
      const next = [...fields];
      moveItemInArray(next, index, target);
      return next;
    });
  }

  protected remove(field: EditorField): void {
    this.fields.update((fields) => fields.filter((f) => f !== field));
    if (this.selectedGuid() === field._guid) this.selectedGuid.set(null);
  }

  protected select(field: EditorField): void {
    this.selectedGuid.set(this.selectedGuid() === field._guid ? null : field._guid);
  }

  // Outcomes

  protected setUseOutcomes(value: boolean): void {
    this.useOutcomes = value;
    if (value && this.outcomes.length === 0) this.outcomes = [{ name: '' }];
    this.touch();
  }

  protected addOutcome(): void {
    this.outcomes = [...this.outcomes, { name: '' }];
    this.touch();
  }

  protected removeOutcome(index: number): void {
    this.outcomes = this.outcomes.filter((_, i) => i !== index);
    if (this.outcomes.length === 0) this.useOutcomes = false;
    this.touch();
  }

  // Saving

  protected openSave(): void {
    this.saveError.set(null);
    this.saveVisible.set(true);
  }

  protected async onSave(request: SaveRequest): Promise<void> {
    const ok = await this.persist(request);
    if (!ok) return;
    this.saveVisible.set(false);
    this.messages.add({ severity: 'success', summary: 'Form saved', life: 2500 });
    if (request.close) this.close();
  }

  private async persist(request: Omit<SaveRequest, 'close'>): Promise<boolean> {
    const form = this.meta();
    if (!form) return false;
    const fields = toSavedFields(this.fields());
    const outcomes = this.savedOutcomes();
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const saved = await firstValueFrom(
        this.api.saveForm(form.id, {
          reusable: false,
          newVersion: request.newVersion,
          comment: request.comment,
          formImageBase64: renderFormThumbnail(fields, outcomes),
          formRepresentation: {
            ...stripPrivate(form),
            name: request.name,
            key: request.key,
            description: request.description,
            formDefinition: {
              ...form.formDefinition,
              name: request.name,
              key: request.key,
              fields,
              outcomes,
            },
          },
        }),
      );
      // Keep the editor state; only refresh the metadata the header shows.
      this.meta.set({ ...form, ...saved, formDefinition: form.formDefinition });
      this.snapshot.set(this.serialize());
      return true;
    } catch (error) {
      this.saveError.set(errorMessage(error, this.translate.instant('MODEL.SAVE.ERROR')));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.router.navigate(['/forms', this.modelId()]);
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
    this.persist({
      ...this.saveInitial(),
      newVersion: false,
      comment: '',
      forceDmn11: false,
      publish: false,
    }).then((ok) => ok && this.leave.finish(true));
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}
