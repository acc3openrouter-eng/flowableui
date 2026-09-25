import { Component, computed, input } from '@angular/core';
import { appIconClass, appThemeBackground } from './app-look';

/** The colored app tile the Flowable Task app shows on its landing page. */
@Component({
  selector: 'fm-app-tile',
  template: `
    <div class="tile" [style.background]="background()">
      <i [class]="iconClass()" class="backdrop" aria-hidden="true"></i>
      <i [class]="iconClass()" class="logo" aria-hidden="true"></i>
      <strong>{{ name() }}</strong>
      @if (description()) {
        <span class="description">{{ description() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .tile {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 0.25rem;
      width: var(--fm-app-tile-width, 11rem);
      height: var(--fm-app-tile-height, 9rem);
      padding: 1rem;
      border-radius: 1rem;
      color: #fff;
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
    }
    .backdrop {
      position: absolute;
      right: -0.75rem;
      bottom: -1rem;
      font-size: 6.5rem;
      opacity: 0.15;
    }
    .logo {
      position: absolute;
      top: 1rem;
      left: 1rem;
      font-size: 1.5rem;
    }
    strong {
      position: relative;
      font-size: 1rem;
      overflow-wrap: anywhere;
    }
    .description {
      position: relative;
      font-size: 0.75rem;
      opacity: 0.9;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class AppTile {
  readonly name = input('');
  readonly description = input<string | null | undefined>('');
  readonly icon = input<string | null | undefined>();
  readonly theme = input<string | null | undefined>();

  protected readonly iconClass = computed(() => appIconClass(this.icon()));
  protected readonly background = computed(() => appThemeBackground(this.theme()));
}
