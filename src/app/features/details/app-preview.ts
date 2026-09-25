import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AppDefinitionRepresentation, ModelType } from '../../core/api/api.types';
import { AppTile } from '../../shared/app-look/app-tile';

/** The models an app definition bundles, plus its icon, theme and access settings. */
@Component({
  selector: 'fm-app-preview',
  imports: [RouterLink, TranslatePipe, AppTile],
  template: `
    <fm-app-tile
      [name]="app().name"
      [description]="app().description"
      [icon]="definition().icon"
      [theme]="definition().theme"
    />
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
}
