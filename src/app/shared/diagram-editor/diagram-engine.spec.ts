import { DiagramDocument } from './diagram-document';
import { ModelJson } from './diagram-model';
import { StencilSet } from './stencil-set';
import { NodeView } from './stencil-view';
import { BPMN_STENCILS_FIXTURE } from './testing/bpmn-stencils.fixture';

const set = new StencilSet(BPMN_STENCILS_FIXTURE);

const model: ModelJson = {
  properties: { process_id: 'p', name: 'P' },
  childShapes: [
    {
      resourceId: 'start',
      stencil: { id: 'StartNoneEvent' },
      bounds: { upperLeft: { x: 100, y: 100 }, lowerRight: { x: 130, y: 130 } },
      outgoing: [{ resourceId: 'f1' }],
      properties: { overrideid: 'start' },
    },
    {
      resourceId: 'f1',
      stencil: { id: 'SequenceFlow' },
      dockers: [
        { x: 15, y: 15 },
        { x: 50, y: 40 },
      ],
      target: { resourceId: 'task' },
      outgoing: [{ resourceId: 'task' }],
      properties: {},
    },
    {
      resourceId: 'task',
      stencil: { id: 'UserTask' },
      bounds: { upperLeft: { x: 180, y: 75 }, lowerRight: { x: 280, y: 155 } },
      outgoing: [{ resourceId: 'timer' }],
      properties: { name: 'Approve', customKey: 'kept' },
    },
    {
      resourceId: 'timer',
      stencil: { id: 'BoundaryTimerEvent' },
      bounds: { upperLeft: { x: 250, y: 140 }, lowerRight: { x: 281, y: 171 } },
      dockers: [{ x: 85, y: 80 }],
      properties: {},
    },
  ],
};

describe('stencil set rules', () => {
  const s = (id: string) => set.stencil(id)!;

  it('picks the connecting edge like Oryx', () => {
    expect(set.connectingEdge(s('UserTask'), s('EndNoneEvent'))?.id).toBe('SequenceFlow');
    expect(set.connectingEdge(s('UserTask'), s('TextAnnotation'))?.id).toBe('Association');
    expect(set.connectingEdge(s('EndNoneEvent'), s('UserTask'))).toBeNull();
  });

  it('knows containment and boundary attachment', () => {
    expect(set.canContain(s('BPMNDiagram'), s('UserTask'))).toBe(true);
    expect(set.canContain(s('Pool'), s('UserTask'))).toBe(false);
    expect(set.canContain(s('Pool'), s('Lane'))).toBe(true);
    expect(set.canContain(s('BPMNDiagram'), s('BoundaryTimerEvent'))).toBe(false);
    expect(set.canAttach(s('UserTask'), s('BoundaryTimerEvent'))).toBe(true);
  });

  it('lists the morph family', () => {
    expect(set.morphOptions(s('UserTask')).map((x) => x.id)).toContain('ServiceTask');
  });
});

describe('node views', () => {
  it('measures natural sizes from the stencil view', () => {
    const task = new NodeView(set.stencil('UserTask')!.view);
    expect([task.width, task.height]).toEqual([100, 80]);
    expect(task.resizableH).toBe(true);
    const start = new NodeView(set.stencil('StartNoneEvent')!.view);
    expect([start.width, start.height]).toEqual([30, 30]);
    expect(start.clampSize(80, 80)).toEqual({ w: 30, h: 30 });
    expect(start.defaultMagnet(30, 30)).toEqual({ x: 15, y: 15 });
  });

  it('lays out anchored elements when resized', () => {
    const task = new NodeView(set.stencil('UserTask')!.view);
    const refs = set.stencil('UserTask')!.properties.filter((p) => p.refToView.length);
    const layout = task.layout(200, 100, { multiinstance_type: 'Parallel' }, refs);
    const frame = layout.shapes.find((s) => s.box.w === 200);
    expect(frame?.box).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(layout.toggles.get('parallel')).toBe(true);
    expect(NodeView.contains(layout, { x: 150, y: 50 })).toBe(true);
    expect(NodeView.contains(layout, { x: 250, y: 50 })).toBe(false);
  });
});

describe('diagram document', () => {
  const load = () => {
    const doc = new DiagramDocument(set, 'm1');
    doc.load(model);
    return doc;
  };

  it('loads shapes, flows and boundary events', () => {
    const state = load().state();
    expect(state.roots).toEqual(['start', 'task', 'timer']);
    expect(state.edges['f1'].source).toEqual({ id: 'start', ref: { x: 15, y: 15 } });
    expect(state.nodes['timer'].host).toEqual({ id: 'task', ref: { x: 85, y: 80 } });
    // Defaults are filled in, unknown keys are kept.
    expect(state.nodes['task'].properties['multiinstance_type']).toBe('None');
    expect(state.nodes['task'].properties['customKey']).toBe('kept');
  });

  it('writes the editor JSON back', () => {
    const json = load().toJson();
    const task = json.childShapes!.find((s) => s.resourceId === 'task')!;
    expect(task.outgoing).toEqual([{ resourceId: 'timer' }]);
    const start = json.childShapes!.find((s) => s.resourceId === 'start')!;
    expect(start.outgoing).toEqual([{ resourceId: 'f1' }]);
    const flow = json.childShapes!.find((s) => s.resourceId === 'f1')!;
    expect(flow.dockers).toEqual([
      { x: 15, y: 15 },
      { x: 50, y: 40 },
    ]);
    expect(flow.target).toEqual({ resourceId: 'task' });
    const timer = json.childShapes!.find((s) => s.resourceId === 'timer')!;
    expect(timer.dockers).toEqual([{ x: 85, y: 80 }]);
    expect(json.stencil).toEqual({ id: 'BPMNDiagram' });
  });

  it('clips flow ends to the shape outlines', () => {
    const doc = load();
    const [a, b] = doc.route(doc.state().edges['f1']);
    expect(Math.round(a.x)).toBe(130);
    expect(Math.round(b.x)).toBe(180);
  });

  it('adds, connects, undoes and tracks unsaved changes', () => {
    const doc = load();
    expect(doc.dirty()).toBe(false);
    const id = doc.appendNode('task', 'EndNoneEvent')!;
    expect(doc.dirty()).toBe(true);
    const end = doc.state().nodes[id];
    expect(end.bounds.x).toBeGreaterThan(280);
    expect(doc.state().edgeOrder.length).toBe(2);
    doc.undo();
    expect(doc.state().nodes[id]).toBeUndefined();
    expect(doc.dirty()).toBe(false);
    doc.redo();
    expect(doc.state().nodes[id]).toBeDefined();
  });

  it('moves boundary events with their activity and deletes connected flows', () => {
    const doc = load();
    doc.selection.set(['task']);
    doc.moveSelection(20, 0);
    expect(doc.state().nodes['timer'].bounds.x).toBe(269.5);
    doc.deleteSelection();
    expect(doc.state().nodes['timer']).toBeUndefined();
    expect(doc.state().edges['f1']).toBeUndefined();
  });
});
