import { TestBed } from '@angular/core/testing';
import { DiagramViewer } from './diagram-viewer';
import { DisplayModel } from './display-model';

const MODEL: DisplayModel = {
  elements: [
    { id: 'start', type: 'StartEvent', x: 100, y: 100, width: 30, height: 30 },
    {
      id: 'task',
      name: 'Approve request',
      type: 'UserTask',
      x: 180,
      y: 75,
      width: 100,
      height: 80,
    },
    { id: 'gw', type: 'ExclusiveGateway', x: 320, y: 95, width: 40, height: 40 },
    { id: 'sub', name: 'Sub', type: 'SubProcess', x: 50, y: 50, width: 400, height: 200 },
  ],
  flows: [
    {
      id: 'f1',
      type: 'sequenceFlow',
      waypoints: [
        { x: 130, y: 115 },
        { x: 180, y: 115 },
      ],
    },
    {
      id: 'a1',
      type: 'Association',
      waypoints: [
        { x: 280, y: 115 },
        { x: 320, y: 115 },
      ],
    },
  ],
};

describe('DiagramViewer', () => {
  it('renders shapes, containers first, and flows with arrows except associations', async () => {
    const fixture = TestBed.createComponent(DiagramViewer);
    fixture.componentRef.setInput('model', MODEL);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    const shapes = Array.from(root.querySelectorAll('g.shape'));
    expect(shapes).toHaveLength(4);
    expect(shapes[0].classList).toContain('container');
    const label = Array.from(root.querySelectorAll('g.type-UserTask text.label')).map((t) =>
      t.textContent?.trim(),
    );
    expect(label.join(' ')).toBe('Approve request');
    expect(root.querySelector('g.gateway path.marker')).not.toBeNull();

    const lines = root.querySelectorAll('g.edge polyline');
    expect(lines[0].getAttribute('marker-end')).toBe('url(#fm-arrow)');
    expect(lines[1].getAttribute('marker-end')).toBeNull();
    expect(lines[1].classList).toContain('dashed');
  });
});
