import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AppConfigService } from './core/config/app-config';
import { LanguageService } from './core/i18n/languages';
import { FlowablePreset } from './core/theme/flowable-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routing keeps the original `#/processes`-style deep links working.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
    }),
    provideOptimus({
      theme: { preset: FlowablePreset, options: { darkModeSelector: '.app-dark' } },
    }),
    MessageService,
    ConfirmationService,
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const language = inject(LanguageService);
      await config.load();
      language.init(config.defaultLanguage);
    }),
  ],
};
