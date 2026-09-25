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
  /** Containers whose children stack full width from top to bottom (lanes in a pool). */
  lanes: PoolLayout;
  /** Stencils that cannot be deleted, cut or copied. */
  undeletable: ReadonlySet<string>;
  /** Stencils that only move with their parent. */
  unmovable: (stencilId: string) => boolean;
  /** A caption drawn in the top-left corner of shapes whose view has none. */
  caption?: (stencilId: string) => string | null;
}

export interface PoolLayout {
  isPool(stencilId: string): boolean;
  isLane(stencilId: string): boolean;
  /** Width of the pool's caption band left of the lanes. */
  caption: number;
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
  lanes: { isPool: (id) => id === 'Pool', isLane: (id) => id === 'Lane', caption: 30 },
  undeletable: new Set(),
  unmovable: () => false,
};

export const DMN_PROFILE: DiagramProfile = {
  kind: 'dmn',
  // Requirements are drawn from a decision's quick menu.
  paletteIgnored: new Set(['InformationRequirement']),
  dockedRoles: [],
  quickMenu: [],
  hasQuickMenu: (s) => s.id === 'Decision',
  labelKey,
  // The decision service and its two sections behave like a pool with lanes and no caption.
  lanes: {
    isPool: (id) => id === 'ExpandedDecisionService',
    isLane: (id) => id.endsWith('DecisionServiceSection'),
    caption: 0,
  },
  // The service and its sections come with the model and cannot be added from the palette.
  undeletable: new Set([
    'ExpandedDecisionService',
    'OutputDecisionsDecisionServiceSection',
    'EncapsulatedDecisionsDecisionServiceSection',
  ]),
  unmovable: (id) => id.endsWith('DecisionServiceSection'),
  // The original editor draws no captions, which makes the two sections hard to tell apart.
  caption: (id) =>
    id === 'OutputDecisionsDecisionServiceSection'
      ? 'Output decisions'
      : id === 'EncapsulatedDecisionsDecisionServiceSection'
        ? 'Encapsulated decisions'
        : null,
};
