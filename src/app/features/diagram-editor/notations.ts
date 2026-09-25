import {
  BPMN_PROFILE,
  DMN_PROFILE,
  DiagramProfile,
} from '../../shared/diagram-editor/diagram-profile';

export type NotationId = 'bpmn' | 'cmmn' | 'dmn';

/** Per-notation settings of the diagram editor page. */
export interface NotationConfig {
  profile: DiagramProfile;
  /** `GET /rest/stencil-sets/{name}`. */
  stencilSet: 'editor' | 'cmmneditor' | 'dmneditor';
  /** `stencilset.url` written when the model has none (the value the original editor writes). */
  stencilsetUrl: string;
  /** Model library route, also the base of the details page. */
  library: string;
  typeLabel: string;
  /** Root property the server overwrites with the model key on save. */
  idProperty: string;
  /** Whether the server validates this notation. */
  validate: boolean;
}

export const NOTATIONS: Record<NotationId, NotationConfig> = {
  bpmn: {
    profile: BPMN_PROFILE,
    stencilSet: 'editor',
    stencilsetUrl: '../editor/stencilsets/bpmn2.0/bpmn2.0.json',
    library: '/processes',
    typeLabel: 'Process model',
    idProperty: 'process_id',
    validate: true,
  },
  cmmn: {
    profile: BPMN_PROFILE,
    stencilSet: 'cmmneditor',
    stencilsetUrl: '../editor/stencilsets/cmmn1.1/cmmn1.1.json',
    library: '/casemodels',
    typeLabel: 'Case model',
    idProperty: 'case_id',
    validate: false,
  },
  dmn: {
    profile: DMN_PROFILE,
    stencilSet: 'dmneditor',
    stencilsetUrl: '../editor/stencilsets/dmn1.1/dmn1.2.json',
    library: '/decision-services',
    typeLabel: 'Decision service',
    idProperty: 'drd_id',
    validate: false,
  },
};
