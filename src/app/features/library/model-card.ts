import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TagModule } from '@openng/optimus-ui/tag';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { ApiUrls } from '../../core/api/api-urls';
import { ModelRepresentation } from '../../core/api/api.types';
import { ModelKind } from './model-kinds';

@Component({
  selector: 'fm-model-card',
  imports: [DatePipe, RouterLink, TranslatePipe, ButtonModule, TagModule, TooltipModule],
  template: `
    <article class="card">
      <a class="preview" [routerLink]="[kind().route, model().id]" [attr.aria-label]="model().name">
        @if (thumbnail() && !thumbnailFailed()) {
          <img [src]="thumbnail()" alt="" loading="lazy" (error)="thumbnailFailed.set(true)" />
        } @else {
          <i [class]="kind().icon"></i>
        }
      </a>
      <div class="body">
        <div class="title-row">
          <a class="title" [routerLink]="[kind().route, model().id]">{{ model().name }}</a>
          <p-tag [value]="'v' + (model().version ?? 1)" severity="secondary" [rounded]="true" />
        </div>
        <div class="meta">
          <span class="key">{{ model().key }}</span>
          @if (model().lastUpdated) {
            <span
              >{{ model().lastUpdatedBy }} · {{ model().lastUpdated | date: 'mediumDate' }}</span
            >
          }
        </div>
        @if (model().description) {
          <p class="text">{{ model().description }}</p>
        }
      </div>
      <div class="actions">
        <p-button
          icon="pi pi-pencil"
          [text]="true"
          [rounded]="true"
          size="small"
          [pTooltip]="kind().itemI18n + '.ACTION.OPEN-IN-EDITOR' | translate"
          tooltipPosition="top"
          [routerLink]="[kind().editorRoute, model().id]"
          [ariaLabel]="kind().itemI18n + '.ACTION.OPEN-IN-EDITOR' | translate"
        />
        <p-button
          icon="pi pi-copy"
          [text]="true"
          [rounded]="true"
          size="small"
          [pTooltip]="kind().itemI18n + '.ACTION.DUPLICATE' | translate"
          tooltipPosition="top"
          (onClick)="duplicate.emit(model())"
          [ariaLabel]="kind().itemI18n + '.ACTION.DUPLICATE' | translate"
        />
      </div>
    </article>
  `,
  styleUrl: './model-card.scss',
})
export class ModelCard {
  private readonly urls = inject(ApiUrls);

  readonly model = input.required<ModelRepresentation>();
  readonly kind = input.required<ModelKind>();
  readonly duplicate = output<ModelRepresentation>();

  protected readonly thumbnailFailed = signal(false);
  protected readonly thumbnail = computed(() =>
    this.kind().hasThumbnail
      ? this.urls.modelThumbnail(this.model().id, this.model().lastUpdated)
      : null,
  );
}
