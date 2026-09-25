import { Component, computed, effect, input, model, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { DecisionTableExpression } from '../../core/api/api.types';
import { INPUT_TYPES, OUTPUT_TYPES } from './decision-table-model';

export type ColumnKind = 'input' | 'output';

export interface ColumnValues {
  label: string;
  variableId: string;
  type: string;
  entries: string[];
}

/** Variable ids must be usable in expressions (the original's "variable-identifier" check). */
const VARIABLE_PATTERN = '^[A-Za-z_$][\\w$]*$';

/** Edit or create an input (condition) or output (conclusion) column. */
@Component({
  selector: 'fm-column-dialog',
  imports: [FormsModule, TranslatePipe, ButtonModule, DialogModule, InputTextModule, SelectModule],
  template: `
    <p-dialog
      [header]="prefix() + (kind() === 'input' ? 'INPUT-TITLE' : 'OUTPUT-TITLE') | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <p class="intro">
        {{
          prefix() + (kind() === 'input' ? 'INPUT-DESCRIPTION' : 'OUTPUT-DESCRIPTION') | translate
        }}
      </p>
      <form class="column-form" #f="ngForm" (ngSubmit)="submit()">
        <div class="field">
          <label for="cd-label">{{ prefix() + 'EXPRESSION-LABEL' | translate }}</label>
          <input
            id="cd-label"
            pInputText
            name="label"
            [(ngModel)]="label"
            [placeholder]="prefix() + 'EXPRESSION-PLACEHOLDER' | translate"
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label for="cd-variable">
            {{
              prefix() +
                (kind() === 'input' ? 'EXPRESSION-VARIABLE-NAME' : 'OUTPUT-NEW-VARIABLE-ID')
                | translate
            }}
            <span class="required">*</span>
          </label>
          <input
            id="cd-variable"
            pInputText
            name="variableId"
            [(ngModel)]="variableId"
            required
            [pattern]="kind() === 'output' ? variablePattern : ''"
            [placeholder]="prefix() + 'EXPRESSION-VARIABLE-NAME-PLACEHOLDER' | translate"
            autocomplete="off"
            #variable="ngModel"
          />
          @if (variable.invalid && variable.dirty && variable.value) {
            <small class="invalid"
              >Use letters, digits, "_" or "$", not starting with a digit.</small
            >
          }
        </div>
        <div class="field">
          <label for="cd-type">
            {{
              prefix() +
                (kind() === 'input' ? 'EXPRESSION-VARIABLE-TYPE' : 'OUTPUT-NEW-VARIABLE-TYPE')
                | translate
            }}
            <span class="required">*</span>
          </label>
          <p-select inputId="cd-type" name="type" [options]="types()" [(ngModel)]="type" />
        </div>
        @if (type !== 'collection') {
          <div class="field">
            <span class="label">
              @if (kind() === 'input') {
                {{ prefix() + 'ALLOWED-VALUES' | translate }}
              } @else {
                {{ prefix() + 'OUTPUT-VALUES' | translate }}
                {{
                  prefix() + (ordered() ? 'OUTPUT-VALUES-NOT-OPTIONAL' : 'OUTPUT-VALUES-OPTIONAL')
                    | translate
                }}
              }
            </span>
            <ol class="entries">
              @for (entry of entries; track $index; let i = $index, first = $first, last = $last) {
                <li>
                  <span class="index">{{ i + 1 }}</span>
                  <input
                    pInputText
                    [name]="'entry-' + i"
                    [(ngModel)]="entries[i]"
                    [attr.aria-label]="'Value ' + (i + 1)"
                  />
                  @if (ordered()) {
                    <p-button
                      icon="pi pi-arrow-up"
                      [text]="true"
                      [rounded]="true"
                      size="small"
                      severity="secondary"
                      ariaLabel="Move up"
                      [disabled]="first"
                      (onClick)="move(i, -1)"
                    />
                    <p-button
                      icon="pi pi-arrow-down"
                      [text]="true"
                      [rounded]="true"
                      size="small"
                      severity="secondary"
                      ariaLabel="Move down"
                      [disabled]="last"
                      (onClick)="move(i, 1)"
                    />
                  }
                  <p-button
                    icon="pi pi-times"
                    [text]="true"
                    [rounded]="true"
                    size="small"
                    severity="secondary"
                    ariaLabel="Remove value"
                    (onClick)="entries.splice(i, 1)"
                  />
                </li>
              }
            </ol>
            <div class="add-entry">
              <input
                pInputText
                name="newEntry"
                [(ngModel)]="newEntry"
                placeholder="Add a value and press Enter"
                (keydown.enter)="$event.preventDefault(); addEntry()"
                (blur)="addEntry()"
                aria-label="New value"
              />
            </div>
          </div>
        }
        <button type="submit" hidden></button>
      </form>
      <ng-template #footer>
        <p-button
          [label]="'GENERAL.ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="'GENERAL.ACTION.SAVE' | translate"
          icon="pi pi-check"
          [disabled]="!!f.invalid"
          (onClick)="submit()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .intro {
      margin: 0 0 1rem;
      color: var(--p-text-muted-color);
    }
    .column-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .field > label,
    .field > .label {
      font-weight: 500;
    }
    .required,
    .invalid {
      color: var(--p-red-500);
    }
    .entries {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .entries li {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .entries input {
      flex: 1;
    }
    .index {
      width: 1.5rem;
      text-align: right;
      color: var(--p-text-muted-color);
      font-size: 0.8125rem;
    }
    .add-entry {
      padding-left: 1.875rem;
    }
    .add-entry input {
      width: 100%;
    }
  `,
})
export class ColumnDialog {
  readonly visible = model(false);
  readonly kind = input.required<ColumnKind>();
  /** The column being edited, or null to create one. */
  readonly column = input<DecisionTableExpression | null>(null);
  /** Hit policy of the table; PRIORITY and OUTPUT ORDER use the order of output values. */
  readonly hitPolicy = input<string | undefined>();
  readonly saved = output<ColumnValues>();

  protected readonly prefix = () => 'DECISION-TABLE-EDITOR.POPUP.EXPRESSION-EDITOR.';
  protected readonly variablePattern = VARIABLE_PATTERN;
  protected readonly types = computed(() => (this.kind() === 'input' ? INPUT_TYPES : OUTPUT_TYPES));
  protected readonly ordered = computed(
    () =>
      this.kind() === 'output' &&
      (this.hitPolicy() === 'PRIORITY' || this.hitPolicy() === 'OUTPUT ORDER'),
  );

  protected label = '';
  protected variableId = '';
  protected type = 'string';
  protected entries: string[] = [];
  protected newEntry = '';

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        const column = this.column();
        this.label = column?.label ?? '';
        this.variableId = column?.variableId ?? '';
        this.type = column?.type || this.types()[0];
        this.entries = [...(column?.entries ?? [])];
        this.newEntry = '';
      });
    });
  }

  protected addEntry(): void {
    const value = this.newEntry.trim();
    if (!value) return;
    this.entries.push(value);
    this.newEntry = '';
  }

  protected move(index: number, delta: number): void {
    const [entry] = this.entries.splice(index, 1);
    this.entries.splice(index + delta, 0, entry);
  }

  protected submit(): void {
    this.addEntry();
    const variableId = this.variableId.trim();
    if (!variableId) return;
    if (this.kind() === 'output' && !new RegExp(VARIABLE_PATTERN).test(variableId)) return;
    this.saved.emit({
      label: this.label.trim(),
      variableId,
      type: this.type,
      entries: this.type === 'collection' ? [] : this.entries.map((e) => e.trim()).filter(Boolean),
    });
    this.visible.set(false);
  }
}
