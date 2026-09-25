import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { DiagramDocument } from '../diagram-document';
import { Row, complexValue } from './property-editors';

/** Orders a gateway's outgoing sequence flows (stored as their resource ids). */
@Component({
  selector: 'fm-flow-order-dialog',
  imports: [TranslatePipe, ButtonModule, DialogModule],
  template: `
    <p-dialog
      header="Sequence flow order"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '96vw' }"
    >
      @if (flows().length) {
        <p class="intro">{{ 'PROPERTY.SEQUENCEFLOW.ORDER.DESCRIPTION' | translate }}</p>
        <ol class="flows">
          @for (f of flows(); track f.id) {
            <li>
              <span class="n">{{ $index + 1 }}</span>
              <span class="label">{{ f.label }}</span>
              <p-button
                icon="pi pi-arrow-up"
                size="small"
                [text]="true"
                [disabled]="$first"
                [ariaLabel]="'ACTION.MOVE.UP' | translate"
                (onClick)="move($index, -1)"
              />
              <p-button
                icon="pi pi-arrow-down"
                size="small"
                [text]="true"
                [disabled]="$last"
                [ariaLabel]="'ACTION.MOVE.DOWN' | translate"
                (onClick)="move($index, 1)"
              />
            </li>
          }
        </ol>
      } @else {
        <p class="intro">
          {{ 'PROPERTY.SEQUENCEFLOW.ORDER.NO.OUTGOING.SEQUENCEFLOW.FOUND' | translate }}
        </p>
      }
      <ng-template #footer>
        <p-button
          [label]="'ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="'ACTION.SAVE' | translate" icon="pi pi-check" (onClick)="apply()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .intro {
      margin: 0 0 0.75rem;
      color: var(--p-text-muted-color);
    }
    .flows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-md);
    }
    .n {
      width: 1.5rem;
      height: 1.5rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .label {
      flex: 1;
    }
  `,
})
export class FlowOrderDialog {
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly doc = input.required<DiagramDocument>();
  readonly gatewayId = input.required<string>();
  readonly value = input<unknown>(null);
  readonly save = output<unknown>();

  protected readonly flows = signal<{ id: string; label: string }[]>([]);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.open());
    });
  }

  private open() {
    const doc = this.doc();
    const state = doc.state();
    const outgoing = state.edgeOrder
      .map((id) => state.edges[id])
      .filter((e) => e.stencil === 'SequenceFlow' && e.source?.id === this.gatewayId());
    const saved = (complexValue(this.value()) as Row | null)?.['sequenceFlowOrder'];
    const order = Array.isArray(saved) ? (saved as string[]) : [];
    outgoing.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
    this.flows.set(
      outgoing.map((e) => {
        const target = e.target ? state.nodes[e.target.id] : null;
        const type = target
          ? this.translate.instant(doc.stencilOf(target)?.title ?? target.stencil)
          : '';
        const name = String(target?.properties['name'] || target?.properties['overrideid'] || '');
        return {
          id: e.id,
          label: this.translate.instant('PROPERTY.SEQUENCEFLOW.ORDER.SEQUENCEFLOW.VALUE', {
            targetType: type,
            targetTitle: name,
          }),
        };
      }),
    );
  }

  protected move(index: number, delta: number) {
    this.flows.update((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  protected apply() {
    const ids = this.flows().map((f) => f.id);
    this.save.emit(ids.length ? { sequenceFlowOrder: ids } : null);
    this.visible.set(false);
  }
}
