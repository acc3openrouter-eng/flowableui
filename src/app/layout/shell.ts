import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem } from '@openng/optimus-ui/api';
import { AvatarModule } from '@openng/optimus-ui/avatar';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MenuModule } from '@openng/optimus-ui/menu';
import { AccountService } from '../core/auth/account';
import { LANGUAGES, LanguageService } from '../core/i18n/languages';
import { ThemeMode } from './theme-mode';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  /** Extra routes that highlight the item (e.g. decision services under Decisions). */
  also?: string[];
}

@Component({
  selector: 'fm-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    AvatarModule,
    ButtonModule,
    MenuModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly account = inject(AccountService);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeMode);
  private readonly translate = inject(TranslateService);

  protected readonly nav: NavItem[] = [
    { label: 'GENERAL.NAVIGATION.PROCESSES', icon: 'pi pi-sitemap', link: '/processes' },
    { label: 'GENERAL.NAVIGATION.CASEMODELS', icon: 'pi pi-briefcase', link: '/casemodels' },
    { label: 'GENERAL.NAVIGATION.FORMS', icon: 'pi pi-file-edit', link: '/forms' },
    {
      label: 'GENERAL.NAVIGATION.DECISIONS',
      icon: 'pi pi-table',
      link: '/decision-tables',
      also: ['/decision-services'],
    },
    { label: 'GENERAL.NAVIGATION.APPS', icon: 'pi pi-th-large', link: '/apps' },
  ];

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected isAlsoActive(item: NavItem): boolean {
    const url = this.url();
    return (item.also ?? []).some((link) => url.startsWith(link));
  }

  protected readonly initials = computed(() => {
    const name = this.account.displayName();
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });

  protected readonly userMenu = computed<MenuItem[]>(() => {
    // Re-evaluated when the language changes so labels are translated.
    const current = this.language.current();
    return [
      {
        label: this.account.displayName(),
        items: [
          ...LANGUAGES.map((l) => ({
            label: l.label,
            icon: l.code === current ? 'pi pi-check' : 'pi pi-blank',
            command: () => this.language.use(l.code),
          })),
          { separator: true },
          {
            label: this.translate.instant('GENERAL.ACTION.LOGOUT'),
            icon: 'pi pi-sign-out',
            command: () => this.account.logout(),
          },
        ],
      },
    ];
  });
}
