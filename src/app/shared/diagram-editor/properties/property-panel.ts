import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { DiagramDocument } from '../diagram-document';
import { DiagramElement } from '../diagram-model';
import { StencilProperty } from '../stencil-set';
import { truthy } from '../stencil-view';
import { AssignmentDialog } from './assignment-dialog';
import { FlowOrderDialog } from './flow-order-dialog';
import {
  PropertyEditor,
  Row,
  Summary,
  complexValue,
  editorFor,
  summarize,
} from './property-editors';
import { ReferenceDialog } from './reference-dialog';
import { RowsDialog } from './rows-dialog';

interface PanelRow {
  /** Element the row edits (null: the diagram), fixed when the row is built. An input that
   * loses focus because another element was clicked still writes to its own element. */
  owner: string | null;
  /** Unique per element and property, so inputs are rebuilt when the selection changes. */
  track: string;
  prop: StencilProperty;
  editor: PropertyEditor;
  value: unknown;
  summary: Summary;
}

/** Removes HTML tags, as the original string editor does before saving. */
export const stripTags = (value: string) => value.replace(/(<([^>]+)>)/gi, '');

/** Text of a condition value (a plain string or `{expression: {staticValue}}`). */
export function conditionText(value: unknown): string {
  const v = complexValue(value);
  if (typeof v === 'string') return v;
  return String(((v as Row | null)?.['expression'] as Row | undefined)?.['staticValue'] ?? '');
}

/**
 * The property sheet of the selected element, or of the process when nothing is selected.
 * Simple properties are edited inline; complex ones open a dialog.
 */
@Component({
  selector: 'fm-property-panel',
  // Which element the rows belong to (lets tests wait for a selection to reach the panel).
  host: { '[attr.data-element]': 'element()?.id ?? null' },
  imports: [
    FormsModule,
    TranslatePipe,
    CheckboxModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    AssignmentDialog,
    FlowOrderDialog,
    ReferenceDialog,
    RowsDialog,
  ],
  templateUrl: './property-panel.html',
  styleUrl: './property-panel.scss',
})
export class PropertyPanel implements OnDestroy {
  private readonly translate = inject(TranslateService);

  readonly doc = input.required<DiagramDocument>();
  /** Shown as the title when the element has no name. */
  readonly modelName = input('');
  /** Shown above the title when nothing is selected. */
  readonly rootLabel = input('Process');
  /** Shown instead of the root's properties when they cannot be edited here. */
  readonly rootNote = input<string | null>(null);

  protected readonly filter = signal('');

  /** The single selected element, or null for the process itself. */
  protected readonly element = computed<DiagramElement | null>(() => {
    const selected = this.doc().selectedElements();
    return selected.length === 1 ? selected[0] : null;
  });
  protected readonly multiple = computed(() => this.doc().selectedElements().length > 1);

  protected readonly stencil = computed(() => {
    const el = this.element();
    return el ? this.doc().stencilOf(el) : this.doc().stencils.rootStencil;
  });

  private readonly properties = computed(() => {
    const el = this.element();
    if (el)
      return (
        this.doc().state().nodes[el.id]?.properties ?? this.doc().state().edges[el.id]?.properties
      );
    return this.doc().state().properties;
  });

  protected readonly title = computed(() => {
    const name = String(this.properties()?.['name'] ?? '').trim();
    // The model name stands for the root only; an unnamed element shows just its kind.
    return this.element() ? name : name || this.modelName();
  });

  protected readonly rows = computed<PanelRow[]>(() => {
    const stencil = this.stencil();
    const props = this.properties() ?? {};
    const owner = this.element()?.id ?? 'process';
    const out: PanelRow[] = [];
    for (const prop of stencil?.properties ?? []) {
      if (prop.hidden) continue;
      const editor = editorFor(prop.key, prop.type);
      if (!editor) continue;
      const value = props[prop.key];
      out.push({
        owner: this.element()?.id ?? null,
        track: `${owner}:${prop.key}`,
        prop,
        editor,
        value,
        summary: summarize(editor, value),
      });
    }
    return out;
  });

  protected readonly shown = computed(() => {
    const text = this.filter().trim().toLowerCase();
    if (!text) return this.rows();
    return this.rows().filter((r) =>
      `${this.translate.instant(r.prop.title)} ${r.prop.key}`.toLowerCase().includes(text),
    );
  });

  /** Options of a signal/message/escalation reference: the definitions on the process. */
  protected definitionOptions(definitions: string) {
    const list = complexValue(this.doc().state().properties[definitions]);
    const rows = Array.isArray(list) ? (list as Row[]) : [];
    return [
      { value: '', label: '' },
      ...rows
        .filter((r) => r['id'])
        .map((r) => ({ value: String(r['id']), label: String(r['name'] || r['id']) })),
    ];
  }

  /** Plan items a timer listener can start on: every plan item in the case except itself. */
  protected readonly planItemOptions = computed(() => {
    const doc = this.doc();
    const self = this.element()?.id;
    const items = Object.values(doc.state().nodes)
      .filter((n) => n.id !== self && !n.host && n.stencil !== 'CasePlanModel')
      .filter((n) => {
        const stencil = doc.stencils.stencil(n.stencil);
        return !!stencil && !doc.stencils.isBoundaryEvent(stencil);
      })
      .map((n) => ({ value: n.id, label: stripTags(String(n.properties['name'] ?? '')) || n.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: '' }, ...items];
  });

  protected planItemId(value: unknown): string {
    const v = complexValue(value) as Row | null;
    return v && typeof v === 'object' ? String(v['id'] ?? '') : '';
  }

  protected setPlanItem(row: PanelRow, id: string) {
    const option = this.planItemOptions().find((o) => o.value === id);
    this.set(row, id && option ? { id, name: option.label } : '');
  }

  // Inline edits: kept here until blur/Enter, and flushed if the selection changes first.
  private pending: { elementId: string | null; key: string; value: unknown } | null = null;

  /** The complex property whose dialog is open. */
  protected readonly dialog = signal<{ row: PanelRow; elementId: string | null } | null>(null);
  protected readonly dialogVisible = signal(false);

  constructor() {
    effect(() => {
      this.element();
      untracked(() => this.flush());
    });
  }

  ngOnDestroy() {
    this.flush();
  }

  protected edit(row: PanelRow, value: unknown) {
    this.pending = { elementId: row.owner, key: row.prop.key, value };
  }

  /** Writes a pending inline edit. */
  flush() {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    this.write(p.elementId, p.key, p.value);
  }

  protected commitString(row: PanelRow, value: string) {
    this.pending = null;
    this.write(row.owner, row.prop.key, stripTags(value));
  }

  protected commitText(row: PanelRow, value: string) {
    this.pending = null;
    this.write(row.owner, row.prop.key, value);
  }

  protected commitCondition(value: string, row: PanelRow) {
    this.pending = null;
    const text = value.trim() ? value : '';
    this.write(
      row.owner,
      row.prop.key,
      text ? { expression: { type: 'static', staticValue: value } } : null,
    );
  }

  protected set(row: PanelRow, value: unknown) {
    this.write(row.owner, row.prop.key, value);
  }

  private write(elementId: string | null, key: string, value: unknown) {
    const doc = this.doc();
    const state = doc.state();
    const current = elementId
      ? (state.nodes[elementId]?.properties ?? state.edges[elementId]?.properties)
      : state.properties;
    if (!current) return;
    if (JSON.stringify(current[key] ?? null) === JSON.stringify(value ?? null)) return;
    doc.setProperty(elementId, key, value);
  }

  protected onEnter(event: Event) {
    event.preventDefault();
    (event.target as HTMLElement).blur();
  }

  protected isTrue = truthy;
  protected conditionText = conditionText;

  protected open(row: PanelRow) {
    this.flush();
    this.dialog.set({ row, elementId: row.owner });
    this.dialogVisible.set(true);
  }

  protected saveDialog(value: unknown) {
    const d = this.dialog();
    if (!d) return;
    this.write(d.elementId, d.row.prop.key, value);
  }

  protected summaryText(s: Summary): string {
    return s.text ?? this.translate.instant(s.key, s.params);
  }
}
