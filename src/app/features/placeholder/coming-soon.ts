import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';

/** Stand-in for screens planned in later phases (see docs/PLAN.md). */
@Component({
  selector: 'fm-coming-soon',
  imports: [RouterLink, ButtonModule],
  template: `
    <section class="soon">
      <i class="pi pi-wrench"></i>
      <h1>{{ title() }}</h1>
      <p>This screen is part of a later phase of the Modeler rewrite.</p>
      <p-button label="Back" icon="pi pi-arrow-left" [text]="true" [routerLink]="back()" />
    </section>
  `,
  styles: `
    .soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 4rem 1rem;
      text-align: center;
    }
    .soon i {
      font-size: 2.5rem;
      color: var(--p-primary-color);
    }
    .soon h1 {
      margin: 0;
      font-size: 1.375rem;
    }
    .soon p {
      margin: 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class ComingSoon {
  readonly title = input('Coming soon');
  readonly back = input('/processes');
}
