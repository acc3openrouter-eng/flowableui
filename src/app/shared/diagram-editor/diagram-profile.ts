import type { Stencil } from './stencil-set';

/** What differs between the BPMN, CMMN and DMN editors that share the diagram engine. */
export interface DiagramProfile {
  kind: 'bpmn' | 'cmmn' | 'dmn';
  /** Stencils the palette does not list. */
  paletteIgnored: ReadonlySet<string>;
  /** Raw roles of stencils that dock on another shape's border (boundary events, sentries). */
  dockedRoles: readonly string[];
  /** Shapes offered by the quick menu next to a selected shape. */
  quickMenu: readonly string[];
  /** Does a selected shape of this stencil get the quick menu? */
  hasQuickMenu(stencil: Stencil): boolean;
  /** Property edited by inline rename (the label shown on the shape). */
  labelKey(stencilId: string): string;
}

const labelKey = (stencilId: string) => (stencilId === 'TextAnnotation' ? 'text' : 'name');

export const BPMN_PROFILE: DiagramProfile = {
  kind: 'bpmn',
  paletteIgnored: new Set([
    'SequenceFlow',
    'MessageFlow',
    'Association',
    'DataAssociation',
    'DataStore',
    'SendTask',
  ]),
  dockedRoles: ['IntermediateEventOnActivityBoundary'],
  quickMenu: [
    'UserTask',
    'EndNoneEvent',
    'ExclusiveGateway',
    'CatchTimerEvent',
    'ThrowNoneEvent',
    'TextAnnotation',
  ],
  hasQuickMenu: (s) =>
    s.rawRoles.includes('sequence_start') ||
    s.id === 'TextAnnotation' ||
    s.id === 'BoundaryCompensationEvent',
  labelKey,
};
