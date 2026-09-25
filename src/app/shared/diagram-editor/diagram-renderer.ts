import { DiagramDocument } from './diagram-document';
import { DiagramEdge, DiagramNode, DiagramState } from './diagram-model';
import { Point } from './geometry';
import { SVG_NS } from './stencil-view';

interface Rendered {
  signature: string;
  g: SVGGElement;
}

/**
 * Draws the diagram into an SVG group, re-rendering only the shapes that changed. Nodes are
 * painted parents first; all edges are painted above all nodes, as in Oryx.
 */
export class DiagramRenderer {
  private readonly nodes = new Map<string, Rendered>();
  private readonly edges = new Map<string, Rendered>();
  private readonly nodeLayer: SVGGElement;
  private readonly edgeLayer: SVGGElement;

  constructor(
    private readonly doc: DiagramDocument,
    host: SVGGElement,
  ) {
    this.nodeLayer = document.createElementNS(SVG_NS, 'g');
    this.edgeLayer = document.createElementNS(SVG_NS, 'g');
    host.append(this.nodeLayer, this.edgeLayer);
  }

  render(state: DiagramState): Map<string, Point[]> {
    const seen = new Set<string>();
    for (const node of this.doc.paintOrder(state)) {
      seen.add(node.id);
      const g = this.renderNode(node);
      this.nodeLayer.appendChild(g);
    }
    for (const [id, r] of this.nodes) {
      if (!seen.has(id)) {
        r.g.remove();
        this.nodes.delete(id);
      }
    }

    const routes = new Map<string, Point[]>();
    const seenEdges = new Set<string>();
    for (const id of state.edgeOrder) {
      const edge = state.edges[id];
      if (!edge) continue;
      seenEdges.add(id);
      const points = this.doc.route(edge, state);
      routes.set(id, points);
      this.edgeLayer.appendChild(this.renderEdge(edge, points));
    }
    for (const [id, r] of this.edges) {
      if (!seenEdges.has(id)) {
        r.g.remove();
        this.edges.delete(id);
      }
    }
    return routes;
  }

  private renderNode(node: DiagramNode): SVGGElement {
    const refs = this.doc.viewRefs(node.stencil);
    const signature = JSON.stringify([
      node.stencil,
      node.bounds.w,
      node.bounds.h,
      refs.map((r) => node.properties[r.key] ?? null),
    ]);
    let r = this.nodes.get(node.id);
    if (!r || r.signature !== signature) {
      const layout = this.doc.layoutOf(node);
      const view = this.doc
        .nodeView(node.stencil)
        .render(layout, node.properties, refs, `${node.id}_`);
      const g = r?.g ?? (document.createElementNS(SVG_NS, 'g') as SVGGElement);
      g.replaceChildren(view);
      const caption = this.doc.stencils.profile.caption?.(node.stencil);
      if (caption) {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'dg-caption');
        text.setAttribute('x', '12');
        text.setAttribute('y', '20');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#64748b');
        text.setAttribute('pointer-events', 'none');
        text.textContent = caption;
        g.appendChild(text);
      }
      g.setAttribute('class', 'dg-node');
      g.setAttribute('data-id', node.id);
      g.setAttribute('data-stencil', node.stencil);
      r = { signature, g };
      this.nodes.set(node.id, r);
    }
    r.g.setAttribute('transform', `translate(${node.bounds.x} ${node.bounds.y})`);
    return r.g;
  }

  private renderEdge(edge: DiagramEdge, points: Point[]): SVGGElement {
    const refs = (this.doc.stencils.stencil(edge.stencil)?.properties ?? []).filter(
      (p) => p.refToView.length,
    );
    const signature = JSON.stringify([
      edge.stencil,
      points,
      refs.map((r) => edge.properties[r.key] ?? null),
    ]);
    let r = this.edges.get(edge.id);
    if (!r || r.signature !== signature) {
      const g = this.doc
        .edgeView(edge.stencil)
        .render(points, edge.properties, refs, `${edge.id}_`);
      g.setAttribute('class', 'dg-edge');
      g.setAttribute('data-id', edge.id);
      r?.g.remove();
      r = { signature, g };
      this.edges.set(edge.id, r);
    }
    return r.g;
  }
}
