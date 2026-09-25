import { DiagramDocument } from '../diagram-document';
import { StencilSet } from '../stencil-set';
import { BPMN_STENCILS_FIXTURE } from '../testing/bpmn-stencils.fixture';
import { conditionText, stripTags } from './property-panel';
import { editorFor, listRows, listValue, summarize } from './property-editors';

describe('property editors', () => {
  it('picks an editor for every kind of property', () => {
    expect(editorFor('name', 'string')?.kind).toBe('string');
    expect(editorFor('documentation', 'text')?.kind).toBe('text');
    expect(editorFor('asynchronousdefinition', 'boolean')?.kind).toBe('boolean');
    expect(editorFor('signalref', 'string')?.kind).toBe('definition-ref');
    expect(editorFor('multiinstance_type', 'flowable-multiinstance')?.kind).toBe('select');
    expect(editorFor('usertaskassignment', 'complex')?.kind).toBe('assignment');
    expect(editorFor('conditionsequenceflow', 'complex')?.kind).toBe('condition');
    expect(editorFor('unknowncomplex', 'complex')).toBeNull();
  });

  it('reads and writes wrapped lists, and saves an emptied list as null', () => {
    const editor = editorFor('executionlisteners', 'multiplecomplex')!;
    if (editor.kind !== 'rows') throw new Error('rows expected');
    const stored = '{"executionListeners":[{"event":"start","className":"a.B"}]}';
    expect(listRows(editor.def, stored)).toEqual([{ event: 'start', className: 'a.B' }]);
    expect(listValue(editor.def, [{ event: 'end' }])).toEqual({
      executionListeners: [{ event: 'end' }],
    });
    expect(listValue(editor.def, [])).toBeNull();
    expect(summarize(editor, stored)).toEqual({
      key: 'PROPERTY.EXECUTIONLISTENERS.DISPLAY',
      params: { length: 1 },
    });
  });

  it('summarizes conditions and strips tags from strings', () => {
    const editor = editorFor('conditionsequenceflow', 'complex')!;
    const value = { expression: { type: 'static', staticValue: '${amount > 1000 && vip}' } };
    expect(conditionText(value)).toBe('${amount > 1000 && vip}');
    expect(conditionText('${plain}')).toBe('${plain}');
    expect(summarize(editor, value).text).toBe('${amount > 1000 && v...');
    expect(summarize(editor, null).empty).toBe(true);
    expect(stripTags('Review <b>order</b>')).toBe('Review order');
  });
});

describe('quick add', () => {
  it('places a second shape below the first instead of on top of it', () => {
    const doc = new DiagramDocument(new StencilSet(BPMN_STENCILS_FIXTURE), 'm1');
    doc.load({
      properties: { process_id: 'p' },
      childShapes: [
        {
          resourceId: 'gw',
          stencil: { id: 'ExclusiveGateway' },
          bounds: { upperLeft: { x: 100, y: 100 }, lowerRight: { x: 140, y: 140 } },
          outgoing: [],
          properties: {},
        },
      ],
    });
    const a = doc.appendNode('gw', 'UserTask')!;
    const b = doc.appendNode('gw', 'UserTask')!;
    const state = doc.state();
    expect(state.nodes[a].bounds.x).toBe(state.nodes[b].bounds.x);
    expect(state.nodes[b].bounds.y).toBeGreaterThanOrEqual(
      state.nodes[a].bounds.y + state.nodes[a].bounds.h,
    );
    expect(Object.keys(state.edges)).toHaveLength(2);
  });
});
