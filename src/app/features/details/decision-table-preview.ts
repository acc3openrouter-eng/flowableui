import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DecisionTableRepresentation } from '../../core/api/api.types';

/** Read-only grid of a decision table: hit policy, input and output columns, and rules. */
@Component({
  selector: 'fm-decision-table-preview',
  imports: [TranslatePipe],
  template: `
    <div class="policy">
      <span>{{ 'DECISION-TABLE.HIT-POLICY' | translate }}</span>
      <strong
        >{{ definition().hitPolicy ?? 'FIRST'
        }}{{
          definition().collectOperator ? ' (' + definition().collectOperator + ')' : ''
        }}</strong
      >
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="index">#</th>
            @for (input of inputs(); track input.id) {
              <th class="input">
                <span class="label">{{ input.label || input.variableId || 'Input' }}</span>
                <span class="sub"
                  >{{ input.variableId }}{{ input.type ? ' · ' + input.type : '' }}</span
                >
              </th>
            }
            @for (output of outputs(); track output.id) {
              <th class="output">
                <span class="label">{{ output.label || output.variableId || 'Output' }}</span>
                <span class="sub"
                  >{{ output.variableId }}{{ output.type ? ' · ' + output.type : '' }}</span
                >
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (rule of rules(); track $index) {
            <tr>
              <td class="index">{{ $index + 1 }}</td>
              @for (input of inputs(); track input.id) {
                <td>
                  @if (rule[input.id + '_operator'] || rule[input.id + '_expression']) {
                    <code
                      >{{ rule[input.id + '_operator'] }} {{ rule[input.id + '_expression'] }}</code
                    >
                  } @else {
                    <span class="any">-</span>
                  }
                </td>
              }
              @for (output of outputs(); track output.id) {
                <td class="output-cell">
                  <code>{{ rule[output.id] }}</code>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="empty" [attr.colspan]="1 + inputs().length + outputs().length">
                No rules defined yet.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    .policy {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      margin-bottom: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .policy strong {
      color: var(--p-text-color);
    }
    .scroll {
      overflow-x: auto;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.875rem;
    }
    th,
    td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--p-content-border-color);
      text-align: left;
      white-space: nowrap;
    }
    th {
      vertical-align: bottom;
    }
    th.input {
      background: color-mix(in srgb, var(--p-primary-500) 10%, transparent);
    }
    th.output {
      background: color-mix(in srgb, var(--p-green-500) 12%, transparent);
    }
    .label {
      display: block;
      font-weight: 600;
    }
    .sub {
      display: block;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--p-text-muted-color);
    }
    .index {
      width: 2.5rem;
      color: var(--p-text-muted-color);
      text-align: center;
    }
    .any,
    .empty {
      color: var(--p-text-muted-color);
    }
    .empty {
      text-align: center;
      padding: 2rem;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
  `,
})
export class DecisionTablePreview {
  readonly table = input.required<DecisionTableRepresentation>();

  protected readonly definition = computed(() => this.table().decisionTableDefinition ?? {});
  protected readonly inputs = computed(() => this.definition().inputExpressions ?? []);
  protected readonly outputs = computed(() => this.definition().outputExpressions ?? []);
  protected readonly rules = computed(() => this.definition().rules ?? []);
}
