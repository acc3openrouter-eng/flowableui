import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { MessageModule } from '@openng/optimus-ui/message';

export type LeaveChoice = 'discard' | 'save' | 'continue';

/** Pending "leave the editor?" question, resolved by the dialog below. */
export class LeaveConfirmation {
  readonly visible = signal(false);
  private resolver: ((leave: boolean) => void) | null = null;

  ask(): Promise<boolean> {
    this.visible.set(true);
    return new Promise<boolean>((resolve) => (this.resolver = resolve));
  }

  finish(leave: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.visible.set(false);
    resolve?.(leave);
  }

  /** Closing the dialog with Escape or the close icon means "continue editing". */
  dismissed(): void {
    if (this.resolver) this.finish(false);
  }
}

/** The original "You have unsaved changes" popup: discard, continue editing, or save. */
@Component({
  selector: 'fm-unsaved-changes-dialog',
  imports: [TranslatePipe, ButtonModule, DialogModule, MessageModule],
  template: `
    <p-dialog
      [header]="'EDITOR.POPUP.UNSAVED-CHANGES.TITLE' | translate"
      [visible]="confirmation().visible()"
      (visibleChange)="!$event && confirmation().dismissed()"
      [modal]="true"
      [draggable]="false"
      [closable]="!saving()"
      [style]="{ width: '30rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <p>{{ 'EDITOR.POPUP.UNSAVED-CHANGES.DESCRIPTION' | translate }}</p>
      @if (error()) {
        <p-message severity="error">{{ error() }}</p-message>
      }
      <ng-template #footer>
        <p-button
          [label]="'EDITOR.POPUP.UNSAVED-CHANGES.ACTION.DISCARD' | translate"
          severity="danger"
          [text]="true"
          [disabled]="saving()"
          (onClick)="choose.emit('discard')"
        />
        <p-button
          [label]="'EDITOR.POPUP.UNSAVED-CHANGES.ACTION.CONTINUE' | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="saving()"
          (onClick)="choose.emit('continue')"
        />
        <p-button
          [label]="'EDITOR.POPUP.UNSAVED-CHANGES.ACTION.SAVE' | translate"
          icon="pi pi-save"
          [loading]="saving()"
          (onClick)="choose.emit('save')"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class UnsavedChangesDialog {
  readonly confirmation = input.required<LeaveConfirmation>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly choose = output<LeaveChoice>();
}
