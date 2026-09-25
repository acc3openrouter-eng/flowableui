import { Component, effect, input, model, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { MODEL_KEY_PATTERN } from '../../features/library/model-key';

export interface SaveRequest {
  name: string;
  key: string;
  description: string;
  newVersion: boolean;
  comment: string;
  /** Only sent for decision tables. */
  forceDmn11: boolean;
  /** Only for app definitions: publish after saving. */
  publish: boolean;
  close: boolean;
}

/** Translation keys for one model type's save dialog. */
export interface SaveDialogLabels {
  title: string;
  description?: string;
  name: string;
  key: string;
  descriptionField: string;
}

export interface SaveDialogInitial {
  name: string;
  key: string;
  description: string;
  forceDmn11?: boolean;
}

/** Editor save dialog: name, key, description, new version and comment (plus "Force DMN 1.1" for decision tables). */
@Component({
  selector: 'fm-model-save-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    TextareaModule,
  ],
  template: `
    <p-dialog
      [header]="labels().title | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [closable]="!saving()"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      @if (labels().description) {
        <p class="intro">{{ labels().description! | translate }}</p>
      }
      <form class="save-form" (ngSubmit)="submit(false)" #f="ngForm">
        <div class="field">
          <label for="fs-name">{{ labels().name | translate }}</label>
          <input
            id="fs-name"
            pInputText
            name="name"
            [(ngModel)]="name"
            required
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label for="fs-key">{{ labels().key | translate }}</label>
          <input
            id="fs-key"
            pInputText
            name="key"
            [(ngModel)]="key"
            required
            [pattern]="keyPattern"
            autocomplete="off"
            #keyInput="ngModel"
          />
          @if (keyInput.invalid && keyInput.dirty) {
            <small class="invalid"
              >Use letters, digits, "_", "-" or "." and start with a letter.</small
            >
          }
        </div>
        <div class="field">
          <label for="fs-description">{{ labels().descriptionField | translate }}</label>
          <textarea
            id="fs-description"
            pTextarea
            rows="3"
            name="description"
            [(ngModel)]="description"
          ></textarea>
        </div>
        @if (showNewVersion()) {
          <label class="check">
            <p-checkbox [binary]="true" name="newVersion" [(ngModel)]="newVersion" />
            {{ 'MODEL.SAVE.NEWVERSION' | translate }}
          </label>
        }
        @if (showPublish()) {
          <label class="check">
            <p-checkbox [binary]="true" name="publish" [(ngModel)]="publish" />
            {{ 'APP.POPUP.PUBLISH-FIELD' | translate }}
          </label>
        }
        @if (showForceDmn11()) {
          <label class="check">
            <p-checkbox [binary]="true" name="forceDmn11" [(ngModel)]="forceDmn11" />
            {{ 'DECISION-TABLE.POPUP.FORCE-DMN-11' | translate }}
          </label>
        }
        @if (newVersion) {
          <div class="field">
            <label for="fs-comment">{{ 'MODEL.SAVE.COMMENT' | translate }}</label>
            <textarea
              id="fs-comment"
              pTextarea
              rows="2"
              name="comment"
              [(ngModel)]="comment"
            ></textarea>
          </div>
        }
        @if (warning()) {
          <p-message severity="warn">{{ warning()! | translate }}</p-message>
        }
        @if (error()) {
          <p-message severity="error">{{ error() }}</p-message>
        }
        <button type="submit" hidden></button>
      </form>
      <ng-template #footer>
        <p-button
          [label]="'GENERAL.ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          [disabled]="saving()"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="'GENERAL.ACTION.SAVE' | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="f.invalid || saving()"
          (onClick)="submit(false)"
        />
        <p-button
          [label]="'ACTION.SAVE-AND-CLOSE' | translate"
          icon="pi pi-check"
          [loading]="saving()"
          [disabled]="f.invalid || saving()"
          (onClick)="submit(true)"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .intro {
      margin: 0 0 1rem;
      color: var(--p-text-muted-color);
    }
    .save-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .field label {
      font-weight: 500;
    }
    .invalid {
      color: var(--p-red-500);
    }
    .check {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      line-height: 1.4;
      cursor: pointer;
    }
  `,
})
export class ModelSaveDialog {
  readonly visible = model(false);
  readonly labels = input.required<SaveDialogLabels>();
  readonly initial = input.required<SaveDialogInitial>();
  readonly showForceDmn11 = input(false);
  /** App definitions are saved in place, without versions or comments. */
  readonly showNewVersion = input(true);
  readonly showPublish = input(false);
  /** Translation key of a non-blocking warning shown above the buttons. */
  readonly warning = input<string | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly save = output<SaveRequest>();

  protected readonly keyPattern = MODEL_KEY_PATTERN.source;
  protected name = '';
  protected key = '';
  protected description = '';
  protected newVersion = false;
  protected comment = '';
  protected forceDmn11 = false;
  protected publish = false;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        const initial = this.initial();
        this.name = initial.name;
        this.key = initial.key;
        this.description = initial.description;
        this.newVersion = false;
        this.comment = '';
        this.forceDmn11 = !!initial.forceDmn11;
        this.publish = false;
      });
    });
  }

  protected submit(close: boolean): void {
    if (!this.name.trim() || !this.key.trim() || this.saving()) return;
    this.save.emit({
      name: this.name.trim(),
      key: this.key.trim(),
      description: this.description,
      newVersion: this.newVersion,
      comment: this.newVersion ? this.comment : '',
      forceDmn11: this.forceDmn11,
      publish: this.showPublish() && this.publish,
      close,
    });
  }
}
