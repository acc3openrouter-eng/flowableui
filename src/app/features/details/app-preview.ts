import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppDefinitionRepresentation, ModelType } from '../../core/api/api.types';

/** The models an app definition bundles, plus its icon, theme and access settings. */
@Component({
  selector: 'fm-app-preview',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="app-tile" [attr.data-theme]="definition().theme ?? 'theme-1'">
      <i [class]="'pi ' + iconClass()"></i>
      <strong>{{ app().name }}</strong>
    </div>
    <h3>{{ 'APP.DETAILS.MODELS-TITLE' | translate }}</h3>
    @if (models().length === 0) {
      <p class="empty">{{ 'APP.DETAILS.NO-MODELS-SELECTED' | translate }}</p>
    } @else {
      <ul class="models">
        @for (m of models(); track m.id) {
          <li>
            <i [class]="m.cmmn ? 'pi pi-briefcase' : 'pi pi-sitemap'"></i>
            <a [routerLink]="[m.cmmn ? '/casemodels' : '/processes', m.id]">{{ m.name }}</a>
            @if (m.version) {
              <span class="version">v{{ m.version }}</span>
            }
          </li>
        }
      </ul>
    }
    @if (definition().usersAccess || definition().groupsAccess) {
      <dl>
        @if (definition().usersAccess) {
          <dt>{{ 'APP.USERS-ACCESS' | translate }}</dt>
          <dd>{{ definition().usersAccess }}</dd>
        }
        @if (definition().groupsAccess) {
          <dt>{{ 'APP.GROUPS-ACCESS' | translate }}</dt>
          <dd>{{ definition().groupsAccess }}</dd>
        }
      </dl>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1.25rem;
    }
    .app-tile {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 11rem;
      height: 9rem;
      border-radius: 1rem;
      color: #fff;
      background: linear-gradient(135deg, var(--p-primary-400), var(--p-primary-700));
    }
    .app-tile i {
      font-size: 2rem;
    }
    .app-tile[data-theme='theme-2'] {
      background: linear-gradient(135deg, #34d399, #047857);
    }
    .app-tile[data-theme='theme-3'] {
      background: linear-gradient(135deg, #fbbf24, #b45309);
    }
    .app-tile[data-theme='theme-4'] {
      background: linear-gradient(135deg, #f87171, #b91c1c);
    }
    .app-tile[data-theme='theme-5'] {
      background: linear-gradient(135deg, #a78bfa, #6d28d9);
    }
    .app-tile[data-theme='theme-6'] {
      background: linear-gradient(135deg, #94a3b8, #334155);
    }
    .app-tile[data-theme='theme-7'] {
      background: linear-gradient(135deg, #f472b6, #be185d);
    }
    .app-tile[data-theme='theme-8'] {
      background: linear-gradient(135deg, #2dd4bf, #0f766e);
    }
    .app-tile[data-theme='theme-9'] {
      background: linear-gradient(135deg, #fb923c, #c2410c);
    }
    .app-tile[data-theme='theme-10'] {
      background: linear-gradient(135deg, #818cf8, #4338ca);
    }
    h3 {
      font-size: 0.9375rem;
      margin: 1.5rem 0 0.75rem;
    }
    .empty {
      color: var(--p-text-muted-color);
    }
    .models {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    .models li {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-md);
    }
    .models i {
      color: var(--p-primary-color);
    }
    .version {
      margin-left: auto;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.375rem 1rem;
      margin-top: 1.5rem;
    }
    dt {
      color: var(--p-text-muted-color);
    }
    dd {
      margin: 0;
    }
  `,
})
export class AppPreview {
  readonly app = input.required<AppDefinitionRepresentation>();

  protected readonly definition = computed(() => this.app().definition ?? {});
  protected readonly models = computed(() => [
    ...(this.definition().models ?? []).map((m) => ({
      ...m,
      cmmn: m.modelType === ModelType.Cmmn,
    })),
    ...(this.definition().cmmnModels ?? []).map((m) => ({ ...m, cmmn: true })),
  ]);
  /** The original stores Glyphicons names (`glyphicon-asterisk`); map the common ones, default to a grid. */
  protected readonly iconClass = computed(() => {
    const icon = this.definition().icon ?? '';
    const map: Record<string, string> = {
      'glyphicon-asterisk': 'pi-asterisk',
      'glyphicon-user': 'pi-user',
      'glyphicon-heart': 'pi-heart',
      'glyphicon-star': 'pi-star',
      'glyphicon-envelope': 'pi-envelope',
      'glyphicon-cloud': 'pi-cloud',
      'glyphicon-shopping-cart': 'pi-shopping-cart',
      'glyphicon-briefcase': 'pi-briefcase',
      'glyphicon-calendar': 'pi-calendar',
      'glyphicon-folder-open': 'pi-folder-open',
      'glyphicon-cog': 'pi-cog',
      'glyphicon-home': 'pi-home',
    };
    return map[icon] ?? 'pi-th-large';
  });
}
