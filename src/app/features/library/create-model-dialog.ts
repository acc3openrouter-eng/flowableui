import {
  Component,
  effect,
  untracked,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { ModelRepresentation } from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { MODEL_KEY_PATTERN, suggestKey } from './model-key';
import { ModelKind } from './model-kinds';

/** Create a new model, or duplicate `source` when it is set. */
@Component({
  selector: 'fm-create-model-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    TextareaModule,
  ],
  template: `
    <p-dialog
      [header]="
        kind().itemI18n + (source() ? '.POPUP.DUPLICATE-TITLE' : '.POPUP.CREATE-TITLE') | translate
      "
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <p class="description">
        {{
          kind().itemI18n +
            (source() ? '.POPUP.DUPLICATE-DESCRIPTION' : '.POPUP.CREATE-DESCRIPTION') | translate
        }}
      </p>
      <form id="create-model-form" class="form" (ngSubmit)="submit()">
        <label class="field">
          <span>{{ kind().itemI18n + '.NAME' | translate }} *</span>
          <input
            pInputText
            name="name"
            [ngModel]="name()"
            (ngModelChange)="onName($event)"
            required
            autofocus
          />
        </label>
        <label class="field">
          <span>{{ kind().itemI18n + '.KEY' | translate }} *</span>
          <input
            pInputText
            name="key"
            [ngModel]="key()"
            (ngModelChange)="onKey($event)"
            required
            [invalid]="!!key() && !keyValid()"
          />
          @if (key() && !keyValid()) {
            <small class="error"
              >Use letters, digits, "_", "-" or "."; start with a letter or "_".</small
            >
          }
        </label>
        <label class="field">
          <span>{{ kind().itemI18n + '.DESCRIPTION' | translate }}</span>
          <textarea pTextarea name="description" rows="3" [(ngModel)]="description"></textarea>
        </label>
        @if (error()) {
          <p-message severity="error" [text]="error()!" />
        }
        <!-- Lets Enter submit the form; the visible button lives in the dialog footer. -->
        <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
      </form>
      <ng-template #footer>
        <p-button
          [label]="'GENERAL.ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="
            (source() ? kind().itemI18n + '.ACTION.DUPLICATE-CONFIRM' : 'GENERAL.ACTION.SAVE')
              | translate
          "
          [loading]="saving()"
          [disabled]="!canSave()"
          (onClick)="submit()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .description {
      margin: 0 0 1rem;
      color: var(--p-text-muted-color);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      font-weight: 500;
    }
    .field input,
    .field textarea {
      width: 100%;
      font-weight: 400;
    }
    .error {
      color: var(--p-red-500);
      font-weight: 400;
    }
  `,
})
export class CreateModelDialog {
  private readonly api = inject(ModelsApi);

  readonly kind = input.required<ModelKind>();
  /** Model to duplicate; null creates a blank model. */
  readonly source = input<ModelRepresentation | null>(null);
  readonly visible = model(false);
  readonly created = output<ModelRepresentation>();

  protected readonly name = signal('');
  protected readonly key = signal('');
  protected description = '';
  private keyEdited = false;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly keyValid = computed(() => MODEL_KEY_PATTERN.test(this.key()));
  protected readonly canSave = computed(
    () => !!this.name().trim() && this.keyValid() && !this.saving(),
  );

  constructor() {
    // Reset as soon as the dialog opens (not on its show animation, which ends after fast typists start typing).
    effect(() => {
      if (this.visible()) untracked(() => this.reset());
    });
  }

  protected reset(): void {
    const source = this.source();
    this.name.set(source ? source.name : '');
    this.key.set(source ? source.key : '');
    this.description = source?.description ?? '';
    this.keyEdited = !!source;
    this.error.set(null);
  }

  protected onName(name: string): void {
    this.name.set(name);
    if (!this.keyEdited) this.key.set(suggestKey(name));
  }

  protected onKey(key: string): void {
    this.key.set(key);
    this.keyEdited = true;
  }

  protected submit(): void {
    if (!this.canSave()) return;
    const body = {
      name: this.name().trim(),
      key: this.key().trim(),
      description: this.description,
      modelType: this.kind().modelType,
    };
    const source = this.source();
    this.saving.set(true);
    this.error.set(null);
    (source ? this.api.duplicate(source.id, body) : this.api.create(body)).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.visible.set(false);
        this.created.emit(created);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
