import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { MenuItem, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { MenuModule } from '@openng/optimus-ui/menu';
import { MessageModule } from '@openng/optimus-ui/message';
import { SelectModule } from '@openng/optimus-ui/select';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  DecisionTableDefinition,
  DecisionTableExpression,
  DecisionTableRepresentation,
  DecisionTableRule,
} from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
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
import { ColumnDialog, ColumnKind, ColumnValues } from './column-dialog';
import {
  COLLECT_OPERATORS,
  HIT_POLICIES,
  cleanRules,
  defaultRule,
  expressionKey,
  hitPolicyBadge,
  isCustomExpression,
  isDash,
  isListOperator,
  newExpression,
  normalizeDefinition,
  operatorDisabled,
  operatorKey,
  operatorsFor,
  validateDefinition,
} from './decision-table-model';
import { renderDecisionTableThumbnail } from './decision-table-thumbnail';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'fm-decision-table-editor',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    MenuModule,
    MessageModule,
    SelectModule,
    SkeletonModule,
    TooltipModule,
    ColumnDialog,
    ModelSaveDialog,
    UnsavedChangesDialog,
  ],
  templateUrl: './decision-table-editor.html',
  styleUrl: './decision-table-editor.scss',
})
export class DecisionTableEditor implements HasUnsavedChanges {
  private readonly api = inject(ModelsApi);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  /** Route parameter. */
  readonly modelId = input.required<string>();

  protected readonly table = rxResource({
    params: () => this.modelId(),
    stream: ({ params }) => this.api.decisionTable(params),
  });

  protected readonly meta = signal<DecisionTableRepresentation | null>(null);
  protected readonly def = signal<DecisionTableDefinition | null>(null);
  protected readonly selectedRow = signal<number | null>(null);

  /** Bumped on every in-place edit so the dirty flag refreshes. */
  protected readonly revision = signal(0);
  private readonly snapshot = signal('');
  protected readonly dirty = computed(() => {
    this.revision();
    const def = this.def();
    const snapshot = this.snapshot();
    return !!def && !!snapshot && snapshot !== this.serialize(def);
  });

  protected readonly inputs = computed(() => {
    this.revision();
    return this.def()?.inputExpressions ?? [];
  });
  protected readonly outputs = computed(() => {
    this.revision();
    return this.def()?.outputExpressions ?? [];
  });
  protected readonly rules = computed(() => {
    this.revision();
    return this.def()?.rules ?? [];
  });
  protected readonly badge = computed(() => {
    this.revision();
    const def = this.def();
    return def ? hitPolicyBadge(def) : '';
  });

  // Helpers used by the template.
  protected readonly operatorKey = operatorKey;
  protected readonly expressionKey = expressionKey;
  protected readonly operatorsFor = operatorsFor;
  protected readonly operatorDisabled = operatorDisabled;

  // Dialogs
  protected readonly columnVisible = signal(false);
  protected readonly columnKind = signal<ColumnKind>('input');
  protected readonly columnEditing = signal<DecisionTableExpression | null>(null);
  private columnInsertAt = 0;

  protected readonly hitPolicyVisible = signal(false);
  protected readonly hitPolicies = HIT_POLICIES;
  protected readonly collectOperators = Object.keys(COLLECT_OPERATORS);
  protected hitPolicyDraft = 'FIRST';
  protected collectOperatorDraft: string | null = null;

  protected readonly saveVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly leave = new LeaveConfirmation();
  protected readonly saveLabels: SaveDialogLabels = {
    title: 'DECISION-TABLE.POPUP.SAVE-DECISION-TABLE-TITLE',
    description: 'DECISION-TABLE.POPUP.SAVE-DESCRIPTION',
    name: 'DECISION-TABLE.NAME',
    key: 'DECISION-TABLE.KEY',
    descriptionField: 'DECISION-TABLE.DESCRIPTION',
  };
  protected readonly saveInitial = computed(() => {
    const meta = this.meta();
    return {
      name: meta?.name ?? '',
      key: meta?.key ?? '',
      description: meta?.description ?? '',
      forceDmn11: !!this.def()?.forceDMN11,
    };
  });
  protected readonly saveWarning = computed(() => {
    this.revision();
    const def = this.def();
    return def && validateDefinition(def).length
      ? 'DECISION-TABLE-EDITOR.ALERT.EXPRESSION-VARIABLE-REQUIRED-ERROR'
      : null;
  });

  protected rowMenu: MenuItem[] = [];

  constructor() {
    effect(() => {
      const table = this.table.value();
      if (table) untracked(() => this.load(table));
    });
  }

  private load(table: DecisionTableRepresentation): void {
    const def = normalizeDefinition(table.decisionTableDefinition);
    this.meta.set(table);
    this.def.set(def);
    this.selectedRow.set(null);
    this.snapshot.set(this.serialize(def));
  }

  private serialize(def: DecisionTableDefinition): string {
    return JSON.stringify({ ...def, rules: cleanRules(def) });
  }

  protected touch(): void {
    this.revision.update((r) => r + 1);
  }

  // Cells

  protected operatorOptions(input: DecisionTableExpression, current: string | null): string[] {
    const options = operatorsFor(input.type);
    return current && !options.includes(current) ? [current, ...options] : options;
  }

  protected inputChoices(input: DecisionTableExpression): string[] | null {
    if (input.entries?.length) return [...input.entries, '-'];
    if (input.type === 'boolean') return ['true', 'false', '-'];
    return null;
  }

  protected outputChoices(output: DecisionTableExpression): string[] | null {
    if (output.entries?.length) return ['', ...output.entries];
    if (output.type === 'boolean') return ['', 'true', 'false'];
    return null;
  }

  /** Adds the current value to a choice list if it is not in it (for tables edited elsewhere). */
  protected withCurrent(choices: string[], current: string | null | undefined): string[] {
    return current && !choices.includes(current) ? [...choices, current] : choices;
  }

  protected setOperator(rule: DecisionTableRule, input: DecisionTableExpression, value: string) {
    rule[operatorKey(input)] = value;
    this.touch();
  }

  protected setCondition(rule: DecisionTableRule, input: DecisionTableExpression, value: string) {
    const opKey = operatorKey(input);
    rule[expressionKey(input)] = value;
    // Same behavior as the original: "any" and custom expressions don't use an operator.
    if (!isListOperator(rule[opKey])) {
      if (isDash(value) || isCustomExpression(value)) rule[opKey] = null;
      else if (!rule[opKey]) rule[opKey] = '==';
    }
    this.touch();
  }

  protected setConclusion(rule: DecisionTableRule, output: DecisionTableExpression, value: string) {
    rule[output.id] = value;
    this.touch();
  }

  /** Light validation for typed cells; invalid cells are highlighted, not blocked. */
  protected invalidCell(
    type: string | null | undefined,
    value: string | null | undefined,
  ): boolean {
    if (!value || isDash(value) || isCustomExpression(value)) return false;
    if (type === 'number') {
      return value
        .split(',')
        .map((v) => v.trim().replace(/^"|"$/g, ''))
        .some((v) => v === '' || Number.isNaN(Number(v)));
    }
    if (type === 'date') {
      return value
        .split(',')
        .map((v) => v.trim().replace(/^"|"$/g, ''))
        .some((v) => !DATE_PATTERN.test(v));
    }
    return false;
  }

  // Rules

  protected selectRow(index: number): void {
    this.selectedRow.set(index);
  }

  protected addRule(index = this.rules().length): void {
    const def = this.def();
    if (!def) return;
    def.rules = [...(def.rules ?? [])];
    def.rules.splice(index, 0, defaultRule(def));
    this.selectedRow.set(index);
    this.touch();
  }

  protected moveRule(index: number, delta: number): void {
    const rules = this.def()?.rules;
    const target = index + delta;
    if (!rules || target < 0 || target >= rules.length) return;
    const [rule] = rules.splice(index, 1);
    rules.splice(target, 0, rule);
    this.selectedRow.set(target);
    this.touch();
  }

  protected clearRule(index: number): void {
    const def = this.def();
    if (!def?.rules) return;
    def.rules[index] = defaultRule(def);
    this.touch();
  }

  protected removeRule(index: number): void {
    const rules = this.def()?.rules;
    if (!rules || rules.length <= 1) return;
    rules.splice(index, 1);
    this.selectedRow.set(Math.min(index, rules.length - 1));
    this.touch();
  }

  protected openRowMenu(event: Event, index: number, menu: { toggle: (e: Event) => void }): void {
    this.selectRow(index);
    const count = this.rules().length;
    const t = (key: string) => this.translate.instant(key);
    this.rowMenu = [
      { label: 'Insert rule above', icon: 'pi pi-arrow-up', command: () => this.addRule(index) },
      {
        label: 'Insert rule below',
        icon: 'pi pi-arrow-down',
        command: () => this.addRule(index + 1),
      },
      { separator: true },
      {
        label: t('DECISION-TABLE-EDITOR.BUTTON-MOVE-RULE-UPWARDS-LABEL'),
        icon: 'pi pi-angle-up',
        disabled: index === 0,
        command: () => this.moveRule(index, -1),
      },
      {
        label: t('DECISION-TABLE-EDITOR.BUTTON-MOVE-RULE-DOWNWARDS-LABEL'),
        icon: 'pi pi-angle-down',
        disabled: index === count - 1,
        command: () => this.moveRule(index, 1),
      },
      { separator: true },
      { label: 'Clear rule', icon: 'pi pi-eraser', command: () => this.clearRule(index) },
      {
        label: t('DECISION-TABLE-EDITOR.BUTTON-REMOVE-RULE-LABEL'),
        icon: 'pi pi-trash',
        disabled: count <= 1,
        styleClass: 'danger',
        command: () => this.removeRule(index),
      },
    ];
    menu.toggle(event);
  }

  // Columns

  protected openColumn(kind: ColumnKind, column: DecisionTableExpression | null, insertAt = 0) {
    this.columnKind.set(kind);
    this.columnEditing.set(column);
    this.columnInsertAt = insertAt;
    this.columnVisible.set(true);
  }

  protected onColumnSaved(values: ColumnValues): void {
    const def = this.def();
    if (!def) return;
    const editing = this.columnEditing();
    if (editing) {
      Object.assign(editing, values);
    } else if (this.columnKind() === 'input') {
      const column = newExpression(def, values);
      def.inputExpressions = [...(def.inputExpressions ?? [])];
      def.inputExpressions.splice(this.columnInsertAt, 0, column);
      for (const rule of def.rules ?? []) {
        rule[operatorKey(column)] = '==';
        rule[expressionKey(column)] = '-';
      }
    } else {
      const column = newExpression(def, values);
      def.outputExpressions = [...(def.outputExpressions ?? [])];
      def.outputExpressions.splice(this.columnInsertAt, 0, column);
      for (const rule of def.rules ?? []) rule[column.id] = '';
    }
    this.touch();
  }

  protected removeColumn(kind: ColumnKind, column: DecisionTableExpression): void {
    const def = this.def();
    if (!def) return;
    if (kind === 'input') {
      if ((def.inputExpressions?.length ?? 0) <= 1) return;
      def.inputExpressions = def.inputExpressions!.filter((c) => c !== column);
      for (const rule of def.rules ?? []) {
        delete rule[operatorKey(column)];
        delete rule[expressionKey(column)];
      }
    } else {
      if ((def.outputExpressions?.length ?? 0) <= 1) return;
      def.outputExpressions = def.outputExpressions!.filter((c) => c !== column);
      for (const rule of def.rules ?? []) delete rule[column.id];
    }
    this.touch();
  }

  // Hit policy

  protected openHitPolicy(): void {
    const def = this.def();
    this.hitPolicyDraft = def?.hitIndicator || 'FIRST';
    this.collectOperatorDraft = def?.collectOperator ?? null;
    this.hitPolicyVisible.set(true);
  }

  protected saveHitPolicy(): void {
    const def = this.def();
    if (!def) return;
    def.hitIndicator = this.hitPolicyDraft;
    def.collectOperator = this.hitPolicyDraft === 'COLLECT' ? this.collectOperatorDraft : undefined;
    if (def.collectOperator === undefined) delete def.collectOperator;
    this.hitPolicyVisible.set(false);
    this.touch();
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
      summary: this.translate.instant('DECISION-TABLE-EDITOR.ALERT.SAVE-CONFIRM', {
        name: request.name,
      }),
      life: 2500,
    });
    if (request.close) this.close();
  }

  private async persist(request: Omit<SaveRequest, 'close'>): Promise<boolean> {
    const meta = this.meta();
    const def = this.def();
    if (!meta || !def) return false;
    const definition: DecisionTableDefinition = {
      ...structuredClone(def),
      name: request.name,
      key: request.key,
      description: request.description,
      rules: cleanRules(def),
      forceDMN11: request.forceDmn11,
    };
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const saved = await firstValueFrom(
        this.api.saveDecisionTable(meta.id, {
          reusable: false,
          newVersion: request.newVersion,
          comment: request.comment,
          decisionTableImageBase64: renderDecisionTableThumbnail(definition),
          decisionTableRepresentation: {
            name: request.name,
            key: request.key,
            description: request.description,
            decisionTableDefinition: definition,
          },
        }),
      );
      def.forceDMN11 = request.forceDmn11;
      this.meta.set({ ...meta, ...saved, decisionTableDefinition: meta.decisionTableDefinition });
      this.snapshot.set(this.serialize(def));
      this.touch();
      return true;
    } catch (error) {
      this.saveError.set(errorMessage(error, this.translate.instant('MODEL.SAVE.ERROR')));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.router.navigate(['/decision-tables', this.modelId()]);
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
      forceDmn11: !!this.def()?.forceDMN11,
      publish: false,
      newVersion: false,
      comment: '',
    }).then((ok) => ok && this.leave.finish(true));
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}
