import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { DiagramDocument } from './diagram-document';
import { SVG_NS } from './stencil-view';

/** Ids of the task markers that are not part of a task's type icon. */
const MARKERS = new Set(['parallel', 'sequential', 'compensation']);

/**
 * Draws a small icon for a stencil from its own view: the type icon for tasks, the whole shape
 * for everything else.
 */
@Directive({
  selector: '[fmStencilIcon]',
  host: { class: 'fm-stencil-icon' },
})
export class StencilIcon {
  readonly stencilId = input.required<string>({ alias: 'fmStencilIcon' });
  readonly doc = input.required<DiagramDocument>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const svg = renderStencilIcon(this.doc(), this.stencilId());
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}

export function renderStencilIcon(doc: DiagramDocument, stencilId: string): SVGSVGElement {
  const stencil = doc.stencils.stencil(stencilId);
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('aria-hidden', 'true');
  if (!stencil) return svg;
  if (stencil.type === 'edge') {
    const points = [
      { x: 2, y: 22 },
      { x: 22, y: 2 },
    ];
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.appendChild(doc.edgeView(stencilId).render(points, {}, [], `icon-${stencilId}_`));
    return svg;
  }
  const view = doc.nodeView(stencilId);
  const size = view.clampSize(view.width, view.height);
  const props = { ...doc.stencils.defaultProperties(stencil), name: '', text: '' };
  const refs = doc.viewRefs(stencilId);
  const layout = view.layout(size.w, size.h, props, refs);
  const g = view.render(layout, props, refs, `icon-${stencilId}_`);
  const icon = stencil.rawRoles.includes('Activity')
    ? Array.from(g.children).find(
        (c) =>
          c.localName === 'g' &&
          c.getAttribute('transform')?.startsWith('translate') &&
          !MARKERS.has(c.getAttribute('data-ref') ?? ''),
      )
    : undefined;
  if (icon) {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.appendChild(icon);
  } else {
    const pad = 2;
    const side = Math.max(size.w, size.h) + pad * 2;
    svg.setAttribute(
      'viewBox',
      `${-pad - (side - pad * 2 - size.w) / 2} ${-pad - (side - pad * 2 - size.h) / 2} ${side} ${side}`,
    );
    // Keep strokes visible when a large shape (a case plan model, a stage) is shrunk to icon size.
    g.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line').forEach((el) =>
      el.setAttribute('vector-effect', 'non-scaling-stroke'),
    );
    svg.appendChild(g);
  }
  return svg;
}
