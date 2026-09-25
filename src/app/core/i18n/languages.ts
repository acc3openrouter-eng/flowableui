import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  label: string;
}

/** The translations shipped with the original Flowable Modeler (public/i18n). */
export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
];

const STORAGE_KEY = 'flowable-modeler.language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal('en');

  init(defaultLanguage: string): void {
    this.translate.setFallbackLang('en');
    this.use(this.stored() ?? this.fromBrowser() ?? defaultLanguage);
  }

  use(code: string): void {
    const language = LANGUAGES.find((l) => l.code === code) ? code : 'en';
    this.translate.use(language);
    this.current.set(language);
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage may be unavailable (private mode); the choice then lasts for this visit only.
    }
  }

  private stored(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private fromBrowser(): string | null {
    const browser = navigator.language;
    return (
      LANGUAGES.find((l) => l.code === browser)?.code ??
      LANGUAGES.find((l) => l.code.split('-')[0] === browser.split('-')[0])?.code ??
      null
    );
  }
}
