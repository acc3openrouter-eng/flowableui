import { Component, effect, untracked, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { MessageModule } from '@openng/optimus-ui/message';
import { ApiUrls } from '../../core/api/api-urls';
import { ModelRepresentation } from '../../core/api/api.types';
import { errorMessage } from '../../core/api/error-message';
import { ModelsApi } from '../../core/api/models-api';
import { ModelKind } from './model-kinds';

@Component({
  selector: 'fm-import-model-dialog',
  imports: [FormsModule, TranslatePipe, ButtonModule, CheckboxModule, DialogModule, MessageModule],
  template: `
    <p-dialog
      [header]="kind().itemI18n + '.POPUP.IMPORT-TITLE' | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <p class="description">{{ kind().itemI18n + '.POPUP.IMPORT-DESCRIPTION' | translate }}</p>
      <label
        class="dropzone"
        [class.active]="dragging()"
        (dragover)="$event.preventDefault(); dragging.set(true)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <i class="pi pi-cloud-upload"></i>
        @if (file(); as f) {
          <strong>{{ f.name }}</strong>
          <span>{{ (f.size / 1024).toFixed(1) }} KB</span>
        } @else {
          <strong>{{ kind().itemI18n + '.POPUP.IMPORT.DROPZONE' | translate }}</strong>
          <span>{{ kind().importAccept }}</span>
        }
        <input type="file" [accept]="kind().importAccept ?? ''" (change)="onPick($event)" hidden />
      </label>
      @if (kind().importRenewsIdmIds) {
        <label class="renew">
          <p-checkbox [(ngModel)]="renewIdmIds" [binary]="true" />
          <span>{{ kind().itemI18n + '.POPUP.IMPORT.RENEWIDM-IDS' | translate }}</span>
        </label>
      }
      @if (error()) {
        <p-message severity="error" styleClass="mt-3">
          {{ kind().itemI18n + '.POPUP.IMPORT.ERROR' | translate }}: {{ error() }}
        </p-message>
      }
      <ng-template #footer>
        <p-button
          [label]="'GENERAL.ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="kind().importLabel ?? '' | translate"
          icon="pi pi-upload"
          [loading]="uploading()"
          [disabled]="!file() || uploading()"
          (onClick)="upload()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .description {
      margin: 0 0 1rem;
      color: var(--p-text-muted-color);
    }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
      padding: 2rem 1rem;
      border: 2px dashed var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg);
      cursor: pointer;
      text-align: center;
      transition:
        border-color 0.15s,
        background 0.15s;
    }
    .dropzone:hover,
    .dropzone.active {
      border-color: var(--p-primary-color);
      background: var(--p-highlight-background);
    }
    .dropzone i {
      font-size: 2rem;
      color: var(--p-primary-color);
    }
    .dropzone span {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .renew {
      display: flex;
      gap: 0.625rem;
      align-items: flex-start;
      margin-top: 1rem;
      font-size: 0.875rem;
      line-height: 1.4;
    }
  `,
})
export class ImportModelDialog {
  private readonly api = inject(ModelsApi);
  private readonly urls = inject(ApiUrls);

  readonly kind = input.required<ModelKind>();
  readonly visible = model(false);
  readonly imported = output<ModelRepresentation>();

  protected readonly file = signal<File | null>(null);
  protected renewIdmIds = false;
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Reset as soon as the dialog opens (not on its show animation, which ends after fast typists start typing).
    effect(() => {
      if (this.visible()) untracked(() => this.reset());
    });
  }

  protected reset(): void {
    this.file.set(null);
    this.renewIdmIds = false;
    this.error.set(null);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.file.set(event.dataTransfer?.files[0] ?? null);
  }

  protected upload(): void {
    const file = this.file();
    const importUrl = this.kind().importUrl;
    if (!file || !importUrl) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.import(importUrl(this.urls, { renewIdmIds: this.renewIdmIds }), file).subscribe({
      next: (model) => {
        this.uploading.set(false);
        this.visible.set(false);
        this.imported.emit(model);
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
