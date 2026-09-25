import { CanDeactivateFn } from '@angular/router';

/** Implemented by editors that can hold unsaved changes. */
export interface HasUnsavedChanges {
  /** Returns true to leave now, or asks the user (discard, save, continue editing). */
  canLeave(): boolean | Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component?.canLeave ? component.canLeave() : true;
