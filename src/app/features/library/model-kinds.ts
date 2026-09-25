import { ModelType } from '../../core/api/api.types';
import { ApiUrls } from '../../core/api/api-urls';

/** Everything the generic library, create and import screens need to know about one model type. */
export interface ModelKind {
  id: 'processes' | 'casemodels' | 'forms' | 'decision-tables' | 'decision-services' | 'apps';
  modelType: ModelType;
  /** `filter` query parameter of `GET /rest/models`. */
  filter: string;
  /** Translation prefix of the list page, e.g. `PROCESS-LIST`. */
  listI18n: string;
  /** Translation prefix of the list filter labels, e.g. `PROCESSES` in `PROCESS-LIST.FILTER.PROCESSES-COUNT`. */
  filterI18n: string;
  /** Translation prefix of a single model, e.g. `PROCESS`. */
  itemI18n: string;
  createLabel: string;
  importLabel?: string;
  importUrl?: (urls: ApiUrls, options: { renewIdmIds: boolean }) => string;
  /** App imports can re-link user and group ids to the target environment. */
  importRenewsIdmIds?: boolean;
  importAccept?: string;
  /** Route of the details page (`/processes/:id`). */
  route: string;
  /** Route of the visual editor (`/editor/:id`). */
  editorRoute: string;
  icon: string;
  /** Whether the server renders a diagram thumbnail for this model type. */
  hasThumbnail: boolean;
}

export const MODEL_KINDS: Record<ModelKind['id'], ModelKind> = {
  processes: {
    id: 'processes',
    modelType: ModelType.Bpmn,
    filter: 'processes',
    listI18n: 'PROCESS-LIST',
    filterI18n: 'PROCESSES',
    itemI18n: 'PROCESS',
    createLabel: 'PROCESS-LIST.ACTION.CREATE',
    importLabel: 'PROCESS-LIST.ACTION.IMPORT',
    importUrl: (urls) => urls.importProcessModel(),
    importAccept: '.bpmn,.bpmn20.xml,.xml',
    route: '/processes',
    editorRoute: '/editor',
    icon: 'pi pi-sitemap',
    hasThumbnail: true,
  },
  casemodels: {
    id: 'casemodels',
    modelType: ModelType.Cmmn,
    filter: 'cases',
    listI18n: 'CASE-LIST',
    filterI18n: 'CASES',
    itemI18n: 'CASE',
    createLabel: 'CASE-LIST.ACTION.CREATE',
    importLabel: 'CASE-LIST.ACTION.IMPORT',
    importUrl: (urls) => urls.importCaseModel(),
    importAccept: '.cmmn,.cmmn.xml,.xml',
    route: '/casemodels',
    editorRoute: '/case-editor',
    icon: 'pi pi-briefcase',
    hasThumbnail: true,
  },
  forms: {
    id: 'forms',
    modelType: ModelType.Form,
    filter: 'forms',
    listI18n: 'FORMS-LIST',
    filterI18n: 'FORMS',
    itemI18n: 'FORM',
    createLabel: 'FORMS-LIST.ACTION.CREATE',
    route: '/forms',
    editorRoute: '/form-editor',
    icon: 'pi pi-file-edit',
    hasThumbnail: false,
  },
  'decision-tables': {
    id: 'decision-tables',
    modelType: ModelType.DecisionTable,
    filter: 'decisionTables',
    listI18n: 'DECISIONS-LIST',
    filterI18n: 'DECISION-TABLES',
    itemI18n: 'DECISION-TABLE',
    createLabel: 'DECISIONS-LIST.ACTION.CREATE',
    importLabel: 'DECISIONS-LIST.ACTION.IMPORT-DECISION-TABLE',
    importUrl: (urls) => urls.importDecisionTable(),
    importAccept: '.dmn,.xml',
    route: '/decision-tables',
    editorRoute: '/decision-table-editor',
    icon: 'pi pi-table',
    hasThumbnail: false,
  },
  'decision-services': {
    id: 'decision-services',
    modelType: ModelType.DecisionService,
    filter: 'decisionServices',
    listI18n: 'DECISIONS-LIST',
    filterI18n: 'DECISION-SERVICES',
    itemI18n: 'DECISION-SERVICE',
    createLabel: 'DECISIONS-LIST.ACTION.CREATE-DECISION-SERVICE',
    importLabel: 'DECISIONS-LIST.ACTION.IMPORT-DECISION-SERVICE',
    importUrl: (urls) => urls.importDecisionServiceModel(),
    importAccept: '.dmn,.xml',
    route: '/decision-services',
    editorRoute: '/decision-service-editor',
    icon: 'pi pi-share-alt',
    hasThumbnail: true,
  },
  apps: {
    id: 'apps',
    modelType: ModelType.App,
    filter: 'apps',
    listI18n: 'APPS-LIST',
    filterI18n: 'APPS',
    itemI18n: 'APP',
    createLabel: 'APPS-LIST.ACTION.CREATE',
    importLabel: 'APPS-LIST.ACTION.IMPORT',
    importUrl: (urls, { renewIdmIds }) => urls.importAppDefinition(renewIdmIds),
    importRenewsIdmIds: true,
    importAccept: '.zip,.bar',
    route: '/apps',
    editorRoute: '/app-editor',
    icon: 'pi pi-th-large',
    hasThumbnail: false,
  },
};

export const modelKindForType = (type: ModelType | undefined): ModelKind | undefined =>
  Object.values(MODEL_KINDS).find((kind) => kind.modelType === type);
