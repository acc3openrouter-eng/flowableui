import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EditorField } from './form-field-types';

/** Non-interactive look of a field on the design canvas. */
@Component({
  selector: 'fm-field-preview',
  imports: [TranslatePipe],
  template: `
    @let f = field();
    @switch (f.type) {
      @case ('spacer') {
        <div class="spacer" aria-hidden="true"></div>
      }
      @case ('horizontal-line') {
        <hr />
      }
      @case ('headline') {
        <h3>{{ f.name }}</h3>
      }
      @case ('headline-with-line') {
        <h3 class="with-line">{{ f.name }}</h3>
      }
      @case ('expression') {
        <p class="expression" [class]="'size-' + (f.params?.['size'] ?? '')">
          @if (f.expression) {
            {{ f.expression }}
          } @else {
            <em>{{ 'FORM-BUILDER.MESSAGE.EMPTY-EXPRESSION' | translate }}</em>
          }
        </p>
      }
      @case ('hyperlink') {
        <span class="link"><i class="pi pi-link"></i> {{ f.name }}</span>
      }
      @case ('boolean') {
        <span class="checkbox-row">
          <span class="box"></span>
          {{ f.name }}
          @if (f.required) {
            <span class="required">*</span>
          }
        </span>
      }
      @default {
        <span class="label">
          {{ f.name }}
          @if (f.required) {
            <span class="required">*</span>
          }
        </span>
        @switch (f.type) {
          @case ('radio-buttons') {
            <div class="radios">
              @if (f.optionsExpression) {
                <code>{{ f.optionsExpression }}</code>
              }
              @for (option of f.options ?? []; track $index) {
                <span class="radio-row">
                  <span class="dot" [class.on]="f.value === option.name"></span>{{ option.name }}
                </span>
              }
            </div>
          }
          @case ('multi-line-text') {
            <div class="control tall">{{ f.placeholder }}</div>
          }
          @case ('upload') {
            <div class="control upload">
              <i class="pi pi-upload"></i>
              {{ f.params?.['multiple'] ? 'Upload files' : 'Upload a file' }}
            </div>
          }
          @default {
            <div class="control">
              <span class="placeholder">{{
                f.placeholder ||
                  (f.type === 'dropdown' ? (f.optionsExpression ?? f.value) : '') ||
                  (f.type === 'people' ? ('FORM-BUILDER.LABEL.PERSON' | translate) : '') ||
                  (f.type === 'functional-group'
                    ? ('FORM-BUILDER.LABEL.FUNCTIONAL-GROUP' | translate)
                    : '')
              }}</span>
              @switch (f.type) {
                @case ('date') {
                  <i class="pi pi-calendar"></i>
                }
                @case ('dropdown') {
                  <i class="pi pi-chevron-down"></i>
                }
                @case ('people') {
                  <i class="pi pi-user"></i>
                }
                @case ('functional-group') {
                  <i class="pi pi-users"></i>
                }
                @case ('password') {
                  <i class="pi pi-lock"></i>
                }
                @case ('integer') {
                  <i class="pi pi-hashtag"></i>
                }
                @case ('decimal') {
                  <i class="pi pi-percentage"></i>
                }
              }
            </div>
          }
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 0;
    }
    .label {
      font-weight: 500;
      font-size: 0.875rem;
    }
    .required {
      color: var(--p-red-500);
      margin-left: 0.125rem;
    }
    .control {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      min-height: 2.5rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--p-form-field-border-color);
      border-radius: var(--p-form-field-border-radius, 6px);
      background: var(--p-form-field-background);
      color: var(--p-form-field-placeholder-color);
      font-size: 0.875rem;
    }
    .control i {
      color: var(--p-text-muted-color);
    }
    .control.tall {
      min-height: 4.5rem;
      align-items: flex-start;
    }
    .control.upload {
      justify-content: center;
      border-style: dashed;
    }
    .placeholder {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .spacer {
      height: 1.5rem;
      background: repeating-linear-gradient(
        -45deg,
        transparent 0 6px,
        var(--p-content-border-color) 6px 7px
      );
      border-radius: 4px;
      opacity: 0.6;
    }
    hr {
      width: 100%;
      border: 0;
      border-top: 1px solid var(--p-text-muted-color);
      margin: 0.5rem 0;
    }
    h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }
    h3.with-line {
      padding-bottom: 0.375rem;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    .expression {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .expression em {
      color: var(--p-text-muted-color);
    }
    .size-1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .size-2 {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .size-3 {
      font-size: 1.125rem;
    }
    .size-5 {
      font-size: 0.8125rem;
    }
    .link {
      color: var(--p-primary-color);
      text-decoration: underline;
    }
    .checkbox-row,
    .radio-row {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    .radios {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .box,
    .dot {
      width: 1.125rem;
      height: 1.125rem;
      border: 1px solid var(--p-form-field-border-color);
      background: var(--p-form-field-background);
      border-radius: 4px;
      flex-shrink: 0;
    }
    .dot {
      border-radius: 50%;
    }
    .dot.on {
      border: 5px solid var(--p-primary-color);
    }
    code {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class FieldPreview {
  readonly field = input.required<EditorField>();
  /** Changes whenever the field is edited in place, so the preview re-renders. */
  readonly rev = input(0);
}
