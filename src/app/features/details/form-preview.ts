import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TagModule } from '@openng/optimus-ui/tag';
import { FormField, FormRepresentation } from '../../core/api/api.types';

interface Row {
  field: FormField;
  depth: number;
}

/** Read-only outline of a form's fields and outcomes. */
@Component({
  selector: 'fm-form-preview',
  imports: [TranslatePipe, TagModule],
  template: `
    @if (rows().length === 0) {
      <p class="empty">This form has no fields yet.</p>
    } @else {
      <ul class="fields">
        @for (row of rows(); track row.field.id + $index) {
          <li [style.padding-left.rem]="1 + row.depth * 1.5" [class.container]="!!row.field.fields">
            <div class="name">
              {{ row.field.name || row.field.id }}
              @if (row.field.required) {
                <span class="required" aria-label="required">*</span>
              }
            </div>
            <div class="meta">
              <code>{{ row.field.id }}</code>
              <p-tag [value]="row.field.type" severity="secondary" />
              @if (row.field.readOnly) {
                <p-tag value="read-only" severity="warn" />
              }
            </div>
          </li>
        }
      </ul>
    }
    @if (outcomes().length) {
      <h3>{{ 'FORM-BUILDER.TITLE.OUTCOME' | translate }}</h3>
      <div class="outcomes">
        @for (outcome of outcomes(); track $index) {
          <span class="outcome">{{ outcome.name }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    .empty {
      color: var(--p-text-muted-color);
      text-align: center;
      padding: 2rem;
    }
    .fields {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg);
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
    }
    li + li {
      border-top: 1px solid var(--p-content-border-color);
    }
    li.container {
      background: var(--p-surface-50);
      font-weight: 600;
    }
    :host-context(.app-dark) li.container {
      background: var(--p-surface-800);
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    code {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    .required {
      color: var(--p-red-500);
      margin-left: 0.125rem;
    }
    h3 {
      font-size: 0.9375rem;
      margin: 1.5rem 0 0.75rem;
    }
    .outcomes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .outcome {
      padding: 0.375rem 0.875rem;
      border-radius: var(--p-border-radius-md);
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-weight: 500;
    }
  `,
})
export class FormPreview {
  readonly form = input.required<FormRepresentation>();

  protected readonly rows = computed(() => {
    const rows: Row[] = [];
    const walk = (fields: FormField[] | undefined, depth: number) => {
      for (const field of fields ?? []) {
        rows.push({ field, depth });
        if (field.fields) {
          for (const column of Object.values(field.fields)) walk(column, depth + 1);
        }
      }
    };
    walk(this.form().formDefinition?.fields, 0);
    return rows;
  });

  protected readonly outcomes = computed(() => this.form().formDefinition?.outcomes ?? []);
}
