import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
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

export type ModelFormMode = 'create' | 'duplicate' | 'edit';

/** Only these model types have their own edit texts; the rest reuse the process ones, like the original app. */
const HAS_EDIT_TEXTS = new Set(['PROCESS', 'CASE', 'FORM']);

/** Name, key and description of a model: create a new one, duplicate `source`, or edit `source` in place. */
@Component({
  selector: 'fm-model-form-dialog',
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
      [header]="texts().title | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      @if (texts().description; as description) {
        <p class="description">{{ description | translate }}</p>
      }
      <form class="form" (ngSubmit)="submit()">
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
          [label]="texts().confirm | translate"
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
export class ModelFormDialog {
  private readonly api = inject(ModelsApi);

  readonly kind = input.required<ModelKind>();
  readonly mode = input<ModelFormMode>('create');
  /** The model to duplicate or edit. */
  readonly source = input<ModelRepresentation | null>(null);
  readonly visible = model(false);
  readonly saved = output<ModelRepresentation>();

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

  protected readonly texts = computed(() => {
    const item = this.kind().itemI18n;
    switch (this.mode()) {
      case 'duplicate':
        return {
          title: `${item}.POPUP.DUPLICATE-TITLE`,
          description: `${item}.POPUP.DUPLICATE-DESCRIPTION`,
          confirm: 'PROCESS.ACTION.DUPLICATE-CONFIRM',
        };
      case 'edit': {
        const texts = HAS_EDIT_TEXTS.has(item) ? item : 'PROCESS';
        return {
          title: `${texts}.POPUP.EDIT-TITLE`,
          description: `${texts}.POPUP.EDIT-DESCRIPTION`,
          confirm: 'GENERAL.ACTION.SAVE',
        };
      }
      default:
        return {
          title: `${item}.POPUP.CREATE-TITLE`,
          description: `${item}.POPUP.CREATE-DESCRIPTION`,
          confirm: 'GENERAL.ACTION.SAVE',
        };
    }
  });

  constructor() {
    // Reset as soon as the dialog opens (not on its show animation, which ends after fast typists start typing).
    effect(() => {
      if (this.visible()) untracked(() => this.reset());
    });
  }

  protected reset(): void {
    const source = this.mode() === 'create' ? null : this.source();
    this.name.set(source?.name ?? '');
    this.key.set(source?.key ?? '');
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
    const request =
      this.mode() === 'edit' && source
        ? this.api.update(source.id, {
            name: body.name,
            key: body.key,
            description: body.description,
          })
        : this.mode() === 'duplicate' && source
          ? this.api.duplicate(source.id, body)
          : this.api.create(body);
    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.visible.set(false);
        this.saved.emit(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
