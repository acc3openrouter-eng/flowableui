import { DiagramDocument } from './diagram-document';
import { ModelJson } from './diagram-model';
import { CMMN_PROFILE, DMN_PROFILE } from './diagram-profile';
import { StencilSet } from './stencil-set';
import { CMMN_STENCILS_FIXTURE } from './testing/cmmn-stencils.fixture';
import { DMN_STENCILS_FIXTURE } from './testing/dmn-stencils.fixture';

const box = (x: number, y: number, w: number, h: number) => ({
  upperLeft: { x, y },
  lowerRight: { x: x + w, y: y + h },
});

describe('case model profile', () => {
  const set = new StencilSet(CMMN_STENCILS_FIXTURE, CMMN_PROFILE);
  const model: ModelJson = {
    properties: { case_id: 'c' },
    childShapes: [
      {
        resourceId: 'casePlanModel',
        stencil: { id: 'CasePlanModel' },
        bounds: box(40, 40, 600, 400),
        properties: {},
        childShapes: [
          {
            resourceId: 'task',
            stencil: { id: 'HumanTask' },
            // Child bounds are relative to the plan model.
            bounds: box(60, 60, 100, 80),
            properties: { name: 'Review' },
          },
        ],
      },
    ],
  };
  const load = () => {
    const doc = new DiagramDocument(set, 'm1');
    doc.load(model);
    return doc;
  };
  const stencil = (id: string) => set.stencil(id)!;

  it('leaves the plan model and associations out of the palette', () => {
    const ids = set.paletteGroups().flatMap((g) => g.items.map((s) => s.id));
    expect(ids).toContain('HumanTask');
    expect(ids).not.toContain('CasePlanModel');
    expect(ids).not.toContain('Association');
  });

  it('keeps plan items inside the plan model', () => {
    const doc = load();
    expect(doc.dropTarget(stencil('HumanTask'), { x: 10, y: 10 })).toBeNull();
    expect(doc.dropTarget(stencil('HumanTask'), { x: 400, y: 300 })?.parent?.id).toBe(
      'casePlanModel',
    );
  });

  it('docks a criterion dropped on a task border', () => {
    const doc = load();
    const target = doc.dropTarget(stencil('EntryCriterion'), { x: 101, y: 140 });
    expect(target?.host?.id).toBe('task');
    expect(set.connectingEdge(stencil('HumanTask'), stencil('EntryCriterion'))?.id).toBe(
      'Association',
    );
  });

  it('never deletes the plan model', () => {
    const doc = load();
    expect(doc.canDelete('casePlanModel')).toBe(false);
    doc.selection.set(['casePlanModel', 'task']);
    doc.deleteSelection();
    expect(doc.state().nodes['casePlanModel']).toBeDefined();
    expect(doc.state().nodes['task']).toBeUndefined();
  });
});

describe('decision service profile', () => {
  const set = new StencilSet(DMN_STENCILS_FIXTURE, DMN_PROFILE);
  const model: ModelJson = {
    properties: { drd_id: 'd' },
    childShapes: [
      {
        resourceId: 'service',
        stencil: { id: 'ExpandedDecisionService' },
        bounds: box(40, 40, 600, 500),
        properties: {},
        childShapes: [
          {
            resourceId: 'output',
            stencil: { id: 'OutputDecisionsDecisionServiceSection' },
            bounds: box(0, 0, 600, 250),
            properties: {},
          },
          {
            resourceId: 'encapsulated',
            stencil: { id: 'EncapsulatedDecisionsDecisionServiceSection' },
            bounds: box(0, 250, 600, 250),
            properties: {},
          },
        ],
      },
    ],
  };
  const load = () => {
    const doc = new DiagramDocument(set, 'm1');
    doc.load(model);
    return doc;
  };

  it('puts decisions in a section, never on the bare canvas', () => {
    const doc = load();
    const decision = set.stencil('Decision')!;
    expect(doc.dropTarget(decision, { x: 10, y: 10 })).toBeNull();
    expect(doc.dropTarget(decision, { x: 300, y: 100 })?.parent?.id).toBe('output');
    expect(doc.dropTarget(decision, { x: 300, y: 400 })?.parent?.id).toBe('encapsulated');
  });

  it('keeps the service and its sections', () => {
    const doc = load();
    doc.selection.set(['service', 'output', 'encapsulated']);
    doc.deleteSelection();
    expect(Object.keys(doc.state().nodes).sort()).toEqual(['encapsulated', 'output', 'service']);
  });

  it('captions the two sections', () => {
    expect(DMN_PROFILE.caption?.('OutputDecisionsDecisionServiceSection')).toBe('Output decisions');
    expect(DMN_PROFILE.caption?.('Decision')).toBeNull();
  });
});
