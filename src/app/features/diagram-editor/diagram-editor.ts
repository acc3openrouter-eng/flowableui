import {
  Component,
  HostListener,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { Popover, PopoverModule } from '@openng/optimus-ui/popover';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { firstValueFrom, forkJoin } from 'rxjs';
import {
  EditorApi,
  EditorModel,
  EditorSaveRequest,
  SaveConflict,
  ValidationError,
} from '../../core/api/editor-api';
import { errorMessage } from '../../core/api/error-message';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { NOTATIONS, NotationId } from './notations';
import { DiagramCanvas, paletteDrag } from '../../shared/diagram-editor/diagram-canvas';
import { DiagramDocument } from '../../shared/diagram-editor/diagram-document';
import { PropertyPanel } from '../../shared/diagram-editor/properties/property-panel';
import { Stencil, StencilSet } from '../../shared/diagram-editor/stencil-set';
import { StencilIcon } from '../../shared/diagram-editor/stencil-icon';
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

/** Where the original editor points `stencilset.url` when a model has none. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.5;
const MAX_FIT_ZOOM = 1.5;

type ConflictChoice = 'overwrite' | 'newVersion' | 'discard';

/** The BPMN, CMMN and decision service editor: palette, canvas, property panel, toolbar, save and validation. */
@Component({
  selector: 'fm-diagram-editor',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    PopoverModule,
    SkeletonModule,
    TooltipModule,
    DiagramCanvas,
    ModelSaveDialog,
    PropertyPanel,
    StencilIcon,
    UnsavedChangesDialog,
  ],
  templateUrl: './diagram-editor.html',
  styleUrl: './diagram-editor.scss',
})
export class DiagramEditorPage implements HasUnsavedChanges {
  private readonly api = inject(EditorApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  private readonly injector = inject(Injector);

  /** Route parameter. */
  readonly modelId = input.required<string>();
  /** Route data: which kind of diagram this editor edits. */
  readonly notation = input<NotationId>('bpmn');
  protected readonly config = computed(() => NOTATIONS[this.notation()]);

  protected readonly loaded = rxResource({
    params: () => this.modelId(),
    stream: ({ params }) =>
      forkJoin({
        model: this.api.editorJson(params),
        stencils: this.api.stencilSet(this.config().stencilSet),
      }),
  });

  protected readonly meta = signal<EditorModel | null>(null);
  protected readonly doc = signal<DiagramDocument | null>(null);
  protected readonly zoom = signal(1);

  private readonly canvas = viewChild(DiagramCanvas);
  private readonly panel = viewChild(PropertyPanel);
  private readonly morphPopover = viewChild<Popover>('morphPopover');

  protected readonly dirty = computed(() => this.doc()?.dirty() ?? false);
  protected readonly selectionCount = computed(() => this.doc()?.selection().length ?? 0);
  protected readonly selectedNodeCount = computed(() => {
    const doc = this.doc();
    if (!doc) return 0;
    const nodes = doc.state().nodes;
    return doc.selection().filter((id) => nodes[id]).length;
  });

  // Palette

  protected readonly paletteOpen = signal(true);
  protected readonly propertiesOpen = signal(true);
  protected readonly paletteFilter = signal('');
  protected readonly expanded = signal(new Set<string>());
  protected readonly paletteGroups = computed(() => {
    const doc = this.doc();
    if (!doc) return [];
    const text = this.paletteFilter().trim().toLowerCase();
    const groups = doc.stencils.paletteGroups();
    if (!text) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((s) =>
          `${this.translate.instant(s.title)} ${s.id}`.toLowerCase().includes(text),
        ),
      }))
      .filter((g) => g.items.length);
  });

  // Morph menu

  protected readonly morph = signal<{ id: string; options: Stencil[] } | null>(null);

  // Save

  protected readonly saveVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveLabels: SaveDialogLabels = {
    title: 'MODEL.SAVE.TITLE',
    name: 'MODEL.NAME',
    key: 'MODEL.KEY',
    descriptionField: 'MODEL.DESCRIPTION',
  };
  protected readonly saveInitial = computed(() => {
    const meta = this.meta();
    return { name: meta?.name ?? '', key: meta?.key ?? '', description: meta?.description ?? '' };
  });
  /** A save refused because someone else saved first, waiting for the user's choice. */
  protected readonly conflict = signal<{ request: SaveRequest; user: string } | null>(null);
  protected readonly conflictChoice = signal<ConflictChoice | null>(null);
  protected readonly leave = new LeaveConfirmation();

  // Validation

  protected readonly validateVisible = signal(false);
  protected readonly validating = signal(false);
  protected readonly validation = signal<ValidationError[] | null>(null);
  protected readonly validationError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const value = this.loaded.value();
      if (value)
        untracked(() =>
          this.open(value.model, new StencilSet(value.stencils, this.config().profile)),
        );
    });
  }

  private open(model: EditorModel, stencils: StencilSet) {
    const doc = new DiagramDocument(
      stencils,
      model.modelId,
      model.model.stencilset?.url || this.config().stencilsetUrl,
    );
    doc.load(model.model);
    this.meta.set(model);
    this.doc.set(doc);
    this.expanded.set(
      new Set(
        stencils
          .paletteGroups()
          .slice(0, 2)
          .map((g) => g.title),
      ),
    );
    afterNextRender(() => this.canvas()?.focus(), { injector: this.injector });
  }

  // Toolbar

  protected readonly cut = (d: DiagramDocument) => d.copy(true);
  protected readonly copy = (d: DiagramDocument) => d.copy();
  protected readonly paste = (d: DiagramDocument) => d.paste();
  protected readonly remove = (d: DiagramDocument) => d.deleteSelection();
  protected readonly undo = (d: DiagramDocument) => d.undo();
  protected readonly redo = (d: DiagramDocument) => d.redo();
  protected readonly alignVertical = (d: DiagramDocument) => d.align('vertical');
  protected readonly alignHorizontal = (d: DiagramDocument) => d.align('horizontal');
  protected readonly sameSize = (d: DiagramDocument) => d.align('size');

  protected setZoom(value: number) {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100)));
  }

  /** Fits the whole diagram in the visible area, like the original "zoom to fit". */
  protected zoomFit() {
    const box = this.doc()?.contentBox();
    const canvas = this.canvas();
    if (!box || !canvas) return;
    const vp = canvas.viewport();
    const z = Math.min(
      MAX_FIT_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((vp.w - 30) / Math.max(box.w, 1), (vp.h - 30) / Math.max(box.h, 1)),
      ),
    );
    this.zoom.set(Math.floor(z * 100) / 100);
    afterNextRender(
      () => canvas.scrollToPoint({ x: box.x * this.zoom() - 15, y: box.y * this.zoom() - 15 }),
      { injector: this.injector },
    );
  }

  protected run(action: (doc: DiagramDocument) => void) {
    const doc = this.doc();
    if (!doc) return;
    this.panel()?.flush();
    action(doc);
    this.canvas()?.focus();
  }

  // Palette

  protected toggleGroup(title: string) {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  protected paletteDragStart(event: DragEvent, stencil: Stencil) {
    paletteDrag.set({ stencil: stencil.id });
    event.dataTransfer?.setData('text/plain', stencil.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  protected paletteDragEnd() {
    paletteDrag.set(null);
  }

  /** Adds a shape in the middle of the visible area (keyboard and click alternative to dragging). */
  protected addFromPalette(stencil: Stencil) {
    const doc = this.doc();
    const canvas = this.canvas();
    if (!doc || !canvas) return;
    const center = canvas.visibleCenter();
    const target = doc.dropTarget(stencil, center);
    if (!target) {
      this.messages.add({
        severity: 'info',
        summary: `Drag ${this.translate.instant(stencil.title)} onto the element it belongs to.`,
        life: 3000,
      });
      return;
    }
    doc.addNode(stencil.id, center, target.parent?.id ?? null, target.host?.id ?? null);
    canvas.focus();
  }

  // Morph

  protected openMorph(request: { id: string; anchor: HTMLElement }) {
    const doc = this.doc();
    const node = doc?.state().nodes[request.id];
    const stencil = node && doc.stencilOf(node);
    if (!doc || !stencil) return;
    this.morph.set({ id: request.id, options: doc.stencils.morphOptions(stencil) });
    this.morphPopover()?.show(null, request.anchor);
  }

  protected applyMorph(stencil: Stencil) {
    const m = this.morph();
    this.morphPopover()?.hide();
    if (!m) return;
    this.doc()?.morph(m.id, stencil.id);
    this.canvas()?.focus();
  }

  // Validation

  protected validate() {
    const doc = this.doc();
    if (!doc) return;
    this.panel()?.flush();
    this.validation.set(null);
    this.validationError.set(null);
    this.validating.set(true);
    this.validateVisible.set(true);
    this.api.validate(doc.toJson()).subscribe({
      next: (errors) => {
        this.validation.set(errors ?? []);
        this.validating.set(false);
      },
      error: (error) => {
        this.validationError.set(errorMessage(error, 'The model could not be validated.'));
        this.validating.set(false);
      },
    });
  }

  /** Selects the element a validation problem is about. */
  protected goTo(problem: ValidationError) {
    const doc = this.doc();
    if (!doc || !problem.activityId) return;
    const state = doc.state();
    const id =
      state.nodes[problem.activityId] || state.edges[problem.activityId]
        ? problem.activityId
        : [...Object.values(state.nodes), ...Object.values(state.edges)].find(
            (e) => e.properties['overrideid'] === problem.activityId,
          )?.id;
    if (!id) return;
    this.validateVisible.set(false);
    this.canvas()?.reveal(id);
    this.canvas()?.focus();
  }

  // Saving

  protected openSave() {
    this.panel()?.flush();
    this.saveError.set(null);
    this.conflict.set(null);
    this.saveVisible.set(true);
  }

  protected async onSave(request: SaveRequest) {
    const result = await this.persist(request);
    if (result === 'conflict' || !result) return;
    this.saveVisible.set(false);
    this.messages.add({
      severity: 'success',
      summary: `${this.config().typeLabel} saved`,
      life: 2500,
    });
    if (request.close) this.close();
  }

  /** Saves the model; returns 'conflict' when the user has to choose how to resolve a 409. */
  private async persist(
    request: Pick<SaveRequest, 'name' | 'key' | 'description' | 'newVersion' | 'comment'>,
    resolve?: EditorSaveRequest['conflictResolveAction'],
  ): Promise<boolean | 'conflict'> {
    const meta = this.meta();
    const doc = this.doc();
    if (!meta || !doc) return false;
    this.panel()?.flush();
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const saved = await firstValueFrom(
        this.api.save(meta.modelId, {
          json: doc.toJson(),
          name: request.name,
          key: request.key,
          description: request.description,
          newVersion: request.newVersion,
          comment: request.comment,
          lastUpdated: meta.lastUpdated,
          conflictResolveAction: resolve,
        }),
      );
      this.meta.set({
        ...meta,
        name: saved.name ?? request.name,
        key: saved.key ?? request.key,
        description: saved.description ?? request.description,
        lastUpdated: saved.lastUpdated ?? meta.lastUpdated,
      });
      // The server writes these into the stored JSON; mirror them so the model stays clean.
      doc.markSavedWith((draft) => {
        draft.properties[this.config().idProperty] = saved.key ?? request.key;
        draft.properties['name'] = saved.name ?? request.name;
        if (request.description) draft.properties['documentation'] = request.description;
      });
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409 && !resolve) {
        const body = error.error as SaveConflict | null;
        this.conflict.set({
          request: request as SaveRequest,
          user: body?.customData?.userFullName ?? '',
        });
        this.conflictChoice.set(null);
        return 'conflict';
      }
      this.saveError.set(errorMessage(error, this.translate.instant('MODEL.SAVE.ERROR')));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async resolveConflict() {
    const c = this.conflict();
    const choice = this.conflictChoice();
    if (!c || !choice) return;
    if (choice === 'discard') {
      this.conflict.set(null);
      this.saveVisible.set(false);
      this.loaded.reload();
      return;
    }
    const ok = await this.persist(c.request, choice);
    if (ok !== true) return;
    this.conflict.set(null);
    this.saveVisible.set(false);
    this.messages.add({
      severity: 'success',
      summary: `${this.config().typeLabel} saved`,
      life: 2500,
    });
    if (c.request.close) this.close();
  }

  protected close() {
    this.router.navigate([this.config().library, this.modelId()]);
  }

  // Unsaved changes

  canLeave(): boolean | Promise<boolean> {
    this.panel()?.flush();
    return this.dirty() ? this.leave.ask() : true;
  }

  protected resolveLeave(choice: LeaveChoice) {
    if (choice !== 'save') {
      this.leave.finish(choice === 'discard');
      return;
    }
    this.persist({ ...this.saveInitial(), newVersion: false, comment: '' }).then((ok) => {
      if (ok === true) this.leave.finish(true);
      else if (ok === 'conflict') {
        this.leave.finish(false);
        this.saveVisible.set(true);
      }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty()) event.preventDefault();
  }

  /** Ctrl/Cmd+S opens the save dialog (the original swallowed it). */
  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && this.doc()) {
      event.preventDefault();
      if (!this.saveVisible()) this.openSave();
    }
  }
}
