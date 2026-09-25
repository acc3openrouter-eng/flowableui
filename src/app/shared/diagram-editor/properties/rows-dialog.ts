import {
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MultiSelectModule } from '@openng/optimus-ui/multiselect';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FieldDef, ListDef, Row, listRows, listValue } from './property-editors';

/**
 * Master-detail editor for list properties (listeners, fields, parameters, definitions...):
 * rows on the left, the selected row's fields on the right, and an optional nested list.
 */
@Component({
  selector: 'fm-rows-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
  ],
  template: `
    <p-dialog
      [header]="title() | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '60rem' }"
      [breakpoints]="{ '960px': '96vw' }"
      [contentStyle]="{ 'min-height': '22rem' }"
    >
      @let d = def();
      @let r = revision();
      <div class="layout">
        <section class="list">
          <div class="list-actions">
            <p-button
              icon="pi pi-plus"
              [label]="'ACTION.ADD' | translate"
              size="small"
              [text]="true"
              (onClick)="add()"
            />
            <span class="spacer"></span>
            <p-button
              icon="pi pi-arrow-up"
              size="small"
              [text]="true"
              [disabled]="selected() <= 0"
              [pTooltip]="'ACTION.MOVE.UP' | translate"
              [ariaLabel]="'ACTION.MOVE.UP' | translate"
              (onClick)="move(-1)"
            />
            <p-button
              icon="pi pi-arrow-down"
              size="small"
              [text]="true"
              [disabled]="selected() < 0 || selected() >= rows().length - 1"
              [pTooltip]="'ACTION.MOVE.DOWN' | translate"
              [ariaLabel]="'ACTION.MOVE.DOWN' | translate"
              (onClick)="move(1)"
            />
            <p-button
              icon="pi pi-trash"
              size="small"
              severity="danger"
              [text]="true"
              [disabled]="selected() < 0"
              [pTooltip]="'ACTION.REMOVE' | translate"
              [ariaLabel]="'ACTION.REMOVE' | translate"
              (onClick)="remove()"
            />
          </div>
          <table class="grid" role="grid">
            <thead>
              <tr>
                @for (c of d.columns; track c.key) {
                  <th>{{ c.label | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index) {
                <tr
                  [class.selected]="$index === selected()"
                  [attr.aria-selected]="$index === selected()"
                  tabindex="0"
                  (click)="selected.set($index)"
                  (keydown.enter)="selected.set($index)"
                >
                  @for (c of d.columns; track c.key) {
                    <td>{{ cell(row, c.key, r) }}</td>
                  }
                </tr>
              } @empty {
                <tr class="empty">
                  <td [attr.colspan]="d.columns.length">{{ d.emptyText | translate }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <section class="detail">
          @if (current(); as row) {
            @for (f of d.fields; track f.key) {
              @if (!f.showIf || f.showIf(row)) {
                <div class="field" [class.check]="f.type === 'checkbox'">
                  @switch (f.type) {
                    @case ('checkbox') {
                      <p-checkbox
                        [inputId]="'rf-' + f.key"
                        [binary]="true"
                        [ngModel]="!!row[f.key]"
                        [disabled]="!!f.disabledIf && f.disabledIf(row)"
                        (ngModelChange)="set(row, f, $event)"
                      />
                      <label [for]="'rf-' + f.key">{{ f.label | translate }}</label>
                    }
                    @case ('select') {
                      <label [for]="'rf-' + f.key">{{ f.label | translate }}</label>
                      <p-select
                        [inputId]="'rf-' + f.key"
                        [options]="f.options ?? []"
                        optionLabel="label"
                        optionValue="value"
                        [ngModel]="row[f.key]"
                        (ngModelChange)="set(row, f, $event)"
                        appendTo="body"
                      >
                        <ng-template #item let-o>{{ o.label | translate }}</ng-template>
                        <ng-template #selectedItem let-o>{{ o?.label | translate }}</ng-template>
                      </p-select>
                    }
                    @case ('multiselect') {
                      <label [for]="'rf-' + f.key">{{ f.label | translate }}</label>
                      <p-multiselect
                        [inputId]="'rf-' + f.key"
                        [options]="f.options ?? []"
                        optionLabel="label"
                        optionValue="value"
                        [filter]="true"
                        display="chip"
                        [ngModel]="row[f.key]"
                        (ngModelChange)="set(row, f, $event)"
                        appendTo="body"
                      />
                    }
                    @case ('textarea') {
                      <label [for]="'rf-' + f.key">{{ f.label | translate }}</label>
                      <textarea
                        pTextarea
                        [id]="'rf-' + f.key"
                        rows="3"
                        [ngModel]="row[f.key] ?? ''"
                        (ngModelChange)="set(row, f, $event)"
                      ></textarea>
                    }
                    @default {
                      <label [for]="'rf-' + f.key">{{ f.label | translate }}</label>
                      <input
                        pInputText
                        [id]="'rf-' + f.key"
                        autocomplete="off"
                        [ngModel]="row[f.key] ?? ''"
                        (ngModelChange)="set(row, f, $event)"
                      />
                    }
                  }
                </div>
              }
            }
            @if (d.nested; as n) {
              @if (!n.showIf || n.showIf(row)) {
                @let nestedRows = nested(row, n.key, r);
                <div class="nested">
                  <div class="nested-head">
                    <strong>{{ n.title | translate }}</strong>
                    <p-button
                      icon="pi pi-plus"
                      size="small"
                      [text]="true"
                      [label]="'ACTION.ADD' | translate"
                      (onClick)="addNested(row, n.key, n.def)"
                    />
                  </div>
                  <table class="grid inline">
                    <thead>
                      <tr>
                        @for (f of n.def.fields; track f.key) {
                          <th>{{ f.label | translate }}</th>
                        }
                        <th class="actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of nestedRows; track $index) {
                        <tr>
                          @for (f of n.def.fields; track f.key) {
                            <td>
                              @if (f.type === 'select') {
                                <select
                                  class="native"
                                  [attr.aria-label]="f.label | translate"
                                  [ngModel]="item[f.key]"
                                  (ngModelChange)="setNested(item, f.key, $event)"
                                >
                                  @for (o of f.options ?? []; track o.value) {
                                    <option [value]="o.value">{{ o.label | translate }}</option>
                                  }
                                </select>
                              } @else {
                                <input
                                  pInputText
                                  class="p-inputtext-sm"
                                  [attr.aria-label]="f.label | translate"
                                  [ngModel]="item[f.key] ?? ''"
                                  (ngModelChange)="setNested(item, f.key, $event)"
                                />
                              }
                            </td>
                          }
                          <td class="actions">
                            <p-button
                              icon="pi pi-times"
                              size="small"
                              [text]="true"
                              severity="secondary"
                              [ariaLabel]="'ACTION.REMOVE' | translate"
                              (onClick)="removeNested(row, n.key, $index)"
                            />
                          </td>
                        </tr>
                      } @empty {
                        <tr class="empty">
                          <td [attr.colspan]="n.def.fields.length + 1">
                            {{ n.def.emptyText | translate }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
          } @else {
            <p class="none">{{ d.emptyText | translate }}</p>
          }
        </section>
      </div>
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
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: 1.25rem;
    }
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .list-actions {
      display: flex;
      align-items: center;
      gap: 0.125rem;
      margin-bottom: 0.25rem;
    }
    .spacer {
      flex: 1;
    }
    .grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .grid th {
      text-align: left;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--p-text-muted-color);
      padding: 0.375rem 0.5rem;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    .grid td {
      padding: 0.5rem;
      border-bottom: 1px solid var(--p-content-border-color);
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grid tbody tr:not(.empty) {
      cursor: pointer;
    }
    .grid tbody tr:not(.empty):hover {
      background: var(--p-content-hover-background);
    }
    .grid tr.selected {
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent) !important;
    }
    .grid tr.empty td {
      color: var(--p-text-muted-color);
      text-align: center;
      padding: 1.5rem 0.5rem;
    }
    .grid.inline td {
      padding: 0.25rem;
      max-width: none;
    }
    .grid.inline tbody tr {
      cursor: default;
    }
    .grid.inline input,
    .grid.inline select {
      width: 100%;
    }
    .grid .actions {
      width: 2.5rem;
    }
    .native {
      height: 2rem;
      padding: 0 0.375rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-md);
      background: var(--p-content-background);
      color: var(--p-text-color);
      font: inherit;
    }
    .detail {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      padding: 1rem;
      border-radius: var(--p-border-radius-lg);
      background: var(--p-surface-50);
    }
    :host-context(.app-dark) .detail {
      background: var(--p-surface-900);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .field.check {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
    }
    .field label {
      font-size: 0.875rem;
      font-weight: 500;
    }
    .field input,
    .field textarea,
    .field p-select,
    .field p-multiselect {
      width: 100%;
    }
    .nested {
      border-top: 1px solid var(--p-content-border-color);
      padding-top: 0.75rem;
    }
    .nested-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .none {
      color: var(--p-text-muted-color);
      text-align: center;
      margin: auto;
    }
  `,
})
export class RowsDialog {
  readonly visible = model(false);
  readonly title = input('');
  readonly def = input.required<ListDef>();
  readonly value = input<unknown>(null);
  readonly save = output<unknown>();

  protected readonly rows = signal<Row[]>([]);
  protected readonly selected = signal(-1);
  /** Bumped on in-place edits so the list re-reads cell text. */
  protected readonly revision = signal(0);
  protected readonly current = computed(() => {
    this.revision();
    return this.rows()[this.selected()] ?? null;
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        const def = this.def();
        const rows = structuredClone(listRows(def, this.value())).map((r) =>
          def.load ? def.load(r) : r,
        );
        this.rows.set(rows);
        this.selected.set(rows.length ? 0 : -1);
      });
    });
  }

  protected cell(row: Row, key: string, _rev: number): string {
    const v = row[key];
    return Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  }

  protected nested(row: Row, key: string, _rev: number): Row[] {
    const v = row[key];
    return Array.isArray(v) ? (v as Row[]) : [];
  }

  protected set(row: Row, field: FieldDef, value: unknown) {
    row[field.key] = value;
    this.def().onChange?.(row, field.key);
    if (this.def().clean && 'implementation' in row) {
      Object.assign(row, { implementation: this.def().clean!({ ...row })['implementation'] });
    }
    this.revision.update((r) => r + 1);
  }

  protected setNested(item: Row, key: string, value: unknown) {
    item[key] = value;
    this.revision.update((r) => r + 1);
  }

  protected add() {
    const row = this.def().newRow(this.rows());
    this.rows.update((rows) => [...rows, row]);
    this.selected.set(this.rows().length - 1);
  }

  protected remove() {
    const index = this.selected();
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
    this.selected.set(Math.min(index, this.rows().length - 1));
  }

  protected move(delta: number) {
    const index = this.selected();
    const target = index + delta;
    this.rows.update((rows) => {
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    this.selected.set(target);
  }

  protected addNested(row: Row, key: string, def: ListDef) {
    const list = Array.isArray(row[key]) ? (row[key] as Row[]) : [];
    row[key] = [...list, def.newRow(list)];
    this.revision.update((r) => r + 1);
  }

  protected removeNested(row: Row, key: string, index: number) {
    row[key] = (row[key] as Row[]).filter((_, i) => i !== index);
    this.revision.update((r) => r + 1);
  }

  protected apply() {
    const def = this.def();
    const rows = this.rows().map((r) => {
      let row = def.clean ? def.clean({ ...r }) : { ...r };
      if (def.nested && Array.isArray(row[def.nested.key])) {
        const n = def.nested.def;
        row = {
          ...row,
          [def.nested.key]: (row[def.nested.key] as Row[]).map((x) =>
            n.clean ? n.clean({ ...x }) : x,
          ),
        };
      }
      return row;
    });
    this.save.emit(listValue(def, rows));
    this.visible.set(false);
  }
}
