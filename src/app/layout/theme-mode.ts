import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'flowable-modeler.dark';

/** Light/dark mode toggled by the `.app-dark` class the Optimus theme is configured with. */
@Injectable({ providedIn: 'root' })
export class ThemeMode {
  readonly dark = signal(this.initial());

  constructor() {
    this.apply(this.dark());
  }

  toggle(): void {
    this.dark.update((dark) => !dark);
    this.apply(this.dark());
    try {
      localStorage.setItem(STORAGE_KEY, String(this.dark()));
    } catch {
      // Not persisted when storage is unavailable.
    }
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('app-dark', dark);
  }

  private initial(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      // Fall through to the system preference.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
