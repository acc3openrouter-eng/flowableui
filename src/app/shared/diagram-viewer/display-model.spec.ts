import { modelBounds, shapeKind, wrapText } from './display-model';

describe('display model helpers', () => {
  it('classifies BPMN, CMMN and DMN element types', () => {
    expect(shapeKind('StartEvent')).toBe('event');
    expect(shapeKind('TimerEventListener')).toBe('event');
    expect(shapeKind('ExclusiveGateway')).toBe('gateway');
    expect(shapeKind('SubProcess')).toBe('container');
    expect(shapeKind('Stage')).toBe('container');
    expect(shapeKind('DecisionService')).toBe('container');
    expect(shapeKind('EntryCriterion')).toBe('criterion');
    expect(shapeKind('Milestone')).toBe('milestone');
    expect(shapeKind('Decision')).toBe('decision');
    expect(shapeKind('UserTask')).toBe('task');
  });

  it('wraps labels by width and truncates long ones', () => {
    expect(wrapText('Approve the vacation request', 100)).toEqual([
      'Approve the',
      'vacation',
      'request',
    ]);
    expect(wrapText('a b c d e f g h i j k l m n o p q r s t', 30, 2)).toHaveLength(2);
  });

  it('computes bounds over elements, pools and waypoints', () => {
    const bounds = modelBounds(
      {
        elements: [{ id: 'a', type: 'UserTask', x: 100, y: 50, width: 100, height: 80 }],
        flows: [{ id: 'f', type: 'sequenceFlow', waypoints: [{ x: 20, y: 300 }] }],
      },
      0,
    );
    expect(bounds).toEqual({ x: 20, y: 50, width: 180, height: 250 });
  });
});
