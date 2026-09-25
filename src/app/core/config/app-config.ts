import { Injectable, signal } from '@angular/core';

/** Runtime configuration, read from `config.json` at startup so one build works against any Flowable UI deployment. */
export interface AppConfig {
  /** Context root of the Flowable UI server, e.g. `/flowable-ui`. Empty string when served from the root. */
  contextRoot: string;
  /** Root of the modeler REST API. Defaults to `{contextRoot}/modeler-app`. */
  modelerRestRoot?: string;
  defaultLanguage?: string;
}

const DEFAULT_CONFIG: AppConfig = { contextRoot: '/flowable-ui', defaultLanguage: 'en' };

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly config = signal<AppConfig>(DEFAULT_CONFIG);

  async load(): Promise<void> {
    try {
      const response = await fetch('config.json', { cache: 'no-store' });
      if (response.ok) {
        this.config.set({ ...DEFAULT_CONFIG, ...((await response.json()) as Partial<AppConfig>) });
      }
    } catch {
      // Keep the defaults when config.json is missing.
    }
  }

  get contextRoot(): string {
    return this.config().contextRoot.replace(/\/$/, '');
  }

  get modelerRestRoot(): string {
    return (this.config().modelerRestRoot ?? `${this.contextRoot}/modeler-app`).replace(/\/$/, '');
  }

  get defaultLanguage(): string {
    return this.config().defaultLanguage ?? 'en';
  }
}
